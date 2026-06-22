import { createSign } from "node:crypto";

const FIRESTORE_ROOT = "https://firestore.googleapis.com/v1/projects";
const FIREBASE_LOOKUP_ROOT = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DEFAULT_SHARE_MODE = (process.env.GOOGLE_DRIVE_SHARE_MODE || "anyone").toLowerCase();
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const DRIVE_APP_PROPERTY_MAX_BYTES = 124;

let cachedDriveToken = null;

export const config = {
  api: {
    bodyParser: false
  },
  maxDuration: 60
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const firebaseApiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const sharedDriveId = cleanId(process.env.GOOGLE_SHARED_DRIVE_ID);
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = readPrivateKey();

    if (!firebaseApiKey || !projectId) {
      return response.status(500).json({ error: "Missing Firebase server environment variables." });
    }
    if (!sharedDriveId || !serviceAccountEmail || !privateKey) {
      return response.status(500).json({ error: "Missing Shared Drive service account environment variables." });
    }

    const idToken = readBearerToken(request);
    if (!idToken) return response.status(401).json({ error: "Missing Firebase ID token." });

    const requester = await verifyFirebaseToken(firebaseApiKey, idToken);
    if (request.headers["x-classroom-upload-action"] === "chunk") {
      const driveToken = await getDriveAccessToken({ serviceAccountEmail, privateKey });
      const result = await proxyDriveChunk(request, driveToken);
      return response.status(200).json(result);
    }

    const body = await readJsonBody(request);
    const classId = cleanPathId(body.classId);
    if (!classId) return response.status(400).json({ error: "Missing classId." });

    const [courseDoc, memberDoc] = await Promise.all([
      getFirestoreDocument(projectId, `classes/${classId}`, idToken),
      getFirestoreDocument(projectId, `classes/${classId}/members/${requester.email}`, idToken).catch((error) => {
        if (error.status === 404) return null;
        throw error;
      })
    ]);
    const course = decodeFirestoreDocument(courseDoc);
    const member = memberDoc ? decodeFirestoreDocument(memberDoc) : null;

    if (body.action === "download") {
      if (!canManageCourseFiles(requester.email, course)) {
        return response.status(403).json({ error: "You do not have download access to this class." });
      }
      const driveToken = await getDriveAccessToken({ serviceAccountEmail, privateKey });
      const file = await downloadDriveFile({
        classId,
        fileId: body.fileId,
        accessToken: driveToken
      });
      response.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeRFC5987Value(file.name || "submission-file")}`);
      response.setHeader("Cache-Control", "private, max-age=0, no-store");
      return response.status(200).send(file.buffer);
    }

    if (!canUploadToCourse(requester.email, course, member, body.folderPath)) {
      return response.status(403).json({ error: "You do not have upload access to this class." });
    }

    const driveToken = await getDriveAccessToken({ serviceAccountEmail, privateKey });
    if (body.action === "finish") {
      const file = await finishDriveUpload({
        classId,
        requesterEmail: requester.email,
        fileId: body.fileId,
        shareMode: body.shareMode,
        accessToken: driveToken
      });
      return response.status(200).json({ file });
    }

    const upload = await startDriveUpload({
      classId,
      course,
      requesterEmail: requester.email,
      sharedDriveId,
      folderPath: body.folderPath,
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      accessToken: driveToken
    });
    return response.status(200).json(upload);
  } catch (error) {
    console.error(error);
    return response.status(error.status || 500).json({ error: error.message || "Could not upload file." });
  }
}

async function startDriveUpload({ classId, course, requesterEmail, sharedDriveId, folderPath, fileName, mimeType, fileSize, accessToken }) {
  const safeFileName = sanitizeFileName(fileName || "upload.bin");
  const safeMimeType = String(mimeType || "application/octet-stream");
  const ownerEmail = normalizeEmail(course.ownerEmail || "unknown-owner");
  const courseCode = course.code || classId;
  const cleanFolderPath = sanitizeFolderPath(folderPath || "files");
  const parentId = await ensureFolderPath(
    [
      "HG Classroom",
      ownerEmail,
      `${courseCode} - ${course.name || classId}`,
      ...cleanFolderPath.split("/").filter(Boolean)
    ],
    sharedDriveId,
    accessToken
  );

  const metadata = {
    name: safeFileName,
    parents: [parentId],
    appProperties: sanitizeAppProperties({
      classId,
      classCode: course.code || "",
      folderPath: cleanFolderPath,
      uploadedBy: requesterEmail
    })
  };
  const params = new URLSearchParams({
    uploadType: "resumable",
    supportsAllDrives: "true",
    fields: "id,name,mimeType,webViewLink,webContentLink,thumbnailLink,appProperties,driveId"
  });
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": safeMimeType
  };
  const numericSize = Number(fileSize);
  if (Number.isFinite(numericSize) && numericSize >= 0) {
    headers["X-Upload-Content-Length"] = String(numericSize);
  }
  const uploadResponse = await fetch(`${DRIVE_UPLOAD_API}/files?${params}`, {
    method: "POST",
    headers,
    body: JSON.stringify(metadata)
  });
  const uploadUrl = uploadResponse.headers.get("location");
  const result = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !uploadUrl) {
    throw Object.assign(new Error(result.error?.message || "Could not create Google Drive upload session."), { status: uploadResponse.status || 500 });
  }
  return { uploadUrl };
}

async function finishDriveUpload({ classId, requesterEmail, fileId, shareMode, accessToken }) {
  const cleanFileId = cleanId(fileId);
  if (!cleanFileId) throw Object.assign(new Error("Missing uploaded Drive file id."), { status: 400 });
  const driveFile = await driveJson(`${DRIVE_API}/files/${encodeURIComponent(cleanFileId)}?supportsAllDrives=true&fields=id,name,mimeType,webViewLink,webContentLink,thumbnailLink,appProperties,driveId`, {}, accessToken);
  if (driveFile.appProperties?.classId !== classId || normalizeEmail(driveFile.appProperties?.uploadedBy) !== requesterEmail) {
    throw Object.assign(new Error("Uploaded file does not match this class upload session."), { status: 403 });
  }
  await applyFileSharing(driveFile.id, normalizeShareMode(shareMode), accessToken);
  return formatDriveFile(driveFile);
}

async function proxyDriveChunk(request, accessToken) {
  const uploadUrl = request.headers["x-classroom-upload-url"];
  const contentRange = request.headers["content-range"];
  const contentType = request.headers["content-type"] || "application/octet-stream";
  if (!uploadUrl || !String(uploadUrl).startsWith("https://www.googleapis.com/upload/drive/")) {
    throw Object.assign(new Error("Missing or invalid Google Drive upload session."), { status: 400 });
  }
  if (!contentRange) {
    throw Object.assign(new Error("Missing upload Content-Range."), { status: 400 });
  }

  const chunk = await readRawBody(request, MAX_CHUNK_BYTES);
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
      "Content-Length": String(chunk.length),
      "Content-Range": String(contentRange)
    },
    body: chunk
  });

  if (uploadResponse.status === 308) {
    return {
      done: false,
      range: uploadResponse.headers.get("range") || ""
    };
  }

  const result = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !result.id) {
    throw Object.assign(new Error(result.error?.message || `Google Drive chunk upload failed (${uploadResponse.status}).`), { status: uploadResponse.status || 502 });
  }
  return {
    done: true,
    driveFile: result
  };
}

function formatDriveFile(driveFile) {
  const downloadUrl = driveFile.webContentLink || `https://drive.google.com/uc?export=download&id=${driveFile.id}`;
  const previewUrl = driveFile.thumbnailLink || (driveFile.mimeType?.startsWith("image/")
    ? `https://drive.google.com/thumbnail?id=${driveFile.id}&sz=w1000`
    : driveFile.webViewLink);
  return {
    fileName: driveFile.name,
    url: downloadUrl,
    previewUrl,
    webViewLink: driveFile.webViewLink || downloadUrl,
    driveFileId: driveFile.id,
    type: driveFile.mimeType
  };
}

