export const SUPREME_EMAIL = "hhluan@hcmus.edu.vn";

export const SUPREME_PROFILE = {
  email: SUPREME_EMAIL,
  name: "PhD. Huỳnh Hữu Luân"
};

export const DEFAULT_LECTURERS = [
  SUPREME_PROFILE
];

export const seedClasses = [
  {
    id: "ai-2026",
    name: "AI Applications 2026",
    description: "Lớp ứng dụng AI cho sinh viên và học viên cao học.",
    code: "AI2026",
    pinned: true,
    info: {
      title: "AI Applications 2026",
      size: 42,
      time: "Thứ 3, 07:30-10:30",
      room: "I.23",
      description: "Học phần tập trung vào thiết kế sản phẩm AI, đánh giá mô hình, và quy trình triển khai.",
      rules: "Đi học đúng giờ, nộp bài đúng hạn, trích dẫn nguồn rõ ràng."
    },
    members: [
      { order: 1, name: "Tran Minh Anh", email: "minhanh@student.edu.vn", studentId: "22110001", status: "accepted" },
      { order: 2, name: "Le Quoc Bao", email: "quocbao@student.edu.vn", studentId: "22110002", status: "accepted" },
      { order: 3, name: "Pham Thu Ha", email: "thuha@student.edu.vn", studentId: "22110003", status: "pending" }
    ],
    announcements: [
      {
        id: "a1",
        author: "hhluan@hcmus.edu.vn",
        role: "admin",
        content: "Tuần này các nhóm nộp proposal topic trước 22:00 Chủ nhật. Xem thêm tại https://hcmus.edu.vn",
        createdAt: "2026-05-20 08:15",
        pinned: true,
        attachments: []
      },
      {
        id: "a2",
        author: "minhanh@student.edu.vn",
        role: "learner",
        content: "Nhóm 1 đã cập nhật link tài liệu tham khảo trong phần topic.",
        createdAt: "2026-05-21 14:20",
        pinned: false,
        attachments: []
      }
    ],
    groupTopics: [
      {
        id: "g1",
        name: "Nhóm 1",
        topic: "AI tutor for programming labs",
        reportOrder: 1,
        memberEmails: ["minhanh@student.edu.vn", "quocbao@student.edu.vn"]
      }
    ],
    personalTopics: [{ email: "minhanh@student.edu.vn", topic: "Prompt evaluation rubric" }],
    materials: [
      {
        id: "m1",
        title: "Syllabus và lịch học",
        files: [{ fileName: "syllabus-ai-2026.pdf", url: "" }]
      }
    ],
    assignments: [
      {
        id: "hw1",
        title: "Bài tập 1: Proposal",
        content: "Mỗi nhóm nộp proposal 2 trang gồm vấn đề, dữ liệu, tiêu chí đánh giá.",
        submissions: []
      }
    ],
    gradebooks: [
      {
        id: "gb1",
        assignmentId: "hw1",
        title: "Điểm Proposal",
        type: "group",
        rows: [{ key: "g1", label: "Nhóm 1", score: 8.5 }]
      }
    ],
    peerReviews: [
      {
        id: "pr1",
        title: "Chấm báo cáo giữa kỳ",
        options: ["Nhóm 1 - AI tutor", "Nhóm 2 - Visual feedback"],
        responses: [{ email: "quocbao@student.edu.vn", name: "Le Quoc Bao", studentId: "22110002", topic: "Nhóm 1 - AI tutor", score: 9 }]
      }
    ],
    extraCards: ["peerReview", "personalTopic"]
  },
  {
    id: "ds-lab",
    name: "Data Science Lab",
    description: "Seminar thực hành khoa học dữ liệu.",
    code: "DSLAB",
    pinned: false,
    info: {
      title: "Data Science Lab",
      size: 28,
      time: "Thứ 6, 13:30-16:30",
      room: "F.101",
      description: "Lớp seminar theo nhóm, báo cáo paper và triển khai notebook phân tích dữ liệu.",
      rules: ""
    },
    members: [{ order: 1, name: "Vo Kim Ngan", email: "kimngan@student.edu.vn", studentId: "23120010", status: "accepted" }],
    announcements: [],
    groupTopics: [],
    personalTopics: [],
    materials: [],
    assignments: [],
    gradebooks: [],
    peerReviews: [],
    extraCards: []
  }
];

export const baseCards = [
  { id: "announcements", label: "Thông báo" },
  { id: "members", label: "Thành viên" },
  { id: "info", label: "Thông tin lớp học" },
  { id: "schedule", label: "Lịch học (TKB)" },
  { id: "groupTopic", label: "Topic Nhóm" },
  { id: "materials", label: "Tài liệu" },
  { id: "assignments", label: "Bài tập" },
  { id: "grades", label: "Bảng điểm" }
];

export const extraCardLabels = {
  intergroupTopic: "Topic Liên nhóm",
  peerReview: "Người học chấm điểm",
  personalTopic: "Topic Cá nhân"
};
