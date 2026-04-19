# Cloud Core

Cloud Core is a role-based file management platform split into a React frontend and a Node.js/Express backend backed by Supabase.

## System Overview

High-level architecture:

- Frontend (`Frontend/`) is a React SPA built with Vite.
- Backend (`Backend/`) is a REST API built with Express.
- Data layer uses Supabase Postgres tables and Supabase Storage bucket (`files`).
- Auth uses Supabase Auth JWT tokens validated by backend middleware.

Interaction flow:

1. User logs in from frontend (`/api/login`).
2. Backend authenticates against Supabase and returns `access_token` + role.
3. Frontend stores token in `localStorage` through `AuthContext`.
4. Frontend sends authenticated requests to backend via `/api/*`.
5. Backend enforces role/access rules, queries Supabase, and returns JSON/file URLs.

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (URL + service role key)
- Gmail app password (if email notifications are enabled)

## Quick Start

From the repository root:

### 1. Install dependencies for both apps

```bash
npm --prefix Backend install
npm --prefix Frontend install
```

### 2. Configure backend environment

```bash
copy Backend\\.env.example Backend\\.env
```

Then edit `Backend/.env` with your Supabase and email values.

### 3. Initialize database schema

Run the SQL in `Backend/src/Schema.sql` inside Supabase SQL Editor.

### 4. Start backend and frontend

Use two terminals from the root:

Terminal 1:

```bash
npm --prefix Backend run dev
```

Terminal 2:

```bash
npm --prefix Frontend run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

## Repository Layout

```text
cloud-core/
├── Frontend/   # React + Vite SPA
├── Backend/    # Express REST API + Supabase integration
└── README.md
```

## Detailed Docs

- Frontend setup and architecture: `Frontend/README.md`
- Backend setup and architecture: `Backend/README.md`

## Vercel Deployment (Frontend)

This repository is configured for **frontend-only deployment on Vercel**. The backend should be deployed separately (for example: Render, Railway, Fly.io, VM, or another Vercel project reworked for serverless functions).

### Config file

`vercel.json` at the repo root defines:

- `buildCommand`: builds the Vite app from `Frontend/`
- `outputDirectory`: `Frontend/dist`
- rewrite `/api/:path*` to external backend domain
- rewrite all other routes to `/index.html` for SPA routing

### Required Vercel Environment Variables

For the current frontend codebase, **no environment variables are required for a successful Vercel build**.

Required in Vercel dashboard:

- None

### Deployment checklist

1. Set your backend public URL in `vercel.json` by replacing `https://YOUR_BACKEND_DOMAIN`.
2. Deploy this repository to Vercel.
3. Ensure backend CORS allows your Vercel frontend domain in `Backend/.env` (`FRONTEND_URL`).
