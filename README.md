# ClassroomPWA

PWA quan ly day hoc rieng tu cho sinh vien va hoc vien.

## Tinh nang chinh

- Dang nhap Google OAuth qua Firebase Auth.
- Admin co dinh: `hhluan@hcmus.edu.vn`, `nthue@hcmus.edu.vn`.
- Nguoi chua dang nhap chi thay man hinh dang nhap.
- Nguoi hoc phai nhap dung ma lop, sau do cho admin accept.
- Noi dung lop hoc chi mo cho admin hoac nguoi hoc da duoc accept.
- Quan ly thanh vien, thong bao, thong tin lop, topic nhom/ca nhan, tai lieu, bai tap, bang diem va nguoi hoc cham diem.
- Upload/download file qua Firebase Storage khi da cau hinh Firebase.
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
4. Bat Firebase Storage.
5. Copy `.env.example` thanh `.env` va dien cau hinh web app Firebase.
6. Deploy rules:

```bash
firebase deploy --only firestore:rules,storage
```

7. Build va deploy hosting:

```bash
npm run build
firebase deploy --only hosting
```

## Deploy len Vercel

Import repository GitHub vao Vercel, them cac bien moi truong `VITE_FIREBASE_*`, build command `npm run build`, output directory `dist`.
