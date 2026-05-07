# Resinsep — Resin Separation Cycle Dashboard (Next.js + Firebase)

Resinsep adalah aplikasi web dashboard untuk **mencatat, memonitor, dan mengevaluasi siklus pemisahan resin** (*cycle*) pada proses pengolahan plastik. Aplikasi mencakup **autentikasi pengguna**, **pembuatan cycle baru (input → output → monitoring)**, **riwayat (history)**, serta **detail cycle** yang menyimpan komposisi resin, tahapan pemisahan (*stages*), **recovery (%)**, dan estimasi **revenue**.

Aplikasi dibangun menggunakan **Next.js App Router + TypeScript** dan terintegrasi dengan **Firebase Auth** + **Cloud Firestore**. Struktur routing memakai Route Groups `(auth)` dan `(dashboard)` agar layout area login dan dashboard terpisah tanpa mengubah URL secara hierarkis.

## 🚀 Deskripsi Singkat

Resinsep membantu tim operasional mengubah pencatatan proses pemisahan resin yang biasanya manual dan tersebar menjadi sistem yang **terstruktur, mudah ditelusuri, dan siap dievaluasi**. Dalam satu dashboard, pengguna dapat membuat cycle baru, mengisi detail supplier, input/output, durasi, komposisi resin per grade, serta data tahapan pemisahan.

Setelah tersimpan, semua cycle otomatis masuk ke history (urut terbaru) dan bisa dibuka kembali untuk melihat detail lengkap beserta metrik recovery dan estimasi revenue. Data disimpan per user di Firestore, sehingga rapi dan aman secara konsep untuk multi-pengguna.

## 🧩 Problem & Tujuan

Dalam proses pengolahan plastik, pencatatan input vs output, durasi, dan hasil pemisahan resin sering tidak konsisten, sulit dibandingkan, dan sulit ditelusuri kembali. Resinsep bertujuan menyederhanakan kebutuhan tersebut dengan tiga fokus utama:

1. **Konsistensi**: Menyatukan pencatatan proses ke dalam format yang baku (cycle sebagai unit data utama).
2. **Evaluasi**: Memudahkan analisis operasional melalui metrik otomatis: *recovery* dan *revenue*.
3. **Privasi**: Menjaga keterpisahan data antar pengguna dengan struktur Firestore berbasis `users/{userId}`.

## ✨ Fitur Utama

- **Autentikasi (Firebase Auth)**: Register dan login yang aman.
- **Dashboard**: Ringkasan aktivitas dan akses cepat ke modul utama.
- **Inventory**: Halaman pengelolaan stok/inventori.
- **Cycle Management**:
  - Buat cycle baru (`/new-cycle`).
  - Riwayat cycles (`/cycles`, otomatis urut terbaru).
  - Detail cycle mendalam (`/cycles/[id]`).
  - **Export PDF**: Dari halaman detail cycle (`/cycles/[id]`), pengguna dapat menekan tombol **“Export PDF”** untuk membuat laporan PDF dari data cycle dan **langsung mengunduhnya** (Batch Info + Summary + Stage Log + Resin Output).
- **Metrik Otomatis**:
  - **Recovery (%)**: Dihitung dari output vs input.
  - **Revenue**: Estimasi nilai dari total resin × referensi harga pasar.
- **Referensi Domain Terintegrasi**: Tipe resin, skema warna, referensi harga per kg, daftar supplier, dan metadata tahapan pemisahan (stages).

## 📄 Export PDF (Laporan Siklus)

Fitur **Export PDF** tersedia di halaman detail cycle: **`/cycles/[id]`**. Saat tombol **“Export PDF”** ditekan, aplikasi akan:

- Mengambil data cycle yang sedang dibuka (informasi batch, ringkasan proses, stages, dan output resin).
- Menghasilkan file PDF **di sisi client (browser)** menggunakan `jspdf` dan `jspdf-autotable`.
- Memicu **download otomatis** dengan nama file: `cycle-<cycleId>.pdf`  
  Contoh: `cycle-RSP-20260507-001.pdf`