async function downloadDriveFile({ classId, fileId, accessToken }) {
  const cleanFileId = cleanId(fileId);
  if (!cleanFileId) throw Object.assign(new Error("Missing Drive file id."), { status: 400 });
  const driveFile = await driveJson(`${DRIVE_API}/files/${encodeURIComponent(cleanFileId)}?supportsAllDrives=true&fields=id,name,mimeType,appProperties`, {}, accessToken);
  if (driveFile.appProperties?.classId !== classId) {
    throw Object.assign(new Error("File does not belong to this class."), { status: 403 });
  }

  const mediaResponse = await fetch(`${DRIVE_API}/files/${encodeURIComponent(cleanFileId)}?alt=media&supportsAllDrives=true`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!mediaResponse.ok) {
    const result = await mediaResponse.json().catch(() => ({}));
    throw Object.assign(new Error(result.error?.message || `Google Drive download failed (${mediaResponse.status}).`), { status: mediaResponse.status || 502 });
  }
  return {
    name: driveFile.name || "submission-file",
    mimeType: driveFile.mimeType || mediaResponse.headers.get("content-type") || "application/octet-stream",
    buffer: Buffer.from(await mediaResponse.arrayBuffer())
  };
}

function readBearerToken(request) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100000) {
        reject(Object.assign(new Error("Request body too large."), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function readRawBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("Upload chunk is too large."), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function verifyFirebaseToken(apiKey, idToken) {
  const authResponse = await fetch(`${FIREBASE_LOOKUP_ROOT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  const result = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !result.users?.[0]?.email) {
    throw Object.assign(new Error("Invalid Firebase ID token."), { status: 401 });
  }
  return { email: normalizeEmail(result.users[0].email) };
}

async function getFirestoreDocument(projectId, path, idToken) {
  const firestoreResponse = await fetch(`${FIRESTORE_ROOT}/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeDocumentPath(path)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const result = await firestoreResponse.json().catch(() => ({}));
  if (!firestoreResponse.ok) {
    throw Object.assign(new Error(result.error?.message || "Firestore document read failed."), { status: firestoreResponse.status });
  }
  return result;
}

function decodeFirestoreDocument(document) {
  const data = {};
  Object.entries(document.fields || {}).forEach(([key, value]) => {
    data[key] = decodeFirestoreValue(value);
  });
  return { id: document.name?.split("/").pop() || "", ...data };
}

function decodeFirestoreValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decodeFirestoreValue(child)]));
  }
  return "";
}

