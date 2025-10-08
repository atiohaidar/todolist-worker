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

## Flow Lengkap Authentication

1. **Register**: User daftar, password di-hash dengan bcrypt
2. **Login**: Verifikasi password, generate JWT jika valid
3. **Access Protected Route**: Kirim JWT di header
4. **Server Verify**: Check signature dan expiration
5. **Response**: Return data atau error

JWT membuat authentication menjadi simple dan scalable untuk aplikasi modern!</content>
<parameter name="filePath">/workspaces/todolist-worker/Konsep-JWT.md
