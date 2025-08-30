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
      "profile": {
        "id": "uuid",
        "userId": "uuid",
        "name": "Nama Opsional",
        "phone": null,
        "address": null
      }
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
  const res = await fetch("http://localhost:3000/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "User",
      email: "user@example.com",
      password: "secret",
    }),
  });
  const data = await res.json();
  localStorage.setItem("token", data.token);
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
  const res = await fetch("http://localhost:3000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@example.com", password: "secret" }),
  });
  const data = await res.json();
  localStorage.setItem("token", data.token);
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
  const token = localStorage.getItem("token");
  const res = await fetch("http://localhost:3000/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
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

  1. Verifikasi ID token ke Google (audience = `GOOGLE_CLIENT_ID`)
  2. Ambil payload: `sub` (googleId), `email`, `name`, `picture`
  3. Cari user by `googleId` atau `email`
  4. Jika belum ada → create user (provider="google") + profile
  5. Jika ada by email tapi belum terhubung Google (dan provider manual) → sesuai kebijakan profesional, JANGAN auto-link (lihat bagian Linking Akun)
  6. Generate JWT (`{ id, email, provider }`, expired contoh `7d`)
  7. Kembalikan `{ message, token, user }`

- Contoh cURL:
  ```bash
  curl -X POST http://localhost:3000/auth/google \
    -H "Content-Type: application/json" \
    -d '{"token":"<ID_TOKEN>"}'
  ```

#### Cara mendapatkan ID Token (untuk tes cepat)

- OAuth Playground: `https://developers.google.com/oauthplayground/`
  1. Klik Options (ikon gear) → centang "Use your own OAuth credentials" → isi Web Client ID & Secret
  2. Pastikan redirect URI `https://developers.google.com/oauthplayground` sudah ditambahkan di OAuth Client (Google Cloud)
  3. Step 1: input scopes `openid email profile` → Authorize
  4. Step 2: Exchange → salin "ID token"

---

## Contoh Penggunaan di Web

### Register & Login (fetch)

```js
// Register
await fetch("http://localhost:3000/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "User",
    email: "user@example.com",
    password: "secret",
  }),
});

// Login
const loginRes = await fetch("http://localhost:3000/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "user@example.com", password: "secret" }),
});
const loginData = await loginRes.json();
localStorage.setItem("token", loginData.token);

// Ambil profil
const meRes = await fetch("http://localhost:3000/auth/me", {
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
const me = await meRes.json();
```

### Login Google (Web fetch, ID token dari Playground)

```js
await fetch("http://localhost:3000/auth/google", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: "<ID_TOKEN>" }),
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

---

## Dokumentasi Produk & Kategori

Semua endpoint di bawah ini berada pada base URL yang sama seperti auth (contoh: `http://localhost:3000`). Header auth menggunakan `Authorization: Bearer <JWT>` jika ditandai (auth required). Role seller dibutuhkan pada sebagian besar endpoint produk milik seller.

### Kategori

#### 1) GET Categories

- URL: `GET /product/categories`
- Auth: tidak perlu
- Respons (200):

```json
{
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "name": "Minuman",
      "icon": "...",
      "color": "#...",
      "image": "https://...",
      "product_count": 10,
      "subcategories": [
        {
          "id": "uuid",
          "name": "Teh",
          "image": "...",
          "product_count": 3,
          "categoryId": "uuid"
        }
      ]
    }
  ]
}
```

#### 2) POST Category

- URL: `POST /product/categories/post`
- Auth: tidak perlu (sesuaikan kebijakan Anda di produksi)
- Body JSON:

```json
{
  "name": "Minuman",
  "icon": "mdi-tea",
  "color": "#00aa88",
  "image": "https://.../minuman.jpg",
  "subcategories": [
    { "name": "Teh", "image": "https://.../teh.jpg" },
    { "name": "Kopi", "image": "https://.../kopi.jpg" }
  ]
}
```

- Respons (201):

```json
{ "message": "Category created", "data": { "id": "uuid", "name": "Minuman", "subcategories": [ ... ] } }
```

---

## Produk (Seller)

Model `ProductSeller` (ringkas):

- Identitas: `name`, `sku` (unik), `description`
- Harga & promo: `price Decimal(10,2)`, `discountPercent Int(0..100)`
- Kategori: `categoryId?`, `subcategoryId?` (atau lookup via `categoryName`)
- Atribut: `weightGram`, `packaging`, `expiresAt`, `storageInstructions`
- Stock & order: `stock`, `minOrder`, `maxOrder?`
- Media & meta: `images[]` (juga `image?` untuk kompatibilitas), `flavors[]`, `ingredients[]`, `tags[]`
- Sosial & rating: `likesCount`, `averageRating`, `ratingCount`

> Catatan: pembuatan/ubah produk mengatur ulang counter kategori/subkategori secara transaksional.

### 1) POST Create Product (versi lengkap)

- URL: `POST /product`
- Auth: required (seller)
- Body JSON (contoh):

```json
{
  "name": "Teh Hijau Premium",
  "description": "Teh hijau organik",
  "sku": "THG-001",
  "price": 25000,
  "discountPercent": 10,
  "categoryName": "Minuman",
  "subcategory": "Snack",
  "images": ["https://.../1.jpg", "https://.../2.jpg"],
  "weightGram": 200,
  "packaging": "pouch",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "storageInstructions": "Simpan di tempat sejuk",
  "stock": 100,
  "minOrder": 1,
  "maxOrder": 10,
  "flavors": ["Original", "Mint"],
  "ingredients": ["Daun teh hijau"],
  "tags": ["teh", "organik"]
}
```

- Validasi penting: `price>=0`, `0<=discountPercent<=100`, `minOrder>=1`, `maxOrder>=minOrder`, `weightGram>=0`. SKU unik.
- Respons (201): `{ "message": "Product created", "data": { ... } }`

Alternatif kategori:

- Gunakan `categoryId`/`subcategoryId` langsung atau `categoryName` untuk lookup otomatis (kategori atau subkategori pertama yang cocok).

### 2) PUT Update Product

- URL: `PUT /product/:id`
- Auth: required (seller, harus pemilik produk)
- Body JSON (opsional, field yang diisi akan diupdate):

```json
{
  "name": "Teh Hijau Premium",
  "description": "Teh hijau organik",
  "sku": "THG-001",
  "price": 25000,
  "discountPercent": 10,
  "categoryName": "Minuman",
  "subcategory": "Snack",
  "images": ["https://.../1.jpg", "https://.../2.jpg"],
  "weightGram": 200,
  "packaging": "pouch",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "storageInstructions": "Simpan di tempat sejuk",
  "stock": 100,
  "minOrder": 1,
  "maxOrder": 10,
  "flavors": ["Original", "Mint"],
  "ingredients": ["Daun teh hijau"],
  "tags": ["teh", "organik"]
}
```

- Efek: Jika kategori berubah, counter kategori/subkategori disesuaikan.
- Respons (200): `{ "message": "Product updated", "data": { ... } }`

### 3) DELETE Product

- URL: `DELETE /product/:id`
- Auth: required (seller, harus pemilik produk)
- Efek: Hapus produk dan perbarui counter kategori/subkategori.
- Respons (200): `{ "message": "Product deleted" }`

### 4) GET List Products (milik seller login)

- URL: `GET /get/product/?page=1&pageSize=10&q=teh&categoryId=...&subcategoryId=...`
- Auth: required (seller)
- Query:
  - `page` (default 1), `pageSize` (default 10)
  - `q` (search pada `name`/`description`)
  - `categoryId`, `subcategoryId`
- Respons (200):

```json
{
  "message": "Products retrieved",
  "data": [ { "id": "uuid", "name": "Teh Hijau Premium", "category": { ... }, "subcategory": { ... } } ],
  "pagination": { "page": 1, "pageSize": 10, "total": 12, "totalPages": 2 }
}
```

### 5) GET Product Detail (milik seller login)

- URL: `GET /product/:id`
- Auth: required (seller)
- Respons (200): `{ "message": "Product detail", "data": { ... } }` (termasuk `category` dan `subcategory`).

---

## Like Produk

Mencatat like dari user pada produk dan menjaga `likesCount` di `ProductSeller` secara transaksional. Idempotent (like/unlike ganda aman).

### 1) Like Product

- URL: `POST /product/:id/like`
- Auth: required (user login)
- Efek: Jika belum like → create `ProductLike` + increment `likesCount`. Jika sudah like → no-op.
- Respons (200):

```json
{ "message": "Liked", "liked": true, "likesCount": 5 }
```

### 2) Unlike Product

- URL: `DELETE /product/:id/like`
- Auth: required (user login)
- Efek: Jika sudah like → delete `ProductLike` + decrement `likesCount` (tidak kurang dari 0). Jika belum like → no-op.
- Respons (200):

```json
{ "message": "Unliked", "liked": false, "likesCount": 4 }
```

---

## Produk Publik (Buyer/User)

### 1) GET List Produk Publik

- URL: `GET /products?page=1&pageSize=12&q=teh&categoryId=...&subcategoryId=...&hasStock=true&sort=createdAt|price|likes|rating&order=asc|desc`
- Auth: tidak perlu
- Respons (200):

```json
{
  "message": "Products retrieved",
  "data": [
    {
      "id": "uuid",
      "name": "Teh Hijau Premium",
      "price": 25000,
      "discountPercent": 10,
      "images": ["https://.../1.jpg"],
      "image": "https://.../1.jpg",
      "likesCount": 3,
      "averageRating": 4.5,
      "ratingCount": 12,
      "stock": 100,
      "category": { "id": "uuid", "name": "Minuman" },
      "subcategory": { "id": "uuid", "name": "Teh" }
    }
  ],
  "pagination": { "page": 1, "pageSize": 12, "total": 100, "totalPages": 9 }
}
```

### 2) GET Detail Produk Publik

- URL: `GET /products/:id`
- Auth: tidak perlu
- Respons (200):

```json
{
  "message": "Product detail",
  "data": {
    "id": "uuid",
    "name": "Teh Hijau Premium",
    "description": "...",
    "sku": "THG-001",
    "price": 25000,
    "discountPercent": 10,
    "images": ["https://.../1.jpg", "https://.../2.jpg"],
    "flavors": ["Original", "Mint"],
    "ingredients": ["Daun teh hijau"],
    "tags": ["teh", "organik"],
    "weightGram": 200,
    "packaging": "pouch",
    "expiresAt": "2026-01-01T00:00:00.000Z",
    "storageInstructions": "Simpan di tempat sejuk",
    "stock": 100,
    "minOrder": 1,
    "maxOrder": 10,
    "likesCount": 3,
    "averageRating": 4.5,
    "ratingCount": 12,
    "category": { "id": "uuid", "name": "Minuman" },
    "subcategory": { "id": "uuid", "name": "Teh" }
  }
}
```

## 3) GET List Liked Product(Buyer/Seller)

- URL: `GET /v1/get/preferred/products/:number
- Auth: tidak perlu
- Respons (200)

```json
{
    "message": "List of most liked products",
    "data": [
        {
            "id": "39c18a90-1ba1-4b04-9285-76c50d3e73f1",
            "name": "Teh merah mantap banget",
            "description": "Teh hijau organik",
            "sku": "THG-20",
            "price": "25000",
            "discountPercent": 10,
            "categoryId": "d257e74d-4f04-419c-af0d-69d54aebd07c",
            "subcategoryId": null,
            "sellerProfileId": "c1a79feb-41d8-429b-8ad8-96029aeea05a",
            "weightGram": 200,
            "packaging": "pouch",
            "expiresAt": "2026-01-01T00:00:00.000Z",
            "storageInstructions": "Simpan di tempat sejuk",
            "stock": 100,
            "minOrder": 1,
            "maxOrder": 10,
            "images": [
                "https://.../1.jpg",
                "https://.../2.jpg"
            ],
            "flavors": [
                "Original",
                "Mint"
            ],
            "ingredients": [
                "Daun teh hijau"
            ],
            "tags": [
                "teh",
                "organik"
            ],
            "likesCount": 100,
            "averageRating": 0,
            "ratingCount": 0,
            "createdAt": "2025-08-30T05:26:52.996Z",
            "updatedAt": "2025-08-30T05:26:52.996Z"
        },
        {
            "id": "f6d6346c-efcd-417a-bed8-5ded27f6a8f9",
            "name": "Teh Hijau Premium",
            "description": "Teh hijau organik",
            "sku": "THG-001",
            "price": "25000",
            "discountPercent": 10,
            "categoryId": "d257e74d-4f04-419c-af0d-69d54aebd07c",
            "subcategoryId": null,
            "sellerProfileId": "93924128-4f6c-4f7d-b234-e63c0069004d",
            "weightGram": 200,
            "packaging": "pouch",
            "expiresAt": "2026-01-01T00:00:00.000Z",
            "storageInstructions": "Simpan di tempat sejuk",
            "stock": 100,
            "minOrder": 1,
            "maxOrder": 10,
            "images": [
                "https://.../1.jpg",
                "https://.../2.jpg"
            ],
            "flavors": [
                "Original",
                "Mint"
            ],
            "ingredients": [
                "Daun teh hijau"
            ],
            "tags": [
                "teh",
                "organik"
            ],
            "likesCount": 0,
            "averageRating": 0,
            "ratingCount": 0,
            "createdAt": "2025-08-28T14:43:34.595Z",
            "updatedAt": "2025-08-28T14:43:34.595Z"
        },
    ]
}

```

---

## Catatan Implementasi

- Semua operasi tulis kritikal memakai transaksi Prisma (`prisma.$transaction`).
- Beberapa endpoint memerlukan role seller via middleware `requireSeller` dan auth via `authMiddleware`.
- `sku` unik di `ProductSeller`; konflik akan mengembalikan 409 di POST create.
- Counter kategori (`product_count`) dihitung ulang saat create/delete dan saat pindah kategori/subkategori.