function canUploadToCourse(email, course, member, folderPath = "") {
  const normalized = normalizeEmail(email);
  const supremeEmail = normalizeEmail(process.env.SUPREME_EMAIL || "hhluan@hcmus.edu.vn");
  if (normalized && normalized === supremeEmail) return true;
  const ownerEmail = normalizeEmail(course.ownerEmail);
  const lecturerEmails = new Set([
    ownerEmail,
    ...(course.lecturerEmails || []).map(normalizeEmail),
    ...(course.lecturers || []).map((lecturer) => normalizeEmail(lecturer.email))
  ].filter(Boolean));
  if (lecturerEmails.has(normalized)) return true;
  const acceptedMember = normalizeEmail(member?.email) === normalized && member?.status === "accepted";
  if (!acceptedMember) return false;
  if (String(folderPath || "").split("/")[0] !== "announcements") return true;

  const permission = normalizeAnnouncementPostPermission(course.announcementPostPermission);
  if (permission === "everyone") return true;
  if (permission === "everyone_no_files") return false;
  if (permission === "lecturers_leaders") return member?.classLeader === true || member?.role === "classLeader";
  return false;
}

function canManageCourseFiles(email, course) {
  const normalized = normalizeEmail(email);
  const supremeEmail = normalizeEmail(process.env.SUPREME_EMAIL || "hhluan@hcmus.edu.vn");
  if (normalized && normalized === supremeEmail) return true;
  const ownerEmail = normalizeEmail(course.ownerEmail);
  const lecturerEmails = new Set([
    ownerEmail,
    ...(course.lecturerEmails || []).map(normalizeEmail),
    ...(course.lecturers || []).map((lecturer) => normalizeEmail(lecturer.email))
  ].filter(Boolean));
  return lecturerEmails.has(normalized);
}

function normalizeAnnouncementPostPermission(value) {
  return ["lecturers", "lecturers_leaders", "everyone", "everyone_no_files"].includes(String(value || ""))
    ? String(value)
    : "everyone";
}

