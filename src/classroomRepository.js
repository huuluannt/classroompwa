import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, hasFirebaseConfig, storage } from "./firebase";
import { ADMINS, seedClasses } from "./data";

const LS_KEY = "classroompwa-state";

export function isAdminEmail(email) {
  return ADMINS.includes(email || "");
}

export function loadLocalClasses() {
  const saved = localStorage.getItem(LS_KEY);
  return saved ? JSON.parse(saved) : seedClasses;
}

export function saveLocalClasses(classes) {
  localStorage.setItem(LS_KEY, JSON.stringify(classes));
}

export function subscribeClasses(user, onClasses, onError) {
  if (!hasFirebaseConfig || !user) {
    onClasses(loadLocalClasses());
    return () => {};
  }

  if (isAdminEmail(user.email)) {
    return onSnapshot(
      collection(db, "classes"),
      async (snapshot) => {
        const courses = await Promise.all(snapshot.docs.map((courseDoc) => hydrateCourse(courseDoc.id, courseDoc.data(), true)));
        onClasses(courses);
      },
      onError
    );
  }

  const membershipQuery = query(collectionGroup(db, "members"), where("email", "==", user.email));
  return onSnapshot(
    membershipQuery,
    async (snapshot) => {
      const courses = await Promise.all(
        snapshot.docs.map(async (memberDoc) => {
          const member = memberDoc.data();
          const classId = member.classId || memberDoc.ref.parent.parent.id;
          if (member.status === "accepted") {
            const courseDoc = await getDoc(doc(db, "classes", classId));
            if (courseDoc.exists()) return hydrateCourse(classId, courseDoc.data(), false);
          }
          const summary = await getDoc(doc(db, "classSummaries", classId));
          return pendingCourseFromMember(classId, summary.exists() ? summary.data() : member, member);
        })
      );
      onClasses(courses.filter(Boolean));
    },
    onError
  );
}

export async function saveCourseToCloud(course) {
  if (!hasFirebaseConfig) return;
  const courseRef = doc(db, "classes", course.id);
  const { members, ...courseData } = course;
  await setDoc(courseRef, normalizeCourseForFirestore(courseData), { merge: true });
  await setDoc(doc(db, "classSummaries", course.id), {
    id: course.id,
    name: course.name,
    description: course.description,
    code: course.code,
    pinned: Boolean(course.pinned),
    updatedAt: serverTimestamp()
  });
  await setDoc(doc(db, "classCodes", course.code.toUpperCase()), {
    classId: course.id,
    name: course.name,
    description: course.description,
    code: course.code.toUpperCase(),
    updatedAt: serverTimestamp()
  });

  await Promise.all((members || []).map((member) => upsertMember(course, member)));
}

export async function deleteCourseFromCloud(course) {
  if (!hasFirebaseConfig) return;
  await deleteDoc(doc(db, "classes", course.id));
  await deleteDoc(doc(db, "classSummaries", course.id));
  await deleteDoc(doc(db, "classCodes", course.code.toUpperCase()));
}

export async function upsertMember(course, member) {
  if (!hasFirebaseConfig) return;
  await setDoc(doc(db, "classes", course.id, "members", member.email), {
    ...member,
    classId: course.id,
    className: course.name,
    classDescription: course.description,
    classCode: course.code,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function deleteMemberFromCloud(courseId, email) {
  if (!hasFirebaseConfig) return;
  await deleteDoc(doc(db, "classes", courseId, "members", email));
}

export async function joinClassByCode(user, form) {
  if (!hasFirebaseConfig) return null;
  const code = form.code.toUpperCase();
  const codeDoc = await getDoc(doc(db, "classCodes", code));
  if (!codeDoc.exists()) throw new Error("Mã lớp không đúng.");
  const summary = codeDoc.data();
  const memberRef = doc(db, "classes", summary.classId, "members", user.email);
  const existing = await getDoc(memberRef);
  if (existing.exists()) throw new Error("Email này đã gửi yêu cầu hoặc đã tham gia lớp.");
  const member = {
    order: 9999,
    name: form.name,
    email: user.email,
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

export async function uploadClassFile(courseId, folder, file) {
  if (!hasFirebaseConfig || !file) return { fileName: file?.name || "", url: "" };
  const fileRef = ref(storage, `classes/${courseId}/${folder}/${Date.now()}-${file.name}`);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { fileName: file.name, url };
}

async function hydrateCourse(id, data, includeAllMembers) {
  const membersSnapshot = await getDocs(collection(db, "classes", id, "members"));
  const members = membersSnapshot.docs
    .map((item) => item.data())
    .filter((member) => includeAllMembers || member.status === "accepted")
    .sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999));
  return { ...withCourseDefaults({ id, ...data }), members };
}

function pendingCourseFromMember(classId, summary, member) {
  return withCourseDefaults({
    id: classId,
    name: summary.name || member.className,
    description: summary.description || member.classDescription,
    code: summary.code || member.classCode,
    pendingOnly: true,
    members: [member]
  });
}

function normalizeCourseForFirestore(course) {
  return {
    ...course,
    id: course.id,
    name: course.name || "",
    description: course.description || "",
    code: (course.code || "").toUpperCase(),
    pinned: Boolean(course.pinned),
    updatedAt: serverTimestamp()
  };
}

function withCourseDefaults(course) {
  return {
    pinned: false,
    info: { title: course.name || "", size: 0, time: "", room: "", description: course.description || "" },
    announcements: [],
    groupTopics: [],
    personalTopics: [],
    materials: [],
    assignments: [],
    gradebooks: [],
    peerReviews: [],
    extraCards: [],
    members: [],
    ...course
  };
}
