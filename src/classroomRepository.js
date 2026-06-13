import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { db, getCurrentIdToken, hasFirebaseConfig } from "./firebase";
import { DEFAULT_LECTURERS, SUPREME_EMAIL, SUPREME_PROFILE, seedClasses } from "./data";
import { uploadDriveFile } from "./driveStorage";

const LS_KEY = "classroompwa-state";
const PIN_LS_PREFIX = "classroompwa-class-pins:";
const ARCHIVE_LS_PREFIX = "classroompwa-class-archives:";
const EXAM_FORM_TEMPLATES_LS_KEY = "classroompwa-exam-form-templates";
const CLASS_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CLASS_CODE_LENGTH = 5;
const DATE_TIME_24_OPTIONS = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hourCycle: "h23"
};

function formatDateTime24(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", DATE_TIME_24_OPTIONS);
}

export function isAdminEmail(email) {
  return isSupremeEmail(email);
}

export function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

export function isSupremeEmail(email) {
  return normalizeEmail(email) === SUPREME_EMAIL;
}

export function loadLocalClasses() {
  const saved = localStorage.getItem(LS_KEY);
  return (saved ? JSON.parse(saved) : seedClasses).map(withCourseDefaults);
}

export function saveLocalClasses(classes) {
  localStorage.setItem(LS_KEY, JSON.stringify(classes));
}

