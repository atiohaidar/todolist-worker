# 📝 TodoList Worker

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-blue)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

Aplikasi daftar tugas sederhana dengan sistem login menggunakan Cloudflare Workers dan database D1.

## ✨ Fitur Utama

- 🔐 **Registrasi dan Login** - Buat akun dan masuk tanpa verifikasi email
- 🔒 **Keamanan JWT** - Sistem autentikasi yang aman
- ✅ **Kelola Tugas** - Tambah, edit, hapus, dan tandai selesai tugas
- 🌐 **Frontend Sederhana** - Interface web murni HTML/CSS/JavaScript
- ⚡ **Backend Cepat** - Menggunakan Cloudflare Workers dengan Hono.js

## 🚀 Demo

[![Lihat Demo](https://img.shields.io/badge/Lihat-Demo-blue?style=for-the-badge)](https://todolist-worker.atiohaidar.workers.dev/)

Kunjungi halaman utama untuk melihat dokumentasi API dan test langsung!

## 📋 Daftar Isi

- [Instalasi Cepat](#instalasi-cepat)
- [Setup Lengkap](#setup-lengkap)
- [Penggunaan](#penggunaan)
- [Dokumentasi API](#dokumentasi-api)
- [Teknologi](#teknologi)
- [Catatan Keamanan](#catatan-keamanan)
- [Pelajaran Berharga](#pelajaran-berharga)

## ⚡ Instalasi Cepat

Untuk yang sudah familiar dengan Cloudflare Workers:

```bash
# Clone repository
git clone https://github.com/atiohaidar/todolist-worker.git
cd todolist-worker/backend

# Install dependencies
npm install

# Setup database dan deploy
wrangler d1 create todolist-db
wrangler secret put JWT_SECRET
wrangler deploy
```

## 🛠️ Setup Lengkap

### Persiapan

1. **Akun Cloudflare** - Daftar di [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI** - Install dengan `npm install -g wrangler`
3. **Login** - Jalankan `wrangler auth login`

### Backend (Server)

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Buat Database D1**
   ```bash
   wrangler d1 create todolist-db
   ```
   Catat ID database yang dihasilkan.

3. **Update Konfigurasi**
   - Edit `wrangler.toml`, ganti `your-database-id-here` dengan ID database Anda

4. **Set Secret Key**
   ```bash
   wrangler secret put JWT_SECRET
   ```
   Masukkan kata sandi rahasia yang kuat (minimal 32 karakter).

5. **Jalankan Migrasi Database**
   ```bash
   wrangler d1 execute todolist-db --remote --file=./migrations/001_init.sql
   ```

6. **Test Lokal** (opsional)
   ```bash
   npm run dev
   ```

7. **Deploy ke Production**
   ```bash
   wrangler deploy
   ```

### Frontend (Interface Web)

1. **Buka File HTML**
   - Buka `frontend/index.html` di browser web Anda
   - Atau gunakan server lokal: `cd frontend && python -m http.server 8000`

2. **Update URL API** (jika perlu)
   - Edit `frontend/auth.js`
   - Ganti `API_BASE` dengan URL worker Anda

## 🎯 Penggunaan

1. **Registrasi**: Buat akun baru dengan username dan password
2. **Login**: Masuk dengan akun yang sudah dibuat
3. **Kelola Tugas**:
   - ➕ **Tambah**: Klik "Add Task" dan isi judul serta deskripsi
   - ✏️ **Edit**: Klik tombol "Edit" pada tugas
   - ✅ **Selesai**: Klik checkbox untuk menandai selesai
   - 🗑️ **Hapus**: Klik tombol "Delete" untuk menghapus

## 📚 Dokumentasi API

[![Lihat API Docs](https://img.shields.io/badge/API-Docs-blue?style=for-the-badge)](https://todolist-worker.atiohaidar.workers.dev/)

Dokumentasi lengkap API tersedia di halaman utama aplikasi menggunakan Swagger UI.

### Endpoint Utama

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/register` | Daftar akun baru |
| POST | `/api/auth/login` | Masuk ke akun |
| POST | `/api/auth/logout` | Keluar dari akun |
| GET | `/api/tasks` | Ambil semua tugas |
| POST | `/api/tasks` | Buat tugas baru |
| PUT | `/api/tasks/:id` | Update tugas |
| DELETE | `/api/tasks/:id` | Hapus tugas |

## 🛠️ Teknologi

- **Backend**: Cloudflare Workers + Hono.js
- **Database**: Cloudflare D1 (SQLite)
- **Authentication**: JWT (JSON Web Token)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **API Documentation**: Swagger UI

## 🔒 Catatan Keamanan

> ⚠️ **PENTING**: Jangan commit data sensitif ke repository publik!

- **JWT_SECRET** tidak disimpan di kode. Set menggunakan `wrangler secret put JWT_SECRET`
- **Database ID** menggunakan placeholder. Ganti dengan ID database Anda sendiri
- Selalu gunakan HTTPS untuk production
- Password di-hash menggunakan bcrypt

## 📖 Pelajaran Berharga

Dari pengembangan aplikasi ini, kami belajar:

- **Migration Database**: Pastikan jalankan migration di database production, bukan hanya local
- **Error 500**: Jika dapat error 500, periksa apakah database sudah diinisialisasi
- **Update API URL**: Jangan lupa update URL API di frontend setelah deploy

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan:

1. Fork repository ini
2. Buat branch fitur baru (`git checkout -b fitur-baru`)
3. Commit perubahan (`git commit -am 'Tambah fitur baru'`)
4. Push ke branch (`git push origin fitur-baru`)
5. Buat Pull Request

## 📄 Lisensi

Distributed under the MIT License. See `LICENSE` for more information.

---

**Dibuat dengan ❤️ menggunakan Cloudflare Workers**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-Web%20Framework-blue)](https://hono.dev/)