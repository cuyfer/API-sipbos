## Dokumentasi Autentikasi (Express + Prisma + JWT + Google)

Dokumen ini menjelaskan cara memakai API autentikasi pada backend ini, mulai dari register, login manual, ambil profil (`/auth/me`), hingga login dengan Google (mobile flow / Flutter), beserta contoh penggunaan di Web dan Flutter.

### Persiapan
- Stack: Node.js + Express + Prisma (PostgreSQL) + jsonwebtoken + google-auth-library
- File penting:
  - `index.js` (mount route `/auth`)
  - `src/route/auth.routes.js` (semua endpoint auth)
  - `src/utils/prisma.js` (PrismaClient)
  - `src/utils/jwt.js` (generate/verify JWT)
  - `prisma/schema.prisma` (skema User, Profile)

### Environment variables (.env)
Tambahkan contoh variabel berikut di file `.env` root:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public
JWT_SECRET=your-very-strong-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
PORT=3000
```

Jalankan server:
```
npm run dev
```

Base URL default: `http://localhost:3000`
Semua route auth di-mount di prefix `/auth`.

---

## Endpoint

### 1) Register Manual
- URL: `POST /auth/register`
- Body JSON:
  ```json
  {
    "name": "Nama Opsional",
    "email": "user@example.com",
    "password": "your-password"
  }
  ```
- Respons sukses (201):
  ```json
  {
    "message": "Registration successful",
    "token": "<jwt>",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "profile": { "id": "uuid", "userId": "uuid", "name": "Nama Opsional", "phone": null, "address": null }
    }
  }
  ```
- Contoh cURL:
  ```bash
  curl -X POST http://localhost:3000/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name":"User","email":"user@example.com","password":"secret"}'
  ```
- Contoh Web (fetch):
  ```js
  const res = await fetch('http://localhost:3000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User', email: 'user@example.com', password: 'secret' })
  });
  const data = await res.json();
  localStorage.setItem('token', data.token);
  ```

### 2) Login Manual
- URL: `POST /auth/login`
- Body JSON:
  ```json
  { "email": "user@example.com", "password": "secret" }
  ```
- Respons sukses (200): sama formatnya seperti register (berisi `token` dan `user`).
- Contoh cURL:
  ```bash
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"secret"}'
  ```
- Contoh Web (fetch):
  ```js
  const res = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'secret' })
  });
  const data = await res.json();
  localStorage.setItem('token', data.token);
  ```

### 3) Ambil Profil (Me)
- URL: `GET /auth/me`
- Header: `Authorization: Bearer <token>`
- Respons sukses (200):
  ```json
  { "user": { "id": "uuid", "email": "user@example.com", "profile": { ... } } }
  ```
- Contoh cURL:
  ```bash
  curl http://localhost:3000/auth/me \
    -H "Authorization: Bearer <JWT>"
  ```
- Contoh Web (fetch):
  ```js
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3000/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  ```

### 4) Login dengan Google (Mobile Flow / Flutter)
- Flow: Frontend (Flutter) mengambil Google ID token, lalu kirim ke backend.
- URL: `POST /auth/google`
- Body JSON:
  ```json
  { "token": "<idToken-dari-Google>" }
  ```
- Backend akan:
  1) Verifikasi ID token ke Google (audience = `GOOGLE_CLIENT_ID`)
  2) Ambil payload: `sub` (googleId), `email`, `name`, `picture`
  3) Cari user by `googleId` atau `email`
  4) Jika belum ada → create user (provider="google") + profile
  5) Jika ada by email tapi belum terhubung Google (dan provider manual) → sesuai kebijakan profesional, JANGAN auto-link (lihat bagian Linking Akun)
  6) Generate JWT (`{ id, email, provider }`, expired contoh `7d`)
  7) Kembalikan `{ message, token, user }`

- Contoh cURL:
  ```bash
  curl -X POST http://localhost:3000/auth/google \
    -H "Content-Type: application/json" \
    -d '{"token":"<ID_TOKEN>"}'
  ```

#### Cara mendapatkan ID Token (untuk tes cepat)
- OAuth Playground: `https://developers.google.com/oauthplayground/`
  1) Klik Options (ikon gear) → centang "Use your own OAuth credentials" → isi Web Client ID & Secret
  2) Pastikan redirect URI `https://developers.google.com/oauthplayground` sudah ditambahkan di OAuth Client (Google Cloud)
  3) Step 1: input scopes `openid email profile` → Authorize
  4) Step 2: Exchange → salin "ID token"

