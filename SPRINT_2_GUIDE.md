# Sprint 2 Implementation Guide: Authentication System & RBAC

## Overview

This guide covers the complete Sprint 2 implementation for CropCoinAfrica, including:
- ✅ Prisma ORM database setup
- ✅ Production-grade authentication with JWT + refresh token rotation
- ✅ Email verification and password reset flows
- ✅ Role-Based Access Control (RBAC) with guards and decorators
- ✅ Email service integration (SendGrid/stubbed)
- ✅ GitHub Actions CI/CD pipeline

## Table of Contents

1. [Local Setup](#local-setup)
2. [Database Schema](#database-schema)
3. [Authentication Endpoints](#authentication-endpoints)
4. [RBAC System](#rbac-system)
5. [API Security](#api-security)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Local Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Docker and Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)
- Git

### Step 1: Clone and Install Dependencies

```bash
git clone https://github.com/iwachira372-collab/CropCoinAfrica.git
cd CropCoinAfrica
npm install
```

### Step 2: Start Docker Services

```bash
npm run docker:up
```

This starts:
- PostgreSQL 16 on `localhost:5432`
- Redis 7 on `localhost:6379`
- PgAdmin on `http://localhost:5050` (admin@cropcoin.local / admin)

### Step 3: Set Up Database

```bash
# Run Prisma migrations
npm run db:migrate

# Seed with initial data (roles, permissions, admin user)
npm run db:seed
```

**Seeded Users:**
- Admin: `admin@cropcoin.local` / `Admin123!`
- Farmer: `farmer@cropcoin.local` / `Farmer123!`

### Step 4: Start Development Servers

```bash
# Start both API and Web concurrently
npm run dev

# Or individually:
npm run api:dev      # NestJS API on http://localhost:3000
npm run web:dev      # Next.js Frontend on http://localhost:3001
```

### Step 5: Verify Setup

```bash
# Health check
curl http://localhost:3000/health

# Login with test user
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"farmer@cropcoin.local","password":"Farmer123!"}'
```

---

## Database Schema

### Core Tables

**Users**
- Stores user credentials, verification status, and account state
- Fields: id (UUID), email, phone, password_hash, email_verified, mfa_enabled, status, created_at, updated_at

**Roles**
- Pre-defined roles: Farmer, Warehouse Operator, Financial Institution, Admin, Super Admin
- Fields: id (UUID), name, description

**User_Roles** (Many-to-many)
- Links users to roles with audit trail (assigned_by, assigned_at)

**Permissions**
- Fine-grained action permissions (resource:action pairs)
- Examples: auth:signup, loans:read, loans:approve

**Role_Permissions** (Many-to-many)
- Maps permissions to roles

**Refresh_Tokens**
- Stores hashed refresh tokens with expiration and revocation tracking
- Supports device fingerprinting and token rotation

**Email_Verification_Tokens**
- One-time tokens for email verification (24h expiry)

**Password_Reset_Tokens**
- One-time tokens for password reset (1h expiry)

### Entity Relationship Diagram

```
User (1) ──── (Many) User_Role ──── (Many) Role
                                      |
                                      └──── (Many) Role_Permission ──── (Many) Permission

User (1) ──── (Many) Refresh_Token
User (1) ──── (Many) Email_Verification_Token
User (1) ──── (Many) Password_Reset_Token
User (1) ──── (Many) Farmer_Profile
```

---

## Authentication Endpoints

### 1. Signup
**POST** `/auth/signup`

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newfarmer@example.com",
    "password": "SecurePass123!",
    "phone": "+254712345678"
  }'
```

**Response (201 Created):**
```json
{
  "message": "User registered successfully. Please verify your email.",
  "user": {
    "id": "uuid",
    "email": "newfarmer@example.com",
    "phone": "+254712345678",
    "emailVerified": false,
    "status": "active",
    "roles": ["Farmer"],
    "createdAt": "2026-05-12T10:00:00Z"
  }
}
```

### 2. Login
**POST** `/auth/login`

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "farmer@cropcoin.local",
    "password": "Farmer123!"
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "hex_encoded_random_token",
  "user": {
    "id": "uuid",
    "email": "farmer@cropcoin.local",
    "roles": ["Farmer"],
    "emailVerified": true,
    "status": "active"
  }
}
```

**Note:** In production, `refreshToken` is sent as an HttpOnly cookie. In development, it's in the response body.

### 3. Verify Email
**POST** `/auth/verify-email`

```bash
curl -X POST http://localhost:3000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "verification_token_from_email"}'
```

**Response (200 OK):**
```json
{
  "message": "Email verified successfully"
}
```

### 4. Resend Verification Email
**POST** `/auth/resend-verification-email`

```bash
curl -X POST http://localhost:3000/auth/resend-verification-email \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### 5. Refresh Token
**POST** `/auth/refresh`

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "previous_refresh_token"}'
```

**Response (200 OK):**
```json
{
  "accessToken": "new_access_token_jwt",
  "refreshToken": "new_refresh_token"
}
```

**Note:** Old refresh token is automatically revoked (token rotation).

### 6. Logout
**POST** `/auth/logout`

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer access_token"
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

All refresh tokens are revoked.

### 7. Forgot Password
**POST** `/auth/forgot-password`

```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Response (200 OK):**
```json
{
  "message": "If email exists, password reset link has been sent"
}
```

(Generic message for security—doesn't reveal if user exists)

### 8. Reset Password
**POST** `/auth/reset-password`

```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "newPassword": "NewPassword123!"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Password reset successfully"
}
```

---

## RBAC System

### Role-Based Guards

Protect endpoints using the `@HasRoles(...)` decorator:

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HasRoles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('loans')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class LoansController {
  
  @Post('apply')
  @HasRoles('Farmer')
  async applyForLoan(@Body() dto: ApplyLoanDto) {
    // Only farmers can apply for loans
  }

  @Post(':id/approve')
  @HasRoles('Financial Institution', 'Admin')
  async approveLoan(@Param('id') loanId: string) {
    // Only FI and admins can approve loans
  }
}
```

### Available Roles

1. **Farmer** — Access loans, wallet, warehouse receipts
2. **Warehouse Operator** — Manage warehouse receipts and commodities
3. **Financial Institution** — Review and approve loans
4. **Admin** — User management, KYC review, audit logs
5. **Super Admin** — Full system access, role assignment

### Default Permissions by Role

| Permission | Farmer | Warehouse | FI | Admin | Super Admin |
|-----------|--------|-----------|----|----|-----------|
| auth:signup | ✅ | ✅ | ✅ | ✅ | ✅ |
| auth:login | ✅ | ✅ | ✅ | ✅ | ✅ |
| loans:read | ✅ | ❌ | ✅ | ✅ | ✅ |
| loans:create | ✅ | ❌ | ❌ | ✅ | ✅ |
| loans:approve | ❌ | ❌ | ✅ | ✅ | ✅ |
| receipts:read | ✅ | ✅ | ❌ | ✅ | ✅ |
| receipts:create | ❌ | ✅ | ❌ | ✅ | ✅ |
| kyc:review | ❌ | ❌ | ❌ | ✅ | ✅ |
| users:manage | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## API Security

### Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

Example: `Farmer123!`

### Token Security

**Access Token (JWT)**
- Expiry: 15 minutes
- Signature: HS256
- Payload: `{ sub, email, roles, sessionId }`

**Refresh Token**
- Expiry: 7 days
- Format: 256-bit random hex string (hashed in DB)
- Rotation: Every refresh revokes old token (detects theft)
- Storage: HttpOnly cookie (production) or response body (dev)

### Token Rotation Flow

```
1. User logs in
   ↓
2. Server issues access_token (15m) + refresh_token (7d)
   ↓
3. Access token expires
   ↓
4. Client calls POST /auth/refresh with refresh_token
   ↓
5. Server validates refresh_token
   ↓
6. Server revokes old refresh_token
   ↓
7. Server issues NEW refresh_token + new access_token
   ↓
8. If refresh_token is reused (stolen), server detects & rejects
```

### Headers and Cookies

**Authorization Header (JWT):**
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**HttpOnly Cookies (Production):**
```
Set-Cookie: refresh_token=hex_token; 
  HttpOnly; 
  Secure; 
  SameSite=Strict; 
  Max-Age=604800; 
  Path=/auth
```

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- apps/api/src/modules/auth/auth.service.spec.ts

# Run with coverage
npm test -- --coverage
```

### Integration Tests

```bash
# Requires Docker services running
npm run db:migrate
npm run db:seed

# Run integration tests
npm test -- --testPathPattern=".e2e"
```

### Manual API Testing

Use Postman or curl:

```bash
# 1. Signup
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# 2. Verify email (use token from email service or logs)
curl -X POST http://localhost:3000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"..."}'

# 3. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

---

## Deployment

### Environment Variables

Create `.env.production` for production:

```bash
# Database
DATABASE_URL="postgresql://user:password@prod-db-host:5432/cropcoin_db"
REDIS_URL="redis://prod-cache-host:6379"

# JWT
JWT_SECRET="long-random-secret-from-aws-secrets-manager"
JWT_REFRESH_SECRET="long-random-refresh-secret"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Email
SENDGRID_API_KEY="SG.ActualSendGridApiKey"
SENDGRID_FROM_EMAIL="noreply@cropcoin.finance"

# API
API_PORT=3000
API_URL="https://api.cropcoin.finance"
NODE_ENV="production"

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5

# Features
ENABLE_EMAIL_VERIFICATION=true
ENABLE_PASSWORD_RESET=true
```

### GitHub Actions CI/CD

Workflows are configured in `.github/workflows/`:

1. **lint-and-test.yml** — Runs on PR to develop/main
   - Linting
   - Type checking
   - Unit tests
   - Coverage upload

2. **integration-tests.yml** — Runs on PR and push to develop
   - Database migrations
   - Integration tests
   - Seed data verification

3. **deploy-dev.yml** — Auto-triggers on push to develop
   - Build & test
   - Docker image build (optional)
   - Deploy notification

4. **security.yml** — Weekly security audit
   - npm audit
   - Dependency checks
   - Code quality

### Deployment to Production

```bash
# 1. Merge to main branch (requires PR + 2 approvals)
git checkout main
git pull origin main

# 2. Create release tag
git tag -a v1.0.0-sprint2 -m "Sprint 2: Auth & RBAC"
git push origin v1.0.0-sprint2

# 3. GitHub Actions automatically deploys
# (Configure deployment step in GitHub Actions if needed)
```

---

## Troubleshooting

### PostgreSQL Connection Errors

```bash
# Check if containers are running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart containers
npm run docker:down
npm run docker:up
sleep 5

# Retry migrations
npm run db:migrate
```

### Prisma Migration Issues

```bash
# Reset database (⚠️ WARNING: Deletes all data)
npm run db:reset

# Manually check migration status
npx prisma migrate status

# Create new migration after schema change
npx prisma migrate dev --name describe_your_change
```

### Email Not Sending

In development, emails are logged to console:

```bash
# Look for this in terminal output:
# 📧 [DEV MODE] Email would be sent to: user@example.com
# Subject: Verify Your CropCoin Email
```

In production, verify SendGrid API key:

```bash
export SENDGRID_API_KEY="SG.your-key"
curl -X POST https://api.sendgrid.com/v3/mail/send -H "Authorization: Bearer $SENDGRID_API_KEY"
```

### Rate Limiting Issues

If getting 429 errors on login:

```bash
# Check Redis connection
redis-cli ping
# Expected: PONG

# Clear rate limit counters (dev only)
redis-cli FLUSHDB

# Adjust limits in .env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=5
```

### JWT Token Validation Errors

Check token payload:

```bash
# Decode JWT (without verification)
# Use https://jwt.io and paste your token

# Common issues:
# - Secret key mismatch (JWT_SECRET different in .env)
# - Token expired (check expiration time)
# - Algorithm mismatch (expect HS256)
```

---

## Next Steps (Sprint 3)

- [ ] Social OAuth (Google, Facebook, Apple)
- [ ] TOTP 2FA and SMS OTP
- [ ] Rate limiting per-endpoint with Redis
- [ ] Helmet security headers
- [ ] Full frontend auth flows
- [ ] Protected route middleware
- [ ] Form validation (Zod + React Hook Form)

---

## Support

For questions or issues:
1. Check [GitHub Issues](https://github.com/iwachira372-collab/CropCoinAfrica/issues)
2. Review [blueprintdocument](../IMPLEMENTATION_BLUEPRINT.md)
3. Check logs: `docker-compose logs -f api`

---

**Last Updated:** May 12, 2026
**Sprint:** Sprint 2 - Authentication & RBAC
**Status:** ✅ Complete
