# 🔐 Security Keys Setup Guide

## Overview

KostMan requires secure encryption keys for:
- **JWT_SECRET**: JSON Web Token signing (authentication)
- **ENCRYPTION_KEY**: Encrypt sensitive data (e.g., Midtrans server key)
- **SESSION_SECRET**: Session management security

---

## 🚀 Quick Setup

### Method 1: Using the Generator Script (Recommended)

```bash
# On Linux/macOS
bash scripts/generate-keys.sh

# On Windows (Git Bash)
bash scripts/generate-keys.sh
```

This will output keys ready to copy into your `.env` file.

---

### Method 2: Manual Generation (Linux/macOS)

```bash
# Generate JWT Secret
openssl rand -hex 32

# Generate Encryption Key
openssl rand -hex 32

# Generate Session Secret
openssl rand -hex 32
```

**Then update your `.env`:**

```env
JWT_SECRET="<paste-first-key-here>"
ENCRYPTION_KEY="<paste-second-key-here>"
SESSION_SECRET="<paste-third-key-here>"
```

---

### Method 3: Using Node.js (Cross-platform)

```bash
# Generate one key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or generate all three at once
node -e "const crypto = require('crypto'); console.log('JWT_SECRET=\"' + crypto.randomBytes(32).toString('hex') + '\"'); console.log('ENCRYPTION_KEY=\"' + crypto.randomBytes(32).toString('hex') + '\"'); console.log('SESSION_SECRET=\"' + crypto.randomBytes(32).toString('hex') + '\"');"
```

---

## 📝 Environment Variables

### Required Variables

```env
# Security Keys (REQUIRED)
JWT_SECRET="64-character-hex-string"
ENCRYPTION_KEY="64-character-hex-string"
SESSION_SECRET="64-character-hex-string"
```

### Full .env Example

```env
# Application Environment
NODE_ENV=production

# Server Configuration
NUXT_HOST=0.0.0.0
NUXT_PORT=3000

# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/kostman"

# Security Keys
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
ENCRYPTION_KEY="f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1"
SESSION_SECRET="1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

---

## 🔒 Best Practices

### ✅ DO

- ✅ Generate **different keys** for development, staging, and production
- ✅ Use **at least 32 bytes (256 bits)** of entropy
- ✅ Store keys in environment variables or secrets manager
- ✅ **Back up your keys** securely (password manager, encrypted storage)
- ✅ Rotate keys periodically (every 6-12 months)
- ✅ Use `.env` file for local development
- ✅ Use secrets management (AWS Secrets Manager, HashiCorp Vault) for production

### ❌ DON'T

- ❌ **Never** commit `.env` to version control
- ❌ Don't use weak/predictable keys (like "secret123")
- ❌ Don't share keys via email/chat
- ❌ Don't reuse the same keys across environments
- ❌ Don't hardcode keys in source code

---

## 🖥️ Production Deployment

### Option A: Direct Environment Variables (VPS)

```bash
# SSH to your server
ssh user@your-server.com

# Navigate to app directory
cd /path/to/kostman

# Generate keys
bash scripts/generate-keys.sh

# Create/edit .env file
nano .env

# Paste the generated keys
# Save and exit (Ctrl+X, Y, Enter)

# Restart the application
pm2 restart kostman
# or
docker-compose down && docker-compose up -d
```

---

### Option B: Docker Compose (Recommended)

Create a `.env.production` file:

```env
JWT_SECRET="<generated-key>"
ENCRYPTION_KEY="<generated-key>"
SESSION_SECRET="<generated-key>"
DATABASE_URL="postgresql://..."
```

Update `docker-compose.yml`:

```yaml
services:
  app:
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
```

Deploy:

```bash
# Generate keys first
bash scripts/generate-keys.sh

# Copy output to .env.production
nano .env.production

# Deploy
docker-compose -f docker-compose.yml --env-file .env.production up -d
```

---

### Option C: Cloud Platforms

#### **Vercel/Netlify**
1. Dashboard → Settings → Environment Variables
2. Add each key:
   - `JWT_SECRET`: (paste generated key)
   - `ENCRYPTION_KEY`: (paste generated key)
   - `SESSION_SECRET`: (paste generated key)

#### **AWS EC2/ECS**
Use **AWS Secrets Manager**:

```bash
# Install AWS CLI
aws configure

# Store secrets
aws secretsmanager create-secret \
  --name kostman/jwt-secret \
  --secret-string "<generated-key>"

aws secretsmanager create-secret \
  --name kostman/encryption-key \
  --secret-string "<generated-key>"

aws secretsmanager create-secret \
  --name kostman/session-secret \
  --secret-string "<generated-key>"
```

#### **DigitalOcean App Platform**
1. App → Settings → Environment Variables
2. Add encrypted variables
3. Redeploy

---

## 🔄 Key Rotation

If you need to rotate keys (security breach, scheduled maintenance):

```bash
# 1. Generate new keys
bash scripts/generate-keys.sh

# 2. Update .env with NEW keys

# 3. Restart application
pm2 restart kostman

# 4. All users will need to re-login (JWT tokens invalidated)
```

**Note:** Rotating `ENCRYPTION_KEY` requires re-encrypting stored data!

---

## 🧪 Verify Keys are Working

```bash
# Test JWT generation
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Should return JWT token if keys are valid
```

---

## 🐛 Troubleshooting

### Error: "JWT_SECRET is not defined"

**Solution:** Check that `.env` file exists and contains `JWT_SECRET`

```bash
# Verify .env file
cat .env | grep JWT_SECRET

# Should output: JWT_SECRET="..."
```

### Error: "Invalid key length"

**Solution:** Key must be 64 characters (32 bytes hex)

```bash
# Check key length
echo -n "your-key-here" | wc -c
# Should output: 64
```

### Error: "Failed to decrypt"

**Solution:** `ENCRYPTION_KEY` might have changed. Check:
1. Key is 64 characters
2. Key hasn't changed since data was encrypted
3. Restore from backup if needed

---

## 📚 Additional Resources

- [JWT Best Practices](https://jwt.io/introduction)
- [OpenSSL Documentation](https://www.openssl.org/docs/)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)

---

## ✅ Checklist

Before deploying to production:

- [ ] Generated secure keys using `openssl rand -hex 32`
- [ ] Added keys to `.env` file (never committed)
- [ ] Verified keys are 64 characters each
- [ ] Backed up keys in secure location
- [ ] Different keys for dev/staging/production
- [ ] Keys stored in secrets manager (production)
- [ ] Tested authentication works
- [ ] Documented key rotation procedure

---

**Last Updated:** January 21, 2026
