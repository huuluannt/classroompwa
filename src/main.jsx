import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Check,
  ChevronLeft,
  Download,
  FilePlus2,
  GraduationCap,
  LogOut,
  Menu,
  MoreVertical,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  UserPlus,
  X
} from "lucide-react";
import { ADMIN_PROFILES, ADMINS, baseCards, extraCardLabels } from "./data";
import { hasFirebaseConfig, observeAuth, signInWithGoogle, signOutGoogle } from "./firebase";
import {
  deleteCourseFromCloud,
  deleteMemberFromCloud,
  joinClassByCode,
  loadLocalClasses,
  saveCourseToCloud,
  saveLocalClasses,
  subscribeClasses,
  uploadClassFile
} from "./classroomRepository";
import "./styles.css";

function isAdmin(user) {
  return ADMINS.includes(user?.email || "");
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

function classReaderEmails(course) {
  return [
    ...ADMINS,
    ...course.members.filter((member) => member.status === "accepted").map((member) => member.email)
  ];
}

function adminWriterEmails() {
  return ADMINS;
}

async function uploadManyFiles(course, folder, files, shareOptions = {}) {
  return Promise.all(Array.from(files || []).map((file) => uploadClassFile(course, folder, file, shareOptions)));
}

function materialFiles(item) {
  return item.files || [{ fileName: item.fileName, url: item.url }].filter((file) => file.fileName || file.url);
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

function App() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState(loadLocalClasses);
  const [loading, setLoading] = useState(hasFirebaseConfig);
  const [error, setError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id);
  const [selectedCard, setSelectedCard] = useState("members");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showNewClass, setShowNewClass] = useState(false);

  const admin = isAdmin(user);
  const visibleClasses = useMemo(() => {
    if (!user) return [];
    const matches = classes.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
    if (admin) return matches.sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return matches.filter((item) => item.members.some((member) => member.email === user.email));
  }, [admin, classes, query, user]);
  const selectedClass = visibleClasses.find((item) => item.id === selectedClassId) || visibleClasses[0];
  const membership = selectedClass?.members.find((member) => member.email === user.email);

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined;
    return observeAuth((nextUser) => {
      setUser(nextUser ? {
        displayName: nextUser.displayName || nextUser.email,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
        isDemo: false
      } : null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    setError("");
    return subscribeClasses(user, setClasses, (nextError) => {
      console.error(nextError);
      setError("Không thể tải dữ liệu lớp học. Vui lòng kiểm tra Firebase rules và kết nối mạng.");
    });
  }, [user]);

  function updateClasses(nextClasses) {
    setClasses(nextClasses);
    if (!hasFirebaseConfig) saveLocalClasses(nextClasses);
  }

  async function updateClass(classId, updater) {
    const nextClasses = classes.map((item) => (item.id === classId ? updater(item) : item));
    const nextCourse = nextClasses.find((item) => item.id === classId);
    updateClasses(nextClasses);
    if (hasFirebaseConfig && nextCourse) await saveCourseToCloud(nextCourse);
  }

  async function handleLogin(mode = "learner") {
    setLoginError("");
    try {
      const nextUser = mode === "admin"
        ? { displayName: "Huynh Huu Luan", email: "hhluan@hcmus.edu.vn", photoURL: "", isDemo: true }
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
    setAccountOpen(false);
  }

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={handleLogin} loginError={loginError} />;

  return (
    <main className="app-shell">
      <Sidebar
        admin={admin}
        classes={visibleClasses}
        selectedClassId={selectedClass?.id}
        query={query}
        setQuery={setQuery}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        selectClass={(id) => {
          setSelectedClassId(id);
          setSelectedCard("members");
        }}
        onJoin={() => setShowJoin(true)}
        onNewClass={() => setShowNewClass(true)}
        onClassAction={(action, classItem) => {
          if (action === "pin") updateClass(classItem.id, (course) => ({ ...course, pinned: !course.pinned }));
          if (action === "delete") {
            const next = classes.filter((course) => course.id !== classItem.id);
            updateClasses(next);
            deleteCourseFromCloud(classItem);
            setSelectedClassId(next[0]?.id);
          }
          if (action === "edit") setShowNewClass(classItem);
        }}
        accountOpen={accountOpen}
        setAccountOpen={setAccountOpen}
        user={user}
        onLogout={handleLogout}
      />
      {error && <div className="toast-error">{error}</div>}
      {selectedClass ? (
        membership?.status === "pending" && !admin ? (
          <PendingPane course={selectedClass} />
        ) : (
        <ClassPane
          admin={admin}
          user={user}
          course={selectedClass}
          selectedCard={selectedCard}
          setSelectedCard={setSelectedCard}
          updateCourse={(updater) => updateClass(selectedClass.id, updater)}
        />
        )
      ) : (
        <EmptyState admin={admin} onJoin={() => setShowJoin(true)} onNewClass={() => setShowNewClass(true)} />
      )}
      {showJoin && (
        <JoinClassModal
          user={user}
          classes={classes}
          cloudMode={hasFirebaseConfig}
          onClose={() => setShowJoin(false)}
          onJoin={(classId, learner) => {
            if (hasFirebaseConfig) {
              joinClassByCode(user, learner)
                .then((course) => {
                  setSelectedClassId(course.id);
                  setShowJoin(false);
                })
                .catch((nextError) => setError(nextError.message));
            } else {
              updateClass(classId, (course) => ({ ...course, members: [...course.members, learner] }));
              setSelectedClassId(classId);
              setShowJoin(false);
            }
          }}
        />
      )}
      {showNewClass && (
        <NewClassModal
          existing={typeof showNewClass === "object" ? showNewClass : null}
          onClose={() => setShowNewClass(false)}
          onSave={(course) => {
            const exists = classes.some((item) => item.id === course.id);
            const next = exists ? classes.map((item) => (item.id === course.id ? course : item)) : [course, ...classes];
            updateClasses(next);
            saveCourseToCloud(course).catch((nextError) => setError(nextError.message));
            setSelectedClassId(course.id);
            setShowNewClass(false);
          }}
        />
      )}
    </main>
  );
}

function LoadingScreen() {
  return (
    <section className="login-screen">
      <div className="login-card">
        <div className="brand-lockup">
          <span className="logo-mark"><BookOpen size={28} /></span>
          <div>
            <h1>ClassroomPWA</h1>
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
            <h1>ClassroomPWA</h1>
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
    admin,
    classes,
    selectedClassId,
    query,
    setQuery,
    sidebarOpen,
    setSidebarOpen,
    selectClass,
    onJoin,
    onNewClass,
    onClassAction,
    accountOpen,
    setAccountOpen,
    user,
    onLogout
  } = props;

  return (
    <aside className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
      <div className="sidebar-top">
        <button className="icon-button brand-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
          {sidebarOpen ? <ChevronLeft /> : <Menu />}
        </button>
        {sidebarOpen && (
          <div className="brand-text">
            <strong>Classroom</strong>
            <span>Private PWA</span>
          </div>
        )}
      </div>
      {sidebarOpen && (
        <>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm lớp học" />
          </label>
          {admin && (
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
            {classes.map((course) => (
              <ClassRow
                key={course.id}
                course={course}
                selected={course.id === selectedClassId}
                admin={admin}
                onSelect={() => selectClass(course.id)}
                onAction={onClassAction}
              />
            ))}
          </nav>
          <div className="account-box">
            <button className="account-trigger" onClick={() => setAccountOpen(!accountOpen)}>
              <ProfileAvatar user={user} label={user.displayName || user.email} />
              <span>
                <strong>{user.displayName || user.email}</strong>
                <small>{user.email}</small>
              </span>
            </button>
            {accountOpen && (
              <div className="account-menu">
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

function ClassRow({ course, selected, admin, onSelect, onAction }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`class-row ${selected ? "selected" : ""}`}>
      <button onClick={onSelect}>
        <span className="class-glyph"><GraduationCap size={16} /></span>
        <span>
          <strong>{course.name}</strong>
          <small>{course.code}</small>
        </span>
      </button>
      {admin && (
        <div className="kebab-wrap">
          <button className="icon-button" onClick={() => setOpen(!open)} aria-label="Class actions">
            <MoreVertical size={16} />
          </button>
          {open && (
            <div className="mini-menu">
              <button onClick={() => onAction("pin", course)}><Pin size={14} /> Pin</button>
              <button onClick={() => onAction("edit", course)}>Edit</button>
              <button onClick={() => onAction("delete", course)}><Trash2 size={14} /> Delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClassPane({ admin, user, course, selectedCard, setSelectedCard, updateCourse }) {
  const [cardMenuOpen, setCardMenuOpen] = useState(false);
  const cards = [...baseCards, ...course.extraCards.map((id) => ({ id, label: extraCardLabels[id] }))];
  const addableCards = Object.entries(extraCardLabels).filter(([id]) => !course.extraCards.includes(id));
  return (
    <section className="rightpane">
      <div className="class-header">
        <div>
          <h2>{course.name}</h2>
          <p>{course.description}</p>
        </div>
        <span className="class-code">Mã lớp: {course.code}</span>
      </div>
      <div className="class-workspace">
        <aside className="leftpanel">
          {cards.map((card) => (
            <button key={card.id} className={selectedCard === card.id ? "active" : ""} onClick={() => setSelectedCard(card.id)}>
              {card.label}
            </button>
          ))}
          {admin && (
            <div className="add-card-wrap">
              <button className="add-card" onClick={() => setCardMenuOpen(!cardMenuOpen)} aria-label="Add card type">
                <Plus size={16} />
              </button>
              {cardMenuOpen && (
                <div className="add-card-menu">
                  {addableCards.length === 0 && <span>Đã có đủ card</span>}
                  {addableCards.map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => {
                        updateCourse((current) => ({ ...current, extraCards: [...current.extraCards, id] }));
                        setSelectedCard(id);
                        setCardMenuOpen(false);
                      }}
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
          <DetailRenderer admin={admin} user={user} course={course} selectedCard={selectedCard} updateCourse={updateCourse} />
        </section>
      </div>
    </section>
  );
}

function DetailRenderer({ admin, user, course, selectedCard, updateCourse }) {
  if (selectedCard === "members") return <MembersCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "announcements") return <AnnouncementsCard admin={admin} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "info") return <InfoCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "groupTopic") return <GroupTopicCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "materials") return <MaterialsCard admin={admin} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "assignments") return <AssignmentsCard admin={admin} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "grades") return <GradesCard admin={admin} user={user} course={course} updateCourse={updateCourse} />;
  if (selectedCard === "personalTopic") return <PersonalTopicCard course={course} updateCourse={updateCourse} />;
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


function MembersCard({ admin, course, updateCourse }) {
  const accepted = course.members.filter((member) => member.status === "accepted");
  const pending = course.members.filter((member) => member.status === "pending");
  return (
    <>
      <PanelTitle title="Thành viên" />
      <div className="teacher-strip">
        {ADMIN_PROFILES.map((profile) => (
          <div key={profile.email}>
            <span className="avatar small">{initials(profile.name)}</span>
            <strong>Giảng viên</strong>
            <small>{profile.name} - {profile.email}</small>
          </div>
        ))}
      </div>
      {admin && pending.length > 0 && (
        <section className="subsection">
          <h4>Chờ accept</h4>
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
      <table className="data-table members-table">
        <thead><tr><th className="stt-col">STT</th><th>Họ tên</th><th>Email</th><th>Mã số</th>{admin && <th />}</tr></thead>
        <tbody>
          {accepted.map((member) => (
            <tr key={member.email}>
              <td>{admin ? <input className="order-input" value={member.order} onChange={(event) => updateMemberOrder(course, updateCourse, member.email, event.target.value)} /> : member.order}</td>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>{member.studentId}</td>
              {admin && <td><button className="icon-danger" onClick={() => removeMember(course, updateCourse, member.email)}><X size={15} /></button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function updateMemberStatus(course, updateCourse, email, status) {
  updateCourse((current) => ({ ...current, members: current.members.map((member) => (member.email === email ? { ...member, status } : member)) }));
}

function updateMemberOrder(course, updateCourse, email, order) {
  updateCourse((current) => ({ ...current, members: current.members.map((member) => (member.email === email ? { ...member, order } : member)) }));
}

function removeMember(course, updateCourse, email) {
  updateCourse((current) => ({ ...current, members: current.members.filter((member) => member.email !== email) }));
  deleteMemberFromCloud(course.id, email);
}


function AnnouncementsCard({ admin, user, course, updateCourse }) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [pinned, setPinned] = useState(false);

  function addFiles(fileList) {
    const nextFiles = Array.from(fileList || []);
    if (nextFiles.length) setFiles((current) => [...current, ...nextFiles]);
  }

  async function submitPost() {
    if (!content.trim() && files.length === 0) return;
    const attachments = hasFirebaseConfig
      ? await uploadManyFiles(course, "announcements", files, { readerEmails: classReaderEmails(course), writerEmails: adminWriterEmails() })
      : await Promise.all(files.map(readFileAsDataUrl));
    updateCourse((current) => ({
      ...current,
      announcements: [
        {
          id: crypto.randomUUID(),
          author: user.email,
          role: admin ? "admin" : "learner",
          content,
          pinned,
          attachments,
          createdAt: new Date().toLocaleString("vi-VN")
        },
        ...current.announcements
      ]
    }));
    setContent("");
    setFiles([]);
    setPinned(false);
  }

  const posts = [...course.announcements].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  return (
    <>
      <PanelTitle title="Thông báo" />
      <div
        className="composer drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
        onPaste={(event) => addFiles(event.clipboardData.files)}
      >
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Đăng thông báo cho lớp, dán URL hoặc Ctrl + V hình" />
        <div className="composer-tools">
          <label className="file-picker">
            Browse
            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" onChange={(event) => addFiles(event.target.files)} />
          </label>
          <label className="check-row"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Pin</label>
          <span>{files.length ? `${files.length} file đã chọn` : "Kéo thả file hoặc Ctrl + V hình"}</span>
          <button className="primary-action compact" onClick={submitPost}><Send size={15} /> Đăng tin</button>
        </div>
      </div>
      <div className="feed">
        {posts.map((item) => (
          <article className={`feed-item ${item.role === "admin" ? "admin-post" : ""} ${item.pinned ? "pinned-post" : ""}`} key={item.id}>
            <div className="post-head">
              <div><strong>{item.author}</strong><small>{item.createdAt}</small></div>
              <button className="pin-button" onClick={() => updateCourse((current) => ({ ...current, announcements: current.announcements.map((post) => post.id === item.id ? { ...post, pinned: !post.pinned } : post) }))}>{item.pinned ? "Unpin" : "Pin"}</button>
            </div>
            <p>{item.content}</p>
            <div className="link-list">{extractUrls(item.content).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>)}</div>
            {item.attachments?.length > 0 && (
              <div className="attachment-grid">
                {item.attachments.map((file, index) => file.type?.startsWith("image/") || String(file.previewUrl || file.url).startsWith("data:image") ? (
                  <a key={`${file.fileName}-${index}`} href={file.webViewLink || file.url} target="_blank" rel="noreferrer"><img src={file.previewUrl || file.url} alt={file.fileName} /></a>
                ) : (
                  <a key={`${file.fileName}-${index}`} href={file.webViewLink || file.url} target="_blank" rel="noreferrer">{file.fileName}</a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}


function InfoCard({ admin, course, updateCourse }) {
  const [draft, setDraft] = useState({ rules: "", ...course.info });
  const fields = [["title", "Title"], ["size", "Sĩ số"], ["time", "Thời gian"], ["room", "Phòng học"]];
  return (
    <>
      <PanelTitle title="Thông tin lớp học" action={admin && <button className="primary-action compact" onClick={() => updateCourse((current) => ({ ...current, info: draft }))}>Save</button>} />
      <div className="info-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            {admin ? <input value={draft[key] || ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /> : <strong>{course.info[key]}</strong>}
          </label>
        ))}
        <label className="wide-field">
          <span>Description</span>
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


function GroupTopicCard({ admin, course, updateCourse }) {
  const empty = { name: "", topic: "", reportOrder: "", memberEmails: "" };
  const [draft, setDraft] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  function saveTopic() {
    const topicData = { ...draft, memberEmails: draft.memberEmails.split(",").map((item) => item.trim()).filter(Boolean) };
    updateCourse((current) => ({
      ...current,
      groupTopics: editingId
        ? current.groupTopics.map((topic) => topic.id === editingId ? { ...topic, ...topicData } : topic)
        : [...current.groupTopics, { ...topicData, id: crypto.randomUUID() }]
    }));
    setDraft(empty);
    setEditingId(null);
  }

  return (
    <>
      <PanelTitle title="Topic Nhóm" />
      {admin && (
        <div className="inline-form topic-form">
          <input placeholder="Tên nhóm" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <input placeholder="Email thành viên, cách nhau bằng dấu phẩy" value={draft.memberEmails} onChange={(event) => setDraft({ ...draft, memberEmails: event.target.value })} />
          <input placeholder="Topic" value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} />
          <input placeholder="STT báo cáo" value={draft.reportOrder} onChange={(event) => setDraft({ ...draft, reportOrder: event.target.value })} />
          <button onClick={saveTopic}><Plus size={15} /> {editingId ? "Save" : "Add"}</button>
        </div>
      )}
      <div className="topic-grid">
        {course.groupTopics.map((topic) => (
          <article className="topic-card" key={topic.id}>
            <div className="card-row-head">
              <strong>{topic.name}</strong>
              {admin && (
                <span className="row-actions">
                  <button onClick={() => { setEditingId(topic.id); setDraft({ ...topic, memberEmails: topic.memberEmails.join(", ") }); }}>Edit</button>
                  <button className="icon-danger" onClick={() => updateCourse((current) => ({ ...current, groupTopics: current.groupTopics.filter((item) => item.id !== topic.id) }))}><Trash2 size={15} /></button>
                </span>
              )}
            </div>
            <p>{topic.topic}</p>
            <small>STT báo cáo: {topic.reportOrder}</small>
            <ul>{topic.memberEmails.map((email) => {
              const member = course.members.find((item) => item.email === email);
              return <li key={email}>{member?.name || email} - {member?.studentId || "Chưa có mã số"} - {email}</li>;
            })}</ul>
          </article>
        ))}
      </div>
    </>
  );
}


function MaterialsCard({ admin, course, updateCourse }) {
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState([]);
  return (
    <>
      <PanelTitle title="Tài liệu" />
      {admin && (
        <div className="inline-form material-form">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tên thẻ tài liệu, ví dụ Chương 1" />
          <input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
          <button onClick={async () => {
            if (!title) return;
            const uploaded = hasFirebaseConfig
              ? await uploadManyFiles(course, `materials/${title}`, files, { readerEmails: classReaderEmails(course), writerEmails: adminWriterEmails() })
              : await Promise.all(files.map(readFileAsDataUrl));
            updateCourse((current) => ({ ...current, materials: [...current.materials, { id: crypto.randomUUID(), title, files: uploaded }] }));
            setTitle("");
            setFiles([]);
          }}><Upload size={15} /> Thêm thẻ tài liệu</button>
        </div>
      )}
      <div className="list-stack">
        {course.materials.map((item) => (
          <article className="material-card" key={item.id}>
            <div className="card-row-head">
              <strong>{item.title}</strong>
              {admin && <button className="icon-danger" onClick={() => updateCourse((current) => ({ ...current, materials: current.materials.filter((material) => material.id !== item.id) }))}><Trash2 size={15} /></button>}
            </div>
            <div className="file-list">
              {materialFiles(item).map((file, index) => (
                <button key={`${file.fileName}-${index}`} onClick={() => file.url && window.open(file.url, "_blank", "noopener,noreferrer")}><Download size={15} /> {file.fileName}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}


function AssignmentsCard({ admin, user, course, updateCourse }) {
  const [draft, setDraft] = useState({ title: "", content: "" });
  return (
    <>
      <PanelTitle title="Bài tập" />
      {admin && (
        <div className="inline-form two">
          <input placeholder="Tiêu đề bài tập" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <textarea placeholder="Nội dung giao bài" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
          <button onClick={() => {
            if (!draft.title) return;
            updateCourse((current) => ({ ...current, assignments: [...current.assignments, { id: crypto.randomUUID(), ...draft, submissions: [] }] }));
            setDraft({ title: "", content: "" });
          }}><FilePlus2 size={15} /> Tạo thẻ</button>
        </div>
      )}
      <div className="list-stack">
        {course.assignments.map((assignment) => (
          <AssignmentItem key={assignment.id} admin={admin} course={course} assignment={assignment} user={user} updateCourse={updateCourse} />
        ))}
      </div>
    </>
  );
}


function AssignmentItem({ admin, course, assignment, user, updateCourse }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const userSubmissions = assignment.submissions?.filter((item) => item.email === user.email) || [];

  async function submitAssignment() {
    if (!fileName && !file) return;
    const uploaded = file
      ? await uploadClassFile(course, `submissions/${assignment.id}/${user.email}`, file, { readerEmails: adminWriterEmails(), writerEmails: adminWriterEmails() })
      : { fileName, url: "" };
    updateCourse((current) => ({
      ...current,
      assignments: current.assignments.map((item) => item.id === assignment.id ? { ...item, submissions: [...(item.submissions || []), { email: user.email, submittedAt: new Date().toLocaleString("vi-VN"), ...uploaded }] } : item)
    }));
    setFileName("");
    setFile(null);
    setSubmitted(true);
  }

  return (
    <article className="expand-card">
      <div className="assignment-head">
        <button onClick={() => setOpen(!open)}><strong>{assignment.title}</strong>{userSubmissions.length > 0 && <small>Đã nộp {userSubmissions.length} lần</small>}</button>
        {admin && <button className="icon-danger" onClick={() => updateCourse((current) => ({ ...current, assignments: current.assignments.filter((item) => item.id !== assignment.id) }))}><Trash2 size={15} /></button>}
      </div>
      {open && (
        <div>
          <p>{assignment.content}</p>
          {!admin && (
            <>
              <div className="upload-row">
                <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Tên file bài tập" />
                <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                <button onClick={submitAssignment}><Upload size={15} /> Submit</button>
              </div>
              {(submitted || userSubmissions.length > 0) && <p className="success-text">Bạn đã nộp bài thành công.</p>}
            </>
          )}
          {admin && <button className="join-action compact" onClick={() => setShowResults(!showResults)}>Xem kết quả nộp bài</button>}
          {admin && showResults && (
            <table className="data-table compact-table">
              <thead><tr><th>Email</th><th>File</th><th>Thời gian</th></tr></thead>
              <tbody>{(assignment.submissions || []).map((submission, index) => (
                <tr key={`${submission.email}-${index}`}>
                  <td>{submission.email}</td>
                  <td><button className="link-button" onClick={() => submission.url && window.open(submission.url, "_blank", "noopener,noreferrer")}>{submission.fileName || "file"}</button></td>
                  <td>{submission.submittedAt || ""}</td>
                </tr>
              ))}</tbody>
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
  return (
    <>
      <PanelTitle title="Bảng điểm" />
      {admin && (
        <div className="inline-form two">
          <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
            {course.assignments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="group">Điểm nhóm</option>
            <option value="personal" disabled={!course.extraCards.includes("personalTopic")}>Điểm cá nhân</option>
          </select>
          <button onClick={() => createGradebook(course, updateCourse, assignmentId, type)}><Plus size={15} /> Tạo bảng điểm</button>
        </div>
      )}
      <div className="list-stack">
        {course.gradebooks.map((book) => (
          <GradebookItem key={book.id} admin={admin} user={user} book={book} course={course} updateCourse={updateCourse} />
        ))}
      </div>
    </>
  );
}

function createGradebook(course, updateCourse, assignmentId, type) {
  const assignment = course.assignments.find((item) => item.id === assignmentId);
  const rows = type === "group"
    ? course.groupTopics.map((topic) => ({ key: topic.id, label: topic.name, score: "" }))
    : course.members.filter((member) => member.status === "accepted").map((member) => ({ key: member.email, label: `${member.order}. ${member.name}`, score: "" }));
  updateCourse((current) => ({ ...current, gradebooks: [...current.gradebooks, { id: crypto.randomUUID(), assignmentId, title: `Điểm ${assignment?.title || "bài tập"}`, type, rows }] }));
}

function GradebookItem({ admin, user, book, course, updateCourse }) {
  const [open, setOpen] = useState(false);
  const [draftRows, setDraftRows] = useState(book.rows);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraftRows(book.rows);
    setDirty(false);
  }, [book.id, book.rows]);

  const rows = admin
    ? draftRows
    : book.rows.filter((row) => row.key === user.email || course.groupTopics.find((topic) => topic.id === row.key)?.memberEmails.includes(user.email));

  function changeDraftScore(rowKey, score) {
    setDirty(true);
    setDraftRows((current) => current.map((row) => row.key === rowKey ? { ...row, score } : row));
  }

  function saveScores() {
    updateCourse((current) => ({
      ...current,
      gradebooks: current.gradebooks.map((item) => item.id === book.id ? { ...item, rows: draftRows } : item)
    }));
    setDirty(false);
  }

  return (
    <article className="expand-card">
      <button onClick={() => setOpen(!open)}><strong>{book.title}</strong><small>{book.type === "group" ? "Topic Nhóm" : "Cá nhân"}</small></button>
      {open && (
        <>
          {admin && <button className="primary-action compact save-score-button" onClick={saveScores} disabled={!dirty}>Save</button>}
          <table className="data-table compact-table">
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{admin ? <input value={row.score} onChange={(event) => changeDraftScore(row.key, event.target.value)} /> : row.score || "Chưa có điểm"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}


function PersonalTopicCard({ course, updateCourse }) {
  const members = course.members.filter((member) => member.status === "accepted").sort((a, b) => Number(a.order) - Number(b.order));
  return (
    <>
      <PanelTitle title="Topic Cá nhân" />
      <table className="data-table">
        <thead><tr><th className="stt-col">STT</th><th>Họ tên</th><th>Email</th><th>Mã số</th><th>Topic</th></tr></thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.email}>
              <td>{member.order}</td>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>{member.studentId}</td>
              <td><input value={course.personalTopics.find((item) => item.email === member.email)?.topic || ""} onChange={(event) => updatePersonalTopic(course, updateCourse, member.email, event.target.value)} /></td>
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

  return course.groupTopics
    .filter((item) => item.topic?.trim())
    .map((item) => `${item.name} - ${item.topic}`);
}


function PeerReviewItem({ admin, user, course, review, updateCourse }) {
  const [topic, setTopic] = useState(review.options[0] || "");
  const [score, setScore] = useState("");
  const [openTable, setOpenTable] = useState(false);
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
        <button onClick={() => {
          if (!score) return;
          const learner = course.members.find((member) => member.email === user.email);
          updateCourse((current) => ({
            ...current,
            peerReviews: current.peerReviews.map((item) => item.id === review.id ? { ...item, responses: [...item.responses, { email: user.email, name: learner?.name || user.displayName, studentId: learner?.studentId || "", topic, score }] } : item)
          }));
          setScore("");
        }}>Submit</button>
        {admin && <button onClick={() => setOpenTable(!openTable)}>Danh sách chấm điểm</button>}
      </div>
      {admin && openTable && (
        <>
          <button className="export-button" onClick={() => exportReview(review)}>Export Excel</button>
          <table className="data-table compact-table">
            <thead><tr><th>Email</th><th>Họ và tên</th><th>Mã số</th><th>Topic</th><th>Điểm chấm</th></tr></thead>
            <tbody>{review.responses.map((row, index) => <tr key={`${row.email}-${index}`}><td>{row.email}</td><td>{row.name}</td><td>{row.studentId}</td><td>{row.topic}</td><td>{row.score}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </article>
  );
}

function exportReview(review) {
  const headers = ["Email", "Họ và tên", "Mã số", "Topic", "Điểm chấm"];
  const rows = review.responses.map((row) => [row.email, row.name, row.studentId, row.topic, row.score]);
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

function JoinClassModal({ user, classes, cloudMode, onClose, onJoin }) {
  const [form, setForm] = useState({ name: user.displayName || "", studentId: "", code: "" });
  const [error, setError] = useState("");
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
        onJoin(course.id, { order: course.members.length + 1, name: form.name, email: user.email, studentId: form.studentId, status: "pending", code: form.code });
      }}>Gửi yêu cầu tham gia</button>
    </Modal>
  );
}

function NewClassModal({ existing, onClose, onSave }) {
  const [form, setForm] = useState(existing || { id: "", name: "", description: "", code: "", pinned: false, info: { title: "", size: 0, time: "", room: "", description: "", rules: "" }, members: [], announcements: [], groupTopics: [], personalTopics: [], materials: [], assignments: [], gradebooks: [], peerReviews: [], extraCards: [] });
  return (
    <Modal title={existing ? "Edit Class" : "Add New Class"} onClose={onClose}>
      <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, id: existing?.id || event.target.value.toLowerCase().replaceAll(" ", "-"), info: { ...form.info, title: event.target.value } })} placeholder="Tên class" />
      <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value, info: { ...form.info, description: event.target.value } })} placeholder="Description" />
      <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="Mã class" />
      <button className="primary-action" onClick={() => onSave(form)}>Save</button>
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

function PendingPane({ course }) {
  return (
    <section className="pending-pane">
      <div>
        <h2>{course.name}</h2>
        <p>Yêu cầu tham gia lớp đã được gửi. Bạn sẽ xem được nội dung sau khi admin accept.</p>
        <span className="class-code">Trạng thái: Chờ accept</span>
      </div>
    </section>
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

createRoot(document.getElementById("root")).render(<App />);
