# 📝 TodoList Worker

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-blue)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

Aplikasi daftar tugas sederhana dengan sistem login menggunakan Cloudflare Workers dan database D1.

## ✨ Fitur Utama

- 🔐 **Registrasi dan Login** - Buat akun dan masuk tanpa verifikasi email
- 🔒 **Keamanan JWT** - Sistem autentikasi yang aman
- ✅ **Kelola Tugas** - Tambah, edit, hapus, dan tandai selesai tugas
- 📎 **Lampiran File** - Upload multiple file sebagai lampiran tugas
- 📥 **Download Lampiran** - Preview dan download file lampiran
- 🌐 **Frontend Sederhana** - Interface web murni HTML/CSS/JavaScript
- ⚡ **Backend Cepat** - Menggunakan Cloudflare Workers dengan Hono.js
- 🌟 **Anonymous Todo Lists** - Buat list collaborative tanpa login, real-time sync dengan HTTP polling!

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
   - ➕ **Tambah**: Klik "Add Task" dan isi judul, deskripsi, serta upload lampiran (opsional)
   - ✅ **Selesai**: Klik checkbox di sebelah judul untuk menandai selesai/belum
   - ✏️ **Edit**: Klik tombol "Edit" untuk mengubah judul dan deskripsi
   - 📎 **Lampiran**: Klik link lampiran untuk download/preview file
   - 🗑️ **Hapus**: Klik tombol "Delete" untuk menghapus

### 🌟 Anonymous Todo Lists

Fitur baru untuk collaborative task management tanpa login!

1. **Buat List Anonymous**:
   - Kunjungi halaman utama aplikasi
   - Scroll ke section "Anonymous Todo Lists"
   - Masukkan nama list (opsional)
   - Klik "Create Anonymous List"

2. **Share & Collaborate**:
   - Copy link yang dihasilkan
   - Share ke siapapun via email, chat, atau media sosial
   - Semua orang bisa edit list secara real-time

3. **Real-time Sync**:
   - Perubahan langsung terlihat di semua browser
   - Tidak perlu refresh halaman
   - Auto-sync setiap 3 detik

4. **Fitur Lengkap**:
   - ✅ Add, edit, delete tasks
   - ✅ Mark complete/incomplete
   - ✅ Real-time collaboration
   - ✅ No login required
   - ✅ Responsive design

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

### 🌟 Anonymous API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/anonymous/lists` | Buat list anonymous baru |
| GET | `/api/anonymous/lists/:listId` | Ambil info list |
| GET | `/api/anonymous/tasks/:listId` | Ambil semua tasks di list |
| POST | `/api/anonymous/tasks/:listId` | Tambah task baru |
| PUT | `/api/anonymous/tasks/:listId/:taskId` | Update task |
| DELETE | `/api/anonymous/tasks/:listId/:taskId` | Hapus task |
| GET | `/public/:listId` | Halaman public viewer |

## 🛠️ Teknologi

- **Backend**: Cloudflare Workers + Hono.js
- **Database**: Cloudflare D1 (SQLite)
- **File Storage**: Cloudflare Workers KV
- **Authentication**: JWT (JSON Web Token)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Real-time Sync**: HTTP Polling (3-second intervals)
- **API Documentation**: Swagger UI
- **Anonymous Features**: Public endpoints tanpa authentication, real-time sync via HTTP polling

## ⚠️ Anonymous Lists - Important Notes

### Keamanan & Limitations

**Fitur Anonymous dirancang untuk collaboration yang mudah, namun ada beberapa hal penting:**

- 🔓 **No Authentication**: Siapapun bisa edit/hapus tanpa login
- 🕒 **No Expiration**: Lists tetap ada sampai dihapus manual
- 📊 **No Analytics**: Tidak ada tracking siapa yang edit
- 🗑️ **Easy Deletion**: Siapapun bisa hapus seluruh list
- 🌐 **Public Access**: URL yang tersebar bisa diakses siapapun

### Best Practices

1. **Use for Temporary Collaboration**: Meeting notes, shopping lists, event planning
2. **Share Carefully**: Hanya share dengan orang yang dipercaya
3. **Backup Important Data**: Jangan gunakan untuk data sensitif
4. **Monitor Activity**: Check list secara berkala jika penting

### Safety Features (Planned)

- Rate limiting per IP
- Auto cleanup inactive lists (>30 days)
- Basic content moderation
- Report abuse functionality

## 📖 Pelajaran Berharga

Dari pengembangan aplikasi ini, kami belajar:

- **Migration Database**: Pastikan jalankan migration di database production, bukan hanya local
- **Error 500**: Jika dapat error 500, periksa apakah database sudah diinisialisasi
- **Update API URL**: Jangan lupa update URL API di frontend setelah deploy

## 🐛 Troubleshooting Masalah Umum

### Masalah: Upload File ke KV Gagal & Data Tidak Ditampilkan

**Gejala:**
- File tidak berhasil diupload ke Workers KV
- Lampiran file tidak muncul di daftar tugas
- Error 500 Internal Server Error di endpoint auth

**Akar Penyebab:**

1. **Database Belum Diinisialisasi di Production**
   - Migration SQL belum dijalankan di database production
   - Tabel `users` dan `tasks` tidak ada
   - Query database gagal karena tabel tidak ditemukan

2. **Format Data Attachments Tidak Sesuai**
   - Di database, `attachments` disimpan sebagai JSON string
   - Frontend expect array, tapi backend return string
   - Parsing JSON gagal saat menampilkan data

3. **Environment Variables Tidak Lengkap**
   - JWT_SECRET belum di-set di production
   - Database binding tidak benar
   - KV namespace belum dibuat

**Solusi Lengkap:**

1. **Inisialisasi Database Production**
   ```bash
   # Jalankan migration di remote database
   wrangler d1 execute todolist-db --remote --file=./migrations/001_init.sql
   
   # Atau gunakan endpoint init-db jika migration gagal
   curl https://your-worker-url/init-db
   ```

2. **Perbaiki Format Data Attachments**
   - Backend sekarang otomatis parse JSON string menjadi array
   - Pastikan response API mengembalikan `attachments` sebagai array
   - Frontend sudah expect format array

3. **Verifikasi Environment Setup**
   ```bash
   # Cek secrets
   wrangler secret list
   
   # Set JWT_SECRET jika belum ada
   wrangler secret put JWT_SECRET
   
   # Test environment
   curl https://your-worker-url/test-env
   ```

4. **Test Step-by-Step**
   ```bash
   # 1. Test database connection
   curl https://your-worker-url/test-db
   
   # 2. Test register
   curl -X POST https://your-worker-url/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","password":"testpass123"}'
   
   # 3. Test login & dapat token
   TOKEN=$(curl -s -X POST https://your-worker-url/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","password":"testpass123"}' | jq -r .token)
   
   # 4. Test upload file
   echo "test content" > test.txt
   curl -X POST https://your-worker-url/api/upload \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@test.txt"
   
   # 6. Test anonymous lists (HTTP polling)
   curl -X POST https://your-worker-url/api/anonymous/lists \
     -H "Content-Type: application/json" \
     -d '{"list_name":"Test Anonymous List"}'
   ```

**Tips Debugging:**
- Selalu cek logs worker dengan `wrangler tail`
- Test endpoint satu per satu
- Gunakan endpoint test untuk verifikasi komponen
- Pastikan semua bindings (DB, KV, JWT_SECRET) sudah benar

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