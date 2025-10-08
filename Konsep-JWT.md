# Konsep JWT (JSON Web Token) pada TodoList App

## Apa itu JWT?

JWT singkatan dari **JSON Web Token**. Bayangkan JWT seperti sebuah "kartu identitas digital" yang diberikan kepada user setelah mereka login. Kartu ini berisi informasi tentang siapa user tersebut, dan bisa digunakan untuk mengakses fitur-fitur yang memerlukan authentication tanpa perlu login ulang setiap kali.

## Bagaimana JWT Bekerja?

### 1. Struktur JWT
JWT terdiri dari 3 bagian yang dipisahkan oleh titik (`.`):
- **Header**: Berisi informasi tentang algoritma enkripsi yang digunakan
- **Payload**: Berisi data user (seperti userId dan username)
- **Signature**: Tanda tangan digital untuk memastikan token tidak diubah

Contoh JWT: `eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdCJ9.signature`

### 2. Proses Authentication dengan JWT

#### Login Process:
1. User masukkan username dan password
2. Server verifikasi kredensial di database
3. Jika valid, server buat JWT token dengan data user
4. Token dikirim ke frontend dan disimpan di localStorage

#### Menggunakan Token:
1. Frontend kirim token di header `Authorization: Bearer <token>`
2. Server verify token dengan secret key
3. Jika valid, server tahu siapa user dan allow akses

## Implementasi JWT di Kode Ini

### 1. Generate JWT (`generateJWT`)
```typescript
export async function generateJWT(user: User, secret: string): Promise<string> {
  const jwt = new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h');
  return jwt.sign(new TextEncoder().encode(secret));
}
```

**Penjelasan:**
- Membuat token dengan data `userId` dan `username`
- Token berlaku selama 1 jam (`'1h'`)
- Ditandatangani dengan algoritma HS256 menggunakan `secret` key

### 2. Verify JWT (`verifyJWT`)
```typescript
export async function verifyJWT(token: string, secret: string): Promise<{ userId: number; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return { userId: payload.userId as number, username: payload.username as string };
  } catch {
    return null;
  }
}
```

**Penjelasan:**
- Memverifikasi tanda tangan token dengan `secret` key
- Jika valid, return data user dari payload
- Jika invalid (ditampered atau expired), return `null`

### 3. Penggunaan di Middleware
```typescript
app.use('/api/tasks/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  c.set('user', payload);
  await next();
});
```

**Penjelasan:**
- Semua request ke `/api/tasks/*` dicek token-nya
- Token diambil dari header `Authorization: Bearer <token>`
- Jika token valid, data user disimpan di context untuk digunakan di endpoint

## Keamanan JWT

### Keunggulan:
- **Stateless**: Server tidak perlu simpan session di memory/database
- **Secure**: Data ditandatangani, tidak bisa diubah tanpa secret key
- **Portable**: Bisa digunakan di multiple services

### Kerentanan:
- **Token Theft**: Jika token dicuri, attacker bisa akses sampai expired
- **No Revocation**: Tidak bisa invalidate token sebelum expired (kecuali implement refresh token)
- **Payload Visible**: Header dan payload bisa dibaca (tapi tidak diubah)

### Best Practices:
- Selalu gunakan HTTPS
- Set expiration time yang reasonable (1 jam di kode ini)
- Gunakan secret key yang kuat dan unik
- Implement refresh token untuk session panjang
- Store token securely di frontend (localStorage dengan caution)

## ⚠️ Bahaya JWT Token Tersebar

### Apa yang Terjadi Jika JWT Token Tersebar?

JWT token yang tersebar ke tangan yang salah bisa menyebabkan **kerugian serius** karena attacker bisa bertindak seolah-olah mereka adalah user yang sah. Berikut bahaya-bahayanya:

### 🚨 Risiko Keamanan Utama

1. **Akses Tidak Sah ke Akun**
   - Attacker bisa mengakses semua data dan fitur user
   - Melakukan perubahan pada akun (ubah password, hapus data, dll)

2. **Data Breach**
   - Membaca informasi sensitif user
   - Mengakses file lampiran pribadi

3. **Tindakan Destruktif**
   - Menghapus semua tugas user
   - Mengupload file berbahaya
   - Menyebarkan malware melalui lampiran

### 📋 Contoh Penyalahgunaan JWT Token

