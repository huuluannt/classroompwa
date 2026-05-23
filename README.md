# ClassroomPWA

PWA quan ly day hoc rieng tu cho sinh vien va hoc vien.

## Tinh nang chinh

- Dang nhap Google OAuth qua Firebase Auth.
- Admin co dinh: `hhluan@hcmus.edu.vn`, `nthue@hcmus.edu.vn`.
- Nguoi chua dang nhap chi thay man hinh dang nhap.
- Nguoi hoc phai nhap dung ma lop, sau do cho admin accept.
- Noi dung lop hoc chi mo cho admin hoac nguoi hoc da duoc accept.
- Quan ly thanh vien, thong bao, thong tin lop, topic nhom/ca nhan, tai lieu, bai tap, bang diem va nguoi hoc cham diem.
- Upload/download file qua Google Drive API, khong dung Firebase Storage.
- PWA manifest va service worker.

## Chay local

```bash
npm install
npm run dev
```

Khi chua co `.env`, app chay o che do demo local bang `localStorage`.

## Cau hinh Firebase de dung that

1. Tao Firebase project.
2. Bat Authentication provider `Google`.
3. Tao Firestore Database.
4. Bat Google Drive API trong Google Cloud project dung cho Firebase.
5. OAuth consent screen can scope `https://www.googleapis.com/auth/drive.file`.
6. Copy `.env.example` thanh `.env` va dien cau hinh web app Firebase.
7. `VITE_GOOGLE_DRIVE_SHARE_MODE=class` se share file Drive theo email admin/thanh vien lop. Co the doi thanh `anyone` de dung link cong khai, hoac `private` neu chi muon uploader xem duoc file tren Drive.
8. Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

9. Build va deploy hosting:

```bash
npm run build
firebase deploy --only hosting
```

## Deploy len Vercel

Import repository GitHub vao Vercel, them cac bien moi truong `VITE_FIREBASE_*`, build command `npm run build`, output directory `dist`.
