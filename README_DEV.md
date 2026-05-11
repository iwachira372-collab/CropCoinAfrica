/**
 * CropCoin - Agricultural Finance Platform
 * Development Guide
 * 
 * This is a modular monorepo containing:
 * - Backend API (NestJS) at apps/api
 * - Frontend Web (Next.js) at apps/web
 * - Shared libraries at libs/shared
 */

# Quick Start

## 1. Install Dependencies
```bash
npm install
```

## 2. Start Docker services (PostgreSQL + Redis)
```bash
npm run docker:up
```

## 3. Create .env file
```bash
cp .env.example .env
```

## 4. Start development servers
```bash
npm run dev
```

This starts both the API (port 3000) and Web (port 3001) concurrently.

## API Development
- API runs on: http://localhost:3000
- Health check: http://localhost:3000/health
- Login: POST http://localhost:3000/auth/login
- Signup: POST http://localhost:3000/auth/signup

## Web Development
- Frontend runs on: http://localhost:3001
- Login page: http://localhost:3001/login
- Home page: http://localhost:3001

## Database
- PostgreSQL: localhost:5432
- PgAdmin: http://localhost:5050
- Redis: localhost:6379

## Project Structure
```
CropCoinAfrica/
├── apps/
│   ├── api/              # NestJS Backend API
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   └── modules/
│   │   │       └── auth/
│   │   └── project.json
│   └── web/              # Next.js Frontend
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── login/
│       │   └── globals.css
│       └── project.json
├── libs/
│   └── shared/           # Shared utilities
├── docker-compose.yml    # Local dev stack
├── package.json          # Monorepo dependencies
└── tsconfig.base.json    # TypeScript configuration
```

## Useful Commands
- `npm run api:dev` - Run API only
- `npm run web:dev` - Run frontend only
- `npm run api:build` - Build API
- `npm run web:build` - Build frontend
- `npm run docker:down` - Stop Docker services
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Phase 1 Implementation Status
✅ Monorepo structure (Nx)
✅ NestJS API with basic auth (JWT)
✅ Next.js frontend with login page
✅ Docker Compose stack (PostgreSQL + Redis)
✅ Authentication endpoints (signup/login)
✅ Tailwind CSS styling

## Next Steps (Phase 2)
- Integrate PostgreSQL database with Prisma
- Implement KYC system
- Add warehouse receipt verification
- Build loan application workflow
- Integrate market price feeds
- Set up email notifications

## Troubleshooting
If ports are in use:
- Change API_PORT in .env
- Change port in apps/web/project.json serve target

If npm install fails:
- Delete node_modules and package-lock.json
- Run npm install again