### Isi PDF yang Dihasilkan

PDF berisi ringkasan lengkap yang siap digunakan untuk laporan operasional:

- **Header**: Judul laporan, Cycle ID, timestamp waktu ekspor.
- **Informasi Batch**: Cycle ID, waktu, supplier, operator, catatan.
- **Ringkasan Proses**: inputKg, outputKg, recovery rate, durasi, estimasi pendapatan.
- **Log Per Tahap Separasi** (jika ada stages): tahap, medium, densitas, durasi, fraksi apung, fraksi tenggelam.
- **Output Resin dan Estimasi Nilai**: tipe resin, berat, grade, harga referensi/kg, estimasi nilai per resin, dan total estimasi pendapatan.

> **Catatan**: Karena PDF digenerate *client-side*, proses ekspor tidak memerlukan endpoint backend tambahan.

## ⚙️ Instalasi & Menjalankan

1. **Clone & Install**:
   ```bash
   npm install
   ```

2. **Tambahkan dependency PDF Export** (jika belum ada):
   ```bash
   npm install jspdf jspdf-autotable
   ```

3. **Konfigurasi Environment**:  
   Buat file `.env.local` di root folder:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Development Mode**:
   ```bash
   npm run dev
   ```

## 📽️ Demo Flow (Alur Penilaian)

Alur demo yang paling efektif untuk memperlihatkan nilai aplikasi secara cepat:

1. **Registrasi**: Buka `/register` untuk membuat akun baru.
2. **Login**: Masuk melalui halaman `/login`.
3. **Input Data**: Buka `/new-cycle`, isi data operasional (supplier, inputKg, resins, stages, notes), lalu simpan.
4. **Verifikasi History**: Arahkan ke `/cycles` untuk memastikan data terbaru muncul di daftar teratas.
5. **Detail & Metrik**: Buka detail via `/cycles/[id]` untuk memverifikasi ringkasan, metrik recovery, dan estimasi revenue.
6. **Ekspor Laporan**: Tekan tombol **Export PDF** untuk mengunduh laporan siklus dalam format PDF.

## 📸 Screenshots

> **Catatan**: Semua gambar berada di folder `public/`.

### Auth

| Register / Create Account | Login |
| :---: | :---: |
| ![Register](./public/capture-createacc.png) | ![Login](./public/capture-login.png) |

### Dashboard & Inventory

| Dashboard | Inventori |
| :---: | :---: |
| ![Dashboard](./public/capture-dashboard.jpeg) | ![Inventori](./public/capture-inventori.jpeg) |

### New Cycle Process

| Step 1: Input | Step 2: Output | Step 3: Monitor |
| :---: | :---: | :---: |
| ![New Cycle Input](./public/capture-newcycle-input.jpeg) | ![New Cycle Output](./public/capture-newcycle-output.jpeg) | ![New Cycle Monitor](./public/capture-newcylce-monitor.jpeg) |

### History / Cycles

| History (Cycles List) | History Detail |
| :---: | :---: |
| ![History](./public/capture-history.jpeg) | ![History Detail](./public/capture-history-detail.jpeg) |

## 📁 Struktur Folder

Struktur utama aplikasi mengikuti pola **Next.js App Router**. Route Groups `(auth)` dan `(dashboard)` dipakai untuk memisahkan layout tanpa mempengaruhi URL.

### Ringkasan Struktur

