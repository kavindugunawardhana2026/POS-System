<<<<<<< HEAD
# POS System

A localized, full-featured Point of Sale (POS) system for retail and wholesale businesses.

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | React 18 + Vite + Zustand + React Router |
| Backend    | Node.js 20 + Express 4                  |
| Database   | MySQL 8 (via `mysql2/promise`)           |
| Receipts   | 80mm ESC/POS thermal + browser print    |
| Locales    | English (`en`) + Sinhala (`si`)         |
| Docker     | MySQL + Backend + Frontend              |

## Getting Started

### Prerequisites
- Node.js 20 (use `.nvmrc`)
- Docker & Docker Compose (for MySQL)
- npm 9+

### 1. Start the database
```bash
docker-compose up -d mysql
```

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Project Structure

```
├── backend/        # Node.js / Express API
├── frontend/       # React / Vite SPA
├── shared/         # Shared Zod schemas (optional)
├── docker/         # Dockerfiles
├── docs/           # Architecture & ERD
└── docker-compose.yml
```

## Default Admin Credentials (dev only)
- Username: `admin`
- Password: `Admin@1234` *(change immediately in production)*
=======
# POS-System
>>>>>>> e2021c37487059dff2da5944076b46f3496344e8
