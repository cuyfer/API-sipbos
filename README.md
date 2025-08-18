# Backend SIP-BOS API

A simple Express + Prisma (PostgreSQL) API for authentication, categories, and seller products.

## Tech Stack
- Node.js, Express
- Prisma ORM, PostgreSQL
- JWT Authentication
- Google OAuth (optional)
- CORS enabled

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (connection string)

### Environment Variables (.env)
```
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
```

### Install & Run
```
npm install
npx prisma migrate dev
npx prisma generate
npm start
```

Server boot message: `🚀 Auth API is running...` at GET `/`.

Base path for routes:
- Auth routes: `/v1/auth`
- Product & Categories routes: `/v1`

## Authentication
- JWT required for protected endpoints.
- Header: `Authorization: Bearer <token>`
- Token is obtained from login/register endpoints.

Example header:
```
Authorization: Bearer eyJhbGciOi...
```

## Common Error Response
```
{
  "message": "<error message>"
}
```

---

## Endpoints

### Health
GET `/`  → returns a simple running message.

Example:
```
curl http://localhost:3000/
```

---

## Auth

### Register (Buyer)
POST `/v1/auth/register`

Body:
```
{
  "name": "John",
  "email": "john@example.com",
  "password": "secret123",
  "phoneNumber": "+62081234"
}
```

Response (201):
```
{
  "message": "Registration successful",
  "data": {
    "token": "<JWT>",
    "user": { "id": "...", "email": "...", "profile": { ... }, "role": "buyer" }
  }
}
```

### Register (Seller)
POST `/v1/auth/register/sel`

Body: same fields as buyer. Creates `SellerProfile` and sets role to `seller`.

### Login (Buyer)
POST `/v1/auth/login`

Body:
```
{ "email": "john@example.com", "password": "secret123" }
```

Response (200): returns JWT and user info.

### Google Login (Buyer)
POST `/v1/auth/google`

Body:
```
{ "token": "<google_id_token>" }
```

### Google Login (Seller)
POST `/v1/auth/google/sel`

Body:
```
{ "token": "<google_id_token>" }
```

### Get Current User
GET `/v1/auth/me`

Headers: `Authorization: Bearer <token>`

Response (200):
```
{ "user": { "id": "...", "email": "...", "profile": { ... } } }
```

---

## Categories

Notes:
- `Categories.product_count` is system-managed: it equals the number of products directly under the category PLUS the sum of `product_count` of all its subcategories.
- It is automatically recalculated whenever sellers create/update/delete products linked to the category or its subcategories. It cannot be set from requests.

### List Categories
GET `/v1/product/categories`

Response (200):
```
{
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": "...",
      "name": "...",
      "icon": "...",
      "color": "#RRGGBB",
      "image": "https://...",
      "product_count": 3,
      "subcategories": [ ... ]
    }
  ]
}
```

Example:
```
curl http://localhost:3000/v1/product/categories
```

### Create Category
POST `/v1/product/categories/post`

Body:
```
{
  "name": "Electronics",
  "icon": "device-mobile",
  "color": "#2196F3",
  "image": "https://.../electronics.png",
  "subcategories": [            // optional
    { "name": "Phones", "image": "https://..." }
  ]
}
```

Notes:
- Any `product_count` field provided will be ignored. The counter is system-managed (default 0).

Response (201): returns created category with subcategories.

---

## Products (Seller Only)

Notes:
- All endpoints below require JWT of a user with role `seller`.
- The product is linked to the seller via `SellerProfile` and to a taxonomy via `Categories` or `Subcategories`.
- On create/update with `categoryName`, the system searches by name (case-insensitive):
  1) tries `Categories.name`; if found → link to the category and recompute `Categories.product_count`.
  2) otherwise tries `Subcategories.name`; if found → increment `Subcategories.product_count` and recompute the parent `Categories.product_count`.
  3) if neither is found → 400 Bad Request.
- All counter updates and recomputations are executed atomically inside a transaction.

### Create Product
POST `/v1/product`

Headers:
```
Authorization: Bearer <JWT of seller>
Content-Type: application/json
```

Body:
```
{
  "name": "Premium Herbal Tea",
  "image": "https://.../tea.jpg",
  "description": "Natural herbal tea",
  "categoryName": "Beverages"
}
```

Responses:
- 201 Created → `{ "message": "Product created", "data": { ... } }`
- 400 Bad Request → if `name`/`categoryName` missing or taxonomy not found
- 403 Forbidden → if no seller profile or not a seller

### Update Product
PUT `/v1/product/:id`

Body (any field optional):
```
{
  "name": "Premium Herbal Tea 2",
  "image": "https://...",
  "description": "Updated desc",
  "categoryName": "Food & Drinks"
}
```

Behavior:
- If moved between category and subcategory (or between different ones), counters are adjusted and parent category totals are recomputed as needed.

Responses:
- 200 OK → `{ "message": "Product updated", "data": { ... } }`
- 404 Not Found → product does not exist
- 403 Forbidden → product is not owned by current seller
- 400 Bad Request → taxonomy name provided but not found

### Delete Product
DELETE `/v1/product/:id`

Behavior:
- If product belonged to a subcategory → decrement that subcategory and recompute its parent category total.
- If product belonged directly to a category → recompute that category total.

Responses:
- 200 OK → `{ "message": "Product deleted" }`
- 404 Not Found → product does not exist
- 403 Forbidden → product is not owned by current seller

---

## Database Schema Highlights

- `Categories`
  - `id`, `name`, `icon`, `color`, `image`, `product_count` (default 0)
  - Relations: `subcategories`, `products`
- `Subcategories`
  - `id`, `name`, `image`, `product_count` (default 0), `categoryId`
  - Back-relation: `products`
- `ProductSeller`
  - `id`, `name`, `image`, `description`, `categoryId?`, `subcategoryId?`, `sellerProfileId`, timestamps
  - Linked either to a category OR a subcategory (app-level ensures one of them is set)
- `SellerProfile`
  - Seller-owned products via relation `products`

`product_count` semantics:
- Category total = direct products in the category + sum of all subcategories' `product_count`.
- Incremented on product create; decremented on product delete.
- On update: totals are adjusted when moving between taxonomy nodes.

---

## Migrations & Prisma

Development:
```
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

Deployment:
```
npx prisma migrate deploy
```

Quick introspect (when DB changed externally):
```
npx prisma db pull
npx prisma generate
```

> Warning: `npx prisma migrate reset` will DROP and recreate your DB (all data lost). Avoid in production.

---

## Notes
- CORS is enabled globally.
- Make sure to create both buyer and seller accounts according to your flow.
- Google OAuth endpoints require a valid `GOOGLE_CLIENT_ID`. 