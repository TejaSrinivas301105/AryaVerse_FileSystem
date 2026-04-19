# Cloud Core Frontend

React single-page application for login/register and role-based dashboards (admin and employee) in the file management system.

## Tech Stack

- Runtime: Node.js
- Build Tool: Vite 8
- UI Library: React 19
- Routing: `react-router-dom` 7 with `BrowserRouter`
- State Management: React Context (`AuthContext`) + local component state (`useState`/`useEffect`)
- HTTP/API Integration: Browser `fetch` with centralized API helpers in `src/api.js`
- Linting: ESLint 9

## Getting Started

### 1. Prerequisites

- Node.js 20+ recommended
- npm 10+ or pnpm 10+ recommended
- Backend API running locally at `http://localhost:3000` (default expectation)

### 2. Install dependencies

npm:

```bash
cd Frontend
npm install
```

pnpm:

```bash
cd Frontend
pnpm install
```

### 3. Environment variables

No frontend `.env` variables are required in the current implementation.

Why: API calls use a fixed base path (`/api`) in `src/api.js`, and Vite dev server proxies `/api` to `http://localhost:3000` via `vite.config.js`.

### 4. Run locally

npm:

```bash
npm run dev
```

pnpm:

```bash
pnpm dev
```

App will run on `http://localhost:5173`.

### 5. Production build

npm:

```bash
npm run build
npm run preview
```

pnpm:

```bash
pnpm build
pnpm preview
```

Build output directory: `dist/`.

## Architecture

### Folder Structure

```text
Frontend/
├── index.html
├── vite.config.js
└── src/
	├── main.jsx                # React bootstrap
	├── App.jsx                 # Top-level router + protected routes
	├── AuthContext.jsx         # Auth context/provider (token/role/userId)
	├── api.js                  # API functions for backend endpoints
	├── pages/
	│   ├── Login.jsx
	│   ├── Register.jsx
	│   ├── AdminDashboard.jsx
	│   └── EmployeeDashboard.jsx
	├── App.css
	└── index.css
```

### Routing Strategy

- `App.jsx` defines route map:
- `/` -> Login
- `/register` -> Register
- `/admin` -> Admin dashboard (requires role `admin`)
- `/employee` -> Employee dashboard (requires role `employee`)

Route protection is handled by `ProtectedRoute`, which checks `token` and `role` from `AuthContext` and redirects unauthorized users to `/`.

### State Management Choices

- Global auth state is stored in `AuthContext`:
- `token`, `role`, `userId`
- `saveAuth()` persists credentials to `localStorage`
- `logout()` clears storage and in-memory state

- Page-level UI state (tables, pagination, loading, messages, previews) is handled with component-local hooks.

This keeps authentication shared across all routes while keeping feature-specific state isolated to each dashboard.

### API Integration Pattern

- All HTTP calls are centralized in `src/api.js`.
- Authenticated requests attach `Authorization: Bearer <token>`.
- A shared response handler clears session and redirects to login on `401`.
- Frontend talks to backend through `/api/*` paths for both local dev and reverse-proxy deployments.