#### Skenario 1: Token Dicuri dari localStorage
```javascript
// Attacker menemukan token di browser developer tools
const stolenToken = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiam9obiJ9.signature";

// Attacker gunakan token untuk akses API
fetch('https://todolist-worker.atiohaidar.workers.dev/api/tasks', {
  headers: {
    'Authorization': `Bearer ${stolenToken}`
  }
})
.then(res => res.json())
.then(tasks => {
  console.log('Data user john berhasil dicuri:', tasks);
  // Attacker bisa hapus semua tasks
  tasks.forEach(task => {
    fetch(`https://todolist-worker.atiohaidar.workers.dev/api/tasks/${task.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${stolenToken}` }
    });
  });
});
```

**Dampak**: Semua tugas user "john" terhapus, data hilang selamanya.

#### Skenario 2: Token Tersebar Melalui Logs
```bash
# Jika aplikasi logging token (SALAH!)
console.log("User login with token:", jwtToken);
// Token muncul di server logs

# Attacker akses logs server
# Gunakan token untuk impersonate user
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." \
     https://todolist-worker.atiohaidar.workers.dev/api/tasks
```

#### Skenario 3: Man-in-the-Middle Attack
```javascript
// Jika tidak pakai HTTPS, attacker bisa intercept
// Token dikirim plain text melalui HTTP

// Attacker capture token dari network traffic
// Gunakan untuk akses berulang selama 1 jam
fetch('https://todolist-worker.atiohaidar.workers.dev/api/tasks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${capturedToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: "Tugas Jahat",
    description: "Ini tugas yang diupload attacker",
    attachments: ["malware.exe"]
  })
});
```

### 🔍 Cara Mendeteksi Penyalahgunaan

1. **Monitor Aktivitas Mencurigakan**
   - Login dari lokasi berbeda secara bersamaan
   - Akses API dari IP yang tidak biasa
   - Perubahan data yang tidak diinginkan

2. **Log Analysis**
   ```bash
   # Cek access logs untuk pola mencurigakan
   grep "api/tasks" access.log | grep -v "your-normal-ip"
   ```

### 🛡️ Cara Mencegah Penyalahgunaan JWT

#### 1. **HTTPS Wajib**
```javascript
// SELALU gunakan HTTPS
const API_BASE = 'https://todolist-worker.atiohaidar.workers.dev';
```

#### 2. **Jangan Log Token**
```javascript
// ❌ SALAH - jangan log token
console.log("Token:", token);

// ✅ BENAR - log tanpa expose token
console.log("User authenticated successfully");
```

#### 3. **Token Rotation**
```javascript
// Implement refresh token pattern
// Token akses pendek (15 menit), refresh token panjang (7 hari)
const accessToken = generateJWT(user, secret, '15m');
const refreshToken = generateJWT(user, refreshSecret, '7d');
```

#### 4. **Secure Storage di Frontend**
```javascript
// Gunakan httpOnly cookie untuk token sensitif
// Atau secure localStorage dengan encryption
const encryptedToken = encrypt(token, userKey);
localStorage.setItem('token', encryptedToken);
```

#### 5. **Token Blacklist**
```javascript
// Implement blacklist untuk token compromised
const blacklist = new Set();
app.use('/api/*', async (c, next) => {
  const token = getTokenFromHeader(c);
  if (blacklist.has(token)) {
    return c.json({ error: 'Token revoked' }, 401);
  }
  await next();
});
```

#### 6. **Rate Limiting**
```javascript
// Batasi jumlah request per menit
app.use('/api/*', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100 // maksimal 100 request
}));
```

#### 7. **Monitor dan Alert**
```javascript
// Alert jika ada aktivitas mencurigakan
if (loginAttempts > 5) {
  sendAlert(`Multiple failed login for user: ${username}`);
}
```

### 🎯 Kesimpulan

JWT sangat powerful untuk authentication modern, tapi **sangat berbahaya** jika jatuh ke tangan yang salah. Selalu:

- 🔒 Gunakan HTTPS
- ⏰ Set expiration pendek
- 🚫 Jangan log token
- 👀 Monitor aktivitas
- 🔄 Implement token rotation
- 📊 Rate limiting

**Ingat**: Token yang tersebar = akun yang compromised. Keamanan adalah prioritas utama! 🛡️

1. **Register**: User daftar, password di-hash dengan bcrypt
2. **Login**: Verifikasi password, generate JWT jika valid
3. **Access Protected Route**: Kirim JWT di header
4. **Server Verify**: Check signature dan expiration
5. **Response**: Return data atau error

JWT membuat authentication menjadi simple dan scalable untuk aplikasi modern!</content>
<parameter name="filePath">/workspaces/todolist-worker/Konsep-JWT.md
