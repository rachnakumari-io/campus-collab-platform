# Campus Connect

A student collaboration platform for finding teammates, asking for help, and sharing project opportunities. This repository contains a React/Vite frontend, an Express API, and a PostgreSQL schema managed with Prisma ORM 7.

Prisma 7 reads the connection URL from `server/prisma.config.ts`; the model schema stays in `server/prisma/schema.prisma`. The API uses Prisma's PostgreSQL driver adapter (`@prisma/adapter-pg`).

## MVP features

- Student registration, login, logout, and persistent HTTP-only cookie sessions
- Student profile creation and editing, plus a searchable student directory
- Explore posts for help requests, project teams, and hackathon teams
- Keyword, type, and skill filters; post detail and author profile views
- Create, edit, close, and reopen your own posts
- Send collaboration requests and manage received, sent, and withdrawn requests
- Shared skills catalogue with student suggestions and admin review

The client does not store authentication tokens in browser storage. College and enrollment information is self-reported in this local MVP; an email domain alone is not treated as proof of enrollment, and email verification is not implemented.

## Requirements

- Node.js 20.19+ (the installed Vite version needs a recent Node release)
- PostgreSQL 14+
- npm

## Local setup

### 1. Create the database

Start your local PostgreSQL service and use pgAdmin (or your preferred PostgreSQL tool) to create a database named `campus_collab`.

### 2. Configure the API

In a terminal, go into `server/` and copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Edit `server/.env` and set the password and username for your local PostgreSQL account. Set `JWT_SECRET` to a private random value of at least 32 characters. Keep `.env` private; it is ignored by Git.

Example shape (replace the values):

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/campus_collab?schema=public"
JWT_SECRET="your-private-random-secret-with-at-least-32-characters"
PORT=5000
CLIENT_ORIGIN="http://localhost:5173"
```

### 3. Install and initialize the API

```powershell
cd server
npm install
npm run prisma:generate
npm run db:push
npm run db:seed
```

`prisma:generate` creates the Prisma Client in `server/src/generated/prisma`. `db:push` creates or updates the local schema from `server/prisma/schema.prisma`. `db:seed` adds a small starter skill catalogue. It does not create fake student accounts or posts.

### 4. Start both applications

Open two terminals in the project:

```powershell
cd server
npm run dev
```

```powershell
cd client
npm install
npm run dev
```

Open the Vite address printed in the client terminal (normally `http://localhost:5173`). Vite forwards `/api` requests to the API on port 5000.

### 5. Create an administrator (optional)

Register a normal account first. To review skill suggestions, open a terminal in `server/`, run `npx prisma studio`, find your row in `Student`, and change its `role` from `STUDENT` to `ADMIN`. The application does not expose an endpoint for granting admin access.

## Development checks

From `client/`:

```powershell
npm run lint
npm run build
```

From `server/`:

```powershell
npm test
```

## API overview

All application routes are under `/api`. Auth routes are `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me`. Profile routes are `/profiles`, `/profiles/me`, and `/profiles/:id`. Post routes include `GET /posts`, `GET /posts/mine`, `GET /posts/:id`, `POST /posts`, `PATCH /posts/:id`, and `PATCH /posts/:id/status`. Collaboration requests use `/requests`, `/requests/sent`, `/requests/received`, and `PATCH /requests/:id/status`. Skills use `/skills` and `/skills/suggestions`; admin review routes are under `/admin/skills/suggestions`.

Passwords are hashed with bcryptjs, request inputs are validated on the server, and post/request ownership is checked by the API. Public profile responses omit email addresses. The API limits login and registration attempts. Use HTTPS and a strong private `JWT_SECRET` for any deployment; the included configuration is intended for local development.