export function loadLocalExamFormTemplates() {
  try {
    const saved = localStorage.getItem(EXAM_FORM_TEMPLATES_LS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveLocalExamFormTemplates(templates) {
  localStorage.setItem(EXAM_FORM_TEMPLATES_LS_KEY, JSON.stringify(templates || {}));
}

export function loadLocalClassPins(email) {
  if (!email) return [];
  try {
    const saved = localStorage.getItem(`${PIN_LS_PREFIX}${normalizeEmail(email)}`);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveLocalClassPins(email, classIds) {
  if (!email) return;
  localStorage.setItem(`${PIN_LS_PREFIX}${normalizeEmail(email)}`, JSON.stringify([...new Set(classIds.filter(Boolean))]));
}

export function loadLocalClassArchives(email) {
  if (!email) return [];
  try {
    const saved = localStorage.getItem(`${ARCHIVE_LS_PREFIX}${normalizeEmail(email)}`);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveLocalClassArchives(email, classIds) {
  if (!email) return;
  localStorage.setItem(`${ARCHIVE_LS_PREFIX}${normalizeEmail(email)}`, JSON.stringify([...new Set(classIds.filter(Boolean))]));
}

function randomClassCodeIndex(max) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function generateClassCode() {
  return Array.from({ length: CLASS_CODE_LENGTH }, () => CLASS_CODE_ALPHABET[randomClassCodeIndex(CLASS_CODE_ALPHABET.length)]).join("");
}

export async function reserveUniqueClassCode(classId, existingCodes = []) {
  const localCodes = new Set(existingCodes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = generateClassCode();
    if (localCodes.has(code)) continue;
    if (!hasFirebaseConfig) return code;

    const codeRef = doc(db, "classCodes", code);
    const reservedCode = await runTransaction(db, async (transaction) => {
      const codeSnapshot = await transaction.get(codeRef);
      if (codeSnapshot.exists()) {
        return codeSnapshot.data()?.classId === classId ? code : null;
      }
      transaction.set(codeRef, {
        classId,
        code,
        reservedAt: serverTimestamp()
      });
      return code;
    });
    if (reservedCode) return reservedCode;
  }

  throw new Error("Không thể tạo mã lớp duy nhất. Vui lòng thử lại.");
}

export function subscribePrivateClassPins(user, onPins, onError) {
  if (!user?.email) {
    onPins([]);
    return () => {};
  }
  const fallback = loadLocalClassPins(user.email);
  onPins(fallback);
  if (!hasFirebaseConfig) return () => {};

  return onSnapshot(doc(db, "profiles", user.email), (snapshot) => {
    const pinnedClassIds = snapshot.exists() && Array.isArray(snapshot.data().pinnedClassIds)
      ? snapshot.data().pinnedClassIds.filter(Boolean)
      : [];
    saveLocalClassPins(user.email, pinnedClassIds);
    onPins(pinnedClassIds);
  }, onError);
}

export async function savePrivateClassPins(user, classIds) {
  if (!user?.email) return;
  const pinnedClassIds = [...new Set(classIds.filter(Boolean))];
  saveLocalClassPins(user.email, pinnedClassIds);
  if (!hasFirebaseConfig) return;
  await setDoc(doc(db, "profiles", user.email), {
    email: user.email,
    pinnedClassIds,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function subscribePrivateClassArchives(user, onArchives, onError) {
  if (!user?.email) {
    onArchives([]);
    return () => {};
  }
  const fallback = loadLocalClassArchives(user.email);
  onArchives(fallback);
  if (!hasFirebaseConfig) return () => {};

  return onSnapshot(doc(db, "profiles", user.email), (snapshot) => {
    const archivedClassIds = snapshot.exists() && Array.isArray(snapshot.data().archivedClassIds)
      ? snapshot.data().archivedClassIds.filter(Boolean)
      : [];
    saveLocalClassArchives(user.email, archivedClassIds);
    onArchives(archivedClassIds);
  }, onError);
}

export async function savePrivateClassArchives(user, classIds) {
  if (!user?.email) return;
  const archivedClassIds = [...new Set(classIds.filter(Boolean))];
  saveLocalClassArchives(user.email, archivedClassIds);
  if (!hasFirebaseConfig) return;
  await setDoc(doc(db, "profiles", user.email), {
    email: user.email,
    archivedClassIds,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function subscribeLecturers(user, onLecturers, onError) {
  const fallback = [...DEFAULT_LECTURERS];
  if (!hasFirebaseConfig || !user) {
    onLecturers(fallback);
    return () => {};
  }

  if (isSupremeEmail(user.email)) {
    return onSnapshot(collection(db, "lecturers"), (snapshot) => {
      onLecturers(mergeSupremeLecturer(snapshotToItems(snapshot)));
    }, onError);
  }

  return onSnapshot(doc(db, "lecturers", normalizeEmail(user.email)), (snapshot) => {
    onLecturers(mergeSupremeLecturer(snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : []));
  }, () => onLecturers(fallback));
}

export async function saveLecturerToCloud(lecturer) {
  const email = normalizeEmail(lecturer.email);
  if (!email) return;
  if (!hasFirebaseConfig) return;
  await setDoc(doc(db, "lecturers", email), {
    email,
    name: lecturer.name || email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function deleteLecturerFromCloud(email) {
  const normalized = normalizeEmail(email);
  if (!hasFirebaseConfig || !normalized || isSupremeEmail(normalized)) return;
  await deleteDoc(doc(db, "lecturers", normalized));
}

export function mergeSupremeLecturer(lecturers = []) {
  const byEmail = new Map(lecturers.map((lecturer) => [normalizeEmail(lecturer.email), lecturer]));
  byEmail.set(SUPREME_EMAIL, { ...SUPREME_PROFILE, ...(byEmail.get(SUPREME_EMAIL) || {}) });
  return [...byEmail.values()].sort((first, second) => String(first.name || first.email).localeCompare(String(second.name || second.email), "vi", { sensitivity: "base" }));
}

export function subscribeClasses(user, accessOrOnClasses, maybeOnClasses, maybeOnError) {
  const access = typeof accessOrOnClasses === "function" ? {} : (accessOrOnClasses || {});
  const onClasses = typeof accessOrOnClasses === "function" ? accessOrOnClasses : maybeOnClasses;
  const onError = typeof accessOrOnClasses === "function" ? maybeOnClasses : maybeOnError;
  if (!hasFirebaseConfig || !user) {
    onClasses(loadLocalClasses().map(withCourseDefaults));
    return () => {};
  }

  const userEmail = normalizeEmail(user.email);
  const hasLecturerAccess = Boolean(access.supreme || access.primaryLecturer);

  if (hasLecturerAccess) {
    let latestClassesSnapshot = null;
    let latestMembershipDocs = [];
    let announcementUnsubscribes = [];
    let memberUnsubscribes = [];
    let peerReviewResponseUnsubscribes = [];
    let reviewerQuestionUnsubscribes = [];
    let activeAnnouncementClasses = "";
    let activeMemberClasses = "";
    let activePeerReviewResponseClasses = "";
    let activeReviewerQuestionClasses = "";
    const announcementCache = new Map();

    function syncAnnouncementSubscriptions(classIds) {
      const key = [...classIds].sort().join("|");
      if (key === activeAnnouncementClasses) return;
      activeAnnouncementClasses = key;
      announcementUnsubscribes.forEach((unsubscribe) => unsubscribe());
      announcementUnsubscribes = classIds.map((classId) => (
        onSnapshot(collection(db, "classes", classId, "announcements"), (snapshot) => {
          announcementCache.set(classId, snapshotToItems(snapshot));
          emitLecturerClasses();
        }, onError)
      ));
    }

    function syncMemberSubscriptions(classIds) {
      const key = [...classIds].sort().join("|");
      if (key === activeMemberClasses) return;
      activeMemberClasses = key;
      memberUnsubscribes.forEach((unsubscribe) => unsubscribe());
      memberUnsubscribes = classIds.map((classId) => (
        onSnapshot(collection(db, "classes", classId, "members"), emitLecturerClasses, onError)
      ));
    }

    function syncPeerReviewResponseSubscriptions(classIds) {
      const key = [...classIds].sort().join("|");
      if (key === activePeerReviewResponseClasses) return;
      activePeerReviewResponseClasses = key;
      peerReviewResponseUnsubscribes.forEach((unsubscribe) => unsubscribe());
      peerReviewResponseUnsubscribes = classIds.map((classId) => (
        onSnapshot(collection(db, "classes", classId, "peerReviewResponses"), emitLecturerClasses, onError)
      ));
    }

    function syncReviewerQuestionSubscriptions(classIds) {
      const key = [...classIds].sort().join("|");
      if (key === activeReviewerQuestionClasses) return;
      activeReviewerQuestionClasses = key;
      reviewerQuestionUnsubscribes.forEach((unsubscribe) => unsubscribe());
      reviewerQuestionUnsubscribes = classIds.map((classId) => (
        onSnapshot(collection(db, "classes", classId, "reviewerQuestions"), emitLecturerClasses, onError)
      ));
    }

    async function emitLecturerClasses() {
      if (!latestClassesSnapshot) return;
      try {
        const classIds = latestClassesSnapshot.docs.map((courseDoc) => courseDoc.id);
        const courseMap = new Map();
        const lecturerCourses = await Promise.all(
          latestClassesSnapshot.docs.map((courseDoc) => hydrateCourse(
            courseDoc.id,
            courseDoc.data(),
            true,
            user,
            announcementCache.get(courseDoc.id)
          ))
        );
        lecturerCourses.forEach((course) => courseMap.set(course.id, course));

        const acceptedMembershipClassIds = [];
        const membershipCourses = await Promise.all(
          latestMembershipDocs.map(async (memberDoc) => {
            const member = memberDoc.data();
            const classId = member.classId || memberDoc.ref.parent.parent.id;
            if (courseMap.has(classId)) return null;
            if (member.status === "accepted") {
              acceptedMembershipClassIds.push(classId);
              const courseDoc = await getDoc(doc(db, "classes", classId));
              if (courseDoc.exists()) return hydrateCourse(classId, courseDoc.data(), false, user, announcementCache.get(classId));
              return null;
            }
            return pendingCourseFromMember(classId, member, member);
          })
        );
        membershipCourses.filter(Boolean).forEach((course) => courseMap.set(course.id, course));

        onClasses([...courseMap.values()]);
        const realtimeClassIds = [...new Set([...classIds, ...acceptedMembershipClassIds])];
        syncAnnouncementSubscriptions(realtimeClassIds);
        syncMemberSubscriptions(classIds);
        syncPeerReviewResponseSubscriptions(classIds);
        syncReviewerQuestionSubscriptions(realtimeClassIds);
      } catch (error) {
        onError(error);
      }
    }

    const unsubscribeClasses = onSnapshot(
      access.supreme
        ? collection(db, "classes")
        : query(collection(db, "classes"), where("lecturerEmails", "array-contains", userEmail)),
      (snapshot) => {
        latestClassesSnapshot = snapshot;
        emitLecturerClasses();
      },
      onError
    );
    const unsubscribeMembership = access.supreme
      ? () => {}
      : onSnapshot(
        query(collectionGroup(db, "members"), where("email", "==", user.email)),
        (snapshot) => {
          latestMembershipDocs = snapshot.docs;
          emitLecturerClasses();
        },
        onError
      );
    const unsubscribeProfiles = onSnapshot(collection(db, "profiles"), emitLecturerClasses, onError);
    const unsubscribeSubmissions = access.supreme
      ? onSnapshot(collectionGroup(db, "submissions"), emitLecturerClasses, onError)
      : () => {};
    return () => {
      unsubscribeClasses();
      unsubscribeMembership();
      unsubscribeProfiles();
      unsubscribeSubmissions();
      announcementUnsubscribes.forEach((unsubscribe) => unsubscribe());
      memberUnsubscribes.forEach((unsubscribe) => unsubscribe());
      peerReviewResponseUnsubscribes.forEach((unsubscribe) => unsubscribe());
      reviewerQuestionUnsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }

  const membershipQuery = query(collectionGroup(db, "members"), where("email", "==", user.email));
  const assistantLecturerQuery = query(collection(db, "classes"), where("lecturerEmails", "array-contains", userEmail));
  let latestMembershipDocs = null;
  let latestAssistantLecturerDocs = null;
  let announcementUnsubscribes = [];
  let memberUnsubscribes = [];
  let peerReviewResponseUnsubscribes = [];
  let reviewerQuestionUnsubscribes = [];
  let activeAnnouncementClasses = "";
  let activeMemberClasses = "";
  let activePeerReviewResponseClasses = "";
  let activeReviewerQuestionClasses = "";
  const announcementCache = new Map();

  function syncAnnouncementSubscriptions(classIds) {
    const key = [...classIds].sort().join("|");
    if (key === activeAnnouncementClasses) return;
    activeAnnouncementClasses = key;
    announcementUnsubscribes.forEach((unsubscribe) => unsubscribe());
    announcementUnsubscribes = classIds.map((classId) => (
      onSnapshot(collection(db, "classes", classId, "announcements"), (snapshot) => {
        announcementCache.set(classId, snapshotToItems(snapshot));
        emitLearnerClasses();
      }, onError)
    ));
  }

  function syncMemberSubscriptions(classIds) {
    const key = [...classIds].sort().join("|");
    if (key === activeMemberClasses) return;
    activeMemberClasses = key;
    memberUnsubscribes.forEach((unsubscribe) => unsubscribe());
    memberUnsubscribes = classIds.map((classId) => (
      onSnapshot(collection(db, "classes", classId, "members"), emitLearnerClasses, () => {})
    ));
  }

  function syncPeerReviewResponseSubscriptions(learnerClassIds, lecturerClassIds = []) {
    const lecturerSet = new Set(lecturerClassIds);
    const subscriptions = [
      ...learnerClassIds.filter((classId) => !lecturerSet.has(classId)).map((classId) => ({ classId, scope: "self" })),
      ...lecturerClassIds.map((classId) => ({ classId, scope: "all" }))
    ];
    const key = subscriptions.map((item) => `${item.scope}:${item.classId}`).sort().join("|");
    if (key === activePeerReviewResponseClasses) return;
    activePeerReviewResponseClasses = key;
    peerReviewResponseUnsubscribes.forEach((unsubscribe) => unsubscribe());
    peerReviewResponseUnsubscribes = subscriptions.map(({ classId, scope }) => (
      onSnapshot(
        scope === "all"
          ? collection(db, "classes", classId, "peerReviewResponses")
          : query(collection(db, "classes", classId, "peerReviewResponses"), where("email", "==", user.email)),
        emitLearnerClasses,
        () => {}
      )
    ));
  }

  function syncReviewerQuestionSubscriptions(classIds) {
    const key = [...classIds].sort().join("|");
    if (key === activeReviewerQuestionClasses) return;
    activeReviewerQuestionClasses = key;
    reviewerQuestionUnsubscribes.forEach((unsubscribe) => unsubscribe());
    reviewerQuestionUnsubscribes = classIds.map((classId) => (
      onSnapshot(collection(db, "classes", classId, "reviewerQuestions"), emitLearnerClasses, () => {})
    ));
  }

  async function emitLearnerClasses() {
    if (!latestMembershipDocs && !latestAssistantLecturerDocs) return;
    try {
      const acceptedClassIds = [];
      const assistantLecturerClassIds = (latestAssistantLecturerDocs || []).map((courseDoc) => courseDoc.id);
      const coursesById = new Map();
      const membershipCourses = await Promise.all(
        (latestMembershipDocs || []).map(async (memberDoc) => {
          const member = memberDoc.data();
          const classId = member.classId || memberDoc.ref.parent.parent.id;
          if (member.status === "accepted") {
            acceptedClassIds.push(classId);
            const courseDoc = await getDoc(doc(db, "classes", classId));
            if (courseDoc.exists()) return hydrateCourse(classId, courseDoc.data(), false, user, announcementCache.get(classId));
          }
          return pendingCourseFromMember(classId, member, member);
        })
      );
      membershipCourses.filter(Boolean).forEach((course) => coursesById.set(course.id, course));

      const assistantLecturerCourses = await Promise.all(
        (latestAssistantLecturerDocs || []).map((courseDoc) => hydrateCourse(
          courseDoc.id,
          courseDoc.data(),
          true,
          user,
          announcementCache.get(courseDoc.id)
        ))
      );
      assistantLecturerCourses.forEach((course) => coursesById.set(course.id, course));

      const realtimeClassIds = [...new Set([...acceptedClassIds, ...assistantLecturerClassIds])];
      onClasses([...coursesById.values()]);
      syncAnnouncementSubscriptions(realtimeClassIds);
      syncMemberSubscriptions(realtimeClassIds);
      syncPeerReviewResponseSubscriptions(acceptedClassIds, assistantLecturerClassIds);
      syncReviewerQuestionSubscriptions(realtimeClassIds);
    } catch (error) {
      onError(error);
    }
  }

  const unsubscribeMembership = onSnapshot(
    membershipQuery,
    (snapshot) => {
      latestMembershipDocs = snapshot.docs;
      emitLearnerClasses();
    },
    onError
  );
  const unsubscribeAssistantLecturerClasses = onSnapshot(
    assistantLecturerQuery,
    (snapshot) => {
      latestAssistantLecturerDocs = snapshot.docs;
      emitLearnerClasses();
    },
    () => {
      latestAssistantLecturerDocs = [];
      emitLearnerClasses();
    }
  );
  const unsubscribeProfiles = onSnapshot(collection(db, "profiles"), emitLearnerClasses, () => {});
  return () => {
    unsubscribeMembership();
    unsubscribeAssistantLecturerClasses();
    unsubscribeProfiles();
    announcementUnsubscribes.forEach((unsubscribe) => unsubscribe());
    memberUnsubscribes.forEach((unsubscribe) => unsubscribe());
    peerReviewResponseUnsubscribes.forEach((unsubscribe) => unsubscribe());
    reviewerQuestionUnsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

function snapshotToItems(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveCourseToCloud(course, options = {}) {
  if (!hasFirebaseConfig) return;
  const { writeSummary = true, writeClassDoc = true, writeMembers = true, classFields = null, memberFields = null } = options;
  const courseRef = doc(db, "classes", course.id);
  const { members, profiles, announcements, exams, ...courseData } = course;
  if (writeClassDoc) {
    await setDoc(courseRef, normalizeCourseForFirestore(courseData, classFields), { merge: true });
  }
  if (writeSummary) {
    const normalizedCourse = withCourseDefaults(course);
    const normalizedCode = String(normalizedCourse.code || "").toUpperCase();
    if (!normalizedCode) {
      throw new Error("Không có mã lớp để lưu.");
    }
    const codeRef = doc(db, "classCodes", normalizedCode);
    const existingCode = await getDoc(codeRef);
    if (existingCode.exists() && existingCode.data()?.classId !== course.id) {
      throw new Error("Mã lớp đã tồn tại. Vui lòng thử tạo lại lớp.");
    }
    await setDoc(doc(db, "classSummaries", course.id), {
      id: course.id,
      name: normalizedCourse.name,
      description: normalizedCourse.description,
      code: normalizedCourse.code,
      pinned: Boolean(normalizedCourse.pinned),
      ownerEmail: normalizedCourse.ownerEmail,
      ownerName: normalizedCourse.ownerName,
      lecturerEmails: normalizedCourse.lecturerEmails,
      updatedAt: serverTimestamp()
    });
    await setDoc(codeRef, {
      classId: course.id,
      name: normalizedCourse.name,
      description: normalizedCourse.description,
      code: normalizedCode,
      ownerEmail: normalizedCourse.ownerEmail,
      ownerName: normalizedCourse.ownerName,
      updatedAt: serverTimestamp()
    });
  }

  if (writeMembers) {
    await Promise.all((members || []).map((member) => upsertMember(course, member, memberFields)));
  }
}

export async function deleteCourseFromCloud(course) {
  if (!hasFirebaseConfig) return;
  await deleteDoc(doc(db, "classes", course.id));
  await deleteDoc(doc(db, "classSummaries", course.id));
  await deleteDoc(doc(db, "classCodes", course.code.toUpperCase()));
}

export async function upsertMember(course, member, memberFields = null) {
  if (!hasFirebaseConfig) return;
  const memberData = Array.isArray(memberFields) && memberFields.length > 0
    ? Object.fromEntries(memberFields.map((field) => [field, member[field] ?? ""]))
    : {
      ...member,
      classId: course.id,
      className: course.name,
      classDescription: course.description,
      classCode: course.code
    };
  await setDoc(doc(db, "classes", course.id, "members", member.email), {
    ...memberData,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function deleteMemberFromCloud(courseId, email) {
  if (!hasFirebaseConfig) return;
  await deleteDoc(doc(db, "classes", courseId, "members", email));
}

export async function joinClassByCode(user, form) {
  if (!hasFirebaseConfig) return null;
  const userEmail = normalizeEmail(user.email);
  const code = form.code.toUpperCase();
  const codeDoc = await getDoc(doc(db, "classCodes", code));
  if (!codeDoc.exists()) throw new Error("Mã lớp không đúng.");
  const summary = codeDoc.data();
  if (normalizeEmail(summary.ownerEmail) === userEmail) {
    throw new Error("Email này đang là giảng viên của lớp này. Không thể tham gia với vai trò người học.");
  }
  try {
    const classSnapshot = await getDoc(doc(db, "classes", summary.classId));
    if (classSnapshot.exists()) {
      const course = classSnapshot.data();
      const lecturerEmails = [
        course.ownerEmail,
        ...(course.lecturerEmails || []),
        ...(course.lecturers || []).map((lecturer) => lecturer.email)
      ].map(normalizeEmail);
      if (lecturerEmails.includes(userEmail)) {
        throw new Error("Email này đang là giảng viên của lớp này. Không thể tham gia với vai trò người học.");
      }
    }
  } catch (error) {
    if (error?.code !== "permission-denied") throw error;
  }
  const memberRef = doc(db, "classes", summary.classId, "members", userEmail);
  const existing = await getDoc(memberRef);
  if (existing.exists()) throw new Error("Email này đã gửi yêu cầu hoặc đã tham gia lớp.");
  const member = {
    order: 9999,
    name: form.name,
    email: userEmail,
    photoURL: user.photoURL || "",
    studentId: form.studentId,
    status: "pending",
    classId: summary.classId,
    className: summary.name,
    classDescription: summary.description,
    classCode: summary.code,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(memberRef, member);
  return pendingCourseFromMember(summary.classId, summary, member);
}

export async function syncUserProfile(user, options = {}) {
  if (!user?.email) return null;
  if (!hasFirebaseConfig) {
    return {
      email: user.email,
      displayName: user.displayName || user.email,
      photoURL: user.photoURL || "",
      studentId: user.studentId || "",
      pinnedClassIds: Array.isArray(user.pinnedClassIds) ? user.pinnedClassIds : loadLocalClassPins(user.email),
      archivedClassIds: Array.isArray(user.archivedClassIds) ? user.archivedClassIds : loadLocalClassArchives(user.email)
    };
  }

  const preserveExisting = options.preserveExisting !== false;
  const profileRef = doc(db, "profiles", user.email);
  const existing = preserveExisting ? await getDoc(profileRef) : null;
  const existingProfile = existing?.exists() ? existing.data() : {};
  const profile = {
    email: user.email,
    displayName: preserveExisting ? (existingProfile.displayName || user.displayName || user.email) : (user.displayName || user.email),
    photoURL: user.photoURL || existingProfile.photoURL || "",
    studentId: preserveExisting ? (existingProfile.studentId || user.studentId || "") : (user.studentId || ""),
    updatedAt: serverTimestamp()
  };
  if (Array.isArray(user.pinnedClassIds)) {
    profile.pinnedClassIds = user.pinnedClassIds;
  } else if (Array.isArray(existingProfile.pinnedClassIds)) {
    profile.pinnedClassIds = existingProfile.pinnedClassIds;
  }
  if (Array.isArray(user.archivedClassIds)) {
    profile.archivedClassIds = user.archivedClassIds;
  } else if (Array.isArray(existingProfile.archivedClassIds)) {
    profile.archivedClassIds = existingProfile.archivedClassIds;
  }
  await setDoc(profileRef, profile, { merge: true });
  return {
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    studentId: profile.studentId,
    pinnedClassIds: profile.pinnedClassIds,
    archivedClassIds: profile.archivedClassIds
  };
}

export function subscribeExamFormTemplates(user, onNext, onError) {
  if (!user?.email) return () => {};
  if (!hasFirebaseConfig) {
    onNext(loadLocalExamFormTemplates());
    return () => {};
  }
  return onSnapshot(doc(db, "appConfig", "examFormTemplates"), (snapshot) => {
    onNext(snapshot.exists() ? snapshot.data()?.templates || {} : {});
  }, onError);
}

export async function saveExamFormTemplateToCloud(questionType, template) {
  const nextTemplate = {
    ...template,
    questionType,
    uploadedAtMillis: template.uploadedAtMillis || Date.now()
  };
  if (!hasFirebaseConfig) {
    const nextTemplates = {
      ...loadLocalExamFormTemplates(),
      [questionType]: nextTemplate
    };
    saveLocalExamFormTemplates(nextTemplates);
    return nextTemplate;
  }
  await setDoc(doc(db, "appConfig", "examFormTemplates"), {
    templates: {
      [questionType]: nextTemplate
    },
    updatedAt: serverTimestamp()
  }, { merge: true });
  return nextTemplate;
}

export async function uploadClassFile(courseOrId, folder, file, shareOptions = {}) {
  if (!file) return { fileName: "", url: "" };
  if (!hasFirebaseConfig) return readFileAsDataUrl(file);
  const courseId = typeof courseOrId === "string" ? courseOrId : courseOrId.id;
  return uploadDriveFile(courseId, folder, file, shareOptions);
}

export async function submitAssignmentToCloud(courseId, assignmentId, submission) {
  if (!hasFirebaseConfig) {
    const localSubmissionId = submission.id || crypto.randomUUID();
    return { ...submission, id: localSubmissionId, assignmentId };
  }
  const existingSubmissionId = submission.id || "";
  const submissionRef = existingSubmissionId
    ? doc(db, "classes", courseId, "submissions", existingSubmissionId)
    : doc(collection(db, "classes", courseId, "submissions"));
  const submittedAtMillis = submission.submittedAtMillis || Date.now();
  const savedSubmission = {
    assignmentId,
    email: submission.email,
    name: submission.name || "",
    studentId: submission.studentId || "",
    fileName: submission.fileName || "",
    url: submission.url || "",
    previewUrl: submission.previewUrl || "",
    type: submission.type || "",
    status: submission.status || "submitted",
    submittedAt: submission.submittedAt || formatDateTime24(submittedAtMillis),
    submittedAtMillis,
    late: Boolean(submission.late),
    examId: submission.examId || "",
    examTitle: submission.examTitle || "",
    examQuestionCount: Number(submission.examQuestionCount || 0),
    examDuration: submission.examDuration || "",
    examStartedAtMillis: Number(submission.examStartedAtMillis || 0),
    examSubmittedAtMillis: Number(submission.examSubmittedAtMillis || 0),
    examAnswers: submission.examAnswers || {},
    updatedAt: serverTimestamp()
  };
  if (!existingSubmissionId) savedSubmission.createdAt = serverTimestamp();
  if (existingSubmissionId) await setDoc(submissionRef, savedSubmission, { merge: true });
  else await setDoc(submissionRef, savedSubmission);
  const { createdAt, updatedAt, ...clientSubmission } = savedSubmission;
  return { id: submissionRef.id, ...clientSubmission };
}

export async function submitAssignmentReviewerQuestionToCloud(courseId, assignmentId, question) {
  const createdAtMillis = Number(question.createdAtMillis || Date.now());
  const savedQuestion = {
    assignmentId,
    reviewerType: question.reviewerType || "none",
    targetKey: question.targetKey || "",
    targetLabel: question.targetLabel || "",
    targetTopic: question.targetTopic || "",
    questionScopeKey: question.questionScopeKey || "",
    questionScopeLabel: question.questionScopeLabel || "",
    email: normalizeEmail(question.email || ""),
    name: question.name || "",
    photoURL: question.photoURL || "",
    text: question.text || "",
    answered: Boolean(question.answered),
    createdAt: question.createdAt || formatDateTime24(createdAtMillis),
    createdAtMillis,
    updatedAtMillis: Number(question.updatedAtMillis || createdAtMillis)
  };
  if (!hasFirebaseConfig) {
    return { ...savedQuestion, id: question.id || crypto.randomUUID() };
  }
  const questionRef = question.id
    ? doc(db, "classes", courseId, "reviewerQuestions", question.id)
    : doc(collection(db, "classes", courseId, "reviewerQuestions"));
  await setDoc(questionRef, {
    ...savedQuestion,
    id: questionRef.id,
    createdAtServer: question.createdAtServer || serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { ...savedQuestion, id: questionRef.id };
}

export async function updateAssignmentReviewerQuestionToCloud(courseId, questionId, patch) {
  if (!hasFirebaseConfig || !courseId || !questionId) return;
  await setDoc(doc(db, "classes", courseId, "reviewerQuestions", questionId), {
    ...patch,
    updatedAtMillis: Number(patch.updatedAtMillis || Date.now()),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function saveAnnouncementToCloud(courseId, announcement) {
  if (!hasFirebaseConfig) return { id: crypto.randomUUID(), ...announcement };
  const announcementRef = announcement.id
    ? doc(db, "classes", courseId, "announcements", announcement.id)
    : doc(collection(db, "classes", courseId, "announcements"));
  const savedAnnouncement = {
    ...announcement,
    id: announcementRef.id,
    classId: courseId,
    content: announcement.content || "",
    attachments: announcement.attachments || [],
    pinned: Boolean(announcement.pinned),
    publishAsMaterial: Boolean(announcement.publishAsMaterial),
    createdAt: announcement.createdAt || formatDateTime24(),
    createdAtMillis: announcement.createdAtMillis || announcement.publishAtMillis || Date.now(),
    publishAtMillis: announcement.publishAtMillis || announcement.scheduledAtMillis || announcement.createdAtMillis || Date.now(),
    scheduledAt: announcement.scheduledAt || "",
    scheduledAtMillis: announcement.scheduledAtMillis || 0
  };
  await setDoc(announcementRef, {
    ...savedAnnouncement,
    createdAtServer: announcement.createdAtServer || serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return savedAnnouncement;
}

export async function saveExamToCloud(courseId, exam) {
  if (!hasFirebaseConfig) return exam;
  const examRef = exam.id
    ? doc(db, "classes", courseId, "exams", exam.id)
    : doc(collection(db, "classes", courseId, "exams"));
  const savedExam = {
    ...exam,
    id: examRef.id,
    title: exam.title || "",
    parts: Array.isArray(exam.parts) ? exam.parts : [],
    createdAtMillis: exam.createdAtMillis || Date.now(),
    updatedAtMillis: Date.now()
  };
  await setDoc(examRef, {
    ...savedExam,
    updatedAt: serverTimestamp()
  }, { merge: true });
  await setDoc(doc(db, "classes", courseId), { updatedAt: serverTimestamp() }, { merge: true });
  return savedExam;
}

export async function deleteExamFromCloud(courseId, examId) {
  if (!hasFirebaseConfig || !courseId || !examId) return;
  await deleteDoc(doc(db, "classes", courseId, "exams", examId));
  await setDoc(doc(db, "classes", courseId), { updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteAnnouncementFromCloud(courseId, announcementId) {
  if (!hasFirebaseConfig || !announcementId) return;
  await deleteDoc(doc(db, "classes", courseId, "announcements", announcementId));
}

export async function notifyAnnouncementEmail(courseId, announcementId) {
  if (!hasFirebaseConfig || !courseId || !announcementId) return { skipped: true, reason: "local_mode", sentCount: 0 };
  const token = await getCurrentIdToken();
  if (!token) return { skipped: true, reason: "missing_auth", sentCount: 0 };

  const response = await fetch("/api/notify-announcement", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ classId: courseId, announcementId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Không thể gửi email thông báo.");
  return result;
}

export async function submitPeerReviewResponseToCloud(courseId, reviewId, response) {
  if (!hasFirebaseConfig) return { id: crypto.randomUUID(), reviewId, ...response };
  const responseRef = doc(collection(db, "classes", courseId, "peerReviewResponses"));
  const savedResponse = {
    reviewId,
    email: response.email,
    name: response.name || "",
    studentId: response.studentId || "",
    topic: response.topic || "",
    score: response.score || "",
    submittedAt: response.submittedAt || new Date().toLocaleString("vi-VN"),
    submittedAtMillis: response.submittedAtMillis || Date.now(),
    createdAt: serverTimestamp()
  };
  await setDoc(responseRef, savedResponse);
  return { id: responseRef.id, ...savedResponse };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ fileName: file.name, url: reader.result, previewUrl: reader.result, type: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function hydrateCourse(id, data, includeAllMembers, user, announcementItems) {
  const [membersSnapshot, submissions, peerReviewResponses, reviewerQuestions, cloudAnnouncements, exams] = await Promise.all([
    getDocs(collection(db, "classes", id, "members")),
    loadSubmissions(id, includeAllMembers, user),
    loadPeerReviewResponses(id, includeAllMembers, user),
    loadReviewerQuestions(id),
    announcementItems ? Promise.resolve(announcementItems) : loadAnnouncements(id),
    includeAllMembers ? loadExams(id) : Promise.resolve([])
  ]);
  const rawMembers = membersSnapshot.docs
    .map((item) => item.data())
    .filter((member) => includeAllMembers || member.status === "accepted")
    .sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999));
  const course = withCourseDefaults({ id, ...data });
  const profiles = await loadProfiles([...rawMembers.map((member) => member.email), ...course.lecturerEmails, SUPREME_EMAIL]);
  const members = rawMembers.map((member) => applyProfileToMember(member, profiles[member.email]));
  return {
    ...course,
    members,
    profiles,
    announcements: mergeAnnouncements(course.announcements || [], cloudAnnouncements),
    exams: includeAllMembers ? exams : [],
    assignments: course.assignments.map((assignment) => ({
      ...assignment,
      submissions: mergeSubmissions(
        assignment.submissions || [],
        submissions.filter((submission) => submission.assignmentId === assignment.id)
      ),
      reviewerQuestions: mergeReviewerQuestions(
        assignment.reviewerQuestions || [],
        reviewerQuestions.filter((question) => question.assignmentId === assignment.id)
      )
    })),
    peerReviews: mergePeerReviewResponses(course.peerReviews || [], peerReviewResponses)
  };
}

function applyProfileToMember(member, profile) {
  if (!profile) return member;
  return {
    ...member,
    name: profile.displayName || member.name || member.email,
    photoURL: profile.photoURL || member.photoURL || "",
    studentId: Object.prototype.hasOwnProperty.call(profile, "studentId") ? (profile.studentId || "") : (member.studentId || "")
  };
}

async function loadAnnouncements(classId) {
  const snapshot = await getDocs(collection(db, "classes", classId, "announcements"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function loadExams(classId) {
  const snapshot = await getDocs(collection(db, "classes", classId, "exams"));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((first, second) => Number(first.createdAtMillis || 0) - Number(second.createdAtMillis || 0));
}

async function loadProfiles(emails) {
  const uniqueEmails = [...new Set(emails.filter(Boolean))];
  const profileDocs = await Promise.all(uniqueEmails.map(async (email) => {
    const profileDoc = await getDoc(doc(db, "profiles", email));
    return profileDoc.exists() ? [email, profileDoc.data()] : [email, null];
  }));
  return Object.fromEntries(profileDocs.filter(([, profile]) => profile));
}

async function loadSubmissions(classId, includeAllMembers, user) {
  const submissionsRef = collection(db, "classes", classId, "submissions");
  const submissionsQuery = includeAllMembers
    ? submissionsRef
    : query(submissionsRef, where("email", "==", user.email));
  const snapshot = await getDocs(submissionsQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function loadPeerReviewResponses(classId, includeAllMembers, user) {
  try {
    const responsesRef = collection(db, "classes", classId, "peerReviewResponses");
    const responsesQuery = includeAllMembers
      ? responsesRef
      : query(responsesRef, where("email", "==", user.email));
    const snapshot = await getDocs(responsesQuery);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    if (!includeAllMembers) return [];
    throw error;
  }
}

async function loadReviewerQuestions(classId) {
  try {
    const snapshot = await getDocs(collection(db, "classes", classId, "reviewerQuestions"));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch {
    return [];
  }
}

function mergeSubmissions(primary, secondary) {
  const byKey = new Map();
  [...primary, ...secondary].filter(Boolean).forEach((submission) => {
    byKey.set(submissionMergeKey(submission), submission);
  });
  return cleanSubmissions([...byKey.values()]);
}

function cleanSubmissions(submissions) {
  const submittedExamAttempts = new Set(submissions
    .filter((submission) => submission?.type === "exam" && submission.status === "submitted")
    .map(examAttemptSignature)
    .filter(Boolean));

  return submissions.filter((submission) => {
    if (submission?.type !== "exam" || submission.status !== "started") return true;
    const signature = examAttemptSignature(submission);
    return !signature || !submittedExamAttempts.has(signature);
  });
}

function submissionMergeKey(submission) {
  return submission.id
    || `${normalizeEmail(submission.email)}-${submission.assignmentId || ""}-${submission.status || ""}-${submission.submittedAtMillis || submission.submittedAt || ""}`;
}

function examAttemptSignature(submission) {
  const startedAt = Number(submission?.examStartedAtMillis || submission?.submittedAtMillis || 0);
  const email = normalizeEmail(submission?.email || "");
  if (!email || !startedAt) return "";
  return [
    email,
    submission?.assignmentId || "",
    submission?.examId || "",
    startedAt
  ].join("|");
}

function mergeReviewerQuestions(primary, secondary) {
  const seen = new Set();
  return [...secondary, ...primary]
    .filter((question) => {
      const key = question.id
        || `${question.assignmentId}-${question.targetKey}-${question.questionScopeKey}-${question.email}-${question.createdAtMillis}-${question.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => Number(first.createdAtMillis || 0) - Number(second.createdAtMillis || 0));
}

function mergePeerReviewResponses(peerReviews, cloudResponses) {
  return peerReviews.map((review) => ({
    ...review,
    responses: mergeReviewResponses(
      review.responses || [],
      cloudResponses.filter((response) => response.reviewId === review.id)
    )
  }));
}

function mergeReviewResponses(primary, secondary) {
  const seen = new Set();
  return [...secondary, ...primary]
    .filter((response) => {
      const key = response.id || `${response.reviewId}-${response.email}-${response.topic}-${response.score}-${response.submittedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => Number(second.submittedAtMillis || 0) - Number(first.submittedAtMillis || 0));
}

function mergeAnnouncements(primary, secondary) {
  const seen = new Set();
  return [...secondary, ...primary]
    .filter((announcement) => {
      const key = announcement.id || `${announcement.author}-${announcement.createdAt}-${announcement.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => {
      const pinned = Number(Boolean(second.pinned)) - Number(Boolean(first.pinned));
      if (pinned) return pinned;
      return announcementPublishMillis(second) - announcementPublishMillis(first);
    });
}

function announcementPublishMillis(announcement) {
  return Number(announcement?.publishAtMillis || announcement?.scheduledAtMillis || announcement?.createdAtMillis || 0);
}

function pendingCourseFromMember(classId, summary, member) {
  return withCourseDefaults({
    id: classId,
    name: summary.className || summary.name || member.className,
    description: summary.classDescription || summary.description || member.classDescription,
    code: summary.classCode || summary.code || member.classCode,
    pendingOnly: true,
    members: [member]
  });
}

function normalizeCourseForFirestore(course, classFields = null) {
  const normalizedCourse = withCourseDefaults(course);
  if (Array.isArray(classFields) && classFields.length > 0) {
    return {
      ...Object.fromEntries(classFields.map((field) => [field, normalizedCourse[field]])),
      updatedAt: serverTimestamp()
    };
  }

  return {
    ...normalizedCourse,
    id: normalizedCourse.id,
    name: normalizedCourse.name || "",
    description: normalizedCourse.description || "",
    code: (normalizedCourse.code || "").toUpperCase(),
    pinned: Boolean(normalizedCourse.pinned),
    updatedAt: serverTimestamp()
  };
}

function withCourseDefaults(course) {
  const ownerEmail = normalizeEmail(course.ownerEmail || SUPREME_EMAIL);
  const ownerName = course.ownerName || (ownerEmail === SUPREME_EMAIL ? SUPREME_PROFILE.name : ownerEmail);
  const rawLecturers = Array.isArray(course.lecturers) ? course.lecturers : [];
  const lecturerMap = new Map();
  lecturerMap.set(ownerEmail, { email: ownerEmail, name: ownerName, role: "owner" });
  rawLecturers.forEach((lecturer) => {
    const email = normalizeEmail(lecturer.email);
    if (!email) return;
    lecturerMap.set(email, {
      email,
      name: lecturer.name || (email === ownerEmail ? ownerName : email),
      photoURL: lecturer.photoURL || "",
      role: email === ownerEmail ? "owner" : (lecturer.role || "assistant")
    });
  });
  (course.lecturerEmails || []).forEach((emailValue) => {
    const email = normalizeEmail(emailValue);
    if (!email || lecturerMap.has(email)) return;
    lecturerMap.set(email, { email, name: email, photoURL: "", role: email === ownerEmail ? "owner" : "assistant" });
  });
  const lecturers = [...lecturerMap.values()];

  return {
    pinned: false,
    ownerEmail,
    ownerName,
    lecturers,
    lecturerEmails: lecturers.map((lecturer) => lecturer.email),
    announcementPostPermission: "everyone",
    announcementEmailEnabled: false,
    info: { title: course.name || "", size: 0, time: "", room: "", description: course.description || "", rules: "" },
    scheduleRows: [],
    announcements: [],
    groupTopics: [],
    intergroupTopics: [],
    personalTopics: [],
    materials: [],
    assignments: [],
    gradebooks: [],
    peerReviews: [],
    exams: [],
    examFormTemplates: {},
    extraCards: [],
    hiddenCards: [],
    pinnedCards: [],
    cardOrder: [],
    profiles: {},
    members: [],
    ...course,
    ownerEmail,
    ownerName,
    lecturers,
    lecturerEmails: lecturers.map((lecturer) => lecturer.email)
  };
}
