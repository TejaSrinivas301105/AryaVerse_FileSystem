# Cloud Core Backend

Node.js/Express REST API for authentication, file uploads, folder management, access requests, approval workflows, and audit logging using Supabase (PostgreSQL + Storage + Auth).

## Tech Stack

- Language: JavaScript (ESM) on Node.js
- Framework: Express 5
- Database: Supabase Postgres
- Object Storage: Supabase Storage (`files` bucket)
- Authentication: Supabase Auth JWT validation
- Email: Nodemailer (SMTP, Lark-compatible)
- File Upload Handling: Multer (memory storage)
- Rate Limiting: `express-rate-limit`

## Getting Started

### 1. Prerequisites

- Node.js 20+ recommended
- npm 10+ or pnpm 10+ recommended
- A Supabase project
- SMTP mailbox credentials if email notifications are needed

### 2. Install dependencies

npm:

```bash
cd Backend
npm install
```

pnpm:

```bash
cd Backend
pnpm install
```

### 3. Configure environment

Create `Backend/.env` from `Backend/.env.example`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

EMAIL=your-email@your-domain.com
PASSWORD=your-imap-smtp-password

SMTP_HOST=smtp.larksuite.com
SMTP_PORT=465
SMTP_SECURE=true
EMAIL_FROM=your-email@your-domain.com

FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173,https://beingcosmic.com,https://www.beingcosmic.com
```

Environment notes:

- CORS allowlist defaults already include `http://localhost:5173`, `https://beingcosmic.com`, and `https://www.beingcosmic.com`.
- `FRONTEND_URLS` (recommended) accepts comma-separated origins to extend/override allowlist behavior.
- `FRONTEND_URL` is still supported as a legacy single-origin override.
- For Lark SMTP:
- host: `smtp.larksuite.com`
- SSL port: `465` with `SMTP_SECURE=true`
- STARTTLS port: `587` with `SMTP_SECURE=false`
- `EMAIL` and `PASSWORD` should be the SMTP login credentials for your sending mailbox.
- `EMAIL_FROM` is the visible sender address in outbound notifications.

Variable usage in code:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase client initialization in `src/config/supabase.js`
- `EMAIL`, `PASSWORD`: SMTP auth credentials in `src/util/Email_notify.js`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM`: SMTP transport setup (defaults to Lark SMTP host if unset)
- `FRONTEND_URLS` / `FRONTEND_URL`: CORS allowlist inputs in `index.js`

### 3.1 Vercel Environment Variables (Production)

When deployed on Vercel, add these variables in Project Settings -> Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL`
- `PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `EMAIL_FROM`
- `FRONTEND_URLS` (recommended)
- `FRONTEND_URL` (legacy)

### 4. Initialize database

Run the migrations in order:

1. `migrations/20260419114328_init_cloud_core_schema.sql`
2. `migrations/20260419120310_optimize_rls_and_fk_indexes.sql`

`src/Schema.sql` mirrors that migration and is kept as a readable schema reference.

This creates:

- Core tables (`users`, `folders`, `files`, `access_requests`, `file_access`, `audit_logs`)
- RLS policies
- SQL helper functions (`is_admin`, `has_file_access`)
- Trigger `on_auth_user_created` to sync `auth.users` into `public.users`

### 5. Run locally

npm:

```bash
npm run dev
```

pnpm:

```bash
pnpm dev
```

API base URL: `http://localhost:3000`.

## Architecture

### Project Structure

```text
Backend/
├── index.js                          # App bootstrap, CORS, JSON parser, rate limits
└── src/
	├── config/supabase.js            # Supabase service-role client
	├── Routes/File_upload.js         # Route map
	├── MiddleWares/File_Auth_middle.js
	│                                 # JWT auth + admin role middleware
	├── Controllers/Auth_control.js   # Register/login handlers
	├── Controllers/File_System_control.js
	│                                 # Upload, access flow, folders, listing, deletion
	├── util/Email_notify.js          # Notification email helpers
	└── Schema.sql                    # Database schema + RLS + trigger
```

### API Design Pattern

- Pattern: REST over HTTP JSON
- Base path: `/api`
- Transport:
- JSON for most endpoints
- `multipart/form-data` for `/api/upload`

Route categories:

- Public auth: `POST /api/register`, `POST /api/login`
- Admin-only: upload, folder management, request moderation, file delete
- Authenticated (admin + employee): list files, request access, access file

### Authentication and Authorization Flow

1. Client logs in with `/api/login` and receives `access_token`, `role`, `user_id`.
2. Client sends `Authorization: Bearer <token>` on protected routes.
3. `authenticate` middleware validates token via `supabase.auth.getUser(token)`.
4. `adminOnly` middleware loads role from `users` table and enforces admin-only access.
5. For file access:
- Admins can access any file.
- Employees must have an unexpired record in `file_access`.

### Data Models

- `users`: application users with `role` (`admin` or `employee`)
- `folders`: logical grouping for uploaded files
- `files`: metadata and public storage URL for uploaded files
- `access_requests`: employee requests with `pending/approved/rejected` status
- `file_access`: time-bound grants per `user_id` + `file_id` with `expires_at`
- `audit_logs`: immutable access activity records

### Operational Behaviors

- Upload limits: up to 100 files/request, 100MB/file (Multer limits)
- Rate limiting:
- `/api/login`, `/api/register`: 10 requests / 15 minutes / IP
- `/api/upload`: 20 requests / 10 minutes / IP
- other `/api/*`: 100 requests / minute / IP
- Notifications:
- admin notified on new request
- employee notified on approval/rejection
