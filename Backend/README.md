# File Management System

Secure file management system with role-based access control using Supabase.

## Local Development (Windows)

```bash
npm install
npm run dev
```

## Ubuntu Deployment

### Option 1 — Automated (recommended)

```bash
# 1. Transfer project to Ubuntu server (from your Windows machine)
scp -r ./File_Management user@your-server-ip:/home/user/

# 2. SSH into server
ssh user@your-server-ip

# 3. Go to project folder
cd /home/user/File_Management

# 4. Create .env from example
cp .env.example .env
nano .env   # fill in your real values

# 5. Run deploy script
chmod +x deploy.sh
./deploy.sh
```

### Option 2 — Manual step by step

```bash
# Install Node.js v22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install dependencies
npm install --omit=dev

# Start app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Database Setup (run once in Supabase SQL Editor)

1. Go to https://supabase.com/dashboard
2. Select your project → SQL Editor → New Query
3. Paste contents of `src/Schema.sql`
4. Click Run

## PM2 Commands

```bash
pm2 status                        # check if app is running
pm2 logs file-management          # view live logs
pm2 restart file-management       # restart app
pm2 stop file-management          # stop app
```

## API Endpoints

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | /api/upload | Admin | Upload file metadata |
| GET | /api/requests | Admin | Get pending access requests |
| POST | /api/approve | Admin | Approve access request |
| POST | /api/reject | Admin | Reject access request |
| POST | /api/request-access | Employee | Request file access |
| POST | /api/access-file | Employee | Access a file |
| GET | /api/my-files | Employee | List accessible files |

## Environment Variables

| Variable | Description |
|----------|-------------|
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Service role key from Supabase dashboard |
| EMAIL | Gmail address for notifications |
| PASSWORD | Gmail app password (not your Gmail login password) |
