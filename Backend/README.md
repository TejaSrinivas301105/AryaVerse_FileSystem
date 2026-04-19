# AryVerse File Management System — Backend

A production-ready REST API for a company data center built with **Node.js + Express + Supabase**. Supports role-based access control, time-bound file permissions, folder management, email notifications, rate limiting, and audit logging.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Express v5 |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Auth | Supabase JWT |
| Email | Nodemailer (Gmail) |
| Process Manager | PM2 |
| Rate Limiting | express-rate-limit |
| File Handling | Multer (memory storage) |

---

## Project Structure

```
Backend/
├── index.js                        # Entry point, CORS, rate limiting
├── src/
│   ├── config/
│   │   └── supabase.js             # Supabase client (service role)
│   ├── Controllers/
│   │   ├── Auth_control.js         # Register, Login
│   │   └── File_System_control.js  # All file/folder operations
│   ├── MiddleWares/
│   │   └── File_Auth_middle.js     # JWT auth + admin role guard
│   ├── Routes/
│   │   └── File_upload.js          # All route definitions
│   ├── util/
│   │   └── Email_notify.js         # Email notification helpers
│   └── Schema.sql                  # Full DB schema + RLS policies
├── .env                            # Environment variables (never commit)
├── .env.example                    # Template for environment variables
├── ecosystem.config.cjs            # PM2 config
└── deploy.sh                       # Automated Ubuntu deploy script
```

---

## Environment Variables

Create a `.env` file in the `Backend/` folder:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

EMAIL=your-email@gmail.com
PASSWORD=your-gmail-app-password

FRONTEND_URL=http://your-server-ip-or-domain
```

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `EMAIL` | Your Gmail address |
| `PASSWORD` | Gmail → Manage Account → Security → App Passwords |
| `FRONTEND_URL` | Your frontend URL e.g. `http://103.x.x.x` or `https://yourdomain.com` |

---

## Database Setup

Run once in Supabase SQL Editor:

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project → SQL Editor → New Query
3. Paste the full contents of `src/Schema.sql`
4. Click Run

This creates all tables, RLS policies, helper functions, and the auth trigger.

### Tables

| Table | Purpose |
|---|---|
| `users` | Synced from Supabase Auth, stores role (admin/employee) |
| `folders` | Folder metadata created by admins |
| `files` | File metadata — name, URL, folder, uploader |
| `access_requests` | Employee requests for file access (pending/approved/rejected) |
| `file_access` | Active time-bound access grants per user per file |
| `audit_logs` | Every file access event logged with timestamp |

---

## API Reference

### Auth Routes — No token required

| Method | Route | Body | Description |
|---|---|---|---|
| POST | `/api/register` | `{ email, password, role }` | Register new user. Role must be `employee` |
| POST | `/api/login` | `{ email, password }` | Login. Returns `access_token`, `role`, `user_id` |

---

### Admin Routes — Requires Bearer token + admin role

| Method | Route | Body / Params | Description |
|---|---|---|---|
| POST | `/api/upload` | `multipart/form-data` — `files[]`, `folder_id?`, `relative_paths?` | Upload up to 100 files. Supports folder upload with subfolder structure |
| POST | `/api/folder` | `{ folder_name }` | Create a new folder |
| GET | `/api/folders` | — | List all folders |
| GET | `/api/requests` | — | Get all pending access requests |
| POST | `/api/approve` | `{ request_id, duration_ms }` | Approve access request with time limit |
| POST | `/api/reject` | `{ request_id }` | Reject access request |
| DELETE | `/api/file` | `{ file_id }` | Delete file from storage + database |

---

### Employee + Admin Routes — Requires Bearer token

| Method | Route | Body / Params | Description |
|---|---|---|---|
| GET | `/api/all-files` | `?page=1&limit=20` | List all files with pagination (max 50 per page) |
| GET | `/api/my-files` | — | List files the employee currently has active access to |
| POST | `/api/request-access` | `{ file_id }` | Request access to a file |
| POST | `/api/access-file` | `{ file_id }` | View a file (checks access, logs to audit) |

---

## Rate Limiting

| Route | Limit | Window |
|---|---|---|
| `/api/login`, `/api/register` | 10 requests | 15 minutes |
| `/api/upload` | 20 requests | 10 minutes |
| All other `/api/*` routes | 100 requests | 1 minute |

Exceeding the limit returns `429 Too Many Requests`.

---

## File Upload Rules

- Max file size: **100MB per file**
- Max files per request: **100 files**
- Allowed types: PDF, Word, Excel, PowerPoint, CSV, TXT, JPEG, PNG, GIF, WebP, SVG, MP4, WebM, OGG, MP3, WAV, ZIP
- File names are sanitized — special characters replaced with `_`
- Folder uploads preserve top-level folder name and auto-create it in DB

---

## Security Features

- All routes (except login/register) require a valid Supabase JWT
- Admin-only routes additionally verify role from the `users` table
- Service role key used server-side only — never exposed to frontend
- Row Level Security (RLS) enabled on all Supabase tables
- CORS restricted to `FRONTEND_URL` only
- File type validated by MIME type (not just extension)
- Path traversal prevented by filename sanitization

---

## Local Development

```bash
# Install dependencies
npm install

# Start with hot reload
npm run dev
```

Server runs on `http://localhost:3000`

---

## Ubuntu Production Deployment

### Option 1 — Automated

```bash
# From your Windows machine, copy project to server
scp -r ./File_Management user@your-server-ip:/home/user/

# SSH into server
ssh user@your-server-ip

cd /home/user/File_Management/Backend

# Setup environment
cp .env.example .env
nano .env        # fill in real values

# Run deploy script
chmod +x deploy.sh
./deploy.sh
```

### Option 2 — Manual

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install dependencies
npm install --omit=dev

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## PM2 Commands

```bash
pm2 status                      # check running processes
pm2 logs file-management        # live logs
pm2 restart file-management     # restart app
pm2 stop file-management        # stop app
pm2 reload file-management      # zero-downtime reload
```

---

## Testing with Postman

### 1. Login and get token
```
POST /api/login
Body: { "email": "admin@company.com", "password": "yourpassword" }
```
Copy `access_token` from response.

### 2. Set Authorization header on all subsequent requests
```
Authorization: Bearer <access_token>
```

### 3. Example — Approve an access request
```
POST /api/approve
Body: { "request_id": "uuid-here", "duration_ms": 86400000 }
```

### duration_ms values
| Value | Duration |
|---|---|
| `3600000` | 1 Hour |
| `86400000` | 1 Day |
| `604800000` | 1 Week |

---

## Email Notifications

Emails are sent automatically on these events:

| Event | Recipient | Trigger |
|---|---|---|
| New access request | All admins | Employee requests file access |
| Access approved | Employee | Admin approves request |
| Access rejected | Employee | Admin rejects request |

Uses Gmail SMTP. Requires a Gmail App Password (not your regular Gmail password).
To generate: Gmail → Manage Account → Security → 2-Step Verification → App Passwords.
