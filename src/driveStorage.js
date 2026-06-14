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
    throw new Error(formatDriveUploadError(startResult.error, {
      file,
      phase: "tạo phiên upload",
      status: startResponse.status
    }));
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
    throw new Error(formatDriveUploadError(finishResult.error, {
      file,
      phase: "hoàn tất upload",
      status: finishResponse.status
    }));
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
      file,
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
      file,
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

async function uploadChunk({ uploadUrl, idToken, chunk, file, mimeType, start, end, total }) {
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
    throw new Error(formatDriveUploadError(result.error, {
      file,
      phase: "upload dữ liệu",
      status: response.status
    }));
  }
  return result;
}

function formatDriveUploadError(error, { file, phase, status } = {}) {
  const rawMessage = String(error || "").trim();
  const fileName = file?.name ? ` "${file.name}"` : "";
  const statusText = status ? `HTTP ${status}` : "";
  let reason = rawMessage || "Google Drive không trả về lý do cụ thể.";

  if (/Properties and app properties are limited/i.test(rawMessage)) {
    reason = "metadata nội bộ của Google Drive vượt giới hạn 124 bytes. Hệ thống đã được cập nhật để tự rút gọn metadata; vui lòng thử upload lại.";
  } else if (/upload access|do not have upload access/i.test(rawMessage)) {
    reason = "tài khoản hiện tại không có quyền upload vào lớp này.";
  } else if (/Firebase session|Missing Firebase/i.test(rawMessage)) {
    reason = "phiên đăng nhập đã hết hạn hoặc chưa sẵn sàng. Hãy đăng nhập lại rồi thử upload.";
  } else if (/invalid Google Drive upload session|Missing upload Content-Range/i.test(rawMessage)) {
    reason = "phiên upload lên Google Drive không hợp lệ hoặc bị gián đoạn.";
  } else if (/chunk is too large/i.test(rawMessage)) {
    reason = "một phần dữ liệu upload vượt giới hạn cho phép.";
  }

  return `Không thể ${phase || "upload"}${fileName}. ${statusText ? `${statusText}. ` : ""}Lý do: ${reason}`;
}