```text
public/
  capture-*.png|jpeg        -> aset screenshot & gambar dokumentasi
  logo-resinsep.png         -> logo aplikasi

src/
  app/
    (auth)/
      layout.tsx            -> layout khusus halaman auth
      login/page.tsx        -> /login
      register/page.tsx     -> /register

    (dashboard)/
      layout.tsx            -> layout dashboard (sidebar/topbar/guard)
      dashboard/page.tsx    -> /dashboard
      inventory/page.tsx    -> /inventory
      new-cycle/page.tsx    -> /new-cycle
      cycles/page.tsx       -> /cycles (history/list)
      cycles/[id]/page.tsx  -> /cycles/:id (detail + Export PDF)

    layout.tsx              -> root layout aplikasi
    page.tsx                -> halaman root (/)
    providers.tsx           -> global providers (context, dll)
    globals.css             -> CSS global

  components/
    sidebar.tsx             -> sidebar dashboard
    topbar.tsx              -> topbar dashboard
    grade-badge.tsx         -> badge grade resin
    ui/                     -> komponen UI reusable (button, card, table, dll)

  contexts/
    auth-context.tsx        -> Context API untuk auth (state user)

  lib/
    firebase.ts             -> inisialisasi Firebase
    firestore.ts            -> helper Firestore (getCycle, list, add, dll)
    utils.ts                -> util umum (mis. fmtRp, cn, dll)

  types/
    index.ts                -> kontrak data (Cycle, Resin, Stage) + referensi domain
```

### Lokasi Implementasi Fitur Export PDF

Fitur Export PDF diimplementasikan pada file:
* **`src/app/(dashboard)/cycles/[id]/page.tsx`**

Di halaman ini, tombol **Export PDF** akan melakukan generate laporan PDF *client-side* menggunakan `jspdf` + `jspdf-autotable`, lalu memicu aksi download otomatis pada browser pengguna.

## 🛠 Tech Stack

- **Framework**: Next.js (App Router) + TypeScript
- **Backend as a Service**: Firebase (Authentication & Cloud Firestore)
- **PDF Export (Client-side)**: `jspdf` + `jspdf-autotable`
- **UI Components**: Reusable components pada `src/components/ui`
- **State Management**: Context API (Auth) pada `src/contexts/auth-context.tsx`

## 🏗 Arsitektur

### Gambaran Tingkat Tinggi

- **UI Layer**: Next.js App Router menampilkan halaman sesuai route.
- **Auth Context**: Menyimpan status login dan `userId` secara global.
- **Data Access Layer**: UI memanggil helper Firestore pada `src/lib/firestore.ts`.
- **Storage**: Data disimpan dalam subkoleksi per pengguna: `users/{userId}/cycles`.
- **PDF Export**: Halaman detail cycle membentuk laporan PDF dari data cycle dan memicu download di browser.

### Diagram Alur (Ringkas)

```text
User -> /register or /login
     -> Auth Context (userId tersedia)
     -> (dashboard) layout: sidebar/topbar
     -> /new-cycle -> addDoc(users/{userId}/cycles)
     -> /cycles -> query orderBy(createdAt desc)
     -> /cycles/[id] -> getDoc(users/{userId}/cycles/{firestoreId})
     -> Export PDF (di /cycles/[id]) -> generate PDF client-side -> download file
```

## 💡 Referensi Domain & Kalkulasi

### Referensi Harga & Warna

| Tipe Resin | Warna Hex | Harga Ref (/kg) |
| :--- | :---: | :---: |
| **PET** | `#1E7A4A` | Rp13.500 |
| **PP** | `#34A85A` | Rp9.000 |
| **HDPE** | `#5DB87A` | Rp8.500 |
| **LDPE** | `#8DCFA0` | Rp6.000 |
| **PS** | `#E09B2D` | Rp5.500 |
| **PVC** | `#D94F4F` | Rp3.000 |
| **ABS** | `#9B6EBF` | Rp7.000 |

### Kalkulasi Utama

- **Recovery**: `((outputKg / inputKg) * 100).toFixed(1)`
- **Revenue**: `Σ (resin.kg × PRICE_REF[resin.type])`

## 📄 Lisensi

Proyek ini bersifat **Private/Proprietary**. Seluruh hak cipta dilindungi.