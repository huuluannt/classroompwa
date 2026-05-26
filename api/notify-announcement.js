const FIRESTORE_ROOT = "https://firestore.googleapis.com/v1/projects";
const FIREBASE_LOOKUP_ROOT = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";
const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const firebaseApiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || process.env.ANNOUNCEMENT_EMAIL_FROM;

    if (!firebaseApiKey || !projectId) {
      return response.status(500).json({ error: "Missing Firebase server environment variables." });
    }

    const token = readBearerToken(request);
    if (!token) return response.status(401).json({ error: "Missing Firebase ID token." });

    const body = await readJsonBody(request);
    const classId = cleanPathId(body.classId);
    const announcementId = cleanPathId(body.announcementId);
    if (!classId || !announcementId) {
      return response.status(400).json({ error: "Missing classId or announcementId." });
    }

    const requester = await verifyFirebaseToken(firebaseApiKey, token);
    const [courseDoc, announcementDoc, memberDocs] = await Promise.all([
      getFirestoreDocument(projectId, `classes/${classId}`, token),
      getFirestoreDocument(projectId, `classes/${classId}/announcements/${announcementId}`, token),
      listFirestoreDocuments(projectId, `classes/${classId}/members`, token)
    ]);

    const course = decodeFirestoreDocument(courseDoc);
    const announcement = decodeFirestoreDocument(announcementDoc);
    if (announcement.author !== requester.email) {
      return response.status(403).json({ error: "Only the announcement author can trigger email notifications." });
    }

    const recipients = uniqueEmails(
      memberDocs
        .map(decodeFirestoreDocument)
        .filter((member) => member.status === "accepted")
        .map((member) => member.email)
        .filter((email) => email && email !== requester.email)
    );

    if (recipients.length === 0) return response.status(200).json({ sentCount: 0, skipped: false });
    if (!resendApiKey || !from) {
      return response.status(200).json({ sentCount: 0, skipped: true, reason: "missing_email_config" });
    }

    const origin = request.headers.origin || `https://${request.headers.host}`;
    const email = buildAnnouncementEmail({
      course,
      announcement,
      origin,
      replyTo: process.env.EMAIL_REPLY_TO || announcement.author
    });
    const sentIds = [];

    for (const recipient of recipients) {
      const resendResponse = await fetch(RESEND_EMAILS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: recipient,
          reply_to: email.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text
        })
      });
      const result = await resendResponse.json().catch(() => ({}));
      if (!resendResponse.ok) {
        return response.status(502).json({ error: "Resend email failed.", details: result });
      }
      if (result.id) sentIds.push(result.id);
    }

    return response.status(200).json({ sentCount: recipients.length, ids: sentIds, skipped: false });
  } catch (error) {
    console.error(error);
    return response.status(error.status || 500).json({ error: error.message || "Could not send announcement emails." });
  }
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
      if (data.length > 10000) {
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
  return { email: result.users[0].email };
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

async function listFirestoreDocuments(projectId, path, idToken) {
  const firestoreResponse = await fetch(`${FIRESTORE_ROOT}/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeDocumentPath(path)}?pageSize=300`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const result = await firestoreResponse.json().catch(() => ({}));
  if (!firestoreResponse.ok) {
    throw Object.assign(new Error(result.error?.message || "Firestore collection read failed."), { status: firestoreResponse.status });
  }
  return result.documents || [];
}

function encodeDocumentPath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

function cleanPathId(value) {
  return String(value || "").trim().replace(/\//g, "");
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

function buildAnnouncementEmail({ course, announcement, origin, replyTo }) {
  const className = course.name || "Lớp học";
  const authorName = announcement.authorName || announcement.author || "Thành viên";
  const content = announcement.content || "";
  const attachments = Array.isArray(announcement.attachments) ? announcement.attachments : [];
  const attachmentHtml = attachments.length
    ? `<p style="margin:18px 0 8px;font-weight:700;color:#172033;">File đính kèm</p><ul>${attachments.map((file) => {
      const href = file.webViewLink || file.url || file.previewUrl || "#";
      return `<li><a href="${escapeAttribute(href)}">${escapeHtml(file.fileName || "file")}</a></li>`;
    }).join("")}</ul>`
    : "";
  const classUrl = `${origin}/`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#172033;max-width:620px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 6px;">${escapeHtml(className)}</h2>
      <p style="margin:0 0 18px;color:#64748b;">Thông báo mới từ ${escapeHtml(authorName)}</p>
      <div style="border:1px solid #dce3ee;border-radius:8px;padding:16px;background:#f8fafc;white-space:pre-wrap;">${escapeHtml(content)}</div>
      ${attachmentHtml}
      <p style="margin-top:20px;"><a href="${escapeAttribute(classUrl)}" style="color:#1d4ed8;font-weight:700;">Mở lớp học</a></p>
    </div>
  `;
  const text = [
    `${className}`,
    `Thông báo mới từ ${authorName}`,
    "",
    content,
    "",
    attachments.length ? `File đính kèm: ${attachments.map((file) => file.fileName || file.url || "file").join(", ")}` : "",
    `Mở lớp học: ${classUrl}`
  ].filter(Boolean).join("\n");

  return {
    subject: `[${className}] Thông báo mới từ ${authorName}`,
    html,
    text,
    replyTo
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function uniqueEmails(emails) {
  return [...new Set(emails.map((email) => String(email || "").trim().toLowerCase()).filter((email) => email.includes("@")))];
}
