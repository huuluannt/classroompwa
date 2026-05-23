import { getGoogleAccessToken, getGoogleDriveUserKey } from "./firebase";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const FOLDER_CACHE_KEY = "classroompwa-drive-folders";
const SHARE_MODE = (import.meta.env.VITE_GOOGLE_DRIVE_SHARE_MODE || "class").toLowerCase();

function readFolderCache() {
  try {
    return JSON.parse(localStorage.getItem(FOLDER_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeFolderCache(cache) {
  localStorage.setItem(FOLDER_CACHE_KEY, JSON.stringify(cache));
}

function safeSegment(value) {
  return String(value || "files").replace(/[\\/:*?"<>|#{}%~&]/g, "-").trim() || "files";
}

async function driveJson(url, options = {}) {
  const accessToken = options.accessToken || await getGoogleAccessToken();
  if (!accessToken) throw new Error("Không có Google Drive access token. Vui lòng đăng nhập lại bằng Google.");

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive API lỗi ${response.status}: ${text}`);
  }

  return response.status === 204 ? null : response.json();
}

async function createFolder(name, parentId, accessToken) {
  const metadata = {
    name,
    mimeType: FOLDER_MIME,
    appProperties: { classroompwa: "true" },
    ...(parentId ? { parents: [parentId] } : {})
  };

  return driveJson(`${DRIVE_API}/files?fields=id,name,webViewLink`, {
    method: "POST",
    accessToken,
    body: JSON.stringify(metadata)
  });
}

async function ensureFolderPath(parts, accessToken) {
  const userKey = getGoogleDriveUserKey();
  const cache = readFolderCache();
  let parentId = "";
  let cachePath = userKey;

  for (const rawPart of parts.map(safeSegment)) {
    cachePath = `${cachePath}/${rawPart}`;
    if (!cache[cachePath]) {
      const folder = await createFolder(rawPart, parentId, accessToken);
      cache[cachePath] = folder.id;
      writeFolderCache(cache);
    }
    parentId = cache[cachePath];
  }

  return parentId;
}

async function createPermission(fileId, permission, accessToken) {
  await driveJson(`${DRIVE_API}/files/${fileId}/permissions?sendNotificationEmail=false&supportsAllDrives=true`, {
    method: "POST",
    accessToken,
    body: JSON.stringify(permission)
  });
}

function uniqueEmails(emails = []) {
  return [...new Set(emails.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean))];
}

async function shareForClassDownload(fileId, accessToken, shareOptions = {}) {
  if (SHARE_MODE === "private") return;

  if (SHARE_MODE === "anyone") {
    await createPermission(fileId, {
      role: "reader",
      type: "anyone",
      allowFileDiscovery: false
    }, accessToken);
    return;
  }

  const ownerEmail = getGoogleDriveUserKey().toLowerCase();
  const writerEmails = uniqueEmails(shareOptions.writerEmails).filter((email) => email !== ownerEmail);
  const readerEmails = uniqueEmails(shareOptions.readerEmails).filter((email) => email !== ownerEmail && !writerEmails.includes(email));
  const permissions = [
    ...writerEmails.map((emailAddress) => ({ role: "writer", type: "user", emailAddress })),
    ...readerEmails.map((emailAddress) => ({ role: "reader", type: "user", emailAddress }))
  ];

  await Promise.all(permissions.map((permission) => createPermission(fileId, permission, accessToken)));
}

async function uploadMultipartFile(file, parentId, metadata, accessToken) {
  const boundary = `classroompwa_${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify({
      name: file.name,
      parents: [parentId],
      appProperties: metadata
    }),
    "\r\n",
    `--${boundary}\r\n`,
    `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Không upload được lên Google Drive (${response.status}): ${text}`);
  }

  return response.json();
}

export async function uploadDriveFile(courseId, folderPath, file, shareOptions = {}) {
  const accessToken = await getGoogleAccessToken();
  const folderParts = ["ClassroomPWA", courseId, ...String(folderPath || "files").split("/").filter(Boolean)];
  const parentId = await ensureFolderPath(folderParts, accessToken);
  const driveFile = await uploadMultipartFile(file, parentId, {
    courseId,
    folderPath,
    originalName: file.name
  }, accessToken);

  await shareForClassDownload(driveFile.id, accessToken, shareOptions);

  const downloadUrl = driveFile.webContentLink || `https://drive.google.com/uc?export=download&id=${driveFile.id}`;
  const previewUrl = driveFile.thumbnailLink || (file.type?.startsWith("image/")
    ? `https://drive.google.com/thumbnail?id=${driveFile.id}&sz=w1000`
    : driveFile.webViewLink);

  return {
    fileName: driveFile.name || file.name,
    url: downloadUrl,
    previewUrl,
    webViewLink: driveFile.webViewLink || downloadUrl,
    driveFileId: driveFile.id,
    type: file.type
  };
}
