import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Bell,
  BellDot,
  Check,
  ChevronLeft,
  Copy,
  Crown,
  Download,
  FilePlus2,
  GraduationCap,
  LogOut,
  Menu,
  MoreVertical,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  UserRound,
  UserPlus,
  X
} from "lucide-react";
import { SUPREME_EMAIL, SUPREME_PROFILE, baseCards, extraCardLabels } from "./data";
import { hasFirebaseConfig, observeAuth, signInWithGoogle, signOutGoogle } from "./firebase";
import {
  deleteAnnouncementFromCloud,
  deleteCourseFromCloud,
  deleteLecturerFromCloud,
  deleteMemberFromCloud,
  isSupremeEmail,
  joinClassByCode,
  loadLocalClasses,
  mergeSupremeLecturer,
  normalizeEmail,
  reserveUniqueClassCode,
  saveCourseToCloud,
  saveLecturerToCloud,
  savePrivateClassPins,
  saveLocalClasses,
  saveAnnouncementToCloud,
  notifyAnnouncementEmail,
  subscribeLecturers,
  subscribeClasses,
  subscribePrivateClassPins,
  submitAssignmentToCloud,
  submitPeerReviewResponseToCloud,
  syncUserProfile,
  uploadClassFile
} from "./classroomRepository";
import "./styles.css";

function isAdmin(user) {
  return isSupremeEmail(user?.email);
}

function isClassLeaderMember(member) {
  return member?.classLeader === true || member?.role === "classLeader";
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
  everyone: "everyone"
};

const ANNOUNCEMENT_POST_PERMISSION_OPTIONS = [
  { value: ANNOUNCEMENT_POST_PERMISSIONS.lecturers, label: "Giảng viên" },
  { value: ANNOUNCEMENT_POST_PERMISSIONS.lecturersLeaders, label: "Giảng viên + Lớp trưởng" },
  { value: ANNOUNCEMENT_POST_PERMISSIONS.everyone, label: "Tất cả mọi người" }
];

const MOBILE_MEDIA_QUERY = "(max-width: 760px)";
const MOBILE_VIEWS = {
  classes: "classes",
  cards: "cards",
  detail: "detail"
};
const ANNOUNCEMENT_SEEN_PREFIX = "classroompwa-announcement-seen:";

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
  const permission = getAnnouncementPostPermission(course);
  if (permission === ANNOUNCEMENT_POST_PERMISSIONS.lecturersLeaders) return Boolean(classLeader);
  if (permission === ANNOUNCEMENT_POST_PERMISSIONS.everyone) return isAcceptedCourseMember(course, user);
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

function adminWriterEmails() {
  return [SUPREME_EMAIL];
}