---

## Contoh Penggunaan di Web

### Register & Login (fetch)
```js
// Register
await fetch('http://localhost:3000/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'User', email: 'user@example.com', password: 'secret' })
});

// Login
const loginRes = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'secret' })
});
const loginData = await loginRes.json();
localStorage.setItem('token', loginData.token);

// Ambil profil
const meRes = await fetch('http://localhost:3000/auth/me', {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});
const me = await meRes.json();
```

### Login Google (Web fetch, ID token dari Playground)
```js
await fetch('http://localhost:3000/auth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: '<ID_TOKEN>' })
});
```

---

## Contoh Penggunaan di Flutter

### Register & Login biasa (http)
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

const baseUrl = 'http://10.0.2.2:3000'; // Android emulator; iOS simulator bisa 'http://localhost:3000'

Future<void> register() async {
  final res = await http.post(
    Uri.parse('$baseUrl/auth/register'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'name': 'User',
      'email': 'user@example.com',
      'password': 'secret',
    }),
  );
  print(res.body);
}

Future<String?> login() async {
  final res = await http.post(
    Uri.parse('$baseUrl/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'email': 'user@example.com',
      'password': 'secret',
    }),
  );
  final data = jsonDecode(res.body);
  return data['token'];
}

Future<void> me(String token) async {
  final res = await http.get(
    Uri.parse('$baseUrl/auth/me'),
    headers: { 'Authorization': 'Bearer $token' },
  );
  print(res.body);
}
```

### Login dengan Google (google_sign_in)
```dart
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

final googleSignIn = GoogleSignIn(
  scopes: ['openid', 'email', 'profile'],
  serverClientId: '<GOOGLE_CLIENT_ID_WEB>', // harus sama dengan backend
);

Future<void> loginWithGoogle() async {
  final account = await googleSignIn.signIn();
  final auth = await account?.authentication;
  final idToken = auth?.idToken; // ini yang dikirim ke backend

  final res = await http.post(
    Uri.parse('http://10.0.2.2:3000/auth/google'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'token': idToken}),
  );
  print(res.body);
}
```

Catatan:
- Android emulator gunakan `10.0.2.2`; iOS simulator boleh `localhost`.
- `serverClientId` wajib diisi dengan Web Client ID yang sama dengan `GOOGLE_CLIENT_ID` backend.

---

## Kebijakan Profesional: Linking Akun Google (Opsional Tambahan)
Agar aman dan rapi untuk skala besar:
- `email` tetap unik pada tabel `User`.
- Ketika login Google (`/auth/google`):
  - Jika ditemukan user by `email` dengan `provider = "manual"` dan `googleId` masih kosong → JANGAN auto-link. Kembalikan error:
    ```json
    {
      "message": "Email ini sudah digunakan untuk login manual. Silakan login manual atau hubungkan akun Google di pengaturan."
    }
    ```
- Linking dilakukan eksplisit lewat endpoint terproteksi JWT, misal `POST /auth/link/google`:
  - Header: `Authorization: Bearer <JWT>` (user sudah login manual)
  - Body: `{ token: "<idTokenGoogle>" }`
  - Validasi: email pada idToken harus sama dengan `user.email` di DB, `googleId` belum dipakai user lain.
  - Update user: set `googleId = sub`. Simpan `password` agar manual login tetap bisa (opsional revisi `provider`).
- Unlink (opsional): `POST /auth/unlink/google` → hanya izinkan jika user masih punya password.

---

## Troubleshooting
- 401 Invalid Google token:
  - `aud` pada ID token tidak sama dengan `GOOGLE_CLIENT_ID` backend, atau token expired.
- "Akses diblokir: Permintaan aplikasi ini tidak valid" saat di OAuth Playground:
  - Pastikan Client ID tipe Web; tambahkan redirect URI `https://developers.google.com/oauthplayground` pada OAuth Client.
  - Gunakan "Use your own OAuth credentials" dan scopes `openid email profile`.
- `idToken` null di Flutter:
  - Pastikan `serverClientId` diisi dengan Web Client ID.
- Pastikan `.env` tidak dibagikan dan secret kuat.

---

## Catatan Keamanan
- Simpan `JWT_SECRET` dan kredensial Google hanya di `.env`.
- Batasi rate request untuk endpoint auth (opsional).
- Hindari mengembalikan field sensitif seperti `password` di respons.
- Pertimbangkan audit log untuk event login, linking, unlinking (skala besar). 