async function getDriveAccessToken({ serviceAccountEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedDriveToken?.token && cachedDriveToken.expiresAt > now + 60) return cachedDriveToken.token;

  const assertion = signJwt({
    iss: serviceAccountEmail,
    scope: DRIVE_SCOPE,
    aud: DRIVE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }, privateKey);

  const tokenResponse = await fetch(DRIVE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !result.access_token) {
    throw Object.assign(new Error(result.error_description || result.error || "Could not authorize Google Drive service account."), { status: 500 });
  }
  cachedDriveToken = {
    token: result.access_token,
    expiresAt: now + Number(result.expires_in || 3600)
  };
  return cachedDriveToken.token;
}

function signJwt(payload, privateKey) {
  const header = { alg: "RS256", typ: "JWT" };
  const unsigned = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey, "base64url")}`;
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function driveJson(url, options = {}, accessToken) {
  const driveResponse = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const result = await driveResponse.json().catch(() => ({}));
  if (!driveResponse.ok) {
    throw Object.assign(new Error(result.error?.message || "Google Drive API request failed."), { status: driveResponse.status });
  }
  return result;
}

async function ensureFolderPath(parts, sharedDriveId, accessToken) {
  let parentId = sharedDriveId;
  for (const part of parts.map(safeSegment).filter(Boolean)) {
    parentId = await ensureFolder(part, parentId, sharedDriveId, accessToken);
  }
  return parentId;
}

async function ensureFolder(name, parentId, sharedDriveId, accessToken) {
  const query = [
    `mimeType='${FOLDER_MIME}'`,
    `name='${escapeDriveQueryValue(name)}'`,
    `'${escapeDriveQueryValue(parentId)}' in parents`,
    "trashed=false"
  ].join(" and ");
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name)",
    corpora: "drive",
    driveId: sharedDriveId,
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    pageSize: "1"
  });
  const existing = await driveJson(`${DRIVE_API}/files?${params}`, {}, accessToken);
  if (existing.files?.[0]?.id) return existing.files[0].id;

  const created = await driveJson(`${DRIVE_API}/files?supportsAllDrives=true&fields=id,name`, {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
      appProperties: { classroompwa: "true" }
    })
  }, accessToken);
  return created.id;
}

async function applyFileSharing(fileId, shareMode, accessToken) {
  if (shareMode !== "anyone") return;
  await driveJson(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false&supportsAllDrives=true`, {
    method: "POST",
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
      allowFileDiscovery: false
    })
  }, accessToken);
}

function readPrivateKey() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  return (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

function encodeDocumentPath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

function cleanPathId(value) {
  return String(value || "").trim().replace(/\//g, "");
}

function cleanId(value) {
  return String(value || "").trim();
}

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function sanitizeFolderPath(value) {
  return String(value || "files")
    .split("/")
    .map(safeSegment)
    .filter(Boolean)
    .join("/") || "files";
}

function safeSegment(value) {
  return String(value || "files").replace(/[\\/:*?"<>|#{}%~&]/g, "-").trim() || "files";
}

function sanitizeFileName(value) {
  return safeSegment(value || "upload.bin");
}

function sanitizeAppProperties(values) {
  return Object.fromEntries(Object.entries(values)
    .map(([key, value]) => {
      const cleanKey = String(key || "").trim();
      if (!cleanKey) return null;
      const maxValueBytes = DRIVE_APP_PROPERTY_MAX_BYTES - Buffer.byteLength(cleanKey, "utf8");
      if (maxValueBytes <= 0) return null;
      return [cleanKey, truncateUtf8(String(value || ""), maxValueBytes)];
    })
    .filter(Boolean));
}

function truncateUtf8(value, maxBytes) {
  let output = "";
  let usedBytes = 0;
  for (const char of String(value || "")) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (usedBytes + charBytes > maxBytes) break;
    output += char;
    usedBytes += charBytes;
  }
  return output;
}

function escapeDriveQueryValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeShareMode(value) {
  return String(value || DEFAULT_SHARE_MODE).toLowerCase() === "private" ? "private" : "anyone";
}

function encodeRFC5987Value(value) {
  return encodeURIComponent(String(value || "file"))
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");
}
