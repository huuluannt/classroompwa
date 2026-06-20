import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  Archive,
  ArchiveRestore,
  BellRing,
  BookOpen,
  Bell,
  BellDot,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  GraduationCap,
  Languages,
  LogOut,
  Menu,
  MoreVertical,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  PlayCircle,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  UserRound,
  UserPlus,
  Video,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { SUPREME_EMAIL, SUPREME_PROFILE, baseCards, extraCardLabels } from "./data";
import { hasFirebaseConfig, observeAuth, signInWithGoogle, signOutGoogle } from "./firebase";
import {
  deleteAnnouncementFromCloud,
  deleteCourseFromCloud,
  deleteExamFromCloud,
  deleteLecturerFromCloud,
  deleteMemberActivityFromCloud,
  deleteMemberFromCloud,
  isSupremeEmail,
  joinClassByCode,
  loadLocalExamFormTemplates,
  loadLocalClasses,
  mergeSupremeLecturer,
  normalizeEmail,
  reserveUniqueClassCode,
  savePrivateClassArchives,
  saveCourseToCloud,
  saveLecturerToCloud,
  savePrivateClassPins,
  saveLocalClasses,
  saveAnnouncementToCloud,
  saveExamFormTemplateToCloud,
  saveExamToCloud,
  notifyAnnouncementEmail,
  subscribeLecturers,
  subscribeClasses,
  subscribeExamFormTemplates,
  submitAssignmentReviewerQuestionToCloud,
  subscribePrivateClassArchives,
  subscribePrivateClassPins,
  submitAssignmentToCloud,
  submitPeerReviewResponseToCloud,
  syncUserProfile,
  updateAssignmentReviewerQuestionToCloud,
  uploadClassFile
} from "./classroomRepository";
import "./styles.css";

function isAdmin(user) {
  return isSupremeEmail(user?.email);
}

function isClassLeaderMember(member) {
  return member?.classLeader === true || member?.role === "classLeader";
}

function isVirtualMember(member) {
  const email = String(member?.email || "").toLowerCase();
  return member?.isVirtual === true
    || email.endsWith(`@${VIRTUAL_MEMBER_DOMAIN}`)
    || LEGACY_VIRTUAL_MEMBER_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
}

function virtualMemberSerial(member) {
  const studentIdMatch = String(member?.studentId || "").match(/(\d+)$/);
  if (studentIdMatch) return studentIdMatch[1].padStart(3, "0");
  const emailMatch = String(member?.email || "").match(/(?:-|v)(\d+)@/i);
  if (emailMatch) return emailMatch[1].padStart(3, "0");
  const orderMatch = String(member?.order || "").match(/\d+/);
  return (orderMatch ? orderMatch[0] : "1").padStart(3, "0");
}

function displayMemberEmail(member) {
  if (!isVirtualMember(member)) return member?.email || "";
  return `v${virtualMemberSerial(member)}@${VIRTUAL_MEMBER_DOMAIN}`;
}

function userFromVirtualMember(member, realUser) {
  if (!member) return realUser;
  return {
    displayName: member.name || member.email,
    email: normalizeEmail(member.email),
    photoURL: member.photoURL || "",
    studentId: member.studentId || "",
    isDemo: true,
    isVirtualView: true,
    realUserEmail: realUser?.email || ""
  };
}

function virtualVietnameseName(serial, usedNames = new Set()) {
  const index = Math.max(0, Number(serial || 1) - 1);
  for (let offset = 0; offset < VIRTUAL_VIETNAMESE_NAMES.length; offset += 1) {
    const name = VIRTUAL_VIETNAMESE_NAMES[(index + offset) % VIRTUAL_VIETNAMESE_NAMES.length];
    if (!usedNames.has(name)) return name;
  }
  return `Học viên ảo ${String(serial || 1).padStart(3, "0")}`;
}

function isClassLeaderForCourse(course, user) {
  if (!course || !user?.email) return false;
  return (course.members || []).some((member) => (
    member.email === user.email
    && member.status === "accepted"
    && isClassLeaderMember(member)
  ));
}

const ANNOUNCEMENT_POST_PERMISSIONS = {
  lecturers: "lecturers",
  lecturersLeaders: "lecturers_leaders",
  everyone: "everyone",
  everyoneNoFiles: "everyone_no_files"
};

const ANNOUNCEMENT_POST_PERMISSION_OPTIONS = [
  { value: ANNOUNCEMENT_POST_PERMISSIONS.lecturers, label: "Giảng viên", labelEn: "Lecturers" },
  { value: ANNOUNCEMENT_POST_PERMISSIONS.lecturersLeaders, label: "Giảng viên + Lớp trưởng", labelEn: "Lecturers + Class leaders" },
  { value: ANNOUNCEMENT_POST_PERMISSIONS.everyone, label: "Tất cả mọi người", labelEn: "Everyone" },
  { value: ANNOUNCEMENT_POST_PERMISSIONS.everyoneNoFiles, label: "Tất cả mọi người (No Files)", labelEn: "Everyone (No Files)" }
];

const UI_LANGUAGES = {
  vi: "VIE",
  en: "ENG"
};
const LANGUAGE_STORAGE_PREFIX = "classroompwa-language:";
const UI_TEXT = {
  vi: {
    profile: "Profile",
    manageLecturers: "Manage Lecturers",
    signOut: "Sign out",
    language: "Ngôn ngữ",
    searchClass: "Tìm lớp học",
    addClass: "Thêm lớp học mới",
    joinClass: "Tham gia lớp học",
    classList: "Danh sách lớp học",
    archived: "Archived",
    mainClass: "Mainclass",
    noArchivedClasses: "Chưa có lớp Archived.",
    noMainClasses: "Chưa có lớp trong Mainclass.",
    noMoreCards: "Không còn card để thêm",
    newNotifications: "Thông báo mới",
    recentPosts: "bài đăng gần nhất",
    noPosts: "Chưa có bài đăng",
    noNewNotifications: "Chưa có thông báo mới.",
    newBadge: "Mới",
    announcementContentPlaceholder: "Nhập nội dung đăng tin...",
    publishAsMaterial: "Tài liệu",
    schedulePost: "Hẹn giờ",
    schedulePostAria: "Hẹn giờ đăng",
    postAnnouncement: "Đăng tin",
    postingAnnouncement: "Đang đăng",
    postPermission: "Quyền đăng tin",
    noVisibleClass: "Chưa có lớp học hiển thị",
    pendingClassHint: "Người học cần nhập mã lớp và chờ admin accept trước khi xem nội dung.",
    joinRequestSent: "Yêu cầu tham gia lớp đã được gửi. Bạn sẽ xem được nội dung sau khi admin accept.",
    statusPendingAccept: "Trạng thái: Chờ accept",
    newNotification: "Có thông báo mới",
    notifications: "Thông báo",
    onlySupremeClasses: "Chỉ hiện lớp của Đấng tối cao",
    showAllClasses: "Hiện tất cả lớp",
    backToClassList: "Quay lại danh sách lớp",
    backToCardList: "Quay lại danh sách thẻ",
    backToTeacherView: "Quay lại góc nhìn giảng viên",
    viewAsVirtualStudent: "Xem lớp như học viên ảo",
    noVirtualStudent: "Chưa có học viên ảo trong lớp",
    virtualStudent: "học viên ảo",
    viewAs: "View as",
    openGoogleMeet: "Mở Google Meet",
    classCode: "Mã lớp",
    cardMenu: "menu",
    pin: "Pin",
    unpin: "Unpin",
    delete: "Delete",
    edit: "Edit",
    unarchive: "UnArchived",
    cardLabels: {
      announcements: "Thông báo",
      members: "Thành viên",
      info: "Thông tin lớp học",
      schedule: "Lịch học (TKB)",
      groupTopic: "Topic Nhóm",
      materials: "Tài liệu",
      assignments: "Bài tập",
      grades: "Bảng điểm",
      exams: "Đề thi (only Lecturer)",
      intergroupTopic: "Topic Liên nhóm",
      personalTopic: "Topic Cá nhân",
      dutySchedules: "Lịch trực"
    },
    literal: {}
  },
  en: {
    profile: "Profile",
    manageLecturers: "Manage Lecturers",
    signOut: "Sign out",
    language: "Language",
    searchClass: "Search classes",
    addClass: "Add new class",
    joinClass: "Join class",
    classList: "Class list",
    archived: "Archived",
    mainClass: "Mainclass",
    noArchivedClasses: "No archived classes.",
    noMainClasses: "No classes in Mainclass.",
    noMoreCards: "No more cards to add",
    newNotifications: "New notifications",
    recentPosts: "recent posts",
    noPosts: "No posts yet",
    noNewNotifications: "No new notifications.",
    newBadge: "New",
    announcementContentPlaceholder: "Write an announcement...",
    publishAsMaterial: "Material",
    schedulePost: "Schedule",
    schedulePostAria: "Schedule announcement",
    postAnnouncement: "Post",
    postingAnnouncement: "Posting",
    postPermission: "Post permission",
    noVisibleClass: "No visible classes",
    pendingClassHint: "Learners need to enter a class code and wait for admin approval before viewing content.",
    joinRequestSent: "Your join request has been sent. You can view the class after admin approval.",
    statusPendingAccept: "Status: Pending approval",
    newNotification: "New notifications",
    notifications: "Notifications",
    onlySupremeClasses: "Only show Supreme's classes",
    showAllClasses: "Show all classes",
    backToClassList: "Back to class list",
    backToCardList: "Back to card list",
    backToTeacherView: "Back to lecturer view",
    viewAsVirtualStudent: "View class as virtual student",
    noVirtualStudent: "No virtual students in this class",
    virtualStudent: "virtual student",
    viewAs: "View as",
    openGoogleMeet: "Open Google Meet",
    classCode: "Class code",
    cardMenu: "menu",
    pin: "Pin",
    unpin: "Unpin",
    delete: "Delete",
    edit: "Edit",
    unarchive: "Unarchive",
    cardLabels: {
      announcements: "Announcements",
      members: "Members",
      info: "Class information",
      schedule: "Schedule",
      groupTopic: "Group Topics",
      materials: "Materials",
      assignments: "Assignments",
      grades: "Grades",
      exams: "Exams (Lecturer only)",
      intergroupTopic: "Intergroup Topics",
      personalTopic: "Personal Topics",
      dutySchedules: "Duty schedules"
    },
    literal: {
      "Thông báo": "Announcements",
      "Thành viên": "Members",
      "Thông tin lớp học": "Class information",
      "Lịch học (TKB)": "Schedule",
      "Topic Nhóm": "Group Topics",
      "Topic Liên nhóm": "Intergroup Topics",
      "Topic Cá nhân": "Personal Topics",
      "Tài liệu": "Materials",
      "Bài tập": "Assignments",
      "Bảng điểm": "Grades",
      "Đề thi": "Exams",
      "Đề thi (only Lecturer)": "Exams (Lecturer only)",
      "Lịch trực": "Duty schedules",
      "Người học chấm điểm": "Learner grading",
      "Profile": "Profile",
      "Manage Lecturers": "Manage Lecturers",
      "Thêm lớp học mới": "Add new class",
      "Chỉnh sửa lớp học": "Edit class",
      "Tham gia lớp học": "Join class",
      "Mã lớp": "Class code",
      "Xác nhận xóa": "Confirm delete",
      "Xóa": "Delete",
      "Hủy": "Cancel",
      "Save": "Save",
      "Gallery": "Gallery"
    },
    membersLecturer: "Lecturer",
    membersLecturerOwner: "Lecturer (owner)",
    studentList: "Student list",
    stt: "No.",
    photo: "Photo",
    fullName: "Full name",
    name: "Name",
    group: "Group",
    studentId: "Student ID",
    email: "Email",
    personal: "Personal",
    classLeader: "Class leader",
    removeClassLeader: "Remove class leader",
    promoteToLecturer: "Lecturer",
    deleteLearner: "Delete learner",
    classSize: "Class size",
    classTime: "Time",
    classroom: "Classroom",
    zaloGroupLink: "Zalo group link",
    googleMeetLink: "Google Meet link",
    description: "Description",
    rules: "Rules",
    photoCount: "photos",
    noPhotos: "No photos yet.",
    galleryUploadHint: "Browse, drag and drop, or Ctrl+V to add photos.",
    addPhoto: "Add photo",
    noImagePreview: "Preview unavailable",
    week: "Week",
    date: "Date",
    content: "Content",
    addWeek: "Add week",
    topic: "Topic",
    enterTopicName: "Enter Topic name",
    enterIntergroupTopicName: "Enter Intergroup Topic name",
    noTopic: "No topic yet.",
    intergroup: "Intergroup",
    noIntergroup: "No intergroup",
    noGroup: "No group",
    groupMembersEmpty: "No members in this group.",
    assignmentGuideFiles: "Instruction files",
    assignmentGuideFilesHint: "Browse, drag and drop, or Ctrl+V to add multiple files/images.",
    uploaded: "Uploaded",
    unsaved: "Unsaved",
    dueDate: "Deadline",
    ratio: "Weight",
    noDeadline: "No deadline",
    viewSubmissionResults: "View submissions",
    assignmentName: "Name",
    assignment: "Assignment",
    file: "File",
    noSubmission: "No submissions yet.",
    exam: "Exam",
    selectExam: "Select exam",
    questions: "questions",
    noExamInExamCard: "No exams in the Exams card yet.",
    scoreFormat: "Score format",
    scoreStats: "Reviewer score statistics",
    hideLearnerScores: "Hide learner scores",
    viewLearnerScores: "View learner scores",
    allReviewedScores: "All submitted scores",
    yourReviewedScores: "Your submitted scores",
    scoreGiven: "Score",
    noLearnerScores: "No learner scores yet.",
    noYourScores: "You have not submitted any scores for this assignment.",
    saving: "Saving...",
    late: "Late",
    summaryGradebookTitle: "SUMMARY GRADEBOOK",
    assignmentsLower: "assignments",
    noAssignments: "No assignments yet",
    draft: "Draft",
    published: "Published",
    noPublishedGradebooks: "No published gradebooks yet.",
    noSummaryGradeAssignments: "No assignments to calculate the summary gradebook.",
    noEligibleLearners: "No eligible learners.",
    noEligibleGroups: "No eligible groups.",
    noEligibleIntergroups: "No eligible intergroups.",
    noScore: "No score yet",
    gradePrefix: "Grade",
    weight: "Weight",
    score: "Score",
    finalScore: "Final Score",
    representative: "Representative",
    correctAnswers: "Correct answers",
    answer: "Answer",
    total: "Total",
    part: "Part",
    question: "Question",
    gradeExam: "Grade",
    noExamSelectedForAssignment: "No exam selected for this assignment.",
    noExamQuestions: "No questions in this exam.",
    noSubmissionAvailable: "No submission yet.",
    duration: "Duration",
    totalQuestions: "Total",
    noQuestionsCreated: "No questions created yet",
    addPart: "Add Part",
    createNewExam: "Create new exam...",
    editExamName: "Edit exam name",
    deleteExam: "Delete exam",
    deletePart: "Delete part",
    deleteQuestion: "Delete question",
    pointsPerQuestion: "pts/question",
    pointsUnit: "pts",
    pointLevelsHint: "Point levels separated by commas",
    enterQuestion: "Enter question...",
    oneLineAnswerInput: "One-line answer input",
    multiLineAnswerInput: "Multi-line answer input",
    answerOption: "Answer"
  }
};

const MOBILE_MEDIA_QUERY = "(max-width: 760px)";
const MOBILE_VIEWS = {
  classes: "classes",
  cards: "cards",
  detail: "detail"
};
const ANNOUNCEMENT_SEEN_PREFIX = "classroompwa-announcement-seen:";
const ConfirmContext = React.createContext((options, onConfirm) => onConfirm?.());
const LanguageContext = React.createContext("vi");
const LECTURER_ONLY_CARD_IDS = new Set(["exams"]);
const MAX_INLINE_EXAM_TEMPLATE_BYTES = 850 * 1024;
const MAX_VIRTUAL_MEMBERS = 100;
const VIRTUAL_MEMBER_DOMAIN = "ao.local";
const LEGACY_VIRTUAL_MEMBER_DOMAINS = ["classroom.local"];
const VIRTUAL_VIETNAMESE_NAMES = [
  "Nguyễn An Nhiên",
  "Trần Gia Hân",
  "Lê Minh Khang",
  "Phạm Thanh Trúc",
  "Hoàng Bảo Ngọc",
  "Huỳnh Quốc Anh",
  "Phan Khánh Linh",
  "Vũ Nhật Minh",
  "Võ Phương Thảo",
  "Đặng Tuấn Kiệt",
  "Bùi Hải Đăng",
  "Đỗ Ngọc Mai",
  "Hồ Anh Thư",
  "Ngô Đức Huy",
  "Dương Kim Ngân",
  "Lý Hoài Nam",
  "Mai Thùy Dương",
  "Đinh Gia Bảo",
  "Tạ Minh Châu",
  "Trịnh Yến Nhi",
  "Nguyễn Quang Huy",
  "Trần Mỹ Linh",
  "Lê Hoàng Long",
  "Phạm Ngọc Hân",
  "Hoàng Minh Quân",
  "Huỳnh Bảo Châu",
  "Phan Gia Khánh",
  "Vũ Thanh Tâm",
  "Võ Nhật Linh",
  "Đặng Phúc An",
  "Bùi Anh Khoa",
  "Đỗ Khánh Vy",
  "Hồ Minh Tuệ",
  "Ngô Gia Huy",
  "Dương Thanh Hà",
  "Lý Nhật Anh",
  "Mai Quỳnh Như",
  "Đinh Bảo Long",
  "Tạ Thảo Vy",
  "Trịnh Minh Đức",
  "Nguyễn Hải Yến",
  "Trần Đức Anh",
  "Lê Thu Trang",
  "Phạm Quang Minh",
  "Hoàng Gia Linh",
  "Huỳnh Như Ý",
  "Phan Tuấn Anh",
  "Vũ Bảo Trâm",
  "Võ Minh Nhật",
  "Đặng Thanh Bình",
  "Bùi Gia Phúc",
  "Đỗ Hoài Anh",
  "Hồ Khánh Ngân",
  "Ngô Nhật Nam",
  "Dương Minh Tâm",
  "Lý Bảo Anh",
  "Mai Phương Nhi",
  "Đinh Quốc Bảo",
  "Tạ Gia Minh",
  "Trịnh Ngọc Lan",
  "Nguyễn Thảo Nguyên",
  "Trần Quang Vinh",
  "Lê Kim Chi",
  "Phạm Hải Nam",
  "Hoàng Bảo Anh",
  "Huỳnh Gia Tuệ",
  "Phan Minh Triết",
  "Vũ Ngọc Diệp",
  "Võ Khánh An",
  "Đặng Nhật Hạ",
  "Bùi Thanh Sơn",
  "Đỗ Minh Hoàng",
  "Hồ Gia Nghi",
  "Ngô Bảo Vy",
  "Dương Tuấn Minh",
  "Lý Khánh Hòa",
  "Mai Nhật Quỳnh",
  "Đinh Anh Duy",
  "Tạ Phương Linh",
  "Trịnh Hải Hà",
  "Nguyễn Minh Thư",
  "Trần Bảo Khanh",
  "Lê Gia Hưng",
  "Phạm Ngọc Bích",
  "Hoàng Quang Khải",
  "Huỳnh Thanh Tú",
  "Phan Nhật Vy",
  "Vũ Minh Kiên",
  "Võ Hoài Thương",
  "Đặng Gia An",
  "Bùi Quốc Huy",
  "Đỗ Thùy Linh",
  "Hồ Nhật Phúc",
  "Ngô Minh Anh",
  "Dương Bảo Hân",
  "Lý Quang Anh",
  "Mai Gia Hân",
  "Đinh Minh Khoa",
  "Tạ Ngọc Trâm",
  "Trịnh Bảo Minh"
];

function useConfirmAction() {
  return React.useContext(ConfirmContext);
}

function useUiLanguage() {
  return React.useContext(LanguageContext);
}

function notificationSeenKey(email) {
  return `${ANNOUNCEMENT_SEEN_PREFIX}${normalizeEmail(email)}`;
}

function loadAnnouncementSeenAt(email) {
  if (!email) return null;
  try {
    const saved = localStorage.getItem(notificationSeenKey(email));
    if (saved === null) return null;
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveAnnouncementSeenAt(email, timestamp) {
  if (!email) return;
  try {
    localStorage.setItem(notificationSeenKey(email), String(timestamp || 0));
  } catch {
    // Local notification state is best-effort.
  }
}

function normalizeLanguage(value) {
  return value === "en" ? "en" : "vi";
}

function languageStorageKey(email) {
  return `${LANGUAGE_STORAGE_PREFIX}${normalizeEmail(email || "default")}`;
}

function loadPreferredLanguage(email) {
  try {
    return normalizeLanguage(localStorage.getItem(languageStorageKey(email)));
  } catch {
    return "vi";
  }
}

function savePreferredLanguage(email, language) {
  try {
    localStorage.setItem(languageStorageKey(email), normalizeLanguage(language));
  } catch {
    // Language preference is best-effort when storage is unavailable.
  }
}

function uiText(language, key, fallback = "") {
  return UI_TEXT[normalizeLanguage(language)]?.[key] || UI_TEXT.vi[key] || fallback || key;
}

function uiCardLabel(language, cardId, fallback = "") {
  const normalizedLanguage = normalizeLanguage(language);
  return UI_TEXT[normalizedLanguage]?.cardLabels?.[cardId]
    || UI_TEXT.vi.cardLabels?.[cardId]
    || fallback
    || cardId;
}

function uiLiteral(language, value) {
  if (typeof value !== "string") return value;
  return UI_TEXT[normalizeLanguage(language)]?.literal?.[value] || value;
}

function uiGroupLabel(language, rawGroup) {
  const value = String(rawGroup ?? "").trim();
  if (!value) return uiText(language, "noGroup", "Chưa có nhóm");
  return `${uiText(language, "group", "Nhóm")} ${value}`;
}

function uiIntergroupLabel(language, rawIntergroup) {
  const value = String(rawIntergroup ?? "").trim();
  if (!value) return uiText(language, "noIntergroup", "Chưa có liên nhóm");
  return `${uiText(language, "intergroup", "Liên nhóm")} ${value}`;
}

function getAnnouncementPostPermission(course) {
  return ANNOUNCEMENT_POST_PERMISSION_OPTIONS.some((option) => option.value === course?.announcementPostPermission)
    ? course.announcementPostPermission
    : ANNOUNCEMENT_POST_PERMISSIONS.everyone;
}

function isAcceptedCourseMember(course, user) {
  if (!course || !user?.email) return false;
  const userEmail = normalizeEmail(user.email);
  return (course.members || []).some((member) => (
    normalizeEmail(member.email) === userEmail
    && member.status === "accepted"
  ));
}

function canPostAnnouncement(course, user, admin, classLeader) {
  if (admin) return true;
  if (user?.isVirtualView) return isAcceptedCourseMember(course, user);
  const permission = getAnnouncementPostPermission(course);
  if (permission === ANNOUNCEMENT_POST_PERMISSIONS.lecturersLeaders) return Boolean(classLeader);
  if (
    permission === ANNOUNCEMENT_POST_PERMISSIONS.everyone
    || permission === ANNOUNCEMENT_POST_PERMISSIONS.everyoneNoFiles
  ) return isAcceptedCourseMember(course, user);
  return false;
}

function lecturerEmailSet(course) {
  const ownerEmail = normalizeEmail(course?.ownerEmail || SUPREME_EMAIL);
  return new Set([ownerEmail, ...(course?.lecturerEmails || []), ...(course?.lecturers || []).map((lecturer) => lecturer.email)].map(normalizeEmail).filter(Boolean));
}

function isPrimaryLecturerEmail(email, lecturers) {
  const normalized = normalizeEmail(email);
  return isSupremeEmail(normalized) || (lecturers || []).some((lecturer) => normalizeEmail(lecturer.email) === normalized);
}

function canManageCourse(user, course) {
  if (!user || !course) return false;
  if (isSupremeEmail(user.email)) return true;
  return lecturerEmailSet(course).has(normalizeEmail(user.email));
}

function canCreateClasses(user, lecturers) {
  return Boolean(user && isPrimaryLecturerEmail(user.email, lecturers));
}

function canDeleteCourse(user, course) {
  if (!user || !course) return false;
  if (isSupremeEmail(user.email)) return true;
  return normalizeEmail(course.ownerEmail || SUPREME_EMAIL) === normalizeEmail(user.email);
}

function ownsCourse(user, course) {
  if (!user || !course) return false;
  return normalizeEmail(course.ownerEmail || SUPREME_EMAIL) === normalizeEmail(user.email);
}

function canManageCourseLecturers(user, course) {
  return canDeleteCourse(user, course);
}

function isSupremeScopedCourse(course, user) {
  if (!course || !user?.email) return false;
  const userEmail = normalizeEmail(user.email);
  return (
    normalizeEmail(course.ownerEmail || SUPREME_EMAIL) === SUPREME_EMAIL
    || lecturerEmailSet(course).has(userEmail)
    || (course.members || []).some((member) => normalizeEmail(member.email) === userEmail)
  );
}

function courseMatchesQuery(course, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [
    course?.name,
    course?.description,
    course?.code,
    course?.info?.title,
    course?.info?.description
  ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
}

function initials(value = "") {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function extractUrls(text = "") {
  return text.match(/https?:\/\/[^\s]+/g) || [];
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ fileName: file.name, url: reader.result, type: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DATE_TIME_24_OPTIONS = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hourCycle: "h23"
};
const NOTIFICATION_AGO_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatDateTime24(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", DATE_TIME_24_OPTIONS);
}

function formatNotificationTime(item, nowMillis = Date.now()) {
  const publishMillis = Number(item?.publishMillis || 0);
  if (!Number.isFinite(publishMillis) || publishMillis <= 0) return item?.createdAt || "";
  const ageMillis = Math.max(0, nowMillis - publishMillis);
  if (ageMillis >= NOTIFICATION_AGO_WINDOW_MS) return item?.createdAt || formatDateTime24(publishMillis);
  if (ageMillis < 60 * 1000) return "now";
  if (ageMillis < 60 * 60 * 1000) return `${Math.max(1, Math.floor(ageMillis / (60 * 1000)))}m ago`;
  return `${Math.max(1, Math.floor(ageMillis / (60 * 60 * 1000)))}h ago`;
}

function adminWriterEmails() {
  return [SUPREME_EMAIL];
}

async function uploadManyFiles(course, folder, files, shareOptions = {}) {
  const uploadedFiles = [];
  for (const file of Array.from(files || [])) {
    try {
      uploadedFiles.push(await uploadClassFile(course, folder, file, shareOptions));
    } catch (error) {
      throw new Error(formatUploadFailureMessage(error, file));
    }
  }
  return uploadedFiles;
}

function formatUploadFailureMessage(error, file) {
  const fileName = file?.name ? ` "${file.name}"` : "";
  const message = String(error?.message || "").trim();
  if (!message) return `Không thể upload file${fileName}. Google Drive không trả về lý do cụ thể.`;
  return message.includes(fileName)
    ? message
    : `Không thể upload file${fileName}. Lý do: ${message}`;
}

function formatActionError(error, fallback) {
  const message = String(error?.message || "").trim();
  if (!message) return fallback;
  if (/^Không thể|^Vui lòng|^HTTP\s/i.test(message)) return message;
  return `${fallback} Lý do: ${message}`;
}

function materialFiles(item) {
  return item.files || [{ fileName: item.fileName, url: item.url }].filter((file) => file.fileName || file.url);
}

function materialFileUrl(file) {
  return file.webViewLink || file.url || file.previewUrl || "";
}

function filePreviewUrl(file) {
  return file?.webViewLink || file?.previewUrl || file?.url || "";
}

function fileDownloadUrl(file) {
  return file?.url || file?.webContentLink || file?.webViewLink || file?.previewUrl || "";
}

function isImageFile(file) {
  return file?.type?.startsWith("image/") || String(file?.previewUrl || file?.url || "").startsWith("data:image");
}

function isImageUploadFile(file) {
  return file?.type?.startsWith("image/");
}

function normalizeGalleryImages(info = {}) {
  return Array.isArray(info.gallery)
    ? info.gallery.filter(Boolean).map((image, index) => ({
      id: image.id || image.driveFileId || `${image.fileName || "gallery"}-${index}`,
      fileName: image.fileName || image.name || `Ảnh ${index + 1}`,
      caption: image.caption || "",
      url: image.url || image.webContentLink || image.previewUrl || "",
      previewUrl: image.previewUrl || image.thumbnailLink || image.url || "",
      webViewLink: image.webViewLink || "",
      webContentLink: image.webContentLink || "",
      driveFileId: image.driveFileId || "",
      type: image.type || image.mimeType || "",
      size: Number(image.size || 0),
      createdAtMillis: Number(image.createdAtMillis || 0)
    }))
    : [];
}

function normalizeClassInfo(info = {}) {
  const sourceInfo = info || {};
  return {
    rules: "",
    zaloGroupUrl: "",
    googleMeetUrl: "",
    ...sourceInfo,
    gallery: normalizeGalleryImages(sourceInfo)
  };
}

function galleryImageSrc(image) {
  return image?.previewUrl || image?.url || image?.webViewLink || "";
}

function galleryImageDownloadUrl(image) {
  return fileDownloadUrl(image) || galleryImageSrc(image);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatFileSize(size) {
  const value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let nextValue = value;
  let unitIndex = 0;
  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }
  const decimals = nextValue >= 10 || unitIndex === 0 ? 0 : 1;
  return `${nextValue.toFixed(decimals)} ${units[unitIndex]}`;
}

function draftFileTypeLabel(file) {
  if (file?.type) return file.type;
  const fileName = String(file?.name || file?.fileName || "");
  const extension = fileName.split(".").pop();
  return extension && extension !== fileName ? extension.toUpperCase() : "file";
}

function useOutsideClick(ref, active, onOutside) {
  useEffect(() => {
    if (!active) return undefined;
    function handlePointerDown(event) {
      if (!ref.current || ref.current.contains(event.target)) return;
      onOutside();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active, onOutside, ref]);
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== "undefined" && window.matchMedia(query).matches
  ));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function focusNextInputOnEnter(event, group) {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  const scope = event.currentTarget.closest("[data-enter-scope]") || event.currentTarget.closest(".detail-panel") || document;
  const inputs = [...scope.querySelectorAll(`[data-enter-group="${group}"]`)]
    .filter((input) => !input.disabled && input.offsetParent !== null);
  const currentIndex = inputs.indexOf(event.currentTarget);
  const nextInput = inputs[currentIndex + 1];
  if (!nextInput) return;
  nextInput.focus();
  nextInput.select?.();
}

function readJoinCodeParam() {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("join") || "").trim().toUpperCase();
}

function clearJoinCodeParam() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("join")) return;
  url.searchParams.delete("join");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function classJoinUrl(code) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.origin);
  url.searchParams.set("join", String(code || "").trim().toUpperCase());
  return url.toString();
}

function appHomeUrl() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

function normalizeExternalUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return ["http:", "https:", "zalo:", "zaloapp:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function openExternalUrl(url) {
  if (typeof window === "undefined" || !url) return;
  const opened = window.open(url, "_blank");
  if (opened) {
    opened.opener = null;
    return;
  }
  window.location.assign(url);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed.");
}

function buildZaloAnnouncementMessage(course, announcement) {
  const className = course?.info?.title || course?.name || "Lớp học";
  const classCode = course?.code ? ` - ${course.code}` : "";
  const author = announcement?.authorName || announcement?.author || "Người đăng";
  const createdAt = announcement?.scheduledAt || announcement?.createdAt || "";
  const content = announcementDisplayContent(announcement).trim();
  const attachmentCount = Array.isArray(announcement?.attachments) ? announcement.attachments.length : 0;
  return [
    `[${className}${classCode}] Có thông báo mới`,
    `Người đăng: ${author}`,
    createdAt ? `Thời gian: ${createdAt}` : null,
    "",
    content || "Vui lòng xem chi tiết trong app.",
    attachmentCount ? `File đính kèm: ${attachmentCount} file` : null,
    appHomeUrl() ? `Mở app: ${appHomeUrl()}` : null
  ].filter((line) => line !== null).join("\n").trim();
}

function ProfileAvatar({ user, label, small = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const className = small ? "avatar avatar-image small" : "avatar avatar-image";
  if (user?.photoURL && !imageFailed) {
    return (
      <img
        className={className}
        src={user.photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <span className={small ? "avatar small" : "avatar"}>{initials(label)}</span>;
}

function UploadStatus({ label }) {
  return (
    <div className="upload-status" role="status" aria-live="polite">
      <span className="upload-spinner" />
      <span>{label}</span>
      <span className="upload-progress"><span /></span>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState(loadLocalClasses);
  const [loading, setLoading] = useState(hasFirebaseConfig);
  const [error, setError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id);
  const [selectedCard, setSelectedCard] = useState("announcements");
  const [virtualViewByClass, setVirtualViewByClass] = useState({});
  const [reviewerOpenRequest, setReviewerOpenRequest] = useState(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [language, setLanguage] = useState(() => loadPreferredLanguage(""));
  const [showJoin, setShowJoin] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState(readJoinCodeParam);
  const [showNewClass, setShowNewClass] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showManageLecturers, setShowManageLecturers] = useState(false);
  const [lecturers, setLecturers] = useState([]);
  const [examFormTemplates, setExamFormTemplates] = useState(loadLocalExamFormTemplates);
  const [sidebarPinnedClassIds, setSidebarPinnedClassIds] = useState([]);
  const [sidebarArchivedClassIds, setSidebarArchivedClassIds] = useState([]);
  const [classListMode, setClassListMode] = useState("main");
  const [supremeShowAllClasses, setSupremeShowAllClasses] = useState(false);
  const [saveToast, setSaveToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [mobileView, setMobileView] = useState(MOBILE_VIEWS.classes);
  const [announcementSeenAt, setAnnouncementSeenAt] = useState(null);
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

  const supreme = isSupremeEmail(user?.email);
  const primaryLecturer = canCreateClasses(user, lecturers);
  const accessibleClasses = useMemo(() => {
    if (!user) return [];
    const matches = classes.filter((item) => courseMatchesQuery(item, query));
    if (supreme) {
      return supremeShowAllClasses
        ? matches
        : matches.filter((item) => isSupremeScopedCourse(item, user));
    }
    if (primaryLecturer) return matches;
    return matches.filter((item) => canManageCourse(user, item) || item.members.some((member) => member.email === user.email));
  }, [classes, primaryLecturer, query, supreme, supremeShowAllClasses, user]);
  const visibleClasses = useMemo(() => {
    const archived = new Set(sidebarArchivedClassIds);
    const modeClasses = accessibleClasses.filter((item) => (
      classListMode === "archived" ? archived.has(item.id) : !archived.has(item.id)
    ));
    return sortPinnedClasses(modeClasses, sidebarPinnedClassIds);
  }, [accessibleClasses, classListMode, sidebarArchivedClassIds, sidebarPinnedClassIds]);
  const notificationClasses = useMemo(() => {
    if (!user) return [];
    if (supreme || primaryLecturer) return classes;
    return classes.filter((item) => canManageCourse(user, item) || item.members.some((member) => member.email === user.email));
  }, [classes, primaryLecturer, supreme, user]);
  const selectedClass = visibleClasses.find((item) => item.id === selectedClassId) || visibleClasses[0];
  const selectedClassAdminReal = canManageCourse(user, selectedClass);
  const selectedClassVirtualEmail = selectedClass ? normalizeEmail(virtualViewByClass[selectedClass.id] || "") : "";
  const selectedClassVirtualMembers = selectedClassAdminReal
    ? (selectedClass?.members || []).filter((member) => member.status === "accepted" && isVirtualMember(member)).sort(compareMemberOrder)
    : [];
  const selectedClassVirtualMember = selectedClassVirtualMembers.find((member) => normalizeEmail(member.email) === selectedClassVirtualEmail) || null;
  const effectiveUser = selectedClassVirtualMember ? userFromVirtualMember(selectedClassVirtualMember, user) : user;
  const viewingAsVirtualStudent = Boolean(selectedClassVirtualMember);
  const membership = selectedClass?.members.find((member) => normalizeEmail(member.email) === normalizeEmail(effectiveUser?.email));
  const selectedClassAdmin = viewingAsVirtualStudent ? false : selectedClassAdminReal;
  const selectedClassCanDelete = viewingAsVirtualStudent ? false : canDeleteCourse(user, selectedClass);
  const selectedClassCanManageLecturers = viewingAsVirtualStudent ? false : canManageCourseLecturers(user, selectedClass);
  const latestAnnouncementTime = useMemo(() => latestAnnouncementTimestamp(notificationClasses), [notificationClasses]);
  const notificationItems = useMemo(() => notificationItemsFromClasses(notificationClasses, announcementSeenAt), [notificationClasses, announcementSeenAt]);
  const hasUnreadAnnouncements = announcementSeenAt !== null && latestAnnouncementTime > announcementSeenAt;

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined;
    return observeAuth((nextUser) => {
      const nextProfile = nextUser ? {
        displayName: nextUser.displayName || nextUser.email,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
        language: loadPreferredLanguage(nextUser.email),
        isDemo: false
      } : null;
      setUser(nextUser ? {
        displayName: nextUser.displayName || nextUser.email,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
        studentId: "",
        language: loadPreferredLanguage(nextUser.email),
        isDemo: false
      } : null);
      if (nextUser?.email) setLanguage(loadPreferredLanguage(nextUser.email));
      if (nextProfile) {
        syncUserProfile(nextProfile)
          .then((profile) => {
            if (!profile) return;
            if (Array.isArray(profile.pinnedClassIds)) setSidebarPinnedClassIds(profile.pinnedClassIds);
            if (Array.isArray(profile.archivedClassIds)) setSidebarArchivedClassIds(profile.archivedClassIds);
            const nextLanguage = normalizeLanguage(profile.language || loadPreferredLanguage(profile.email));
            savePreferredLanguage(profile.email, nextLanguage);
            setLanguage(nextLanguage);
            setUser((current) => (
              current?.email === profile.email
                ? { ...current, displayName: profile.displayName || current.displayName, photoURL: profile.photoURL || current.photoURL, studentId: profile.studentId || "", language: nextLanguage }
                : current
            ));
          })
          .catch(console.error);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    return subscribePrivateClassPins(user, (nextPins) => {
      setSidebarPinnedClassIds(nextPins);
    }, (nextError) => {
      console.error(nextError);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribePrivateClassArchives(user, (nextArchives) => {
      setSidebarArchivedClassIds(nextArchives);
    }, (nextError) => {
      console.error(nextError);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribeLecturers(user, (nextLecturers) => {
      setLecturers(nextLecturers);
    }, (nextError) => {
      console.error(nextError);
      setLecturers(mergeSupremeLecturer([]));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribeExamFormTemplates(user, (nextTemplates) => {
      setExamFormTemplates(nextTemplates || {});
    }, (nextError) => {
      console.error(nextError);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    setError("");
    return subscribeClasses(user, { supreme, primaryLecturer }, (nextClasses) => {
      setClasses(nextClasses);
      setError("");
    }, (nextError) => {
      console.error(nextError);
      setError("Không thể tải dữ liệu lớp học. Vui lòng kiểm tra Firebase rules và kết nối mạng.");
    });
  }, [primaryLecturer, supreme, user]);

  useEffect(() => {
    if (!saveToast) return undefined;
    const timer = window.setTimeout(() => setSaveToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [saveToast]);

  useEffect(() => {
    if (!selectedClass?.id || !selectedClassVirtualEmail) return;
    if (selectedClassVirtualMember) return;
    setVirtualViewByClass((current) => {
      if (!current[selectedClass.id]) return current;
      const next = { ...current };
      delete next[selectedClass.id];
      return next;
    });
  }, [selectedClass?.id, selectedClassVirtualEmail, selectedClassVirtualMember]);

  useEffect(() => {
    if (!user?.email) {
      setAnnouncementSeenAt(null);
      return;
    }
    const saved = loadAnnouncementSeenAt(user.email);
    if (saved !== null) {
      setAnnouncementSeenAt(saved);
      return;
    }
    const baseline = latestAnnouncementTime || Date.now();
    saveAnnouncementSeenAt(user.email, baseline);
    setAnnouncementSeenAt(baseline);
  }, [user?.email]);

  useEffect(() => {
    if (!user || !pendingJoinCode) return;
    setShowJoin(true);
  }, [pendingJoinCode, user]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(true);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return undefined;
    const currentState = window.history.state || {};
    if (!currentState.classroomMobileView) {
      window.history.replaceState({ ...currentState, classroomMobileView: mobileView }, "");
    }
    function handlePopState(event) {
      const nextView = event.state?.classroomMobileView;
      setMobileView(Object.values(MOBILE_VIEWS).includes(nextView) ? nextView : MOBILE_VIEWS.classes);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isMobile, mobileView]);

  useEffect(() => {
    if (isMobile && !selectedClass && mobileView !== MOBILE_VIEWS.classes) {
      setMobileView(MOBILE_VIEWS.classes);
    }
  }, [isMobile, mobileView, selectedClass]);

  function navigateMobileView(view) {
    if (!isMobile) return;
    setMobileView(view);
    const currentState = window.history.state || {};
    if (currentState.classroomMobileView === view) return;
    window.history.pushState({ ...currentState, classroomMobileView: view }, "");
  }

  function stepBackMobileView(fallbackView) {
    if (!isMobile) return;
    if (window.history.state?.classroomMobileView) {
      window.history.back();
      return;
    }
    setMobileView(fallbackView);
  }

  function showSaveToast(message = "Đã lưu thành công.") {
    setSaveToast({ id: Date.now(), message });
  }

  function toggleVirtualStudentView() {
    if (!selectedClassAdminReal || !selectedClass?.id) return;
    if (selectedClassVirtualMember) {
      setVirtualViewByClass((current) => {
        const next = { ...current };
        delete next[selectedClass.id];
        return next;
      });
      showSaveToast("Đã quay lại góc nhìn giảng viên.");
      return;
    }
    const nextMember = selectedClassVirtualMembers[0];
    if (!nextMember) {
      showSaveToast("Chưa có học viên ảo trong lớp. Vào card Thành viên để thêm học viên ảo.");
      return;
    }
    setVirtualViewByClass((current) => ({
      ...current,
      [selectedClass.id]: normalizeEmail(nextMember.email)
    }));
    showSaveToast(`Đang xem như ${nextMember.name || displayMemberEmail(nextMember)}.`);
    setSelectedCard("announcements");
  }

  function requestConfirm(options, onConfirm) {
    const config = typeof options === "string" ? { message: options } : (options || {});
    setConfirmDialog({
      title: config.title || "Xác nhận xóa",
      message: config.message || "Bạn có chắc muốn xóa mục này không?",
      confirmLabel: config.confirmLabel || "Xóa",
      cancelLabel: config.cancelLabel || "Hủy",
      onConfirm
    });
  }

  async function runConfirmedAction() {
    const action = confirmDialog?.onConfirm;
    setConfirmDialog(null);
    try {
      await action?.();
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Không thể thực hiện thao tác xóa.");
    }
  }

  function updateClasses(nextClasses) {
    setClasses(nextClasses);
    if (!hasFirebaseConfig) saveLocalClasses(nextClasses);
  }

  async function updateClass(classId, updater, options = {}) {
    const { sync = true, toast = false, writeSummary = false, writeClassDoc = true, writeMembers = true, classFields = null, memberFields = null, throwOnError = false } = options;
    const nextClasses = classes.map((item) => (item.id === classId ? updater(item) : item));
    const nextCourse = nextClasses.find((item) => item.id === classId);
    updateClasses(nextClasses);
    if (sync && hasFirebaseConfig && nextCourse) {
      try {
        await saveCourseToCloud(nextCourse, { writeSummary, writeClassDoc, writeMembers, classFields, memberFields });
        if (toast) showSaveToast(typeof toast === "string" ? toast : undefined);
      } catch (nextError) {
        setError(nextError.message || "Không thể lưu dữ liệu.");
        if (throwOnError) throw nextError;
      }
    } else if (toast) {
      showSaveToast(typeof toast === "string" ? toast : undefined);
    }
  }

  async function handleLogin(mode = "learner") {
    setLoginError("");
    try {
      const nextUser = mode === "admin"
        ? { displayName: "Huỳnh Hữu Luân", email: "hhluan@hcmus.edu.vn", photoURL: "", isDemo: true }
        : await signInWithGoogle();
      const nextLanguage = loadPreferredLanguage(nextUser.email);
      setLanguage(nextLanguage);
      setUser({
        displayName: nextUser.displayName || nextUser.email,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
        language: nextLanguage,
        isDemo: nextUser.isDemo
      });
    } catch (nextError) {
      console.error(nextError);
      setLoginError(formatLoginError(nextError));
    }
  }

  async function handleLogout() {
    await signOutGoogle();
    setUser(null);
    setSidebarPinnedClassIds([]);
    setSidebarArchivedClassIds([]);
    setClassListMode("main");
    setSupremeShowAllClasses(false);
    setAccountOpen(false);
  }

  async function togglePrivateClassPin(classId) {
    const nextPins = sidebarPinnedClassIds.includes(classId)
      ? sidebarPinnedClassIds.filter((id) => id !== classId)
      : [classId, ...sidebarPinnedClassIds];
    setSidebarPinnedClassIds(nextPins);
    try {
      await savePrivateClassPins(user, nextPins);
    } catch (nextError) {
      setError(nextError.message || "Không thể lưu pin class.");
    }
  }

  async function togglePrivateClassArchive(classId) {
    const isArchived = sidebarArchivedClassIds.includes(classId);
    const nextArchives = isArchived
      ? sidebarArchivedClassIds.filter((id) => id !== classId)
      : [classId, ...sidebarArchivedClassIds];
    setSidebarArchivedClassIds(nextArchives);
    if (selectedClassId === classId) setSelectedClassId("");
    try {
      await savePrivateClassArchives(user, nextArchives);
      showSaveToast(isArchived ? "Đã đưa lớp về Mainclass." : "Đã lưu lớp vào Archived.");
    } catch (nextError) {
      setError(nextError.message || "Không thể cập nhật Archived class.");
    }
  }

  function markNotificationsSeen() {
    if (!user?.email) return;
    const nextSeenAt = Math.max(Date.now(), latestAnnouncementTime || 0);
    saveAnnouncementSeenAt(user.email, nextSeenAt);
    setAnnouncementSeenAt(nextSeenAt);
  }

  function openAssignmentReviewerFromAnnouncement(announcement) {
    if (!announcement?.assignmentId || !announcement?.reviewerQuestionTargetKey) return;
    setReviewerOpenRequest({
      id: crypto.randomUUID(),
      courseId: announcement.classId || selectedClass?.id || "",
      assignmentId: announcement.assignmentId,
      targetKey: announcement.reviewerQuestionTargetKey
    });
    setSelectedCard("assignments");
    navigateMobileView(MOBILE_VIEWS.detail);
  }

  function handleNotificationSelect(item) {
    if (!item?.courseId) return;
    const targetCourse = classes.find((course) => course.id === item.courseId);
    setQuery("");
    setClassListMode(sidebarArchivedClassIds.includes(item.courseId) ? "archived" : "main");
    if (supreme && targetCourse && !supremeShowAllClasses && !isSupremeScopedCourse(targetCourse, user)) {
      setSupremeShowAllClasses(true);
    }
    setSelectedClassId(item.courseId);
    setSelectedCard("announcements");
    markNotificationsSeen();
    navigateMobileView(MOBILE_VIEWS.detail);
  }

  async function handleProfileSave(profile) {
    const nextProfile = {
      email: user.email,
      displayName: profile.displayName.trim() || user.email,
      photoURL: user.photoURL || profile.photoURL || "",
      studentId: profile.studentId.trim(),
      language: normalizeLanguage(user.language || language)
    };
    try {
      const savedProfile = await syncUserProfile(nextProfile, { preserveExisting: false });
      const mergedProfile = savedProfile || nextProfile;
      setUser((current) => current ? { ...current, ...mergedProfile } : current);
      updateClasses(applyProfileToClasses(classes, mergedProfile));
      setShowProfile(false);
      setAccountOpen(false);
      showSaveToast("Đã lưu profile.");
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Không thể lưu profile.");
    }
  }

  async function handleLanguageChange(nextLanguageValue) {
    const nextLanguage = normalizeLanguage(nextLanguageValue);
    setLanguage(nextLanguage);
    if (user?.email) savePreferredLanguage(user.email, nextLanguage);
    setUser((current) => current ? { ...current, language: nextLanguage } : current);
    try {
      if (user?.email) {
        await syncUserProfile({ ...user, language: nextLanguage }, { preserveExisting: false });
      }
      showSaveToast(nextLanguage === "en" ? "Language changed to English." : "Đã chuyển sang tiếng Việt.");
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Không thể lưu ngôn ngữ.");
    }
  }

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={handleLogin} loginError={loginError} />;

  return (
    <ConfirmContext.Provider value={requestConfirm}>
      <LanguageContext.Provider value={language}>
      <main className={`app-shell ${isMobile ? `mobile-flow mobile-view-${mobileView}` : ""}`}>
      <Sidebar
        canCreateClass={primaryLecturer}
        canManageLecturers={supreme}
        classes={visibleClasses}
        pinnedClassIds={sidebarPinnedClassIds}
        archivedClassIds={sidebarArchivedClassIds}
        classListMode={classListMode}
        onClassListModeChange={setClassListMode}
        showSupremeClassScopeToggle={supreme}
        supremeShowAllClasses={supremeShowAllClasses}
        onToggleSupremeClassScope={() => setSupremeShowAllClasses((current) => !current)}
        selectedClassId={selectedClass?.id}
        query={query}
        setQuery={setQuery}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isMobile={isMobile}
        selectClass={(id) => {
          setSelectedClassId(id);
          setSelectedCard("announcements");
          navigateMobileView(MOBILE_VIEWS.cards);
        }}
        onJoin={() => {
          setPendingJoinCode("");
          clearJoinCodeParam();
          setShowJoin(true);
        }}
        onNewClass={() => setShowNewClass(true)}
        onClassAction={(action, classItem) => {
          if (action === "pin") togglePrivateClassPin(classItem.id);
          if (action === "archive") togglePrivateClassArchive(classItem.id);
          if (action === "delete" && canDeleteCourse(user, classItem)) {
            requestConfirm({
              title: "Xóa lớp học?",
              message: `Bạn có chắc muốn xóa lớp "${classItem.name}" không? Toàn bộ dữ liệu trong lớp này sẽ bị xóa.`,
              confirmLabel: "Xóa lớp"
            }, async () => {
              const next = classes.filter((course) => course.id !== classItem.id);
              updateClasses(next);
              await deleteCourseFromCloud(classItem);
              setSelectedClassId(next[0]?.id);
            });
          }
          if (action === "edit" && canManageCourse(user, classItem)) setShowNewClass(classItem);
        }}
        accountOpen={accountOpen}
        setAccountOpen={setAccountOpen}
        notificationUnread={hasUnreadAnnouncements}
        notificationItems={notificationItems}
        onNotificationsSeen={markNotificationsSeen}
        onNotificationSelect={handleNotificationSelect}
        user={user}
        language={language}
        onLanguageChange={handleLanguageChange}
        onProfile={() => {
          setShowProfile(true);
          setAccountOpen(false);
        }}
        onManageLecturers={() => {
          setShowManageLecturers(true);
          setAccountOpen(false);
        }}
        onLogout={handleLogout}
      />
      {(error || saveToast) && (
        <div className="toast-stack">
          {error && (
            <div className="toast toast-error">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")} aria-label="Đóng thông báo lỗi"><X size={16} /></button>
            </div>
          )}
          {saveToast && <div className="toast toast-success">{saveToast.message}</div>}
        </div>
      )}
      {selectedClass ? (
        membership?.status === "pending" && !selectedClassAdmin ? (
          <PendingPane
            course={selectedClass}
            isMobile={isMobile}
            onMobileBackToClasses={() => stepBackMobileView(MOBILE_VIEWS.classes)}
          />
        ) : (
        <ClassPane
          admin={selectedClassAdmin}
          canViewAsVirtualStudent={selectedClassAdminReal}
          viewingAsVirtualStudent={viewingAsVirtualStudent}
          virtualStudentMember={selectedClassVirtualMember}
          virtualStudentCount={selectedClassVirtualMembers.length}
          onToggleVirtualStudentView={toggleVirtualStudentView}
          language={language}
          canDeleteClass={selectedClassCanDelete}
          canManageCourseLecturers={selectedClassCanManageLecturers}
          user={effectiveUser}
          course={selectedClass}
          examFormTemplates={examFormTemplates}
          setExamFormTemplates={setExamFormTemplates}
          selectedCard={selectedCard}
          setSelectedCard={setSelectedCard}
          isMobile={isMobile}
          mobileView={mobileView}
          reviewerOpenRequest={reviewerOpenRequest}
          onMobileBackToClasses={() => stepBackMobileView(MOBILE_VIEWS.classes)}
          onMobileBackToCards={() => stepBackMobileView(MOBILE_VIEWS.cards)}
          onMobileOpenCard={() => navigateMobileView(MOBILE_VIEWS.detail)}
          onOpenAssignmentReviewer={openAssignmentReviewerFromAnnouncement}
          onReviewerOpenConsumed={(requestId) => {
            setReviewerOpenRequest((current) => (
              current?.id === requestId ? null : current
            ));
          }}
          showToast={showSaveToast}
          updateCourse={(updater, options) => updateClass(selectedClass.id, updater, options)}
        />
        )
      ) : (
        <EmptyState
          admin={primaryLecturer}
          onJoin={() => {
            setPendingJoinCode("");
            clearJoinCodeParam();
            setShowJoin(true);
          }}
          onNewClass={() => setShowNewClass(true)}
        />
      )}
      {showJoin && (
        <JoinClassModal
          user={user}
          classes={classes}
          cloudMode={hasFirebaseConfig}
          initialCode={pendingJoinCode}
          onClose={() => {
            setShowJoin(false);
            setPendingJoinCode("");
            clearJoinCodeParam();
          }}
          onJoin={(classId, learner) => {
            if (hasFirebaseConfig) {
              joinClassByCode(user, learner)
                .then((course) => {
                  setSelectedClassId(course.id);
                  setShowJoin(false);
                  setPendingJoinCode("");
                  clearJoinCodeParam();
                  navigateMobileView(MOBILE_VIEWS.cards);
                })
                .catch((nextError) => setError(nextError.message));
            } else {
              updateClass(classId, (course) => ({ ...course, members: [...course.members, learner] }));
              setSelectedClassId(classId);
              setShowJoin(false);
              setPendingJoinCode("");
              clearJoinCodeParam();
              navigateMobileView(MOBILE_VIEWS.cards);
            }
          }}
        />
      )}
      {showNewClass && (
        <NewClassModal
          existing={typeof showNewClass === "object" ? showNewClass : null}
          user={user}
          onClose={() => setShowNewClass(false)}
          onSave={async (course) => {
            const exists = classes.some((item) => item.id === course.id);
            try {
              const code = exists
                ? course.code
                : await reserveUniqueClassCode(course.id, classes.map((item) => item.code));
              const preparedCourse = prepareCourseForSave({ ...course, code }, user);
              const next = exists ? classes.map((item) => (item.id === preparedCourse.id ? preparedCourse : item)) : [preparedCourse, ...classes];
              updateClasses(next);
              if (hasFirebaseConfig) {
                await saveCourseToCloud(preparedCourse);
              }
              showSaveToast(exists ? "Đã lưu lớp." : `Đã tạo lớp. Mã lớp: ${preparedCourse.code}`);
              setSelectedClassId(preparedCourse.id);
              setShowNewClass(false);
            } catch (nextError) {
              setError(nextError.message || "Không thể lưu lớp.");
            }
          }}
        />
      )}
      {showManageLecturers && (
        <ManageLecturersModal
          lecturers={lecturers}
          onClose={() => setShowManageLecturers(false)}
          onSave={async (lecturer) => {
            const normalizedLecturer = { ...lecturer, email: normalizeEmail(lecturer.email), name: lecturer.name || normalizeEmail(lecturer.email) };
            setLecturers((current) => mergeSupremeLecturer([...current.filter((item) => normalizeEmail(item.email) !== normalizedLecturer.email), normalizedLecturer]));
            try {
              await saveLecturerToCloud(normalizedLecturer);
              showSaveToast("Đã lưu giảng viên.");
            } catch (nextError) {
              setError(nextError.message || "Không thể lưu giảng viên.");
            }
          }}
          onDelete={async (email) => {
            const normalized = normalizeEmail(email);
            setLecturers((current) => mergeSupremeLecturer(current.filter((item) => normalizeEmail(item.email) !== normalized)));
            try {
              await deleteLecturerFromCloud(normalized);
              showSaveToast("Đã xóa giảng viên.");
            } catch (nextError) {
              setError(nextError.message || "Không thể xóa giảng viên.");
            }
          }}
        />
      )}
      {showProfile && (
        <ProfileModal
          user={profileFromClasses(user, classes)}
          onClose={() => setShowProfile(false)}
          onSave={handleProfileSave}
        />
      )}
      </main>
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={runConfirmedAction}
        />
      )}
      </LanguageContext.Provider>
    </ConfirmContext.Provider>
  );
}

function sortPinnedClasses(items, pinnedClassIds = []) {
  const pinned = new Set(pinnedClassIds);
  return [...items].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
}

function latestAnnouncementTimestamp(classes) {
  const nowMillis = Date.now();
  return Math.max(0, ...classes.flatMap((course) => (
    (course.announcements || [])
      .filter((announcement) => announcementPublishMillis(announcement) <= nowMillis)
      .map((announcement) => announcementPublishMillis(announcement))
  )));
}

function announcementPreviewText(content = "") {
  return String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" · ")
    .slice(0, 140);
}

function notificationItemsFromClasses(classes, seenAt) {
  const nowMillis = Date.now();
  return classes.flatMap((course) => (
    (course.announcements || [])
      .filter((announcement) => announcementPublishMillis(announcement) <= nowMillis)
      .map((announcement) => {
        const publishMillis = announcementPublishMillis(announcement);
        const authorEmail = announcement.authorEmail || announcement.email || announcement.author || "";
        const authorProfile = authorEmail ? course.profiles?.[authorEmail] : null;
        const authorMember = authorEmail ? (course.members || []).find((member) => member.email === authorEmail) : null;
        const authorName = announcement.authorName || authorProfile?.displayName || authorMember?.name || announcement.author || authorEmail || "Người đăng";
        return {
          id: `${course.id}-${announcement.id || publishMillis}`,
          courseId: course.id,
          courseName: course.name || "Lớp học",
          courseCode: course.code || "",
          content: announcementPreviewText(announcement.content) || "Bài đăng mới",
          authorName,
          createdAt: announcement.createdAt || formatDateTime24(publishMillis),
          publishMillis,
          unread: seenAt !== null && publishMillis > seenAt
        };
      })
  ))
    .sort((first, second) => second.publishMillis - first.publishMillis)
    .slice(0, 12);
}

function profileFromClasses(user, classes) {
  const profile = classes.map((course) => course.profiles?.[user.email]).find(Boolean);
  const member = classes.flatMap((course) => course.members || []).find((item) => item.email === user.email);
  return {
    email: user.email,
    displayName: profile?.displayName || member?.name || user.displayName || user.email,
    photoURL: profile?.photoURL || user.photoURL || member?.photoURL || "",
    studentId: profile?.studentId || member?.studentId || user.studentId || ""
  };
}

function applyProfileToClasses(classes, profile) {
  return classes.map((course) => ({
    ...course,
    profiles: {
      ...(course.profiles || {}),
      [profile.email]: {
        ...(course.profiles?.[profile.email] || {}),
        email: profile.email,
        displayName: profile.displayName,
        photoURL: profile.photoURL || "",
        studentId: profile.studentId || ""
      }
    },
    members: (course.members || []).map((member) => (
      member.email === profile.email
        ? { ...member, name: profile.displayName, photoURL: profile.photoURL || member.photoURL || "", studentId: profile.studentId || "" }
        : member
    ))
  }));
}

function LoadingScreen() {
  return (
    <section className="login-screen">
      <div className="login-card">
        <div className="brand-lockup">
          <span className="logo-mark"><BookOpen size={28} /></span>
          <div>
            <h1>HG Classroom</h1>
            <p>Đang tải phiên đăng nhập</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatLoginError(error) {
  const code = error?.code || "";
  if (code === "auth/unauthorized-domain") {
    return "Dang nhap bi chan vi domain hien tai chua duoc them vao Firebase Auth > Settings > Authorized domains.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Google sign-in chua duoc bat trong Firebase Authentication > Sign-in method.";
  }
  if (code === "auth/popup-blocked") {
    return "Trinh duyet da chan popup dang nhap. Hay cho phep popup cho trang nay roi thu lai.";
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Popup dang nhap da dong truoc khi hoan tat. Hay thu lai va giu popup mo den khi dang nhap xong.";
  }
  if (code === "auth/invalid-api-key" || code.startsWith("auth/api-key-not-valid")) {
    return "Firebase API key khong hop le. Kiem tra lai bien VITE_FIREBASE_API_KEY tren Vercel.";
  }
  if (code) return `Dang nhap khong thanh cong: ${code}`;
  return "Dang nhap khong thanh cong. Kiem tra console hoac cau hinh Firebase.";
}

function LoginScreen({ onLogin, loginError }) {
  return (
    <section className="login-screen">
      <div className="login-card">
        <div className="brand-lockup">
          <span className="logo-mark"><BookOpen size={28} /></span>
          <div>
            <h1>HG Classroom</h1>
            <p>Nội dung lớp học riêng tư</p>
          </div>
        </div>
        <p className="login-copy">Đăng nhập bằng Google để tham gia lớp học, xem thông báo, tài liệu, bài tập và điểm cá nhân.</p>
        <button className="google-button" onClick={() => onLogin("learner")}>
          <span>G</span>
          Đăng nhập bằng Google
        </button>
        {loginError && <p className="login-error" role="alert">{loginError}</p>}
        {!hasFirebaseConfig && (
          <>
            <button className="demo-admin-button" onClick={() => onLogin("admin")}>Demo admin</button>
            <p className="hint">Chưa cấu hình Firebase, các nút này mở chế độ demo local.</p>
          </>
        )}
      </div>
    </section>
  );
}

function NotificationPanel({ items, onSelect, language }) {
  const [nowMillis, setNowMillis] = useState(Date.now());
  const t = (key, fallback = "") => uiText(language, key, fallback);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMillis(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="notification-panel">
      <div className="notification-panel-head">
        <strong>{t("newNotifications")}</strong>
        <small>{items.length ? `${items.length} ${t("recentPosts")}` : t("noPosts")}</small>
      </div>
      <div className="notification-list">
        {items.length === 0 && (
          <div className="notification-empty">{t("noNewNotifications")}</div>
        )}
        {items.map((item) => (
          <button
            className={`notification-item ${item.unread ? "unread" : ""}`}
            type="button"
            key={item.id}
            onClick={() => onSelect?.(item)}
          >
            <span className="notification-class">
              {item.courseName}{item.authorName ? ` > ${item.authorName}` : ""}
            </span>
            {item.courseCode && <span className="notification-code">{item.courseCode}</span>}
            <span className="notification-preview">{item.content}</span>
            <time>{formatNotificationTime(item, nowMillis)}</time>
            {item.unread && <span className="notification-badge">{t("newBadge")}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Sidebar(props) {
  const {
    canCreateClass,
    canManageLecturers,
    classes,
    pinnedClassIds = [],
    archivedClassIds = [],
    classListMode,
    onClassListModeChange,
    showSupremeClassScopeToggle,
    supremeShowAllClasses,
    onToggleSupremeClassScope,
    selectedClassId,
    query,
    setQuery,
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    selectClass,
    onJoin,
    onNewClass,
    onClassAction,
    accountOpen,
    setAccountOpen,
    notificationUnread,
    notificationItems = [],
    onNotificationsSeen,
    onNotificationSelect,
    user,
    language,
    onLanguageChange,
    onProfile,
    onManageLecturers,
    onLogout
  } = props;
  const [notificationOpen, setNotificationOpen] = useState(false);
  const accountRef = useRef(null);
  const notificationRef = useRef(null);
  const t = (key, fallback = "") => uiText(language, key, fallback);
  useOutsideClick(accountRef, accountOpen, () => setAccountOpen(false));
  useOutsideClick(notificationRef, notificationOpen, () => setNotificationOpen(false));

  return (
    <aside className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
      <div className="sidebar-top">
        <button className="icon-button brand-button" onClick={() => !isMobile && setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
          {sidebarOpen ? <ChevronLeft /> : <Menu />}
        </button>
        {sidebarOpen && (
          <div className="brand-text">
            <strong>Classroom</strong>
            <span>{isSupremeEmail(user?.email) ? SUPREME_PROFILE.name : (user.displayName || user.email)}</span>
          </div>
        )}
      </div>
      {sidebarOpen && (
        <>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchClass")} />
          </label>
          {canCreateClass && (
            <button className="primary-action" onClick={onNewClass}>
              <Plus size={16} />
              {t("addClass")}
            </button>
          )}
          <button className="join-action" onClick={onJoin}>
            <UserPlus size={16} />
            {t("joinClass")}
          </button>
          <div className="class-list-header">
            <span>{classListMode === "archived" ? t("archived") : t("classList")}</span>
            <button
              type="button"
              className={classListMode === "archived" ? "active" : ""}
              onClick={() => onClassListModeChange(classListMode === "archived" ? "main" : "archived")}
            >
              {classListMode === "archived" ? t("mainClass") : t("archived")}
            </button>
          </div>
          <nav className="class-list">
            {classes.length === 0 && (
              <div className="class-list-empty-row">
                <div className="class-list-empty">
                  {classListMode === "archived" ? t("noArchivedClasses") : t("noMainClasses")}
                </div>
                {showSupremeClassScopeToggle && (
                  <SupremeClassScopeButton
                    language={language}
                    expanded={supremeShowAllClasses}
                    onToggle={onToggleSupremeClassScope}
                  />
                )}
              </div>
            )}
            {groupClassesForSidebar(classes, canManageLecturers).map((group, groupIndex) => (
              <div className="class-sidebar-group" key={group.key}>
                {group.label && (
                  <div className="class-sidebar-heading-row">
                    <div className="class-sidebar-heading">{group.label}</div>
                    {showSupremeClassScopeToggle && groupIndex === 0 && (
                      <SupremeClassScopeButton
                        language={language}
                        expanded={supremeShowAllClasses}
                        onToggle={onToggleSupremeClassScope}
                      />
                    )}
                  </div>
                )}
                {group.classes.map((course) => (
                  <ClassRow
                    key={course.id}
                    course={course}
                    selected={course.id === selectedClassId}
                    pinned={pinnedClassIds.includes(course.id)}
                    archived={archivedClassIds.includes(course.id)}
                    archivedMode={classListMode === "archived"}
                    owned={ownsCourse(user, course)}
                    canPin
                    canArchive
                    canEdit={canDeleteCourse(user, course)}
                    canDelete={canDeleteCourse(user, course)}
                    onSelect={() => selectClass(course.id)}
                    onAction={onClassAction}
                    language={language}
                  />
                ))}
              </div>
            ))}
          </nav>
          <div className="account-box" ref={accountRef}>
            <div className="account-row">
              <button className="account-trigger" onClick={() => {
                setNotificationOpen(false);
                setAccountOpen(!accountOpen);
              }}>
                <ProfileAvatar user={user} label={user.displayName || user.email} />
                <span>
                  <strong>{user.displayName || user.email}</strong>
                  <small>{user.email}</small>
                </span>
              </button>
              <div className="notification-wrap" ref={notificationRef}>
                <button
                  className={`notification-button ${notificationUnread ? "unread" : ""}`}
                  type="button"
                  title={notificationUnread ? t("newNotification") : t("notifications")}
                  aria-label={notificationUnread ? t("newNotification") : t("notifications")}
                  onClick={() => {
                    const nextOpen = !notificationOpen;
                    setNotificationOpen(nextOpen);
                    setAccountOpen(false);
                    if (nextOpen) onNotificationsSeen?.();
                  }}
                >
                  {notificationUnread ? <BellDot size={19} /> : <Bell size={19} />}
                </button>
                {notificationOpen && (
                  <NotificationPanel
                    items={notificationItems}
                    language={language}
                    onSelect={(item) => {
                      onNotificationSelect?.(item);
                      setNotificationOpen(false);
                    }}
                  />
                )}
              </div>
            </div>
            {accountOpen && (
              <div className="account-menu">
                <div className="account-language-row" role="group" aria-label={t("language")}>
                  <span><Languages size={15} /> {t("language")}</span>
                  <div className="language-toggle">
                    {Object.entries(UI_LANGUAGES).map(([value, label]) => (
                      <button
                        className={normalizeLanguage(language) === value ? "active" : ""}
                        type="button"
                        key={value}
                        onClick={() => onLanguageChange?.(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={onProfile}>
                  <UserRound size={15} />
                  {t("profile")}
                </button>
                {canManageLecturers && (
                  <button onClick={onManageLecturers}>
                    <UserPlus size={15} />
                    {t("manageLecturers")}
                  </button>
                )}
                <button onClick={onLogout}>
                  <LogOut size={15} />
                  {t("signOut")}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {!sidebarOpen && (
        <div className="account-box collapsed-account-box" ref={accountRef}>
          <div className="collapsed-account-row">
            <div className="notification-wrap collapsed-notification-wrap" ref={notificationRef}>
              <button
                className={`notification-button ${notificationUnread ? "unread" : ""}`}
                type="button"
                title={notificationUnread ? t("newNotification") : t("notifications")}
                aria-label={notificationUnread ? t("newNotification") : t("notifications")}
                onClick={() => {
                  const nextOpen = !notificationOpen;
                  setNotificationOpen(nextOpen);
                  setAccountOpen(false);
                  if (nextOpen) onNotificationsSeen?.();
                }}
              >
                {notificationUnread ? <BellDot size={18} /> : <Bell size={18} />}
              </button>
              {notificationOpen && (
                <NotificationPanel
                  items={notificationItems}
                  language={language}
                  onSelect={(item) => {
                    onNotificationSelect?.(item);
                    setNotificationOpen(false);
                  }}
                />
              )}
            </div>
            <button
              className="account-icon-trigger"
              type="button"
              title={user.displayName || user.email}
              aria-label={`${t("profile")} menu`}
              onClick={() => {
                setNotificationOpen(false);
                setAccountOpen(!accountOpen);
              }}
            >
              <ProfileAvatar user={user} label={user.displayName || user.email} />
            </button>
          </div>
          {accountOpen && (
            <div className="account-menu">
              <div className="account-language-row" role="group" aria-label={t("language")}>
                <span><Languages size={15} /> {t("language")}</span>
                <div className="language-toggle">
                  {Object.entries(UI_LANGUAGES).map(([value, label]) => (
                    <button
                      className={normalizeLanguage(language) === value ? "active" : ""}
                      type="button"
                      key={value}
                      onClick={() => onLanguageChange?.(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={onProfile}>
                <UserRound size={15} />
                {t("profile")}
              </button>
              {canManageLecturers && (
                <button onClick={onManageLecturers}>
                  <UserPlus size={15} />
                  {t("manageLecturers")}
                </button>
              )}
              <button onClick={onLogout}>
                <LogOut size={15} />
                {t("signOut")}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function groupClassesForSidebar(classes, groupByOwner) {
  if (!groupByOwner) return [{ key: "all", label: "", classes }];
  const groups = new Map();
  classes.forEach((course) => {
    const ownerEmail = normalizeEmail(course.ownerEmail || SUPREME_EMAIL);
    const label = course.ownerName || (ownerEmail === SUPREME_EMAIL ? SUPREME_PROFILE.name : ownerEmail);
    if (!groups.has(ownerEmail)) groups.set(ownerEmail, { key: ownerEmail, label, classes: [] });
    groups.get(ownerEmail).classes.push(course);
  });
  return [...groups.values()].sort((first, second) => first.label.localeCompare(second.label, "vi", { sensitivity: "base" }));
}

function SupremeClassScopeButton({ expanded, onToggle, language }) {
  const title = expanded ? uiText(language, "onlySupremeClasses") : uiText(language, "showAllClasses");
  return (
    <button
      className={`supreme-class-scope-button ${expanded ? "active" : ""}`}
      type="button"
      title={title}
      aria-label={title}
      onClick={onToggle}
    >
      {expanded ? <Eye size={16} /> : <EyeOff size={16} />}
    </button>
  );
}

function buildCourseLecturers(course) {
  const ownerEmail = normalizeEmail(course?.ownerEmail || SUPREME_EMAIL);
  const ownerName = course?.ownerName || (ownerEmail === SUPREME_EMAIL ? SUPREME_PROFILE.name : ownerEmail);
  const byEmail = new Map([[ownerEmail, { email: ownerEmail, name: ownerName, role: "owner" }]]);
  (course?.lecturers || []).forEach((lecturer) => {
    const email = normalizeEmail(lecturer.email);
    if (!email) return;
    byEmail.set(email, {
      email,
      name: lecturer.name || (email === ownerEmail ? ownerName : email),
      photoURL: lecturer.photoURL || "",
      role: email === ownerEmail ? "owner" : (lecturer.role || "assistant")
    });
  });
  (course?.lecturerEmails || []).forEach((emailValue) => {
    const email = normalizeEmail(emailValue);
    if (!email || byEmail.has(email)) return;
    byEmail.set(email, { email, name: email, photoURL: "", role: email === ownerEmail ? "owner" : "assistant" });
  });
  return [...byEmail.values()].sort((first, second) => {
    if (first.role === "owner") return -1;
    if (second.role === "owner") return 1;
    return String(first.name || first.email).localeCompare(String(second.name || second.email), "vi", { sensitivity: "base" });
  });
}

function ClassRow({ course, selected, pinned, archived, archivedMode, owned, canPin, canArchive, canEdit, canDelete, onSelect, onAction, language }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useOutsideClick(menuRef, open, () => setOpen(false));
  const hasMenu = canPin || canArchive || canEdit || canDelete;
  const t = (key, fallback = "") => uiText(language, key, fallback);
  return (
    <div className={`class-row ${selected ? "selected" : ""} ${owned ? "owner-class" : ""}`}>
      <button onClick={onSelect}>
        <span className="class-glyph"><GraduationCap size={16} /></span>
        <span>
          <strong>{course.name}</strong>
          <small>{course.code}</small>
        </span>
      </button>
      {hasMenu && (
        <div className="kebab-wrap" ref={menuRef}>
          <button className="icon-button" onClick={() => setOpen(!open)} aria-label="Class actions">
            <MoreVertical size={16} />
          </button>
          {open && (
            <div className="mini-menu">
              {canPin && <button onClick={() => { onAction("pin", course); setOpen(false); }}><Pin size={14} /> {pinned ? t("unpin") : t("pin")}</button>}
              {canArchive && (
                <button onClick={() => { onAction("archive", course); setOpen(false); }}>
                  {archivedMode || archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  {archivedMode || archived ? t("unarchive") : t("archived")}
                </button>
              )}
              {canEdit && <button onClick={() => { onAction("edit", course); setOpen(false); }}>{t("edit")}</button>}
              {canDelete && <button onClick={() => { onAction("delete", course); setOpen(false); }}><Trash2 size={14} /> {t("delete")}</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClassPane({
  admin,
  canViewAsVirtualStudent,
  viewingAsVirtualStudent,
  virtualStudentMember,
  virtualStudentCount = 0,
  onToggleVirtualStudentView,
  language,
  canManageCourseLecturers,
  user,
  course,
  examFormTemplates,
  setExamFormTemplates,
  selectedCard,
  setSelectedCard,
  isMobile,
  mobileView,
  reviewerOpenRequest,
  onMobileBackToClasses,
  onMobileBackToCards,
  onMobileOpenCard,
  onOpenAssignmentReviewer,
  onReviewerOpenConsumed,
  showToast,
  updateCourse
}) {
  const requestConfirm = useConfirmAction();
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState("");
  const [dragOverCardId, setDragOverCardId] = useState("");
  const [showClassCode, setShowClassCode] = useState(false);
  const addCardRef = useRef(null);
  useOutsideClick(addCardRef, cardMenuOpen, () => setCardMenuOpen(false));
  const classLeader = isClassLeaderForCourse(course, user);
  const canEditMembers = admin || classLeader;
  const canEditTopics = admin || classLeader;
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const hiddenCards = course.hiddenCards || [];
  const pinnedCards = course.pinnedCards || [];
  const extraCards = (course.extraCards || []).filter((id) => extraCardLabels[id]);
  const visibleBaseCards = baseCards.filter((card) => admin || !LECTURER_ONLY_CARD_IDS.has(card.id));
  const cardLabels = new Map([
    ...baseCards.map((card) => [card.id, uiCardLabel(language, card.id, card.label)]),
    ...Object.entries(extraCardLabels).map(([id, label]) => [id, uiCardLabel(language, id, label)])
  ]);
  const cards = orderCards(
    [...visibleBaseCards, ...extraCards.map((id) => ({ id, label: extraCardLabels[id] }))]
      .map((card) => ({ ...card, label: uiCardLabel(language, card.id, card.label) }))
      .filter((card) => !LECTURER_ONLY_CARD_IDS.has(card.id) || admin)
      .filter((card) => !hiddenCards.includes(card.id)),
    course.cardOrder,
    pinnedCards
  );
  const selectedCardLabel = cardLabels.get(selectedCard) || "";
  const addableCards = [...cardLabels.entries()].filter(([id]) => {
    if (LECTURER_ONLY_CARD_IDS.has(id) && !admin) return false;
    const extraMissing = extraCardLabels[id] && !extraCards.includes(id);
    return hiddenCards.includes(id) || extraMissing;
  });
  const visibleCardIdKey = cards.map((card) => card.id).join("|");

  useEffect(() => {
    if (!selectedCard || cards.some((card) => card.id === selectedCard)) return;
    setSelectedCard(cards[0]?.id || "");
  }, [cards, selectedCard, setSelectedCard, visibleCardIdKey]);

  function selectFallbackCard(nextHiddenCards) {
    const nextCard = cards.find((card) => card.id !== selectedCard && !nextHiddenCards.includes(card.id));
    setSelectedCard(nextCard?.id || "");
  }

  function addCard(id) {
    updateCourse((current) => ({
      ...current,
      extraCards: extraCardLabels[id] && !(current.extraCards || []).includes(id) ? [...(current.extraCards || []), id] : (current.extraCards || []),
      hiddenCards: (current.hiddenCards || []).filter((cardId) => cardId !== id),
      cardOrder: appendCardOrder(current.cardOrder, id)
    }));
    setSelectedCard(id);
    if (isMobile) onMobileOpenCard();
    setCardMenuOpen(false);
  }

  function openCard(id) {
    setSelectedCard(id);
    if (isMobile) onMobileOpenCard();
  }

  function togglePinCard(id) {
    updateCourse((current) => {
      const pinned = current.pinnedCards || [];
      return {
        ...current,
        pinnedCards: pinned.includes(id) ? pinned.filter((cardId) => cardId !== id) : [id, ...pinned],
        cardOrder: pinned.includes(id) ? current.cardOrder : moveCardIdToTop(visibleCardIds(current), id)
      };
    });
  }

  function hideCard(id) {
    const nextHiddenCards = hiddenCards.includes(id) ? hiddenCards : [...hiddenCards, id];
    updateCourse((current) => ({
      ...current,
      hiddenCards: nextHiddenCards,
      pinnedCards: (current.pinnedCards || []).filter((cardId) => cardId !== id),
      cardOrder: (current.cardOrder || []).filter((cardId) => cardId !== id)
    }));
    if (selectedCard === id) selectFallbackCard(nextHiddenCards);
  }

  function moveCard(sourceId, targetId) {
    if (!admin || !sourceId || !targetId || sourceId === targetId) return;
    const nextOrder = reorderCardIds(cards.map((card) => card.id), sourceId, targetId);
    updateCourse((current) => ({ ...current, cardOrder: nextOrder }));
  }

  const googleMeetUrl = normalizeExternalUrl(course.info?.googleMeetUrl);

  return (
    <section className="rightpane">
      <div className="class-header">
        {isMobile && (
          <button className="mobile-back-button" type="button" onClick={onMobileBackToClasses} aria-label={t("backToClassList")}>
            <ChevronLeft size={22} />
          </button>
        )}
        <div>
          <h2>{course.name}</h2>
          <p>{course.description}</p>
        </div>
        <div className="class-header-actions">
          {canViewAsVirtualStudent && (
            <button
              className={`virtual-view-toggle ${viewingAsVirtualStudent ? "active" : ""}`}
              type="button"
              onClick={onToggleVirtualStudentView}
              disabled={!viewingAsVirtualStudent && virtualStudentCount === 0}
              title={viewingAsVirtualStudent
                ? t("backToTeacherView")
                : (virtualStudentCount > 0 ? t("viewAsVirtualStudent") : t("noVirtualStudent"))}
              aria-label={viewingAsVirtualStudent ? t("backToTeacherView") : t("viewAsVirtualStudent")}
              aria-pressed={viewingAsVirtualStudent}
            >
              {viewingAsVirtualStudent ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>{viewingAsVirtualStudent ? `As ${virtualStudentMember?.name || t("virtualStudent")}` : t("viewAs")}</span>
            </button>
          )}
          {googleMeetUrl && (
            <button
              className="class-meet-button"
              type="button"
              title={t("openGoogleMeet")}
              aria-label={t("openGoogleMeet")}
              onClick={() => openExternalUrl(googleMeetUrl)}
            >
              <Video size={17} />
            </button>
          )}
          <button className="class-code class-code-button" type="button" onClick={() => setShowClassCode(true)}>
            {t("classCode")}: {course.code}
          </button>
        </div>
      </div>
      <div className="class-workspace">
        <aside className="leftpanel">
          {cards.map((card) => (
            <CardNavItem
              key={card.id}
              admin={admin}
              card={card}
              language={language}
              active={selectedCard === card.id}
              pinned={pinnedCards.includes(card.id)}
              draggable={admin}
              dragging={draggingCardId === card.id}
              dragOver={dragOverCardId === card.id && draggingCardId !== card.id}
              onSelect={() => openCard(card.id)}
              onPin={() => togglePinCard(card.id)}
              onDelete={() => requestConfirm({
                title: "Xóa thẻ?",
                message: `Bạn có chắc muốn xóa thẻ "${card.label}" khỏi lớp này không?`,
                confirmLabel: "Xóa thẻ"
              }, () => hideCard(card.id))}
              onDragStart={(event) => {
                if (!admin) return;
                setDraggingCardId(card.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", card.id);
              }}
              onDragOver={(event) => {
                if (!admin || !draggingCardId || draggingCardId === card.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverCardId(card.id);
              }}
              onDrop={(event) => {
                if (!admin) return;
                event.preventDefault();
                moveCard(event.dataTransfer.getData("text/plain") || draggingCardId, card.id);
                setDraggingCardId("");
                setDragOverCardId("");
              }}
              onDragEnd={() => {
                setDraggingCardId("");
                setDragOverCardId("");
              }}
            />
          ))}
          {admin && (
            <div className="add-card-wrap" ref={addCardRef}>
              <button className="add-card" onClick={() => setCardMenuOpen(!cardMenuOpen)} aria-label="Add card type">
                <Plus size={16} />
              </button>
              {cardMenuOpen && (
                <div className="add-card-menu">
                  {addableCards.length === 0 && <span>{t("noMoreCards")}</span>}
                  {addableCards.map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => addCard(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
        <section className="detail-panel">
          {isMobile && (
            <div className="mobile-detail-header">
              <button className="mobile-back-button" type="button" onClick={onMobileBackToCards} aria-label={t("backToCardList")}>
                <ChevronLeft size={22} />
              </button>
              <strong>{selectedCardLabel}</strong>
            </div>
          )}
          <DetailRenderer
            admin={admin}
            canManageCourseLecturers={canManageCourseLecturers}
            classLeader={classLeader}
            canEditMembers={canEditMembers}
            canEditTopics={canEditTopics}
            user={user}
            course={course}
            examFormTemplates={examFormTemplates}
            setExamFormTemplates={setExamFormTemplates}
            selectedCard={selectedCard}
            setSelectedCard={setSelectedCard}
            reviewerOpenRequest={reviewerOpenRequest}
            onOpenAssignmentReviewer={onOpenAssignmentReviewer}
            onReviewerOpenConsumed={onReviewerOpenConsumed}
            showToast={showToast}
            updateCourse={updateCourse}
          />
        </section>
      </div>
      {showClassCode && <ClassCodeModal course={course} onClose={() => setShowClassCode(false)} />}
    </section>
  );
}

function ClassCodeModal({ course, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const joinUrl = classJoinUrl(course.code);

  useEffect(() => {
    let cancelled = false;
    setQrError("");
    import("qrcode")
      .then((module) => {
        const QRCode = module.default || module;
        return QRCode.toDataURL(joinUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 280,
          color: {
            dark: "#0f172a",
            light: "#ffffff"
          }
        });
      })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setQrError("Không thể tạo QR code.");
      });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  async function copyClassCode() {
    try {
      await navigator.clipboard.writeText(course.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1400);
    } catch {
      setLinkCopied(false);
    }
  }

  return (
    <div className="class-code-overlay" role="dialog" aria-modal="true" aria-label="Mã lớp">
      <button className="class-code-close" type="button" onClick={onClose} aria-label="Đóng"><X size={30} /></button>
      <div className="class-code-dialog">
        <div className="class-code-copy-card">
          <strong>MÃ LỚP: {course.code}</strong>
          <button type="button" className="class-code-copy-button" onClick={copyClassCode} aria-label="Copy mã lớp">
            {copied ? <Check size={26} /> : <Copy size={26} />}
          </button>
        </div>
        <div className="class-code-qr-card">
          {qrDataUrl ? (
            <img className="class-code-qr" src={qrDataUrl} alt={`QR join ${course.code}`} />
          ) : (
            <div className="class-code-qr-placeholder">{qrError || "Đang tạo QR code..."}</div>
          )}
          <div className="class-code-invite-row">
            <span>{joinUrl}</span>
            <button type="button" className="class-code-copy-button" onClick={copyInviteLink} aria-label="Copy link invite">
              {linkCopied ? <Check size={22} /> : <Copy size={22} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function orderCards(cards, cardOrder, pinnedCards) {
  const cardIds = new Set(cards.map((card) => card.id));
  const fallbackOrder = [
    ...((pinnedCards || []).filter((id) => cardIds.has(id))),
    ...cards.map((card) => card.id).filter((id) => !(pinnedCards || []).includes(id))
  ];
  const order = (cardOrder || []).length
    ? [...cardOrder.filter((id) => cardIds.has(id)), ...cards.map((card) => card.id).filter((id) => !cardOrder.includes(id))]
    : fallbackOrder;
  const orderIndex = new Map(order.map((id, index) => [id, index]));
  return [...cards].sort((first, second) => (orderIndex.get(first.id) ?? 9999) - (orderIndex.get(second.id) ?? 9999));
}

function visibleCardIds(course) {
  const hiddenCards = course.hiddenCards || [];
  const extraCards = (course.extraCards || []).filter((id) => extraCardLabels[id]);
  return [...baseCards.map((card) => card.id), ...extraCards].filter((id) => !hiddenCards.includes(id));
}

function appendCardOrder(cardOrder, id) {
  const order = (cardOrder || []).filter((cardId) => cardId !== id);
  return [...order, id];
}

function moveCardIdToTop(cardIds, id) {
  return [id, ...cardIds.filter((cardId) => cardId !== id)];
}

function reorderCardIds(cardIds, sourceId, targetId) {
  const next = cardIds.filter((id) => id !== sourceId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex === -1) return cardIds;
  next.splice(targetIndex, 0, sourceId);
  return next;
}

function CardNavItem({ admin, card, active, pinned, draggable, dragging, dragOver, onSelect, onPin, onDelete, onDragStart, onDragOver, onDrop, onDragEnd, language }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useOutsideClick(menuRef, open, () => setOpen(false));
  const t = (key, fallback = "") => uiText(language, key, fallback);

  return (
    <div
      className={`left-card-row ${active ? "active" : ""} ${draggable ? "draggable" : ""} ${dragging ? "dragging" : ""} ${dragOver ? "drag-over" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <button className="left-card-button" onClick={onSelect}>
        <span>{card.label}</span>
        {pinned && <Pin size={13} />}
      </button>
      {admin && (
        <div className="left-card-menu-wrap" ref={menuRef}>
          <button className="icon-button card-menu-trigger" onClick={() => setOpen(!open)} aria-label={`${card.label} ${t("cardMenu")}`}>
            <MoreVertical size={15} />
          </button>
          {open && (
            <div className="mini-menu left-card-menu">
              <button onClick={() => { onPin(); setOpen(false); }}><Pin size={14} /> {pinned ? t("unpin") : t("pin")}</button>
              <button onClick={() => { onDelete(); setOpen(false); }}><Trash2 size={14} /> {t("delete")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRenderer({ admin, canManageCourseLecturers, classLeader, canEditMembers, canEditTopics, user, course, examFormTemplates, setExamFormTemplates, selectedCard, setSelectedCard, reviewerOpenRequest, onOpenAssignmentReviewer, onReviewerOpenConsumed, showToast, updateCourse }) {
  if (selectedCard === "members") return <MembersCard admin={admin} canManageCourseLecturers={canManageCourseLecturers} classLeader={classLeader} canEditMembers={canEditMembers} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "announcements") return <AnnouncementsCard admin={admin} classLeader={classLeader} user={user} course={course} showToast={showToast} updateCourse={updateCourse} onOpenAssignments={() => setSelectedCard("assignments")} onOpenGrades={() => setSelectedCard("grades")} onOpenAssignmentReviewer={onOpenAssignmentReviewer} />;
  if (selectedCard === "info") return <InfoCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "schedule") return <ScheduleCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "dutySchedules") return <DutySchedulesCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "groupTopic") return <GroupTopicCard admin={admin} canEdit={canEditTopics} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "intergroupTopic") return <IntergroupTopicCard admin={admin} canEdit={canEditTopics} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "materials") return <MaterialsCard admin={admin} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "assignments") return <AssignmentsCard admin={admin} user={user} course={course} reviewerOpenRequest={reviewerOpenRequest} onReviewerOpenConsumed={onReviewerOpenConsumed} updateCourse={updateCourse} />;
  if (selectedCard === "exams") return admin ? <ExamsCard user={user} course={course} examFormTemplates={examFormTemplates} setExamFormTemplates={setExamFormTemplates} updateCourse={updateCourse} /> : null;
  if (selectedCard === "grades") return <GradesCard admin={admin} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "personalTopic") return <PersonalTopicCard admin={admin} canEdit={canEditTopics} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "peerReview") return null;
  return null;
}

function PanelTitle({ title, action }) {
  const language = useUiLanguage();
  return (
    <div className="panel-title">
      <h3>{uiLiteral(language, title)}</h3>
      {action}
    </div>
  );
}

function jsonSignature(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value ?? "");
  }
}

function SaveButton({
  children = "Save",
  className = "",
  dirty = false,
  disabled = false,
  icon = null,
  onClick,
  saving: controlledSaving = false,
  type = "button",
  ...props
}) {
  const [internalSaving, setInternalSaving] = useState(false);
  const saving = Boolean(controlledSaving || internalSaving);

  async function handleClick(event) {
    if (disabled || saving) return;
    const startedAt = Date.now();
    setInternalSaving(true);
    try {
      await Promise.resolve(onClick?.(event));
      const elapsed = Date.now() - startedAt;
      if (elapsed < 420) {
        await new Promise((resolve) => window.setTimeout(resolve, 420 - elapsed));
      }
    } finally {
      setInternalSaving(false);
    }
  }

  return (
    <button
      className={`save-action ${className} ${dirty ? "is-dirty" : ""} ${saving ? "is-saving" : ""}`.trim()}
      type={type}
      onClick={handleClick}
      disabled={disabled || saving}
      {...props}
    >
      {saving ? <span className="button-spinner" /> : icon}
      {saving ? "Saving" : children}
    </button>
  );
}


function MembersCard({ admin, canManageCourseLecturers, classLeader, canEditMembers, user, course, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const [viewMode, setViewMode] = useState("personal");
  const [lecturerDraft, setLecturerDraft] = useState({ email: "", name: "" });
  const [lecturerAddOpen, setLecturerAddOpen] = useState(false);
  const [virtualAddOpen, setVirtualAddOpen] = useState(false);
  const [virtualCountDraft, setVirtualCountDraft] = useState("10");
  const lecturerAddRef = useRef(null);
  const virtualAddRef = useRef(null);
  const accepted = course.members.filter((member) => member.status === "accepted");
  const pending = course.members.filter((member) => member.status === "pending");
  const virtualMembers = (course.members || []).filter(isVirtualMember);
  const virtualRemaining = Math.max(0, MAX_VIRTUAL_MEMBERS - virtualMembers.length);
  const courseLecturers = buildCourseLecturers(course);
  const memberDraftSignature = accepted.map((member) => `${member.email}:${member.order || ""}:${member.group || ""}:${isClassLeaderMember(member) ? "1" : "0"}`).join("|");
  const [memberDrafts, setMemberDrafts] = useState({});
  const orderedMembers = [...accepted].sort(compareMemberOrder);
  const groupedMembers = groupMembersByGroup(accepted);
  const memberDraftDirty = accepted.some((member) => {
    const draft = memberDrafts[member.email] || {};
    return String(draft.order ?? "") !== String(member.order || "")
      || String(draft.group ?? "") !== String(member.group || "");
  });

  useOutsideClick(lecturerAddRef, lecturerAddOpen, () => setLecturerAddOpen(false));
  useOutsideClick(virtualAddRef, virtualAddOpen, () => setVirtualAddOpen(false));

  useEffect(() => {
    setMemberDrafts(Object.fromEntries(accepted.map((member) => [member.email, {
      order: String(member.order || ""),
      group: String(member.group || "")
    }])));
  }, [memberDraftSignature]);

  function updateMemberDraft(email, field, value) {
    setMemberDrafts((current) => ({
      ...current,
      [email]: {
        order: String(current[email]?.order ?? ""),
        group: String(current[email]?.group ?? ""),
        [field]: value.replace(/\D/g, "")
      }
    }));
  }

  function updateVirtualCountDraft(value) {
    const cleaned = cleanNumberText(value).slice(0, 3);
    setVirtualCountDraft(cleaned);
  }

  function addVirtualMembers() {
    if (!admin || virtualRemaining <= 0) return;
    const requested = Number(cleanNumberText(virtualCountDraft));
    if (!Number.isFinite(requested) || requested <= 0) return;
    const count = Math.min(requested, virtualRemaining);
    const nextVirtualMembers = createVirtualMembers(course, count);
    if (nextVirtualMembers.length === 0) return;
    updateCourse((current) => ({
      ...current,
      members: [...(current.members || []), ...nextVirtualMembers]
    }), {
      toast: `Đã thêm ${nextVirtualMembers.length} học viên ảo.`,
      writeClassDoc: false,
      writeSummary: false,
      writeMembers: true
    });
    setVirtualAddOpen(false);
  }

  async function removeVirtualMembers() {
    const virtualEmails = new Set((course.members || []).filter(isVirtualMember).map((member) => normalizeEmail(member.email)));
    if (virtualEmails.size === 0) return;
    try {
      await updateCourse((current) => {
        const currentVirtualEmails = new Set((current.members || []).filter(isVirtualMember).map((member) => normalizeEmail(member.email)));
        const nextCourse = {
          ...current,
          members: (current.members || []).filter((member) => !currentVirtualEmails.has(normalizeEmail(member.email))),
          groupTopics: removeVirtualEmailsFromTopics(current.groupTopics || [], currentVirtualEmails),
          intergroupTopics: removeVirtualEmailsFromTopics(current.intergroupTopics || [], currentVirtualEmails),
          personalTopics: (current.personalTopics || []).filter((item) => !currentVirtualEmails.has(normalizeEmail(item.email)))
        };
        return removeMemberGeneratedActivity(nextCourse, currentVirtualEmails);
      }, {
        toast: "Đã remove học viên ảo và dữ liệu test của học viên ảo.",
        writeMembers: false,
        writeSummary: false,
        classFields: ["groupTopics", "intergroupTopics", "personalTopics", "assignments", "peerReviews"],
        throwOnError: true
      });
      await Promise.all([...virtualEmails].flatMap((email) => [
        deleteMemberActivityFromCloud(course.id, email),
        deleteMemberFromCloud(course.id, email)
      ]));
      setVirtualAddOpen(false);
    } catch (error) {
      console.error(error);
    }
  }

  function saveMembers() {
    return updateCourse((current) => ({
      ...current,
      members: current.members.map((member) => {
        const draft = memberDrafts[member.email];
        return draft ? { ...member, order: draft.order, group: draft.group } : member;
      })
    }), { toast: true, writeClassDoc: false, writeSummary: false, memberFields: ["order", "group"] });
  }

  function acceptAllPending() {
    updateCourse((current) => ({
      ...current,
      members: current.members.map((member) => (
        member.status === "pending" ? { ...member, status: "accepted" } : member
      ))
    }), { toast: "Đã accept tất cả.", writeClassDoc: false, writeSummary: false, memberFields: ["status"] });
  }

  async function addCourseLecturer() {
    const email = normalizeEmail(lecturerDraft.email);
    if (!email || email === normalizeEmail(course.ownerEmail || SUPREME_EMAIL)) return;
    const existingMember = course.members.find((member) => normalizeEmail(member.email) === email);
    try {
      await updateCourse((current) => {
        const lecturers = buildCourseLecturers(current);
        if (lecturers.some((lecturer) => normalizeEmail(lecturer.email) === email)) return current;
        const memberProfile = current.profiles?.[email] || current.profiles?.[existingMember?.email] || {};
        const nextLecturers = [
          ...lecturers,
          {
            email,
            name: lecturerDraft.name.trim() || memberProfile.displayName || existingMember?.name || email,
            photoURL: memberProfile.photoURL || existingMember?.photoURL || "",
            role: "assistant"
          }
        ];
        return {
          ...current,
          lecturers: nextLecturers,
          lecturerEmails: nextLecturers.map((lecturer) => normalizeEmail(lecturer.email)),
          members: current.members.filter((member) => normalizeEmail(member.email) !== email)
        };
      }, { toast: "Đã thêm giảng viên.", writeMembers: false, writeSummary: false, classFields: ["lecturers", "lecturerEmails"], throwOnError: true });
      if (existingMember) await deleteMemberFromCloud(course.id, existingMember.email);
      setLecturerDraft({ email: "", name: "" });
      setLecturerAddOpen(false);
    } catch (error) {
      console.error(error);
    }
  }

  function removeCourseLecturer(email) {
    const normalized = normalizeEmail(email);
    updateCourse((current) => {
      const nextLecturers = buildCourseLecturers(current).filter((lecturer) => normalizeEmail(lecturer.email) !== normalized || lecturer.role === "owner");
      return { ...current, lecturers: nextLecturers, lecturerEmails: nextLecturers.map((lecturer) => normalizeEmail(lecturer.email)) };
    }, { toast: "Đã xóa giảng viên.", writeMembers: false, writeSummary: false, classFields: ["lecturers", "lecturerEmails"] });
  }

  function demoteCourseLecturer(profile) {
    const email = normalizeEmail(profile.email);
    if (!email || email === normalizeEmail(course.ownerEmail || SUPREME_EMAIL)) return;
    updateCourse((current) => {
      const existingMember = (current.members || []).find((member) => normalizeEmail(member.email) === email);
      const savedProfile = current.profiles?.[email] || current.profiles?.[profile.email] || {};
      const nextLecturers = buildCourseLecturers(current).filter((lecturer) => normalizeEmail(lecturer.email) !== email || lecturer.role === "owner");
      const nextMember = {
        order: existingMember?.order || nextNumericText((current.members || []).map((member) => member.order)),
        name: savedProfile.displayName || existingMember?.name || profile.name || email,
        email,
        photoURL: savedProfile.photoURL || existingMember?.photoURL || profile.photoURL || "",
        studentId: savedProfile.studentId || existingMember?.studentId || "",
        group: existingMember?.group || "",
        status: "accepted"
      };
      return {
        ...current,
        lecturers: nextLecturers,
        lecturerEmails: nextLecturers.map((lecturer) => normalizeEmail(lecturer.email)),
        members: existingMember
          ? current.members.map((member) => normalizeEmail(member.email) === email ? { ...member, ...nextMember } : member)
          : [...current.members, nextMember]
      };
    }, { toast: "Đã chuyển giảng viên thành người học.", writeMembers: true, writeSummary: false, classFields: ["lecturers", "lecturerEmails"] });
  }

  async function promoteMemberToLecturer(member) {
    const email = normalizeEmail(member.email);
    if (!email || email === normalizeEmail(course.ownerEmail || SUPREME_EMAIL)) return;
    try {
      await updateCourse((current) => {
        const lecturers = buildCourseLecturers(current);
        const hasLecturer = lecturers.some((lecturer) => normalizeEmail(lecturer.email) === email);
        const profile = current.profiles?.[member.email] || {};
        const nextLecturers = hasLecturer
          ? lecturers
          : [
            ...lecturers,
            {
              email,
              name: profile.displayName || member.name || email,
              photoURL: profile.photoURL || member.photoURL || "",
              role: "assistant"
            }
          ];
        return {
          ...current,
          lecturers: nextLecturers,
          lecturerEmails: nextLecturers.map((lecturer) => normalizeEmail(lecturer.email)),
          members: current.members.filter((item) => normalizeEmail(item.email) !== email)
        };
      }, { toast: "Đã chuyển người học thành giảng viên.", writeMembers: false, writeSummary: false, classFields: ["lecturers", "lecturerEmails"], throwOnError: true });
      await deleteMemberFromCloud(course.id, member.email);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <PanelTitle
        title="Thành viên"
        action={
          canManageCourseLecturers && (
            <div className="material-add-wrap lecturer-invite-wrap" ref={lecturerAddRef}>
              <button className="material-add-button lecturer-add-button" type="button" onClick={() => setLecturerAddOpen((current) => !current)}>
                <Plus size={14} /> Add
              </button>
              {lecturerAddOpen && (
                <div className="material-add-popover lecturer-invite-popover">
                  <input
                    value={lecturerDraft.email}
                    onChange={(event) => setLecturerDraft((current) => ({ ...current, email: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addCourseLecturer();
                    }}
                    placeholder="Nhập email giảng viên"
                  />
                  <div className="material-upload-actions">
                    <button className="primary-action compact dark-action" type="button" onClick={addCourseLecturer}>
                      <UserPlus size={14} /> Invite
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        }
      />
      <div data-enter-scope="members">
        <div className="teacher-strip">
          {courseLecturers.map((profile) => {
            const savedProfile = course.profiles?.[profile.email] || {};
            const teacherName = savedProfile.displayName || profile.name || profile.email;
            return (
            <div key={profile.email}>
              <ProfileAvatar user={{ ...profile, photoURL: savedProfile.photoURL || profile.photoURL || (profile.email === user.email ? user.photoURL : "") }} label={teacherName} />
              <strong>{profile.role === "owner" ? t("membersLecturerOwner", "Giảng viên (owner)") : t("membersLecturer", "Giảng viên")}</strong>
              <small>{teacherName} - {profile.email}</small>
              {canManageCourseLecturers && profile.role !== "owner" && (
                <LecturerActionsMenu
                  teacherName={teacherName}
                  onDemote={() => demoteCourseLecturer(profile)}
                  onDelete={() => requestConfirm({
                    title: "Xóa giảng viên?",
                    message: `Bạn có chắc muốn xóa "${teacherName}" khỏi vai trò giảng viên của lớp này không?`,
                    confirmLabel: "Xóa giảng viên"
                  }, () => removeCourseLecturer(profile.email))}
                />
              )}
            </div>
            );
          })}
        </div>
        {admin && pending.length > 0 && (
          <section className="subsection">
            <div className="subsection-head">
              <h4>Chờ accept</h4>
              <button className="primary-action compact" onClick={acceptAllPending}><Check size={14} /> Accept All</button>
            </div>
            {pending.map((member) => (
              <div className="pending-row" key={member.email}>
                <span>{member.name}</span>
                <small>{member.email} - {member.studentId}</small>
                <button onClick={() => updateMemberStatus(course, updateCourse, member.email, "accepted")}><Check size={15} /> Accept</button>
                <button onClick={() => requestConfirm({
                  title: "Xóa yêu cầu tham gia?",
                  message: `Bạn có chắc muốn từ chối và xóa yêu cầu tham gia của "${member.name || member.email}" không?`,
                  confirmLabel: "Reject"
                }, () => removeMember(course, updateCourse, member.email))}><X size={15} /> Reject</button>
              </div>
            ))}
          </section>
        )}
        <div className="student-list-toolbar">
          <strong className="student-list-title">
            {t("studentList", "Danh sách người học")} <span className="student-list-count">({accepted.length})</span>
          </strong>
          <div className="student-list-actions">
            {admin && (
              <div className="material-add-wrap virtual-member-wrap" ref={virtualAddRef}>
                <button className="material-add-button virtual-add-button" type="button" onClick={() => setVirtualAddOpen((current) => !current)}>
                  <Plus size={14} /> Add
                </button>
                {virtualAddOpen && (
                  <div className="material-add-popover virtual-member-popover">
                    <div className="virtual-member-summary">
                      <strong>Học viên ảo</strong>
                      <small>{virtualMembers.length}/{MAX_VIRTUAL_MEMBERS} học viên ảo trong lớp</small>
                    </div>
                    <label className="virtual-member-field">
                      <span>Số lượng</span>
                      <input
                        className="virtual-count-input"
                        inputMode="numeric"
                        value={virtualCountDraft}
                        onChange={(event) => updateVirtualCountDraft(event.target.value)}
                        disabled={virtualRemaining <= 0}
                        aria-label="Số lượng học viên ảo muốn thêm"
                      />
                    </label>
                    <div className="material-upload-actions virtual-member-popover-actions">
                      <button className="primary-action compact" type="button" onClick={addVirtualMembers} disabled={virtualRemaining <= 0 || !Number(cleanNumberText(virtualCountDraft))}>
                        <Plus size={14} /> Thêm học viên ảo
                      </button>
                      {virtualMembers.length > 0 && (
                        <button className="secondary-action compact virtual-remove-button" type="button" onClick={() => requestConfirm({
                          title: "Remove học viên ảo?",
                          message: `Bạn có chắc muốn remove ${virtualMembers.length} học viên ảo khỏi lớp không? Bài đăng, bài nộp và dữ liệu test của học viên ảo cũng sẽ bị xóa khỏi class.`,
                          confirmLabel: "Remove học viên ảo"
                        }, removeVirtualMembers)}>
                          <Trash2 size={14} /> Remove học viên ảo
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="member-view-toggle" aria-label="Chế độ xem thành viên">
              <button type="button" className={viewMode === "personal" ? "active" : ""} onClick={() => setViewMode("personal")}>{t("personal", "Cá nhân")}</button>
              <button type="button" className={viewMode === "group" ? "active" : ""} onClick={() => setViewMode("group")}>{t("group", "Nhóm")}</button>
            </div>
            {canEditMembers && <SaveButton className="compact" dirty={memberDraftDirty} onClick={saveMembers} />}
          </div>
        </div>
        {viewMode === "personal" ? (
          <MembersTable admin={admin} canManageCourseLecturers={canManageCourseLecturers} canEditMembers={canEditMembers} course={course} members={orderedMembers} memberDrafts={memberDrafts} onDraftChange={updateMemberDraft} onPromoteToLecturer={promoteMemberToLecturer} updateCourse={updateCourse} language={language} />
        ) : (
          <div className="member-group-list">
            {groupedMembers.map((group) => (
              <section className="member-group-card" key={group.key}>
                <h4>{uiGroupLabel(language, group.rawGroup)}</h4>
                <MembersTable admin={admin} canManageCourseLecturers={canManageCourseLecturers} canEditMembers={canEditMembers} course={course} members={group.members} memberDrafts={memberDrafts} onDraftChange={updateMemberDraft} onPromoteToLecturer={promoteMemberToLecturer} updateCourse={updateCourse} language={language} />
              </section>
            ))}
          </div>
        )}
        {canEditMembers && (
          <div className="bottom-save-row">
            <SaveButton className="compact" dirty={memberDraftDirty} onClick={saveMembers} />
          </div>
        )}
      </div>
    </>
  );
}

function MembersTable({ admin, canManageCourseLecturers, canEditMembers, course, members, memberDrafts = {}, onDraftChange, onPromoteToLecturer, updateCourse, language }) {
  const requestConfirm = useConfirmAction();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  return (
    <table className="data-table members-table">
      <thead><tr><th className="stt-col">{t("stt", "STT")}</th><th className="avatar-col">{t("photo", "Ảnh")}</th><th>{t("fullName", "Họ và tên")}</th><th>{t("group", "Nhóm")}</th><th>{t("studentId", "Mã số")}</th><th>{t("email", "Email")}</th>{admin && <th />}</tr></thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.email}>
            <td>{canEditMembers ? <input className="order-input" data-enter-group="member-order" inputMode="numeric" value={memberDrafts[member.email]?.order ?? String(member.order || "")} onKeyDown={(event) => focusNextInputOnEnter(event, "member-order")} onChange={(event) => onDraftChange(member.email, "order", event.target.value)} /> : member.order}</td>
            <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
            <td>
              <span className="member-name-cell">
                <span className="member-name-line">
                  <span>{member.name}</span>
                  {isVirtualMember(member) && <VirtualMemberBadge />}
                </span>
                {isClassLeaderMember(member) && <span className="leader-badge"><Crown size={12} /> {t("classLeader", "Lớp trưởng")}</span>}
              </span>
            </td>
            <td>{canEditMembers ? <input className="group-input" data-enter-group="member-group" inputMode="numeric" value={memberDrafts[member.email]?.group ?? String(member.group || "")} onKeyDown={(event) => focusNextInputOnEnter(event, "member-group")} onChange={(event) => onDraftChange(member.email, "group", event.target.value)} /> : member.group || ""}</td>
            <td>{member.studentId}</td>
            <td>{displayMemberEmail(member)}</td>
            {admin && (
              <td>
                <div className="member-actions">
                  <MemberRoleMenu
                    member={member}
                    canPromoteToLecturer={canManageCourseLecturers}
                    language={language}
                    onToggleClassLeader={() => setClassLeader(course, updateCourse, member.email)}
                    onPromoteToLecturer={() => onPromoteToLecturer(member)}
                    onDelete={() => requestConfirm({
                      title: "Xóa người học?",
                      message: isVirtualMember(member)
                        ? `Bạn có chắc muốn xóa "${member.name || member.email}" khỏi lớp này không? Bài đăng, bài nộp và dữ liệu test của học viên ảo này cũng sẽ bị xóa khỏi class.`
                        : `Bạn có chắc muốn xóa "${member.name || member.email}" khỏi lớp này không?`,
                      confirmLabel: "Xóa người học"
                    }, () => removeMember(course, updateCourse, member.email))}
                  />
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LecturerActionsMenu({ teacherName, onDemote, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, open, () => setOpen(false));

  return (
    <div className="lecturer-card-actions member-role-wrap" ref={ref}>
      <button
        className="row-menu-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        title={`Hành động với ${teacherName}`}
        aria-label={`Hành động với ${teacherName}`}
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="mini-menu member-role-menu lecturer-action-menu">
          <button type="button" onClick={() => {
            onDemote();
            setOpen(false);
          }}>
            <UserRound size={14} /> Chuyển thành người học
          </button>
          <button className="danger-menu-item" type="button" onClick={() => {
            onDelete();
            setOpen(false);
          }}>
            <Trash2 size={14} /> Xóa giảng viên
          </button>
        </div>
      )}
    </div>
  );
}

function MemberRoleMenu({ member, canPromoteToLecturer, language, onToggleClassLeader, onPromoteToLecturer, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const classLeader = isClassLeaderMember(member);
  const t = (key, fallback = "") => uiText(language, key, fallback);
  useOutsideClick(ref, open, () => setOpen(false));

  return (
    <div className="member-role-wrap" ref={ref}>
      <button
        className={`row-menu-trigger ${classLeader ? "active" : ""}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Hành động"
        aria-label={`Hành động với ${member.name || member.email}`}
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="mini-menu member-role-menu">
          <button type="button" onClick={() => {
            onToggleClassLeader();
            setOpen(false);
          }}>
            <Crown size={14} /> {classLeader ? t("removeClassLeader", "Bỏ lớp trưởng") : t("classLeader", "Lớp trưởng")}
          </button>
          {canPromoteToLecturer && (
            <button type="button" onClick={() => {
              onPromoteToLecturer();
              setOpen(false);
            }}>
              <UserPlus size={14} /> {t("promoteToLecturer", "Giảng viên")}
            </button>
          )}
          <button className="danger-menu-item" type="button" onClick={() => {
            onDelete();
            setOpen(false);
          }}>
            <Trash2 size={14} /> {t("deleteLearner", "Xóa người học")}
          </button>
        </div>
      )}
    </div>
  );
}

function removeMemberGeneratedActivity(course, emails) {
  const emailSet = new Set(Array.from(emails || []).map(normalizeEmail).filter(Boolean));
  if (emailSet.size === 0) return course;
  const byEmail = (value) => emailSet.has(normalizeEmail(value || ""));
  return {
    ...course,
    announcements: (course.announcements || []).filter((post) => !byEmail(post.author || post.authorEmail || post.email)),
    assignments: (course.assignments || []).map((assignment) => ({
      ...assignment,
      submissions: (assignment.submissions || []).filter((submission) => !byEmail(submission.email)),
      peerScoreResponses: (assignment.peerScoreResponses || []).filter((response) => !byEmail(response.email)),
      reviewerQuestions: (assignment.reviewerQuestions || []).filter((question) => !byEmail(question.email))
    })),
    peerReviews: (course.peerReviews || []).map((review) => ({
      ...review,
      responses: (review.responses || []).filter((response) => !byEmail(response.email))
    }))
  };
}

function createVirtualMembers(course, count) {
  const existingMembers = course.members || [];
  const existingEmails = new Set(existingMembers.map((member) => normalizeEmail(member.email)));
  const usedNames = new Set(existingMembers.filter(isVirtualMember).map((member) => String(member.name || "").trim()).filter(Boolean));
  const nextMembers = [];
  const createdAtMillis = Date.now();
  let serial = nextVirtualMemberSerial(existingMembers);
  let nextOrder = Number(nextNumericText(existingMembers.map((member) => member.order)));

  while (nextMembers.length < count && nextMembers.length + existingMembers.filter(isVirtualMember).length < MAX_VIRTUAL_MEMBERS) {
    const serialText = String(serial).padStart(3, "0");
    const email = normalizeEmail(`v${serialText}@${VIRTUAL_MEMBER_DOMAIN}`);
    serial += 1;
    if (existingEmails.has(email)) continue;
    existingEmails.add(email);
    const name = virtualVietnameseName(serial - 1, usedNames);
    usedNames.add(name);
    nextMembers.push({
      order: String(nextOrder),
      name,
      email,
      studentId: `VIRTUAL-${serialText}`,
      group: "",
      status: "accepted",
      isVirtual: true,
      virtualCreatedAtMillis: createdAtMillis
    });
    nextOrder += 1;
  }

  return nextMembers;
}

function nextVirtualMemberSerial(members = []) {
  const serials = members
    .filter(isVirtualMember)
    .map((member) => {
      const studentIdMatch = String(member.studentId || "").match(/(\d+)$/);
      if (studentIdMatch) return Number(studentIdMatch[1]);
      const emailMatch = String(member.email || "").match(/(?:-|v)(\d+)@/i);
      return emailMatch ? Number(emailMatch[1]) : 0;
    })
    .filter(Number.isFinite);
  return (serials.length ? Math.max(...serials) : 0) + 1;
}

function removeVirtualEmailsFromTopics(topics = [], virtualEmails) {
  return (topics || []).map((topic) => ({
    ...topic,
    memberEmails: (topic.memberEmails || []).filter((email) => !virtualEmails.has(normalizeEmail(email)))
  }));
}

function VirtualMemberBadge() {
  return (
    <span className="virtual-member-badge" title="Học viên ảo">
      <UserRound size={11} /> Ảo
    </span>
  );
}

function compareMemberOrder(first, second) {
  return compareNumericText(first.order, second.order)
    || String(first.name || "").localeCompare(String(second.name || ""), "vi", { sensitivity: "base" })
    || String(first.email || "").localeCompare(String(second.email || ""), "vi", { sensitivity: "base" });
}

function groupMembersByGroup(members) {
  const groups = new Map();

  members.forEach((member) => {
    const rawGroup = String(member.group ?? "").trim();
    const key = rawGroup || "__ungrouped__";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        rawGroup,
        label: rawGroup ? `Nhóm ${rawGroup}` : "Chưa có nhóm",
        members: []
      });
    }
    groups.get(key).members.push(member);
  });

  return [...groups.values()]
    .sort((first, second) => compareGroupValue(first.rawGroup, second.rawGroup))
    .map((group) => ({ ...group, members: [...group.members].sort(compareMemberOrder) }));
}

function compareGroupValue(first, second) {
  const firstText = String(first ?? "").trim();
  const secondText = String(second ?? "").trim();
  if (!firstText && !secondText) return 0;
  if (!firstText) return 1;
  if (!secondText) return -1;
  return compareNumericText(firstText, secondText)
    || firstText.localeCompare(secondText, "vi", { numeric: true, sensitivity: "base" });
}

function compareNumericText(first, second) {
  const firstText = String(first ?? "").trim();
  const secondText = String(second ?? "").trim();
  const firstNumber = Number(firstText);
  const secondNumber = Number(secondText);
  const firstNumeric = firstText !== "" && Number.isFinite(firstNumber);
  const secondNumeric = secondText !== "" && Number.isFinite(secondNumber);

  if (firstNumeric && secondNumeric) return firstNumber - secondNumber;
  if (firstNumeric) return -1;
  if (secondNumeric) return 1;
  if (!firstText && secondText) return 1;
  if (firstText && !secondText) return -1;
  return 0;
}

function updateMemberStatus(course, updateCourse, email, status) {
  updateCourse((current) => ({ ...current, members: current.members.map((member) => (member.email === email ? { ...member, status } : member)) }));
}

function updateMemberOrder(course, updateCourse, email, order) {
  updateCourse((current) => ({ ...current, members: current.members.map((member) => (member.email === email ? { ...member, order } : member)) }));
}

function updateMemberGroup(course, updateCourse, email, group) {
  updateCourse((current) => ({ ...current, members: current.members.map((member) => (member.email === email ? { ...member, group } : member)) }));
}

function setClassLeader(course, updateCourse, email) {
  const currentLeader = (course.members || []).find((member) => member.email === email && isClassLeaderMember(member));
  updateCourse((current) => ({
    ...current,
    members: current.members.map((member) => (
      member.status === "accepted"
        ? markClassLeader(member, !currentLeader && member.email === email)
        : markClassLeader(member, false)
    ))
  }), {
    toast: currentLeader ? "Đã bỏ lớp trưởng." : "Đã chọn lớp trưởng.",
    writeClassDoc: false,
    writeSummary: false,
    memberFields: ["classLeader"]
  });
}

function markClassLeader(member, classLeader) {
  const nextMember = { ...member, classLeader };
  if (nextMember.role === "classLeader") delete nextMember.role;
  return nextMember;
}

async function removeMember(course, updateCourse, email) {
  const normalized = normalizeEmail(email);
  const targetMember = (course.members || []).find((member) => normalizeEmail(member.email) === normalized);
  const shouldRemoveActivity = targetMember && isVirtualMember(targetMember);
  await updateCourse((current) => {
    const nextCourse = {
      ...current,
      members: (current.members || []).filter((member) => normalizeEmail(member.email) !== normalized)
    };
    return shouldRemoveActivity ? removeMemberGeneratedActivity(nextCourse, [normalized]) : nextCourse;
  });
  if (shouldRemoveActivity) await deleteMemberActivityFromCloud(course.id, normalized);
  await deleteMemberFromCloud(course.id, email);
}

function PostAuthor({ post, currentUser }) {
  const profile = {
    displayName: post.authorName || post.author,
    email: post.author,
    photoURL: post.authorPhotoURL || (post.author === currentUser.email ? currentUser.photoURL : "")
  };

  return (
    <div className="post-author">
      <ProfileAvatar user={profile} label={profile.displayName || profile.email} small />
      <div>
        <strong>{profile.displayName || profile.email}</strong>
        <small>{post.createdAt}</small>
      </div>
    </div>
  );
}

function MemberNumberInput({ className, value, onCommit }) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const focusedRef = useRef(false);
  const latestValueRef = useRef(String(value ?? ""));
  const pendingValueRef = useRef(null);
  const pendingTimerRef = useRef(null);

  useEffect(() => {
    const nextValue = String(value ?? "");
    latestValueRef.current = nextValue;

    if (focusedRef.current) return;
    if (pendingValueRef.current !== null) {
      if (nextValue === pendingValueRef.current) setDraft(nextValue);
      return;
    }
    setDraft(nextValue);
  }, [value]);

  useEffect(() => () => {
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
  }, []);

  function clean(value) {
    return value.replace(/\D/g, "");
  }

  function commit() {
    focusedRef.current = false;
    const nextValue = clean(draft);
    setDraft(nextValue);
    if (nextValue === latestValueRef.current) return;

    pendingValueRef.current = nextValue;
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = window.setTimeout(() => {
      pendingValueRef.current = null;
      setDraft(latestValueRef.current);
    }, 3000);
    onCommit(nextValue);
  }

  return (
    <input
      className={className}
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      onFocus={() => { focusedRef.current = true; }}
      onChange={(event) => setDraft(clean(event.target.value))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}


function AnnouncementsCard({ admin, classLeader, user, course, showToast, updateCourse, onOpenAssignments, onOpenGrades, onOpenAssignmentReviewer }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [pinned, setPinned] = useState(false);
  const [publishAsMaterial, setPublishAsMaterial] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [nowMillis, setNowMillis] = useState(Date.now());
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [postNotice, setPostNotice] = useState("");
  const postPermission = getAnnouncementPostPermission(course);
  const explicitPostPermission = course.announcementPostPermission || "";
  const announcementEmailEnabled = Boolean(course.announcementEmailEnabled);
  const canPost = canPostAnnouncement(course, user, admin, classLeader);
  const canSchedulePost = admin || classLeader;
  const canAttachAnnouncementFiles = admin || postPermission !== ANNOUNCEMENT_POST_PERMISSIONS.everyoneNoFiles;
  const pendingScheduledEmailIdsRef = useRef(new Set());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMillis(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canAttachAnnouncementFiles && files.length > 0) setFiles([]);
  }, [canAttachAnnouncementFiles, files.length]);

  useEffect(() => {
    if (!hasFirebaseConfig || (!admin && !classLeader)) return;
    const dueScheduledPosts = (course.announcements || []).filter((item) => {
      const publishAtMillis = announcementPublishMillis(item);
      return item?.id
        && item.emailRequested === true
        && normalizeEmail(item.author) === normalizeEmail(user?.email)
        && Number(item.scheduledAtMillis || 0) > 0
        && publishAtMillis <= nowMillis
        && !item.emailSentAtMillis
        && !item.emailSkippedAtMillis
        && !pendingScheduledEmailIdsRef.current.has(item.id);
    });
    if (!dueScheduledPosts.length) return;
    dueScheduledPosts.forEach((item) => {
      sendScheduledAnnouncementEmail(item);
    });
  }, [admin, classLeader, course.announcements, course.id, nowMillis, user?.email]);

  function addFiles(fileList) {
    if (!canAttachAnnouncementFiles) return;
    const nextFiles = Array.from(fileList || []);
    if (nextFiles.length) setFiles((current) => [...current, ...nextFiles]);
  }

  function removeSelectedFile(index) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function updatePostPermission(permission) {
    updateCourse((current) => ({
      ...current,
      announcementPostPermission: permission
    }), {
      toast: "Đã cập nhật quyền đăng tin.",
      writeMembers: false,
      writeSummary: false,
      classFields: ["announcementPostPermission"]
    });
  }

  function updateAnnouncementEmailEnabled(enabled) {
    updateCourse((current) => ({
      ...current,
      announcementEmailEnabled: enabled
    }), {
      toast: enabled ? "Đã bật gửi email thông báo cho lớp." : "Đã tắt gửi email thông báo cho lớp.",
      writeMembers: false,
      writeSummary: false,
      classFields: ["announcementEmailEnabled"]
    });
  }

  async function submitPost() {
    const postFiles = canAttachAnnouncementFiles ? files : [];
    if (!content.trim() && postFiles.length === 0) return;
    if (!canPost) {
      setPostError("Bạn không có quyền đăng tin trong lớp này.");
      return;
    }
    setPosting(true);
    setPostError("");
    setPostNotice("");
    try {
      const createdAtMillis = Date.now();
      const scheduledAtMillis = canSchedulePost && scheduledAt ? new Date(scheduledAt).getTime() : 0;
      const hasValidFutureSchedule = Number.isFinite(scheduledAtMillis) && scheduledAtMillis > createdAtMillis;
      const publishAtMillis = hasValidFutureSchedule ? scheduledAtMillis : createdAtMillis;
      const emailRequested = announcementEmailEnabled;
      const attachments = hasFirebaseConfig
        ? await uploadManyFiles(course, "announcements", postFiles, { anyoneWithLink: true, writerEmails: adminWriterEmails() })
        : await Promise.all(postFiles.map(readFileAsDataUrl));
      const announcement = {
        id: crypto.randomUUID(),
        author: user.email,
        authorName: user.displayName || user.email,
        authorPhotoURL: user.photoURL || "",
        role: admin ? "admin" : "learner",
        content,
        pinned,
        attachments,
        publishAsMaterial: admin && publishAsMaterial,
        createdAt: formatDateTime24(publishAtMillis),
        createdAtMillis: publishAtMillis,
        publishAtMillis,
        scheduledAt: hasValidFutureSchedule ? formatDateTime24(publishAtMillis) : "",
        scheduledAtMillis: hasValidFutureSchedule ? publishAtMillis : 0,
        emailRequested
      };
      const savedAnnouncement = hasFirebaseConfig
        ? await saveAnnouncementToCloud(course.id, announcement)
        : announcement;
      const shouldCreateMaterial = admin && publishAsMaterial && !hasValidFutureSchedule;
      await updateCourse((current) => ({
        ...current,
        announcements: [savedAnnouncement, ...(current.announcements || [])],
        materials: shouldCreateMaterial
          ? [createMaterialFromAnnouncement(savedAnnouncement, current), ...(current.materials || [])]
          : (current.materials || [])
      }), { sync: shouldCreateMaterial });
      setContent("");
      setFiles([]);
      setPinned(false);
      setPublishAsMaterial(false);
      setScheduledAt("");

      if (hasValidFutureSchedule) {
        setPostNotice(emailRequested
          ? `Đã hẹn giờ đăng tin lúc ${savedAnnouncement.scheduledAt}. Email sẽ gửi khi bài đăng được công bố.`
          : `Đã hẹn giờ đăng tin lúc ${savedAnnouncement.scheduledAt}.`);
      } else if (hasFirebaseConfig && emailRequested) {
        try {
          const emailResult = await notifyAnnouncementEmail(course.id, savedAnnouncement.id);
          if (emailResult.skipped && emailResult.reason === "missing_email_config") {
            setPostNotice("Đã đăng tin. Chưa gửi email vì chưa cấu hình RESEND_API_KEY và EMAIL_FROM trên Vercel.");
          } else if (emailResult.skipped && emailResult.reason === "email_disabled") {
            setPostNotice("Đã đăng tin.");
          } else if (emailResult.sentCount > 0) {
            setPostNotice(`Đã gửi email thông báo đến ${emailResult.sentCount} thành viên.`);
          } else {
            setPostNotice("Đã đăng tin. Không có thành viên khác để gửi email.");
          }
        } catch (error) {
          console.error(error);
          setPostError("Đã đăng tin nhưng không gửi được email thông báo.");
        }
      } else {
        setPostNotice(emailRequested ? "Đã đăng tin. Email chỉ gửi khi app chạy với Firebase/Vercel." : "Đã đăng tin.");
      }
    } catch (error) {
      console.error(error);
      setPostError(formatActionError(error, "Không thể đăng tin."));
    } finally {
      setPosting(false);
    }
  }

  async function sendScheduledAnnouncementEmail(item) {
    if (!item?.id || pendingScheduledEmailIdsRef.current.has(item.id)) return;
    pendingScheduledEmailIdsRef.current.add(item.id);
    const processedAtMillis = Date.now();
    try {
      const emailResult = await notifyAnnouncementEmail(course.id, item.id);
      const nextPost = {
        ...item,
        emailStatus: emailResult.skipped ? "skipped" : "sent",
        emailSentCount: Number(emailResult.sentCount || 0),
        emailSkippedReason: emailResult.skipped ? emailResult.reason || "skipped" : "",
        emailSentAtMillis: emailResult.skipped ? 0 : processedAtMillis,
        emailSkippedAtMillis: emailResult.skipped ? processedAtMillis : 0,
        emailProcessedAt: formatDateTime24(processedAtMillis)
      };
      await saveAnnouncementToCloud(course.id, nextPost);
      updateCourse((current) => ({
        ...current,
        announcements: (current.announcements || []).map((post) => post.id === item.id ? nextPost : post)
      }), { sync: false });
      if (emailResult.skipped && emailResult.reason === "missing_email_config") {
        setPostNotice("Bài đăng hẹn giờ đã được công bố. Chưa gửi email vì chưa cấu hình RESEND_API_KEY và EMAIL_FROM trên Vercel.");
      } else if (emailResult.sentCount > 0) {
        setPostNotice(`Bài đăng hẹn giờ đã được công bố và gửi email đến ${emailResult.sentCount} thành viên.`);
      }
    } catch (error) {
      console.error(error);
      setPostError("Bài đăng hẹn giờ đã được công bố nhưng chưa gửi được email thông báo.");
      pendingScheduledEmailIdsRef.current.delete(item.id);
    }
  }

  const posts = [...course.announcements]
    .filter((item) => canViewAnnouncement(item, user, admin, nowMillis))
    .sort(compareAnnouncementsForFeed);

  async function togglePostPin(item) {
    const nextPost = { ...item, pinned: !item.pinned };
    try {
      if (hasFirebaseConfig) await saveAnnouncementToCloud(course.id, nextPost);
      updateCourse((current) => ({
        ...current,
        announcements: current.announcements.map((post) => post.id === item.id ? nextPost : post)
      }), { sync: false });
    } catch (error) {
      console.error(error);
      setPostError("Không thể cập nhật ghim thông báo.");
    }
  }

  async function deletePost(item) {
    try {
      if (hasFirebaseConfig) await deleteAnnouncementFromCloud(course.id, item.id);
      updateCourse((current) => ({
        ...current,
        announcements: current.announcements.filter((post) => post.id !== item.id)
      }), { sync: false });
    } catch (error) {
      console.error(error);
      setPostError("Không thể xóa bài đăng.");
    }
  }

  async function sharePostToZalo(item) {
    const zaloGroupUrl = normalizeExternalUrl(course.info?.zaloGroupUrl);
    if (!zaloGroupUrl) {
      setPostError("Chưa có link nhóm Zalo. Vào card Thông tin lớp học để nhập link nhóm trước.");
      return;
    }
    try {
      await copyTextToClipboard(buildZaloAnnouncementMessage(course, item));
      setPostError("");
      showToast?.("Đã copy nội dung. Zalo đang mở group lớp; chỉ cần dán và bấm Gửi là xong.");
      openExternalUrl(zaloGroupUrl);
    } catch (error) {
      console.error(error);
      setPostError("Không thể copy nội dung để gửi Zalo. Vui lòng thử lại hoặc copy thủ công.");
    }
  }

  return (
    <>
      <PanelTitle
        title="Thông báo"
        action={admin && (
          <div className="panel-actions announcement-title-actions">
            <label className="check-row announcement-email-check">
              <input
                type="checkbox"
                disabled={posting}
                checked={announcementEmailEnabled}
                onChange={(event) => updateAnnouncementEmailEnabled(event.target.checked)}
              />
              Email
            </label>
            <select
              className="announcement-permission-select"
              aria-label={t("postPermission")}
              title={t("postPermission")}
              value={explicitPostPermission || postPermission}
              onChange={(event) => updatePostPermission(event.target.value)}
            >
              <option value="" disabled>{t("postPermission")}</option>
              {ANNOUNCEMENT_POST_PERMISSION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{normalizeLanguage(language) === "en" ? option.labelEn : option.label}</option>
              ))}
            </select>
          </div>
        )}
      />
      {canPost ? (
        <div
          className={`composer drop-zone ${posting ? "is-uploading" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (posting) return;
            addFiles(event.dataTransfer.files);
          }}
          onPaste={(event) => {
            if (posting) return;
            addFiles(event.clipboardData.files);
          }}
        >
          <textarea disabled={posting} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t("announcementContentPlaceholder")} />
          <div className="composer-tools">
            <div className="composer-left-tools">
              {canAttachAnnouncementFiles && (
                <label className="file-picker icon-only" title="Đính kèm file" aria-label="Đính kèm file">
                  <Paperclip size={18} />
                  <input disabled={posting} type="file" multiple accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" onChange={(event) => addFiles(event.target.files)} />
                </label>
              )}
              <button
                className={`pin-button icon-only composer-pin-button ${pinned ? "active" : ""}`}
                type="button"
                title={pinned ? "Unpin" : "Pin"}
                aria-label={pinned ? "Unpin" : "Pin"}
                disabled={posting}
                onClick={() => setPinned((current) => !current)}
              >
                {pinned ? <PinOff size={17} /> : <Pin size={17} />}
              </button>
              {admin && <label className="check-row"><input type="checkbox" disabled={posting} checked={publishAsMaterial} onChange={(event) => setPublishAsMaterial(event.target.checked)} /> {t("publishAsMaterial")}</label>}
              {canAttachAnnouncementFiles && files.length > 0 && <span>{`${files.length} file đã chọn`}</span>}
            </div>
            <div className="composer-right-tools">
              {canSchedulePost && (
                <label className="composer-schedule">
                  <span>{t("schedulePost")}</span>
                  <input
                    type="datetime-local"
                    disabled={posting}
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    aria-label={t("schedulePostAria")}
                  />
                </label>
              )}
              <div className="composer-submit">
                <ProfileAvatar user={user} label={user.displayName || user.email} small />
                <button className="primary-action compact" onClick={submitPost} disabled={posting}>
                  {posting ? <span className="button-spinner" /> : <Send size={15} />}
                  {posting ? t("postingAnnouncement") : t("postAnnouncement")}
                </button>
              </div>
            </div>
          </div>
          {canAttachAnnouncementFiles && files.length > 0 && (
            <div className="selected-file-preview" aria-label="File đã chọn">
              {files.map((file, index) => (
                <div className="selected-file-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                  <span>{file.name}</span>
                  <button type="button" title="Xóa file" aria-label={`Xóa ${file.name}`} disabled={posting} onClick={() => requestConfirm({
                    title: "Xóa file đã chọn?",
                    message: `Bạn có chắc muốn bỏ file "${file.name}" khỏi bài đăng đang soạn không?`,
                    confirmLabel: "Xóa file"
                  }, () => removeSelectedFile(index))}>
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {posting && <UploadStatus label={files.length > 0 ? "Đang upload file và đăng tin..." : "Đang đăng tin..."} />}
          {postError && <p className="error-text">{postError}</p>}
          {postNotice && <p className="success-text">{postNotice}</p>}
        </div>
      ) : (
        <div className="compact-notice">Bạn không có quyền đăng tin trong lớp này.</div>
      )}
      {!canPost && postError && <p className="error-text">{postError}</p>}
      <div className="feed">
        {posts.map((item) => {
          const gradebookPublishPost = isGradebookPublishAnnouncement(item);
          return (
            <article className={`feed-item ${item.role === "admin" ? "admin-post" : ""} ${item.pinned ? "pinned-post" : ""}`} key={item.id}>
            <div className="post-head">
              <PostAuthor post={item} currentUser={user} />
              {isAnnouncementScheduledForFuture(item, nowMillis) && (
                <span className="scheduled-post-badge">Hẹn đăng: {announcementScheduleLabel(item)}</span>
              )}
              {(admin || item.author === user.email) && (
                <div className="post-actions">
                  {admin && (
                    <button className="zalo-share-button compact icon-only" type="button" title="Gửi Zalo" aria-label="Gửi Zalo" onClick={() => sharePostToZalo(item)}>
                      <Send size={14} />
                    </button>
                  )}
                  <button className="pin-button icon-only" title={item.pinned ? "Unpin" : "Pin"} aria-label={item.pinned ? "Unpin" : "Pin"} onClick={() => togglePostPin(item)}>{item.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
                  <button className="icon-danger" title="Xóa bài đăng" aria-label="Xóa bài đăng" onClick={() => requestConfirm({
                    title: "Xóa bài đăng?",
                    message: "Bạn có chắc muốn xóa bài đăng này không?",
                    confirmLabel: "Xóa bài đăng"
                  }, () => deletePost(item))}><Trash2 size={15} /></button>
                </div>
              )}
            </div>
            <div className="announcement-content">
              <p>{announcementDisplayContent(item)}</p>
              {item.reviewerQuestionTargetKey && item.assignmentId && (
                <button className="join-action compact announcement-view-assignment" type="button" onClick={() => onOpenAssignmentReviewer?.(item)}>
                  Đặt câu hỏi
                </button>
              )}
              {!item.reviewerQuestionTargetKey && item.assignmentId && (
                <button className="join-action compact announcement-view-assignment" type="button" onClick={onOpenAssignments}>
                  Xem
                </button>
              )}
              {gradebookPublishPost && (
                <button className="join-action compact announcement-view-assignment" type="button" onClick={onOpenGrades}>
                  Xem
                </button>
              )}
            </div>
            <div className="link-list">{extractUrls(announcementDisplayContent(item)).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>)}</div>
            {item.attachments?.length > 0 && (
              <div className="attachment-grid">
                {item.attachments.map((file, index) => {
                  const previewUrl = filePreviewUrl(file);
                  const downloadUrl = fileDownloadUrl(file);
                  return (
                    <div className="attachment-item" key={`${file.fileName}-${index}`}>
                      {isImageFile(file) ? (
                        <a className="attachment-preview" href={previewUrl} target="_blank" rel="noreferrer"><img src={file.previewUrl || file.url} alt={file.fileName} /></a>
                      ) : (
                        <a className="attachment-preview" href={previewUrl} target="_blank" rel="noreferrer">{file.fileName}</a>
                      )}
                      {downloadUrl && (
                        <a className="download-icon-button" href={downloadUrl} target="_blank" rel="noreferrer" download title="Tải file" aria-label={`Tải ${file.fileName || "file"}`}>
                          <Download size={15} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </article>
          );
        })}
      </div>
    </>
  );
}

function createMaterialFromAnnouncement(announcement, course) {
  const urlFiles = extractUrls(announcement.content).map((url) => ({
    fileName: url,
    url,
    webViewLink: url,
    type: "link"
  }));
  return {
    id: `material-${announcement.id || crypto.randomUUID()}`,
    title: materialTitleFromAnnouncement(announcement.content, course.materials || []),
    files: [...(announcement.attachments || []), ...urlFiles],
    announcementId: announcement.id,
    createdAt: announcement.createdAt || formatDateTime24(),
    createdAtMillis: announcement.createdAtMillis || Date.now()
  };
}

function announcementPublishMillis(announcement) {
  return Number(announcement?.publishAtMillis || announcement?.scheduledAtMillis || announcement?.createdAtMillis || 0);
}

function isAnnouncementScheduledForFuture(announcement, nowMillis = Date.now()) {
  const scheduledAtMillis = Number(announcement?.scheduledAtMillis || 0);
  return scheduledAtMillis > nowMillis;
}

function canViewAnnouncement(announcement, user, admin, nowMillis = Date.now()) {
  if (!isAnnouncementScheduledForFuture(announcement, nowMillis)) return true;
  return admin || normalizeEmail(announcement?.author || "") === normalizeEmail(user?.email || "");
}

function compareAnnouncementsForFeed(a, b) {
  return (
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
    || announcementPublishMillis(b) - announcementPublishMillis(a)
  );
}

function announcementScheduleLabel(announcement) {
  if (announcement?.scheduledAt) return announcement.scheduledAt;
  const scheduledAtMillis = Number(announcement?.scheduledAtMillis || 0);
  return scheduledAtMillis ? formatDateTime24(scheduledAtMillis) : "";
}

function materialTitleFromAnnouncement(content, materials) {
  const firstLine = String(content || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (firstLine && !firstLine.startsWith("http")) return firstLine.slice(0, 120);
  return `Tài liệu ${(materials || []).length + 1}`;
}


function LegacyInfoCard({ admin, course, updateCourse }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const infoSignature = JSON.stringify(course.info || {});
  const [draft, setDraft] = useState(() => ({ rules: "", zaloGroupUrl: "", googleMeetUrl: "", ...course.info }));
  const fields = [["title", "Title"], ["size", t("classSize", "Sĩ số")], ["time", t("classTime", "Thời gian")], ["room", t("classroom", "Phòng học")]];
  const zaloGroupUrl = normalizeExternalUrl(course.info?.zaloGroupUrl);
  const googleMeetUrl = normalizeExternalUrl(course.info?.googleMeetUrl);
  const normalizedInfoDraft = { rules: "", zaloGroupUrl: "", googleMeetUrl: "", ...draft };
  const infoDirty = jsonSignature(normalizedInfoDraft) !== jsonSignature({ rules: "", zaloGroupUrl: "", googleMeetUrl: "", ...course.info });

  useEffect(() => {
    setDraft({ rules: "", zaloGroupUrl: "", googleMeetUrl: "", ...course.info });
  }, [course.id, infoSignature]);

  function saveInfo() {
    return updateCourse((current) => ({
      ...current,
      info: normalizedInfoDraft
    }), {
      toast: true,
      writeMembers: false,
      writeSummary: false,
      classFields: ["info"]
    });
  }

  return (
    <>
      <PanelTitle title="Thông tin lớp học" action={admin && <SaveButton className="compact" dirty={infoDirty} onClick={saveInfo} />} />
      <div className="info-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            {admin ? <input value={draft[key] || ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /> : <strong>{course.info[key]}</strong>}
          </label>
        ))}
        <label className="wide-field">
          <span>{t("zaloGroupLink", "Link nhóm Zalo")}</span>
          {admin ? (
            <input
              type="url"
              value={draft.zaloGroupUrl || ""}
              onChange={(event) => setDraft({ ...draft, zaloGroupUrl: event.target.value })}
              placeholder="https://zalo.me/g/..."
            />
          ) : zaloGroupUrl ? (
            <a className="info-link" href={zaloGroupUrl} target="_blank" rel="noreferrer">{course.info.zaloGroupUrl}</a>
          ) : (
            <p>Chưa có link nhóm Zalo.</p>
          )}
        </label>
        <label className="wide-field">
          <span>{t("googleMeetLink", "Link Google Meet")}</span>
          {admin ? (
            <input
              type="url"
              value={draft.googleMeetUrl || ""}
              onChange={(event) => setDraft({ ...draft, googleMeetUrl: event.target.value })}
              placeholder="https://meet.google.com/..."
            />
          ) : googleMeetUrl ? (
            <a className="info-link" href={googleMeetUrl} target="_blank" rel="noreferrer">{course.info.googleMeetUrl}</a>
          ) : (
            <p>Chưa có link Google Meet.</p>
          )}
        </label>
        <label className="wide-field">
          <span>{t("description", "Mô tả")}</span>
          {admin ? <textarea value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /> : <p>{course.info.description}</p>}
        </label>
        <label className="wide-field">
          <span>{t("rules", "Quy định")}</span>
          {admin ? <textarea value={draft.rules || ""} onChange={(event) => setDraft({ ...draft, rules: event.target.value })} /> : <p>{course.info.rules || "Chưa có quy định."}</p>}
        </label>
      </div>
    </>
  );
}


function InfoCard({ admin, course, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const infoSignature = JSON.stringify(course.info || {});
  const [draft, setDraft] = useState(() => normalizeClassInfo(course.info));
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [lightboxDirection, setLightboxDirection] = useState(0);
  const [captionDraft, setCaptionDraft] = useState("");
  const [galleryDragActive, setGalleryDragActive] = useState(false);
  const galleryInputRef = useRef(null);
  const lightboxDragRef = useRef(null);
  const fields = [["title", "Title"], ["size", t("classSize", "Sĩ số")], ["time", t("classTime", "Thời gian")], ["room", t("classroom", "Phòng học")]];
  const galleryImages = normalizeGalleryImages(draft);
  const savedInfo = normalizeClassInfo(course.info);
  const zaloGroupUrl = normalizeExternalUrl(course.info?.zaloGroupUrl);
  const googleMeetUrl = normalizeExternalUrl(course.info?.googleMeetUrl);
  const normalizedInfoDraft = normalizeClassInfo(draft);
  const infoDirty = jsonSignature(normalizedInfoDraft) !== jsonSignature(savedInfo);
  const activeImage = lightboxIndex >= 0 ? galleryImages[lightboxIndex] : null;
  const activeImageSrc = galleryImageSrc(activeImage);

  useEffect(() => {
    setDraft(normalizeClassInfo(course.info));
  }, [course.id, infoSignature]);

  useEffect(() => {
    if (!activeImage) return;
    setCaptionDraft(activeImage.caption || "");
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  }, [activeImage?.id]);

  useEffect(() => {
    if (!activeImage) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowRight") moveLightbox(1);
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "+" || event.key === "=") zoomLightbox(0.2);
      if (event.key === "-") zoomLightbox(-0.2);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImage, galleryImages.length, lightboxIndex, captionDraft]);

  useEffect(() => {
    if (lightboxZoom <= 1) setLightboxPan({ x: 0, y: 0 });
  }, [lightboxZoom]);

  function saveInfo() {
    return updateCourse((current) => ({
      ...current,
      info: normalizedInfoDraft
    }), {
      toast: true,
      writeMembers: false,
      writeSummary: false,
      classFields: ["info"]
    });
  }

  function updateGalleryImages(nextImages, toast = false) {
    const nextInfo = normalizeClassInfo({ ...normalizedInfoDraft, gallery: nextImages });
    setDraft(nextInfo);
    return updateCourse((current) => ({
      ...current,
      info: nextInfo
    }), {
      toast,
      writeMembers: false,
      writeSummary: false,
      classFields: ["info"],
      throwOnError: true
    });
  }

  async function addGalleryFiles(fileList) {
    if (!admin || galleryUploading) return;
    const selectedFiles = Array.from(fileList || []);
    const imageFiles = selectedFiles.filter(isImageUploadFile);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (!imageFiles.length) {
      setGalleryError("Vui lòng chọn file hình ảnh.");
      return;
    }
    setGalleryUploading(true);
    setGalleryError(imageFiles.length === selectedFiles.length ? "" : "Một số file không phải hình ảnh đã được bỏ qua.");
    try {
      const uploadedFiles = hasFirebaseConfig
        ? await uploadManyFiles(course, "class-gallery", imageFiles, { anyoneWithLink: true, writerEmails: adminWriterEmails() })
        : await Promise.all(imageFiles.map(readFileAsDataUrl));
      const createdAtMillis = Date.now();
      const nextImages = uploadedFiles.map((file, index) => ({
        id: crypto.randomUUID(),
        fileName: file.fileName || imageFiles[index]?.name || `Ảnh ${galleryImages.length + index + 1}`,
        caption: "",
        url: file.url || "",
        previewUrl: file.previewUrl || file.thumbnailLink || file.url || "",
        webViewLink: file.webViewLink || "",
        webContentLink: file.webContentLink || "",
        driveFileId: file.driveFileId || "",
        type: file.type || imageFiles[index]?.type || "",
        size: Number(file.size || imageFiles[index]?.size || 0),
        createdAtMillis: createdAtMillis + index
      }));
      await updateGalleryImages([...galleryImages, ...nextImages], "Đã thêm ảnh vào Gallery.");
      if (imageFiles.length === selectedFiles.length) setGalleryError("");
    } catch (error) {
      console.error(error);
      setGalleryError(formatActionError(error, "Không thể thêm ảnh vào Gallery."));
    } finally {
      setGalleryUploading(false);
      setGalleryDragActive(false);
    }
  }

  function saveGalleryCaption(index, caption) {
    if (!admin || !galleryImages[index]) return;
    const nextCaption = caption.trim();
    if ((galleryImages[index].caption || "") === nextCaption) return;
    const nextImages = galleryImages.map((image, imageIndex) => (
      imageIndex === index ? { ...image, caption: nextCaption } : image
    ));
    updateGalleryImages(nextImages).catch((error) => {
      console.error(error);
      setGalleryError(formatActionError(error, "Không thể lưu caption."));
    });
  }

  function deleteGalleryImage(index) {
    const image = galleryImages[index];
    if (!admin || !image) return;
    requestConfirm({
      title: "Xóa ảnh khỏi Gallery?",
      message: `Bạn có chắc muốn xóa ảnh "${image.caption || image.fileName}" không?`,
      confirmLabel: "Xóa ảnh"
    }, async () => {
      const nextImages = galleryImages.filter((_, imageIndex) => imageIndex !== index);
      await updateGalleryImages(nextImages, "Đã xóa ảnh khỏi Gallery.");
      if (nextImages.length === 0) {
        setLightboxIndex(-1);
        return;
      }
      setLightboxIndex(Math.min(index, nextImages.length - 1));
    });
  }

  function openLightbox(index) {
    setLightboxDirection(0);
    setLightboxIndex(index);
  }

  function closeLightbox() {
    if (activeImage && admin) saveGalleryCaption(lightboxIndex, captionDraft);
    setLightboxIndex(-1);
  }

  function moveLightbox(delta) {
    if (galleryImages.length <= 1) return;
    if (activeImage && admin) saveGalleryCaption(lightboxIndex, captionDraft);
    setLightboxDirection(delta > 0 ? 1 : -1);
    setLightboxIndex((current) => (current + delta + galleryImages.length) % galleryImages.length);
  }

  function zoomLightbox(delta) {
    setLightboxZoom((current) => clampNumber(Number((current + delta).toFixed(2)), 1, 4));
  }

  function handleLightboxPointerDown(event) {
    if (event.button && event.button !== 0) return;
    lightboxDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      pan: lightboxPan,
      mode: lightboxZoom > 1 ? "pan" : "swipe"
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleLightboxPointerMove(event) {
    const drag = lightboxDragRef.current;
    if (!drag || drag.mode !== "pan") return;
    setLightboxPan({
      x: drag.pan.x + event.clientX - drag.startX,
      y: drag.pan.y + event.clientY - drag.startY
    });
  }

  function handleLightboxPointerUp(event) {
    const drag = lightboxDragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    lightboxDragRef.current = null;
    if (drag.mode === "swipe" && Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      moveLightbox(deltaX < 0 ? 1 : -1);
    }
  }

  return (
    <>
      <PanelTitle title="Thông tin lớp học" action={admin && <SaveButton className="compact" dirty={infoDirty} onClick={saveInfo} />} />
      <div className="info-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            {admin ? <input value={draft[key] || ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /> : <strong>{course.info[key]}</strong>}
          </label>
        ))}
        <label className="wide-field">
          <span>{t("zaloGroupLink", "Link nhóm Zalo")}</span>
          {admin ? (
            <input
              type="url"
              value={draft.zaloGroupUrl || ""}
              onChange={(event) => setDraft({ ...draft, zaloGroupUrl: event.target.value })}
              placeholder="https://zalo.me/g/..."
            />
          ) : zaloGroupUrl ? (
            <a className="info-link" href={zaloGroupUrl} target="_blank" rel="noreferrer">{course.info.zaloGroupUrl}</a>
          ) : (
            <p>Chưa có link nhóm Zalo.</p>
          )}
        </label>
        <label className="wide-field">
          <span>{t("googleMeetLink", "Link Google Meet")}</span>
          {admin ? (
            <input
              type="url"
              value={draft.googleMeetUrl || ""}
              onChange={(event) => setDraft({ ...draft, googleMeetUrl: event.target.value })}
              placeholder="https://meet.google.com/..."
            />
          ) : googleMeetUrl ? (
            <a className="info-link" href={googleMeetUrl} target="_blank" rel="noreferrer">{course.info.googleMeetUrl}</a>
          ) : (
            <p>Chưa có link Google Meet.</p>
          )}
        </label>
        <label className="wide-field">
          <span>{t("description", "Mô tả")}</span>
          {admin ? <textarea value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /> : <p>{course.info.description}</p>}
        </label>
        <label className="wide-field">
          <span>{t("rules", "Quy định")}</span>
          {admin ? <textarea value={draft.rules || ""} onChange={(event) => setDraft({ ...draft, rules: event.target.value })} /> : <p>{course.info.rules || "Chưa có quy định."}</p>}
        </label>
      </div>
      <section
        className={`class-gallery-section ${galleryDragActive ? "drag-active" : ""}`}
        onDragOver={(event) => {
          if (!admin) return;
          event.preventDefault();
          setGalleryDragActive(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          setGalleryDragActive(false);
        }}
        onDrop={(event) => {
          if (!admin) return;
          event.preventDefault();
          addGalleryFiles(event.dataTransfer.files);
        }}
        onPaste={(event) => {
          if (!admin) return;
          addGalleryFiles(event.clipboardData.files);
        }}
        tabIndex={admin ? 0 : undefined}
      >
        <div className="class-gallery-head">
          <div>
            <strong>Gallery</strong>
            <small>{galleryImages.length ? `${galleryImages.length} ${t("photoCount", "ảnh")}` : t("noPhotos", "Chưa có ảnh.")}</small>
          </div>
          {admin && <span>{t("galleryUploadHint", "Browse, kéo thả hoặc Ctrl+V để thêm ảnh.")}</span>}
        </div>
        <div className="class-gallery-strip" aria-label="Gallery lớp học">
          {galleryImages.map((image, index) => (
            <button className="class-gallery-thumb" type="button" key={image.id || `${image.fileName}-${index}`} onClick={() => openLightbox(index)}>
              {galleryImageSrc(image) ? <img src={galleryImageSrc(image)} alt={image.caption || image.fileName} /> : <span>{t("noImagePreview", "Không thể xem trước")}</span>}
              <small>{image.caption || image.fileName}</small>
            </button>
          ))}
          {admin && (
            <>
              <button className="class-gallery-add" type="button" onClick={() => galleryInputRef.current?.click()} disabled={galleryUploading}>
                {galleryUploading ? <span className="button-spinner" /> : <Plus size={28} />}
                <span>{t("addPhoto", "Thêm ảnh")}</span>
              </button>
              <input
                ref={galleryInputRef}
                hidden
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => addGalleryFiles(event.target.files)}
              />
            </>
          )}
        </div>
        {galleryUploading && <UploadStatus label="Đang upload ảnh vào Gallery..." />}
        {galleryError && <p className="error-text">{galleryError}</p>}
      </section>
      {activeImage && (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) closeLightbox(); }}>
          <section className="gallery-lightbox-card">
            <header className="gallery-lightbox-toolbar">
              <div>
                <strong>{activeImage.caption || activeImage.fileName}</strong>
                <small>{lightboxIndex + 1}/{galleryImages.length}</small>
              </div>
              <div className="gallery-lightbox-actions">
                <button className="secondary-action compact icon-only" type="button" title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => zoomLightbox(-0.2)}>
                  <ZoomOut size={17} />
                </button>
                <button className="secondary-action compact icon-only" type="button" title="Phóng to" aria-label="Phóng to" onClick={() => zoomLightbox(0.2)}>
                  <ZoomIn size={17} />
                </button>
                <a className="secondary-action compact icon-only" href={galleryImageDownloadUrl(activeImage)} target="_blank" rel="noreferrer" download title="Download" aria-label="Download">
                  <Download size={17} />
                </a>
                {admin && (
                  <button className="icon-danger" type="button" title="Delete" aria-label="Delete" onClick={() => deleteGalleryImage(lightboxIndex)}>
                    <Trash2 size={17} />
                  </button>
                )}
                <button className="secondary-action compact icon-only" type="button" title="Đóng" aria-label="Đóng" onClick={closeLightbox}>
                  <X size={18} />
                </button>
              </div>
            </header>
            <div
              className="gallery-lightbox-stage"
              onWheel={(event) => {
                event.preventDefault();
                zoomLightbox(event.deltaY < 0 ? 0.2 : -0.2);
              }}
              onPointerDown={handleLightboxPointerDown}
              onPointerMove={handleLightboxPointerMove}
              onPointerUp={handleLightboxPointerUp}
              onPointerCancel={() => { lightboxDragRef.current = null; }}
            >
              {galleryImages.length > 1 && (
                <button className="gallery-lightbox-nav prev" type="button" aria-label="Ảnh trước" onClick={() => moveLightbox(-1)}>
                  <ChevronLeft size={28} />
                </button>
              )}
              {activeImageSrc ? (
                <img
                  className={`gallery-lightbox-image ${lightboxDirection > 0 ? "slide-next" : lightboxDirection < 0 ? "slide-prev" : ""} ${lightboxZoom > 1 ? "is-zoomed" : ""}`}
                  key={activeImage.id || activeImage.fileName}
                  src={activeImageSrc}
                  alt={activeImage.caption || activeImage.fileName}
                  draggable={false}
                  style={{ transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})` }}
                  onDoubleClick={() => {
                    setLightboxZoom((current) => current > 1 ? 1 : 2);
                    setLightboxPan({ x: 0, y: 0 });
                  }}
                />
              ) : (
                <div className="gallery-lightbox-empty">Không thể xem trước ảnh này.</div>
              )}
              {galleryImages.length > 1 && (
                <button className="gallery-lightbox-nav next" type="button" aria-label="Ảnh sau" onClick={() => moveLightbox(1)}>
                  <ChevronRight size={28} />
                </button>
              )}
            </div>
            <div className="gallery-caption-row">
              <label>
                <span>Caption</span>
                {admin ? (
                  <input
                    value={captionDraft}
                    onChange={(event) => setCaptionDraft(event.target.value)}
                    onBlur={() => saveGalleryCaption(lightboxIndex, captionDraft)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    placeholder="Nhập caption..."
                  />
                ) : (
                  <p>{activeImage.caption || "Chưa có caption."}</p>
                )}
              </label>
              <span>{Math.round(lightboxZoom * 100)}%</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}


function ScheduleCard({ admin, course, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const [rows, setRows] = useState(() => normalizeScheduleRows(course.scheduleRows));
  const activeEditorRef = useRef(null);
  const scheduleSignature = JSON.stringify(course.scheduleRows || []);
  const savedScheduleRows = normalizeScheduleRows(course.scheduleRows).map(normalizeScheduleRowForSave);
  const draftScheduleRows = rows.map(normalizeScheduleRowForSave);
  const scheduleDirty = jsonSignature(draftScheduleRows) !== jsonSignature(savedScheduleRows);

  useEffect(() => {
    setRows(normalizeScheduleRows(course.scheduleRows));
  }, [scheduleSignature]);

  function updateRow(rowId, patch) {
    setRows((current) => current.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  }

  function addWeek() {
    setRows((current) => [...current, createScheduleRow(current.length)]);
  }

  function removeWeek(rowId) {
    setRows((current) => current.length <= 1 ? current : current.filter((row) => row.id !== rowId));
  }

  function saveSchedule() {
    return updateCourse((current) => ({ ...current, scheduleRows: draftScheduleRows }), {
      toast: true,
      writeMembers: false,
      writeSummary: false,
      classFields: ["scheduleRows"]
    });
  }

  function applyFormat(format) {
    const editor = activeEditorRef.current;
    if (!editor) return;
    editor.focus();
    if (format === "bold") document.execCommand("bold");
    if (format === "highlight") document.execCommand("backColor", false, "#fef08a");
    const inputEvent = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true, inputType: "formatText" })
      : new Event("input", { bubbles: true });
    editor.dispatchEvent(inputEvent);
  }

  return (
    <>
      <PanelTitle
        title="Lịch học (TKB)"
        action={admin && (
          <div className="panel-actions">
            <button className="secondary-action compact" type="button" onClick={() => applyFormat("bold")} title="In đậm"><strong>B</strong></button>
            <button className="secondary-action compact highlight-tool" type="button" onClick={() => applyFormat("highlight")} title="Highlight">A</button>
            <button className="primary-action compact" type="button" onClick={addWeek}><Plus size={15} /> {t("addWeek", "Thêm tuần")}</button>
            <SaveButton className="compact" dirty={scheduleDirty} onClick={saveSchedule} />
          </div>
        )}
      />
      <div className="schedule-table-wrap">
        <table className="data-table schedule-table">
          <colgroup>
            <col className="schedule-week-col" />
            <col className="schedule-date-col" />
            <col className="schedule-content-col" />
          </colgroup>
          <thead>
            <tr><th>{t("week", "Tuần")}</th><th>{t("date", "Ngày")}</th><th>{t("content", "Nội dung")}</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {admin ? (
                    <label className="schedule-week-input">
                      <span>{t("week", "Tuần")}</span>
                      <input
                        inputMode="numeric"
                        value={row.weekNumber}
                        onChange={(event) => updateRow(row.id, { weekNumber: event.target.value.replace(/\D/g, "") })}
                        aria-label="Số tuần"
                      />
                    </label>
                  ) : (
                    <span>{`${t("week", "Tuần")} ${row.weekNumber || ""}`}</span>
                  )}
                </td>
                <td>
                  {admin ? (
                    <input className="schedule-date-input" value={row.date || ""} onChange={(event) => updateRow(row.id, { date: event.target.value })} placeholder="Ngày" />
                  ) : (
                    row.date || ""
                  )}
                </td>
                <td>
                  <div className="schedule-content-cell">
                    <RichTextCell
                      value={row.content || ""}
                      readOnly={!admin}
                      onFocus={(element) => { activeEditorRef.current = element; }}
                      onChange={(value) => updateRow(row.id, { content: value })}
                    />
                    {admin && (
                      <button className="icon-danger schedule-delete-button" type="button" onClick={() => requestConfirm({
                        title: "Xóa tuần?",
                        message: `Bạn có chắc muốn xóa "${row.weekNumber ? `Tuần ${row.weekNumber}` : "tuần này"}" khỏi lịch học không?`,
                        confirmLabel: "Xóa tuần"
                      }, () => removeWeek(row.id))} title="Xóa tuần" aria-label="Xóa tuần">
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RichTextCell({ value, readOnly, onFocus, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || document.activeElement === ref.current) return;
    const sanitizedValue = sanitizeScheduleHtml(value || "");
    if (ref.current.innerHTML !== sanitizedValue) ref.current.innerHTML = sanitizedValue;
  }, [value]);

  return (
    <div
      ref={ref}
      className={`rich-text-cell ${readOnly ? "readonly" : ""}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      tabIndex={readOnly ? -1 : 0}
      onFocus={(event) => onFocus?.(event.currentTarget)}
      onInput={(event) => onChange?.(sanitizeScheduleHtml(event.currentTarget.innerHTML))}
      onBlur={(event) => {
        const sanitizedValue = sanitizeScheduleHtml(event.currentTarget.innerHTML);
        if (event.currentTarget.innerHTML !== sanitizedValue) event.currentTarget.innerHTML = sanitizedValue;
        onChange?.(sanitizedValue);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData?.getData("text/plain") || "";
        document.execCommand("insertText", false, text);
      }}
    />
  );
}

function normalizeScheduleRows(rows) {
  const source = Array.isArray(rows) && rows.length > 0 ? rows : defaultScheduleRows();
  return source.map((row, index) => ({
    id: row.id || `week-${index + 1}`,
    weekNumber: cleanNumberText(row.weekNumber ?? row.week ?? ""),
    date: row.date || "",
    content: sanitizeScheduleHtml(row.content || "")
  }));
}

function defaultScheduleRows() {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `week-${index + 1}`,
    weekNumber: "",
    date: "",
    content: ""
  }));
}

function createScheduleRow(index) {
  return {
    id: `week-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    weekNumber: "",
    date: "",
    content: ""
  };
}

function normalizeScheduleRowForSave(row) {
  return {
    id: row.id,
    weekNumber: cleanNumberText(row.weekNumber || ""),
    date: row.date || "",
    content: sanitizeScheduleHtml(row.content || "")
  };
}

function sanitizeScheduleHtml(html = "") {
  if (typeof document === "undefined") return String(html || "");
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "SPAN", "MARK", "BR"]);

  function cleanNode(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }
      if (!allowedTags.has(child.tagName)) {
        const fragment = document.createDocumentFragment();
        while (child.firstChild) fragment.appendChild(child.firstChild);
        child.replaceWith(fragment);
        cleanNode(node);
        return;
      }
      const backgroundColor = child.style.backgroundColor;
      [...child.attributes].forEach((attribute) => child.removeAttribute(attribute.name));
      if (child.tagName === "SPAN" || child.tagName === "MARK") {
        if (backgroundColor || child.tagName === "MARK") child.style.backgroundColor = "#fef08a";
      }
      cleanNode(child);
    });
  }

  cleanNode(container);
  return container.innerHTML;
}

function DutySchedulesCard({ admin, course, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const addPopoverRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [openScheduleId, setOpenScheduleId] = useState("");
  const scheduleListSignature = jsonSignature(course.dutySchedules || []);
  const schedules = useMemo(() => normalizeDutySchedules(course.dutySchedules), [scheduleListSignature]);
  const openSchedule = schedules.find((schedule) => schedule.id === openScheduleId) || null;

  useOutsideClick(addPopoverRef, addOpen, () => setAddOpen(false));

  useEffect(() => {
    if (openScheduleId && !schedules.some((schedule) => schedule.id === openScheduleId)) {
      setOpenScheduleId("");
    }
  }, [openScheduleId, schedules]);

  function createSchedule() {
    const title = titleDraft.trim();
    if (!title) return;
    const nextSchedule = createDutySchedule(title, schedules.length);
    updateCourse((current) => ({
      ...current,
      dutySchedules: [
        ...normalizeDutySchedules(current.dutySchedules).map(normalizeDutyScheduleForSave),
        normalizeDutyScheduleForSave(nextSchedule)
      ]
    }), {
      toast: "Đã tạo lịch trực.",
      writeMembers: false,
      writeSummary: false,
      classFields: ["dutySchedules"]
    });
    setTitleDraft("");
    setAddOpen(false);
    setOpenScheduleId(nextSchedule.id);
  }

  function deleteSchedule(schedule) {
    if (openScheduleId === schedule.id) setOpenScheduleId("");
    updateCourse((current) => ({
      ...current,
      dutySchedules: normalizeDutySchedules(current.dutySchedules)
        .filter((item) => item.id !== schedule.id)
        .map(normalizeDutyScheduleForSave)
    }), {
      toast: "Đã xóa lịch trực.",
      writeMembers: false,
      writeSummary: false,
      classFields: ["dutySchedules"]
    });
  }

  if (openSchedule) {
    return (
      <DutySchedulePage
        schedule={openSchedule}
        onBack={() => setOpenScheduleId("")}
        updateCourse={updateCourse}
      />
    );
  }

  return (
    <>
      <PanelTitle
        title="Lịch trực"
        action={admin && (
          <div className="panel-actions">
            <div className="duty-add-wrap" ref={addPopoverRef}>
              <button className="primary-action compact" type="button" onClick={() => setAddOpen((current) => !current)}>
                <Plus size={15} /> Add
              </button>
              {addOpen && (
                <div className="material-add-popover duty-add-popover">
                  <label className="duty-title-field">
                    <span>Title</span>
                    <input
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") createSchedule();
                      }}
                      placeholder="Tên lịch trực"
                      autoFocus
                    />
                  </label>
                  <button className="primary-action compact" type="button" onClick={createSchedule} disabled={!titleDraft.trim()}>
                    Create
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      />
      {schedules.length === 0 ? (
        <div className="empty-state compact-empty">Chưa có lịch trực.</div>
      ) : (
        <div className="duty-card-list">
          {schedules.map((schedule) => (
            <article className="duty-card-item" key={schedule.id}>
              <button className="duty-card-button" type="button" onClick={() => setOpenScheduleId(schedule.id)}>
                <Clock size={17} />
                <span>
                  <strong>{schedule.title}</strong>
                  <small>{schedule.rows.length} dòng</small>
                </span>
              </button>
              {admin && (
                <button className="icon-danger" type="button" onClick={() => requestConfirm({
                  title: "Xóa lịch trực?",
                  message: `Bạn có chắc muốn xóa lịch trực "${schedule.title}" không?`,
                  confirmLabel: "Xóa lịch trực"
                }, () => deleteSchedule(schedule))} aria-label={`Xóa ${schedule.title}`}>
                  <X size={15} />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function DutySchedulePage({ schedule, onBack, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const [rows, setRows] = useState(() => normalizeDutyScheduleRows(schedule.rows));
  const scheduleSignature = jsonSignature(schedule);
  const savedRows = normalizeDutyScheduleRows(schedule.rows).map(normalizeDutyScheduleRowForSave);
  const draftRows = rows.map(normalizeDutyScheduleRowForSave);
  const dutyDirty = jsonSignature(draftRows) !== jsonSignature(savedRows);

  useEffect(() => {
    setRows(normalizeDutyScheduleRows(schedule.rows));
  }, [scheduleSignature]);

  function updateRow(rowId, patch) {
    setRows((current) => current.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  }

  function insertRow(afterIndex = rows.length - 1) {
    setRows((current) => {
      const insertIndex = Math.min(Math.max(afterIndex + 1, 0), current.length);
      const nextRows = [...current];
      nextRows.splice(insertIndex, 0, createDutyScheduleRow(insertIndex));
      return nextRows;
    });
  }

  function removeRow(rowId) {
    setRows((current) => current.filter((row) => row.id !== rowId));
  }

  function saveDutySchedule() {
    const nextSchedule = normalizeDutyScheduleForSave({ ...schedule, rows: draftRows });
    return updateCourse((current) => ({
      ...current,
      dutySchedules: normalizeDutySchedules(current.dutySchedules).map((item) => (
        item.id === schedule.id ? nextSchedule : normalizeDutyScheduleForSave(item)
      ))
    }), {
      toast: true,
      writeMembers: false,
      writeSummary: false,
      classFields: ["dutySchedules"]
    });
  }

  return (
    <section className="duty-page">
      <div className="duty-page-head">
        <button className="secondary-action compact" type="button" onClick={onBack}>
          <ChevronLeft size={15} /> Back
        </button>
        <h3>{schedule.title}</h3>
        <div className="panel-actions">
          <button className="primary-action compact" type="button" onClick={() => insertRow(rows.length - 1)}>
            <Plus size={15} /> Dòng
          </button>
          <SaveButton className="compact" dirty={dutyDirty} onClick={saveDutySchedule} />
        </div>
      </div>
      <div className="duty-table-wrap">
        <table className="data-table duty-table">
          <colgroup>
            <col className="duty-stt-col" />
            <col className="duty-time-col" />
            <col className="duty-person-col" />
            <col className="duty-content-col" />
            <col className="duty-note-col" />
            <col className="duty-action-col" />
          </colgroup>
          <thead>
            <tr><th>STT</th><th>Thời gian</th><th>Người thực hiện</th><th>Nội dung</th><th>Ghi chú</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <div className="duty-empty-row">
                    <span>Chưa có dòng.</span>
                    <button className="primary-action compact" type="button" onClick={() => insertRow(-1)}>
                      <Plus size={15} /> Thêm dòng
                    </button>
                  </div>
                </td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>
                  <input
                    value={row.time}
                    onChange={(event) => updateRow(row.id, { time: event.target.value })}
                    placeholder="Thời gian"
                    aria-label={`Thời gian dòng ${index + 1}`}
                  />
                </td>
                <td>
                  <input
                    value={row.assignee}
                    onChange={(event) => updateRow(row.id, { assignee: event.target.value })}
                    placeholder="Người thực hiện"
                    aria-label={`Người thực hiện dòng ${index + 1}`}
                  />
                </td>
                <td>
                  <textarea
                    value={row.content}
                    onChange={(event) => updateRow(row.id, { content: event.target.value })}
                    placeholder="Nội dung"
                    aria-label={`Nội dung dòng ${index + 1}`}
                  />
                </td>
                <td>
                  <textarea
                    value={row.note}
                    onChange={(event) => updateRow(row.id, { note: event.target.value })}
                    placeholder="Ghi chú"
                    aria-label={`Ghi chú dòng ${index + 1}`}
                  />
                </td>
                <td>
                  <div className="duty-row-actions">
                    <button className="icon-soft" type="button" onClick={() => insertRow(index)} title="Thêm dòng bên dưới" aria-label={`Thêm dòng sau dòng ${index + 1}`}>
                      <Plus size={14} />
                    </button>
                    <button className="icon-danger" type="button" onClick={() => requestConfirm({
                      title: "Xóa dòng?",
                      message: `Bạn có chắc muốn xóa dòng ${index + 1} không?`,
                      confirmLabel: "Xóa dòng"
                    }, () => removeRow(row.id))} title="Xóa dòng" aria-label={`Xóa dòng ${index + 1}`}>
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bottom-save-row">
        <SaveButton className="compact" dirty={dutyDirty} onClick={saveDutySchedule} />
      </div>
    </section>
  );
}

function normalizeDutySchedules(schedules) {
  return (Array.isArray(schedules) ? schedules : []).map((schedule, index) => ({
    id: schedule.id || `duty-${index + 1}`,
    title: String(schedule.title || "").trim() || `Lịch trực ${index + 1}`,
    rows: normalizeDutyScheduleRows(schedule.rows)
  }));
}

function createDutySchedule(title, index = 0) {
  return {
    id: `duty-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    rows: [createDutyScheduleRow(0)]
  };
}

function normalizeDutyScheduleForSave(schedule) {
  return {
    id: schedule.id,
    title: String(schedule.title || "").trim(),
    rows: normalizeDutyScheduleRows(schedule.rows).map(normalizeDutyScheduleRowForSave)
  };
}

function normalizeDutyScheduleRows(rows) {
  return (Array.isArray(rows) ? rows : [defaultDutyScheduleRow()]).map((row, index) => ({
    id: row.id || `row-${index + 1}`,
    time: String(row.time || ""),
    assignee: String(row.assignee || row.person || row.performer || ""),
    content: String(row.content || ""),
    note: String(row.note || row.remarks || "")
  }));
}

function createDutyScheduleRow(index = 0) {
  return {
    id: `duty-row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    time: "",
    assignee: "",
    content: "",
    note: ""
  };
}

function defaultDutyScheduleRow() {
  return {
    id: "row-1",
    time: "",
    assignee: "",
    content: "",
    note: ""
  };
}

function normalizeDutyScheduleRowForSave(row) {
  return {
    id: row.id,
    time: String(row.time || ""),
    assignee: String(row.assignee || ""),
    content: String(row.content || ""),
    note: String(row.note || "")
  };
}

function GroupTopicCard({ admin, canEdit, course, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const addPopoverRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const groupCards = useMemo(() => buildGroupTopicCards(course), [course.members, course.groupTopics]);
  const topicDraftSignature = groupCards.map((group) => `${group.key}:${group.topic?.topic || ""}:${group.topic?.reportOrder || ""}:${group.topic?.intergroup || ""}`).join("|");
  const [placeholderDraft, setPlaceholderDraft] = useState({ group: "", topic: "" });
  const [draftTopics, setDraftTopics] = useState({});
  const [draftOrders, setDraftOrders] = useState({});
  const [draftIntergroups, setDraftIntergroups] = useState({});
  const sortedGroupCards = useMemo(() => [...groupCards].sort((first, second) => compareGroupTopicCards(first, second, draftOrders)), [groupCards, draftOrders]);
  const nextGroupNumber = nextNumericText(groupCards.map((group) => group.rawGroup));
  const groupTopicDirty = groupCards.some((group) => (
    String(draftTopics[group.key] || "") !== String(group.topic?.topic || "")
    || String(draftOrders[group.key] || "") !== String(group.topic?.reportOrder ?? "")
    || String(draftIntergroups[group.key] || "") !== String(group.topic?.intergroup || "")
  ));

  useOutsideClick(addPopoverRef, addOpen, () => setAddOpen(false));

  useEffect(() => {
    setDraftTopics(Object.fromEntries(groupCards.map((group) => [group.key, group.topic?.topic || ""])));
    setDraftOrders(Object.fromEntries(groupCards.map((group) => [group.key, String(group.topic?.reportOrder ?? "")])));
    setDraftIntergroups(Object.fromEntries(groupCards.map((group) => [group.key, String(group.topic?.intergroup || "")])));
  }, [topicDraftSignature]);

  function saveTopics() {
    const nextTopics = groupCards.map((group) => ({
      id: group.topic?.id || groupTopicId(group.rawGroup),
      group: group.rawGroup,
      name: group.label,
      topic: draftTopics[group.key] || "",
      reportOrder: draftOrders[group.key] || "",
      intergroup: draftIntergroups[group.key] || "",
      memberEmails: group.members.map((member) => member.email)
    }));
    return updateCourse((current) => ({ ...current, groupTopics: nextTopics }), { toast: true, writeMembers: admin, classFields: admin ? null : ["groupTopics"] });
  }

  function createGroupPlaceholder() {
    const rawGroup = cleanNumberText(placeholderDraft.group || nextGroupNumber);
    if (!rawGroup) return;
    updateCourse((current) => ({
      ...current,
      groupTopics: upsertGroupTopicPlaceholder(current.groupTopics || [], rawGroup, {
        topic: placeholderDraft.topic,
        reportOrder: "",
        intergroup: ""
      })
    }), { toast: true, writeMembers: admin, classFields: admin ? null : ["groupTopics"] });
    setPlaceholderDraft({ group: "", topic: "" });
    setAddOpen(false);
  }

  function deleteGroupPlaceholder(group) {
    if (!group.placeholder || group.members.length > 0) return;
    updateCourse((current) => {
      const rawGroup = group.rawGroup;
      const nextGroupTopics = (current.groupTopics || []).filter((topic) => groupTopicRawGroup(topic) !== rawGroup && topic.id !== groupTopicId(rawGroup));
      const nextIntergroupTopics = (current.intergroupTopics || [])
        .map((topic) => {
          const groupKeys = parseGroupKeys(topic.groupKeys || topic.groups || []).filter((key) => key !== rawGroup);
          return {
            ...topic,
            groupKeys,
            groupNames: groupKeys.map(groupTopicLabel),
            memberEmails: (topic.memberEmails || []).filter((email) => !group.members.some((member) => member.email === email))
          };
        })
        .filter((topic) => parseGroupKeys(topic.groupKeys || []).length >= 2);
      return { ...current, groupTopics: nextGroupTopics, intergroupTopics: nextIntergroupTopics };
    }, {
      toast: true,
      writeMembers: admin,
      classFields: admin ? null : ["groupTopics", "intergroupTopics"]
    });
  }

  return (
    <>
      <PanelTitle
        title="Topic Nhóm"
        action={canEdit && (
          <div className="panel-actions">
            <div className="material-add-wrap topic-add-wrap" ref={addPopoverRef}>
              <button className="topic-add-button" type="button" onClick={() => setAddOpen((current) => !current)}>
                <Plus size={14} /> New Topic
              </button>
              {addOpen && (
                <div className="material-add-popover topic-add-popover">
                  <div className="topic-add-row">
                    <label htmlFor="group-topic-title">Topic:</label>
                    <input
                      id="group-topic-title"
                      value={placeholderDraft.topic}
                      onChange={(event) => setPlaceholderDraft((current) => ({ ...current, topic: event.target.value }))}
                      placeholder="Writing..."
                    />
                  </div>
                  <div className="topic-add-row topic-add-create-row">
                    <label htmlFor="group-topic-number">Group:</label>
                    <input
                      id="group-topic-number"
                      className="topic-number-input"
                      inputMode="numeric"
                      value={placeholderDraft.group || nextGroupNumber}
                      onChange={(event) => setPlaceholderDraft((current) => ({ ...current, group: cleanNumberText(event.target.value) }))}
                    />
                    <button className="primary-action compact dark-action" type="button" onClick={createGroupPlaceholder}>Create</button>
                  </div>
                </div>
              )}
            </div>
            <SaveButton className="compact" dirty={groupTopicDirty} onClick={saveTopics} />
          </div>
        )}
      />
      {groupCards.length === 0 ? (
        <div className="empty-state compact-empty">Chưa có nhóm. Có thể tạo placeholder trước hoặc nhập số nhóm trong Card Thành viên.</div>
      ) : (
        <div className="group-topic-list">
          {sortedGroupCards.map((group) => (
            <section className="group-topic-card topic-editor-card" key={group.key}>
              <div className="group-topic-header">
                <div className="group-topic-bar">
                  <span className="group-topic-badge topic-group-title">
                    <span>{uiGroupLabel(language, group.rawGroup)}</span>
                    <span className="topic-inline-meta">
                      <span>({t("stt", "STT")}:</span>
                      {canEdit ? (
                        <input
                          aria-label={`STT báo cáo ${group.label}`}
                          inputMode="numeric"
                          value={draftOrders[group.key] || ""}
                          onChange={(event) => setDraftOrders((current) => ({ ...current, [group.key]: event.target.value.replace(/\D/g, "") }))}
                        />
                      ) : (
                        <strong>{group.topic?.reportOrder || ""}</strong>
                      )}
                      <span>)</span>
                    </span>
                  </span>
                  <label className="group-topic-compact-field topic-intergroup-field">
                    <span>{t("intergroup", "Liên nhóm")}:</span>
                    {canEdit ? (
                      <input
                        inputMode="numeric"
                        aria-label={`Liên nhóm của ${group.label}`}
                        value={draftIntergroups[group.key] || ""}
                        onChange={(event) => setDraftIntergroups((current) => ({ ...current, [group.key]: event.target.value.replace(/\D/g, "") }))}
                      />
                    ) : (
                      <strong>{group.topic?.intergroup || ""}</strong>
                    )}
                  </label>
                  {canEdit && group.placeholder && group.members.length === 0 && (
                    <button className="placeholder-delete-button" type="button" onClick={() => requestConfirm({
                      title: "Xác nhận xóa nhóm placeholder",
                      message: `Bạn có chắc muốn xóa ${group.label} không?`,
                      confirmLabel: "Xóa nhóm"
                    }, () => deleteGroupPlaceholder(group))} aria-label={`Xóa ${group.label}`}>
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="group-topic-topic-row">
                  <span>Topic:</span>
                  {canEdit ? (
                    <input
                      className="topic-line-input"
                      value={draftTopics[group.key] || ""}
                      onChange={(event) => setDraftTopics((current) => ({ ...current, [group.key]: event.target.value }))}
                      placeholder={t("enterTopicName", "Nhập tên Topic")}
                    />
                  ) : (
                    <p>{group.topic?.topic || t("noTopic", "Chưa có topic.")}</p>
                  )}
                </div>
              </div>
              <div className="group-topic-table-wrap">
                <TopicMembersTable members={group.members} course={course} language={language} />
              </div>
            </section>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="bottom-save-row">
          <SaveButton className="compact" dirty={groupTopicDirty} onClick={saveTopics} />
        </div>
      )}
    </>
  );
}

function buildGroupTopicCards(course) {
  const acceptedMembers = course.members.filter((member) => member.status === "accepted");
  const groups = groupMembersByGroup(acceptedMembers).filter((group) => group.rawGroup);
  const savedTopics = course.groupTopics || [];
  const cards = groups.map((group) => ({
    ...group,
    placeholder: false,
    topic: findSavedGroupTopic(savedTopics, group)
  }));
  const existingGroups = new Set(cards.map((group) => group.rawGroup));

  savedTopics.forEach((topic) => {
    const rawGroup = groupTopicRawGroup(topic);
    if (!rawGroup || existingGroups.has(rawGroup)) return;
    cards.push({
      key: rawGroup,
      rawGroup,
      label: topic.name || groupTopicLabel(rawGroup),
      members: [],
      placeholder: true,
      topic
    });
    existingGroups.add(rawGroup);
  });

  return cards;
}

function compareGroupTopicCards(first, second, draftOrders = {}) {
  return compareNumericText(draftOrders[first.key] ?? first.topic?.reportOrder, draftOrders[second.key] ?? second.topic?.reportOrder)
    || compareNumericText(first.rawGroup, second.rawGroup)
    || first.label.localeCompare(second.label, "vi", { numeric: true, sensitivity: "base" });
}

function findSavedGroupTopic(groupTopics, group) {
  return groupTopics.find((topic) => String(topic.group ?? "").trim() === group.rawGroup)
    || groupTopics.find((topic) => topic.id === groupTopicId(group.rawGroup))
    || groupTopics.find((topic) => String(topic.name || "").trim().toLowerCase() === group.label.toLowerCase())
    || null;
}

function groupTopicRawGroup(topic) {
  return String(topic.group ?? "").trim();
}

function groupTopicLabel(rawGroup) {
  return `Nhóm ${rawGroup}`;
}

function groupTopicId(value) {
  return `group-${String(value || "empty").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function upsertGroupTopicPlaceholder(groupTopics, rawGroup, patch = {}) {
  const id = groupTopicId(rawGroup);
  const nextTopic = {
    id,
    group: rawGroup,
    name: groupTopicLabel(rawGroup),
    topic: patch.topic || "",
    reportOrder: patch.reportOrder ?? "",
    intergroup: patch.intergroup || "",
    memberEmails: [],
    placeholder: true
  };
  const exists = (groupTopics || []).some((topic) => groupTopicRawGroup(topic) === rawGroup || topic.id === id);
  if (!exists) return [...(groupTopics || []), nextTopic];
  return (groupTopics || []).map((topic) => {
    if (groupTopicRawGroup(topic) !== rawGroup && topic.id !== id) return topic;
    return {
      ...topic,
      ...nextTopic,
      topic: patch.topic !== undefined ? patch.topic : topic.topic,
      reportOrder: patch.reportOrder !== undefined ? patch.reportOrder : (topic.reportOrder || ""),
      intergroup: patch.intergroup !== undefined ? patch.intergroup : topic.intergroup,
      memberEmails: topic.memberEmails || []
    };
  });
}

function cleanNumberText(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function nextNumericText(values) {
  const numbers = values
    .map(cleanNumberText)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
  return String((numbers.length ? Math.max(...numbers) : 0) + 1);
}

function TopicMembersTable({ members, course, language }) {
  const t = (key, fallback = "") => uiText(language, key, fallback);
  return (
    <table className="data-table topic-members-table">
      <thead><tr><th className="stt-col">{t("stt", "STT")}</th><th className="avatar-col">{t("photo", "Ảnh")}</th><th>{t("name", "Họ tên")}</th><th>{t("email", "Email")}</th><th>{t("studentId", "Mã số")}</th></tr></thead>
      <tbody>
        {members.length === 0 ? (
          <tr><td colSpan="5">{t("groupMembersEmpty", "Chưa có thành viên trong nhóm này.")}</td></tr>
        ) : members.map((member) => (
          <tr key={member.email}>
            <td>{member.order}</td>
            <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
            <td>
              <span className="member-name-line">
                <span>{member.name}</span>
                {isVirtualMember(member) && <VirtualMemberBadge />}
              </span>
            </td>
            <td>{displayMemberEmail(member)}</td>
            <td>{member.studentId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


function IntergroupTopicCard({ admin, canEdit, course, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const addPopoverRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const groupOptions = useMemo(() => buildGroupTopicCards(course), [course.members, course.groupTopics]);
  const linkCards = useMemo(() => buildIntergroupTopicCards(course, groupOptions), [course.intergroupTopics, groupOptions]);
  const linkDraftSignature = linkCards.map((link) => `${link.key}:${link.topic?.topic || ""}:${link.groupKeys.join(",")}`).join("|");
  const [placeholderDraft, setPlaceholderDraft] = useState({ intergroup: "", topic: "" });
  const [draftTopics, setDraftTopics] = useState({});
  const nextIntergroupNumber = nextNumericText(linkCards.map((link) => link.rawIntergroup));
  const intergroupTopicDirty = linkCards.some((link) => (
    String(draftTopics[link.key] || "") !== String(link.topic?.topic || "")
  ));

  useOutsideClick(addPopoverRef, addOpen, () => setAddOpen(false));

  useEffect(() => {
    setDraftTopics(Object.fromEntries(linkCards.map((link) => [link.key, link.topic?.topic || ""])));
  }, [linkDraftSignature]);

  function saveIntergroupTopics() {
    const nextTopics = linkCards
      .map((link, index) => {
        return {
          id: link.topic?.id || intergroupTopicId(link.rawIntergroup),
          intergroup: link.rawIntergroup,
          name: link.label || `Liên nhóm ${index + 1}`,
          groupKeys: link.groupKeys,
          groupNames: link.groups.map((group) => group.label),
          topic: draftTopics[link.key] || "",
          memberEmails: uniqueValues(link.groups.flatMap((group) => group.members.map((member) => member.email)))
        };
      })
      .filter((item) => item.intergroup);
    return updateCourse((current) => ({ ...current, intergroupTopics: nextTopics }), { toast: true, writeMembers: admin, classFields: admin ? null : ["intergroupTopics"] });
  }

  function createIntergroupPlaceholder() {
    const rawIntergroup = cleanNumberText(placeholderDraft.intergroup || nextIntergroupNumber);
    if (!rawIntergroup) return;

    updateCourse((current) => {
      const nextIntergroupTopic = {
        id: intergroupTopicId(rawIntergroup),
        intergroup: rawIntergroup,
        name: `Liên nhóm ${rawIntergroup}`,
        groupKeys: [],
        groupNames: [],
        topic: placeholderDraft.topic || "",
        memberEmails: [],
        placeholder: true
      };
      const existingTopics = current.intergroupTopics || [];
      const exists = existingTopics.some((topic) => String(topic.intergroup ?? "").trim() === rawIntergroup || topic.id === nextIntergroupTopic.id);
      return {
        ...current,
        intergroupTopics: exists
          ? existingTopics.map((topic) => (
            String(topic.intergroup ?? "").trim() === rawIntergroup || topic.id === nextIntergroupTopic.id
              ? {
                ...topic,
                ...nextIntergroupTopic,
                groupKeys: topic.groupKeys || topic.groups || [],
                groupNames: topic.groupNames || [],
                memberEmails: topic.memberEmails || [],
                topic: placeholderDraft.topic || topic.topic || ""
              }
              : topic
          ))
          : [...existingTopics, nextIntergroupTopic]
      };
    }, {
      toast: true,
      writeMembers: admin,
      classFields: admin ? null : ["intergroupTopics"]
    });
    setPlaceholderDraft({ intergroup: "", topic: "" });
    setAddOpen(false);
  }

  function deleteIntergroupPlaceholder(link) {
    const hasMembers = link.groups.some((group) => group.members.length > 0);
    if (hasMembers) return;
    updateCourse((current) => {
      const rawIntergroup = link.rawIntergroup;
      const groupKeys = new Set(link.groupKeys);
      return {
        ...current,
        groupTopics: (current.groupTopics || []).map((topic) => (
          groupKeys.has(groupTopicRawGroup(topic)) && String(topic.intergroup || "").trim() === rawIntergroup
            ? { ...topic, intergroup: "" }
            : topic
        )),
        intergroupTopics: (current.intergroupTopics || []).filter((topic) => (
          String(topic.intergroup ?? "").trim() !== rawIntergroup && topic.id !== intergroupTopicId(rawIntergroup)
        ))
      };
    }, {
      toast: true,
      writeMembers: admin,
      classFields: admin ? null : ["groupTopics", "intergroupTopics"]
    });
  }

  return (
    <>
      <PanelTitle
        title="Topic Liên nhóm"
        action={canEdit && (
          <div className="panel-actions">
            <div className="material-add-wrap topic-add-wrap" ref={addPopoverRef}>
              <button className="topic-add-button" type="button" onClick={() => setAddOpen((current) => !current)}>
                <Plus size={14} /> New Topic
              </button>
              {addOpen && (
                <div className="material-add-popover topic-add-popover">
                  <div className="topic-add-row">
                    <label htmlFor="intergroup-topic-title">Topic:</label>
                    <input
                      id="intergroup-topic-title"
                      value={placeholderDraft.topic}
                      onChange={(event) => setPlaceholderDraft((current) => ({ ...current, topic: event.target.value }))}
                      placeholder="Writing..."
                    />
                  </div>
                  <div className="topic-add-row topic-add-create-row">
                    <label htmlFor="intergroup-topic-number">InterGroup:</label>
                    <input
                      id="intergroup-topic-number"
                      className="topic-number-input"
                      inputMode="numeric"
                      value={placeholderDraft.intergroup || nextIntergroupNumber}
                      onChange={(event) => setPlaceholderDraft((current) => ({ ...current, intergroup: cleanNumberText(event.target.value) }))}
                    />
                    <button className="primary-action compact dark-action" type="button" onClick={createIntergroupPlaceholder}>Create</button>
                  </div>
                </div>
              )}
            </div>
            <SaveButton className="compact" dirty={intergroupTopicDirty} onClick={saveIntergroupTopics} />
          </div>
        )}
      />
      {linkCards.length === 0 ? (
        <div className="empty-state compact-empty">Chưa có liên nhóm. Có thể tạo placeholder trước hoặc nhập cùng một số ở ô Liên nhóm trong Card Topic Nhóm cho ít nhất 2 nhóm rồi bấm Save.</div>
      ) : (
        <div className="intergroup-list">
          {linkCards.map((link) => (
            <section className="group-topic-card topic-editor-card intergroup-topic-card" key={link.key}>
              <div className="group-topic-header">
                <div className="group-topic-bar intergroup-topic-bar">
                  <span className="group-topic-badge">{uiIntergroupLabel(language, link.rawIntergroup)}</span>
                  <label className="group-topic-compact-field intergroup-groups-field">
                    <strong>{link.groups.length ? `(${link.groups.map((group) => uiGroupLabel(language, group.rawGroup)).join(", ")})` : `(${t("noGroup", "Chưa có nhóm")})`}</strong>
                  </label>
                  {canEdit && link.groups.every((group) => group.members.length === 0) && (
                    <button className="placeholder-delete-button" type="button" onClick={() => requestConfirm({
                      title: "Xác nhận xóa liên nhóm placeholder",
                      message: `Bạn có chắc muốn xóa ${link.label} không?`,
                      confirmLabel: "Xóa liên nhóm"
                    }, () => deleteIntergroupPlaceholder(link))} aria-label={`Xóa ${link.label}`}>
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="group-topic-topic-row">
                  <span>Topic:</span>
                  {canEdit ? (
                    <input
                      className="topic-line-input"
                      value={draftTopics[link.key] || ""}
                      onChange={(event) => setDraftTopics((current) => ({ ...current, [link.key]: event.target.value }))}
                      placeholder={t("enterIntergroupTopicName", "Nhập tên Topic liên nhóm")}
                    />
                  ) : (
                    <p>{link.topic?.topic || t("noTopic", "Chưa có topic.")}</p>
                  )}
                </div>
              </div>
              <div className="intergroup-member-list intergroup-topic-members">
                {link.groups.map((group) => (
                  <section className="intergroup-member-section" key={group.key}>
                    <h5>{uiGroupLabel(language, group.rawGroup)}</h5>
                    <TopicMembersTable members={group.members} course={course} language={language} />
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="bottom-save-row">
          <SaveButton className="compact" dirty={intergroupTopicDirty} onClick={saveIntergroupTopics} />
        </div>
      )}
    </>
  );
}

function buildIntergroupTopicCards(course, groupOptions) {
  const savedTopics = course.intergroupTopics || [];
  const groupMap = new Map(groupOptions.map((group) => [group.key, group]));
  const groupsByIntergroup = new Map();

  function ensureIntergroupLink(rawIntergroup) {
    const key = `intergroup-${rawIntergroup}`;
    if (!groupsByIntergroup.has(key)) {
      groupsByIntergroup.set(key, {
        key,
        rawIntergroup,
        label: `Liên nhóm ${rawIntergroup}`,
        groups: [],
        topic: null
      });
    }
    return groupsByIntergroup.get(key);
  }

  savedTopics.forEach((topic) => {
    const rawIntergroup = String(topic.intergroup ?? "").trim();
    if (!rawIntergroup) return;
    ensureIntergroupLink(rawIntergroup).topic = topic;
    const groupKeys = parseGroupKeys(topic.groupKeys || topic.groups || []);
    groupKeys.forEach((rawGroup) => {
      const existingGroup = groupMap.get(rawGroup);
      if (existingGroup) {
        if (String(existingGroup.topic?.intergroup || "").trim()) return;
        groupMap.set(rawGroup, {
          ...existingGroup,
          topic: { ...(existingGroup.topic || {}), intergroup: rawIntergroup }
        });
        return;
      }
      const savedGroupTopic = findSavedGroupTopic(course.groupTopics || [], { rawGroup, label: groupTopicLabel(rawGroup) }) || {
        id: groupTopicId(rawGroup),
        group: rawGroup,
        name: groupTopicLabel(rawGroup),
        intergroup: rawIntergroup,
        memberEmails: [],
        placeholder: true
      };
      groupMap.set(rawGroup, {
        key: rawGroup,
        rawGroup,
        label: savedGroupTopic.name || groupTopicLabel(rawGroup),
        members: [],
        placeholder: true,
        topic: { ...savedGroupTopic, intergroup: savedGroupTopic.intergroup || rawIntergroup }
      });
    });
  });

  [...groupMap.values()].forEach((group) => {
    const rawIntergroup = String(group.topic?.intergroup || "").trim();
    if (!rawIntergroup) return;
    ensureIntergroupLink(rawIntergroup).groups.push(group);
  });

  return [...groupsByIntergroup.values()]
    .filter((link) => link.topic || link.groups.length >= 2)
    .sort((first, second) => compareNumericText(first.rawIntergroup, second.rawIntergroup)
      || first.label.localeCompare(second.label, "vi", { numeric: true, sensitivity: "base" }))
    .map((link) => {
      const sortedGroups = [...link.groups].sort(compareGroupTopicCards);
      const groupKeys = sortedGroups.map((group) => group.key);
      return {
        ...link,
        groups: sortedGroups,
        groupKeys,
        topic: link.topic || findSavedIntergroupTopic(savedTopics, link.rawIntergroup, groupKeys)
      };
    });
}

function findSavedIntergroupTopic(intergroupTopics, rawIntergroup, groupKeys) {
  return intergroupTopics.find((topic) => String(topic.intergroup ?? "").trim() === rawIntergroup)
    || intergroupTopics.find((topic) => topic.id === intergroupTopicId(rawIntergroup))
    || intergroupTopics.find((topic) => sameGroupPair(topic.groupKeys || topic.groups || [], groupKeys))
    || null;
}

function intergroupTopicId(value) {
  return `intergroup-${String(value || "empty").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function parseGroupKeys(value) {
  const rawItems = Array.isArray(value) ? value : String(value || "").split(/[,\s;|]+/);
  return uniqueValues(rawItems.map(cleanNumberText).filter(Boolean));
}

function sameGroupPair(first, second) {
  const normalize = (items) => [...items].sort().join("|");
  return normalize(first) === normalize(second);
}

function uniqueValues(items) {
  return [...new Set(items.filter(Boolean))];
}


function MaterialsCard({ admin, user, course, updateCourse }) {
  const addPopoverRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialFilesDraft, setMaterialFilesDraft] = useState([]);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState("");
  const [materialNotice, setMaterialNotice] = useState("");
  const materials = course.materials || [];

  useOutsideClick(addPopoverRef, addOpen, () => {
    if (!uploadingMaterial) setAddOpen(false);
  });

  function addMaterialFiles(fileList) {
    const nextFiles = Array.from(fileList || []);
    if (nextFiles.length) {
      setMaterialFilesDraft((current) => [...current, ...nextFiles]);
      setMaterialError("");
      setMaterialNotice("");
    }
  }

  function removeMaterialDraftFile(index) {
    setMaterialFilesDraft((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function resetMaterialDraft() {
    setMaterialTitle("");
    setMaterialFilesDraft([]);
  }

  async function uploadMaterial() {
    if (!admin || uploadingMaterial) return;
    if (materialFilesDraft.length === 0) {
      setMaterialError("Vui lòng chọn ít nhất 1 file.");
      return;
    }
    setUploadingMaterial(true);
    setMaterialError("");
    setMaterialNotice("");
    try {
      const attachments = hasFirebaseConfig
        ? await uploadManyFiles(course, "materials", materialFilesDraft, { anyoneWithLink: true, writerEmails: adminWriterEmails() })
        : await Promise.all(materialFilesDraft.map(readFileAsDataUrl));
      const createdAtMillis = Date.now();
      const title = materialTitle.trim() || `Tài liệu ${materials.length + 1}`;
      const announcement = {
        id: crypto.randomUUID(),
        author: user.email,
        authorName: user.displayName || user.email,
        authorPhotoURL: user.photoURL || "",
        role: "admin",
        content: title,
        pinned: false,
        attachments,
        publishAsMaterial: true,
        createdAt: formatDateTime24(createdAtMillis),
        createdAtMillis,
        publishAtMillis: createdAtMillis,
        scheduledAt: "",
        scheduledAtMillis: 0
      };
      const savedAnnouncement = hasFirebaseConfig
        ? await saveAnnouncementToCloud(course.id, announcement)
        : announcement;
      await updateCourse((current) => ({
        ...current,
        announcements: [savedAnnouncement, ...(current.announcements || [])],
        materials: [createMaterialFromAnnouncement(savedAnnouncement, current), ...(current.materials || [])]
      }), { sync: true });
      resetMaterialDraft();
      setAddOpen(false);

      if (hasFirebaseConfig && course.announcementEmailEnabled) {
        try {
          const emailResult = await notifyAnnouncementEmail(course.id, savedAnnouncement.id);
          if (emailResult.skipped && emailResult.reason === "missing_email_config") {
            setMaterialNotice("Đã upload tài liệu. Chưa gửi email vì chưa cấu hình RESEND_API_KEY và EMAIL_FROM trên Vercel.");
          } else if (emailResult.skipped && emailResult.reason === "email_disabled") {
            setMaterialNotice("Đã upload tài liệu.");
          } else if (emailResult.sentCount > 0) {
            setMaterialNotice(`Đã upload tài liệu và gửi email đến ${emailResult.sentCount} thành viên.`);
          } else {
            setMaterialNotice("Đã upload tài liệu. Không có thành viên khác để gửi email.");
          }
        } catch (error) {
          console.error(error);
          setMaterialNotice("Đã upload tài liệu nhưng không gửi được email thông báo.");
        }
      } else {
        setMaterialNotice("Đã upload tài liệu.");
      }
    } catch (error) {
      console.error(error);
      setMaterialError(formatActionError(error, "Không thể upload tài liệu."));
    } finally {
      setUploadingMaterial(false);
    }
  }

  return (
    <>
      <PanelTitle
        title="Tài liệu"
        action={admin && (
          <div className="material-add-wrap" ref={addPopoverRef}>
            <button className="material-add-button" type="button" onClick={() => setAddOpen((current) => !current)} disabled={uploadingMaterial}>
              <Plus size={14} /> Add
            </button>
            {addOpen && (
              <div className="material-add-popover">
                <input
                  value={materialTitle}
                  onChange={(event) => setMaterialTitle(event.target.value)}
                  placeholder="Title..."
                  disabled={uploadingMaterial}
                />
                <div className="material-file-picker-row">
                  <label className="material-file-picker">
                    Add File
                    <input
                      type="file"
                      multiple
                      disabled={uploadingMaterial}
                      onChange={(event) => {
                        addMaterialFiles(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <span>{materialFilesDraft.length ? `${materialFilesDraft.length} files have been selected` : "No file selected"}</span>
                </div>
                {materialFilesDraft.length > 0 && (
                  <div className="material-draft-file-list">
                    {materialFilesDraft.map((file, index) => (
                      <div className="material-draft-file-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                        <span>{file.name}</span>
                        <button
                          type="button"
                          title="Xóa file"
                          aria-label={`Xóa ${file.name}`}
                          disabled={uploadingMaterial}
                          onClick={() => removeMaterialDraftFile(index)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadingMaterial && <UploadStatus label="Đang upload tài liệu..." />}
                {materialError && <p className="error-text">{materialError}</p>}
                <div className="material-upload-actions">
                  <button className="primary-action compact dark-action" type="button" onClick={uploadMaterial} disabled={uploadingMaterial}>
                    {uploadingMaterial ? <span className="button-spinner" /> : <Upload size={14} />}
                    {uploadingMaterial ? "Uploading" : "Upload"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      />
      {materialNotice && <p className="success-text">{materialNotice}</p>}
      {materialError && !addOpen && <p className="error-text">{materialError}</p>}
      <div className="list-stack">
        {materials.length === 0 && (
          <div className="empty-state compact-empty">Chưa có tài liệu. Giảng viên có thể đăng tài liệu từ Card Tài liệu hoặc tick Tài liệu khi đăng tin trong Card Thông báo.</div>
        )}
        {materials.map((item) => (
          <MaterialItem
            admin={admin}
            user={user}
            course={course}
            item={item}
            updateCourse={updateCourse}
            onNotice={setMaterialNotice}
            onError={setMaterialError}
            key={item.id}
          />
        ))}
      </div>
    </>
  );
}

function MaterialItem({ admin, user, course, item, updateCourse, onNotice, onError }) {
  const requestConfirm = useConfirmAction();
  const uploadPopoverRef = useRef(null);
  const originalFiles = materialFiles(item);
  const originalFileSignature = jsonSignature(originalFiles);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFilesDraft, setUploadFilesDraft] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title || "");
  const [editFiles, setEditFiles] = useState(originalFiles);
  const [localError, setLocalError] = useState("");
  const editDirty = editing && (
    editTitle.trim() !== String(item.title || "").trim()
    || jsonSignature(editFiles) !== originalFileSignature
  );

  useOutsideClick(uploadPopoverRef, uploadOpen, () => {
    if (!uploading) setUploadOpen(false);
  });

  useEffect(() => {
    if (!editing) {
      setEditTitle(item.title || "");
      setEditFiles(originalFiles);
    }
  }, [item.id, item.title, originalFileSignature, editing]);

  function addUploadFiles(fileList) {
    const nextFiles = Array.from(fileList || []).filter(Boolean);
    if (!nextFiles.length) return;
    setUploadFilesDraft((current) => [...current, ...nextFiles]);
    setLocalError("");
    onError?.("");
  }

  function removeUploadDraftFile(index) {
    setUploadFilesDraft((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function startEdit() {
    setUploadOpen(false);
    setLocalError("");
    setEditTitle(item.title || "");
    setEditFiles(originalFiles);
    setEditing(true);
  }

  function cancelEdit() {
    setEditTitle(item.title || "");
    setEditFiles(originalFiles);
    setLocalError("");
    setEditing(false);
  }

  function saveEdit() {
    const nextTitle = editTitle.trim();
    if (!nextTitle) {
      setLocalError("Title không được để trống.");
      return;
    }
    const savePromise = updateCourse((current) => ({
      ...current,
      materials: (current.materials || []).map((material) => (
        material.id === item.id
          ? { ...material, title: nextTitle, files: editFiles }
          : material
      ))
    }), { toast: "Đã cập nhật tài liệu." });
    setEditing(false);
    setLocalError("");
    onNotice?.("Đã cập nhật tài liệu.");
    return savePromise;
  }

  async function uploadIntoMaterial() {
    if (!admin || uploading) return;
    if (uploadFilesDraft.length === 0) {
      setLocalError("Vui lòng chọn ít nhất 1 file.");
      return;
    }
    setUploading(true);
    setLocalError("");
    onError?.("");
    onNotice?.("");
    try {
      const attachments = hasFirebaseConfig
        ? await uploadManyFiles(course, `materials/${item.id}`, uploadFilesDraft, { anyoneWithLink: true, writerEmails: adminWriterEmails() })
        : await Promise.all(uploadFilesDraft.map(readFileAsDataUrl));
      const createdAtMillis = Date.now();
      const title = item.title || "Tài liệu";
      const announcement = {
        id: crypto.randomUUID(),
        author: user.email,
        authorName: user.displayName || user.email,
        authorPhotoURL: user.photoURL || "",
        role: "admin",
        content: `Tài liệu mới: ${title}`,
        pinned: false,
        attachments,
        publishAsMaterial: false,
        materialId: item.id,
        createdAt: formatDateTime24(createdAtMillis),
        createdAtMillis,
        publishAtMillis: createdAtMillis,
        scheduledAt: "",
        scheduledAtMillis: 0
      };
      const savedAnnouncement = hasFirebaseConfig
        ? await saveAnnouncementToCloud(course.id, announcement)
        : announcement;
      await updateCourse((current) => ({
        ...current,
        announcements: [savedAnnouncement, ...(current.announcements || [])],
        materials: (current.materials || []).map((material) => (
          material.id === item.id
            ? { ...material, files: [...materialFiles(material), ...attachments] }
            : material
        ))
      }), { sync: true });
      setUploadFilesDraft([]);
      setUploadOpen(false);

      if (hasFirebaseConfig && course.announcementEmailEnabled) {
        try {
          const emailResult = await notifyAnnouncementEmail(course.id, savedAnnouncement.id);
          if (emailResult.skipped && emailResult.reason === "missing_email_config") {
            onNotice?.("Đã thêm tài liệu. Chưa gửi email vì chưa cấu hình RESEND_API_KEY và EMAIL_FROM trên Vercel.");
          } else if (emailResult.skipped && emailResult.reason === "email_disabled") {
            onNotice?.("Đã thêm tài liệu.");
          } else if (emailResult.sentCount > 0) {
            onNotice?.(`Đã thêm tài liệu và gửi email đến ${emailResult.sentCount} thành viên.`);
          } else {
            onNotice?.("Đã thêm tài liệu. Không có thành viên khác để gửi email.");
          }
        } catch (error) {
          console.error(error);
          onNotice?.("Đã thêm tài liệu nhưng không gửi được email thông báo.");
        }
      } else {
        onNotice?.("Đã thêm tài liệu.");
      }
    } catch (error) {
      console.error(error);
      const message = formatActionError(error, "Không thể thêm tài liệu.");
      setLocalError(message);
      onError?.(message);
    } finally {
      setUploading(false);
    }
  }

  function deleteMaterial() {
    return updateCourse((current) => ({
      ...current,
      materials: (current.materials || []).filter((material) => material.id !== item.id)
    }), { toast: "Đã xóa tài liệu." });
  }

  const displayFiles = editing ? editFiles : originalFiles;

  return (
    <article className="material-card">
      <div className="card-row-head material-card-head">
        {editing ? (
          <input
            className="material-title-edit"
            value={editTitle}
            onChange={(event) => {
              setEditTitle(event.target.value);
              setLocalError("");
            }}
            placeholder="Title..."
          />
        ) : (
          <strong>{item.title}</strong>
        )}
        {admin && (
          <div className="row-actions">
            <div className="material-inline-upload-wrap" ref={uploadPopoverRef}>
              <button
                className={`icon-soft ${uploadOpen ? "active" : ""}`}
                type="button"
                title="Upload thêm tài liệu"
                aria-label={`Upload thêm tài liệu vào ${item.title || "thẻ tài liệu"}`}
                disabled={editing}
                onClick={() => {
                  setUploadOpen((current) => !current);
                  setLocalError("");
                }}
              >
                <Upload size={15} />
              </button>
              {uploadOpen && (
                <div className="material-add-popover material-inline-upload-popover">
                  <div className="material-file-picker-row">
                    <label className="material-file-picker">
                      Add File
                      <input
                        type="file"
                        multiple
                        disabled={uploading}
                        onChange={(event) => {
                          addUploadFiles(event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <span>{uploadFilesDraft.length ? `${uploadFilesDraft.length} files have been selected` : "No file selected"}</span>
                  </div>
                  {uploadFilesDraft.length > 0 && (
                    <div className="material-draft-file-list">
                      {uploadFilesDraft.map((file, index) => (
                        <div className="material-draft-file-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                          <span>{file.name}</span>
                          <button type="button" disabled={uploading} onClick={() => removeUploadDraftFile(index)} title="Xóa file">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploading && <UploadStatus label="Đang upload thêm tài liệu..." />}
                  {localError && <p className="error-text">{localError}</p>}
                  <div className="material-upload-actions">
                    <button className="primary-action compact dark-action" type="button" onClick={uploadIntoMaterial} disabled={uploading}>
                      {uploading ? <span className="button-spinner" /> : <Upload size={14} />}
                      {uploading ? "Uploading" : "Upload"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              className={`icon-soft ${editing ? "active" : ""}`}
              type="button"
              title="Edit tài liệu"
              aria-label={`Edit ${item.title || "tài liệu"}`}
              disabled={uploading}
              onClick={editing ? cancelEdit : startEdit}
            >
              <Pencil size={15} />
            </button>
            <button className="icon-danger" onClick={() => requestConfirm({
              title: "Xác nhận xóa tài liệu",
              message: `Bạn có chắc muốn xóa tài liệu "${item.title}" không?`,
              confirmLabel: "Xóa tài liệu"
            }, deleteMaterial)}><Trash2 size={15} /></button>
          </div>
        )}
      </div>
      <div className={`file-list material-file-list ${editing ? "is-editing" : ""}`}>
        {displayFiles.length === 0 && <span>Chưa có file đính kèm.</span>}
        {displayFiles.map((file, index) => {
          const previewUrl = filePreviewUrl(file) || materialFileUrl(file);
          const downloadUrl = fileDownloadUrl(file) || materialFileUrl(file);
          return (
            <div className="material-file-item" key={`${file.fileName}-${index}`}>
              <button className="material-file-preview" type="button" onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")}>
                {file.fileName || "file"}
              </button>
              <div className="material-file-actions">
                {downloadUrl && (
                  <a className="download-icon-button" href={downloadUrl} target="_blank" rel="noreferrer" download title="Tải file" aria-label={`Tải ${file.fileName || "file"}`}>
                    <Download size={15} />
                  </a>
                )}
                {editing && (
                  <button
                    className="icon-danger compact-icon"
                    type="button"
                    title="Xóa file khỏi thẻ"
                    aria-label={`Xóa ${file.fileName || "file"} khỏi thẻ`}
                    onClick={() => requestConfirm({
                      title: "Xóa file khỏi thẻ tài liệu?",
                      message: `Bạn có chắc muốn xóa "${file.fileName || "file"}" khỏi thẻ tài liệu này không?`,
                      confirmLabel: "Xóa file"
                    }, () => setEditFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)))}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {editing && (
        <div className="material-edit-actions">
          <SaveButton className="compact" dirty={editDirty} onClick={saveEdit} />
          <button className="secondary-action compact" type="button" onClick={cancelEdit}>Cancel</button>
        </div>
      )}
      {localError && !uploadOpen && <p className="error-text">{localError}</p>}
    </article>
  );
}

const EXAM_QUESTION_TYPES = [
  { value: "multipleChoice", label: "Multiple Choice" },
  { value: "shortAnswer", label: "Short Answer" },
  { value: "longAnswer", label: "Long Answer" },
  { value: "checkbox", label: "Checkbox" }
];

function ExamsCard({ user, course, examFormTemplates, setExamFormTemplates, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const [selectedExamId, setSelectedExamId] = useState(() => normalizeExams(course.exams)[0]?.id || "");
  const [draftExams, setDraftExams] = useState(() => normalizeExams(course.exams));
  const [collapsedParts, setCollapsedParts] = useState({});
  const [savingExam, setSavingExam] = useState(false);
  const [importingPartId, setImportingPartId] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [uploadingTemplateType, setUploadingTemplateType] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const templateMenuRef = useRef(null);
  const selectedExam = draftExams.find((exam) => exam.id === selectedExamId) || draftExams[0];
  const examIdsKey = draftExams.map((exam) => exam.id).join("|");
  const normalizedExamFormTemplates = normalizeExamFormTemplates(examFormTemplates);
  const supreme = isSupremeEmail(user?.email);

  useOutsideClick(templateMenuRef, templateMenuOpen, () => setTemplateMenuOpen(false));

  useEffect(() => {
    const nextExams = normalizeExams(course.exams);
    setDraftExams(nextExams);
    setSelectedExamId((current) => nextExams.some((exam) => exam.id === current) ? current : nextExams[0]?.id || "");
  }, [course.exams]);

  useEffect(() => {
    if (!selectedExam) return;
    if (draftExams.some((exam) => exam.id === selectedExamId)) return;
    setSelectedExamId(selectedExam.id);
  }, [draftExams, examIdsKey, selectedExam, selectedExamId]);

  function updateSelectedExam(patch) {
    const targetExamId = selectedExam?.id;
    if (!targetExamId) return;
    setSaveStatus("");
    setSaveError("");
    setDraftExams((currentExams) => currentExams.map((exam) => (
      exam.id === targetExamId ? { ...exam, ...patch } : exam
    )));
  }

  function updateSelectedExamParts(updater) {
    const targetExamId = selectedExam?.id;
    if (!targetExamId) return;
    setSaveStatus("");
    setSaveError("");
    setDraftExams((currentExams) => currentExams.map((exam) => (
      exam.id === targetExamId
        ? { ...exam, parts: updater(normalizeExamParts(exam.parts)) }
        : exam
    )));
  }

  function createExam() {
    const nextExam = createExamRecord(draftExams.length);
    setSaveStatus("");
    setSaveError("");
    setDraftExams((currentExams) => [...currentExams, nextExam]);
    setSelectedExamId(nextExam.id);
  }

  function renameExam(examId, title) {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setSaveStatus("");
    setSaveError("");
    setDraftExams((currentExams) => currentExams.map((exam) => (
      exam.id === examId ? { ...exam, title: nextTitle } : exam
    )));
  }

  function requestDeleteExam(exam) {
    requestConfirm({
      title: "Xóa đề thi?",
      message: `Bạn có chắc muốn xóa "${exam.title}" không?`,
      confirmLabel: "Xóa đề thi"
    }, () => {
      setSaveStatus("");
      setSaveError("");
      const nextExams = draftExams.filter((item) => item.id !== exam.id);
      const fallbackExams = nextExams.length > 0 ? nextExams : [createExamRecord(0)];
      setDraftExams(fallbackExams);
      setSelectedExamId((current) => (
        current === exam.id ? fallbackExams[0]?.id || "" : current
      ));
    });
  }

  function addPart() {
    updateSelectedExamParts((parts) => [...parts, createExamPart(parts.length)]);
  }

  function deletePart(partId) {
    const targetIndex = selectedParts.findIndex((part) => part.id === partId);
    requestConfirm({
      title: "Xóa part?",
      message: `Bạn có chắc muốn xóa ${selectedParts.length > 1 ? `Phần ${toRomanNumeral(targetIndex + 1)}` : "part này"} không?`,
      confirmLabel: "Xóa part"
    }, () => {
      updateSelectedExamParts((parts) => {
        const nextParts = parts.filter((part) => part.id !== partId);
        return nextParts.length > 0 ? nextParts : [createExamPart(0)];
      });
      setCollapsedParts((current) => {
        const nextCollapsedParts = { ...current };
        delete nextCollapsedParts[partId];
        return nextCollapsedParts;
      });
    });
  }

  function updatePartType(partId, questionType) {
    updateSelectedExamParts((parts) => parts.map((part) => (
      part.id === partId ? { ...part, questionType } : part
    )));
  }

  function updatePartPoints(partId, pointsPerQuestion) {
    updateSelectedExamParts((parts) => parts.map((part) => (
      part.id === partId ? { ...part, pointsPerQuestion } : part
    )));
  }

  function updatePartWrittenPointOptions(partId, writtenPointOptions) {
    updateSelectedExamParts((parts) => parts.map((part) => (
      part.id === partId ? { ...part, writtenPointOptions } : part
    )));
  }

  function togglePart(partId) {
    setCollapsedParts((current) => ({ ...current, [partId]: !current[partId] }));
  }

  async function importQuestions(partId, file) {
    if (!file) return;
    const targetPart = selectedParts.find((part) => part.id === partId);
    const questionType = targetPart?.questionType || "multipleChoice";
    const typeLabel = EXAM_QUESTION_TYPES.find((type) => type.value === questionType)?.label || "Multiple Choice";
    setImportingPartId(partId);
    setSaveStatus("");
    setSaveError("");
    try {
      const importedQuestions = await parseExamDocx(file, questionType);
      if (importedQuestions.length === 0) {
        setSaveError(`Không tìm thấy câu hỏi ${typeLabel} trong file Word.`);
        return;
      }
      updateSelectedExamParts((parts) => parts.map((part) => {
        if (part.id !== partId) return part;
        const currentQuestions = normalizeExamQuestions(part.questions);
        const nextQuestions = [...currentQuestions, ...importedQuestions];
        return {
          ...part,
          questionType,
          questions: nextQuestions,
          selectedQuestions: nextQuestions.length,
          totalQuestions: nextQuestions.length
        };
      }));
      setCollapsedParts((current) => ({ ...current, [partId]: false }));
      setSaveStatus(`Đã import ${importedQuestions.length} câu hỏi. Bấm Save để lưu.`);
    } catch (error) {
      console.error(error);
      setSaveError(error.message || "Không thể import file Word.");
    } finally {
      setImportingPartId("");
    }
  }

  function updateQuestion(partId, questionId, patch) {
    updateSelectedExamParts((parts) => parts.map((part) => {
      if (part.id !== partId) return part;
      const questions = normalizeExamQuestions(part.questions).map((question) => (
        question.id === questionId ? { ...question, ...patch } : question
      ));
      return { ...part, questions };
    }));
  }

  function updateAnswer(partId, questionId, answerId, patch) {
    updateSelectedExamParts((parts) => parts.map((part) => {
      if (part.id !== partId) return part;
      const questions = normalizeExamQuestions(part.questions).map((question) => {
        if (question.id !== questionId) return question;
        const answers = normalizeExamAnswers(question.answers).map((answer) => (
          answer.id === answerId ? { ...answer, ...patch } : answer
        ));
        return { ...question, answers };
      });
      return { ...part, questions };
    }));
  }

  function selectCorrectAnswer(partId, questionId, answerId, checked = true) {
    updateSelectedExamParts((parts) => parts.map((part) => {
      if (part.id !== partId) return part;
      const multipleChoice = part.questionType === "multipleChoice";
      const questions = normalizeExamQuestions(part.questions).map((question) => {
        if (question.id !== questionId) return question;
        const answers = normalizeExamAnswers(question.answers).map((answer) => {
          if (multipleChoice) return { ...answer, correct: answer.id === answerId };
          return answer.id === answerId ? { ...answer, correct: checked } : answer;
        });
        return { ...question, answers };
      });
      return { ...part, questions };
    }));
  }

  function deleteQuestion(partId, questionId) {
    requestConfirm({
      title: "Xóa câu hỏi?",
      message: "Bạn có chắc muốn xóa câu hỏi này không?",
      confirmLabel: "Xóa câu hỏi"
    }, () => {
      updateSelectedExamParts((parts) => parts.map((part) => {
        if (part.id !== partId) return part;
        const questions = normalizeExamQuestions(part.questions).filter((question) => question.id !== questionId);
        return {
          ...part,
          questions,
          selectedQuestions: questions.length,
          totalQuestions: questions.length
        };
      }));
    });
  }

  async function uploadExamTemplate(questionType, file) {
    if (!file) return;
    setUploadingTemplateType(questionType);
    setSaveStatus("");
    setSaveError("");
    try {
      if (file.size > MAX_INLINE_EXAM_TEMPLATE_BYTES) {
        throw new Error("File form DOCX quá lớn. Giữ file dưới 850KB để upload làm form mẫu.");
      }
      const dataUrl = await readBrowserFileAsDataUrl(file);
      const template = {
        questionType,
        label: formTemplateLabel(questionType),
        fileName: file.name,
        url: dataUrl,
        previewUrl: dataUrl,
        type: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        uploadedBy: user?.email || "",
        uploadedAtMillis: Date.now()
      };
      const nextTemplates = {
        ...normalizedExamFormTemplates,
        [questionType]: template
      };
      await saveExamFormTemplateToCloud(questionType, template);
      setExamFormTemplates(nextTemplates);
      setSaveStatus(`Đã upload ${template.label}.`);
    } catch (error) {
      console.error(error);
      setSaveError(error.message || "Không thể upload form DOCX.");
    } finally {
      setUploadingTemplateType("");
    }
  }

  async function saveExams() {
    setSavingExam(true);
    setSaveStatus("");
    setSaveError("");
    try {
      const examsToSave = normalizeExams(draftExams);
      const nextExamIds = new Set(examsToSave.map((exam) => exam.id));
      const deletedExamIds = normalizeExams(course.exams)
        .map((exam) => exam.id)
        .filter((examId) => !nextExamIds.has(examId));
      await updateCourse((current) => ({ ...current, exams: examsToSave }), { sync: false });
      await Promise.all([
        ...examsToSave.map((exam) => saveExamToCloud(course.id, exam)),
        ...deletedExamIds.map((examId) => deleteExamFromCloud(course.id, examId))
      ]);
      setSaveStatus("Đã lưu đề thi.");
    } catch (error) {
      console.error(error);
      setSaveError("Không thể lưu đề thi. Vui lòng thử lại.");
    } finally {
      setSavingExam(false);
    }
  }

  const selectedParts = normalizeExamParts(selectedExam?.parts);
  const examsDirty = jsonSignature(normalizeExams(draftExams)) !== jsonSignature(normalizeExams(course.exams));

  return (
    <div className="exam-builder">
      <div className="exam-panel-head">
        <h3>{uiCardLabel(language, "exams", "Đề thi (only Lecturer)")}</h3>
        <div className="exam-head-actions">
          <ExamDropdown
            exams={draftExams}
            selectedExam={selectedExam}
            onCreateExam={createExam}
            onSelectExam={setSelectedExamId}
            onRenameExam={renameExam}
            onDeleteExam={requestDeleteExam}
          />
          <SaveButton className="compact exam-save-button" dirty={examsDirty} saving={savingExam} onClick={saveExams} />
          <div className="exam-template-menu-wrap" ref={templateMenuRef}>
            <button
              className="icon-button exam-template-trigger"
              type="button"
              aria-label="Form đề thi"
              aria-haspopup="menu"
              aria-expanded={templateMenuOpen}
              onClick={() => setTemplateMenuOpen((current) => !current)}
            >
              <MoreVertical size={18} />
            </button>
            {templateMenuOpen && (
              <ExamFormTemplateMenu
                templates={normalizedExamFormTemplates}
                supreme={supreme}
                uploadingType={uploadingTemplateType}
                onDownload={downloadExamFormTemplate}
                onUpload={uploadExamTemplate}
              />
            )}
          </div>
        </div>
      </div>
      {saveStatus && <p className="success-text">{saveStatus}</p>}
      {saveError && <p className="error-text">{saveError}</p>}
      {selectedExam && (
        <div className="exam-detail">
          <div className="exam-detail-head">
            <div className="exam-detail-title-row">
              <h2>{selectedExam.title}</h2>
              <label className="exam-duration-field">
                <span>{t("duration", "Thời gian")}:</span>
                <input
                  value={selectedExam.duration || ""}
                  onChange={(event) => updateSelectedExam({ duration: event.target.value })}
                  placeholder="00:00"
                />
              </label>
            </div>
            <input
              className="exam-description-input"
              value={selectedExam.description || ""}
              onChange={(event) => updateSelectedExam({ description: event.target.value })}
              placeholder="Description..."
            />
          </div>
          <div className="exam-part-list">
            {selectedParts.map((part, index) => {
              const questions = Array.isArray(part.questions) ? part.questions : [];
              const collapsed = Boolean(collapsedParts[part.id]);
              const questionCount = questions.length || Number(part.totalQuestions || part.selectedQuestions || 0);
              const writtenAnswer = isWrittenExamQuestionType(part.questionType);
              const pointPerQuestion = writtenAnswer
                ? maxWrittenPointOption(part.writtenPointOptions)
                : Number(part.pointsPerQuestion || 0);
              const partScore = formatPointValue(pointPerQuestion * questionCount);
              return (
              <section className={`exam-part-card ${collapsed ? "collapsed" : ""}`} key={part.id}>
                <div
                  className={`exam-part-toolbar ${selectedParts.length === 1 ? "single-part" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!collapsed}
                  onClick={() => togglePart(part.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      togglePart(part.id);
                    }
                  }}
                >
                  {selectedParts.length > 1 && <strong>{t("part", "Phần")} {toRomanNumeral(index + 1)}.</strong>}
                  <select
                    className="exam-question-select"
                    value={part.questionType}
                    aria-label={normalizeLanguage(language) === "en" ? `Question type for part ${index + 1}` : `Loại câu hỏi phần ${index + 1}`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => updatePartType(part.id, event.target.value)}
                  >
                    {EXAM_QUESTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <label className={`exam-import-button ${importingPartId === part.id ? "is-loading" : ""}`} onClick={(event) => event.stopPropagation()}>
                    {importingPartId === part.id ? "Importing..." : "+ Import"}
                    <input
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      disabled={Boolean(importingPartId)}
                      onChange={(event) => {
                        importQuestions(part.id, event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {writtenAnswer ? (
                    <label className="exam-written-points-field" onClick={(event) => event.stopPropagation()} title={t("pointLevelsHint", "Các mức điểm cách nhau bằng dấu phẩy")}>
                      <input
                        value={part.writtenPointOptions || ""}
                        inputMode="text"
                        onChange={(event) => updatePartWrittenPointOptions(part.id, event.target.value)}
                        placeholder="0, 0.25, 0.5, 0.75"
                        aria-label={normalizeLanguage(language) === "en" ? `Point levels for part ${index + 1}` : `Các mức điểm phần ${index + 1}`}
                      />
                      <strong>({partScore} {t("pointsUnit", "đ")})</strong>
                    </label>
                  ) : (
                    <label className="exam-points-field" onClick={(event) => event.stopPropagation()}>
                      <input
                        value={part.pointsPerQuestion || ""}
                        inputMode="decimal"
                        onChange={(event) => updatePartPoints(part.id, event.target.value)}
                        placeholder="0"
                        aria-label={normalizeLanguage(language) === "en" ? `Points per question for part ${index + 1}` : `Điểm mỗi câu phần ${index + 1}`}
                      />
                      <span>{t("pointsPerQuestion", "đ/câu")}</span>
                      <strong>({partScore} {t("pointsUnit", "đ")})</strong>
                    </label>
                  )}
                  <span className="exam-total">{t("totalQuestions", "Tổng số")}: {questionCount} {t("questions", "câu")}</span>
                  <button
                    className="exam-part-delete"
                    type="button"
                    title={t("deletePart", "Xóa part")}
                    aria-label={normalizeLanguage(language) === "en" ? `Delete part ${index + 1}` : `Xóa part ${index + 1}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      deletePart(part.id);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                {!collapsed && (
                  <div className="exam-part-body">
                    {questions.length === 0 ? (
                      <div className="exam-empty-questions">{t("noQuestionsCreated", "Chưa có câu hỏi được tạo")}</div>
                    ) : (
                      <div className="exam-question-list">
                        {questions.map((question, questionIndex) => (
                          <ExamQuestionEditor
                            key={question.id || questionIndex}
                            part={part}
                            question={question}
                            questionIndex={questionIndex}
                            onQuestionChange={(patch) => updateQuestion(part.id, question.id, patch)}
                            onAnswerChange={(answerId, patch) => updateAnswer(part.id, question.id, answerId, patch)}
                            onCorrectChange={(answerId, checked) => selectCorrectAnswer(part.id, question.id, answerId, checked)}
                            onDelete={() => deleteQuestion(part.id, question.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
              );
            })}
            <div className="exam-add-part-row">
              <button className="exam-add-part-button" type="button" onClick={addPart}>+ {t("addPart", "Add Part")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamDropdown({ exams, selectedExam, onCreateExam, onSelectExam, onRenameExam, onDeleteExam }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const [open, setOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const dropdownRef = useRef(null);
  useOutsideClick(dropdownRef, open, () => {
    setOpen(false);
    setEditingExamId("");
  });

  function startEditing(exam) {
    setEditingExamId(exam.id);
    setTitleDraft(exam.title || "");
  }

  function commitTitle(examId) {
    onRenameExam(examId, titleDraft);
    setEditingExamId("");
  }

  return (
    <div className="exam-dropdown" ref={dropdownRef}>
      <button className="exam-select-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{selectedExam?.title || t("exam", "Đề thi")}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="exam-dropdown-menu" role="listbox">
          <button className="exam-dropdown-create" type="button" onClick={() => {
            onCreateExam();
            setOpen(false);
          }}>
            {t("createNewExam", "Tạo đề thi mới...")}
          </button>
          {exams.map((exam) => {
            const editing = editingExamId === exam.id;
            return (
              <div className={`exam-dropdown-row ${selectedExam?.id === exam.id ? "active" : ""}`} key={exam.id}>
                {editing ? (
                  <input
                    className="exam-dropdown-edit-input"
                    value={titleDraft}
                    autoFocus
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitTitle(exam.id);
                      if (event.key === "Escape") setEditingExamId("");
                    }}
                    onBlur={() => commitTitle(exam.id)}
                  />
                ) : (
                  <button className="exam-dropdown-name" type="button" onClick={() => {
                    onSelectExam(exam.id);
                    setOpen(false);
                  }}>
                    {exam.title}
                  </button>
                )}
                <div className="exam-dropdown-icons">
                  <button type="button" title={t("editExamName", "Sửa tên đề thi")} aria-label={normalizeLanguage(language) === "en" ? `Edit ${exam.title}` : `Sửa tên ${exam.title}`} onClick={(event) => {
                    event.stopPropagation();
                    startEditing(exam);
                  }}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" title={t("deleteExam", "Xóa đề thi")} aria-label={normalizeLanguage(language) === "en" ? `Delete ${exam.title}` : `Xóa ${exam.title}`} onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onDeleteExam(exam);
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExamFormTemplateMenu({ templates, supreme, uploadingType, onDownload, onUpload }) {
  return (
    <div className="exam-template-menu" role="menu">
      {EXAM_QUESTION_TYPES.map((type) => {
        const template = templates[type.value];
        return (
          <div className="exam-template-row" key={type.value} role="menuitem">
            <span>
              Form {type.label}
              {template?.fileName && <small>{template.fileName}</small>}
            </span>
            <div className="exam-template-actions">
              <button type="button" title="Tải form" aria-label={`Tải Form ${type.label}`} onClick={() => onDownload(type.value, template)}>
                <Download size={15} />
              </button>
              {supreme && (
                <label className={`exam-template-upload ${uploadingType === type.value ? "is-loading" : ""}`} title="Upload form">
                  <Upload size={15} />
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={Boolean(uploadingType)}
                    aria-label={`Upload Form ${type.label}`}
                    onChange={(event) => {
                      onUpload(type.value, event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExamQuestionEditor({ part, question, questionIndex, onQuestionChange, onAnswerChange, onCorrectChange, onDelete }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const answers = normalizeExamAnswers(question.answers);
  const multipleChoice = part.questionType === "multipleChoice";
  const writtenAnswer = part.questionType === "shortAnswer" || part.questionType === "longAnswer";
  return (
    <article className="exam-question-row">
      <div className="exam-question-head">
        <strong>{t("question", "Câu")} {questionIndex + 1}</strong>
        <button className="icon-danger" type="button" onClick={onDelete} title={t("deleteQuestion", "Xóa câu hỏi")} aria-label={normalizeLanguage(language) === "en" ? `Delete question ${questionIndex + 1}` : `Xóa câu hỏi ${questionIndex + 1}`}>
          <Trash2 size={14} />
        </button>
      </div>
      <textarea
        className="exam-question-text"
        value={question.text || ""}
        onChange={(event) => onQuestionChange({ text: event.target.value })}
        placeholder={t("enterQuestion", "Nhập câu hỏi...")}
      />
      {writtenAnswer ? (
        <div className="exam-written-answer-preview">
          {part.questionType === "shortAnswer" ? (
            <input
              className="exam-written-answer-input"
              readOnly
              placeholder={t("oneLineAnswerInput", "Ô nhập câu trả lời 1 dòng")}
              aria-label={t("oneLineAnswerInput", "Ô nhập câu trả lời 1 dòng")}
            />
          ) : (
            <textarea
              className="exam-written-answer-input long"
              readOnly
              placeholder={t("multiLineAnswerInput", "Ô nhập câu trả lời nhiều dòng")}
              aria-label={t("multiLineAnswerInput", "Ô nhập câu trả lời nhiều dòng")}
            />
          )}
        </div>
      ) : (
        <div className="exam-answer-list">
          {answers.map((answer, answerIndex) => (
            <label className={`exam-answer-row ${answer.correct ? "correct" : ""}`} key={answer.id || answerIndex}>
              <input
                type={multipleChoice ? "radio" : "checkbox"}
                name={`${question.id}-correct`}
                checked={Boolean(answer.correct)}
                onChange={(event) => onCorrectChange(answer.id, event.target.checked)}
              />
              <span>{String.fromCharCode(65 + answerIndex)}.</span>
              <input
                value={answer.text || ""}
                onChange={(event) => onAnswerChange(answer.id, { text: event.target.value })}
                placeholder={`${t("answerOption", "Đáp án")} ${answerIndex + 1}`}
              />
            </label>
          ))}
        </div>
      )}
    </article>
  );
}

function normalizeExams(exams) {
  const list = Array.isArray(exams) ? exams.filter(Boolean) : [];
  const normalized = list.map((exam, index) => ({
    ...exam,
    id: exam.id || `exam-${index + 1}`,
    title: exam.title || `Đề thi ${index + 1}`,
    description: exam.description || "",
    duration: exam.duration || "",
    parts: normalizeExamParts(exam.parts),
    createdAtMillis: exam.createdAtMillis || 0
  }));
  return normalized.length > 0 ? normalized : [defaultExamRecord()];
}

function normalizeExamParts(parts) {
  const list = Array.isArray(parts) && parts.length > 0 ? parts : [defaultExamPart()];
  return list.map((part, index) => {
    const questionType = EXAM_QUESTION_TYPES.some((type) => type.value === part.questionType)
      ? part.questionType
      : "multipleChoice";
    const questions = normalizeExamQuestions(part.questions);
    return {
      ...part,
      id: part.id || `part-${index + 1}`,
      questionType,
      questions,
      pointsPerQuestion: part.pointsPerQuestion || "",
      writtenPointOptions: normalizeWrittenPointOptions(part, questionType),
      selectedQuestions: questions.length || Number(part.selectedQuestions || 0),
      totalQuestions: questions.length || Number(part.totalQuestions || 0)
    };
  });
}

function normalizeExamQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).filter(Boolean).map((question, index) => ({
    ...question,
    id: question.id || crypto.randomUUID(),
    text: question.text || question.title || question.content || "",
    answers: normalizeExamAnswers(question.answers),
    order: Number(question.order || index + 1)
  }));
}

function normalizeExamAnswers(answers) {
  return (Array.isArray(answers) ? answers : []).filter(Boolean).map((answer, index) => ({
    ...answer,
    id: answer.id || crypto.randomUUID(),
    text: answer.text || answer.content || "",
    correct: Boolean(answer.correct),
    order: Number(answer.order || index + 1)
  }));
}

function defaultExamRecord() {
  return {
    id: "exam-1",
    title: "Đề thi 1",
    description: "",
    duration: "",
    createdAtMillis: 0,
    parts: [defaultExamPart()]
  };
}

function defaultExamPart() {
  return {
    id: "part-1",
    questionType: "multipleChoice",
    questions: [],
    pointsPerQuestion: "",
    writtenPointOptions: "",
    selectedQuestions: 0,
    totalQuestions: 0
  };
}

function createExamRecord(index) {
  return {
    id: crypto.randomUUID(),
    title: `Đề thi ${index + 1}`,
    description: "",
    duration: "",
    createdAtMillis: Date.now(),
    parts: [createExamPart(0)]
  };
}

function createExamPart(index) {
  return {
    id: crypto.randomUUID(),
    questionType: "multipleChoice",
    questions: [],
    pointsPerQuestion: "",
    writtenPointOptions: "",
    selectedQuestions: 0,
    totalQuestions: 0,
    order: index + 1
  };
}

function normalizeExamFormTemplates(templates) {
  const source = templates && typeof templates === "object" ? templates : {};
  return Object.fromEntries(EXAM_QUESTION_TYPES.map((type) => {
    const template = source[type.value] || {};
    return [type.value, {
      questionType: type.value,
      label: template.label || formTemplateLabel(type.value),
      fileName: template.fileName || "",
      url: template.url || "",
      previewUrl: template.previewUrl || "",
      type: template.type || "",
      uploadedBy: template.uploadedBy || "",
      uploadedAtMillis: Number(template.uploadedAtMillis || 0)
    }];
  }));
}

function formTemplateLabel(questionType) {
  const type = EXAM_QUESTION_TYPES.find((item) => item.value === questionType);
  return `Form ${type?.label || "Multiple Choice"}`;
}

function formatPointValue(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function isWrittenExamQuestionType(questionType) {
  return questionType === "shortAnswer" || questionType === "longAnswer";
}

function normalizeWrittenPointOptions(part, questionType) {
  const candidateKeys = ["writtenPointOptions", "scoreOptions", "gradingPoints", "pointOptions"];
  const explicitValue = candidateKeys
    .map((key) => part?.[key])
    .find((value) => value !== undefined && value !== null);
  if (explicitValue !== undefined) return String(explicitValue);
  if (!isWrittenExamQuestionType(questionType)) return "";
  const pointsPerQuestion = Number(part?.pointsPerQuestion || 0);
  return Number.isFinite(pointsPerQuestion) && pointsPerQuestion > 0
    ? `0, ${formatPointValue(pointsPerQuestion)}`
    : "";
}

function parseWrittenPointOptions(value) {
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((amount) => Number.isFinite(amount) && amount >= 0);
}

function maxWrittenPointOption(value) {
  const pointOptions = parseWrittenPointOptions(value);
  return pointOptions.length > 0 ? Math.max(...pointOptions) : 0;
}

function toRomanNumeral(value) {
  const numerals = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let remaining = Number(value || 0);
  let result = "";
  numerals.forEach(([amount, label]) => {
    while (remaining >= amount) {
      result += label;
      remaining -= amount;
    }
  });
  return result || String(value || "");
}

async function downloadExamFormTemplate(questionType, template = {}) {
  if (template?.url) {
    downloadExternalFile(template.url, template.fileName || `${slugifyFileName(formTemplateLabel(questionType))}.docx`);
    return;
  }
  const blob = await createExamFormTemplateDocx(questionType);
  downloadBlob(blob, `${slugifyFileName(formTemplateLabel(questionType))}.docx`);
}

function downloadExternalFile(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  try {
    downloadExternalFile(url, fileName);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function readBrowserFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Không thể đọc file DOCX."));
    reader.readAsDataURL(file);
  });
}

async function createExamFormTemplateDocx(questionType) {
  const module = await import("jszip");
  const JSZip = module.default || module;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder("word").file("document.xml", examFormDocumentXml(questionType));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

function examFormDocumentXml(questionType) {
  const rows = examFormParagraphs(questionType);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${rows.map((row) => docxParagraph(row.text, row.level, row.bold)).join("\n")}
    <w:sectPr />
  </w:body>
</w:document>`;
}

function examFormParagraphs(questionType) {
  if (questionType === "shortAnswer") {
    return [
      { level: 0, text: "Câu hỏi Short Answer thứ nhất?" },
      { level: 1, text: "Đáp án ngắn mẫu", bold: true },
      { level: 0, text: "Câu hỏi Short Answer thứ hai?" },
      { level: 1, text: "Đáp án ngắn mẫu", bold: true }
    ];
  }
  if (questionType === "longAnswer") {
    return [
      { level: 0, text: "Câu hỏi Long Answer thứ nhất?" },
      { level: 1, text: "Gợi ý đáp án dài / rubric mẫu", bold: true },
      { level: 0, text: "Câu hỏi Long Answer thứ hai?" },
      { level: 1, text: "Gợi ý đáp án dài / rubric mẫu", bold: true }
    ];
  }
  if (questionType === "checkbox") {
    return [
      { level: 0, text: "Câu hỏi Checkbox thứ nhất?" },
      { level: 1, text: "Đáp án 1", bold: true },
      { level: 1, text: "Đáp án 2", bold: true },
      { level: 1, text: "Đáp án 3" },
      { level: 1, text: "Đáp án 4" }
    ];
  }
  return [
    { level: 0, text: "Câu hỏi Multiple Choice thứ nhất?" },
    { level: 1, text: "Đáp án 1" },
    { level: 1, text: "Đáp án 2", bold: true },
    { level: 1, text: "Đáp án 3" },
    { level: 1, text: "Đáp án 4" }
  ];
}

function docxParagraph(text, level = 0, bold = false) {
  return `<w:p>
  <w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="1"/></w:numPr></w:pPr>
  <w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t>${escapeXml(text)}</w:t></w:r>
</w:p>`;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  }[char]));
}

function slugifyFileName(value) {
  return String(value || "exam-form")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "exam-form";
}

async function parseExamDocx(file, questionType = "multipleChoice") {
  const paragraphs = await readExamDocxParagraphs(file);
  if (questionType === "shortAnswer" || questionType === "longAnswer") {
    return parseWrittenAnswerDocxParagraphs(paragraphs, questionType);
  }
  return parseMultipleChoiceDocxParagraphs(paragraphs);
}

async function parseMultipleChoiceDocx(file) {
  return parseMultipleChoiceDocxParagraphs(await readExamDocxParagraphs(file));
}

async function readExamDocxParagraphs(file) {
  const module = await import("jszip");
  const JSZip = module.default || module;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) throw new Error("File Word không đúng định dạng DOCX.");

  const xmlText = await documentEntry.async("text");
  const documentXml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (documentXml.querySelector("parsererror")) throw new Error("Không thể đọc nội dung file Word.");

  const paragraphs = [...documentXml.getElementsByTagNameNS("*", "p")]
    .map(readDocxParagraph)
    .filter((paragraph) => paragraph.text.trim());
  return paragraphs;
}

function parseMultipleChoiceDocxParagraphs(paragraphs) {
  const usesExplicitList = paragraphs.some((paragraph) => paragraph.hasListLevel);
  const sourceParagraphs = usesExplicitList ? paragraphs.filter((paragraph) => paragraph.hasListLevel) : paragraphs;
  const questions = [];
  let currentQuestion = null;

  sourceParagraphs.forEach((paragraph) => {
    if (paragraph.level <= 0 || !currentQuestion) {
      currentQuestion = {
        id: crypto.randomUUID(),
        text: stripListPrefix(paragraph.text),
        answers: [],
        order: questions.length + 1
      };
      questions.push(currentQuestion);
      return;
    }

    currentQuestion.answers.push({
      id: crypto.randomUUID(),
      text: stripListPrefix(paragraph.text),
      correct: paragraph.bold,
      order: currentQuestion.answers.length + 1
    });
  });

  return questions
    .map((question) => ({ ...question, answers: normalizeExamAnswers(question.answers) }))
    .filter((question) => question.text.trim() && question.answers.length > 0);
}

function parseWrittenAnswerDocxParagraphs(paragraphs, questionType) {
  const usesExplicitList = paragraphs.some((paragraph) => paragraph.hasListLevel);
  const questionParagraphs = paragraphs.filter((paragraph) => (
    paragraph.level <= 0
      && paragraph.text.trim()
      && (!usesExplicitList || paragraph.hasListLevel)
  ));

  return questionParagraphs.map((paragraph, index) => ({
    id: crypto.randomUUID(),
    text: stripListPrefix(paragraph.text),
    answers: [],
    answerType: questionType,
    order: index + 1
  })).filter((question) => question.text.trim());
}

function readDocxParagraph(paragraphNode) {
  const levelNode = firstDescendant(paragraphNode, "ilvl");
  const listNode = firstDescendant(paragraphNode, "numPr");
  const levelValue = levelNode ? Number(nodeAttr(levelNode, "val")) : 0;
  const runs = [...paragraphNode.getElementsByTagNameNS("*", "r")];
  const text = runs.length
    ? runs.map((run) => [...run.getElementsByTagNameNS("*", "t")].map((textNode) => textNode.textContent || "").join("")).join("")
    : [...paragraphNode.getElementsByTagNameNS("*", "t")].map((textNode) => textNode.textContent || "").join("");
  const bold = runs.some((run) => isDocxBoldRun(run)) || Boolean(firstDescendant(paragraphNode, "b"));
  return {
    text: text.trim(),
    level: Number.isFinite(levelValue) ? levelValue : 0,
    bold,
    hasListLevel: Boolean(levelNode || listNode)
  };
}

function isDocxBoldRun(runNode) {
  const boldNode = firstDescendant(runNode, "b");
  if (!boldNode) return false;
  const value = nodeAttr(boldNode, "val");
  return value !== "false" && value !== "0";
}

function firstDescendant(node, localName) {
  return [...node.getElementsByTagNameNS("*", localName)][0] || null;
}

function nodeAttr(node, localName) {
  return node?.getAttribute(`w:${localName}`)
    || node?.getAttribute(localName)
    || node?.getAttributeNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", localName)
    || "";
}

function stripListPrefix(text = "") {
  return String(text || "")
    .replace(/^\s*(?:\d+[\).]|[A-Za-z][\).]|[ivxlcdm]+[\).])\s+/i, "")
    .trim();
}

const ASSIGNMENT_FORMATS = [
  { value: "uploadFile", label: "Upload file" },
  { value: "exam", label: "Exam" },
  { value: "reviewerDiscussion", label: "Reviewer: Discussion" },
  { value: "reviewerScore", label: "Reviewer: Score" },
  { value: "simple", label: "Simple" }
];
const ASSIGNMENT_REVIEWER_OPTIONS = [
  { value: "none", label: "Không sử dụng", labelEn: "Not used" },
  { value: "personal", label: "Cá nhân", labelEn: "Personal" },
  { value: "group", label: "Nhóm", labelEn: "Group" },
  { value: "intergroup", label: "Liên nhóm", labelEn: "Intergroup" }
];
const ASSIGNMENT_DISCUSSION_TOPIC_OPTIONS = ASSIGNMENT_REVIEWER_OPTIONS.filter((option) => option.value !== "none");
const ASSIGNMENT_ASSIGNEE_OPTIONS = [
  { value: "personal", label: "Cá nhân", labelEn: "Personal" },
  { value: "group", label: "Nhóm", labelEn: "Group" },
  { value: "intergroup", label: "Liên nhóm", labelEn: "Intergroup" },
  { value: "personalTopic", label: "Cá nhân (Topic)", labelEn: "Personal (Topic)" },
  { value: "groupTopic", label: "Nhóm (Topic)", labelEn: "Group (Topic)" },
  { value: "intergroupTopic", label: "Liên nhóm (Topic)", labelEn: "Intergroup (Topic)" }
];
const ASSIGNMENT_EXAM_SESSION_PREFIX = "classroompwa-active-exam-session:";

function AssignmentsCard({ admin, user, course, reviewerOpenRequest, onReviewerOpenConsumed, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const addPopoverRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "", type: "personal", format: "uploadFile", reviewerType: "none" });
  const [assignmentFilesDraft, setAssignmentFilesDraft] = useState([]);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [assignmentCreateError, setAssignmentCreateError] = useState("");
  const [assignmentCreateNotice, setAssignmentCreateNotice] = useState("");
  const [activeExamState, setActiveExamState] = useState(() => loadLocalAssignmentExamSession(course.id, user?.email));
  const [activeExamSubmitting, setActiveExamSubmitting] = useState(false);
  const [activeExamError, setActiveExamError] = useState("");
  const [reviewerWorkspace, setReviewerWorkspace] = useState(null);
  const [scoreStatsWorkspace, setScoreStatsWorkspace] = useState(null);
  const assignments = normalizeAssignmentRatios(course.assignments || []);
  const activeExamAssignment = activeExamState
    ? assignments.find((assignment) => assignment.id === activeExamState.assignmentId)
    : null;
  const activeExam = activeExamAssignment ? assignmentExamSnapshot(activeExamAssignment) : null;
  const reviewerWorkspaceAssignment = reviewerWorkspace
    ? assignments.find((assignment) => assignment.id === reviewerWorkspace.assignmentId)
    : null;
  const reviewerWorkspaceTarget = reviewerWorkspaceAssignment
    ? buildAssignmentReviewerTargets(course, reviewerWorkspaceAssignment).find((target) => target.key === reviewerWorkspace.targetKey)
    : null;
  const scoreStatsWorkspaceAssignment = scoreStatsWorkspace
    ? assignments.find((assignment) => assignment.id === scoreStatsWorkspace.assignmentId)
    : null;

  useOutsideClick(addPopoverRef, addOpen, () => {
    if (!creatingAssignment) setAddOpen(false);
  });

  useEffect(() => {
    if (!user?.email || !course?.id) return;
    if (activeExamState) saveLocalAssignmentExamSession(course.id, user.email, activeExamState);
    else clearLocalAssignmentExamSession(course.id, user.email);
  }, [activeExamState, course?.id, user?.email]);

  useEffect(() => {
    if (admin || activeExamState || !user?.email) return;
    const restoredAttempt = findActiveExamAttempt(assignments, user.email);
    if (restoredAttempt) {
      setActiveExamState({
        assignmentId: restoredAttempt.assignmentId,
        startedAtMillis: restoredAttempt.examStartedAtMillis || restoredAttempt.submittedAtMillis || Date.now(),
        answers: loadLocalAssignmentExamSession(course.id, user.email)?.answers || restoredAttempt.examAnswers || {},
        cloudAttemptId: restoredAttempt.id || "",
        hidden: false
      });
    }
  }, [admin, activeExamState, assignments, course.id, user?.email]);

  useEffect(() => {
    if (!activeExamState) return;
    const assignment = assignments.find((item) => item.id === activeExamState.assignmentId);
    if (!assignment || normalizeAssignmentFormat(assignment.format) !== "exam" || !assignmentExamSnapshot(assignment)) {
      setActiveExamState(null);
    }
  }, [activeExamState, assignments]);

  useEffect(() => {
    if (admin || !activeExamState || !activeExamAssignment || !user?.email) return;
    const { submission, scope } = latestSubmittedExamSubmissionForLearnerScope(course, activeExamAssignment, user.email);
    if (!submission) return;
    setActiveExamState(null);
    setActiveExamError(examScopeSubmittedMessage(scope, submission, user.email));
  }, [admin, activeExamAssignment, activeExamState, course, user?.email]);

  useEffect(() => {
    if (!reviewerWorkspace) return;
    if (!reviewerWorkspaceAssignment || !reviewerWorkspaceTarget) setReviewerWorkspace(null);
  }, [reviewerWorkspace, reviewerWorkspaceAssignment, reviewerWorkspaceTarget]);

  useEffect(() => {
    if (!scoreStatsWorkspace) return;
    if (!scoreStatsWorkspaceAssignment || !isReviewerScoreFormat(scoreStatsWorkspaceAssignment.format)) {
      setScoreStatsWorkspace(null);
    }
  }, [scoreStatsWorkspace, scoreStatsWorkspaceAssignment]);

  useEffect(() => {
    if (!reviewerOpenRequest || (reviewerOpenRequest.courseId && reviewerOpenRequest.courseId !== course.id)) return;
    const requestedAssignment = assignments.find((item) => item.id === reviewerOpenRequest.assignmentId);
    const requestedTarget = requestedAssignment
      ? buildAssignmentReviewerTargets(course, requestedAssignment).find((target) => target.key === reviewerOpenRequest.targetKey)
      : null;
    if (!requestedAssignment || !requestedTarget) return;
    setReviewerWorkspace({
      assignmentId: requestedAssignment.id,
      targetKey: requestedTarget.key
    });
    onReviewerOpenConsumed?.(reviewerOpenRequest.id);
  }, [assignments, course, course.id, onReviewerOpenConsumed, reviewerOpenRequest]);

  function addAssignmentDraftFiles(fileList) {
    const nextFiles = Array.from(fileList || []).filter(Boolean);
    if (!nextFiles.length) return;
    setAssignmentFilesDraft((current) => [...current, ...nextFiles]);
    setAssignmentCreateError("");
    setAssignmentCreateNotice("");
  }

  function removeAssignmentDraftFile(index) {
    setAssignmentFilesDraft((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  async function startAssignmentExam(assignment, exam) {
    if (!assignment || !exam) return;
    setActiveExamError("");
    const { submission, scope } = latestSubmittedExamSubmissionForLearnerScope(course, assignment, user.email);
    if (submission) {
      setActiveExamState(null);
      setActiveExamError(examScopeSubmittedMessage(scope, submission, user.email));
      return;
    }
    if (activeExamState?.assignmentId === assignment.id) {
      setActiveExamState((current) => current ? { ...current, hidden: false } : current);
      return;
    }
    const startedAtMillis = Date.now();
    const nextSession = {
      assignmentId: assignment.id,
      startedAtMillis,
      answers: {},
      hidden: false
    };
    setActiveExamState(nextSession);
    saveLocalAssignmentExamSession(course.id, user.email, nextSession);
    try {
      const submitter = assignmentSubmissionIdentity(course, { email: user.email }, user);
      const examScope = assignmentExamScope(course, assignment, user.email);
      const attemptSubmission = {
        email: submitter.email || user.email,
        name: submitter.name,
        studentId: submitter.studentId,
        submittedAt: formatDateTime24(startedAtMillis),
        submittedAtMillis: startedAtMillis,
        late: isAssignmentSubmissionLate(assignment, { submittedAtMillis: startedAtMillis }),
        fileName: `Đang làm: ${exam.title || "Đề thi"}`,
        url: "",
        type: "exam",
        status: "started",
        examId: exam.id || assignment.examId || "",
        examTitle: exam.title || "",
        examQuestionCount: examTotalQuestionCount(exam),
        examDuration: exam.duration || "",
        examStartedAtMillis: startedAtMillis,
        examAnswers: {},
        ...examScopeSubmissionFields(examScope)
      };
      const savedAttempt = await submitAssignmentToCloud(course.id, assignment.id, attemptSubmission);
      setActiveExamState((current) => (
        current?.assignmentId === assignment.id && current.startedAtMillis === startedAtMillis
          ? { ...current, cloudAttemptId: savedAttempt.id || "" }
          : current
      ));
      updateCourse((current) => ({
        ...current,
        assignments: current.assignments.map((item) => item.id === assignment.id
          ? { ...item, submissions: mergeAssignmentSubmissionList(item.submissions || [], [savedAttempt]) }
          : item)
      }), { sync: false });
    } catch (error) {
      console.error(error);
      setActiveExamError("Đã bắt đầu tính giờ trên thiết bị này, nhưng chưa ghi được trạng thái bắt đầu lên cloud. Vui lòng kiểm tra mạng trước khi tiếp tục.");
    }
  }

  function showActiveExam(assignmentId) {
    setActiveExamState((current) => (
      current?.assignmentId === assignmentId ? { ...current, hidden: false } : current
    ));
  }

  function hideActiveExam() {
    setActiveExamState((current) => current ? { ...current, hidden: true } : current);
  }

  function updateActiveExamAnswer(questionKey, value) {
    setActiveExamState((current) => {
      const durationSeconds = parseExamDurationSeconds(activeExam?.duration);
      if (!current || !activeExam || (durationSeconds && examRemainingSeconds(activeExam, current) <= 0)) return current;
      return {
        ...current,
        answers: {
          ...(current.answers || {}),
          [questionKey]: value
        }
      };
    });
  }

  function requestSubmitActiveExam() {
    if (!activeExamState || !activeExamAssignment || !activeExam) return;
    requestConfirm({
      title: "Submit bài thi?",
      message: `Bạn có chắc muốn nộp "${activeExam.title || "Đề thi"}" không? Sau khi submit, bài làm sẽ được gửi cho giảng viên.`,
      confirmLabel: "Submit",
      cancelLabel: "Cancel"
    }, () => submitActiveExam(activeExamAssignment, activeExam, activeExamState));
  }

  async function submitActiveExam(assignment, exam, session) {
    if (activeExamSubmitting || !assignment || !exam || !session) return;
    setActiveExamSubmitting(true);
    setActiveExamError("");
    try {
      const submittedAtMillis = Date.now();
      const submitter = assignmentSubmissionIdentity(course, { email: user.email }, user);
      const { submission: existingScopeSubmission, scope: examScope } = latestSubmittedExamSubmissionForLearnerScope(course, assignment, user.email);
      if (existingScopeSubmission) {
        setActiveExamState(null);
        setActiveExamError(examScopeSubmittedMessage(examScope, existingScopeSubmission, user.email));
        return;
      }
      const startedAttempt = findStartedExamSubmissionForSession(assignment, user.email, session);
      const submission = {
        id: session.cloudAttemptId || startedAttempt?.id || "",
        email: submitter.email || user.email,
        name: submitter.name,
        studentId: submitter.studentId,
        submittedAt: formatDateTime24(submittedAtMillis),
        submittedAtMillis,
        late: isAssignmentSubmissionLate(assignment, { submittedAtMillis }),
        fileName: `Bài làm: ${exam.title || "Đề thi"}`,
        url: "",
        type: "exam",
        status: "submitted",
        examId: exam.id || assignment.examId || "",
        examTitle: exam.title || "",
        examQuestionCount: examTotalQuestionCount(exam),
        examDuration: exam.duration || "",
        examStartedAtMillis: session.startedAtMillis,
        examSubmittedAtMillis: submittedAtMillis,
        examAnswers: session.answers || {},
        ...examScopeSubmissionFields(examScope)
      };
      const savedSubmission = await submitAssignmentToCloud(course.id, assignment.id, submission);
      updateCourse((current) => ({
        ...current,
        assignments: current.assignments.map((item) => item.id === assignment.id
          ? { ...item, submissions: mergeAssignmentSubmissionList(item.submissions || [], [savedSubmission]) }
          : item)
      }), { sync: false });
      setActiveExamState(null);
      setAssignmentCreateNotice("Đã submit bài thi.");
    } catch (error) {
      console.error(error);
      setActiveExamError("Không thể submit bài thi. Vui lòng thử lại hoặc báo admin kiểm tra quyền Firestore.");
    } finally {
      setActiveExamSubmitting(false);
    }
  }

  async function createAssignmentCard() {
    const title = draft.title.trim();
    if (!title || creatingAssignment) return;
    setCreatingAssignment(true);
    setAssignmentCreateError("");
    setAssignmentCreateNotice("");
    try {
      const assignmentType = normalizeGradebookType(draft.type, "personal");
      const assignmentFormat = normalizeAssignmentFormat(draft.format);
      const assignmentReviewerType = normalizeDiscussionTopicType(draft.reviewerType, assignmentFormat);
      const assignmentId = crypto.randomUUID();
      const attachments = assignmentFilesDraft.length
        ? (hasFirebaseConfig
          ? await uploadManyFiles(course, `assignments/${assignmentId}/attachments`, assignmentFilesDraft, { anyoneWithLink: true, writerEmails: adminWriterEmails() })
          : await Promise.all(assignmentFilesDraft.map(readFileAsDataUrl)))
        : [];
      const assignment = {
        id: assignmentId,
        title,
        content: draft.content.trim(),
        type: assignmentType,
        format: assignmentFormat,
        reviewerType: assignmentReviewerType,
        examId: "",
        examSnapshot: null,
        dueAt: "",
        dueAtMillis: "",
        ratio: "0",
        submissions: [],
        reviewerQuestions: [],
        scoreFormat: "free",
        limitMin: "",
        limitMax: "",
        choiceValues: [],
        peerScoreResponses: [],
        attachments
      };
      const createdAtMillis = Date.now();
      const announcement = {
        id: crypto.randomUUID(),
        author: user.email,
        authorName: user.displayName || user.email,
        authorPhotoURL: user.photoURL || "",
        role: "admin",
        content: assignmentAnnouncementContent(assignment),
        pinned: false,
        attachments,
        publishAsMaterial: false,
        createdAt: formatDateTime24(createdAtMillis),
        createdAtMillis,
        publishAtMillis: createdAtMillis,
        scheduledAt: "",
        scheduledAtMillis: 0,
        assignmentId: assignment.id
      };
      const savedAnnouncement = hasFirebaseConfig
        ? await saveAnnouncementToCloud(course.id, announcement)
        : announcement;

      await updateCourse((current) => {
        const existingAssignments = normalizeAssignmentRatios(current.assignments || []);
        return {
          ...current,
          assignments: normalizeAssignmentRatios([...existingAssignments, assignment]),
          announcements: [savedAnnouncement, ...(current.announcements || [])]
        };
      }, { sync: true });

      setDraft({ title: "", content: "", type: "personal", format: "uploadFile", reviewerType: "none" });
      setAssignmentFilesDraft([]);
      setAddOpen(false);
      if (hasFirebaseConfig && course.announcementEmailEnabled) {
        try {
          const emailResult = await notifyAnnouncementEmail(course.id, savedAnnouncement.id);
          if (emailResult.skipped && emailResult.reason === "missing_email_config") {
            setAssignmentCreateNotice("Đã tạo bài tập và thông báo. Chưa gửi email vì chưa cấu hình RESEND_API_KEY và EMAIL_FROM trên Vercel.");
          } else if (emailResult.skipped && emailResult.reason === "email_disabled") {
            setAssignmentCreateNotice("Đã tạo bài tập và thông báo.");
          } else if (emailResult.sentCount > 0) {
            setAssignmentCreateNotice(`Đã tạo bài tập và gửi email thông báo đến ${emailResult.sentCount} thành viên.`);
          } else {
            setAssignmentCreateNotice("Đã tạo bài tập và thông báo. Không có thành viên khác để gửi email.");
          }
        } catch (error) {
          console.error(error);
          setAssignmentCreateNotice("Đã tạo bài tập và thông báo nhưng không gửi được email.");
        }
      } else {
        setAssignmentCreateNotice("Đã tạo bài tập và thông báo.");
      }
    } catch (error) {
      console.error(error);
      setAssignmentCreateError(formatActionError(error, "Không thể tạo bài tập hoặc thông báo."));
    } finally {
      setCreatingAssignment(false);
    }
  }

  if (!admin && activeExamState && !activeExamState.hidden && activeExamAssignment && activeExam) {
    return (
      <AssignmentExamWorkspace
        assignment={activeExamAssignment}
        exam={activeExam}
        session={activeExamState}
        submitting={activeExamSubmitting}
        submitError={activeExamError}
        onAnswerChange={updateActiveExamAnswer}
        onHide={hideActiveExam}
        onSubmit={requestSubmitActiveExam}
      />
    );
  }

  if (reviewerWorkspaceAssignment && reviewerWorkspaceTarget) {
    return (
      <AssignmentReviewerWorkspace
        admin={admin}
        course={course}
        user={user}
        assignment={reviewerWorkspaceAssignment}
        target={reviewerWorkspaceTarget}
        updateCourse={updateCourse}
        onBack={() => setReviewerWorkspace(null)}
      />
    );
  }

  if (scoreStatsWorkspaceAssignment && isReviewerScoreFormat(scoreStatsWorkspaceAssignment.format)) {
    return (
      <AssignmentReviewerScoreStatsWorkspace
        course={course}
        assignment={scoreStatsWorkspaceAssignment}
        targets={buildAssignmentReviewerTargets(course, scoreStatsWorkspaceAssignment)}
        responses={mergePeerReviewResponseRows([], scoreStatsWorkspaceAssignment.peerScoreResponses || [])}
        onBack={() => setScoreStatsWorkspace(null)}
      />
    );
  }

  return (
    <>
      <PanelTitle
        title="Bài tập"
        action={admin && (
          <div className="material-add-wrap" ref={addPopoverRef}>
            <button className="material-add-button" type="button" onClick={() => setAddOpen((current) => !current)} disabled={creatingAssignment}>
              <Plus size={14} /> Add
            </button>
            {addOpen && (
              <div
                className="material-add-popover assignment-add-popover"
                onPaste={(event) => {
                  const pastedFiles = event.clipboardData?.files;
                  if (pastedFiles?.length) {
                    event.preventDefault();
                    addAssignmentDraftFiles(pastedFiles);
                  }
                }}
              >
                <input
                  disabled={creatingAssignment}
                  placeholder="Title..."
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
                <textarea
                  disabled={creatingAssignment}
                  placeholder="Assignment..."
                  value={draft.content}
                  onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                />
                <div
                  className={`assignment-attachment-dropzone ${creatingAssignment ? "is-disabled" : ""}`}
                  tabIndex={0}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (creatingAssignment) return;
                    addAssignmentDraftFiles(event.dataTransfer.files);
                  }}
                >
                  <label className="assignment-attachment-add" title="Thêm file hướng dẫn" aria-label="Thêm file hướng dẫn">
                    <Plus size={22} />
                    <input
                      disabled={creatingAssignment}
                      type="file"
                      multiple
                      onChange={(event) => {
                        addAssignmentDraftFiles(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <div className="assignment-attachment-copy">
                    <strong>{t("assignmentGuideFiles", "File hướng dẫn")}</strong>
                    <span>{t("assignmentGuideFilesHint", "Browse, kéo thả hoặc Ctrl+V để thêm nhiều file/hình.")}</span>
                  </div>
                </div>
                {assignmentFilesDraft.length > 0 && (
                  <div className="assignment-draft-file-list" aria-label="File hướng dẫn đã thêm">
                    {assignmentFilesDraft.map((file, index) => (
                      <div className="assignment-draft-file-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                        <div className="assignment-draft-file-info">
                          <strong>{file.name}</strong>
                          <small>{[draftFileTypeLabel(file), formatFileSize(file.size)].filter(Boolean).join(" · ")}</small>
                        </div>
                        <button
                          type="button"
                          title="Xóa file"
                          aria-label={`Xóa ${file.name}`}
                          disabled={creatingAssignment}
                          onClick={() => removeAssignmentDraftFile(index)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="assignment-create-popover-row">
                  <label className="assignment-create-field" htmlFor="assignment-type">
                    <span>Assignee:</span>
                    <select
                      id="assignment-type"
                      aria-label="Loại bài tập"
                      disabled={creatingAssignment}
                      value={draft.type}
                      onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                    >
                      {ASSIGNMENT_ASSIGNEE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>{optionLanguageLabel(option, language)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="assignment-create-field" htmlFor="assignment-format">
                    <span>Format:</span>
                    <select
                      id="assignment-format"
                      className="assignment-format-select"
                      aria-label="Format bài tập"
                      disabled={creatingAssignment}
                      value={draft.format}
                      onChange={(event) => setDraft((current) => updateAssignmentDraftFormat(current, event.target.value))}
                    >
                      {ASSIGNMENT_FORMATS.map((format) => (
                        <option value={format.value} key={format.value}>{format.label}</option>
                      ))}
                    </select>
                  </label>
                  {isReviewerTopicFormat(draft.format) && (
                    <label className="assignment-create-field" htmlFor="assignment-topic">
                      <span>Topic:</span>
                      <select
                        id="assignment-topic"
                        className="assignment-reviewer-select"
                        aria-label="Topic cho thảo luận"
                        disabled={creatingAssignment}
                        value={normalizeDiscussionTopicType(draft.reviewerType, draft.format)}
                        onChange={(event) => setDraft({ ...draft, reviewerType: event.target.value })}
                      >
                        {ASSIGNMENT_DISCUSSION_TOPIC_OPTIONS.map((option) => (
                          <option value={option.value} key={option.value}>{optionLanguageLabel(option, language)}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button className="primary-action compact dark-action" type="button" onClick={createAssignmentCard} disabled={creatingAssignment || !draft.title.trim()}>
                    {creatingAssignment ? <span className="button-spinner" /> : <FilePlus2 size={14} />}
                    {creatingAssignment ? "Creating" : "Create"}
                  </button>
                </div>
                {creatingAssignment && <UploadStatus label="Đang tạo bài tập và thông báo..." />}
                {assignmentCreateError && <p className="error-text">{assignmentCreateError}</p>}
              </div>
            )}
          </div>
        )}
      />
      {assignmentCreateNotice && <p className="success-text">{assignmentCreateNotice}</p>}
      {assignmentCreateError && !addOpen && <p className="error-text">{assignmentCreateError}</p>}
      {activeExamError && <p className="error-text">{activeExamError}</p>}
      <div className="list-stack">
        {assignments.map((assignment, index) => (
          <AssignmentItem
            key={assignment.id}
            admin={admin}
            course={course}
            assignment={assignment}
            assignmentIndex={index}
            assignmentCount={assignments.length}
            user={user}
            updateCourse={updateCourse}
            activeExamState={activeExamState}
            onStartExam={startAssignmentExam}
            onShowExam={showActiveExam}
            onOpenReviewer={(assignmentId, targetKey) => setReviewerWorkspace({ assignmentId, targetKey })}
            onOpenScoreStats={(assignmentId) => setScoreStatsWorkspace({ assignmentId })}
          />
        ))}
      </div>
    </>
  );
}

function assignmentEditDraft(assignment) {
  const format = normalizeAssignmentFormat(assignment?.format);
  return {
    title: assignment?.title || "",
    content: assignment?.content || "",
    type: normalizeGradebookType(assignment?.type, "personal"),
    format,
    reviewerType: normalizeDiscussionTopicType(assignment?.reviewerType, format),
    dueAt: assignmentDateTimeLocalValue(assignment),
    ratio: cleanRatioInput(assignment?.ratio || ""),
    attachments: Array.isArray(assignment?.attachments) ? assignment.attachments : []
  };
}

function AssignmentItem({ admin, course, assignment, assignmentIndex, assignmentCount, user, updateCourse, activeExamState, onStartExam, onShowExam, onOpenReviewer, onOpenScoreStats }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(() => assignmentEditDraft(assignment));
  const [editFilesDraft, setEditFilesDraft] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [file, setFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [startExamOpen, setStartExamOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState(null);
  const lastAssignment = assignmentIndex === assignmentCount - 1;
  const assignmentFormat = normalizeAssignmentFormat(assignment.format);
  const assignmentType = normalizeGradebookType(assignment.type, "personal");
  const assignmentBaseType = baseGradebookType(assignmentType);
  const reviewerType = normalizeDiscussionTopicType(assignment.reviewerType, assignmentFormat);
  const reviewerTargets = useMemo(
    () => buildAssignmentReviewerTargets(course, assignment),
    [assignment.id, assignment.format, assignment.reviewerType, course.members, course.personalTopics, course.groupTopics, course.intergroupTopics]
  );
  const reviewerEnabled = isReviewerDiscussionFormat(assignmentFormat) && reviewerType !== "none" && reviewerTargets.length > 0;
  const scoreReviewEnabled = isReviewerScoreFormat(assignmentFormat) && reviewerType !== "none";
  const canHaveSubmissions = assignmentFormat === "uploadFile" || assignmentFormat === "exam";
  const canControlSubmissionVisibility = canHaveSubmissions || scoreReviewEnabled;
  const submissionsPublic = assignment.submissionsPublic === true;
  const availableExams = useMemo(() => (
    Array.isArray(course.exams) && course.exams.length > 0 ? normalizeExams(course.exams) : []
  ), [course.exams]);
  const adminSelectedExam = assignmentFormat === "exam" ? findAssignmentExam(assignment, availableExams) : null;
  const learnerExam = assignmentFormat === "exam" ? assignmentExamSnapshot(assignment) : null;
  const activeExamForAssignment = activeExamState?.assignmentId === assignment.id;
  const completedSubmissions = (assignment.submissions || []).filter(isCompletedAssignmentSubmission);
  const ownCompletedSubmissions = completedSubmissions.filter((item) => normalizeEmail(item.email) === normalizeEmail(user.email));
  const learnerExamScopeStatus = assignmentFormat === "exam" && !admin
    ? latestSubmittedExamSubmissionForLearnerScope(course, assignment, user.email)
    : { scope: null, submission: null };
  const scopedExamSubmission = learnerExamScopeStatus.submission;
  const userSubmissions = canHaveSubmissions
    ? (assignmentFormat === "exam" && assignmentBaseType !== "personal" && scopedExamSubmission ? [scopedExamSubmission] : ownCompletedSubmissions)
    : [];
  const examLockMessage = assignmentFormat === "exam" && scopedExamSubmission
    ? examScopeSubmittedMessage(learnerExamScopeStatus.scope, scopedExamSubmission, user.email)
    : "";
  const visibleSubmissions = canHaveSubmissions
    ? (admin || submissionsPublic ? cleanAssignmentSubmissionList(assignment.submissions || []) : userSubmissions)
    : [];
  const assignmentEditDirty = editFilesDraft.length > 0 || jsonSignature(editDraft) !== jsonSignature(assignmentEditDraft(assignment));

  useEffect(() => {
    if (!editing) {
      setEditDraft(assignmentEditDraft(assignment));
      setEditFilesDraft([]);
    }
  }, [assignment.id, assignment.title, assignment.content, assignment.type, assignment.format, assignment.reviewerType, assignment.dueAt, assignment.dueAtMillis, assignment.ratio, assignment.attachments, editing]);

  useEffect(() => {
    if (assignmentFormat !== "exam") {
      setStartExamOpen(false);
    }
  }, [assignmentFormat]);

  async function submitAssignment() {
    if (submitting || !file) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const submittedAtMillis = Date.now();
      const uploaded = await uploadClassFile(course, `submissions/${assignment.id}/${user.email}`, file, { readerEmails: adminWriterEmails(), writerEmails: adminWriterEmails() });
      const submitter = assignmentSubmissionIdentity(course, { email: user.email }, user);
      const submission = {
        email: submitter.email || user.email,
        name: submitter.name,
        studentId: submitter.studentId,
        submittedAt: formatDateTime24(submittedAtMillis),
        submittedAtMillis,
        late: isAssignmentSubmissionLate(assignment, { submittedAtMillis }),
        ...uploaded
      };
      const savedSubmission = await submitAssignmentToCloud(course.id, assignment.id, submission);
      updateCourse((current) => ({
        ...current,
        assignments: current.assignments.map((item) => item.id === assignment.id
          ? { ...item, submissions: mergeAssignmentSubmissionList(item.submissions || [], [savedSubmission]) }
          : item)
      }), { sync: false });
      setFile(null);
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      setSubmitError(formatActionError(error, "Không thể lưu bài nộp."));
    } finally {
      setSubmitting(false);
    }
  }

  function startEditingAssignment() {
    setOpen(true);
    setShowResults(false);
    setEditDraft(assignmentEditDraft(assignment));
    setEditFilesDraft([]);
    setEditError("");
    setEditing(true);
  }

  function cancelEditingAssignment() {
    setEditDraft(assignmentEditDraft(assignment));
    setEditFilesDraft([]);
    setEditError("");
    setEditing(false);
  }

  function toggleAssignmentSubmissionVisibility() {
    if (!admin || !canControlSubmissionVisibility) return;
    const nextPublic = !submissionsPublic;
    updateCourse((current) => ({
      ...current,
      assignments: normalizeAssignmentRatios((current.assignments || []).map((item) => (
        item.id === assignment.id ? { ...item, submissionsPublic: nextPublic } : item
      )))
    }), {
      toast: nextPublic
        ? "Đã công khai danh sách bài nộp cho học viên."
        : "Đã ẩn danh sách bài nộp với học viên."
    });
  }

  function addEditDraftFiles(fileList) {
    const nextFiles = Array.from(fileList || []).filter(Boolean);
    if (!nextFiles.length) return;
    setEditFilesDraft((current) => [...current, ...nextFiles]);
    setEditError("");
  }

  function removeEditDraftFile(index) {
    setEditFilesDraft((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function removeEditAttachment(index) {
    setEditDraft((current) => ({
      ...current,
      attachments: (current.attachments || []).filter((_, fileIndex) => fileIndex !== index)
    }));
  }

  async function saveAssignmentEdit() {
    if (savingEdit) return;
    const title = editDraft.title.trim();
    if (!title) {
      setEditError("Title không được để trống.");
      return;
    }
    setSavingEdit(true);
    setEditError("");
    const nextType = normalizeGradebookType(editDraft.type, "personal");
    const nextFormat = normalizeAssignmentFormat(editDraft.format);
    const nextReviewerType = normalizeDiscussionTopicType(editDraft.reviewerType, nextFormat);
    const nextDueAt = editDraft.dueAt || "";
    const parsedDueAtMillis = nextDueAt ? new Date(nextDueAt).getTime() : 0;
    const nextDueAtMillis = Number.isFinite(parsedDueAtMillis) && parsedDueAtMillis > 0 ? parsedDueAtMillis : "";
    const nextRatio = cleanRatioInput(editDraft.ratio || "");
    try {
      const uploadedAttachments = editFilesDraft.length
        ? (hasFirebaseConfig
          ? await uploadManyFiles(course, `assignments/${assignment.id}/attachments`, editFilesDraft, { anyoneWithLink: true, writerEmails: adminWriterEmails() })
          : await Promise.all(editFilesDraft.map(readFileAsDataUrl)))
        : [];
      const nextAttachments = [...(editDraft.attachments || []), ...uploadedAttachments];
      const relatedAnnouncements = (course.announcements || []).filter((item) => item.assignmentId === assignment.id);
      if (hasFirebaseConfig && relatedAnnouncements.length > 0) {
        await Promise.all(relatedAnnouncements.map((item) => saveAnnouncementToCloud(course.id, {
          ...item,
          attachments: nextAttachments
        })));
      }
      await updateCourse((current) => ({
        ...current,
        assignments: normalizeAssignmentRatios((current.assignments || []).map((item) => {
          if (item.id !== assignment.id) return item;
          return {
            ...item,
            title,
            content: editDraft.content.trim(),
            type: nextType,
            format: nextFormat,
            reviewerType: nextReviewerType,
            dueAt: nextDueAt,
            dueAtMillis: nextDueAtMillis,
            ratio: lastAssignment ? item.ratio : nextRatio,
            examId: nextFormat === "exam" ? (item.examId || "") : "",
            examSnapshot: nextFormat === "exam" ? (item.examSnapshot || null) : null,
            attachments: nextAttachments
          };
        })),
        announcements: (current.announcements || []).map((item) => (
          item.assignmentId === assignment.id ? { ...item, attachments: nextAttachments } : item
        ))
      }), { toast: "Đã cập nhật bài tập." });
      setEditFilesDraft([]);
      setEditError("");
      setEditing(false);
    } catch (error) {
      console.error(error);
      setEditError(formatActionError(error, "Không thể cập nhật bài tập hoặc file hướng dẫn."));
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <>
    <article className="expand-card">
      <div className="assignment-head">
        <button onClick={() => setOpen(!open)}>
          <strong>{assignmentTitleWithRatio(assignment)}</strong>
          {userSubmissions.length > 0 && <small>Đã nộp {userSubmissions.length} lần</small>}
        </button>
        {admin && (
          <button
            className={`icon-soft assignment-edit-button ${editing ? "active" : ""}`}
            type="button"
            title="Edit bài tập"
            aria-label={`Edit ${assignment.title || "bài tập"}`}
            onClick={startEditingAssignment}
          >
            <Pencil size={15} />
          </button>
        )}
        {admin && <button className="icon-danger" onClick={() => requestConfirm({
          title: "Xác nhận xóa bài tập",
          message: `Bạn có chắc muốn xóa bài tập "${assignment.title}" không?`,
          confirmLabel: "Xóa bài tập"
        }, () => updateCourse((current) => ({ ...current, assignments: normalizeAssignmentRatios((current.assignments || []).filter((item) => item.id !== assignment.id)) })))}><Trash2 size={15} /></button>}
      </div>
      {open && (
        <div>
          {editing ? (
            <div className="assignment-edit-form">
              <label>
                <span>Title</span>
                <input
                  disabled={savingEdit}
                  value={editDraft.title}
                  onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Title..."
                />
              </label>
              <label className="assignment-edit-content">
                <span>Assignment</span>
                <textarea
                  disabled={savingEdit}
                  value={editDraft.content}
                  onChange={(event) => setEditDraft((current) => ({ ...current, content: event.target.value }))}
                  placeholder="Assignment..."
                />
              </label>
              <div
                className={`assignment-attachment-dropzone ${savingEdit ? "is-disabled" : ""}`}
                tabIndex={0}
                onPaste={(event) => {
                  const pastedFiles = event.clipboardData?.files;
                  if (pastedFiles?.length) {
                    event.preventDefault();
                    addEditDraftFiles(pastedFiles);
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (savingEdit) return;
                  addEditDraftFiles(event.dataTransfer.files);
                }}
              >
                <label className="assignment-attachment-add" title="Thêm file hướng dẫn" aria-label="Thêm file hướng dẫn">
                  <Plus size={22} />
                  <input
                    disabled={savingEdit}
                    type="file"
                    multiple
                    onChange={(event) => {
                      addEditDraftFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <div className="assignment-attachment-copy">
                  <strong>{t("assignmentGuideFiles", "File hướng dẫn")}</strong>
                  <span>{t("assignmentGuideFilesHint", "Browse, kéo thả hoặc Ctrl+V để thêm nhiều file/hình.")}</span>
                </div>
              </div>
              {((editDraft.attachments || []).length > 0 || editFilesDraft.length > 0) && (
                <div className="assignment-draft-file-list" aria-label="File hướng dẫn của bài tập">
                  {(editDraft.attachments || []).map((fileItem, index) => (
                    <div className="assignment-draft-file-row" key={`${fileItem.fileName}-${index}`}>
                      <div className="assignment-draft-file-info">
                        <strong>{fileItem.fileName || "file"}</strong>
                        <small>{draftFileTypeLabel(fileItem)} · {t("uploaded", "Đã upload")}</small>
                      </div>
                      <button
                        type="button"
                        title="Xóa file"
                        aria-label={`Xóa ${fileItem.fileName || "file"}`}
                        disabled={savingEdit}
                        onClick={() => removeEditAttachment(index)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {editFilesDraft.map((fileItem, index) => (
                    <div className="assignment-draft-file-row" key={`${fileItem.name}-${fileItem.size}-${fileItem.lastModified}-${index}`}>
                      <div className="assignment-draft-file-info">
                        <strong>{fileItem.name}</strong>
                        <small>{[draftFileTypeLabel(fileItem), formatFileSize(fileItem.size), t("unsaved", "Chưa lưu")].filter(Boolean).join(" · ")}</small>
                      </div>
                      <button
                        type="button"
                        title="Xóa file"
                        aria-label={`Xóa ${fileItem.name}`}
                        disabled={savingEdit}
                        onClick={() => removeEditDraftFile(index)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="assignment-edit-grid">
                <label>
                  <span>Assignee</span>
                  <select
                    disabled={savingEdit}
                    value={editDraft.type}
                    onChange={(event) => setEditDraft((current) => ({ ...current, type: event.target.value }))}
                  >
                    {ASSIGNMENT_ASSIGNEE_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>{optionLanguageLabel(option, language)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Format</span>
                  <select
                    disabled={savingEdit}
                    value={editDraft.format}
                    onChange={(event) => setEditDraft((current) => updateAssignmentDraftFormat(current, event.target.value))}
                  >
                    {ASSIGNMENT_FORMATS.map((format) => (
                      <option value={format.value} key={format.value}>{format.label}</option>
                    ))}
                  </select>
                </label>
                {isReviewerTopicFormat(editDraft.format) && (
                  <label>
                    <span>Topic</span>
                    <select
                      disabled={savingEdit}
                      value={normalizeDiscussionTopicType(editDraft.reviewerType, editDraft.format)}
                      onChange={(event) => setEditDraft((current) => ({ ...current, reviewerType: event.target.value }))}
                    >
                      {ASSIGNMENT_DISCUSSION_TOPIC_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>{optionLanguageLabel(option, language)}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="assignment-edit-due-label">
                  <span>{t("dueDate", "Hạn nộp")}</span>
                  <input
                    type="datetime-local"
                    disabled={savingEdit}
                    value={editDraft.dueAt}
                    onChange={(event) => setEditDraft((current) => ({ ...current, dueAt: event.target.value }))}
                  />
                </label>
                <label className="assignment-edit-ratio-label">
                  <span>{t("ratio", "Tỉ lệ")}</span>
                  <div className="assignment-edit-ratio-field">
                    <input
                      className="ratio-input"
                      inputMode="decimal"
                      disabled={lastAssignment || savingEdit}
                      value={lastAssignment ? (assignment.ratio || "0") : editDraft.ratio}
                      onChange={(event) => setEditDraft((current) => ({ ...current, ratio: cleanRatioInput(event.target.value) }))}
                    />
                    <strong>%</strong>
                    {lastAssignment && <small>Tự động</small>}
                  </div>
                </label>
                <div className="assignment-edit-actions">
                  <SaveButton className="compact" dirty={assignmentEditDirty} saving={savingEdit} onClick={saveAssignmentEdit} />
                  <button className="secondary-action compact" type="button" onClick={cancelEditingAssignment} disabled={savingEdit}>Cancel</button>
                </div>
              </div>
              {savingEdit && <UploadStatus label={editFilesDraft.length > 0 ? "Đang upload file và cập nhật bài tập..." : "Đang cập nhật bài tập..."} />}
              {editError && <p className="error-text">{editError}</p>}
            </div>
          ) : (
            <p className="assignment-content-text">{assignment.content}</p>
          )}
          {!editing && (assignment.attachments || []).length > 0 && (
            <div className="file-list assignment-attachment-list">
              {(assignment.attachments || []).map((file, index) => {
                const previewUrl = filePreviewUrl(file);
                const downloadUrl = fileDownloadUrl(file);
                return (
                  <div className="assignment-attachment-item" key={`${file.fileName}-${index}`}>
                    <button
                      className="material-file-preview"
                      type="button"
                      onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")}
                    >
                      {file.fileName || "file"}
                    </button>
                    {downloadUrl && (
                      <button className="download-icon-button" type="button" title="Tải file" aria-label={`Tải ${file.fileName || "file"}`} onClick={() => window.open(downloadUrl, "_blank", "noopener,noreferrer")}>
                        <Download size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!editing && <div className="assignment-meta-row">
            <div className="assignment-format-row">
              <span>Assignee:</span>
              <strong>{gradebookTypeLabel(assignmentType, language)}</strong>
            </div>
            <div className="assignment-format-row">
              <span>Format:</span>
              <strong>{assignmentFormatLabel(assignmentFormat)}</strong>
            </div>
            {isReviewerTopicFormat(assignmentFormat) && reviewerType !== "none" && (
              <div className="assignment-format-row">
                <span>Topic:</span>
                <strong>{assignmentReviewerLabel(reviewerType, language)}</strong>
              </div>
            )}
            <div className="assignment-deadline-row">
              <span>{t("dueDate", "Hạn nộp")}:</span>
              <strong>{assignmentDeadlineLabel(assignment) || t("noDeadline", "Không giới hạn")}</strong>
            </div>
            <div className="assignment-ratio-row">
              <span>{t("ratio", "Tỉ lệ")}:</span>
              <input className="ratio-input" value={assignment.ratio || "0"} disabled readOnly />
              <strong>%</strong>
            </div>
            {admin && canControlSubmissionVisibility && (
              <button
                className={`icon-soft assignment-submission-visibility-toggle ${submissionsPublic ? "is-public" : ""}`}
                type="button"
                title={submissionsPublic ? "Học viên đang thấy tất cả bài nộp" : "Học viên chỉ thấy bài nộp của mình"}
                aria-label={submissionsPublic ? "Ẩn danh sách bài nộp với học viên" : "Công khai danh sách bài nộp cho học viên"}
                aria-pressed={submissionsPublic}
                onClick={toggleAssignmentSubmissionVisibility}
              >
                {submissionsPublic ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
            )}
            {admin && canHaveSubmissions && (
              <button className="join-action compact assignment-results-toggle" onClick={() => setShowResults(!showResults)}>
                {t("viewSubmissionResults", "Xem kết quả nộp bài")}
              </button>
            )}
          </div>}
          {!editing && reviewerEnabled && (
            <div className="assignment-reviewer-panel">
              <div className="assignment-reviewer-panel-head">
                <strong>Topic</strong>
                <span>Assignee: {gradebookTypeLabel(assignmentType, language)}</span>
              </div>
              <div className="assignment-reviewer-topic-list">
                {reviewerTargets.map((target) => (
                  <button
                    type="button"
                    key={target.key}
                    onClick={() => onOpenReviewer?.(assignment.id, target.key)}
                  >
                    <strong>{target.topic}</strong>
                    <small>{target.label}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!editing && scoreReviewEnabled && (
            <AssignmentReviewerScorePanel
              admin={admin}
              user={user}
              course={course}
              assignment={assignment}
              targets={reviewerTargets}
              updateCourse={updateCourse}
              submissionsPublic={submissionsPublic}
              onOpenStats={() => onOpenScoreStats?.(assignment.id)}
            />
          )}
          {!editing && assignmentFormat === "exam" && admin && (
            <div className="assignment-exam-picker-row">
              <label htmlFor={`assignment-exam-${assignment.id}`}>{t("exam", "Đề thi")}:</label>
              <select
                id={`assignment-exam-${assignment.id}`}
                value={assignment.examId || ""}
                onChange={(event) => updateAssignmentExam(updateCourse, assignment.id, event.target.value, availableExams)}
              >
                <option value="">{t("selectExam", "Chọn đề thi")}</option>
                {availableExams.map((exam) => (
                  <option value={exam.id} key={exam.id}>{exam.title}</option>
                ))}
              </select>
              {adminSelectedExam && (
                <small>{examTotalQuestionCount(adminSelectedExam)} {t("questions", "câu")} · {formatExamDurationLabel(adminSelectedExam.duration, language)}</small>
              )}
              {availableExams.length === 0 && <small>{t("noExamInExamCard", "Chưa có đề thi trong card Đề thi.")}</small>}
            </div>
          )}
          {!editing && assignmentFormat === "exam" && !admin && (
            <AssignmentExamLearnerPanel
              exam={learnerExam}
              active={activeExamForAssignment}
              submitted={submitted || userSubmissions.length > 0}
              lockedMessage={examLockMessage}
              submitError={submitError}
              onStart={() => {
                if (activeExamForAssignment) onShowExam?.(assignment.id);
                else setStartExamOpen(true);
              }}
            />
          )}
          {!editing && assignmentFormat === "uploadFile" && !admin && (
            <>
              <div className={`upload-row ${submitting ? "is-uploading" : ""}`}>
                <input disabled={submitting} type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                <button onClick={submitAssignment} disabled={submitting || !file}>
                  {submitting ? <span className="button-spinner" /> : <Upload size={15} />}
                  {submitting ? "Đang upload" : "Submit"}
                </button>
              </div>
              {submitting && <UploadStatus label="Đang upload file và nộp bài..." />}
              {(submitted || userSubmissions.length > 0) && <p className="success-text">Bạn đã nộp bài thành công.</p>}
              {submitError && <p className="error-text">{submitError}</p>}
            </>
          )}
          {!editing && canHaveSubmissions && (admin ? showResults : true) && (
            <table className="data-table compact-table assignment-submissions-table">
              <thead><tr><th>{t("assignmentName", "Họ tên")}</th><th>{t("file", "File")}</th><th>{t("classTime", "Thời gian")}</th><th>{t("email", "Email")}</th></tr></thead>
              <tbody>
                {visibleSubmissions.length === 0 ? (
                  <tr><td colSpan="4">{t("noSubmission", "Chưa có bài nộp.")}</td></tr>
                ) : visibleSubmissions.map((submission, index) => {
                  const previewUrl = filePreviewUrl(submission);
                  const downloadUrl = fileDownloadUrl(submission);
                  const isLate = isAssignmentSubmissionLate(assignment, submission);
                  const canReviewExam = isReviewableExamSubmission(submission) && assignmentExamSnapshot(assignment);
                  return (
                    <tr key={`${submission.email}-${submission.id || index}`}>
                      <td>{assignmentSubmissionName(course, submission, user)}</td>
                      <td>
                        <div className="submission-file-actions">
                          <button
                            className="link-button"
                            onClick={() => {
                              if (canReviewExam) {
                                setReviewSubmission(submission);
                                return;
                              }
                              if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
                            }}
                          >
                            {submission.fileName || "file"}
                          </button>
                          {downloadUrl && (
                            <button className="download-icon-button" type="button" title="Tải file" aria-label={`Tải ${submission.fileName || "file"}`} onClick={() => window.open(downloadUrl, "_blank", "noopener,noreferrer")}>
                              <Download size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="submission-time-cell">
                          <span>{submission.submittedAt || ""}</span>
                          {isLate && <span className="late-badge">{t("late", "Trễ")}</span>}
                        </div>
                      </td>
                      <td>{submission.email}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </article>
    {startExamOpen && learnerExam && (
      <AssignmentExamStartModal
        exam={learnerExam}
        onCancel={() => setStartExamOpen(false)}
        onStart={() => {
          onStartExam?.(assignment, learnerExam);
          setSubmitted(false);
          setSubmitError("");
          setStartExamOpen(false);
        }}
      />
    )}
    {reviewSubmission && assignmentExamSnapshot(assignment) && (
      <AssignmentExamReviewModal
        course={course}
        user={user}
        assignment={assignment}
        exam={assignmentExamSnapshot(assignment)}
        submission={reviewSubmission}
        onClose={() => setReviewSubmission(null)}
      />
    )}
    </>
  );
}

function AssignmentReviewerScorePanel({ admin, user, course, assignment, targets, updateCourse, submissionsPublic = false, onOpenStats }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const targetOptions = useMemo(() => targets.map((target) => ({
    key: target.key,
    label: formatAssignmentScoreTarget(target)
  })), [targets]);
  const responseRows = useMemo(
    () => mergePeerReviewResponseRows([], assignment.peerScoreResponses || []),
    [assignment.peerScoreResponses]
  );
  const [topicKey, setTopicKey] = useState(targetOptions[0]?.key || "");
  const [score, setScore] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(() => admin);
  const [configDraft, setConfigDraft] = useState(() => peerReviewScoreConfig(assignment));
  const [configStatus, setConfigStatus] = useState("");
  const [configError, setConfigError] = useState("");
  const choiceValuesSignature = Array.isArray(assignment.choiceValues) ? assignment.choiceValues.join("|") : String(assignment.choiceValues || "");
  const normalizedUserEmail = normalizeEmail(user?.email || "");
  const visibleResponses = admin || submissionsPublic
    ? responseRows
    : responseRows.filter((row) => normalizeEmail(row.email || "") === normalizedUserEmail);
  const resultsVisible = admin ? resultsOpen : true;
  const scoreReview = {
    ...assignment,
    id: assignment.id,
    title: assignment.title || "Reviewer: Score",
    responses: responseRows
  };
  const selectedTarget = targetOptions.find((target) => target.key === topicKey) || targetOptions[0] || null;
  const scoreConfigDirty = jsonSignature(configDraft) !== jsonSignature(peerReviewScoreConfig(assignment));

  useEffect(() => {
    if (!targetOptions.length) {
      setTopicKey("");
      return;
    }
    if (!targetOptions.some((target) => target.key === topicKey)) {
      setTopicKey(targetOptions[0].key);
    }
  }, [targetOptions, topicKey]);

  useEffect(() => {
    setConfigDraft(peerReviewScoreConfig(assignment));
    setScore("");
  }, [assignment.id, assignment.scoreFormat, assignment.limitMin, assignment.limitMax, choiceValuesSignature]);

  function saveScoreConfig() {
    const validation = validatePeerReviewScoreConfig(configDraft);
    setConfigStatus("");
    setConfigError("");
    if (!validation.valid) {
      setConfigError(validation.error);
      return;
    }
    const savePromise = updateCourse((current) => ({
      ...current,
      assignments: normalizeAssignmentRatios((current.assignments || []).map((item) => (
        item.id === assignment.id ? { ...item, ...validation.config } : item
      )))
    }), { toast: "Đã cập nhật format chấm điểm." });
    setConfigDraft((current) => ({
      ...current,
      ...validation.config,
      choiceValuesText: validation.config.choiceValues.join(", ")
    }));
    setConfigStatus("Đã lưu format chấm điểm.");
    return savePromise;
  }

  async function submitReviewScore() {
    if (!selectedTarget) {
      setSubmitStatus("");
      setSubmitError("Chưa có Topic để chấm điểm.");
      return;
    }
    const validation = validatePeerReviewScore(scoreReview, score);
    if (!validation.valid) {
      setSubmitStatus("");
      setSubmitError(validation.error);
      return;
    }
    setSubmitStatus("");
    setSubmitError("");
    setSubmitting(true);
    try {
      const learner = findCourseMember(course, user.email);
      const submittedAtMillis = Date.now();
      const response = {
        id: crypto.randomUUID(),
        reviewId: assignment.id,
        assignmentId: assignment.id,
        email: normalizedUserEmail || user.email,
        name: learner?.name || user.displayName || user.email,
        studentId: learner?.studentId || "",
        topicKey: selectedTarget.key,
        topic: selectedTarget.label,
        score: validation.score,
        submittedAt: formatDateTime24(submittedAtMillis),
        submittedAtMillis
      };
      const savedResponse = await submitPeerReviewResponseToCloud(course.id, assignment.id, response);
      updateCourse((current) => ({
        ...current,
        assignments: (current.assignments || []).map((item) => (
          item.id === assignment.id
            ? { ...item, peerScoreResponses: mergePeerReviewResponseRows(item.peerScoreResponses || [], [savedResponse]) }
            : item
        ))
      }), { sync: false });
      setScore("");
      setSubmitStatus("Đã chấm điểm thành công.");
    } catch (error) {
      console.error(error);
      setSubmitError("Không thể lưu điểm chấm. Vui lòng thử lại hoặc báo giảng viên kiểm tra quyền Firestore.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="assignment-peer-score-panel">
      {admin ? (
        <div className="peer-score-admin-panel">
          <div className="peer-score-admin-head peer-score-actions-near-title">
            <strong>{t("scoreFormat", "Format chấm điểm")}</strong>
            <div className="peer-score-admin-actions">
              <button
                className="icon-soft"
                type="button"
                title={t("scoreStats", "Thống kê điểm reviewer")}
                aria-label={t("scoreStats", "Thống kê điểm reviewer")}
                onClick={onOpenStats}
              >
                <ChartColumn size={17} />
              </button>
              <SaveButton className="compact" dirty={scoreConfigDirty} onClick={saveScoreConfig} />
            </div>
          </div>
          <div className="peer-score-config-row">
            <PeerReviewScoreConfigFields draft={configDraft} onChange={(nextDraft) => {
              setConfigDraft(nextDraft);
              setConfigStatus("");
              setConfigError("");
            }} />
          </div>
          {configStatus && <p className="success-text">{configStatus}</p>}
          {configError && <p className="error-text">{configError}</p>}
        </div>
      ) : (
        <div className="review-form">
          <select value={topicKey} onChange={(event) => setTopicKey(event.target.value)} disabled={!targetOptions.length || submitting}>
            {targetOptions.length === 0 ? (
              <option value="">{t("noTopic", "Chưa có Topic")}</option>
            ) : targetOptions.map((target) => (
              <option value={target.key} key={target.key}>{target.label}</option>
            ))}
          </select>
          <PeerReviewScoreInput review={scoreReview} value={score} onChange={(value) => {
            setScore(value);
            setSubmitError("");
            setSubmitStatus("");
          }} disabled={submitting || !targetOptions.length} />
          <button onClick={submitReviewScore} disabled={!targetOptions.length || !hasScoreValue(score) || submitting}>{submitting ? t("saving", "Đang lưu...") : "Submit"}</button>
        </div>
      )}
      {submitStatus && <p className="success-text">{submitStatus}</p>}
      {submitError && <p className="error-text">{submitError}</p>}
      {admin && (
        <button className="review-results-toggle" type="button" onClick={() => setResultsOpen((current) => !current)}>
        {resultsOpen ? t("hideLearnerScores", "Ẩn điểm người học chấm") : t("viewLearnerScores", "Xem điểm người học chấm")}
        </button>
      )}
      {resultsVisible && (
        <>
          <div className="review-results-head">
            <strong>{admin || submissionsPublic ? t("allReviewedScores", "Tất cả điểm đã chấm") : t("yourReviewedScores", "Điểm bạn đã chấm")}</strong>
            {admin && <button className="export-button" onClick={() => exportReview({ ...scoreReview, responses: visibleResponses })}>Export Excel</button>}
          </div>
          <table className="data-table compact-table review-results-table">
            <thead><tr><th>{t("stt", "STT")}</th><th>{t("fullName", "Họ và tên")}</th><th>{t("topic", "Topic")}</th><th>{t("scoreGiven", "Điểm chấm")}</th><th>{t("classTime", "Thời gian")}</th><th>{t("studentId", "Mã số")}</th><th>{t("email", "Email")}</th></tr></thead>
            <tbody>
              {visibleResponses.length === 0 ? (
                <tr><td colSpan="7">{admin ? t("noLearnerScores", "Chưa có người học chấm điểm.") : t("noYourScores", "Bạn chưa chấm điểm trong bài tập này.")}</td></tr>
              ) : visibleResponses.map((row, index) => (
                <tr key={row.id || `${row.email}-${row.topicKey || row.topic}-${row.score}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{row.name}</td>
                  <td>{row.topic}</td>
                  <td>{row.score}</td>
                  <td>{row.submittedAt || ""}</td>
                  <td>{row.studentId}</td>
                  <td>{row.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function formatAssignmentScoreTarget(target) {
  return `${target.label} - ${target.topic}`;
}

function responseMatchesScoreTarget(response, target) {
  if (response.topicKey) return response.topicKey === target.key;
  return response.topic === target.label;
}

function buildAssignmentReviewerScoreStats(course, targets, responses) {
  const acceptedMembers = (course.members || [])
    .filter((member) => member.status === "accepted")
    .sort(compareMemberOrder);
  const totalLearners = acceptedMembers.length;
  const topicRows = targets.map((target, index) => {
    const targetResponses = responses.filter((response) => responseMatchesScoreTarget(response, target));
    const latestByReviewer = new Map();
    targetResponses.forEach((response) => {
      const email = normalizeEmail(response.email || "");
      if (!email) return;
      const existing = latestByReviewer.get(email);
      if (!existing || Number(response.submittedAtMillis || 0) >= Number(existing.submittedAtMillis || 0)) {
        latestByReviewer.set(email, response);
      }
    });
    const reviewerResponses = [...latestByReviewer.values()];
    const scores = reviewerResponses
      .map((response) => Number(String(response.score ?? "").replace(",", ".")))
      .filter(Number.isFinite);
    const average = scores.length
      ? formatScoreNumber(scores.reduce((total, value) => total + value, 0) / scores.length)
      : "";
    const range = scores.length
      ? `${formatScoreNumber(Math.min(...scores))}-${formatScoreNumber(Math.max(...scores))}`
      : "";
    return {
      index: index + 1,
      topic: target.label,
      count: `${latestByReviewer.size}/${totalLearners}`,
      range,
      average
    };
  });
  const completionRows = acceptedMembers.map((member, index) => {
    const email = normalizeEmail(member.email || "");
    const memberResponses = responses.filter((response) => normalizeEmail(response.email || "") === email);
    const reviewedKeys = new Set();
    memberResponses.forEach((response) => {
      const matchedTarget = targets.find((target) => responseMatchesScoreTarget(response, target));
      if (matchedTarget) reviewedKeys.add(matchedTarget.key);
    });
    const missingTopics = targets
      .filter((target) => !reviewedKeys.has(target.key))
      .map((target) => target.label);
    return {
      index: index + 1,
      name: member.name || member.email,
      studentId: member.studentId || "",
      email: member.email || "",
      progress: `${reviewedKeys.size}/${targets.length}`,
      missing: missingTopics.join(", ")
    };
  });
  return { topicRows, completionRows };
}

function AssignmentReviewerScoreStatsWorkspace({ course, assignment, targets, responses, onBack }) {
  const targetOptions = useMemo(() => targets.map((target) => ({
    key: target.key,
    label: formatAssignmentScoreTarget(target)
  })), [targets]);
  const stats = useMemo(
    () => buildAssignmentReviewerScoreStats(course, targetOptions, responses),
    [course.members, targetOptions, responses]
  );

  return (
    <div className="assignment-reviewer-workspace reviewer-score-workspace">
      <div className="assignment-reviewer-sticky-head">
        <button className="secondary-action compact" type="button" onClick={onBack}>
          <ChevronLeft size={18} /> Back
        </button>
        <div>
          <strong>Thống kê Reviewer: Score</strong>
          <small>{assignment.title || "Reviewer: Score"} · {targetOptions.length} Topic</small>
        </div>
      </div>
      <div className="assignment-reviewer-scroll reviewer-score-stats-scroll">
        <div className="reviewer-score-stats-section">
          <h4>Điểm trung bình theo Topic</h4>
          <div className="reviewer-score-table-wrap">
            <table className="data-table compact-table reviewer-score-stats-table">
              <thead><tr><th>STT</th><th>Topic</th><th>Số lượt chấm</th><th>Range</th><th>Điểm trung bình</th></tr></thead>
              <tbody>
                {stats.topicRows.length === 0 ? (
                  <tr><td colSpan="5">Chưa có Topic.</td></tr>
                ) : stats.topicRows.map((row) => (
                  <tr key={row.topic}>
                    <td>{row.index}</td>
                    <td>{row.topic}</td>
                    <td>{row.count}</td>
                    <td>{row.range}</td>
                    <td>{row.average}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="reviewer-score-stats-section">
          <h4>Tiến độ người học chấm điểm</h4>
          <div className="reviewer-score-table-wrap">
            <table className="data-table compact-table reviewer-score-completion-table">
              <thead><tr><th>STT</th><th>Họ và tên</th><th>Mã số</th><th>Đã chấm</th><th>Email</th><th>Còn thiếu</th></tr></thead>
              <tbody>
                {stats.completionRows.length === 0 ? (
                  <tr><td colSpan="6">Chưa có người học.</td></tr>
                ) : stats.completionRows.map((row) => (
                  <tr key={row.email || row.index}>
                    <td>{row.index}</td>
                    <td>{row.name}</td>
                    <td>{row.studentId}</td>
                    <td>{row.progress}</td>
                    <td>{row.email}</td>
                    <td>{row.missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentExamStartModal({ exam, onCancel, onStart }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  return (
    <Modal title="Bắt đầu làm bài" onClose={onCancel}>
      <div className="assignment-exam-start-summary">
        <strong>{exam.title || t("exam", "Đề thi")}</strong>
        <span>{normalizeLanguage(language) === "en" ? "Total" : "Tổng cộng"}: {examTotalQuestionCount(exam)} {t("questions", "câu")}</span>
        <span>{normalizeLanguage(language) === "en" ? "Duration" : "Thời gian làm bài"}: {formatExamDurationLabel(exam.duration, language)}</span>
      </div>
      <div className="confirm-actions">
        <button className="secondary-action" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-action compact" type="button" onClick={onStart}>
          <PlayCircle size={15} /> Làm bài
        </button>
      </div>
    </Modal>
  );
}

function AssignmentExamLearnerPanel({
  exam,
  active,
  submitted,
  lockedMessage,
  submitError,
  onStart
}) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  if (!exam) {
    return <div className="assignment-exam-empty">{normalizeLanguage(language) === "en" ? "No exam selected." : "Chưa có đề thi được chọn."}</div>;
  }

  const locked = Boolean(lockedMessage) || (submitted && !active);
  const actionLabel = active
    ? (normalizeLanguage(language) === "en" ? "Continue" : "Tiếp tục làm bài")
    : (locked ? (normalizeLanguage(language) === "en" ? "Submitted" : "Đã submit") : (normalizeLanguage(language) === "en" ? "Start" : "Làm bài"));

  return (
    <div className="assignment-exam-summary">
      <div>
        <strong>{t("exam", "Đề thi")}: {exam.title || t("exam", "Đề thi")}</strong>
        <small>{examTotalQuestionCount(exam)} {t("questions", "câu")} · {formatExamDurationLabel(exam.duration, language)}</small>
      </div>
      <button className="join-action compact" type="button" onClick={onStart} disabled={locked && !active}>
        <PlayCircle size={15} /> {actionLabel}
      </button>
      {lockedMessage ? (
        <p className="success-text">{lockedMessage}</p>
      ) : submitted && (
        <p className="success-text">Bạn đã submit bài thi thành công.</p>
      )}
      {submitError && <p className="error-text">{submitError}</p>}
    </div>
  );
}

function AssignmentReviewerWorkspace({ admin, course, user, assignment, target, updateCourse, onBack }) {
  const topicType = normalizeDiscussionTopicType(assignment.reviewerType, assignment.format);
  const assigneeType = normalizeGradebookType(assignment.type, "personal");
  const [questionDraft, setQuestionDraft] = useState("");
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [postingPrompt, setPostingPrompt] = useState(false);
  const [promptNotice, setPromptNotice] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const questions = useMemo(() => (
    cleanAssignmentReviewerQuestions(assignment.reviewerQuestions || [])
      .filter((question) => question.targetKey === target.key)
  ), [assignment.reviewerQuestions, target.key]);
  const groupedQuestions = useMemo(() => groupAssignmentReviewerQuestions(questions), [questions]);
  const questionScope = useMemo(
    () => buildReviewerQuestionScope(course, assigneeType, user),
    [course.members, course.personalTopics, course.groupTopics, course.intergroupTopics, assigneeType, user?.email]
  );

  async function postReviewerQuestionPrompt() {
    if (!admin || postingPrompt || !user?.email) return;
    setPostingPrompt(true);
    setQuestionError("");
    setPromptNotice("");
    try {
      const createdAtMillis = Date.now();
      const announcement = createReviewerQuestionPromptAnnouncement({
        assignment,
        target,
        topicType,
        assigneeType,
        user,
        createdAtMillis
      });
      const savedAnnouncement = hasFirebaseConfig
        ? await saveAnnouncementToCloud(course.id, announcement)
        : announcement;
      updateCourse((current) => ({
        ...current,
        announcements: [savedAnnouncement, ...(current.announcements || [])]
      }), { sync: false });
      if (hasFirebaseConfig && course.announcementEmailEnabled) {
        try {
          const emailResult = await notifyAnnouncementEmail(course.id, savedAnnouncement.id);
          setPromptNotice(emailResult.sentCount > 0
            ? `Đã đăng thông báo và gửi email đến ${emailResult.sentCount} thành viên.`
            : "Đã đăng thông báo.");
        } catch (error) {
          console.error(error);
          setPromptNotice("Đã đăng thông báo, nhưng chưa gửi được email.");
        }
      } else {
        setPromptNotice("Đã đăng thông báo.");
      }
    } catch (error) {
      console.error(error);
      setQuestionError("Không thể đăng thông báo đặt câu hỏi.");
    } finally {
      setPostingPrompt(false);
    }
  }

  async function sendReviewerQuestion(event) {
    event.preventDefault();
    const text = questionDraft.trim();
    if (!text || sendingQuestion || !user?.email) return;
    setSendingQuestion(true);
    setQuestionError("");
    try {
      const createdAtMillis = Date.now();
      const member = findCourseMember(course, user.email);
      const question = {
        id: crypto.randomUUID(),
        assignmentId: assignment.id,
        reviewerType: topicType,
        topicType,
        assigneeType,
        targetKey: target.key,
        targetLabel: target.label,
        targetTopic: target.topic,
        questionScopeKey: questionScope.key,
        questionScopeLabel: questionScope.label,
        email: normalizeEmail(user.email),
        name: member?.name || user.displayName || user.email,
        photoURL: member?.photoURL || user.photoURL || "",
        text,
        answered: false,
        createdAt: formatDateTime24(createdAtMillis),
        createdAtMillis,
        updatedAtMillis: createdAtMillis
      };
      const savedQuestion = await submitAssignmentReviewerQuestionToCloud(course.id, assignment.id, question);
      updateCourse((current) => ({
        ...current,
        assignments: (current.assignments || []).map((item) => (
          item.id === assignment.id
            ? {
              ...item,
              reviewerQuestions: mergeAssignmentReviewerQuestionList(item.reviewerQuestions || [], [savedQuestion])
            }
            : item
        ))
      }), { sync: false });
      setQuestionDraft("");
    } catch (error) {
      console.error(error);
      setQuestionError("Không thể gửi câu hỏi. Vui lòng thử lại.");
    } finally {
      setSendingQuestion(false);
    }
  }

  async function toggleReviewerQuestion(question) {
    const nextAnswered = !question.answered;
    const updatedAtMillis = Date.now();
    const patch = {
      answered: nextAnswered,
      answeredAtMillis: nextAnswered ? updatedAtMillis : 0,
      answeredBy: nextAnswered ? normalizeEmail(user?.email || "") : "",
      updatedAtMillis
    };
    updateReviewerQuestionLocal(updateCourse, assignment.id, question, patch);
    try {
      await updateAssignmentReviewerQuestionToCloud(course.id, question.id, patch);
    } catch (error) {
      console.error(error);
      updateReviewerQuestionLocal(updateCourse, assignment.id, question, {
        answered: question.answered,
        answeredAtMillis: question.answeredAtMillis || 0,
        answeredBy: question.answeredBy || "",
        updatedAtMillis: question.updatedAtMillis || question.createdAtMillis || updatedAtMillis
      });
      setQuestionError("Không thể cập nhật trạng thái câu hỏi.");
    }
  }

  return (
    <div className="assignment-reviewer-workspace">
      <div className="assignment-reviewer-sticky-head">
        <button className="secondary-action compact" type="button" onClick={onBack}>
          <ChevronLeft size={18} /> Back
        </button>
        <div>
          <strong>{target.topic}</strong>
          <small>{gradebookTypeLabels[target.targetType] || "Cá nhân"} · {target.label} · Assignee: {gradebookTypeLabels[assigneeType]}</small>
        </div>
        {admin && (
          <div className="assignment-reviewer-head-actions">
            <button
              className="icon-soft"
              type="button"
              title="Đăng thông báo đặt câu hỏi"
              aria-label="Đăng thông báo đặt câu hỏi"
              disabled={postingPrompt}
              onClick={postReviewerQuestionPrompt}
            >
              {postingPrompt ? <span className="button-spinner" /> : <BellRing size={18} />}
            </button>
            <button
              className="icon-soft"
              type="button"
              title="Thống kê câu hỏi"
              aria-label="Thống kê câu hỏi"
              onClick={() => setShowStats(true)}
            >
              <ChartColumn size={18} />
            </button>
          </div>
        )}
      </div>
      <div className="assignment-reviewer-scroll">
        {groupedQuestions.length === 0 ? (
          <div className="empty-state compact-empty">Chưa có câu hỏi.</div>
        ) : (
          <div className="assignment-reviewer-question-groups">
            {groupedQuestions.map((group) => (
              <section className="assignment-reviewer-question-group" key={group.key}>
                <h4>{group.label}</h4>
                <div className="assignment-reviewer-question-list">
                  {group.questions.map((question) => (
                    <label className={`assignment-reviewer-question ${question.answered ? "answered" : ""}`} key={reviewerQuestionMergeKey(question)}>
                      <input
                        type="checkbox"
                        checked={Boolean(question.answered)}
                        onChange={() => toggleReviewerQuestion(question)}
                      />
                      <div>
                        <div className="assignment-reviewer-question-author">
                          <ProfileAvatar user={{ photoURL: question.photoURL, email: question.email }} label={question.name || question.email} small />
                          <strong>{question.name || question.email}</strong>
                          <small>{question.createdAt || formatDateTime24(question.createdAtMillis)}</small>
                        </div>
                        <p>{question.text}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <form className="assignment-reviewer-input-row" onSubmit={sendReviewerQuestion}>
        <textarea
          value={questionDraft}
          onChange={(event) => setQuestionDraft(event.target.value)}
          placeholder={t("enterQuestion", "Nhập câu hỏi...")}
          disabled={sendingQuestion}
        />
        <button className="primary-action compact" type="submit" disabled={sendingQuestion || !questionDraft.trim()}>
          {sendingQuestion ? <span className="button-spinner" /> : <Send size={15} />}
          Send
        </button>
        {promptNotice && <p className="success-text">{promptNotice}</p>}
        {questionError && <p className="error-text">{questionError}</p>}
      </form>
      {showStats && (
        <AssignmentReviewerStatsModal
          questions={questions}
          topicType={topicType}
          assigneeType={assigneeType}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}

function AssignmentReviewerStatsModal({ questions, topicType, assigneeType, onClose }) {
  const statsGroups = useMemo(() => buildReviewerQuestionStats(questions), [questions]);
  const totalQuestions = questions.length;
  const answeredQuestions = questions.filter((question) => question.answered).length;

  return (
    <Modal title="Thống kê câu hỏi" onClose={onClose} className="assignment-reviewer-stats-modal">
      <div className="reviewer-stats-summary">
        <div>
          <span>Tổng câu hỏi</span>
          <strong>{totalQuestions}</strong>
        </div>
        <div>
          <span>Đã trả lời</span>
          <strong>{answeredQuestions}</strong>
        </div>
        <div>
          <span>Topic</span>
          <strong>{assignmentReviewerLabel(topicType)}</strong>
        </div>
        <div>
          <span>Assignee</span>
          <strong>{gradebookTypeLabels[assigneeType]}</strong>
        </div>
      </div>
      {statsGroups.length === 0 ? (
        <div className="empty-state compact-empty">Chưa có câu hỏi để thống kê.</div>
      ) : (
        <div className="reviewer-stats-groups">
          {statsGroups.map((group) => (
            <section className="reviewer-stats-group" key={group.key}>
              <div className="reviewer-stats-group-head">
                <strong>{group.label}</strong>
                <span>{group.total} câu</span>
              </div>
              <table className="data-table reviewer-stats-table">
                <thead>
                  <tr>
                    <th>Người đặt câu hỏi</th>
                    <th>Email</th>
                    <th>Câu hỏi</th>
                    <th>Đã trả lời</th>
                  </tr>
                </thead>
                <tbody>
                  {group.askers.map((asker) => (
                    <tr key={asker.key}>
                      <td>{asker.name}</td>
                      <td>{asker.email || "-"}</td>
                      <td>{asker.total}</td>
                      <td>{asker.answered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}

function AssignmentExamWorkspace({ assignment, exam, session, submitting, submitError, onAnswerChange, onHide, onSubmit }) {
  const durationSeconds = parseExamDurationSeconds(exam?.duration);
  const [remainingSeconds, setRemainingSeconds] = useState(() => examRemainingSeconds(exam, session));
  const timeExpired = Boolean(durationSeconds && remainingSeconds <= 0);
  const warningTime = Boolean(durationSeconds && remainingSeconds > 0 && remainingSeconds <= 300);
  const answers = session?.answers || {};
  const parts = normalizeExamParts(exam.parts);

  useEffect(() => {
    setRemainingSeconds(examRemainingSeconds(exam, session));
    if (!durationSeconds) return undefined;
    function tick() {
      setRemainingSeconds(examRemainingSeconds(exam, session));
    }
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [durationSeconds, exam, session]);

  return (
    <div className="assignment-exam-workspace">
      <div className="assignment-exam-sticky-head">
        <div>
          <strong>{exam.title || "Đề thi"}</strong>
          <small>{assignment?.title ? `${assignment.title} · ` : ""}{examTotalQuestionCount(exam)} câu</small>
        </div>
        <div className="assignment-exam-head-actions">
          <span className={`assignment-exam-timer ${timeExpired ? "expired" : ""} ${warningTime ? "warning" : ""}`}>
            <Clock size={15} />
            {durationSeconds ? formatCountdown(remainingSeconds) : "Không giới hạn"}
          </span>
          <button className="primary-action compact" type="button" onClick={onSubmit} disabled={submitting}>
            {submitting ? <span className="button-spinner" /> : <Send size={15} />}
            {submitting ? "Submitting" : "Submit"}
          </button>
          <button className="secondary-action compact" type="button" onClick={onHide} disabled={submitting || timeExpired}>Hide</button>
        </div>
      </div>
      <div className="assignment-exam-scroll">
        {timeExpired && <p className="error-text">Đã hết thời gian làm bài. Bạn không thể tiếp tục chọn/nhập đáp án. Bấm Submit để gửi bài.</p>}
        <div className="assignment-exam-question-list">
          {parts.map((part, partIndex) => {
            const questions = normalizeExamQuestions(part.questions);
            if (questions.length === 0) return null;
            return (
              <section className="assignment-exam-part" key={part.id || partIndex}>
                {parts.length > 1 && <h4>Phần {toRomanNumeral(partIndex + 1)}</h4>}
                {questions.map((question, questionIndex) => (
                  <AssignmentExamQuestion
                    key={question.id || `${partIndex}-${questionIndex}`}
                    part={part}
                    question={question}
                    questionIndex={questionIndex}
                    value={answers[examQuestionResponseKey(part, question)]}
                    disabled={submitting || timeExpired}
                    onChange={(value) => onAnswerChange(examQuestionResponseKey(part, question), value)}
                  />
                ))}
              </section>
            );
          })}
        </div>
        <div className="assignment-exam-submit-row">
          <button className="primary-action compact" type="button" onClick={onSubmit} disabled={submitting}>
            {submitting ? <span className="button-spinner" /> : <Send size={15} />}
            {submitting ? "Submitting" : "Submit"}
          </button>
        </div>
        {submitting && <UploadStatus label="Đang submit bài thi..." />}
        {submitError && <p className="error-text">{submitError}</p>}
      </div>
    </div>
  );
}

function AssignmentExamReviewModal({ course, user, assignment, exam, submission, onClose }) {
  const parts = normalizeExamParts(exam.parts);
  const answers = submission.examAnswers || {};
  const submitter = assignmentSubmissionIdentity(course, submission, user);
  const [exportingPdf, setExportingPdf] = useState(false);

  async function exportPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportExamSubmissionPdf({ course, user, assignment, exam, submission });
    } catch (error) {
      console.error(error);
      window.alert("Không thể export PDF bài làm. Vui lòng thử lại.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <Modal title="Bài làm đã nộp" onClose={onClose} className="assignment-exam-review-modal">
      <div className="assignment-exam-review-head">
        <strong>{submission.examTitle || exam.title || "Đề thi"}</strong>
        <span>{assignment?.title ? `${assignment.title} · ` : ""}{examTotalQuestionCount(exam)} câu</span>
        <span>Đã nộp: {submission.submittedAt || formatDateTime24(submission.submittedAtMillis || Date.now())}</span>
        <div className="assignment-exam-review-submitter">
          <span><b>Họ tên người nộp:</b> {submitter.name || "Chưa có"}</span>
          <span><b>Mã số:</b> {submitter.studentId || "Chưa có"}</span>
          <span><b>Email:</b> {submitter.email || "Chưa có"}</span>
        </div>
      </div>
      <div className="assignment-exam-review-body">
        <div className="assignment-exam-question-list">
          {parts.map((part, partIndex) => {
            const questions = normalizeExamQuestions(part.questions);
            if (questions.length === 0) return null;
            return (
              <section className="assignment-exam-part" key={part.id || partIndex}>
                {parts.length > 1 && <h4>Phần {toRomanNumeral(partIndex + 1)}</h4>}
                {questions.map((question, questionIndex) => (
                  <AssignmentExamQuestion
                    key={question.id || `${partIndex}-${questionIndex}`}
                    part={part}
                    question={question}
                    questionIndex={questionIndex}
                    value={answers[examQuestionResponseKey(part, question)]}
                    disabled
                    reviewMode
                  />
                ))}
              </section>
            );
          })}
        </div>
      </div>
      <div className="confirm-actions">
        <button className="export-button" type="button" onClick={exportPdf} disabled={exportingPdf}>
          {exportingPdf ? <span className="button-spinner" /> : <Download size={15} />}
          {exportingPdf ? "Exporting" : "Export PDF"}
        </button>
        <button className="secondary-action" type="button" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

async function exportExamSubmissionPdf({ course, user, assignment, exam, submission }) {
  const submitter = assignmentSubmissionIdentity(course, submission, user);
  const exportNode = document.createElement("div");
  exportNode.className = "exam-pdf-export-root";
  exportNode.innerHTML = examSubmissionPdfHtml({ assignment, exam, submission, submitter });
  document.body.appendChild(exportNode);
  try {
    await document.fonts?.ready;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const canvas = await html2canvas(exportNode, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      windowWidth: exportNode.scrollWidth,
      windowHeight: exportNode.scrollHeight
    });
    saveCanvasAsPdf(canvas, examSubmissionPdfFileName({ assignment, exam, submission, submitter }));
  } finally {
    exportNode.remove();
  }
}

function examSubmissionPdfHtml({ assignment, exam, submission, submitter }) {
  const parts = normalizeExamParts(exam.parts);
  const answers = submission.examAnswers || {};
  return `
    <section class="exam-pdf-sheet">
      <header class="exam-pdf-header">
        <h1>${escapeXml(submission.examTitle || exam.title || "Đề thi")}</h1>
        <p>${escapeXml(assignment?.title || "Bài tập")} · ${examTotalQuestionCount(exam)} câu</p>
        <p>Đã nộp: ${escapeXml(submission.submittedAt || formatDateTime24(submission.submittedAtMillis || Date.now()))}</p>
      </header>
      <dl class="exam-pdf-submitter">
        <div><dt>Họ tên người nộp</dt><dd>${escapeXml(submitter.name || "Chưa có")}</dd></div>
        <div><dt>Mã số</dt><dd>${escapeXml(submitter.studentId || "Chưa có")}</dd></div>
        <div><dt>Email</dt><dd>${escapeXml(submitter.email || "Chưa có")}</dd></div>
      </dl>
      <main class="exam-pdf-parts">
        ${parts.map((part, partIndex) => examPartSubmissionPdfHtml(part, partIndex, answers, parts.length > 1)).join("")}
      </main>
    </section>
  `;
}

function examPartSubmissionPdfHtml(part, partIndex, answers, showPartTitle) {
  const questions = normalizeExamQuestions(part.questions);
  if (questions.length === 0) return "";
  return `
    <section class="exam-pdf-part">
      ${showPartTitle ? `<h2>Phần ${toRomanNumeral(partIndex + 1)}</h2>` : ""}
      ${questions.map((question, questionIndex) => examQuestionSubmissionPdfHtml(part, question, questionIndex, answers)).join("")}
    </section>
  `;
}

function examQuestionSubmissionPdfHtml(part, question, questionIndex, answers) {
  const questionType = part.questionType || "multipleChoice";
  const response = answers[examQuestionResponseKey(part, question)];
  const answerOptions = normalizeExamAnswers(question.answers);
  const checkboxResponse = Array.isArray(response) ? response : [];
  const questionText = question.text || "Câu hỏi";
  if (questionType === "multipleChoice" || questionType === "checkbox") {
    return `
      <article class="exam-pdf-question">
        <h3>Câu ${questionIndex + 1}</h3>
        <p>${escapeXml(questionText)}</p>
        <div class="exam-pdf-options">
          ${answerOptions.map((answer, answerIndex) => {
            const selected = questionType === "multipleChoice"
              ? response === answer.id
              : checkboxResponse.includes(answer.id);
            return `
              <div class="exam-pdf-option ${selected ? "selected" : ""}">
                <span class="exam-pdf-check">${selected ? "✓" : ""}</span>
                <strong>${String.fromCharCode(65 + answerIndex)}.</strong>
                <span>${escapeXml(answer.text || `Đáp án ${answerIndex + 1}`)}</span>
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }
  return `
    <article class="exam-pdf-question">
      <h3>Câu ${questionIndex + 1}</h3>
      <p>${escapeXml(questionText)}</p>
      <div class="exam-pdf-text-answer">${escapeXml(response || "Chưa trả lời.")}</div>
    </article>
  `;
}

function examSubmissionPdfFileName({ assignment, exam, submission, submitter }) {
  const title = [
    "bai-lam",
    exam?.title || submission?.examTitle || assignment?.title || "exam",
    submitter?.studentId || submitter?.name || submitter?.email || ""
  ].filter(Boolean).join("-");
  return `${safeExportFileName(title)}.pdf`;
}

function saveCanvasAsPdf(canvas, fileName) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imageWidth = pageWidth - margin * 2;
  const usablePageHeight = pageHeight - margin * 2;
  const pixelsPerMm = canvas.width / imageWidth;
  const pageHeightPx = Math.floor(usablePageHeight * pixelsPerMm);
  const pageCanvas = document.createElement("canvas");
  const pageContext = pageCanvas.getContext("2d");
  pageCanvas.width = canvas.width;

  let offsetY = 0;
  let pageIndex = 0;
  while (offsetY < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
    pageCanvas.height = sliceHeight;
    pageContext.fillStyle = "#ffffff";
    pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    if (pageIndex > 0) pdf.addPage();
    const imageData = pageCanvas.toDataURL("image/jpeg", 0.96);
    pdf.addImage(imageData, "JPEG", margin, margin, imageWidth, sliceHeight / pixelsPerMm);
    offsetY += sliceHeight;
    pageIndex += 1;
  }
  pdf.save(fileName || "bai-lam.pdf");
}

function AssignmentExamQuestion({ part, question, questionIndex, value, disabled, onChange = () => {}, reviewMode = false }) {
  const questionType = part.questionType || "multipleChoice";
  const answers = normalizeExamAnswers(question.answers);
  const checkboxValue = Array.isArray(value) ? value : [];

  function toggleCheckbox(answerId, checked) {
    onChange(checked
      ? [...checkboxValue, answerId]
      : checkboxValue.filter((item) => item !== answerId));
  }

  return (
    <article className={`assignment-exam-question ${reviewMode ? "review-mode" : ""}`}>
      <strong>Câu {questionIndex + 1}</strong>
      <p>{question.text || "Câu hỏi"}</p>
      {(questionType === "multipleChoice" || questionType === "checkbox") ? (
        <div className="assignment-exam-answer-list">
          {answers.map((answer, answerIndex) => (
            <label
              className={`assignment-exam-answer ${
                questionType === "multipleChoice"
                  ? value === answer.id ? "selected" : ""
                  : checkboxValue.includes(answer.id) ? "selected" : ""
              }`}
              key={answer.id || answerIndex}
            >
              <input
                type={questionType === "multipleChoice" ? "radio" : "checkbox"}
                name={question.id}
                checked={questionType === "multipleChoice" ? value === answer.id : checkboxValue.includes(answer.id)}
                disabled={disabled}
                onChange={(event) => {
                  if (questionType === "multipleChoice") onChange(answer.id);
                  else toggleCheckbox(answer.id, event.target.checked);
                }}
              />
              <span>{String.fromCharCode(65 + answerIndex)}.</span>
              <em>{answer.text || `Đáp án ${answerIndex + 1}`}</em>
            </label>
          ))}
        </div>
      ) : questionType === "shortAnswer" ? (
        <input
          className="assignment-exam-text-answer"
          disabled={disabled}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nhập câu trả lời..."
        />
      ) : (
        <textarea
          className="assignment-exam-long-answer"
          disabled={disabled}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nhập câu trả lời..."
        />
      )}
    </article>
  );
}

function GradesCard({ admin, user, course, updateCourse }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const automaticGradebooks = buildAutomaticGradebooks(course);
  const visibleGradebooks = admin ? automaticGradebooks : automaticGradebooks.filter(isGradebookPublished);
  const [gradingContext, setGradingContext] = useState(null);
  const summaryPublished = course.summaryGradebookPublished === true;
  const showSummaryGradebook = admin || summaryPublished;

  function saveExamGrades(nextRows) {
    if (!gradingContext) return;
    const { assignment, book, exam } = gradingContext;
    const bookType = examGradebookType(book, assignment);
    const assignmentFormat = normalizeAssignmentFormat(book.assignmentFormat || assignment?.format);
    const savePromise = updateCourse((current) => ({
      ...current,
      gradebooks: upsertGradebookRecord(current.gradebooks || [], book, {
        title: gradebookTitleWithRatio(book, current, bookType),
        type: bookType,
        assignmentFormat,
        examId: assignment?.examId || book.examId || "",
        examSnapshot: exam,
        rows: nextRows
      })
    }), { toast: "Đã lưu điểm đề thi." });
    setGradingContext((current) => current ? {
      ...current,
      book: { ...current.book, rows: nextRows },
      initialRows: nextRows
    } : current);
    return savePromise;
  }

  return (
    <>
      <PanelTitle title={uiCardLabel(language, "grades", "Bảng điểm")} />
      {gradingContext ? (
        <ExamGradingWorkspace
          course={course}
          assignment={gradingContext.assignment}
          book={gradingContext.book}
          exam={gradingContext.exam}
          bookType={examGradebookType(gradingContext.book, gradingContext.assignment)}
          initialRows={gradingContext.initialRows || gradingContext.book.rows || []}
          onBack={() => setGradingContext(null)}
          onSave={saveExamGrades}
        />
      ) : (
        <div className="list-stack">
          {showSummaryGradebook && (
            <SummaryGradebookItem admin={admin} user={user} course={course} updateCourse={updateCourse} />
          )}
          {!admin && visibleGradebooks.length === 0 && !showSummaryGradebook && (
            <div className="empty-state compact-empty">{t("noPublishedGradebooks", "Chưa có bảng điểm được publish.")}</div>
          )}
          {visibleGradebooks.map((book) => (
            <GradebookItem
              key={book.id}
              admin={admin}
              user={user}
              book={book}
              course={course}
              updateCourse={updateCourse}
              onOpenExamGrading={(context) => setGradingContext(context)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function assignmentExamSessionStorageKey(courseId, email) {
  return `${ASSIGNMENT_EXAM_SESSION_PREFIX}${courseId || "course"}:${normalizeEmail(email || "")}`;
}

function loadLocalAssignmentExamSession(courseId, email) {
  if (!courseId || !email) return null;
  try {
    const saved = localStorage.getItem(assignmentExamSessionStorageKey(courseId, email));
    if (!saved) return null;
    const session = JSON.parse(saved);
    if (!session?.assignmentId || !Number(session.startedAtMillis || 0)) return null;
    return {
      assignmentId: session.assignmentId,
      startedAtMillis: Number(session.startedAtMillis),
      answers: session.answers && typeof session.answers === "object" ? session.answers : {},
      cloudAttemptId: session.cloudAttemptId || "",
      hidden: false
    };
  } catch {
    return null;
  }
}

function saveLocalAssignmentExamSession(courseId, email, session) {
  if (!courseId || !email || !session?.assignmentId) return;
  localStorage.setItem(assignmentExamSessionStorageKey(courseId, email), JSON.stringify({
    assignmentId: session.assignmentId,
    startedAtMillis: Number(session.startedAtMillis || Date.now()),
    answers: session.answers || {},
    cloudAttemptId: session.cloudAttemptId || "",
    savedAtMillis: Date.now()
  }));
}

function clearLocalAssignmentExamSession(courseId, email) {
  if (!courseId || !email) return;
  localStorage.removeItem(assignmentExamSessionStorageKey(courseId, email));
}

function isCompletedAssignmentSubmission(submission) {
  return submission?.status !== "started";
}

function isReviewableExamSubmission(submission) {
  return submission?.type === "exam" && submission?.status !== "started";
}

function findActiveExamAttempt(assignments = [], email = "") {
  const normalizedEmail = normalizeEmail(email);
  const attempts = [];
  assignments.forEach((assignment) => {
    if (normalizeAssignmentFormat(assignment.format) !== "exam") return;
    const submissions = assignment.submissions || [];
    const submittedStarts = new Set(submissions
      .filter((submission) => normalizeEmail(submission.email) === normalizedEmail && submission.type === "exam" && submission.status === "submitted")
      .map((submission) => String(submission.examStartedAtMillis || "")));
    submissions.forEach((submission) => {
      if (normalizeEmail(submission.email) !== normalizedEmail) return;
      if (submission.type !== "exam" || submission.status !== "started") return;
      const startedAt = Number(submission.examStartedAtMillis || submission.submittedAtMillis || 0);
      if (!startedAt || submittedStarts.has(String(startedAt))) return;
      attempts.push({
        ...submission,
        assignmentId: assignment.id,
        examStartedAtMillis: startedAt
      });
    });
  });
  return attempts.sort((first, second) => Number(second.examStartedAtMillis || 0) - Number(first.examStartedAtMillis || 0))[0] || null;
}

function findStartedExamSubmissionForSession(assignment, email, session) {
  const normalizedEmail = normalizeEmail(email);
  const startedAt = Number(session?.startedAtMillis || 0);
  if (!assignment || !normalizedEmail || !startedAt) return null;
  return (assignment.submissions || []).find((submission) => (
    normalizeEmail(submission.email) === normalizedEmail
    && submission.type === "exam"
    && submission.status === "started"
    && Number(submission.examStartedAtMillis || submission.submittedAtMillis || 0) === startedAt
  )) || null;
}

function mergeAssignmentSubmissionList(primary = [], secondary = []) {
  const byKey = new Map();
  [...primary, ...secondary].filter(Boolean).forEach((submission) => {
    byKey.set(assignmentSubmissionMergeKey(submission), submission);
  });
  return cleanAssignmentSubmissionList([...byKey.values()]);
}

function cleanAssignmentSubmissionList(submissions = []) {
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

function assignmentSubmissionMergeKey(submission) {
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

function normalizeAssignmentFormat(format) {
  if (format === "upload") return "uploadFile";
  return ASSIGNMENT_FORMATS.some((item) => item.value === format) ? format : "uploadFile";
}

function isReviewerDiscussionFormat(format) {
  return normalizeAssignmentFormat(format) === "reviewerDiscussion";
}

function isReviewerScoreFormat(format) {
  return normalizeAssignmentFormat(format) === "reviewerScore";
}

function isReviewerTopicFormat(format) {
  return isReviewerDiscussionFormat(format) || isReviewerScoreFormat(format);
}

function assignmentFormatLabel(format) {
  return ASSIGNMENT_FORMATS.find((item) => item.value === normalizeAssignmentFormat(format))?.label || "Upload file";
}

function optionLanguageLabel(option, language) {
  return normalizeLanguage(language) === "en" ? (option.labelEn || option.label) : option.label;
}

function normalizeAssignmentReviewerType(value) {
  return ASSIGNMENT_REVIEWER_OPTIONS.some((item) => item.value === value) ? value : "none";
}

function normalizeDiscussionTopicType(value, format = "reviewerDiscussion") {
  if (!isReviewerTopicFormat(format)) return "none";
  const normalized = normalizeAssignmentReviewerType(value);
  return normalized === "none" ? "group" : normalized;
}

function updateAssignmentDraftFormat(draft, format) {
  const nextFormat = normalizeAssignmentFormat(format);
  return {
    ...draft,
    format: nextFormat,
    reviewerType: isReviewerTopicFormat(nextFormat)
      ? normalizeDiscussionTopicType(draft.reviewerType, nextFormat)
      : "none"
  };
}

function assignmentReviewerLabel(value, language = "vi") {
  const option = ASSIGNMENT_REVIEWER_OPTIONS.find((item) => item.value === normalizeAssignmentReviewerType(value));
  if (!option) return normalizeLanguage(language) === "en" ? "Not used" : "Không sử dụng";
  return optionLanguageLabel(option, language);
}

function findCourseMember(course, email) {
  const normalizedEmail = normalizeEmail(email);
  return (course?.members || []).find((member) => normalizeEmail(member.email) === normalizedEmail) || null;
}

function buildAssignmentReviewerTargets(course, assignment) {
  const targetType = normalizeDiscussionTopicType(assignment?.reviewerType, assignment?.format);
  if (targetType === "none") return [];
  const membersByEmail = new Map(
    (course.members || [])
      .filter((member) => member.status === "accepted")
      .map((member) => [normalizeEmail(member.email), member])
  );

  if (targetType === "personal") {
    return (course.personalTopics || [])
      .map((item) => {
        const email = normalizeEmail(item.email);
        const member = membersByEmail.get(email);
        return {
          key: `personal:${email}`,
          targetType,
          label: member?.name || item.name || item.email || "Cá nhân",
          topic: String(item.topic || "").trim(),
          memberEmails: email ? [email] : []
        };
      })
      .filter((target) => target.topic)
      .sort(compareAssignmentReviewerTargets);
  }

  if (targetType === "intergroup") {
    return buildIntergroupTopicCards(course, buildGroupTopicCards(course))
      .map((link) => ({
        key: `intergroup:${link.rawIntergroup || link.key}`,
        targetType,
        label: link.label,
        topic: String(link.topic?.topic || "").trim(),
        rawIntergroup: link.rawIntergroup,
        memberEmails: uniqueValues(link.groups.flatMap((group) => group.members.map((member) => normalizeEmail(member.email))))
      }))
      .filter((target) => target.topic)
      .sort(compareAssignmentReviewerTargets);
  }

  return buildGroupTopicCards(course)
    .map((group) => ({
      key: `group:${group.rawGroup || group.key}`,
      targetType,
      label: group.label,
      topic: String(group.topic?.topic || "").trim(),
      rawGroup: group.rawGroup,
      memberEmails: group.members.map((member) => normalizeEmail(member.email))
    }))
    .filter((target) => target.topic)
    .sort(compareAssignmentReviewerTargets);
}

function compareAssignmentReviewerTargets(first, second) {
  return compareNumericText(first.rawGroup ?? first.rawIntergroup, second.rawGroup ?? second.rawIntergroup)
    || String(first.label || "").localeCompare(String(second.label || ""), "vi", { numeric: true, sensitivity: "base" })
    || String(first.topic || "").localeCompare(String(second.topic || ""), "vi", { numeric: true, sensitivity: "base" });
}

function buildReviewerQuestionScope(course, reviewerType, user) {
  const scopeType = baseGradebookType(reviewerType);
  const normalizedEmail = normalizeEmail(user?.email || "");
  const member = findCourseMember(course, normalizedEmail);
  if (!member) {
    return {
      key: `lecturer:${normalizedEmail || "unknown"}`,
      label: "Lecturer"
    };
  }
  if (scopeType === "group") {
    const rawGroup = String(member?.group ?? "").trim();
    return {
      key: rawGroup ? `group:${rawGroup}` : `group:none:${normalizedEmail}`,
      label: rawGroup ? groupTopicLabel(rawGroup) : "Chưa có nhóm"
    };
  }

  if (scopeType === "intergroup") {
    const groupCards = buildGroupTopicCards(course);
    const intergroupCard = buildIntergroupTopicCards(course, groupCards).find((link) => (
      link.groups.some((group) => group.members.some((item) => normalizeEmail(item.email) === normalizedEmail))
    ));
    const rawIntergroup = String(intergroupCard?.rawIntergroup || "").trim();
    return {
      key: rawIntergroup ? `intergroup:${rawIntergroup}` : `intergroup:none:${normalizedEmail}`,
      label: rawIntergroup ? `Liên nhóm ${rawIntergroup}` : "Chưa có liên nhóm"
    };
  }

  return {
    key: `personal:${normalizedEmail}`,
    label: member?.name || user?.displayName || user?.email || "Cá nhân"
  };
}

function mergeAssignmentReviewerQuestionList(primary = [], secondary = []) {
  const byKey = new Map();
  [...primary, ...secondary].filter(Boolean).forEach((question) => {
    byKey.set(reviewerQuestionMergeKey(question), question);
  });
  return cleanAssignmentReviewerQuestions([...byKey.values()]);
}

function cleanAssignmentReviewerQuestions(questions = []) {
  return questions
    .filter((question) => question?.text || question?.id)
    .map((question) => ({
      ...question,
      answered: Boolean(question.answered),
      createdAtMillis: Number(question.createdAtMillis || 0)
    }))
    .sort((first, second) => Number(first.createdAtMillis || 0) - Number(second.createdAtMillis || 0));
}

function reviewerQuestionMergeKey(question) {
  return question?.id
    || `${question?.assignmentId || ""}-${question?.targetKey || ""}-${question?.questionScopeKey || ""}-${question?.email || ""}-${question?.createdAtMillis || ""}-${question?.text || ""}`;
}

function groupAssignmentReviewerQuestions(questions = []) {
  const groups = new Map();
  questions.forEach((question) => {
    const key = question.questionScopeKey || `personal:${normalizeEmail(question.email || "")}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: key.startsWith("lecturer:")
          ? "Lecturer"
          : (question.questionScopeLabel || question.name || question.email || "Câu hỏi"),
        questions: []
      });
    }
    groups.get(key).questions.push(question);
  });
  return [...groups.values()].sort((first, second) => (
    String(first.label || "").localeCompare(String(second.label || ""), "vi", { numeric: true, sensitivity: "base" })
  ));
}

function buildReviewerQuestionStats(questions = []) {
  return groupAssignmentReviewerQuestions(questions).map((group) => {
    const askers = new Map();
    group.questions.forEach((question) => {
      const key = normalizeEmail(question.email || "") || question.name || "unknown";
      if (!askers.has(key)) {
        askers.set(key, {
          key,
          name: question.name || question.email || "Người đặt câu hỏi",
          email: normalizeEmail(question.email || ""),
          total: 0,
          answered: 0
        });
      }
      const asker = askers.get(key);
      asker.total += 1;
      if (question.answered) asker.answered += 1;
    });
    return {
      key: group.key,
      label: group.label,
      total: group.questions.length,
      askers: [...askers.values()].sort((first, second) => (
        second.total - first.total
        || String(first.name || "").localeCompare(String(second.name || ""), "vi", { numeric: true, sensitivity: "base" })
      ))
    };
  });
}

function updateReviewerQuestionLocal(updateCourse, assignmentId, question, patch) {
  updateCourse((current) => ({
    ...current,
    assignments: (current.assignments || []).map((item) => {
      if (item.id !== assignmentId) return item;
      return {
        ...item,
        reviewerQuestions: cleanAssignmentReviewerQuestions((item.reviewerQuestions || []).map((candidate) => (
          reviewerQuestionMergeKey(candidate) === reviewerQuestionMergeKey(question)
            ? { ...candidate, ...patch }
            : candidate
        )))
      };
    })
  }), { sync: false });
}

function findAssignmentExam(assignment, exams = []) {
  const examId = assignment?.examId || "";
  return exams.find((exam) => String(exam.id || "") === String(examId)) || assignmentExamSnapshot(assignment);
}

function assignmentExamSnapshot(assignment) {
  if (!assignment?.examSnapshot) return null;
  return createAssignmentExamSnapshot(assignment.examSnapshot);
}

function updateAssignmentExam(updateCourse, assignmentId, examId, exams = []) {
  const exam = exams.find((item) => String(item.id || "") === String(examId || ""));
  updateCourse((current) => ({
    ...current,
    assignments: normalizeAssignmentRatios((current.assignments || []).map((item) => (
      item.id === assignmentId
        ? {
            ...item,
            examId,
            examSnapshot: exam ? createAssignmentExamSnapshot(exam) : null
          }
        : item
    )))
  }));
}

function createAssignmentExamSnapshot(exam) {
  if (!exam) return null;
  const normalizedExam = {
    ...exam,
    title: exam.title || "Đề thi",
    description: exam.description || "",
    duration: exam.duration || "",
    parts: normalizeExamParts(exam.parts)
  };
  return {
    id: normalizedExam.id || "",
    title: normalizedExam.title,
    description: normalizedExam.description,
    duration: normalizedExam.duration,
    parts: normalizedExam.parts.map((part) => ({
      id: part.id || crypto.randomUUID(),
      questionType: part.questionType || "multipleChoice",
      pointsPerQuestion: part.pointsPerQuestion || "",
      writtenPointOptions: part.writtenPointOptions || "",
      questions: normalizeExamQuestions(part.questions).map((question) => ({
        id: question.id || crypto.randomUUID(),
        text: question.text || "",
        order: question.order || 0,
        answers: normalizeExamAnswers(question.answers).map((answer) => ({
          id: answer.id || crypto.randomUUID(),
          text: answer.text || "",
          order: answer.order || 0
        }))
      }))
    }))
  };
}

function examTotalQuestionCount(exam) {
  return normalizeExamParts(exam?.parts).reduce((total, part) => total + normalizeExamQuestions(part.questions).length, 0);
}

function parseExamDurationSeconds(duration) {
  const raw = String(duration || "").trim();
  if (!raw) return 0;
  if (!raw.includes(":")) {
    const minutes = Number(raw);
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0;
  }
  const parts = raw.split(":").map((part) => Number(part.trim()));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return 0;
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

function formatExamDurationLabel(duration, language = "vi") {
  const seconds = parseExamDurationSeconds(duration);
  return seconds ? formatCountdown(seconds) : uiText(language, "noDeadline", "Không giới hạn");
}

function examRemainingSeconds(exam, session) {
  const durationSeconds = parseExamDurationSeconds(exam?.duration);
  if (!durationSeconds || !session?.startedAtMillis) return durationSeconds;
  const elapsedSeconds = Math.floor((Date.now() - session.startedAtMillis) / 1000);
  return Math.max(0, durationSeconds - elapsedSeconds);
}

function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, "0")).join(":");
  }
  return [minutes, remainingSeconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function examQuestionResponseKey(part, question) {
  return `${part?.id || "part"}:${question?.id || "question"}`;
}

function assignmentTitleWithRatio(assignment) {
  return `${assignment?.title || "Bài tập"} (Tỉ lệ ${assignment?.ratio || "0"}%)`;
}

function assignmentAnnouncementContent(assignment) {
  const lines = [`Bài tập: ${assignment?.title || "Bài tập"}`];
  const content = String(assignment?.content || "").trim();
  if (content) lines.push(`Nội dung: ${content}`);
  const dueAtMillis = assignmentDeadlineMillis(assignment);
  if (dueAtMillis) lines.push(`Deadline: ${formatDateTime24(dueAtMillis)}`);
  return lines.join("\n");
}

function createReviewerQuestionPromptAnnouncement({ assignment, target, topicType, assigneeType, user, createdAtMillis }) {
  return {
    id: crypto.randomUUID(),
    author: user.email,
    authorName: user.displayName || user.email,
    authorPhotoURL: user.photoURL || "",
    role: "admin",
    content: reviewerQuestionPromptContent({ target, topicType, assigneeType }),
    pinned: false,
    attachments: [],
    publishAsMaterial: false,
    createdAt: formatDateTime24(createdAtMillis),
    createdAtMillis,
    publishAtMillis: createdAtMillis,
    scheduledAt: "",
    scheduledAtMillis: 0,
    assignmentId: assignment.id,
    reviewerQuestionTargetKey: target.key,
    reviewerQuestionTargetLabel: target.label,
    reviewerQuestionTargetTopic: target.topic,
    reviewerQuestionType: topicType,
    reviewerQuestionAssigneeType: assigneeType,
    announcementType: "reviewerQuestionPrompt"
  };
}

function reviewerQuestionPromptContent({ target, topicType, assigneeType }) {
  return [
    `Hãy đặt câu hỏi cho Topic "${target.topic}".`,
    `${gradebookTypeLabels[target.targetType] || "Topic"}: ${target.label}`,
    `Topic: ${assignmentReviewerLabel(topicType)}`,
    `Assignee: ${gradebookTypeLabels[assigneeType] || "Cá nhân"}`
  ].join("\n");
}

function announcementDisplayContent(announcement) {
  const content = String(announcement?.content || "");
  if (!announcement?.assignmentId) return content;
  return content
    .replace(/^Tiêu đề bài tập:/gm, "Bài tập:")
    .replace(/^Nội dung giao bài:/gm, "Nội dung:");
}

function isGradebookPublishAnnouncement(announcement) {
  const content = String(announcement?.content || "").trim();
  return announcement?.announcementType === "gradebookPublish"
    || Boolean(announcement?.gradebookTitle)
    || content.toLowerCase().startsWith("giảng viên vừa công bố");
}

function assignmentDateTimeLocalValue(assignment) {
  if (assignment?.dueAt) return assignment.dueAt;
  const dueAtMillis = Number(assignment?.dueAtMillis || 0);
  if (!dueAtMillis) return "";
  const date = new Date(dueAtMillis);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function assignmentDeadlineMillis(assignment) {
  const dueAtMillis = Number(assignment?.dueAtMillis || 0);
  if (dueAtMillis) return dueAtMillis;
  const dueAt = assignment?.dueAt;
  if (!dueAt) return 0;
  const parsed = new Date(dueAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function assignmentDeadlineLabel(assignment) {
  const dueAtMillis = assignmentDeadlineMillis(assignment);
  return dueAtMillis ? formatDateTime24(dueAtMillis) : "";
}

function isAssignmentSubmissionLate(assignment, submission) {
  const dueAtMillis = assignmentDeadlineMillis(assignment);
  if (!dueAtMillis) return false;
  const submittedAtMillis = Number(submission?.submittedAtMillis || 0);
  if (submittedAtMillis) return submittedAtMillis > dueAtMillis;
  return Boolean(submission?.late);
}

function assignmentSubmissionName(course, submission, currentUser) {
  return assignmentSubmissionIdentity(course, submission, currentUser).name;
}

function assignmentSubmissionIdentity(course, submission, currentUser) {
  const email = normalizeEmail(submission?.email || "");
  const members = course?.members || [];
  const member = members.find((item) => normalizeEmail(item.email) === email);
  const profile = course?.profiles?.[submission?.email]
    || course?.profiles?.[email]
    || course?.profiles?.[member?.email]
    || {};
  const currentUserMatches = normalizeEmail(currentUser?.email || "") === email;
  const fallbackEmail = submission?.email || member?.email || (currentUserMatches ? currentUser?.email : "") || "";
  return {
    name: submission?.name
      || member?.name
      || profile?.displayName
      || (currentUserMatches ? currentUser?.displayName || currentUser?.email : "")
      || fallbackEmail,
    studentId: submission?.studentId
      || member?.studentId
      || profile?.studentId
      || (currentUserMatches ? currentUser?.studentId : "")
      || "",
    email: fallbackEmail
  };
}

function normalizeAssignmentRatios(assignments) {
  if (!assignments.length) return [];
  const normalized = assignments.map((assignment) => ({
    ...assignment,
    type: normalizeGradebookType(assignment.type, "personal"),
    format: normalizeAssignmentFormat(assignment.format)
  }));
  const lastIndex = normalized.length - 1;

  for (let index = 0; index < lastIndex; index += 1) {
    normalized[index].ratio = cleanRatioInput(normalized[index].ratio ?? defaultAssignmentRatio(normalized, index));
  }

  const assignedTotal = normalized
    .slice(0, lastIndex)
    .reduce((total, assignment) => total + parseRatioNumber(assignment.ratio), 0);
  normalized[lastIndex].ratio = formatRatioNumber(100 - assignedTotal);
  return normalized;
}

function defaultAssignmentRatio(assignments, index) {
  if (index === 0) return "100";
  const previousTotal = assignments
    .slice(0, index)
    .reduce((total, assignment) => total + parseRatioNumber(assignment.ratio), 0);
  return formatRatioNumber(Math.max(0, 100 - previousTotal));
}

function cleanRatioInput(value) {
  return String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".");
}

function parseRatioNumber(value) {
  const parsed = Number(cleanRatioInput(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRatioNumber(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

const gradebookTypeLabels = {
  personal: "Cá nhân",
  group: "Nhóm",
  intergroup: "Liên nhóm",
  personalTopic: "Cá nhân (Topic)",
  groupTopic: "Nhóm (Topic)",
  intergroupTopic: "Liên nhóm (Topic)"
};
const gradebookTypeLabelsEn = {
  personal: "Personal",
  group: "Group",
  intergroup: "Intergroup",
  personalTopic: "Personal (Topic)",
  groupTopic: "Group (Topic)",
  intergroupTopic: "Intergroup (Topic)"
};

function gradebookTypeLabel(type, language = "vi", fallback = "Cá nhân") {
  const normalizedType = normalizeGradebookType(type, "personal");
  if (normalizeLanguage(language) === "en") return gradebookTypeLabelsEn[normalizedType] || fallback;
  return gradebookTypeLabels[normalizedType] || fallback;
}

function normalizeGradebookType(type, fallback = "personal") {
  return gradebookTypeLabels[type] ? type : fallback;
}

function baseGradebookType(type) {
  const normalizedType = normalizeGradebookType(type, "personal");
  if (normalizedType === "personalTopic") return "personal";
  if (normalizedType === "groupTopic") return "group";
  if (normalizedType === "intergroupTopic") return "intergroup";
  return normalizedType;
}

function gradebookTypeUsesTopic(type) {
  return ["personalTopic", "groupTopic", "intergroupTopic"].includes(normalizeGradebookType(type, "personal"));
}

function findStoredGradebook(course, assignmentId) {
  return [...(course.gradebooks || [])]
    .reverse()
    .find((book) => String(book.assignmentId || "") === String(assignmentId || ""));
}

function assignmentGradebookType(assignment, storedBook) {
  if (gradebookTypeLabels[assignment?.type]) return assignment.type;
  if (gradebookTypeLabels[storedBook?.type]) return storedBook.type;
  return "personal";
}

function buildAutomaticGradebook(course, assignment) {
  const storedBook = findStoredGradebook(course, assignment.id);
  const type = assignmentGradebookType(assignment, storedBook);
  const assignmentFormat = normalizeAssignmentFormat(assignment.format);
  const id = storedBook?.id || `gradebook-${assignment.id}`;
  return {
    ...(storedBook || {}),
    id,
    assignmentId: assignment.id,
    title: `Điểm ${assignmentTitleWithRatio(assignment)} (${gradebookTypeLabels[type]})`,
    type,
    assignmentFormat,
    examId: assignment.examId || storedBook?.examId || "",
    examSnapshot: assignmentFormat === "exam" ? assignmentExamSnapshot(assignment) : null,
    published: storedBook?.published === true,
    rows: storedBook?.rows || [],
    autoGenerated: true
  };
}

function buildAutomaticGradebooks(course) {
  return normalizeAssignmentRatios(course.assignments || []).map((assignment) => buildAutomaticGradebook(course, assignment));
}

async function createGradebookPublishAnnouncement(course, user, gradebookTitle) {
  const createdAtMillis = Date.now();
  const announcement = {
    id: crypto.randomUUID(),
    author: user.email,
    authorName: user.displayName || user.email,
    authorPhotoURL: user.photoURL || "",
    role: "admin",
    content: gradebookPublishAnnouncementContent(gradebookTitle),
    pinned: false,
    attachments: [],
    publishAsMaterial: false,
    createdAt: formatDateTime24(createdAtMillis),
    createdAtMillis,
    publishAtMillis: createdAtMillis,
    scheduledAt: "",
    scheduledAtMillis: 0,
    announcementType: "gradebookPublish",
    gradebookTitle: gradebookTitle || ""
  };
  return hasFirebaseConfig
    ? saveAnnouncementToCloud(course.id, announcement)
    : announcement;
}

function gradebookPublishAnnouncementContent(gradebookTitle) {
  const title = String(gradebookTitle || "bảng điểm").trim();
  if (title.toLowerCase().includes("tổng kết")) {
    return `Giảng viên vừa công bố ${title}.`;
  }
  const scoreTitle = title.replace(/^điểm\s+/i, "").trim();
  return `Giảng viên vừa công bố điểm ${scoreTitle || title}.`;
}

function upsertGradebookRecord(gradebooks, book, patch) {
  const records = gradebooks || [];
  const assignmentId = book.assignmentId || "";
  const bookId = book.id || `gradebook-${assignmentId}`;
  const hasMatchingId = records.some((item) => String(item.id || "") === String(bookId || ""));
  const matches = (item) => hasMatchingId
    ? String(item.id || "") === String(bookId || "")
    : String(item.assignmentId || "") === String(assignmentId || "");
  const baseRecord = {
    id: bookId,
    assignmentId,
    title: book.title || "",
    type: normalizeGradebookType(book.type, "personal"),
    assignmentFormat: normalizeAssignmentFormat(book.assignmentFormat),
    examId: book.examId || "",
    examSnapshot: book.examSnapshot || null,
    published: book.published === true,
    rows: book.rows || []
  };
  if (records.some(matches)) {
    return records.map((item) => matches(item) ? { ...item, ...baseRecord, ...patch, id: item.id || bookId } : item);
  }
  return [...records, { ...baseRecord, ...patch }];
}

function gradebookTitleWithRatio(book, course, bookType) {
  const assignment = (course.assignments || []).find((item) => item.id === book.assignmentId);
  if (!assignment) return book.title;
  return `Điểm ${assignmentTitleWithRatio(assignment)} (${gradebookTypeLabels[bookType] || gradebookTypeLabels.personal})`;
}

function gradebookRatioLabel(ratio, language = "vi") {
  const value = ratio || "0";
  return normalizeLanguage(language) === "en" ? `(Weight ${value}%)` : `(Tỉ lệ ${value}%)`;
}

function gradebookAssignmentTitleWithRatio(assignment, language = "vi") {
  if (!assignment) return normalizeLanguage(language) === "en" ? "assignment" : "bài tập";
  return `${assignment.title || (normalizeLanguage(language) === "en" ? "Assignment" : "Bài tập")} ${gradebookRatioLabel(assignment.ratio, language)}`;
}

function gradebookDisplayTitleWithRatio(book, course, bookType, language = "vi") {
  const assignment = (course.assignments || []).find((item) => item.id === book.assignmentId);
  if (!assignment) return uiLiteral(language, book.title || "");
  const typeLabel = gradebookTypeLabel(bookType, language);
  return `${uiText(language, "gradePrefix", "Điểm")} ${gradebookAssignmentTitleWithRatio(assignment, language)} (${typeLabel})`;
}

function isGradebookPublished(book) {
  return book?.published === true;
}

function createGradebook(course, updateCourse, assignmentId, type) {
  const assignment = course.assignments.find((item) => item.id === assignmentId);
  const normalizedType = gradebookTypeLabels[type] ? type : "group";
  const rows = buildGradebookRowsForSave(course, normalizedType, []);
  if (rows.length === 0) return;
  updateCourse((current) => ({
    ...current,
    gradebooks: [
      ...(current.gradebooks || []),
      {
        id: crypto.randomUUID(),
        assignmentId,
        title: assignment ? `Điểm ${assignmentTitleWithRatio(assignment)} (${gradebookTypeLabels[normalizedType]})` : `Điểm bài tập (${gradebookTypeLabels[normalizedType]})`,
        type: normalizedType,
        published: false,
        rows
      }
    ]
  }));
}

function SummaryGradebookItem({ admin, user, course, updateCourse }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const allAssignments = normalizeAssignmentRatios(course.assignments || []);
  const assignments = admin ? allAssignments : allAssignments.filter((assignment) => findSummaryGradebook(course, assignment.id, admin));
  const rows = buildSummaryGradeRows(course, assignments, admin, user);
  const colSpan = assignments.length + 4;
  const published = course.summaryGradebookPublished === true;

  async function togglePublish() {
    if (!admin || !updateCourse || publishing) return;
    setPublishError("");
    if (published) {
      updateCourse((current) => ({
        ...current,
        summaryGradebookPublished: false
      }), { toast: "Đã ẩn bảng điểm tổng kết." });
      return;
    }
    setPublishing(true);
    try {
      const savedAnnouncement = await createGradebookPublishAnnouncement(course, user, "Bảng điểm tổng kết");
      await updateCourse((current) => ({
        ...current,
        summaryGradebookPublished: true,
        announcements: [savedAnnouncement, ...(current.announcements || [])]
      }), { toast: "Đã publish bảng điểm tổng kết và tạo thông báo." });
    } catch (error) {
      console.error(error);
      setPublishError("Không thể publish bảng điểm tổng kết hoặc tạo thông báo. Vui lòng thử lại.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <article className="expand-card summary-gradebook">
      <div className="assignment-head summary-grade-head">
        <button onClick={() => setOpen(!open)}>
          <strong>{t("summaryGradebookTitle", "BẢNG ĐIỂM TỔNG KẾT")}</strong>
          <small>{assignments.length ? `${assignments.length} ${t("assignmentsLower", "bài tập")}` : t("noAssignments", "Chưa có bài tập")}</small>
          {admin && <small>{published ? t("published", "Đã publish") : t("draft", "Nháp")}</small>}
        </button>
        {admin && assignments.length > 0 && (
          <button className="export-button summary-export-button" type="button" onClick={() => exportSummaryGradebook(course, assignments, rows)}>
            <Download size={15} /> Export Excel
          </button>
        )}
        {admin && (
          <button
            className={`join-action compact publish-score-button ${published ? "is-published" : ""}`}
            type="button"
            onClick={togglePublish}
            disabled={publishing}
          >
            {publishing ? "Publishing" : (published ? "Unpublish" : "Publish")}
          </button>
        )}
      </div>
      {publishError && <p className="error-text">{publishError}</p>}
      {open && (
        assignments.length === 0 ? (
          <div className="empty-state compact-empty">{t("noSummaryGradeAssignments", "Chưa có bài tập để tính điểm tổng kết.")}</div>
        ) : (
          <div className="summary-grade-scroll">
            <table className="data-table summary-grade-table">
              <thead>
                <tr>
                  <th className="stt-col">{t("stt", "STT")}</th>
                  <th>{t("fullName", "Họ tên")}</th>
                  <th>{t("studentId", "Mã số")}</th>
                  {assignments.map((assignment) => {
                    const book = findSummaryGradebook(course, assignment.id, admin);
                    const bookType = gradebookTypeLabels[book?.type] ? book.type : "";
                    return (
                  <th key={assignment.id}>
                    <span>{assignment.title}</span>
                    <small>{gradebookRatioLabel(assignment.ratio, language)}{bookType ? ` · ${gradebookTypeLabel(bookType, language)}` : ""}</small>
                  </th>
                );
              })}
                  <th>{t("finalScore", "Final Score")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={colSpan}>{t("noEligibleLearners", "Chưa có học viên phù hợp.")}</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.member.email}>
                    <td>{row.member.order}</td>
                    <td>{row.member.name || row.member.email}</td>
                    <td>{row.member.studentId}</td>
                    {row.components.map((component) => (
                      <td className="score-cell" key={component.assignmentId}>{component.display}</td>
                    ))}
                    <td className="final-score-cell">{row.finalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </article>
  );
}

function GradebookItem({ admin, user, book, course, updateCourse, onOpenExamGrading }) {
  const requestConfirm = useConfirmAction();
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const [open, setOpen] = useState(false);
  const [draftRows, setDraftRows] = useState(book.rows || []);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const assignment = gradebookAssignment(course, book);
  const assignmentFormat = normalizeAssignmentFormat(book.assignmentFormat || assignment?.format);
  const examGradebook = isExamGradebook(book, assignment);
  const availableExams = Array.isArray(course.exams) && course.exams.length > 0 ? normalizeExams(course.exams) : [];
  const exam = examGradebook ? findAssignmentExam(assignment, availableExams) : null;
  const bookType = normalizeGradebookType(book.type, "personal");
  const bookBaseType = baseGradebookType(bookType);
  const showTopic = gradebookTypeUsesTopic(bookType);
  const published = isGradebookPublished(book);

  useEffect(() => {
    setDraftRows(book.rows || []);
    setDirty(false);
  }, [book.id, book.rows]);

  function changeDraftScore(rowKey, score) {
    setDirty(true);
    setDraftRows((current) => upsertGradebookRow(current, rowKey, { score: sanitizeScoreInput(score) }));
  }

  function changeDraftBonus(rowKey, email, bonus) {
    setDirty(true);
    setDraftRows((current) => {
      const row = findGradebookRow(current, rowKey) || { key: rowKey, score: "", bonuses: {} };
      return upsertGradebookRow(current, rowKey, {
        bonuses: {
          ...(row.bonuses || {}),
          [email]: sanitizeScoreInput(bonus)
        }
      });
    });
  }

  function saveScores() {
    const nextRows = examGradebook
      ? buildExamGradeRowsForSave(course, assignment, exam, draftRows, bookType)
      : buildGradebookRowsForSave(course, bookType, draftRows);
    const savePromise = updateCourse((current) => ({
      ...current,
      gradebooks: upsertGradebookRecord(current.gradebooks || [], book, {
        title: gradebookTitleWithRatio(book, current, bookType),
        type: bookType,
        assignmentFormat,
        examId: assignment?.examId || book.examId || "",
        examSnapshot: examGradebook ? exam : null,
        rows: nextRows
      })
    }), { toast: true });
    setDraftRows(nextRows);
    setDirty(false);
    return savePromise;
  }

  async function publishScores() {
    if (publishing) return;
    const nextRows = examGradebook
      ? buildExamGradeRowsForSave(course, assignment, exam, draftRows, bookType)
      : buildGradebookRowsForSave(course, bookType, draftRows);
    const gradebookTitle = gradebookTitleWithRatio(book, course, bookType);
    setPublishing(true);
    setPublishError("");
    try {
      const savedAnnouncement = await createGradebookPublishAnnouncement(course, user, gradebookTitle);
      await updateCourse((current) => ({
        ...current,
        gradebooks: upsertGradebookRecord(current.gradebooks || [], book, {
          title: gradebookTitleWithRatio(book, current, bookType),
          type: bookType,
          assignmentFormat,
          examId: assignment?.examId || book.examId || "",
          examSnapshot: examGradebook ? exam : null,
          rows: nextRows,
          published: true
        }),
        announcements: [savedAnnouncement, ...(current.announcements || [])]
      }), { toast: "Đã publish bảng điểm và tạo thông báo." });
      setDraftRows(nextRows);
      setDirty(false);
    } catch (error) {
      console.error(error);
      setPublishError("Không thể publish bảng điểm hoặc tạo thông báo. Vui lòng thử lại.");
    } finally {
      setPublishing(false);
    }
  }

  function unpublishScores() {
    updateCourse((current) => ({
      ...current,
      gradebooks: upsertGradebookRecord(current.gradebooks || [], book, {
        title: gradebookTitleWithRatio(book, current, bookType),
        type: bookType,
        published: false
      })
    }), { toast: "Đã ẩn bảng điểm với học viên." });
  }

  return (
    <article className="expand-card" data-enter-scope="gradebook">
      <div className="assignment-head">
        <button onClick={() => setOpen(!open)}>
          <strong>{gradebookDisplayTitleWithRatio(book, course, bookType, language)}</strong>
          <small>Format: {assignmentFormatLabel(assignmentFormat)}</small>
          {admin && <small>{published ? t("published", "Đã publish") : t("draft", "Nháp")}</small>}
        </button>
        {admin && open && !examGradebook && <SaveButton className="compact save-score-button" dirty={dirty} onClick={saveScores} />}
        {admin && (
          <button
            className={`join-action compact publish-score-button ${published ? "is-published" : ""}`}
            onClick={published ? unpublishScores : publishScores}
            disabled={publishing}
          >
            {publishing ? "Publishing" : (published ? "Unpublish" : "Publish")}
          </button>
        )}
        {admin && !book.autoGenerated && <button className="icon-danger" onClick={() => requestConfirm({
          title: "Xác nhận xóa bảng điểm",
          message: `Bạn có chắc muốn xóa bảng điểm "${book.title}" không?`,
          confirmLabel: "Xóa bảng điểm"
        }, () => updateCourse((current) => ({ ...current, gradebooks: (current.gradebooks || []).filter((item) => item.id !== book.id) })))}><Trash2 size={15} /></button>}
      </div>
      {publishError && <p className="error-text">{publishError}</p>}
      {open && (
        examGradebook ? (
          <ExamGradebookPanel
            admin={admin}
            user={user}
            course={course}
            assignment={assignment}
            book={book}
            exam={exam}
            draftRows={draftRows}
            onGrade={() => onOpenExamGrading?.({ assignment, book, exam, initialRows: draftRows })}
          />
        ) : bookBaseType === "personal" ? (
          <PersonalGradeTable admin={admin} user={user} course={course} draftRows={draftRows} onScoreChange={changeDraftScore} showTopic={showTopic} />
        ) : bookBaseType === "intergroup" ? (
          <IntergroupGradebookCards admin={admin} user={user} course={course} draftRows={draftRows} onScoreChange={changeDraftScore} onBonusChange={changeDraftBonus} showTopic={showTopic} />
        ) : (
          <GroupGradebookCards admin={admin} user={user} course={course} draftRows={draftRows} onScoreChange={changeDraftScore} onBonusChange={changeDraftBonus} showTopic={showTopic} />
        )
      )}
    </article>
  );
}

function ExamGradebookPanel({ admin, user, course, assignment, book, exam, draftRows, onGrade }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const bookType = examGradebookType(book, assignment);
  const bookBaseType = baseGradebookType(bookType);
  const showTopic = gradebookTypeUsesTopic(bookType);
  const displayRows = draftRows?.length
    ? draftRows
    : buildExamGradeRowsForSave(course, assignment, exam, draftRows, bookType);
  if (!exam) {
    return (
      <div className="exam-gradebook-panel">
        <div className="assignment-exam-empty">{t("noExamSelectedForAssignment", "Chưa có đề thi được chọn cho bài tập này.")}</div>
      </div>
    );
  }

  return (
    <div className="exam-gradebook-panel">
      <div className="exam-gradebook-meta">
        <div>
          <strong>{t("exam", "Đề thi")}: {exam.title || t("exam", "Đề thi")}</strong>
          <small>{assignment?.title || book.title || t("assignment", "Bài tập")} · {examTotalQuestionCount(exam)} {t("questions", "câu")} · {formatExamDurationLabel(exam.duration, language)}</small>
        </div>
        {admin && (
          <button className="primary-action compact exam-grade-action" type="button" onClick={onGrade}>
            <Check size={15} /> {t("gradeExam", "Chấm điểm")}
          </button>
        )}
      </div>
      {bookBaseType === "personal" ? (
        <PersonalGradeTable admin={admin} user={user} course={course} draftRows={displayRows} readOnly emptyScoreLabel={admin ? "" : t("noScore", "Chưa có điểm")} showTopic={showTopic} />
      ) : bookBaseType === "intergroup" ? (
        <ExamAllocatedGradebookCards admin={admin} user={user} course={course} draftRows={displayRows} type="intergroup" showTopic={showTopic} />
      ) : (
        <ExamAllocatedGradebookCards admin={admin} user={user} course={course} draftRows={displayRows} type="group" showTopic={showTopic} />
      )}
    </div>
  );
}

function ExamGradingWorkspace({ course, assignment, book, exam, bookType = "personal", initialRows, onBack, onSave }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const gradingBaseType = baseGradebookType(bookType);
  const parts = normalizeExamParts(exam?.parts).filter((part) => normalizeExamQuestions(part.questions).length > 0);
  const firstPartId = parts[0]?.id || "total";
  const [activeTab, setActiveTab] = useState(firstPartId);
  const [activeQuestions, setActiveQuestions] = useState(() => Object.fromEntries(parts.map((part) => {
    const firstQuestion = normalizeExamQuestions(part.questions)[0];
    return [part.id, firstQuestion ? examQuestionResponseKey(part, firstQuestion) : ""];
  })));
  const [questionScores, setQuestionScores] = useState(() => examQuestionScoresFromRows(initialRows));
  const [lastSavedQuestionScores, setLastSavedQuestionScores] = useState(() => examQuestionScoresFromRows(initialRows));
  const [saveStatus, setSaveStatus] = useState("");
  const rows = buildExamGradingRows(course, assignment, exam, initialRows, questionScores, bookType);
  const activePart = parts.find((part) => part.id === activeTab);
  const examGradingDirty = jsonSignature(questionScores) !== jsonSignature(lastSavedQuestionScores);

  function setQuestionScore(email, questionKey, score) {
    setSaveStatus("");
    setQuestionScores((current) => ({
      ...current,
      [email]: {
        ...(current[email] || {}),
        [questionKey]: formatScoreNumber(score)
      }
    }));
  }

  function saveExamGrades() {
    const nextRows = serializeExamGradeRows(rows, exam, { course, assignment, type: bookType, previousRows: initialRows });
    const savePromise = onSave(nextRows);
    setLastSavedQuestionScores(questionScores);
    setSaveStatus("Đã lưu điểm đề thi.");
    return savePromise;
  }

  return (
    <div className="exam-grading-workspace">
      <div className="exam-grading-header">
        <button className="secondary-action compact exam-grading-back" type="button" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <div>
          <strong>{exam.title || t("exam", "Đề thi")}</strong>
          <span>{assignment?.title || book.title || t("assignment", "Bài tập")} · {examTotalQuestionCount(exam)} {t("questions", "câu")}</span>
        </div>
        <SaveButton className="compact" dirty={examGradingDirty} icon={<Check size={15} />} onClick={saveExamGrades} />
      </div>
      <div className="exam-grading-tabs" role="tablist" aria-label={normalizeLanguage(language) === "en" ? "Grading parts" : "Các phần chấm điểm"}>
        {parts.map((part, index) => (
          <button
            className={activeTab === part.id ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === part.id}
            key={part.id}
            onClick={() => setActiveTab(part.id)}
          >
            {parts.length > 1 ? `${t("part", "Phần")} ${toRomanNumeral(index + 1)}` : questionTypeLabel(part.questionType)}
          </button>
        ))}
        <button
          className={activeTab === "total" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={activeTab === "total"}
          onClick={() => setActiveTab("total")}
        >
          {t("total", "Tổng điểm")}
        </button>
      </div>
      <div className="exam-grading-body">
        {activeTab === "total" ? (
          <ExamTotalGradeTable course={course} rows={rows} parts={parts} type={gradingBaseType} />
        ) : activePart ? (
          <ExamGradingPart
            course={course}
            part={activePart}
            partIndex={parts.findIndex((part) => part.id === activePart.id)}
            rows={rows}
            type={gradingBaseType}
            activeQuestionKey={activeQuestions[activePart.id] || ""}
            onActiveQuestionChange={(questionKey) => setActiveQuestions((current) => ({ ...current, [activePart.id]: questionKey }))}
            onQuestionScoreChange={setQuestionScore}
          />
        ) : (
          <div className="empty-state compact-empty">{t("noExamQuestions", "Chưa có câu hỏi trong đề thi.")}</div>
        )}
      </div>
      {saveStatus && <p className="success-text">{saveStatus}</p>}
    </div>
  );
}

function ExamGradingPart({ course, part, partIndex, rows, type = "personal", activeQuestionKey, onActiveQuestionChange, onQuestionScoreChange }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const questions = normalizeExamQuestions(part.questions);
  const questionType = part.questionType || "multipleChoice";
  const writtenAnswer = isWrittenExamQuestionType(questionType);
  const activeQuestion = questions.find((question) => examQuestionResponseKey(part, question) === activeQuestionKey) || questions[0];
  const resolvedQuestionKey = activeQuestion ? examQuestionResponseKey(part, activeQuestion) : "";

  if (!writtenAnswer) {
    return (
      <div className="exam-grading-part">
        <h4>{partsAwarePartTitle(part, partIndex)}</h4>
        <ExamAutoPartGradeTable course={course} rows={rows} part={part} type={type} />
      </div>
    );
  }

  return (
    <div className="exam-written-grading">
      <aside className="exam-written-question-nav" aria-label={normalizeLanguage(language) === "en" ? "Question list" : "Danh sách câu hỏi"}>
        {questions.map((question, index) => {
          const questionKey = examQuestionResponseKey(part, question);
          return (
            <button
              className={questionKey === resolvedQuestionKey ? "active" : ""}
              type="button"
              key={questionKey}
              onClick={() => onActiveQuestionChange(questionKey)}
            >
              {t("question", "Câu")} {index + 1}
            </button>
          );
        })}
      </aside>
      <div className="exam-written-grading-main">
        <h4>{questionTypeLabel(questionType)} - {t("question", "Câu")} {questions.findIndex((question) => examQuestionResponseKey(part, question) === resolvedQuestionKey) + 1}: {activeQuestion?.text || t("question", "Câu hỏi")}</h4>
        <ExamWrittenQuestionGradeTable
          course={course}
          rows={rows}
          part={part}
          question={activeQuestion}
          questionKey={resolvedQuestionKey}
          type={type}
          onQuestionScoreChange={onQuestionScoreChange}
        />
      </div>
    </div>
  );
}

function ExamAutoPartGradeTable({ course, rows, part, type = "personal" }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  if (type !== "personal") {
    return <ExamScopeAutoPartGradeTable rows={rows} part={part} type={type} />;
  }

  return (
    <table className="data-table exam-auto-grade-table">
      <thead>
        <tr>
          <th className="stt-col">{t("stt", "STT")}</th>
          <th className="avatar-col">{t("photo", "Ảnh")}</th>
          <th>{t("fullName", "Họ và tên")}</th>
          <th>{t("correctAnswers", "Số câu trả lời đúng")}</th>
          <th>{t("score", "Điểm")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan="5">{t("noEligibleLearners", "Chưa có học viên phù hợp.")}</td></tr>
        ) : rows.map((row) => {
          const partResult = row.partResults[part.id] || emptyExamPartResult(part);
          return (
            <tr key={row.key}>
              <td>{row.member.order}</td>
              <td><ProfileAvatar user={row.member} label={row.member.name || row.member.email} small /></td>
              <td>{row.member.name || row.member.email}</td>
              <td>{partResult.correctCount}/{partResult.questionCount}</td>
              <td>{formatScoreNumber(partResult.score)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ExamWrittenQuestionGradeTable({ course, rows, part, question, questionKey, type = "personal", onQuestionScoreChange }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  if (type !== "personal") {
    return <ExamScopeWrittenQuestionGradeTable rows={rows} part={part} question={question} questionKey={questionKey} type={type} onQuestionScoreChange={onQuestionScoreChange} />;
  }

  const pointOptions = examWrittenPointOptions(part);
  const longAnswer = part.questionType === "longAnswer";

  return (
    <table className="data-table exam-written-grade-table">
      <thead>
        <tr>
          <th className="stt-col">{t("stt", "STT")}</th>
          <th className="avatar-col">{t("photo", "Ảnh")}</th>
          <th>{t("fullName", "Họ và tên")}</th>
          <th>{t("answer", "Trả lời")}</th>
          <th>{t("score", "Điểm")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan="5">{t("noEligibleLearners", "Chưa có học viên phù hợp.")}</td></tr>
        ) : rows.map((row) => {
          const answer = String(row.answers?.[questionKey] || "");
          const selectedScore = formatScoreNumber(parseScoreValue(row.questionScores?.[questionKey] ?? 0));
          return (
            <tr key={`${row.key}-${question?.id || questionKey}`}>
              <td>{row.member.order}</td>
              <td><ProfileAvatar user={row.member} label={row.member.name || row.member.email} small /></td>
              <td>{row.member.name || row.member.email}</td>
              <td>
                {longAnswer ? (
                  <textarea className="exam-grade-answer-text long" value={answer} readOnly />
                ) : (
                  <input className="exam-grade-answer-text" value={answer} readOnly />
                )}
              </td>
              <td>
                <div className="exam-score-buttons" role="group" aria-label={`${t("score", "Điểm")} ${row.member.name || row.member.email}`}>
                  {pointOptions.map((score) => {
                    const scoreLabel = formatScoreNumber(score);
                    return (
                      <button
                        className={selectedScore === scoreLabel ? "active" : ""}
                        type="button"
                        key={scoreLabel}
                        onClick={() => onQuestionScoreChange(row.member.email, questionKey, score)}
                      >
                        {scoreLabel}
                      </button>
                    );
                  })}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ExamTotalGradeTable({ course, rows, parts, type = "personal" }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  if (type !== "personal") {
    return <ExamScopeTotalGradeTable rows={rows} parts={parts} type={type} />;
  }

  return (
    <table className="data-table exam-total-grade-table">
      <thead>
        <tr>
          <th className="stt-col">{t("stt", "STT")}</th>
          <th className="avatar-col">{t("photo", "Ảnh")}</th>
          <th>{t("fullName", "Họ và tên")}</th>
          {parts.map((part, index) => <th key={part.id}>{t("part", "Phần")} {toRomanNumeral(index + 1)}</th>)}
          <th>{t("total", "Tổng")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={parts.length + 4}>{t("noEligibleLearners", "Chưa có học viên phù hợp.")}</td></tr>
        ) : rows.map((row) => (
          <tr key={row.key}>
            <td>{row.member.order}</td>
            <td><ProfileAvatar user={row.member} label={row.member.name || row.member.email} small /></td>
            <td>{row.member.name || row.member.email}</td>
            {parts.map((part) => (
              <td className="score-cell" key={`${row.key}-${part.id}`}>{formatScoreNumber(row.partScores?.[part.id] || 0)}</td>
            ))}
            <td className="final-score-cell">{formatScoreNumber(row.totalScore)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExamScopeAutoPartGradeTable({ rows, part, type }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  return (
    <table className="data-table exam-auto-grade-table">
      <thead>
        <tr>
          <th>{type === "intergroup" ? t("intergroup", "Liên nhóm") : t("group", "Nhóm")}</th>
          <th>{t("representative", "Người đại diện")}</th>
          <th>{t("correctAnswers", "Số câu trả lời đúng")}</th>
          <th>{t("score", "Điểm")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan="4">{type === "intergroup" ? t("noEligibleIntergroups", "Chưa có liên nhóm phù hợp.") : t("noEligibleGroups", "Chưa có nhóm phù hợp.")}</td></tr>
        ) : rows.map((row) => {
          const partResult = row.partResults[part.id] || emptyExamPartResult(part);
          return (
            <tr key={row.key}>
              <td>{examScopeRowTitle(row, type, language)}</td>
              <td>{examScopeRepresentativeLabel(row, language)}</td>
              <td>{partResult.correctCount}/{partResult.questionCount}</td>
              <td>{formatScoreNumber(partResult.score)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ExamScopeWrittenQuestionGradeTable({ rows, part, question, questionKey, type, onQuestionScoreChange }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const pointOptions = examWrittenPointOptions(part);
  const longAnswer = part.questionType === "longAnswer";

  if (rows.length === 0) {
    return <div className="empty-state compact-empty">{type === "intergroup" ? t("noEligibleIntergroups", "Chưa có liên nhóm phù hợp.") : t("noEligibleGroups", "Chưa có nhóm phù hợp.")}</div>;
  }

  return (
    <div className="exam-scope-grade-list">
      {rows.map((row) => {
        const answer = String(row.answers?.[questionKey] || "");
        const selectedScore = formatScoreNumber(parseScoreValue(row.questionScores?.[questionKey] ?? 0));
        return (
          <section className="group-topic-card topic-editor-card exam-scope-grade-card" key={`${row.key}-${question?.id || questionKey}`}>
            <div className="group-topic-header">
              <div className={`group-topic-bar ${type === "intergroup" ? "intergroup-grade-bar" : "grade-topic-bar"}`}>
                <span className="group-topic-badge topic-group-title">{examScopeRowTitle(row, type, language)}</span>
                <label className="exam-scope-answer-field">
                  <span>{t("answer", "Trả lời")}:</span>
                  {longAnswer ? (
                    <textarea className="exam-grade-answer-text long" value={answer} readOnly />
                  ) : (
                    <input className="exam-grade-answer-text" value={answer} readOnly />
                  )}
                </label>
                <div className="exam-scope-score-field">
                  <span>{t("score", "Điểm")}:</span>
                  <div className="exam-score-buttons" role="group" aria-label={`${t("score", "Điểm")} ${row.label}`}>
                    {pointOptions.map((score) => {
                      const scoreLabel = formatScoreNumber(score);
                      return (
                        <button
                          className={selectedScore === scoreLabel ? "active" : ""}
                          type="button"
                          key={scoreLabel}
                          onClick={() => onQuestionScoreChange(row.key, questionKey, score)}
                        >
                          {scoreLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <p className="exam-scope-representative">{t("representative", "Đại diện")}: {examScopeRepresentativeLabel(row, language)}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ExamScopeTotalGradeTable({ rows, parts, type }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  return (
    <table className="data-table exam-total-grade-table">
      <thead>
        <tr>
          <th>{type === "intergroup" ? t("intergroup", "Liên nhóm") : t("group", "Nhóm")}</th>
          <th>{t("representative", "Người đại diện")}</th>
          {parts.map((part, index) => <th key={part.id}>{t("part", "Phần")} {toRomanNumeral(index + 1)}</th>)}
          <th>{t("total", "Tổng")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={parts.length + 3}>{type === "intergroup" ? t("noEligibleIntergroups", "Chưa có liên nhóm phù hợp.") : t("noEligibleGroups", "Chưa có nhóm phù hợp.")}</td></tr>
        ) : rows.map((row) => (
          <tr key={row.key}>
            <td>{examScopeRowTitle(row, type, language)}</td>
            <td>{examScopeRepresentativeLabel(row, language)}</td>
            {parts.map((part) => (
              <td className="score-cell" key={`${row.key}-${part.id}`}>{formatScoreNumber(row.partScores?.[part.id] || 0)}</td>
            ))}
            <td className="final-score-cell">{formatScoreNumber(row.totalScore)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function examScopeRowTitle(row, type, language = "vi") {
  if (type === "group" && row.reportOrder) {
    const label = row.group ? uiGroupLabel(language, row.group) : uiLiteral(language, row.label || "Nhóm");
    return `${label} (${uiText(language, "stt", "STT")}: ${row.reportOrder})`;
  }
  if (type === "group" && row.group) return uiGroupLabel(language, row.group);
  if (type === "intergroup" && row.intergroup) return uiIntergroupLabel(language, row.intergroup);
  return uiLiteral(language, row.label || (type === "intergroup" ? "Liên nhóm" : "Nhóm"));
}

function examScopeRepresentativeLabel(row, language = "vi") {
  return row.representative?.name || row.representativeEmail || uiText(language, "noSubmissionAvailable", "Chưa có bài nộp");
}

function PersonalGradeTable({ admin, user, course, draftRows, onScoreChange, readOnly = false, emptyScoreLabel = "Chưa có điểm", showTopic = false }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const rows = buildPersonalGradeRows(course, draftRows, showTopic).filter((row) => admin || row.member.email === user.email);
  const resolvedEmptyScoreLabel = emptyScoreLabel === "Chưa có điểm" ? t("noScore", "Chưa có điểm") : emptyScoreLabel;
  if (rows.length === 0) return <div className="empty-state compact-empty">{t("noEligibleLearners", "Chưa có học viên phù hợp.")}</div>;

  return (
    <table className="data-table grade-personal-table">
      <thead><tr><th className="stt-col">{t("stt", "STT")}</th><th className="avatar-col">{t("photo", "Ảnh")}</th><th>{t("fullName", "Họ và tên")}</th><th>{t("studentId", "Mã số")}</th>{showTopic && <th>{t("topic", "Topic")}</th>}<th>{t("score", "Điểm")}</th><th>{t("email", "Email")}</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.member.order}</td>
            <td><ProfileAvatar user={{ ...row.member, photoURL: row.member.photoURL || course.profiles?.[row.member.email]?.photoURL || "" }} label={row.member.name || row.member.email} small /></td>
            <td>{row.member.name || row.member.email}</td>
            <td>{row.member.studentId}</td>
            {showTopic && <td>{row.topicTitle || t("noTopic", "Chưa có topic.")}</td>}
            <td>
              {admin && !readOnly ? (
                <input className="score-input" data-enter-group="personal-grade-score" inputMode="decimal" value={row.score} onKeyDown={(event) => focusNextInputOnEnter(event, "personal-grade-score")} onChange={(event) => onScoreChange(row.key, event.target.value)} />
              ) : (
                row.score || resolvedEmptyScoreLabel
              )}
            </td>
            <td>{row.member.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExamAllocatedGradebookCards({ admin, user, course, draftRows, type = "group", showTopic = true }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const cards = type === "intergroup"
    ? buildIntergroupGradeCards(course, draftRows, showTopic)
      .map((card) => ({
        ...card,
        visibleGroups: card.groups
          .map((group) => ({ ...group, visibleMembers: visibleGradeMembers(group.members, admin, user) }))
          .filter((group) => group.visibleMembers.length > 0)
      }))
      .filter((card) => card.visibleGroups.length > 0)
    : buildGroupGradeCards(course, draftRows, showTopic)
      .map((card) => ({ ...card, visibleMembers: visibleGradeMembers(card.members, admin, user) }))
      .filter((card) => card.visibleMembers.length > 0);

  if (cards.length === 0) {
    return <div className="empty-state compact-empty">{type === "intergroup" ? t("noEligibleIntergroups", "Chưa có liên nhóm phù hợp.") : t("noEligibleGroups", "Chưa có nhóm phù hợp.")}</div>;
  }

  return (
    <div className="grade-topic-list exam-allocated-grade-list">
      {cards.map((card) => (
        <section className="group-topic-card topic-editor-card grade-topic-card exam-allocated-grade-card" key={card.gradeKey}>
          <div className="group-topic-header">
            <div className={`group-topic-bar ${type === "intergroup" ? "intergroup-grade-bar" : "grade-topic-bar"}`}>
              <span className="group-topic-badge topic-group-title">
                <span>{type === "intergroup" ? uiIntergroupLabel(language, card.rawIntergroup) : uiGroupLabel(language, card.rawGroup)}</span>
                {type === "group" && (
                  <span className="topic-inline-meta">
                    <span>({t("stt", "STT")}:</span>
                    <strong className="score-box read-only">{card.reportOrder || ""}</strong>
                    <span>)</span>
                  </span>
                )}
              </span>
              <label className="group-topic-compact-field grade-score-field">
                <span>{t("score", "Điểm")}:</span>
                <strong className="score-box">{card.score || ""}</strong>
              </label>
            </div>
          </div>
          {showTopic && (
            <div className="group-topic-topic-row">
              <span>{t("topic", "Topic")}:</span>
              <p>{card.topicTitle || t("noTopic", "Chưa có topic.")}</p>
            </div>
          )}
          {type === "intergroup" ? (
            <div className="intergroup-member-list grade-intergroup-list">
              {card.visibleGroups.map((group) => (
                <section className="intergroup-member-section" key={group.key}>
                  <h5>{uiGroupLabel(language, group.rawGroup)}</h5>
                  <ExamAllocatedMembersTable members={group.visibleMembers} course={course} score={card.score} admin={admin} />
                </section>
              ))}
            </div>
          ) : (
            <div className="group-topic-table-wrap">
              <ExamAllocatedMembersTable members={card.visibleMembers} course={course} score={card.score} admin={admin} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function ExamAllocatedMembersTable({ members, course, score, admin }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  return (
    <table className="data-table topic-members-table grade-members-table exam-allocated-members-table">
      <thead><tr><th className="stt-col">{t("stt", "STT")}</th><th className="avatar-col">{t("photo", "Ảnh")}</th><th>{t("fullName", "Họ tên")}</th><th>{t("studentId", "Mã số")}</th><th>{t("score", "Điểm")}</th><th>{t("email", "Email")}</th></tr></thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.email}>
            <td>{member.order}</td>
            <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
            <td>{member.name}</td>
            <td>{member.studentId}</td>
            <td><span className="score-box final-score">{score || (admin ? "" : t("noScore", "Chưa có điểm"))}</span></td>
            <td>{member.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupGradebookCards({ admin, user, course, draftRows, onScoreChange = () => {}, onBonusChange = () => {}, readOnly = false, showTopic = true }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const cards = buildGroupGradeCards(course, draftRows, showTopic)
    .map((card) => ({ ...card, visibleMembers: visibleGradeMembers(card.members, admin, user) }))
    .filter((card) => card.visibleMembers.length > 0);
  if (cards.length === 0) return <div className="empty-state compact-empty">{t("noEligibleGroups", "Chưa có nhóm phù hợp.")}</div>;

  return (
    <div className="grade-topic-list">
      {cards.map((card) => (
        <section className="group-topic-card topic-editor-card grade-topic-card" key={card.gradeKey}>
          <div className="group-topic-header">
            <div className="group-topic-bar grade-topic-bar">
              <span className="group-topic-badge topic-group-title">
                <span>{uiGroupLabel(language, card.rawGroup)}</span>
                <span className="topic-inline-meta">
                  <span>({t("stt", "STT")}:</span>
                  <strong className="score-box read-only">{card.reportOrder || ""}</strong>
                  <span>)</span>
                </span>
              </span>
              <label className="group-topic-compact-field grade-score-field">
                <span>{t("score", "Điểm")}:</span>
                {admin && !readOnly ? (
                  <input className="score-input" data-enter-group="group-grade-score" inputMode="decimal" value={card.score} onKeyDown={(event) => focusNextInputOnEnter(event, "group-grade-score")} onChange={(event) => onScoreChange(card.gradeKey, event.target.value)} />
                ) : (
                  <strong className="score-box">{card.score || ""}</strong>
                )}
              </label>
            </div>
            {showTopic && (
              <div className="group-topic-topic-row">
                <span>{t("topic", "Topic")}:</span>
                <p>{card.topicTitle || t("noTopic", "Chưa có topic.")}</p>
              </div>
            )}
          </div>
          <div className="group-topic-table-wrap">
            <GradeMembersTable admin={admin} members={card.visibleMembers} course={course} score={card.score} bonuses={card.bonuses} rowKey={card.gradeKey} onBonusChange={onBonusChange} readOnly={readOnly} />
          </div>
        </section>
      ))}
    </div>
  );
}

function IntergroupGradebookCards({ admin, user, course, draftRows, onScoreChange = () => {}, onBonusChange = () => {}, readOnly = false, showTopic = true }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const cards = buildIntergroupGradeCards(course, draftRows, showTopic)
    .map((card) => ({
      ...card,
      visibleGroups: card.groups
        .map((group) => ({ ...group, visibleMembers: visibleGradeMembers(group.members, admin, user) }))
        .filter((group) => group.visibleMembers.length > 0)
    }))
    .filter((card) => card.visibleGroups.length > 0);
  if (cards.length === 0) return <div className="empty-state compact-empty">{t("noEligibleIntergroups", "Chưa có liên nhóm phù hợp.")}</div>;

  return (
    <div className="grade-topic-list">
      {cards.map((card) => (
        <section className="group-topic-card topic-editor-card grade-topic-card" key={card.gradeKey}>
          <div className="group-topic-header">
            <div className="group-topic-bar intergroup-grade-bar">
              <span className="group-topic-badge">{uiIntergroupLabel(language, card.rawIntergroup)}</span>
              <label className="group-topic-compact-field grade-score-field">
                <span>{t("score", "Điểm")}:</span>
                {admin && !readOnly ? (
                  <input className="score-input" data-enter-group="intergroup-grade-score" inputMode="decimal" value={card.score} onKeyDown={(event) => focusNextInputOnEnter(event, "intergroup-grade-score")} onChange={(event) => onScoreChange(card.gradeKey, event.target.value)} />
                ) : (
                  <strong className="score-box">{card.score || ""}</strong>
                )}
              </label>
            </div>
            {showTopic && (
              <div className="group-topic-topic-row">
                <span>{t("topic", "Topic")}:</span>
                <p>{card.topicTitle || t("noTopic", "Chưa có topic.")}</p>
              </div>
            )}
          </div>
          <div className="intergroup-member-list grade-intergroup-list">
            {card.visibleGroups.map((group) => (
              <section className="intergroup-member-section" key={group.key}>
                <h5>{uiGroupLabel(language, group.rawGroup)}</h5>
                <GradeMembersTable admin={admin} members={group.visibleMembers} course={course} score={card.score} bonuses={card.bonuses} rowKey={card.gradeKey} onBonusChange={onBonusChange} readOnly={readOnly} />
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GradeMembersTable({ admin, members, course, score, bonuses, rowKey, onBonusChange = () => {}, readOnly = false }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  return (
    <table className="data-table topic-members-table grade-members-table">
      <thead><tr><th className="stt-col">{t("stt", "STT")}</th><th className="avatar-col">{t("photo", "Ảnh")}</th><th>{t("fullName", "Họ tên")}</th><th>{t("studentId", "Mã số")}</th><th>Bonus</th><th>Final</th><th>{t("email", "Email")}</th></tr></thead>
      <tbody>
        {members.map((member) => {
          const bonus = bonuses?.[member.email] || "";
          const finalScore = calculateFinalScore(score, bonus);
          return (
            <tr key={member.email}>
              <td>{member.order}</td>
              <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
              <td>{member.name}</td>
              <td>{member.studentId}</td>
              <td>
                {admin && !readOnly ? (
                  <input className="bonus-input" data-enter-group="grade-bonus" inputMode="decimal" value={bonus} onKeyDown={(event) => focusNextInputOnEnter(event, "grade-bonus")} onChange={(event) => onBonusChange(rowKey, member.email, event.target.value)} />
                ) : (
                  bonus || ""
                )}
              </td>
              <td><span className="score-box final-score">{finalScore || (admin ? "" : t("noScore", "Chưa có điểm"))}</span></td>
              <td>{member.email}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function gradebookSourceCount(course, type) {
  const baseType = baseGradebookType(type);
  const showTopic = gradebookTypeUsesTopic(type);
  if (baseType === "personal") return buildPersonalGradeRows(course, [], showTopic).length;
  if (baseType === "intergroup") return buildIntergroupGradeCards(course, [], showTopic).length;
  return buildGroupGradeCards(course, [], showTopic).length;
}

function buildGradebookRowsForSave(course, type, draftRows) {
  const baseType = baseGradebookType(type);
  const showTopic = gradebookTypeUsesTopic(type);
  if (baseType === "personal") {
    return buildPersonalGradeRows(course, draftRows, showTopic).map((row) => ({
      key: row.key,
      email: row.member.email,
      label: `${row.member.order}. ${row.member.name}`,
      topic: showTopic ? row.topicTitle : "",
      score: row.score || ""
    }));
  }

  if (baseType === "intergroup") {
    return buildIntergroupGradeCards(course, draftRows, showTopic).map((card) => ({
      key: card.gradeKey,
      intergroup: card.rawIntergroup,
      label: card.label,
      topic: showTopic ? card.topicTitle : "",
      groupKeys: card.groupKeys,
      memberEmails: uniqueValues(card.groups.flatMap((group) => group.members.map((member) => member.email))),
      score: card.score || "",
      bonuses: card.bonuses || {}
    }));
  }

  return buildGroupGradeCards(course, draftRows, showTopic).map((card) => ({
    key: card.gradeKey,
    group: card.rawGroup,
    label: card.label,
    topic: showTopic ? card.topicTitle : "",
    reportOrder: card.reportOrder,
    memberEmails: card.members.map((member) => member.email),
    score: card.score || "",
    bonuses: card.bonuses || {}
  }));
}

function buildPersonalGradeRows(course, draftRows, showTopic = false) {
  const personalTopicsByEmail = new Map((course.personalTopics || []).map((item) => [normalizeEmail(item.email), String(item.topic || "").trim()]));
  return course.members
    .filter((member) => member.status === "accepted")
    .sort(compareMemberOrder)
    .map((member) => {
      const row = findGradebookRow(draftRows, member.email);
      return {
        key: member.email,
        member,
        topicTitle: showTopic ? (personalTopicsByEmail.get(normalizeEmail(member.email)) || "") : "",
        score: row?.score || ""
      };
    });
}

function buildGroupGradeCards(course, draftRows, showTopic = true) {
  const groups = showTopic
    ? buildGroupTopicCards(course)
    : groupMembersByGroup((course.members || []).filter((member) => member.status === "accepted")).filter((group) => group.rawGroup);
  return [...groups].sort(compareGroupTopicCards).map((group) => {
    const gradeKey = group.topic?.id || groupTopicId(group.rawGroup);
    const row = findGradebookRow(draftRows, gradeKey);
    return {
      gradeKey,
      rawGroup: group.rawGroup,
      label: group.label,
      reportOrder: showTopic ? (group.topic?.reportOrder || group.rawGroup || "") : (group.rawGroup || ""),
      topicTitle: showTopic ? (group.topic?.topic || "") : "",
      members: group.members,
      score: row?.score || "",
      bonuses: row?.bonuses || {}
    };
  });
}

function buildIntergroupGradeCards(course, draftRows, showTopic = true) {
  return buildIntergroupTopicCards(course, buildGroupTopicCards(course)).map((link) => {
    const gradeKey = link.topic?.id || intergroupTopicId(link.rawIntergroup);
    const row = findGradebookRow(draftRows, gradeKey);
    return {
      gradeKey,
      rawIntergroup: link.rawIntergroup,
      label: link.label,
      topicTitle: showTopic ? (link.topic?.topic || "") : "",
      groupKeys: link.groupKeys,
      groups: link.groups,
      score: row?.score || "",
      bonuses: row?.bonuses || {}
    };
  });
}

function buildSummaryGradeRows(course, assignments, admin, user) {
  const members = (course.members || [])
    .filter((member) => member.status === "accepted")
    .sort(compareMemberOrder)
    .filter((member) => admin || member.email === user.email);

  return members.map((member) => {
    const components = assignments.map((assignment) => buildSummaryComponent(course, assignment, member, admin));
    const total = components.reduce((sum, component, index) => {
      const ratio = parseRatioNumber(assignments[index]?.ratio);
      return sum + (component.hasScore ? component.numeric * ratio / 100 : 0);
    }, 0);
    return {
      member,
      components,
      finalScore: components.some((component) => component.hasScore) ? formatScoreNumber(total) : ""
    };
  });
}

function buildSummaryComponent(course, assignment, member, admin) {
  const book = findSummaryGradebook(course, assignment.id, admin);
  if (!book) return emptySummaryScore(assignment.id);

  const bookType = normalizeGradebookType(book.type, "personal");
  const bookBaseType = baseGradebookType(bookType);
  const examGradebook = isExamGradebook(book, assignment);
  if (bookBaseType === "personal") return personalSummaryScore(course, book, assignment.id, member);
  if (bookBaseType === "intergroup") return intergroupSummaryScore(course, book, assignment.id, member, examGradebook);
  return groupSummaryScore(course, book, assignment.id, member, examGradebook);
}

function findSummaryGradebook(course, assignmentId, admin) {
  const assignment = (course.assignments || []).find((item) => String(item.id || "") === String(assignmentId || ""));
  const book = assignment ? buildAutomaticGradebook(course, assignment) : findStoredGradebook(course, assignmentId);
  if (!book) return null;
  return admin || isGradebookPublished(book) ? book : null;
}

function gradebookAssignment(course, book) {
  return (course.assignments || []).find((item) => String(item.id || "") === String(book?.assignmentId || ""));
}

function isExamGradebook(book, assignment) {
  return normalizeAssignmentFormat(book?.assignmentFormat || assignment?.format) === "exam";
}

function examGradebookType(book, assignment) {
  return normalizeGradebookType(book?.type || assignment?.type, "personal");
}

function courseMemberByEmail(course, email) {
  const normalizedEmail = normalizeEmail(email || "");
  return (course?.members || []).find((member) => normalizeEmail(member.email) === normalizedEmail) || null;
}

function assignmentExamScope(course, assignment, email, explicitType = normalizeGradebookType(assignment?.type, "personal")) {
  const type = baseGradebookType(explicitType);
  const showTopic = gradebookTypeUsesTopic(explicitType);
  const normalizedEmail = normalizeEmail(email || "");
  const fallbackMember = courseMemberByEmail(course, email);
  const fallbackEmail = fallbackMember?.email || email || "";
  const fallbackScope = {
    type: "personal",
    key: normalizedEmail || fallbackEmail,
    label: fallbackMember?.name || fallbackEmail || "Người học",
    memberEmails: fallbackEmail ? [fallbackEmail] : [],
    members: fallbackMember ? [fallbackMember] : []
  };

  if (!course || type === "personal") return fallbackScope;

  if (type === "group") {
    const card = buildGroupGradeCards(course, [], showTopic).find((item) => (
      item.members.some((member) => normalizeEmail(member.email) === normalizedEmail)
    ));
    if (!card) return fallbackScope;
    return {
      type,
      key: card.gradeKey,
      label: card.label,
      reportOrder: card.reportOrder,
      topicTitle: card.topicTitle,
      memberEmails: card.members.map((member) => member.email),
      members: card.members
    };
  }

  const intergroupCard = buildIntergroupGradeCards(course, [], showTopic).find((item) => (
    item.groups.some((group) => group.members.some((member) => normalizeEmail(member.email) === normalizedEmail))
  ));
  if (!intergroupCard) return fallbackScope;
  const members = intergroupCard.groups.flatMap((group) => group.members);
  return {
    type,
    key: intergroupCard.gradeKey,
    label: intergroupCard.label,
    topicTitle: intergroupCard.topicTitle,
    groupKeys: intergroupCard.groupKeys,
    groups: intergroupCard.groups,
    memberEmails: uniqueValues(members.map((member) => member.email)),
    members
  };
}

function assignmentExamScopeFromSubmission(course, assignment, submission, explicitType = normalizeGradebookType(assignment?.type, "personal")) {
  const type = baseGradebookType(explicitType);
  if (submission?.examScopeKey && baseGradebookType(submission.examScopeType || type) === type) {
    return {
      type,
      key: submission.examScopeKey,
      label: submission.examScopeLabel || submission.examScopeKey,
      memberEmails: Array.isArray(submission.examScopeMemberEmails) ? submission.examScopeMemberEmails : []
    };
  }
  return assignmentExamScope(course, assignment, submission?.email || "", type);
}

function examScopeSubmissionFields(scope) {
  return {
    examScopeType: scope?.type || "personal",
    examScopeKey: scope?.key || "",
    examScopeLabel: scope?.label || "",
    examScopeMemberEmails: scope?.memberEmails || []
  };
}

function latestSubmittedExamSubmissionsByScope(course, assignment, explicitType = normalizeGradebookType(assignment?.type, "personal")) {
  const fullType = normalizeGradebookType(explicitType, "personal");
  const map = new Map();
  cleanAssignmentSubmissionList(assignment?.submissions || [])
    .filter((submission) => submission?.type === "exam" && submission.status === "submitted")
    .sort((first, second) => Number(second.examSubmittedAtMillis || second.submittedAtMillis || 0) - Number(first.examSubmittedAtMillis || first.submittedAtMillis || 0))
    .forEach((submission) => {
      const scope = assignmentExamScopeFromSubmission(course, assignment, submission, fullType);
      if (!scope.key || map.has(scope.key)) return;
      map.set(scope.key, {
        ...submission,
        ...examScopeSubmissionFields(scope)
      });
    });
  return map;
}

function latestSubmittedExamSubmissionForLearnerScope(course, assignment, email) {
  const type = normalizeGradebookType(assignment?.type, "personal");
  const scope = assignmentExamScope(course, assignment, email, type);
  const submission = scope.key ? latestSubmittedExamSubmissionsByScope(course, assignment, type).get(scope.key) || null : null;
  return { scope, submission };
}

function examScopeSubmittedMessage(scope, submission, userEmail = "") {
  const submitter = submission?.name || submission?.email || "người đại diện";
  if (scope?.type === "group" || scope?.type === "intergroup") {
    return `${scope.label || "Nhóm/Liên nhóm"} đã có bài thi đại diện bởi ${submitter}.`;
  }
  return normalizeEmail(submission?.email || "") === normalizeEmail(userEmail || "")
    ? "Bạn đã submit bài thi thành công."
    : "Bài thi này đã có bài nộp.";
}

function latestSubmittedExamSubmissionsByEmail(assignment) {
  const map = new Map();
  cleanAssignmentSubmissionList(assignment?.submissions || [])
    .filter((submission) => submission?.type === "exam" && submission.status === "submitted")
    .sort((first, second) => Number(second.examSubmittedAtMillis || second.submittedAtMillis || 0) - Number(first.examSubmittedAtMillis || first.submittedAtMillis || 0))
    .forEach((submission) => {
      const email = normalizeEmail(submission.email || "");
      if (email && !map.has(email)) map.set(email, submission);
    });
  return map;
}

function flattenExamMemberRows(rows = []) {
  return (rows || []).flatMap((row) => (
    Array.isArray(row?.memberExamRows)
      ? row.memberExamRows
      : [row]
  ));
}

function examQuestionScoresFromRows(rows = []) {
  const entries = [];
  (rows || []).forEach((row) => {
    if (row?.questionScores && typeof row.questionScores === "object") {
      entries.push([row.key || row.email || "", row.questionScores]);
      if (row.representativeEmail) entries.push([row.representativeEmail, row.questionScores]);
    }
    if (Array.isArray(row?.memberExamRows)) {
      row.memberExamRows.forEach((memberRow) => {
        entries.push([
          memberRow.email || memberRow.key || "",
          memberRow.questionScores && typeof memberRow.questionScores === "object" ? memberRow.questionScores : {}
        ]);
      });
    }
  });
  return Object.fromEntries(entries.filter(([key]) => key));
}

function buildExamGradeRowsForSave(course, assignment, exam, draftRows, type = examGradebookType(null, assignment)) {
  if (!exam) return draftRows || [];
  const normalizedType = normalizeGradebookType(type, "personal");
  return serializeExamGradeRows(
    buildExamGradingRows(course, assignment, exam, draftRows, examQuestionScoresFromRows(draftRows), normalizedType),
    exam,
    { course, assignment, type: normalizedType, previousRows: draftRows }
  );
}

function buildExamGradingRows(course, assignment, exam, savedRows = [], questionScoreOverrides = null, type = "personal") {
  const normalizedType = normalizeGradebookType(type, "personal");
  const baseType = baseGradebookType(normalizedType);
  if (baseType !== "personal") {
    return buildExamScopeGradingRows(course, assignment, exam, savedRows, questionScoreOverrides, normalizedType);
  }

  const parts = normalizeExamParts(exam?.parts).filter((part) => normalizeExamQuestions(part.questions).length > 0);
  const submissionsByEmail = latestSubmittedExamSubmissionsByEmail(assignment);
  const members = (course.members || [])
    .filter((member) => member.status === "accepted")
    .sort(compareMemberOrder);

  return members.map((member) => {
    const memberEmail = member.email || "";
    const normalizedEmail = normalizeEmail(memberEmail);
    const profile = course.profiles?.[memberEmail] || course.profiles?.[normalizedEmail] || {};
    const savedRow = savedExamGradeRow(savedRows, member);
    const overrideScores = questionScoreOverrides?.[memberEmail] || questionScoreOverrides?.[normalizedEmail] || {};
    const questionScores = {
      ...(savedRow?.questionScores || {}),
      ...overrideScores
    };
    const submission = submissionsByEmail.get(normalizedEmail) || null;
    const answers = submission?.examAnswers || {};
    const partResults = Object.fromEntries(parts.map((part) => [
      part.id,
      gradeExamPart(part, answers, questionScores)
    ]));
    const partScores = Object.fromEntries(parts.map((part) => [
      part.id,
      Number(partResults[part.id]?.score || 0)
    ]));
    const totalScore = Object.values(partScores).reduce((total, score) => total + Number(score || 0), 0);

    return {
      key: memberEmail,
      member: {
        ...member,
        photoURL: member.photoURL || profile.photoURL || ""
      },
      submission,
      answers,
      questionScores,
      partResults,
      partScores,
      totalScore,
      score: hasExamGradeDetail(savedRow) || submission ? formatScoreNumber(totalScore) : (savedRow?.score || "")
    };
  });
}

function buildExamScopeGradingRows(course, assignment, exam, savedRows = [], questionScoreOverrides = null, type = "group") {
  const normalizedType = normalizeGradebookType(type, "group");
  const baseType = baseGradebookType(normalizedType);
  const showTopic = gradebookTypeUsesTopic(normalizedType);
  const parts = normalizeExamParts(exam?.parts).filter((part) => normalizeExamQuestions(part.questions).length > 0);
  const submissionsByScope = latestSubmittedExamSubmissionsByScope(course, assignment, normalizedType);
  const cards = baseType === "intergroup" ? buildIntergroupGradeCards(course, savedRows, showTopic) : buildGroupGradeCards(course, savedRows, showTopic);

  return cards.map((card) => {
    const members = baseType === "intergroup" ? card.groups.flatMap((group) => group.members) : card.members;
    const savedRow = findGradebookRow(savedRows, card.gradeKey);
    const submission = submissionsByScope.get(card.gradeKey) || null;
    const representative = submission ? assignmentSubmissionIdentity(course, submission, { email: submission.email }) : null;
    const overrideScores = questionScoreOverrides?.[card.gradeKey]
      || questionScoreOverrides?.[submission?.email || ""]
      || questionScoreOverrides?.[normalizeEmail(submission?.email || "")]
      || {};
    const questionScores = {
      ...(savedRow?.questionScores || {}),
      ...overrideScores
    };
    const answers = submission?.examAnswers || {};
    const partResults = Object.fromEntries(parts.map((part) => [
      part.id,
      gradeExamPart(part, answers, questionScores)
    ]));
    const partScores = Object.fromEntries(parts.map((part) => [
      part.id,
      Number(partResults[part.id]?.score || 0)
    ]));
    const totalScore = Object.values(partScores).reduce((total, score) => total + Number(score || 0), 0);

    return {
      key: card.gradeKey,
      scopeType: baseType,
      label: card.label,
      reportOrder: card.reportOrder || "",
      topicTitle: card.topicTitle || "",
      group: card.rawGroup,
      intergroup: card.rawIntergroup,
      groupKeys: card.groupKeys || [],
      groups: card.groups || [],
      memberEmails: uniqueValues(members.map((member) => member.email)),
      representative,
      representativeEmail: representative?.email || submission?.email || "",
      submission,
      answers,
      questionScores,
      partResults,
      partScores,
      totalScore,
      score: hasExamGradeDetail(savedRow) || submission ? formatScoreNumber(totalScore) : (savedRow?.score || "")
    };
  });
}

function savedExamGradeRow(rows, member) {
  const memberEmail = member?.email || "";
  const normalizedEmail = normalizeEmail(memberEmail);
  return flattenExamMemberRows(rows).find((row) => (
    String(row.key || "") === String(memberEmail)
      || normalizeEmail(row.email || "") === normalizedEmail
      || normalizeEmail(row.key || "") === normalizedEmail
  ));
}

function hasExamGradeDetail(row) {
  const questionScores = row?.questionScores && typeof row.questionScores === "object" ? row.questionScores : {};
  const partScores = row?.partScores && typeof row.partScores === "object" ? row.partScores : {};
  return Boolean(
    Object.keys(questionScores).length > 0
      || Object.keys(partScores).length > 0
      || (Array.isArray(row?.memberExamRows) && row.memberExamRows.length > 0)
  );
}

function serializeExamGradeRows(rows, exam, options = {}) {
  const type = normalizeGradebookType(options.type, "personal");
  const baseType = baseGradebookType(type);
  const savedAtMillis = Date.now();
  if (baseType === "group" || baseType === "intergroup") {
    return rows.map((row) => serializeScopeExamGradeRow(row, exam, savedAtMillis));
  }
  return rows.map((row) => serializePersonalExamGradeRow(row, exam, savedAtMillis));
}

function serializePersonalExamGradeRow(row, exam, savedAtMillis = Date.now()) {
  return {
    key: row.member.email,
    email: row.member.email,
    label: `${row.member.order}. ${row.member.name || row.member.email}`,
    score: formatScoreNumber(row.totalScore),
    partScores: Object.fromEntries(Object.entries(row.partScores || {}).map(([partId, score]) => [partId, formatScoreNumber(score)])),
    questionScores: Object.fromEntries(Object.entries(row.questionScores || {}).map(([questionKey, score]) => [questionKey, formatScoreNumber(parseScoreValue(score))])),
    examId: exam?.id || "",
    examTitle: exam?.title || "",
    savedAtMillis
  };
}

function serializeScopeExamGradeRow(row, exam, savedAtMillis = Date.now()) {
  return {
    key: row.key,
    group: row.group || "",
    intergroup: row.intergroup || "",
    label: row.label || "",
    reportOrder: row.reportOrder || "",
    groupKeys: row.groupKeys || [],
    memberEmails: row.memberEmails || [],
    representativeEmail: row.representativeEmail || "",
    representativeName: row.representative?.name || row.submission?.name || "",
    score: formatScoreNumber(row.totalScore),
    partScores: Object.fromEntries(Object.entries(row.partScores || {}).map(([partId, score]) => [partId, formatScoreNumber(score)])),
    questionScores: Object.fromEntries(Object.entries(row.questionScores || {}).map(([questionKey, score]) => [questionKey, formatScoreNumber(parseScoreValue(score))])),
    examId: exam?.id || "",
    examTitle: exam?.title || "",
    submittedAtMillis: row.submission?.examSubmittedAtMillis || row.submission?.submittedAtMillis || "",
    savedAtMillis
  };
}

function gradeExamPart(part, answers, questionScores) {
  const questions = normalizeExamQuestions(part.questions);
  const writtenAnswer = isWrittenExamQuestionType(part.questionType);
  const questionResults = questions.map((question) => {
    const questionKey = examQuestionResponseKey(part, question);
    const response = answers?.[questionKey];
    if (writtenAnswer) {
      const score = parseScoreValue(questionScores?.[questionKey] ?? 0);
      return { question, questionKey, response, correct: false, score };
    }
    const autoResult = gradeAutoExamQuestion(part, question, response);
    return { question, questionKey, response, ...autoResult };
  });
  const score = questionResults.reduce((total, result) => total + Number(result.score || 0), 0);
  return {
    questionCount: questions.length,
    correctCount: writtenAnswer ? 0 : questionResults.filter((result) => result.correct).length,
    score,
    questionResults
  };
}

function emptyExamPartResult(part) {
  return {
    questionCount: normalizeExamQuestions(part?.questions).length,
    correctCount: 0,
    score: 0,
    questionResults: []
  };
}

function gradeAutoExamQuestion(part, question, response) {
  const points = Number(part?.pointsPerQuestion || 0);
  const answers = normalizeExamAnswers(question.answers);
  const questionType = part?.questionType || "multipleChoice";
  if (questionType === "checkbox") {
    const correctIds = answers.filter((answer) => answer.correct).map((answer) => String(answer.id)).sort();
    const responseIds = (Array.isArray(response) ? response : []).map((answerId) => String(answerId)).sort();
    const correct = correctIds.length > 0 && sameStringList(correctIds, responseIds);
    return { correct, score: correct ? points : 0 };
  }
  const correctAnswer = answers.find((answer) => answer.correct);
  const correct = Boolean(correctAnswer?.id && String(response || "") === String(correctAnswer.id));
  return { correct, score: correct ? points : 0 };
}

function sameStringList(first, second) {
  if (first.length !== second.length) return false;
  return first.every((item, index) => item === second[index]);
}

function examWrittenPointOptions(part) {
  const values = [0, ...parseWrittenPointOptions(part?.writtenPointOptions)];
  const pointsPerQuestion = Number(part?.pointsPerQuestion || 0);
  if (values.length === 1 && Number.isFinite(pointsPerQuestion) && pointsPerQuestion > 0) values.push(pointsPerQuestion);
  return [...new Set(values.filter((value) => Number.isFinite(value) && value >= 0))]
    .sort((first, second) => first - second);
}

function questionTypeLabel(questionType) {
  return EXAM_QUESTION_TYPES.find((type) => type.value === questionType)?.label || "Multiple Choice";
}

function partsAwarePartTitle(part) {
  return questionTypeLabel(part?.questionType);
}

function personalSummaryScore(course, book, assignmentId, member) {
  const row = buildPersonalGradeRows(course, book.rows || [], gradebookTypeUsesTopic(book?.type)).find((item) => item.member.email === member.email);
  return scoreSummaryValue(assignmentId, row?.score);
}

function groupSummaryScore(course, book, assignmentId, member, ignoreBonus = false) {
  const card = buildGroupGradeCards(course, book.rows || [], gradebookTypeUsesTopic(book?.type)).find((item) => item.members.some((student) => student.email === member.email));
  if (ignoreBonus) return scoreSummaryValue(assignmentId, card?.score);
  return combinedSummaryScore(assignmentId, card?.score, card?.bonuses?.[member.email]);
}

function intergroupSummaryScore(course, book, assignmentId, member, ignoreBonus = false) {
  const card = buildIntergroupGradeCards(course, book.rows || [], gradebookTypeUsesTopic(book?.type)).find((item) => (
    item.groups.some((group) => group.members.some((student) => student.email === member.email))
  ));
  if (ignoreBonus) return scoreSummaryValue(assignmentId, card?.score);
  return combinedSummaryScore(assignmentId, card?.score, card?.bonuses?.[member.email]);
}

function emptySummaryScore(assignmentId) {
  return { assignmentId, display: "", numeric: 0, hasScore: false };
}

function scoreSummaryValue(assignmentId, score) {
  const hasScore = hasScoreValue(score);
  return {
    assignmentId,
    display: hasScore ? formatScoreNumber(parseScoreValue(score)) : "",
    numeric: hasScore ? parseScoreValue(score) : 0,
    hasScore
  };
}

function combinedSummaryScore(assignmentId, score, bonus) {
  const hasScore = hasScoreValue(score) || hasScoreValue(bonus);
  const total = parseScoreValue(score) + parseScoreValue(bonus);
  return {
    assignmentId,
    display: hasScore ? formatScoreNumber(total) : "",
    numeric: hasScore ? total : 0,
    hasScore
  };
}

function findGradebookRow(rows, key) {
  return (rows || []).find((row) => String(row.key || "") === String(key || ""));
}

function upsertGradebookRow(rows, key, patch) {
  const exists = (rows || []).some((row) => String(row.key || "") === String(key || ""));
  if (exists) return rows.map((row) => String(row.key || "") === String(key || "") ? { ...row, ...patch } : row);
  return [...(rows || []), { key, ...patch }];
}

function visibleGradeMembers(members, admin, user) {
  return admin ? members : members.filter((member) => member.email === user.email);
}

function sanitizeScoreInput(value) {
  return String(value || "").replace(/[^\d.,-]/g, "");
}

function parseScoreValue(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasScoreValue(value) {
  return String(value ?? "").trim() !== "";
}

function calculateFinalScore(score, bonus) {
  if (!hasScoreValue(score) && !hasScoreValue(bonus)) return "";
  const total = parseScoreValue(score) + parseScoreValue(bonus);
  return formatScoreNumber(total);
}

function formatScoreNumber(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}


function PersonalTopicCard({ admin, canEdit, course, updateCourse }) {
  const language = useUiLanguage();
  const t = (key, fallback = "") => uiText(language, key, fallback);
  const members = course.members.filter((member) => member.status === "accepted").sort(compareMemberOrder);
  const topicSignature = [
    members.map((member) => member.email).join(","),
    (course.personalTopics || []).map((item) => `${item.email}:${item.topic || ""}`).join("|")
  ].join("::");
  const [draftTopics, setDraftTopics] = useState({});
  const personalTopicDirty = members.some((member) => (
    String(draftTopics[member.email] || "") !== String((course.personalTopics || []).find((item) => item.email === member.email)?.topic || "")
  ));

  useEffect(() => {
    setDraftTopics(Object.fromEntries(members.map((member) => [
      member.email,
      (course.personalTopics || []).find((item) => item.email === member.email)?.topic || ""
    ])));
  }, [topicSignature]);

  function savePersonalTopics() {
    const nextTopics = members.map((member) => ({
      email: member.email,
      topic: draftTopics[member.email] || ""
    }));
    return updateCourse((current) => ({ ...current, personalTopics: nextTopics }), { toast: true, writeMembers: admin, classFields: admin ? null : ["personalTopics"] });
  }

  return (
    <>
      <PanelTitle title="Topic Cá nhân" action={canEdit && <SaveButton className="compact" dirty={personalTopicDirty} onClick={savePersonalTopics} />} />
      <table className="data-table personal-topic-table">
        <thead><tr><th className="stt-col">{t("stt", "STT")}</th><th className="avatar-col">{t("photo", "Ảnh")}</th><th>{t("fullName", "Họ và tên")}</th><th>{t("topic", "Topic")}</th><th>{t("studentId", "Mã số")}</th><th>{t("email", "Email")}</th></tr></thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.email}>
              <td>{member.order}</td>
              <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
              <td>{member.name}</td>
              <td>
                {canEdit ? (
                  <input value={draftTopics[member.email] || ""} onChange={(event) => setDraftTopics((current) => ({ ...current, [member.email]: event.target.value }))} />
                ) : (
                  draftTopics[member.email] || t("noTopic", "Chưa có topic.")
                )}
              </td>
              <td>{member.studentId}</td>
              <td>{member.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <div className="bottom-save-row">
          <SaveButton className="compact" dirty={personalTopicDirty} onClick={savePersonalTopics} />
        </div>
      )}
    </>
  );
}

function updatePersonalTopic(course, updateCourse, email, topic) {
  updateCourse((current) => {
    const exists = current.personalTopics.some((item) => item.email === email);
    return { ...current, personalTopics: exists ? current.personalTopics.map((item) => item.email === email ? { ...item, topic } : item) : [...current.personalTopics, { email, topic }] };
  });
}


const PEER_REVIEW_SCORE_FORMATS = [
  { value: "free", label: "Free" },
  { value: "limit", label: "Limit" },
  { value: "choice", label: "Choice" }
];

function defaultPeerReviewScoreConfig() {
  return {
    scoreFormat: "free",
    limitMin: "",
    limitMax: "",
    choiceValuesText: ""
  };
}

function peerReviewScoreConfig(review = {}) {
  const scoreFormat = PEER_REVIEW_SCORE_FORMATS.some((item) => item.value === review.scoreFormat)
    ? review.scoreFormat
    : "free";
  const choiceValues = Array.isArray(review.choiceValues)
    ? review.choiceValues.map(Number).filter(Number.isFinite).map(formatScoreNumber)
    : parsePeerReviewChoiceValues(review.choiceValues || "");
  return {
    scoreFormat,
    limitMin: hasScoreValue(review.limitMin) ? String(review.limitMin) : "",
    limitMax: hasScoreValue(review.limitMax) ? String(review.limitMax) : "",
    choiceValues,
    choiceValuesText: choiceValues.join(", ")
  };
}

function parsePeerReviewChoiceValues(value) {
  const seen = new Set();
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .map((item) => Number(item))
    .filter(Number.isFinite)
    .map(formatScoreNumber)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function validatePeerReviewScoreConfig(draft) {
  const scoreFormat = PEER_REVIEW_SCORE_FORMATS.some((item) => item.value === draft.scoreFormat)
    ? draft.scoreFormat
    : "free";
  if (scoreFormat === "limit") {
    if (!hasScoreValue(draft.limitMin) || !hasScoreValue(draft.limitMax)) {
      return { valid: false, error: "Vui lòng nhập đủ điểm tối thiểu và tối đa." };
    }
    const limitMin = Number(draft.limitMin);
    const limitMax = Number(draft.limitMax);
    if (!Number.isFinite(limitMin) || !Number.isFinite(limitMax) || limitMin > limitMax) {
      return { valid: false, error: "Giới hạn điểm không hợp lệ." };
    }
    return {
      valid: true,
      config: {
        scoreFormat,
        limitMin: formatScoreNumber(limitMin),
        limitMax: formatScoreNumber(limitMax),
        choiceValues: []
      }
    };
  }
  if (scoreFormat === "choice") {
    const choiceValues = parsePeerReviewChoiceValues(draft.choiceValuesText);
    if (choiceValues.length === 0) {
      return { valid: false, error: "Vui lòng nhập ít nhất một giá trị điểm." };
    }
    return {
      valid: true,
      config: {
        scoreFormat,
        limitMin: "",
        limitMax: "",
        choiceValues
      }
    };
  }
  return {
    valid: true,
    config: {
      scoreFormat: "free",
      limitMin: "",
      limitMax: "",
      choiceValues: []
    }
  };
}

function validatePeerReviewScore(review, score) {
  if (!hasScoreValue(score)) return { valid: false, error: "Vui lòng nhập điểm." };
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return { valid: false, error: "Điểm phải là một số hợp lệ." };
  const config = peerReviewScoreConfig(review);
  const normalizedScore = formatScoreNumber(numericScore);
  if (config.scoreFormat === "limit") {
    const limitMin = Number(config.limitMin);
    const limitMax = Number(config.limitMax);
    if (numericScore < limitMin || numericScore > limitMax) {
      return { valid: false, error: `Điểm phải nằm trong khoảng ${config.limitMin} - ${config.limitMax}.` };
    }
  }
  if (config.scoreFormat === "choice" && !config.choiceValues.includes(normalizedScore)) {
    return { valid: false, error: "Vui lòng chọn một giá trị điểm hợp lệ." };
  }
  return { valid: true, score: normalizedScore };
}

function PeerReviewScoreConfigFields({ draft, onChange, compact = false }) {
  return (
    <div className={`peer-score-config-fields ${compact ? "is-compact" : ""}`}>
      <div className="peer-score-format-control" role="group" aria-label="Format chấm điểm">
        {PEER_REVIEW_SCORE_FORMATS.map((format) => (
          <button
            className={draft.scoreFormat === format.value ? "active" : ""}
            type="button"
            key={format.value}
            onClick={() => onChange({ ...draft, scoreFormat: format.value })}
          >
            {format.label}
          </button>
        ))}
      </div>
      {draft.scoreFormat === "limit" && (
        <div className="peer-score-limit-fields">
          <label>
            <span>Min</span>
            <input
              type="number"
              step="any"
              value={draft.limitMin}
              onChange={(event) => onChange({ ...draft, limitMin: event.target.value })}
            />
          </label>
          <span>–</span>
          <label>
            <span>Max</span>
            <input
              type="number"
              step="any"
              value={draft.limitMax}
              onChange={(event) => onChange({ ...draft, limitMax: event.target.value })}
            />
          </label>
        </div>
      )}
      {draft.scoreFormat === "choice" && (
        <label className="peer-score-choice-field">
          <span>Values</span>
          <input
            value={draft.choiceValuesText}
            onChange={(event) => onChange({ ...draft, choiceValuesText: event.target.value })}
            placeholder="5, 6, 7, 8, 9, 10"
          />
        </label>
      )}
    </div>
  );
}

function PeerReviewCard({ admin, user, course, updateCourse }) {
  const addPopoverRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("group");
  const [scoreConfigDraft, setScoreConfigDraft] = useState(defaultPeerReviewScoreConfig);
  const [createError, setCreateError] = useState("");
  const options = peerReviewOptions(course, sourceType);

  useOutsideClick(addPopoverRef, addOpen, () => setAddOpen(false));

  function createReview() {
    if (!title || options.length === 0) return;
    const validation = validatePeerReviewScoreConfig(scoreConfigDraft);
    if (!validation.valid) {
      setCreateError(validation.error);
      return;
    }
    updateCourse((current) => ({
      ...current,
      peerReviews: [
        ...current.peerReviews,
        {
          id: crypto.randomUUID(),
          title,
          sourceType,
          options: peerReviewOptions(current, sourceType),
          ...validation.config,
          responses: []
        }
      ]
    }));
    setTitle("");
    setScoreConfigDraft(defaultPeerReviewScoreConfig());
    setCreateError("");
    setAddOpen(false);
  }

  return (
    <>
      <PanelTitle
        title="Người học chấm điểm"
        action={admin && (
          <div className="material-add-wrap" ref={addPopoverRef}>
            <button className="material-add-button" type="button" onClick={() => setAddOpen((current) => !current)}>
              <Plus size={14} /> Add
            </button>
            {addOpen && (
              <div className="material-add-popover peer-add-popover">
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title..." />
                <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                  <option value="personal">Cá nhân</option>
                  <option value="group">Nhóm</option>
                  <option value="intergroup">Liên nhóm</option>
                </select>
                <PeerReviewScoreConfigFields draft={scoreConfigDraft} onChange={(nextDraft) => {
                  setScoreConfigDraft(nextDraft);
                  setCreateError("");
                }} compact />
                <div className="material-upload-actions">
                  <button className="primary-action compact dark-action" type="button" onClick={createReview} disabled={!title || options.length === 0}>
                    <Plus size={14} /> Create
                  </button>
                </div>
                {createError && <p className="error-text">{createError}</p>}
              </div>
            )}
          </div>
        )}
      />
      <div className="list-stack">
        {course.peerReviews.map((review) => <PeerReviewItem key={review.id} admin={admin} user={user} course={course} review={review} updateCourse={updateCourse} />)}
      </div>
    </>
  );
}

function peerReviewOptions(course, sourceType) {
  if (sourceType === "personal") {
    return course.personalTopics
      .filter((item) => item.topic?.trim())
      .map((item) => {
        const member = course.members.find((learner) => learner.email === item.email);
        return `${member?.name || item.email} - ${item.topic}`;
      });
  }

  if (sourceType === "intergroup") {
    return buildIntergroupTopicCards(course, buildGroupTopicCards(course))
      .filter((item) => item.topic?.topic?.trim())
      .map((item) => `${item.label} - ${item.topic.topic}`);
  }

  return course.groupTopics
    .filter((item) => item.topic?.trim())
    .map((item) => `${item.name} - ${item.topic}`);
}

function PeerReviewScoreInput({ review, value, onChange, disabled }) {
  const config = peerReviewScoreConfig(review);
  if (config.scoreFormat === "choice") {
    return (
      <select className="peer-score-input peer-score-choice-select" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">Điểm</option>
        {config.choiceValues.map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
    );
  }

  return (
    <div className="peer-score-number-wrap">
      <input
        className="peer-score-input"
        type="number"
        step="any"
        min={config.scoreFormat === "limit" ? config.limitMin : undefined}
        max={config.scoreFormat === "limit" ? config.limitMax : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Điểm"
        disabled={disabled}
      />
      {config.scoreFormat === "limit" && <small>{config.limitMin} – {config.limitMax}</small>}
    </div>
  );
}


function PeerReviewItem({ admin, user, course, review, updateCourse }) {
  const requestConfirm = useConfirmAction();
  const [topic, setTopic] = useState(review.options[0] || "");
  const [score, setScore] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState(() => peerReviewScoreConfig(review));
  const [configStatus, setConfigStatus] = useState("");
  const [configError, setConfigError] = useState("");
  const choiceValuesSignature = Array.isArray(review.choiceValues) ? review.choiceValues.join("|") : String(review.choiceValues || "");
  const visibleResponses = admin ? (review.responses || []) : (review.responses || []).filter((row) => row.email === user.email);
  const reviewScoreConfigDirty = jsonSignature(configDraft) !== jsonSignature(peerReviewScoreConfig(review));

  useEffect(() => {
    setConfigDraft(peerReviewScoreConfig(review));
    setScore("");
  }, [review.id, review.scoreFormat, review.limitMin, review.limitMax, choiceValuesSignature]);

  function saveScoreConfig() {
    const validation = validatePeerReviewScoreConfig(configDraft);
    setConfigStatus("");
    setConfigError("");
    if (!validation.valid) {
      setConfigError(validation.error);
      return;
    }
    const savePromise = updateCourse((current) => ({
      ...current,
      peerReviews: (current.peerReviews || []).map((item) => (
        item.id === review.id ? { ...item, ...validation.config } : item
      ))
    }), { toast: "Đã cập nhật format chấm điểm." });
    setConfigDraft((current) => ({
      ...current,
      ...validation.config,
      choiceValuesText: validation.config.choiceValues.join(", ")
    }));
    setConfigStatus("Đã lưu format chấm điểm.");
    return savePromise;
  }

  async function submitReviewScore() {
    const validation = validatePeerReviewScore(review, score);
    if (!validation.valid) {
      setSubmitStatus("");
      setSubmitError(validation.error);
      return;
    }
    setSubmitStatus("");
    setSubmitError("");
    setSubmitting(true);
    try {
      const learner = course.members.find((member) => member.email === user.email);
      const response = {
        id: crypto.randomUUID(),
        reviewId: review.id,
        email: user.email,
        name: learner?.name || user.displayName,
        studentId: learner?.studentId || "",
        topic,
        score: validation.score,
        submittedAt: new Date().toLocaleString("vi-VN"),
        submittedAtMillis: Date.now()
      };
      const savedResponse = await submitPeerReviewResponseToCloud(course.id, review.id, response);
      updateCourse((current) => ({
        ...current,
        peerReviews: (current.peerReviews || []).map((item) => item.id === review.id
          ? { ...item, responses: mergePeerReviewResponseRows(item.responses || [], [savedResponse]) }
          : item)
      }), { sync: false });
      setScore("");
      setSubmitStatus("Đã chấm điểm thành công.");
    } catch (error) {
      console.error(error);
      setSubmitError("Không thể lưu điểm chấm. Vui lòng thử lại hoặc báo giảng viên kiểm tra quyền Firestore.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="expand-card peer">
      <div className="card-row-head">
        <strong>{review.title}</strong>
        {admin && <button className="icon-danger" onClick={() => requestConfirm({
          title: "Xác nhận xóa thẻ chấm điểm",
          message: `Bạn có chắc muốn xóa thẻ "${review.title}" không?`,
          confirmLabel: "Xóa thẻ"
        }, () => updateCourse((current) => ({ ...current, peerReviews: (current.peerReviews || []).filter((item) => item.id !== review.id) })))}><Trash2 size={15} /></button>}
      </div>
      {admin ? (
        <div className="peer-score-admin-panel">
          <div className="peer-score-admin-head">
            <strong>Format chấm điểm</strong>
            <SaveButton className="compact" dirty={reviewScoreConfigDirty} onClick={saveScoreConfig} />
          </div>
          <PeerReviewScoreConfigFields draft={configDraft} onChange={(nextDraft) => {
            setConfigDraft(nextDraft);
            setConfigStatus("");
            setConfigError("");
          }} />
          {configStatus && <p className="success-text">{configStatus}</p>}
          {configError && <p className="error-text">{configError}</p>}
        </div>
      ) : (
        <div className="review-form">
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {review.options.map((option) => <option key={option}>{option}</option>)}
          </select>
          <PeerReviewScoreInput review={review} value={score} onChange={(value) => {
            setScore(value);
            setSubmitError("");
            setSubmitStatus("");
          }} disabled={submitting} />
          <button onClick={submitReviewScore} disabled={!hasScoreValue(score) || submitting}>{submitting ? "Đang lưu..." : "Submit"}</button>
        </div>
      )}
      {submitStatus && <p className="success-text">{submitStatus}</p>}
      {submitError && <p className="error-text">{submitError}</p>}
      <button className="review-results-toggle" type="button" onClick={() => setResultsOpen((current) => !current)}>
        {resultsOpen ? "Ẩn điểm người học chấm" : "Xem điểm người học chấm"}
      </button>
      {resultsOpen && (
        <>
          <div className="review-results-head">
            <strong>{admin ? "Tất cả điểm đã chấm" : "Điểm bạn đã chấm"}</strong>
            {admin && <button className="export-button" onClick={() => exportReview({ ...review, responses: visibleResponses })}>Export Excel</button>}
          </div>
          <table className="data-table compact-table review-results-table">
            <thead><tr><th>STT</th><th>Họ và tên</th><th>Topic</th><th>Điểm chấm</th><th>Thời gian</th><th>Mã số</th><th>Email</th></tr></thead>
            <tbody>
              {visibleResponses.length === 0 ? (
                <tr><td colSpan="7">{admin ? "Chưa có người học chấm điểm." : "Bạn chưa chấm điểm trong thẻ này."}</td></tr>
              ) : visibleResponses.map((row, index) => (
                <tr key={row.id || `${row.email}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{row.name}</td>
                  <td>{row.topic}</td>
                  <td>{row.score}</td>
                  <td>{row.submittedAt || ""}</td>
                  <td>{row.studentId}</td>
                  <td>{row.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}

function mergePeerReviewResponseRows(primary, secondary) {
  const seen = new Set();
  return [...secondary, ...primary].filter((row) => {
    const key = row.id || `${row.email}-${row.topic}-${row.score}-${row.submittedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((first, second) => Number(second.submittedAtMillis || 0) - Number(first.submittedAtMillis || 0));
}

function exportSummaryGradebook(course, assignments, rows) {
  const assignmentHeaders = assignments.map((assignment) => {
    const book = findSummaryGradebook(course, assignment.id, true);
    const typeLabel = gradebookTypeLabels[book?.type] || "";
    const ratio = assignment.ratio || "0";
    return `${assignment.title || "Bài tập"} (Tỉ lệ ${ratio}%)${typeLabel ? ` - ${typeLabel}` : ""}`;
  });
  const headers = ["STT", "Họ tên", "Mã số", ...assignmentHeaders, "Final Score"];
  const dataRows = rows.map((row) => [
    row.member.order ?? "",
    row.member.name || row.member.email || "",
    row.member.studentId ?? "",
    ...row.components.map((component) => component.display ?? ""),
    row.finalScore ?? ""
  ]);
  const title = `${course.name || "Lớp học"} - Bảng điểm tổng kết`;
  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #d9e2ec; padding: 8px 10px; vertical-align: middle; }
          th { background: #eaf1ff; font-weight: 700; }
          .title { background: #ffffff; font-size: 18px; text-align: left; }
          .text { mso-number-format: "\\@"; }
          .score { text-align: center; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr><th class="title" colspan="${headers.length}">${escapeHtml(excelTextValue(title))}</th></tr>
            <tr>${headers.map((header) => `<th class="text">${escapeHtml(excelTextValue(header))}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${dataRows.map((row) => `
              <tr>
                ${row.map((cell, index) => {
                  const isScoreColumn = index >= 3;
                  return `<td class="${isScoreColumn ? "score" : "text"}">${escapeHtml(excelTextValue(cell))}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
    </html>`;
  downloadExcelHtml(html, `${safeExportFileName(course.name || course.code || "class")}-bang-diem-tong-ket.xls`);
}

function excelTextValue(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function safeExportFileName(value) {
  const cleaned = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 70);
  return cleaned || "export";
}

function downloadExcelHtml(html, fileName) {
  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function exportReview(review) {
  const headers = ["STT", "Họ và tên", "Topic", "Điểm chấm", "Thời gian", "Mã số", "Email"];
  const rows = review.responses.map((row, index) => [index + 1, row.name, row.topic, row.score, row.submittedAt || "", row.studentId, row.email]);
  const html = `
    <html><head><meta charset="UTF-8" /></head><body>
      <table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${review.title}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function ProfileModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    displayName: user.displayName || "",
    studentId: user.studentId || ""
  });
  const profileDirty = jsonSignature(form) !== jsonSignature({
    displayName: user.displayName || "",
    studentId: user.studentId || ""
  });

  return (
    <Modal title="Profile" onClose={onClose}>
      <div className="profile-modal-head">
        <ProfileAvatar user={user} label={form.displayName || user.email} />
        <div>
          <strong>{form.displayName || user.email}</strong>
          <small>{user.email}</small>
        </div>
      </div>
      <div className="profile-form">
        <label>
          <span>Họ tên</span>
          <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
        </label>
        <label>
          <span>Email</span>
          <input className="readonly-input" value={user.email} disabled />
        </label>
        <label>
          <span>Mã số</span>
          <input value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} />
        </label>
      </div>
      <SaveButton dirty={profileDirty} onClick={() => onSave({ ...user, ...form })} />
    </Modal>
  );
}

function JoinClassModal({ user, classes, cloudMode, initialCode = "", onClose, onJoin }) {
  const [form, setForm] = useState({ name: user.displayName || "", studentId: user.studentId || "", code: initialCode });
  const [error, setError] = useState("");
  useEffect(() => {
    setForm((current) => ({ ...current, code: initialCode || current.code }));
  }, [initialCode]);
  return (
    <Modal title="Tham gia lớp học" onClose={onClose}>
      <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Họ và tên" />
      <input value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} placeholder="Mã số" />
      <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="Mã lớp" />
      {error && <p className="error-text">{error}</p>}
      <button className="primary-action" onClick={() => {
        const course = classes.find((item) => item.code.toUpperCase() === form.code.toUpperCase());
        if (cloudMode) return onJoin(null, form);
        if (!course) return setError("Mã lớp không đúng.");
        const userEmail = normalizeEmail(user.email);
        if (lecturerEmailSet(course).has(userEmail)) return setError("Email này đang là giảng viên của lớp này. Không thể tham gia với vai trò người học.");
        if (course.members.some((member) => normalizeEmail(member.email) === userEmail)) return setError("Email này đã gửi yêu cầu hoặc đã tham gia lớp.");
        onJoin(course.id, { order: course.members.length + 1, name: form.name, email: userEmail, photoURL: user.photoURL || "", studentId: form.studentId, status: "pending", code: form.code });
      }}>Gửi yêu cầu tham gia</button>
    </Modal>
  );
}

function prepareCourseForSave(course, user) {
  const existing = Boolean(course.ownerEmail);
  const ownerEmail = normalizeEmail(course.ownerEmail || user?.email || SUPREME_EMAIL);
  const ownerName = course.ownerName || user?.displayName || (ownerEmail === SUPREME_EMAIL ? SUPREME_PROFILE.name : ownerEmail);
  const lecturers = existing ? buildCourseLecturers({ ...course, ownerEmail, ownerName }) : [{ email: ownerEmail, name: ownerName, role: "owner" }];
  return {
    ...course,
    info: normalizeClassInfo(course.info),
    announcementPostPermission: getAnnouncementPostPermission(course),
    ownerEmail,
    ownerName,
    lecturers,
    lecturerEmails: lecturers.map((lecturer) => normalizeEmail(lecturer.email))
  };
}

function NewClassModal({ existing, user, onClose, onSave }) {
  const [form, setForm] = useState(() => existing || { id: crypto.randomUUID(), name: "", description: "", code: "", pinned: false, announcementPostPermission: ANNOUNCEMENT_POST_PERMISSIONS.everyone, info: { title: "", size: 0, time: "", room: "", description: "", rules: "", zaloGroupUrl: "", googleMeetUrl: "", gallery: [] }, scheduleRows: defaultScheduleRows(), dutySchedules: [], members: [], announcements: [], groupTopics: [], intergroupTopics: [], personalTopics: [], materials: [], assignments: [], gradebooks: [], peerReviews: [], extraCards: [], hiddenCards: [], pinnedCards: [], cardOrder: [] });
  const classFormDirty = existing ? jsonSignature(form) !== jsonSignature(existing) : true;
  return (
    <Modal title={existing ? "Chỉnh sửa lớp học" : "Thêm lớp học mới"} onClose={onClose}>
      <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, info: { ...form.info, title: event.target.value } })} placeholder="Tên lớp mới" />
      <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value, info: { ...form.info, description: event.target.value } })} placeholder="Mô tả" />
      {existing ? (
        <SaveButton dirty={classFormDirty} onClick={() => onSave(form)}>Lưu lớp học</SaveButton>
      ) : (
        <button className="primary-action" onClick={() => onSave(form)}>Tạo lớp mới</button>
      )}
    </Modal>
  );
}

function ManageLecturersModal({ lecturers, onClose, onSave, onDelete }) {
  const requestConfirm = useConfirmAction();
  const [draft, setDraft] = useState({ email: "", name: "" });
  const normalizedDraftEmail = normalizeEmail(draft.email);
  return (
    <Modal title="Manage Lecturers" onClose={onClose}>
      <div className="inline-form lecturer-add-form">
        <input value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} placeholder="Email giảng viên (owner)" />
        <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Tên hiển thị" />
        <button
          className="primary-action"
          disabled={!normalizedDraftEmail || isSupremeEmail(normalizedDraftEmail)}
          onClick={() => {
            onSave({ email: normalizedDraftEmail, name: draft.name.trim() || normalizedDraftEmail });
            setDraft({ email: "", name: "" });
          }}
        >
          <UserPlus size={15} /> Add Lecturer
        </button>
      </div>
      <div className="lecturer-list">
        {lecturers.map((lecturer) => {
          const email = normalizeEmail(lecturer.email);
          return (
            <div className="lecturer-row" key={email}>
              <div>
                <strong>{lecturer.name || email}</strong>
                <small>{email}{isSupremeEmail(email) ? " · Đấng tối cao" : ""}</small>
              </div>
              {!isSupremeEmail(email) && (
                <button className="icon-danger" onClick={() => requestConfirm({
                  title: "Xóa giảng viên?",
                  message: `Bạn có chắc muốn xóa "${lecturer.name || email}" khỏi danh sách giảng viên bậc 1 không?`,
                  confirmLabel: "Xóa giảng viên"
                }, () => onDelete(email))}><Trash2 size={15} /></button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function ConfirmModal({ title, message, confirmLabel, cancelLabel, onCancel, onConfirm }) {
  const language = useUiLanguage();
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button className="secondary-action" type="button" onClick={onCancel}>{uiLiteral(language, cancelLabel)}</button>
        <button className="danger-action" type="button" onClick={onConfirm}>{uiLiteral(language, confirmLabel)}</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, className = "" }) {
  const language = useUiLanguage();
  return (
    <div className="modal-backdrop">
      <section className={`modal ${className}`.trim()}>
        <div className="panel-title"><h3>{uiLiteral(language, title)}</h3><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}

function EmptyState({ admin, onJoin, onNewClass }) {
  const language = useUiLanguage();
  return (
    <section className="empty-state">
      <h2>{uiText(language, "noVisibleClass")}</h2>
      <p>{uiText(language, "pendingClassHint")}</p>
      <button className="primary-action" onClick={admin ? onNewClass : onJoin}>{admin ? uiText(language, "addClass") : uiText(language, "joinClass")}</button>
    </section>
  );
}

function PendingPane({ course, isMobile, onMobileBackToClasses }) {
  const language = useUiLanguage();
  return (
    <section className="pending-pane">
      {isMobile && (
        <button className="mobile-back-button pending-back-button" type="button" onClick={onMobileBackToClasses} aria-label={uiText(language, "backToClassList")}>
          <ChevronLeft size={22} />
        </button>
      )}
      <div>
        <h2>{course.name}</h2>
        <p>{uiText(language, "joinRequestSent")}</p>
        <span className="class-code">{uiText(language, "statusPendingAccept")}</span>
      </div>
    </section>
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js?v=20260525-upload-cache"));
}

const rootElement = document.getElementById("root");
if (!window.__classroomPwaRoot) {
  window.__classroomPwaRoot = createRoot(rootElement);
}
window.__classroomPwaRoot.render(<App />);