async function uploadManyFiles(course, folder, files, shareOptions = {}) {
  return Promise.all(Array.from(files || []).map((file) => uploadClassFile(course, folder, file, shareOptions)));
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
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState(readJoinCodeParam);
  const [showNewClass, setShowNewClass] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showManageLecturers, setShowManageLecturers] = useState(false);
  const [lecturers, setLecturers] = useState([]);
  const [sidebarPinnedClassIds, setSidebarPinnedClassIds] = useState([]);
  const [saveToast, setSaveToast] = useState(null);
  const [mobileView, setMobileView] = useState(MOBILE_VIEWS.classes);
  const [announcementSeenAt, setAnnouncementSeenAt] = useState(null);
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

  const supreme = isSupremeEmail(user?.email);
  const primaryLecturer = canCreateClasses(user, lecturers);
  const visibleClasses = useMemo(() => {
    if (!user) return [];
    const matches = classes.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
    if (supreme || primaryLecturer) return sortPinnedClasses(matches, sidebarPinnedClassIds);
    return sortPinnedClasses(
      matches.filter((item) => canManageCourse(user, item) || item.members.some((member) => member.email === user.email)),
      sidebarPinnedClassIds
    );
  }, [classes, primaryLecturer, sidebarPinnedClassIds, query, supreme, user]);
  const notificationClasses = useMemo(() => {
    if (!user) return [];
    if (supreme || primaryLecturer) return classes;
    return classes.filter((item) => canManageCourse(user, item) || item.members.some((member) => member.email === user.email));
  }, [classes, primaryLecturer, supreme, user]);
  const selectedClass = visibleClasses.find((item) => item.id === selectedClassId) || visibleClasses[0];
  const membership = selectedClass?.members.find((member) => member.email === user.email);
  const selectedClassAdmin = canManageCourse(user, selectedClass);
  const selectedClassCanDelete = canDeleteCourse(user, selectedClass);
  const selectedClassCanManageLecturers = canManageCourseLecturers(user, selectedClass);
  const latestAnnouncementTime = useMemo(() => latestAnnouncementTimestamp(notificationClasses), [notificationClasses]);
  const hasUnreadAnnouncements = announcementSeenAt !== null && latestAnnouncementTime > announcementSeenAt;

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined;
    return observeAuth((nextUser) => {
      const nextProfile = nextUser ? {
        displayName: nextUser.displayName || nextUser.email,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
        isDemo: false
      } : null;
      setUser(nextUser ? {
        displayName: nextUser.displayName || nextUser.email,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
        studentId: "",
        isDemo: false
      } : null);
      if (nextProfile) {
        syncUserProfile(nextProfile)
          .then((profile) => {
            if (!profile) return;
            if (Array.isArray(profile.pinnedClassIds)) setSidebarPinnedClassIds(profile.pinnedClassIds);
            setUser((current) => (
              current?.email === profile.email
                ? { ...current, displayName: profile.displayName || current.displayName, photoURL: profile.photoURL || current.photoURL, studentId: profile.studentId || "" }
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
    return subscribeLecturers(user, (nextLecturers) => {
      setLecturers(nextLecturers);
    }, (nextError) => {
      console.error(nextError);
      setLecturers(mergeSupremeLecturer([]));
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
      setUser({
        displayName: nextUser.displayName || nextUser.email,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
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

  function handleNotificationClick() {
    if (!user?.email) return;
    const nextSeenAt = Math.max(Date.now(), latestAnnouncementTime || 0);
    saveAnnouncementSeenAt(user.email, nextSeenAt);
    setAnnouncementSeenAt(nextSeenAt);
  }

  async function handleProfileSave(profile) {
    const nextProfile = {
      email: user.email,
      displayName: profile.displayName.trim() || user.email,
      photoURL: user.photoURL || profile.photoURL || "",
      studentId: profile.studentId.trim()
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

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={handleLogin} loginError={loginError} />;

  return (
    <main className={`app-shell ${isMobile ? `mobile-flow mobile-view-${mobileView}` : ""}`}>
      <Sidebar
        canCreateClass={primaryLecturer}
        canManageLecturers={supreme}
        classes={visibleClasses}
        pinnedClassIds={sidebarPinnedClassIds}
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
          if (action === "delete" && canDeleteCourse(user, classItem)) {
            const next = classes.filter((course) => course.id !== classItem.id);
            updateClasses(next);
            deleteCourseFromCloud(classItem);
            setSelectedClassId(next[0]?.id);
          }
          if (action === "edit" && canManageCourse(user, classItem)) setShowNewClass(classItem);
        }}
        accountOpen={accountOpen}
        setAccountOpen={setAccountOpen}
        notificationUnread={hasUnreadAnnouncements}
        onNotificationsClick={handleNotificationClick}
        user={user}
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
          {error && <div className="toast toast-error">{error}</div>}
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
          canDeleteClass={selectedClassCanDelete}
          canManageCourseLecturers={selectedClassCanManageLecturers}
          user={user}
          course={selectedClass}
          selectedCard={selectedCard}
          setSelectedCard={setSelectedCard}
          isMobile={isMobile}
          mobileView={mobileView}
          onMobileBackToClasses={() => stepBackMobileView(MOBILE_VIEWS.classes)}
          onMobileBackToCards={() => stepBackMobileView(MOBILE_VIEWS.cards)}
          onMobileOpenCard={() => navigateMobileView(MOBILE_VIEWS.detail)}
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
  );
}

function sortPinnedClasses(items, pinnedClassIds = []) {
  const pinned = new Set(pinnedClassIds);
  return [...items].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
}

function latestAnnouncementTimestamp(classes) {
  return Math.max(0, ...classes.flatMap((course) => (
    (course.announcements || []).map((announcement) => Number(announcement.createdAtMillis || 0))
  )));
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

function Sidebar(props) {
  const {
    canCreateClass,
    canManageLecturers,
    classes,
    pinnedClassIds = [],
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
    onNotificationsClick,
    user,
    onProfile,
    onManageLecturers,
    onLogout
  } = props;
  const accountRef = useRef(null);
  useOutsideClick(accountRef, accountOpen, () => setAccountOpen(false));

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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm lớp học" />
          </label>
          {canCreateClass && (
            <button className="primary-action" onClick={onNewClass}>
              <Plus size={16} />
              Add New Class
            </button>
          )}
          <button className="join-action" onClick={onJoin}>
            <UserPlus size={16} />
            Tham gia lớp học
          </button>
          <nav className="class-list">
            {groupClassesForSidebar(classes, canManageLecturers).map((group) => (
              <div className="class-sidebar-group" key={group.key}>
                {group.label && <div className="class-sidebar-heading">{group.label}</div>}
                {group.classes.map((course) => (
                  <ClassRow
                    key={course.id}
                    course={course}
                    selected={course.id === selectedClassId}
                    pinned={pinnedClassIds.includes(course.id)}
                    owned={ownsCourse(user, course)}
                    canPin
                    canEdit={canDeleteCourse(user, course)}
                    canDelete={canDeleteCourse(user, course)}
                    onSelect={() => selectClass(course.id)}
                    onAction={onClassAction}
                  />
                ))}
              </div>
            ))}
          </nav>
          <div className="account-box" ref={accountRef}>
            <div className="account-row">
              <button className="account-trigger" onClick={() => setAccountOpen(!accountOpen)}>
                <ProfileAvatar user={user} label={user.displayName || user.email} />
                <span>
                  <strong>{user.displayName || user.email}</strong>
                  <small>{user.email}</small>
                </span>
              </button>
              <button
                className={`notification-button ${notificationUnread ? "unread" : ""}`}
                type="button"
                title={notificationUnread ? "Có thông báo mới" : "Thông báo"}
                aria-label={notificationUnread ? "Có thông báo mới" : "Thông báo"}
                onClick={onNotificationsClick}
              >
                {notificationUnread ? <BellDot size={19} /> : <Bell size={19} />}
              </button>
            </div>
            {accountOpen && (
              <div className="account-menu">
                <button onClick={onProfile}>
                  <UserRound size={15} />
                  Profile
                </button>
                {canManageLecturers && (
                  <button onClick={onManageLecturers}>
                    <UserPlus size={15} />
                    Manage Lecturers
                  </button>
                )}
                <button onClick={onLogout}>
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </>
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

function ClassRow({ course, selected, pinned, owned, canPin, canEdit, canDelete, onSelect, onAction }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useOutsideClick(menuRef, open, () => setOpen(false));
  const hasMenu = canPin || canEdit || canDelete;
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
              {canPin && <button onClick={() => { onAction("pin", course); setOpen(false); }}><Pin size={14} /> {pinned ? "Unpin" : "Pin"}</button>}
              {canEdit && <button onClick={() => { onAction("edit", course); setOpen(false); }}>Edit</button>}
              {canDelete && <button onClick={() => { onAction("delete", course); setOpen(false); }}><Trash2 size={14} /> Delete</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClassPane({
  admin,
  canManageCourseLecturers,
  user,
  course,
  selectedCard,
  setSelectedCard,
  isMobile,
  mobileView,
  onMobileBackToClasses,
  onMobileBackToCards,
  onMobileOpenCard,
  updateCourse
}) {
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState("");
  const [dragOverCardId, setDragOverCardId] = useState("");
  const [showClassCode, setShowClassCode] = useState(false);
  const addCardRef = useRef(null);
  useOutsideClick(addCardRef, cardMenuOpen, () => setCardMenuOpen(false));
  const classLeader = isClassLeaderForCourse(course, user);
  const canEditMembers = admin || classLeader;
  const canEditTopics = admin || classLeader;
  const hiddenCards = course.hiddenCards || [];
  const pinnedCards = course.pinnedCards || [];
  const extraCards = course.extraCards || [];
  const cardLabels = new Map([...baseCards.map((card) => [card.id, card.label]), ...Object.entries(extraCardLabels)]);
  const cards = orderCards(
    [...baseCards, ...extraCards.map((id) => ({ id, label: extraCardLabels[id] }))].filter((card) => !hiddenCards.includes(card.id)),
    course.cardOrder,
    pinnedCards
  );
  const selectedCardLabel = cardLabels.get(selectedCard) || "";
  const addableCards = [...cardLabels.entries()].filter(([id]) => {
    const extraMissing = extraCardLabels[id] && !extraCards.includes(id);
    return hiddenCards.includes(id) || extraMissing;
  });

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

  return (
    <section className="rightpane">
      <div className="class-header">
        {isMobile && (
          <button className="mobile-back-button" type="button" onClick={onMobileBackToClasses} aria-label="Quay lại danh sách lớp">
            <ChevronLeft size={22} />
          </button>
        )}
        <div>
          <h2>{course.name}</h2>
          <p>{course.description}</p>
        </div>
        <button className="class-code class-code-button" type="button" onClick={() => setShowClassCode(true)}>
          Mã lớp: {course.code}
        </button>
      </div>
      <div className="class-workspace">
        <aside className="leftpanel">
          {cards.map((card) => (
            <CardNavItem
              key={card.id}
              admin={admin}
              card={card}
              active={selectedCard === card.id}
              pinned={pinnedCards.includes(card.id)}
              draggable={admin}
              dragging={draggingCardId === card.id}
              dragOver={dragOverCardId === card.id && draggingCardId !== card.id}
              onSelect={() => openCard(card.id)}
              onPin={() => togglePinCard(card.id)}
              onDelete={() => hideCard(card.id)}
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
                  {addableCards.length === 0 && <span>Đã có đủ card</span>}
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
              <button className="mobile-back-button" type="button" onClick={onMobileBackToCards} aria-label="Quay lại danh sách thẻ">
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
            selectedCard={selectedCard}
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
  const extraCards = course.extraCards || [];
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

function CardNavItem({ admin, card, active, pinned, draggable, dragging, dragOver, onSelect, onPin, onDelete, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useOutsideClick(menuRef, open, () => setOpen(false));

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
          <button className="icon-button card-menu-trigger" onClick={() => setOpen(!open)} aria-label={`${card.label} menu`}>
            <MoreVertical size={15} />
          </button>
          {open && (
            <div className="mini-menu left-card-menu">
              <button onClick={() => { onPin(); setOpen(false); }}><Pin size={14} /> {pinned ? "Unpin" : "Pin"}</button>
              <button onClick={() => { onDelete(); setOpen(false); }}><Trash2 size={14} /> Delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRenderer({ admin, canManageCourseLecturers, classLeader, canEditMembers, canEditTopics, user, course, selectedCard, updateCourse }) {
  if (selectedCard === "members") return <MembersCard admin={admin} canManageCourseLecturers={canManageCourseLecturers} classLeader={classLeader} canEditMembers={canEditMembers} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "announcements") return <AnnouncementsCard admin={admin} classLeader={classLeader} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "info") return <InfoCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "schedule") return <ScheduleCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "groupTopic") return <GroupTopicCard admin={admin} canEdit={canEditTopics} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "intergroupTopic") return <IntergroupTopicCard admin={admin} canEdit={canEditTopics} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "materials") return <MaterialsCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "assignments") return <AssignmentsCard admin={admin} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "grades") return <GradesCard admin={admin} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "personalTopic") return <PersonalTopicCard admin={admin} canEdit={canEditTopics} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "peerReview") return <PeerReviewCard admin={admin} user={user} course={course} updateCourse={updateCourse} />;
  return null;
}

function PanelTitle({ title, action }) {
  return (
    <div className="panel-title">
      <h3>{title}</h3>
      {action}
    </div>
  );
}


function MembersCard({ admin, canManageCourseLecturers, classLeader, canEditMembers, user, course, updateCourse }) {
  const [viewMode, setViewMode] = useState("personal");
  const [lecturerDraft, setLecturerDraft] = useState({ email: "", name: "" });
  const accepted = course.members.filter((member) => member.status === "accepted");
  const pending = course.members.filter((member) => member.status === "pending");
  const courseLecturers = buildCourseLecturers(course);
  const memberDraftSignature = accepted.map((member) => `${member.email}:${member.order || ""}:${member.group || ""}:${isClassLeaderMember(member) ? "1" : "0"}`).join("|");
  const [memberDrafts, setMemberDrafts] = useState({});
  const orderedMembers = [...accepted].sort(compareMemberOrder);
  const groupedMembers = groupMembersByGroup(accepted);

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

  function saveMembers() {
    updateCourse((current) => ({
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

  function addCourseLecturer() {
    const email = normalizeEmail(lecturerDraft.email);
    if (!email || email === normalizeEmail(course.ownerEmail || SUPREME_EMAIL)) return;
    updateCourse((current) => {
      const lecturers = buildCourseLecturers(current);
      if (lecturers.some((lecturer) => normalizeEmail(lecturer.email) === email)) return current;
      const nextLecturers = [...lecturers, { email, name: lecturerDraft.name.trim() || email, role: "assistant" }];
      return { ...current, lecturers: nextLecturers, lecturerEmails: nextLecturers.map((lecturer) => normalizeEmail(lecturer.email)) };
    }, { toast: "Đã thêm giảng viên.", writeMembers: false, writeSummary: false, classFields: ["lecturers", "lecturerEmails"] });
    setLecturerDraft({ email: "", name: "" });
  }

  function removeCourseLecturer(email) {
    const normalized = normalizeEmail(email);
    updateCourse((current) => {
      const nextLecturers = buildCourseLecturers(current).filter((lecturer) => normalizeEmail(lecturer.email) !== normalized || lecturer.role === "owner");
      return { ...current, lecturers: nextLecturers, lecturerEmails: nextLecturers.map((lecturer) => normalizeEmail(lecturer.email)) };
    }, { toast: "Đã xóa giảng viên.", writeMembers: false, writeSummary: false, classFields: ["lecturers", "lecturerEmails"] });
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
          <div className="panel-actions">
            <div className="member-view-toggle" aria-label="Chế độ xem thành viên">
              <button type="button" className={viewMode === "personal" ? "active" : ""} onClick={() => setViewMode("personal")}>Cá nhân</button>
              <button type="button" className={viewMode === "group" ? "active" : ""} onClick={() => setViewMode("group")}>Nhóm</button>
            </div>
            {classLeader && !admin && <span className="permission-chip"><Crown size={14} /> Lớp trưởng</span>}
            {canEditMembers && <button className="primary-action compact" onClick={saveMembers}>Save</button>}
          </div>
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
              <strong>{profile.role === "owner" ? "Giảng viên (owner)" : "Giảng viên"}</strong>
              <small>{teacherName} - {profile.email}</small>
              {canManageCourseLecturers && profile.role !== "owner" && (
                <button className="icon-danger compact-icon" onClick={() => removeCourseLecturer(profile.email)}><X size={14} /></button>
              )}
            </div>
            );
          })}
        </div>
        {canManageCourseLecturers && (
          <div className="inline-form lecturer-add-form">
            <input value={lecturerDraft.email} onChange={(event) => setLecturerDraft((current) => ({ ...current, email: event.target.value }))} placeholder="Email giảng viên" />
            <input value={lecturerDraft.name} onChange={(event) => setLecturerDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Tên hiển thị" />
            <button onClick={addCourseLecturer}><UserPlus size={15} /> Thêm giảng viên</button>
          </div>
        )}
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
                <button onClick={() => removeMember(course, updateCourse, member.email)}><X size={15} /> Reject</button>
              </div>
            ))}
          </section>
        )}
        {viewMode === "personal" ? (
          <MembersTable admin={admin} canManageCourseLecturers={canManageCourseLecturers} canEditMembers={canEditMembers} course={course} members={orderedMembers} memberDrafts={memberDrafts} onDraftChange={updateMemberDraft} onPromoteToLecturer={promoteMemberToLecturer} updateCourse={updateCourse} />
        ) : (
          <div className="member-group-list">
            {groupedMembers.map((group) => (
              <section className="member-group-card" key={group.key}>
                <h4>{group.label}</h4>
                <MembersTable admin={admin} canManageCourseLecturers={canManageCourseLecturers} canEditMembers={canEditMembers} course={course} members={group.members} memberDrafts={memberDrafts} onDraftChange={updateMemberDraft} onPromoteToLecturer={promoteMemberToLecturer} updateCourse={updateCourse} />
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MembersTable({ admin, canManageCourseLecturers, canEditMembers, course, members, memberDrafts = {}, onDraftChange, onPromoteToLecturer, updateCourse }) {
  return (
    <table className="data-table members-table">
      <thead><tr><th className="stt-col">STT</th><th className="avatar-col">Ảnh</th><th>Họ tên</th><th>Email</th><th>Mã số</th><th>Nhóm</th>{admin && <th />}</tr></thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.email}>
            <td>{canEditMembers ? <input className="order-input" data-enter-group="member-order" inputMode="numeric" value={memberDrafts[member.email]?.order ?? String(member.order || "")} onKeyDown={(event) => focusNextInputOnEnter(event, "member-order")} onChange={(event) => onDraftChange(member.email, "order", event.target.value)} /> : member.order}</td>
            <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
            <td>
              <span className="member-name-cell">
                <span>{member.name}</span>
                {isClassLeaderMember(member) && <span className="leader-badge"><Crown size={12} /> Lớp trưởng</span>}
              </span>
            </td>
            <td>{member.email}</td>
            <td>{member.studentId}</td>
            <td>{canEditMembers ? <input className="group-input" data-enter-group="member-group" inputMode="numeric" value={memberDrafts[member.email]?.group ?? String(member.group || "")} onKeyDown={(event) => focusNextInputOnEnter(event, "member-group")} onChange={(event) => onDraftChange(member.email, "group", event.target.value)} /> : member.group || ""}</td>
            {admin && (
              <td>
                <div className="member-actions">
                  <MemberRoleMenu
                    member={member}
                    canPromoteToLecturer={canManageCourseLecturers}
                    onToggleClassLeader={() => setClassLeader(course, updateCourse, member.email)}
                    onPromoteToLecturer={() => onPromoteToLecturer(member)}
                  />
                  <button className="icon-danger" onClick={() => removeMember(course, updateCourse, member.email)}><X size={15} /></button>
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MemberRoleMenu({ member, canPromoteToLecturer, onToggleClassLeader, onPromoteToLecturer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const classLeader = isClassLeaderMember(member);
  useOutsideClick(ref, open, () => setOpen(false));

  return (
    <div className="member-role-wrap" ref={ref}>
      <button
        className={`leader-toggle ${classLeader ? "active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        title="Phân quyền"
        aria-label="Phân quyền"
        aria-expanded={open}
      >
        <Crown size={15} />
      </button>
      {open && (
        <div className="mini-menu member-role-menu">
          <button onClick={() => {
            onToggleClassLeader();
            setOpen(false);
          }}>
            <Crown size={14} /> {classLeader ? "Bỏ lớp trưởng" : "Lớp trưởng"}
          </button>
          {canPromoteToLecturer && (
            <button onClick={() => {
              onPromoteToLecturer();
              setOpen(false);
            }}>
              <UserPlus size={14} /> Giảng viên
            </button>
          )}
        </div>
      )}
    </div>
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

function removeMember(course, updateCourse, email) {
  updateCourse((current) => ({ ...current, members: current.members.filter((member) => member.email !== email) }));
  deleteMemberFromCloud(course.id, email);
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


function AnnouncementsCard({ admin, classLeader, user, course, updateCourse }) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [pinned, setPinned] = useState(false);
  const [publishAsMaterial, setPublishAsMaterial] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [postNotice, setPostNotice] = useState("");
  const postPermission = getAnnouncementPostPermission(course);
  const explicitPostPermission = course.announcementPostPermission || "";
  const canPost = canPostAnnouncement(course, user, admin, classLeader);

  function addFiles(fileList) {
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

  async function submitPost() {
    if (!content.trim() && files.length === 0) return;
    if (!canPost) {
      setPostError("Bạn không có quyền đăng tin trong lớp này.");
      return;
    }
    setPosting(true);
    setPostError("");
    setPostNotice("");
    try {
      const attachments = hasFirebaseConfig
        ? await uploadManyFiles(course, "announcements", files, { anyoneWithLink: true, writerEmails: adminWriterEmails() })
        : await Promise.all(files.map(readFileAsDataUrl));
      const announcement = {
        id: crypto.randomUUID(),
        author: user.email,
        authorName: user.displayName || user.email,
        authorPhotoURL: user.photoURL || "",
        role: admin ? "admin" : "learner",
        content,
        pinned,
        attachments,
        createdAt: new Date().toLocaleString("vi-VN"),
        createdAtMillis: Date.now()
      };
      const savedAnnouncement = hasFirebaseConfig
        ? await saveAnnouncementToCloud(course.id, announcement)
        : announcement;
      const shouldCreateMaterial = admin && publishAsMaterial;
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

      if (hasFirebaseConfig) {
        try {
          const emailResult = await notifyAnnouncementEmail(course.id, savedAnnouncement.id);
          if (emailResult.skipped && emailResult.reason === "missing_email_config") {
            setPostNotice("Đã đăng tin. Chưa gửi email vì chưa cấu hình RESEND_API_KEY và EMAIL_FROM trên Vercel.");
          } else if (emailResult.sentCount > 0) {
            setPostNotice(`Đã gửi email thông báo đến ${emailResult.sentCount} thành viên.`);
          } else {
            setPostNotice("Đã đăng tin. Không có thành viên khác để gửi email.");
          }
        } catch (error) {
          console.error(error);
          setPostError("Đã đăng tin nhưng không gửi được email thông báo.");
        }
      }
    } catch (error) {
      console.error(error);
      setPostError("Không thể đăng tin. Vui lòng thử lại hoặc kiểm tra quyền đăng tin/file.");
    } finally {
      setPosting(false);
    }
  }

  const posts = [...course.announcements].sort((a, b) => (
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
    || Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)
  ));

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

  return (
    <>
      <PanelTitle
        title="Thông báo"
        action={admin && (
          <select
            className="announcement-permission-select"
            aria-label="Quyền đăng tin"
            title="Quyền đăng tin"
            value={explicitPostPermission || postPermission}
            onChange={(event) => updatePostPermission(event.target.value)}
          >
            <option value="" disabled>Quyền đăng tin</option>
            {ANNOUNCEMENT_POST_PERMISSION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
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
          <textarea disabled={posting} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nhập nội dung đăng tin..." />
          <div className="composer-tools">
            <label className="file-picker icon-only" title="Đính kèm file" aria-label="Đính kèm file">
              <Paperclip size={18} />
              <input disabled={posting} type="file" multiple accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" onChange={(event) => addFiles(event.target.files)} />
            </label>
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
            {admin && <label className="check-row"><input type="checkbox" disabled={posting} checked={publishAsMaterial} onChange={(event) => setPublishAsMaterial(event.target.checked)} /> Tài liệu</label>}
            {files.length > 0 && <span>{`${files.length} file đã chọn`}</span>}
            <div className="composer-submit">
              <ProfileAvatar user={user} label={user.displayName || user.email} small />
              <button className="primary-action compact" onClick={submitPost} disabled={posting}>
                {posting ? <span className="button-spinner" /> : <Send size={15} />}
                {posting ? "Đang đăng" : "Đăng tin"}
              </button>
            </div>
          </div>
          {files.length > 0 && (
            <div className="selected-file-preview" aria-label="File đã chọn">
              {files.map((file, index) => (
                <div className="selected-file-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                  <span>{file.name}</span>
                  <button type="button" title="Xóa file" aria-label={`Xóa ${file.name}`} disabled={posting} onClick={() => removeSelectedFile(index)}>
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
        {posts.map((item) => (
          <article className={`feed-item ${item.role === "admin" ? "admin-post" : ""} ${item.pinned ? "pinned-post" : ""}`} key={item.id}>
            <div className="post-head">
              <PostAuthor post={item} currentUser={user} />
              {(admin || item.author === user.email) && (
                <div className="post-actions">
                  <button className="pin-button icon-only" title={item.pinned ? "Unpin" : "Pin"} aria-label={item.pinned ? "Unpin" : "Pin"} onClick={() => togglePostPin(item)}>{item.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
                  <button className="icon-danger" title="Xóa bài đăng" aria-label="Xóa bài đăng" onClick={() => deletePost(item)}><Trash2 size={15} /></button>
                </div>
              )}
            </div>
            <p>{item.content}</p>
            <div className="link-list">{extractUrls(item.content).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>)}</div>
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
        ))}
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
    createdAt: announcement.createdAt || new Date().toLocaleString("vi-VN"),
    createdAtMillis: announcement.createdAtMillis || Date.now()
  };
}

function materialTitleFromAnnouncement(content, materials) {
  const firstLine = String(content || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (firstLine && !firstLine.startsWith("http")) return firstLine.slice(0, 120);
  return `Tài liệu ${(materials || []).length + 1}`;
}


function InfoCard({ admin, course, updateCourse }) {
  const [draft, setDraft] = useState({ rules: "", ...course.info });
  const fields = [["title", "Title"], ["size", "Sĩ số"], ["time", "Thời gian"], ["room", "Phòng học"]];
  return (
    <>
      <PanelTitle title="Thông tin lớp học" action={admin && <button className="primary-action compact" onClick={() => updateCourse((current) => ({ ...current, info: draft }), { toast: true })}>Save</button>} />
      <div className="info-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            {admin ? <input value={draft[key] || ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /> : <strong>{course.info[key]}</strong>}
          </label>
        ))}
        <label className="wide-field">
          <span>Mô tả</span>
          {admin ? <textarea value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /> : <p>{course.info.description}</p>}
        </label>
        <label className="wide-field">
          <span>Quy định</span>
          {admin ? <textarea value={draft.rules || ""} onChange={(event) => setDraft({ ...draft, rules: event.target.value })} /> : <p>{course.info.rules || "Chưa có quy định."}</p>}
        </label>
      </div>
    </>
  );
}


function ScheduleCard({ admin, course, updateCourse }) {
  const [rows, setRows] = useState(() => normalizeScheduleRows(course.scheduleRows));
  const activeEditorRef = useRef(null);
  const scheduleSignature = JSON.stringify(course.scheduleRows || []);

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
    updateCourse((current) => ({ ...current, scheduleRows: rows.map(normalizeScheduleRowForSave) }), {
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
    if (format === "red") document.execCommand("foreColor", false, "#dc2626");
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
            <button className="secondary-action compact text-red-tool" type="button" onClick={() => applyFormat("red")} title="Chữ đỏ">A</button>
            <button className="secondary-action compact highlight-tool" type="button" onClick={() => applyFormat("highlight")} title="Highlight">A</button>
            <button className="primary-action compact" type="button" onClick={addWeek}><Plus size={15} /> Thêm tuần</button>
            <button className="primary-action compact" type="button" onClick={saveSchedule}>Save</button>
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
            <tr><th>Tuần</th><th>Ngày</th><th>Nội dung</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {admin ? (
                    <label className="schedule-week-input">
                      <span>Tuần</span>
                      <input
                        inputMode="numeric"
                        value={row.weekNumber}
                        onChange={(event) => updateRow(row.id, { weekNumber: event.target.value.replace(/\D/g, "") })}
                        aria-label="Số tuần"
                      />
                    </label>
                  ) : (
                    <span>{`Tuần ${row.weekNumber || ""}`}</span>
                  )}
                </td>
                <td>
                  {admin ? (
                    <input value={row.date || ""} onChange={(event) => updateRow(row.id, { date: event.target.value })} placeholder="Ngày" />
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
                      <button className="icon-danger schedule-delete-button" type="button" onClick={() => removeWeek(row.id)} title="Xóa tuần" aria-label="Xóa tuần">
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
    if (ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
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
      dangerouslySetInnerHTML={{ __html: sanitizeScheduleHtml(value || "") }}
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
      const color = child.style.color;
      const backgroundColor = child.style.backgroundColor;
      [...child.attributes].forEach((attribute) => child.removeAttribute(attribute.name));
      if (child.tagName === "SPAN" || child.tagName === "MARK") {
        if (color) child.style.color = "#dc2626";
        if (backgroundColor || child.tagName === "MARK") child.style.backgroundColor = "#fef08a";
      }
      cleanNode(child);
    });
  }

  cleanNode(container);
  return container.innerHTML;
}

function GroupTopicCard({ admin, canEdit, course, updateCourse }) {
  const groupCards = useMemo(() => buildGroupTopicCards(course), [course.members, course.groupTopics]);
  const topicDraftSignature = groupCards.map((group) => `${group.key}:${group.topic?.topic || ""}:${group.topic?.reportOrder || ""}:${group.topic?.intergroup || ""}`).join("|");
  const [placeholderDraft, setPlaceholderDraft] = useState({ group: "", reportOrder: "", intergroup: "", topic: "" });
  const [draftTopics, setDraftTopics] = useState({});
  const [draftOrders, setDraftOrders] = useState({});
  const [draftIntergroups, setDraftIntergroups] = useState({});
  const sortedGroupCards = useMemo(() => [...groupCards].sort((first, second) => compareGroupTopicCards(first, second, draftOrders)), [groupCards, draftOrders]);
  const nextGroupNumber = nextNumericText(groupCards.map((group) => group.rawGroup));

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
    updateCourse((current) => ({ ...current, groupTopics: nextTopics }), { toast: true, writeMembers: admin, classFields: admin ? null : ["groupTopics"] });
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
    }), { toast: true });
    setPlaceholderDraft({ group: "", reportOrder: "", intergroup: "", topic: "" });
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
      <PanelTitle title="Topic Nhóm" action={canEdit && <button className="primary-action compact" onClick={saveTopics}>Save</button>} />
      {admin && (
        <div className="inline-form placeholder-form group-placeholder-form">
          <input
            inputMode="numeric"
            value={placeholderDraft.group || nextGroupNumber}
            onChange={(event) => setPlaceholderDraft((current) => ({ ...current, group: cleanNumberText(event.target.value) }))}
            placeholder="Nhóm"
          />
          <input
            value={placeholderDraft.topic}
            onChange={(event) => setPlaceholderDraft((current) => ({ ...current, topic: event.target.value }))}
            placeholder="Topic"
          />
          <button onClick={createGroupPlaceholder}><Plus size={15} /> Tạo placeholder</button>
        </div>
      )}
      {groupCards.length === 0 ? (
        <div className="empty-state compact-empty">Chưa có nhóm. Có thể tạo placeholder trước hoặc nhập số nhóm trong Card Thành viên.</div>
      ) : (
        <div className="group-topic-list">
          {sortedGroupCards.map((group) => (
            <section className="group-topic-card" key={group.key}>
              <div className="group-topic-header">
                <div className="group-topic-bar">
                  <span className="group-topic-badge">{group.label}</span>
                  <label className="group-topic-compact-field">
                    <span>Thứ tự báo cáo:</span>
                    {canEdit ? (
                      <input
                        inputMode="numeric"
                        value={draftOrders[group.key] || ""}
                        onChange={(event) => setDraftOrders((current) => ({ ...current, [group.key]: event.target.value.replace(/\D/g, "") }))}
                      />
                    ) : (
                      <strong>{group.topic?.reportOrder || ""}</strong>
                    )}
                  </label>
                  <label className="group-topic-compact-field">
                    <span>Liên nhóm:</span>
                    {canEdit ? (
                      <input
                        inputMode="numeric"
                        value={draftIntergroups[group.key] || ""}
                        onChange={(event) => setDraftIntergroups((current) => ({ ...current, [group.key]: event.target.value.replace(/\D/g, "") }))}
                      />
                    ) : (
                      <strong>{group.topic?.intergroup || ""}</strong>
                    )}
                  </label>
                  {canEdit && group.placeholder && group.members.length === 0 && (
                    <button className="placeholder-delete-button" type="button" onClick={() => deleteGroupPlaceholder(group)} aria-label={`Xóa ${group.label}`}>
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="group-topic-topic-row">
                  <span>Topic:</span>
                  {canEdit ? (
                    <textarea
                      value={draftTopics[group.key] || ""}
                      onChange={(event) => setDraftTopics((current) => ({ ...current, [group.key]: event.target.value }))}
                      placeholder="Nhập tên Topic"
                    />
                  ) : (
                    <p>{group.topic?.topic || "Chưa có topic."}</p>
                  )}
                </div>
              </div>
              <div className="group-topic-table-wrap">
                <TopicMembersTable members={group.members} course={course} />
              </div>
            </section>
          ))}
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

function TopicMembersTable({ members, course }) {
  return (
    <table className="data-table topic-members-table">
      <thead><tr><th className="stt-col">STT</th><th className="avatar-col">Ảnh</th><th>Họ tên</th><th>Email</th><th>Mã số</th></tr></thead>
      <tbody>
        {members.length === 0 ? (
          <tr><td colSpan="5">Chưa có thành viên trong nhóm này.</td></tr>
        ) : members.map((member) => (
          <tr key={member.email}>
            <td>{member.order}</td>
            <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
            <td>{member.name}</td>
            <td>{member.email}</td>
            <td>{member.studentId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


function IntergroupTopicCard({ admin, canEdit, course, updateCourse }) {
  const groupOptions = useMemo(() => buildGroupTopicCards(course), [course.members, course.groupTopics]);
  const linkCards = useMemo(() => buildIntergroupTopicCards(course, groupOptions), [course.intergroupTopics, groupOptions]);
  const linkDraftSignature = linkCards.map((link) => `${link.key}:${link.topic?.topic || ""}:${link.groupKeys.join(",")}`).join("|");
  const [placeholderDraft, setPlaceholderDraft] = useState({ intergroup: "", groups: "", topic: "" });
  const [draftTopics, setDraftTopics] = useState({});
  const nextIntergroupNumber = nextNumericText(linkCards.map((link) => link.rawIntergroup));

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
      .filter((item) => item.groupKeys.length >= 2);
    updateCourse((current) => ({ ...current, intergroupTopics: nextTopics }), { toast: true, writeMembers: admin, classFields: admin ? null : ["intergroupTopics"] });
  }

  function createIntergroupPlaceholder() {
    const rawIntergroup = cleanNumberText(placeholderDraft.intergroup || nextIntergroupNumber);
    const groupKeys = parseGroupKeys(placeholderDraft.groups);
    if (!rawIntergroup || groupKeys.length < 2) return;

    updateCourse((current) => {
      const nextGroupTopics = groupKeys.reduce((topics, rawGroup) => (
        upsertGroupTopicPlaceholder(topics, rawGroup, { intergroup: rawIntergroup })
      ), current.groupTopics || []);
      const nextIntergroupTopic = {
        id: intergroupTopicId(rawIntergroup),
        intergroup: rawIntergroup,
        name: `Liên nhóm ${rawIntergroup}`,
        groupKeys,
        groupNames: groupKeys.map(groupTopicLabel),
        topic: placeholderDraft.topic || "",
        memberEmails: [],
        placeholder: true
      };
      const existingTopics = current.intergroupTopics || [];
      const exists = existingTopics.some((topic) => String(topic.intergroup ?? "").trim() === rawIntergroup || topic.id === nextIntergroupTopic.id);
      return {
        ...current,
        groupTopics: nextGroupTopics,
        intergroupTopics: exists
          ? existingTopics.map((topic) => (
            String(topic.intergroup ?? "").trim() === rawIntergroup || topic.id === nextIntergroupTopic.id
              ? { ...topic, ...nextIntergroupTopic, topic: placeholderDraft.topic || topic.topic || "" }
              : topic
          ))
          : [...existingTopics, nextIntergroupTopic]
      };
    }, {
      toast: true,
      writeMembers: admin,
      classFields: admin ? null : ["groupTopics", "intergroupTopics"]
    });
    setPlaceholderDraft({ intergroup: "", groups: "", topic: "" });
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
      <PanelTitle title="Topic Liên nhóm" action={canEdit && <button className="primary-action compact" onClick={saveIntergroupTopics}>Save</button>} />
      {admin && (
        <div className="inline-form placeholder-form intergroup-placeholder-form">
          <input
            inputMode="numeric"
            value={placeholderDraft.intergroup || nextIntergroupNumber}
            onChange={(event) => setPlaceholderDraft((current) => ({ ...current, intergroup: cleanNumberText(event.target.value) }))}
            placeholder="Liên nhóm"
          />
          <input
            value={placeholderDraft.groups}
            onChange={(event) => setPlaceholderDraft((current) => ({ ...current, groups: event.target.value }))}
            placeholder="Các nhóm, ví dụ 1,2"
          />
          <input
            value={placeholderDraft.topic}
            onChange={(event) => setPlaceholderDraft((current) => ({ ...current, topic: event.target.value }))}
            placeholder="Topic liên nhóm"
          />
          <button onClick={createIntergroupPlaceholder}><Plus size={15} /> Tạo placeholder</button>
        </div>
      )}
      {linkCards.length === 0 ? (
        <div className="empty-state compact-empty">Chưa có liên nhóm. Có thể tạo placeholder trước hoặc nhập cùng một số ở ô Liên nhóm trong Card Topic Nhóm cho ít nhất 2 nhóm rồi bấm Save.</div>
      ) : (
        <div className="intergroup-list">
          {linkCards.map((link) => (
            <section className="group-topic-card intergroup-topic-card" key={link.key}>
              <div className="group-topic-header">
                <div className="group-topic-bar intergroup-topic-bar">
                  <span className="group-topic-badge">{link.label}</span>
                  <label className="group-topic-compact-field intergroup-groups-field">
                    <strong>{`(${link.groups.map((group) => group.label).join(", ")})`}</strong>
                  </label>
                  {canEdit && link.groups.every((group) => group.members.length === 0) && (
                    <button className="placeholder-delete-button" type="button" onClick={() => deleteIntergroupPlaceholder(link)} aria-label={`Xóa ${link.label}`}>
                      <X size={15} />
                    </button>
                  )}
                </div>
                <div className="group-topic-topic-row">
                  <span>Topic:</span>
                  {canEdit ? (
                    <textarea
                      value={draftTopics[link.key] || ""}
                      onChange={(event) => setDraftTopics((current) => ({ ...current, [link.key]: event.target.value }))}
                      placeholder="Nhập tên Topic liên nhóm"
                    />
                  ) : (
                    <p>{link.topic?.topic || "Chưa có topic."}</p>
                  )}
                </div>
              </div>
              <div className="intergroup-member-list intergroup-topic-members">
                {link.groups.map((group) => (
                  <section className="intergroup-member-section" key={group.key}>
                    <h5>{group.label}</h5>
                    <TopicMembersTable members={group.members} course={course} />
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function buildIntergroupTopicCards(course, groupOptions) {
  const savedTopics = course.intergroupTopics || [];
  const groupMap = new Map(groupOptions.map((group) => [group.key, group]));

  savedTopics.forEach((topic) => {
    const rawIntergroup = String(topic.intergroup ?? "").trim();
    const groupKeys = parseGroupKeys(topic.groupKeys || topic.groups || []);
    if (!rawIntergroup || groupKeys.length < 2) return;
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

  const groupsByIntergroup = new Map();

  [...groupMap.values()].forEach((group) => {
    const rawIntergroup = String(group.topic?.intergroup || "").trim();
    if (!rawIntergroup) return;
    const key = `intergroup-${rawIntergroup}`;
    if (!groupsByIntergroup.has(key)) {
      groupsByIntergroup.set(key, {
        key,
        rawIntergroup,
        label: `Liên nhóm ${rawIntergroup}`,
        groups: []
      });
    }
    groupsByIntergroup.get(key).groups.push(group);
  });

  return [...groupsByIntergroup.values()]
    .filter((link) => link.groups.length >= 2)
    .sort((first, second) => compareNumericText(first.rawIntergroup, second.rawIntergroup)
      || first.label.localeCompare(second.label, "vi", { numeric: true, sensitivity: "base" }))
    .map((link) => {
      const sortedGroups = [...link.groups].sort(compareGroupTopicCards);
      const groupKeys = sortedGroups.map((group) => group.key);
      return {
        ...link,
        groups: sortedGroups,
        groupKeys,
        topic: findSavedIntergroupTopic(savedTopics, link.rawIntergroup, groupKeys)
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


function MaterialsCard({ admin, course, updateCourse }) {
  const materials = course.materials || [];
  return (
    <>
      <PanelTitle title="Tài liệu" />
      <div className="list-stack">
        {materials.length === 0 && (
          <div className="empty-state compact-empty">Chưa có tài liệu. Giảng viên tick Tài liệu khi đăng tin trong Card Thông báo để tạo thẻ tại đây.</div>
        )}
        {materials.map((item) => (
          <article className="material-card" key={item.id}>
            <div className="card-row-head">
              <strong>{item.title}</strong>
              {admin && <button className="icon-danger" onClick={() => updateCourse((current) => ({ ...current, materials: (current.materials || []).filter((material) => material.id !== item.id) }))}><Trash2 size={15} /></button>}
            </div>
            <div className="file-list">
              {materialFiles(item).length === 0 && <span>Chưa có file đính kèm.</span>}
              {materialFiles(item).map((file, index) => {
                const fileUrl = materialFileUrl(file);
                return (
                  <button key={`${file.fileName}-${index}`} onClick={() => fileUrl && window.open(fileUrl, "_blank", "noopener,noreferrer")}><Download size={15} /> {file.fileName || "file"}</button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}


function AssignmentsCard({ admin, user, course, updateCourse }) {
  const [draft, setDraft] = useState({ title: "", content: "" });
  const assignments = normalizeAssignmentRatios(course.assignments || []);
  return (
    <>
      <PanelTitle title="Bài tập" />
      {admin && (
        <div className="inline-form two">
          <input placeholder="Tiêu đề bài tập" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <textarea placeholder="Nội dung giao bài" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
          <button onClick={() => {
            if (!draft.title) return;
            updateCourse((current) => {
              const existingAssignments = normalizeAssignmentRatios(current.assignments || []);
              const nextAssignments = normalizeAssignmentRatios([...existingAssignments, { id: crypto.randomUUID(), ...draft, ratio: "0", submissions: [] }]);
              return { ...current, assignments: nextAssignments };
            });
            setDraft({ title: "", content: "" });
          }}><FilePlus2 size={15} /> Tạo thẻ</button>
        </div>
      )}
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
          />
        ))}
      </div>
    </>
  );
}


function AssignmentItem({ admin, course, assignment, assignmentIndex, assignmentCount, user, updateCourse }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const lastAssignment = assignmentIndex === assignmentCount - 1;
  const userSubmissions = assignment.submissions?.filter((item) => item.email === user.email) || [];
  const visibleSubmissions = admin ? (assignment.submissions || []) : userSubmissions;

  async function submitAssignment() {
    if (submitting || (!fileName && !file)) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const uploaded = file
        ? await uploadClassFile(course, `submissions/${assignment.id}/${user.email}`, file, { readerEmails: adminWriterEmails(), writerEmails: adminWriterEmails() })
        : { fileName, url: "" };
      const submission = { email: user.email, submittedAt: new Date().toLocaleString("vi-VN"), ...uploaded };
      const savedSubmission = await submitAssignmentToCloud(course.id, assignment.id, submission);
      updateCourse((current) => ({
        ...current,
        assignments: current.assignments.map((item) => item.id === assignment.id
          ? { ...item, submissions: [...(item.submissions || []), savedSubmission] }
          : item)
      }), { sync: false });
      setFileName("");
      setFile(null);
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      setSubmitError("Không thể lưu bài nộp. Vui lòng thử lại hoặc báo admin kiểm tra quyền Firestore.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="expand-card">
      <div className="assignment-head">
        <button onClick={() => setOpen(!open)}>
          <strong>{assignmentTitleWithRatio(assignment)}</strong>
          {userSubmissions.length > 0 && <small>Đã nộp {userSubmissions.length} lần</small>}
        </button>
        {admin && <button className="icon-danger" onClick={() => updateCourse((current) => ({ ...current, assignments: normalizeAssignmentRatios((current.assignments || []).filter((item) => item.id !== assignment.id)) }))}><Trash2 size={15} /></button>}
      </div>
      {open && (
        <div>
          <p>{assignment.content}</p>
          <div className="assignment-ratio-row">
            <span>Tỉ lệ:</span>
            {admin && !lastAssignment ? (
              <AssignmentRatioInput value={assignment.ratio || ""} onCommit={(value) => updateAssignmentRatio(updateCourse, assignment.id, value)} />
            ) : (
              <input className="ratio-input" value={assignment.ratio || "0"} disabled readOnly />
            )}
            <strong>%</strong>
            {admin && lastAssignment && <small>Tự động tính phần còn lại</small>}
          </div>
          {!admin && (
            <>
              <div className={`upload-row ${submitting ? "is-uploading" : ""}`}>
                <input disabled={submitting} value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Tên file bài tập" />
                <input disabled={submitting} type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                <button onClick={submitAssignment} disabled={submitting || (!fileName && !file)}>
                  {submitting ? <span className="button-spinner" /> : <Upload size={15} />}
                  {submitting ? "Đang upload" : "Submit"}
                </button>
              </div>
              {submitting && <UploadStatus label={file ? "Đang upload file và nộp bài..." : "Đang lưu bài nộp..."} />}
              {(submitted || userSubmissions.length > 0) && <p className="success-text">Bạn đã nộp bài thành công.</p>}
              {submitError && <p className="error-text">{submitError}</p>}
            </>
          )}
          <button className="join-action compact" onClick={() => setShowResults(!showResults)}>
            {admin ? "Xem kết quả nộp bài" : "Xem bài đã nộp"}
          </button>
          {showResults && (
            <table className="data-table compact-table">
              <thead><tr><th>Email</th><th>File</th><th>Thời gian</th></tr></thead>
              <tbody>
                {visibleSubmissions.length === 0 ? (
                  <tr><td colSpan="3">Chưa có bài nộp.</td></tr>
                ) : visibleSubmissions.map((submission, index) => {
                  const previewUrl = filePreviewUrl(submission);
                  const downloadUrl = fileDownloadUrl(submission);
                  return (
                    <tr key={`${submission.email}-${submission.id || index}`}>
                      <td>{submission.email}</td>
                      <td>
                        <div className="submission-file-actions">
                          <button className="link-button" onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")}>{submission.fileName || "file"}</button>
                          {downloadUrl && (
                            <button className="download-icon-button" type="button" title="Tải file" aria-label={`Tải ${submission.fileName || "file"}`} onClick={() => window.open(downloadUrl, "_blank", "noopener,noreferrer")}>
                              <Download size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{submission.submittedAt || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </article>
  );
}

function GradesCard({ admin, user, course, updateCourse }) {
  const [assignmentId, setAssignmentId] = useState(course.assignments[0]?.id || "");
  const [type, setType] = useState("group");
  const canCreateGradebook = Boolean(assignmentId) && gradebookSourceCount(course, type) > 0;
  const visibleGradebooks = admin ? (course.gradebooks || []) : (course.gradebooks || []).filter(isGradebookPublished);
  return (
    <>
      <PanelTitle title="Bảng điểm" />
      {admin && (
        <div className="inline-form two grade-create-form">
          <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
            {course.assignments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="personal">Cá nhân</option>
            <option value="group">Nhóm</option>
            <option value="intergroup">Liên nhóm</option>
          </select>
          <button onClick={() => createGradebook(course, updateCourse, assignmentId, type)} disabled={!canCreateGradebook}><Plus size={15} /> Tạo bảng điểm</button>
        </div>
      )}
      <div className="list-stack">
        <SummaryGradebookItem admin={admin} user={user} course={course} />
        {!admin && visibleGradebooks.length === 0 && (
          <div className="empty-state compact-empty">Chưa có bảng điểm được publish.</div>
        )}
        {visibleGradebooks.map((book) => (
          <GradebookItem key={book.id} admin={admin} user={user} book={book} course={course} updateCourse={updateCourse} />
        ))}
      </div>
    </>
  );
}

function AssignmentRatioInput({ value, onCommit }) {
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  function commit() {
    const nextValue = cleanRatioInput(draft);
    setDraft(nextValue);
    onCommit(nextValue);
  }

  return (
    <input
      className="ratio-input"
      inputMode="decimal"
      value={draft}
      onChange={(event) => setDraft(cleanRatioInput(event.target.value))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function assignmentTitleWithRatio(assignment) {
  return `${assignment?.title || "Bài tập"} (Tỉ lệ ${assignment?.ratio || "0"}%)`;
}

function updateAssignmentRatio(updateCourse, assignmentId, ratio) {
  updateCourse((current) => ({
    ...current,
    assignments: normalizeAssignmentRatios((current.assignments || []).map((item) => (
      item.id === assignmentId ? { ...item, ratio: cleanRatioInput(ratio) } : item
    )))
  }));
}

function normalizeAssignmentRatios(assignments) {
  if (!assignments.length) return [];
  const normalized = assignments.map((assignment) => ({ ...assignment }));
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
  intergroup: "Liên nhóm"
};

function gradebookTitleWithRatio(book, course, bookType) {
  const assignment = (course.assignments || []).find((item) => item.id === book.assignmentId);
  if (!assignment) return book.title;
  return `Điểm ${assignmentTitleWithRatio(assignment)} (${gradebookTypeLabels[bookType] || gradebookTypeLabels.group})`;
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

function SummaryGradebookItem({ admin, user, course }) {
  const [open, setOpen] = useState(false);
  const allAssignments = normalizeAssignmentRatios(course.assignments || []);
  const assignments = admin ? allAssignments : allAssignments.filter((assignment) => findSummaryGradebook(course, assignment.id, admin));
  const rows = buildSummaryGradeRows(course, assignments, admin, user);
  const colSpan = assignments.length + 4;

  return (
    <article className="expand-card summary-gradebook">
      <div className="assignment-head">
        <button onClick={() => setOpen(!open)}>
          <strong>BẢNG ĐIỂM TỔNG KẾT</strong>
          <small>{assignments.length ? `${assignments.length} bài tập` : "Chưa có bài tập"}</small>
        </button>
      </div>
      {open && (
        assignments.length === 0 ? (
          <div className="empty-state compact-empty">Chưa có bài tập để tính điểm tổng kết.</div>
        ) : (
          <div className="summary-grade-scroll">
            <table className="data-table summary-grade-table">
              <thead>
                <tr>
                  <th className="stt-col">STT</th>
                  <th>Họ tên</th>
                  <th>Mã số</th>
                  {assignments.map((assignment) => {
                    const book = findSummaryGradebook(course, assignment.id, admin);
                    const bookType = gradebookTypeLabels[book?.type] ? book.type : "";
                    return (
                  <th key={assignment.id}>
                    <span>{assignment.title}</span>
                    <small>{`(Tỉ lệ ${assignment.ratio || "0"}%)`}{bookType ? ` · ${gradebookTypeLabels[bookType]}` : ""}</small>
                  </th>
                );
              })}
                  <th>Final Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={colSpan}>Chưa có học viên phù hợp.</td></tr>
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

function GradebookItem({ admin, user, book, course, updateCourse }) {
  const [open, setOpen] = useState(false);
  const [draftRows, setDraftRows] = useState(book.rows || []);
  const [dirty, setDirty] = useState(false);
  const bookType = gradebookTypeLabels[book.type] ? book.type : "group";
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
    const nextRows = buildGradebookRowsForSave(course, bookType, draftRows);
    updateCourse((current) => ({
      ...current,
      gradebooks: (current.gradebooks || []).map((item) => item.id === book.id ? { ...item, type: bookType, rows: nextRows } : item)
    }), { toast: true });
    setDirty(false);
  }

  function publishScores() {
    const nextRows = buildGradebookRowsForSave(course, bookType, draftRows);
    updateCourse((current) => ({
      ...current,
      gradebooks: (current.gradebooks || []).map((item) => (
        item.id === book.id ? { ...item, type: bookType, rows: nextRows, published: true } : item
      ))
    }), { toast: "Đã publish bảng điểm." });
    setDirty(false);
  }

  function unpublishScores() {
    updateCourse((current) => ({
      ...current,
      gradebooks: (current.gradebooks || []).map((item) => (
        item.id === book.id ? { ...item, published: false } : item
      ))
    }), { toast: "Đã ẩn bảng điểm với học viên." });
  }

  return (
    <article className="expand-card" data-enter-scope="gradebook">
      <div className="assignment-head">
        <button onClick={() => setOpen(!open)}>
          <strong>{gradebookTitleWithRatio(book, course, bookType)}</strong>
          {admin && <small>{published ? "Đã publish" : "Nháp"}</small>}
        </button>
        {admin && open && <button className="primary-action compact save-score-button" onClick={saveScores} disabled={!dirty}>Save</button>}
        {admin && (
          <button
            className={`join-action compact publish-score-button ${published ? "is-published" : ""}`}
            onClick={published ? unpublishScores : publishScores}
          >
            {published ? "Unpublish" : "Publish"}
          </button>
        )}
        {admin && <button className="icon-danger" onClick={() => updateCourse((current) => ({ ...current, gradebooks: (current.gradebooks || []).filter((item) => item.id !== book.id) }))}><Trash2 size={15} /></button>}
      </div>
      {open && (
        bookType === "personal" ? (
          <PersonalGradeTable admin={admin} user={user} course={course} draftRows={draftRows} onScoreChange={changeDraftScore} />
        ) : bookType === "intergroup" ? (
          <IntergroupGradebookCards admin={admin} user={user} course={course} draftRows={draftRows} onScoreChange={changeDraftScore} onBonusChange={changeDraftBonus} />
        ) : (
          <GroupGradebookCards admin={admin} user={user} course={course} draftRows={draftRows} onScoreChange={changeDraftScore} onBonusChange={changeDraftBonus} />
        )
      )}
    </article>
  );
}

function PersonalGradeTable({ admin, user, course, draftRows, onScoreChange }) {
  const rows = buildPersonalGradeRows(course, draftRows).filter((row) => admin || row.member.email === user.email);
  if (rows.length === 0) return <div className="empty-state compact-empty">Chưa có học viên phù hợp.</div>;

  return (
    <table className="data-table grade-personal-table">
      <thead><tr><th className="stt-col">STT</th><th className="avatar-col">Ảnh</th><th>Email</th><th>Mã số</th><th>Điểm</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.member.order}</td>
            <td><ProfileAvatar user={{ ...row.member, photoURL: row.member.photoURL || course.profiles?.[row.member.email]?.photoURL || "" }} label={row.member.name || row.member.email} small /></td>
            <td>{row.member.email}</td>
            <td>{row.member.studentId}</td>
            <td>
              {admin ? (
                <input className="score-input" data-enter-group="personal-grade-score" inputMode="decimal" value={row.score} onKeyDown={(event) => focusNextInputOnEnter(event, "personal-grade-score")} onChange={(event) => onScoreChange(row.key, event.target.value)} />
              ) : (
                row.score || "Chưa có điểm"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupGradebookCards({ admin, user, course, draftRows, onScoreChange, onBonusChange }) {
  const cards = buildGroupGradeCards(course, draftRows)
    .map((card) => ({ ...card, visibleMembers: visibleGradeMembers(card.members, admin, user) }))
    .filter((card) => card.visibleMembers.length > 0);
  if (cards.length === 0) return <div className="empty-state compact-empty">Chưa có nhóm phù hợp.</div>;

  return (
    <div className="grade-topic-list">
      {cards.map((card) => (
        <section className="group-topic-card grade-topic-card" key={card.gradeKey}>
          <div className="group-topic-header">
            <div className="group-topic-bar grade-topic-bar">
              <span className="group-topic-badge">{card.label}</span>
              <label className="group-topic-compact-field">
                <span>Thứ tự báo cáo:</span>
                <strong className="score-box read-only">{card.reportOrder || ""}</strong>
              </label>
              <label className="group-topic-compact-field">
                <span>Điểm:</span>
                {admin ? (
                  <input className="score-input" data-enter-group="group-grade-score" inputMode="decimal" value={card.score} onKeyDown={(event) => focusNextInputOnEnter(event, "group-grade-score")} onChange={(event) => onScoreChange(card.gradeKey, event.target.value)} />
                ) : (
                  <strong className="score-box">{card.score || ""}</strong>
                )}
              </label>
            </div>
            <div className="group-topic-topic-row">
              <span>Topic:</span>
              <p>{card.topicTitle || "Chưa có topic."}</p>
            </div>
          </div>
          <div className="group-topic-table-wrap">
            <GradeMembersTable admin={admin} members={card.visibleMembers} course={course} score={card.score} bonuses={card.bonuses} rowKey={card.gradeKey} onBonusChange={onBonusChange} />
          </div>
        </section>
      ))}
    </div>
  );
}

function IntergroupGradebookCards({ admin, user, course, draftRows, onScoreChange, onBonusChange }) {
  const cards = buildIntergroupGradeCards(course, draftRows)
    .map((card) => ({
      ...card,
      visibleGroups: card.groups
        .map((group) => ({ ...group, visibleMembers: visibleGradeMembers(group.members, admin, user) }))
        .filter((group) => group.visibleMembers.length > 0)
    }))
    .filter((card) => card.visibleGroups.length > 0);
  if (cards.length === 0) return <div className="empty-state compact-empty">Chưa có liên nhóm phù hợp.</div>;

  return (
    <div className="grade-topic-list">
      {cards.map((card) => (
        <section className="group-topic-card grade-topic-card" key={card.gradeKey}>
          <div className="group-topic-header">
            <div className="group-topic-bar intergroup-grade-bar">
              <span className="group-topic-badge">{card.label}</span>
              <label className="group-topic-compact-field">
                <span>Điểm:</span>
                {admin ? (
                  <input className="score-input" data-enter-group="intergroup-grade-score" inputMode="decimal" value={card.score} onKeyDown={(event) => focusNextInputOnEnter(event, "intergroup-grade-score")} onChange={(event) => onScoreChange(card.gradeKey, event.target.value)} />
                ) : (
                  <strong className="score-box">{card.score || ""}</strong>
                )}
              </label>
            </div>
            <div className="group-topic-topic-row">
              <span>Topic:</span>
              <p>{card.topicTitle || "Chưa có topic."}</p>
            </div>
          </div>
          <div className="intergroup-member-list grade-intergroup-list">
            {card.visibleGroups.map((group) => (
              <section className="intergroup-member-section" key={group.key}>
                <h5>{group.label}</h5>
                <GradeMembersTable admin={admin} members={group.visibleMembers} course={course} score={card.score} bonuses={card.bonuses} rowKey={card.gradeKey} onBonusChange={onBonusChange} />
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GradeMembersTable({ admin, members, course, score, bonuses, rowKey, onBonusChange }) {
  return (
    <table className="data-table topic-members-table grade-members-table">
      <thead><tr><th className="stt-col">STT</th><th className="avatar-col">Ảnh</th><th>Họ tên</th><th>Email</th><th>Mã số</th><th>Bonus</th><th>Final</th></tr></thead>
      <tbody>
        {members.map((member) => {
          const bonus = bonuses?.[member.email] || "";
          const finalScore = calculateFinalScore(score, bonus);
          return (
            <tr key={member.email}>
              <td>{member.order}</td>
              <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>{member.studentId}</td>
              <td>
                {admin ? (
                  <input className="bonus-input" data-enter-group="grade-bonus" inputMode="decimal" value={bonus} onKeyDown={(event) => focusNextInputOnEnter(event, "grade-bonus")} onChange={(event) => onBonusChange(rowKey, member.email, event.target.value)} />
                ) : (
                  bonus || ""
                )}
              </td>
              <td><span className="score-box final-score">{finalScore || (admin ? "" : "Chưa có điểm")}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function gradebookSourceCount(course, type) {
  if (type === "personal") return buildPersonalGradeRows(course, []).length;
  if (type === "intergroup") return buildIntergroupGradeCards(course, []).length;
  return buildGroupGradeCards(course, []).length;
}

function buildGradebookRowsForSave(course, type, draftRows) {
  if (type === "personal") {
    return buildPersonalGradeRows(course, draftRows).map((row) => ({
      key: row.key,
      email: row.member.email,
      label: `${row.member.order}. ${row.member.name}`,
      score: row.score || ""
    }));
  }

  if (type === "intergroup") {
    return buildIntergroupGradeCards(course, draftRows).map((card) => ({
      key: card.gradeKey,
      intergroup: card.rawIntergroup,
      label: card.label,
      topic: card.topicTitle,
      groupKeys: card.groupKeys,
      memberEmails: uniqueValues(card.groups.flatMap((group) => group.members.map((member) => member.email))),
      score: card.score || "",
      bonuses: card.bonuses || {}
    }));
  }

  return buildGroupGradeCards(course, draftRows).map((card) => ({
    key: card.gradeKey,
    group: card.rawGroup,
    label: card.label,
    topic: card.topicTitle,
    reportOrder: card.reportOrder,
    memberEmails: card.members.map((member) => member.email),
    score: card.score || "",
    bonuses: card.bonuses || {}
  }));
}

function buildPersonalGradeRows(course, draftRows) {
  return course.members
    .filter((member) => member.status === "accepted")
    .sort(compareMemberOrder)
    .map((member) => {
      const row = findGradebookRow(draftRows, member.email);
      return {
        key: member.email,
        member,
        score: row?.score || ""
      };
    });
}

function buildGroupGradeCards(course, draftRows) {
  return [...buildGroupTopicCards(course)].sort(compareGroupTopicCards).map((group) => {
    const gradeKey = group.topic?.id || groupTopicId(group.rawGroup);
    const row = findGradebookRow(draftRows, gradeKey);
    return {
      gradeKey,
      rawGroup: group.rawGroup,
      label: group.label,
      reportOrder: group.topic?.reportOrder || group.rawGroup || "",
      topicTitle: group.topic?.topic || "",
      members: group.members,
      score: row?.score || "",
      bonuses: row?.bonuses || {}
    };
  });
}

function buildIntergroupGradeCards(course, draftRows) {
  return buildIntergroupTopicCards(course, buildGroupTopicCards(course)).map((link) => {
    const gradeKey = link.topic?.id || intergroupTopicId(link.rawIntergroup);
    const row = findGradebookRow(draftRows, gradeKey);
    return {
      gradeKey,
      rawIntergroup: link.rawIntergroup,
      label: link.label,
      topicTitle: link.topic?.topic || "",
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

  const bookType = gradebookTypeLabels[book.type] ? book.type : "group";
  if (bookType === "personal") return personalSummaryScore(course, book, assignment.id, member);
  if (bookType === "intergroup") return intergroupSummaryScore(course, book, assignment.id, member);
  return groupSummaryScore(course, book, assignment.id, member);
}

function findSummaryGradebook(course, assignmentId, admin) {
  return [...(course.gradebooks || [])]
    .reverse()
    .find((book) => String(book.assignmentId || "") === String(assignmentId || "") && (admin || isGradebookPublished(book)));
}

function personalSummaryScore(course, book, assignmentId, member) {
  const row = buildPersonalGradeRows(course, book.rows || []).find((item) => item.member.email === member.email);
  return scoreSummaryValue(assignmentId, row?.score);
}

function groupSummaryScore(course, book, assignmentId, member) {
  const card = buildGroupGradeCards(course, book.rows || []).find((item) => item.members.some((student) => student.email === member.email));
  return combinedSummaryScore(assignmentId, card?.score, card?.bonuses?.[member.email]);
}

function intergroupSummaryScore(course, book, assignmentId, member) {
  const card = buildIntergroupGradeCards(course, book.rows || []).find((item) => (
    item.groups.some((group) => group.members.some((student) => student.email === member.email))
  ));
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
  const members = course.members.filter((member) => member.status === "accepted").sort(compareMemberOrder);
  const topicSignature = [
    members.map((member) => member.email).join(","),
    (course.personalTopics || []).map((item) => `${item.email}:${item.topic || ""}`).join("|")
  ].join("::");
  const [draftTopics, setDraftTopics] = useState({});

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
    updateCourse((current) => ({ ...current, personalTopics: nextTopics }), { toast: true, writeMembers: admin, classFields: admin ? null : ["personalTopics"] });
  }

  return (
    <>
      <PanelTitle title="Topic Cá nhân" action={canEdit && <button className="primary-action compact" onClick={savePersonalTopics}>Save</button>} />
      <table className="data-table personal-topic-table">
        <thead><tr><th className="stt-col">STT</th><th className="avatar-col">Ảnh</th><th>Họ tên</th><th>Email</th><th>Mã số</th><th>Topic</th></tr></thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.email}>
              <td>{member.order}</td>
              <td><ProfileAvatar user={{ ...member, photoURL: member.photoURL || course.profiles?.[member.email]?.photoURL || "" }} label={member.name || member.email} small /></td>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>{member.studentId}</td>
              <td>
                {canEdit ? (
                  <input value={draftTopics[member.email] || ""} onChange={(event) => setDraftTopics((current) => ({ ...current, [member.email]: event.target.value }))} />
                ) : (
                  draftTopics[member.email] || "Chưa có topic."
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function updatePersonalTopic(course, updateCourse, email, topic) {
  updateCourse((current) => {
    const exists = current.personalTopics.some((item) => item.email === email);
    return { ...current, personalTopics: exists ? current.personalTopics.map((item) => item.email === email ? { ...item, topic } : item) : [...current.personalTopics, { email, topic }] };
  });
}


function PeerReviewCard({ admin, user, course, updateCourse }) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("group");
  const options = peerReviewOptions(course, sourceType);

  function createReview() {
    if (!title || options.length === 0) return;
    updateCourse((current) => ({
      ...current,
      peerReviews: [
        ...current.peerReviews,
        {
          id: crypto.randomUUID(),
          title,
          sourceType,
          options: peerReviewOptions(current, sourceType),
          responses: []
        }
      ]
    }));
    setTitle("");
  }

  return (
    <>
      <PanelTitle
        title="Người học chấm điểm"
        action={admin && <button className="primary-action compact" onClick={createReview} disabled={!title || options.length === 0}><Plus size={15} /> Thêm thẻ</button>}
      />
      {admin && (
        <div className="inline-form peer-create-form">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tên thẻ chấm điểm mới" />
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="group">Nhóm</option>
            <option value="intergroup">Liên nhóm</option>
            <option value="personal">Cá nhân</option>
          </select>
        </div>
      )}
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


function PeerReviewItem({ admin, user, course, review, updateCourse }) {
  const [topic, setTopic] = useState(review.options[0] || "");
  const [score, setScore] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const visibleResponses = admin ? (review.responses || []) : (review.responses || []).filter((row) => row.email === user.email);

  async function submitReviewScore() {
    if (!score) return;
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
        score,
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
        {admin && <button className="icon-danger" onClick={() => updateCourse((current) => ({ ...current, peerReviews: current.peerReviews.filter((item) => item.id !== review.id) }))}><Trash2 size={15} /></button>}
      </div>
      <div className="review-form">
        <select value={topic} onChange={(event) => setTopic(event.target.value)}>
          {review.options.map((option) => <option key={option}>{option}</option>)}
        </select>
        <input value={score} onChange={(event) => setScore(event.target.value)} placeholder="Điểm" />
        <button onClick={submitReviewScore} disabled={!score || submitting}>{submitting ? "Đang lưu..." : "Submit"}</button>
      </div>
      {submitStatus && <p className="success-text">{submitStatus}</p>}
      {submitError && <p className="error-text">{submitError}</p>}
      <div className="review-results-head">
        <strong>{admin ? "Tất cả điểm đã chấm" : "Điểm bạn đã chấm"}</strong>
        {admin && <button className="export-button" onClick={() => exportReview({ ...review, responses: visibleResponses })}>Export Excel</button>}
      </div>
      <table className="data-table compact-table review-results-table">
        <thead><tr><th>Email</th><th>Họ và tên</th><th>Mã số</th><th>Topic</th><th>Điểm chấm</th><th>Thời gian</th></tr></thead>
        <tbody>
          {visibleResponses.length === 0 ? (
            <tr><td colSpan="6">{admin ? "Chưa có người học chấm điểm." : "Bạn chưa chấm điểm trong thẻ này."}</td></tr>
          ) : visibleResponses.map((row, index) => (
            <tr key={row.id || `${row.email}-${index}`}>
              <td>{row.email}</td>
              <td>{row.name}</td>
              <td>{row.studentId}</td>
              <td>{row.topic}</td>
              <td>{row.score}</td>
              <td>{row.submittedAt || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function exportReview(review) {
  const headers = ["Email", "Họ và tên", "Mã số", "Topic", "Điểm chấm", "Thời gian"];
  const rows = review.responses.map((row) => [row.email, row.name, row.studentId, row.topic, row.score, row.submittedAt || ""]);
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
      <button className="primary-action" onClick={() => onSave({ ...user, ...form })}>Save</button>
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
        if (course.members.some((member) => member.email === user.email)) return setError("Email này đã gửi yêu cầu hoặc đã tham gia lớp.");
        onJoin(course.id, { order: course.members.length + 1, name: form.name, email: user.email, photoURL: user.photoURL || "", studentId: form.studentId, status: "pending", code: form.code });
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
    announcementPostPermission: getAnnouncementPostPermission(course),
    ownerEmail,
    ownerName,
    lecturers,
    lecturerEmails: lecturers.map((lecturer) => normalizeEmail(lecturer.email))
  };
}

function NewClassModal({ existing, user, onClose, onSave }) {
  const [form, setForm] = useState(() => existing || { id: crypto.randomUUID(), name: "", description: "", code: "", pinned: false, announcementPostPermission: ANNOUNCEMENT_POST_PERMISSIONS.everyone, info: { title: "", size: 0, time: "", room: "", description: "", rules: "" }, scheduleRows: defaultScheduleRows(), members: [], announcements: [], groupTopics: [], intergroupTopics: [], personalTopics: [], materials: [], assignments: [], gradebooks: [], peerReviews: [], extraCards: [], hiddenCards: [], pinnedCards: [], cardOrder: [] });
  return (
    <Modal title={existing ? "Edit Class" : "Add New Class"} onClose={onClose}>
      <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, info: { ...form.info, title: event.target.value } })} placeholder="Tên class" />
      <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value, info: { ...form.info, description: event.target.value } })} placeholder="Mô tả" />
      <button className="primary-action" onClick={() => onSave(form)}>Save</button>
    </Modal>
  );
}

function ManageLecturersModal({ lecturers, onClose, onSave, onDelete }) {
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
                <button className="icon-danger" onClick={() => onDelete(email)}><Trash2 size={15} /></button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="panel-title"><h3>{title}</h3><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}

function EmptyState({ admin, onJoin, onNewClass }) {
  return (
    <section className="empty-state">
      <h2>Chưa có lớp học hiển thị</h2>
      <p>Người học cần nhập mã lớp và chờ admin accept trước khi xem nội dung.</p>
      <button className="primary-action" onClick={admin ? onNewClass : onJoin}>{admin ? "Add New Class" : "Tham gia lớp học"}</button>
    </section>
  );
}

function PendingPane({ course, isMobile, onMobileBackToClasses }) {
  return (
    <section className="pending-pane">
      {isMobile && (
        <button className="mobile-back-button pending-back-button" type="button" onClick={onMobileBackToClasses} aria-label="Quay lại danh sách lớp">
          <ChevronLeft size={22} />
        </button>
      )}
      <div>
        <h2>{course.name}</h2>
        <p>Yêu cầu tham gia lớp đã được gửi. Bạn sẽ xem được nội dung sau khi admin accept.</p>
        <span className="class-code">Trạng thái: Chờ accept</span>
      </div>
    </section>
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js?v=20260525-upload-cache"));
}

createRoot(document.getElementById("root")).render(<App />);
