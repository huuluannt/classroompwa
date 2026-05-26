import { getCurrentIdToken } from "./firebase";

const DRIVE_UPLOAD_CHUNK_SIZE = 3 * 1024 * 1024;

export async function uploadDriveFile(courseId, folderPath, file, shareOptions = {}) {
  const idToken = await getCurrentIdToken();
  if (!idToken) throw new Error("Missing Firebase session. Please sign in again.");

  const startResponse = await fetch("/api/upload-file", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "start",
      classId: courseId,
      folderPath: folderPath || "files",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      shareMode: shareOptions.anyoneWithLink ? "anyone" : ""
    })
  });
  const startResult = await startResponse.json().catch(() => ({}));
  if (!startResponse.ok || !startResult.uploadUrl) {
    throw new Error(startResult.error || "Could not create class upload session.");
  }

  const uploadedDriveFile = await uploadFileChunks({
    uploadUrl: startResult.uploadUrl,
    file,
    idToken
  });

  const finishResponse = await fetch("/api/upload-file", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "finish",
      classId: courseId,
      fileId: uploadedDriveFile.id,
      shareMode: shareOptions.anyoneWithLink ? "anyone" : ""
    })
  });
  const finishResult = await finishResponse.json().catch(() => ({}));
  if (!finishResponse.ok || !finishResult.file) {
    throw new Error(finishResult.error || "Could not finalize class file upload.");
  }
  return finishResult.file;
}

async function uploadFileChunks({ uploadUrl, file, idToken }) {
  const total = file.size;
  const mimeType = file.type || "application/octet-stream";
  if (total === 0) {
    const response = await uploadChunk({
      uploadUrl,
      idToken,
      chunk: file,
      mimeType,
      start: 0,
      end: 0,
      total: 0
    });
    if (response.done && response.driveFile?.id) return response.driveFile;
  }

  let offset = 0;
  let lastResponse = null;
  while (offset < total) {
    const endExclusive = Math.min(offset + DRIVE_UPLOAD_CHUNK_SIZE, total);
    const chunk = file.slice(offset, endExclusive, mimeType);
    lastResponse = await uploadChunk({
      uploadUrl,
      idToken,
      chunk,
      mimeType,
      start: offset,
      end: endExclusive - 1,
      total
    });
    if (lastResponse.done && lastResponse.driveFile?.id) return lastResponse.driveFile;
    offset = endExclusive;
  }
  throw new Error(lastResponse?.error || "Google Drive upload did not finish.");
}

async function uploadChunk({ uploadUrl, idToken, chunk, mimeType, start, end, total }) {
  const response = await fetch("/api/upload-file", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": mimeType,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "X-Classroom-Upload-Action": "chunk",
      "X-Classroom-Upload-Url": uploadUrl
    },
    body: chunk
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Could not upload file chunk.");
  }
  return result;
}
