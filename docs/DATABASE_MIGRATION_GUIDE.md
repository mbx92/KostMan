# 📘 Database Migration Guide - KostMan

## Overview

KostMan menggunakan **Drizzle ORM** dengan **PostgreSQL** sebagai database utama.

---

## 🚀 Development Workflow

### Recommended: Use `db:push` for Development

```bash
# Make changes to server/database/schema.ts
# Then push directly to database (no migrations)
npm run db:push
```

**Keuntungan:**
- ✅ Cepat dan simple
- ✅ Tidak perlu manage migration files
- ✅ Cocok untuk development/prototyping
- ✅ Auto-sync schema dengan database

---

## 📦 Production Workflow

### Use `db:migrate` for Production

```bash
# 1. Generate migration from schema changes
npm run db:generate

# 2. Review migration files in drizzle/ folder

# 3. Apply migrations to database
npm run db:migrate
```

**Keuntungan:**
- ✅ Versioned migrations
- ✅ Rollback capability
- ✅ Audit trail
- ✅ Safe for production

---

## 🔧 Common Issues & Solutions

### Issue 1: "type already exists" Error

**Error:**
```
error: type "expense_category" already exists
```

**Solution A: Fix Migration (Recommended)**

```bash
# 1. Drop conflicting types
npm run db:fix-migration

# 2. Run migration again
npm run db:migrate
```

**Solution B: Use db:push Instead**

```bash
# Push schema directly (skip migrations)
npm run db:push
```

**Solution C: Manual Drop (Advanced)**

```bash
# Connect to database
psql -U adminpg -h 10.50.30.42 -d kostMan

# Drop the enum type
DROP TYPE IF EXISTS expense_category CASCADE;

# Exit
\q

# Then run migration
npm run db:migrate
```

---

### Issue 2: Migration Out of Sync

**Symptoms:**
- Migration files don't match database state
- Errors about missing columns/tables

**Solution:**

```bash
# Option 1: Reset migrations (Development ONLY)
rm -rf drizzle/*
npm run db:generate
npm run db:push

# Option 2: Fix with fresh database
npm run db:reset
npm run db:migrate
npm run db:seed-full
```

---

### Issue 3: Schema Drift

**When to worry:**
- Production database doesn't match migration history
- Manual changes made to production database

**Solution:**

```bash
# 1. Generate migration from current schema
npm run db:generate

# 2. Review the migration
cat drizzle/0001_*.sql

# 3. If looks correct, apply
npm run db:migrate

# 4. If not, fix schema.ts and regenerate
```

---

## 📋 Migration Commands Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run db:push` | Sync schema to DB directly | Development, quick changes |
| `npm run db:generate` | Create migration files | Production, versioning |
| `npm run db:migrate` | Apply migrations | Production, CI/CD |
| `npm run db:fix-migration` | Fix ENUM conflicts | When migration fails |

---

## 🏗️ Schema Change Workflow

### Development Environment

```bash
# 1. Edit schema
nano server/database/schema.ts

# 2. Push changes (no migration files)
npm run db:push

# 3. Test your changes
npm run dev
```

### Production Environment

```bash
# 1. Edit schema on dev
nano server/database/schema.ts

# 2. Generate migration
npm run db:generate

# 3. Test migration on staging
npm run db:migrate

# 4. Commit migration files
git add drizzle/
git commit -m "feat: add new column to tenants table"

# 5. Deploy to production
# Migration will run automatically in CI/CD
```

---

## 🔄 Database Reset & Seeding

### Full Reset (Development)

```bash
# Clear all data + repopulate with demo data
npm run db:reset
```

### Clear Without Seeding

```bash
# Clear all data (keep users)
npm run db:clear
```

### Seed Demo Data

```bash
# Populate with realistic demo data
npm run db:seed-full
```

---

## 🐘 Direct PostgreSQL Access

### Connect to Database

```bash
# Using psql
psql -U adminpg -h 10.50.30.42 -d kostMan

# List all tables
\dt

# Describe table
\d tenants

# List all ENUMs
\dT+

# Exit
\q
```

### Useful Queries

```sql
-- Check migration history
SELECT * FROM "__drizzle_migrations";

-- List all custom types
SELECT n.nspname as schema, t.typname as type 
FROM pg_type t 
LEFT JOIN pg_namespace n ON n.oid = t.typnamespace 
WHERE t.typtype = 'e' AND n.nspname = 'public';

-- Drop all ENUMs (careful!)
DROP TYPE IF EXISTS expense_category CASCADE;
DROP TYPE IF EXISTS expense_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
```

---

## 🚨 Production Safety Checklist

Before running migrations in production:

- [ ] Test migration on staging environment
- [ ] Backup production database first
- [ ] Review migration SQL files
- [ ] Check for destructive operations (DROP, ALTER)
- [ ] Plan rollback strategy
- [ ] Schedule during low-traffic period
- [ ] Have database admin on standby

### Backup Before Migration

```bash
# Create backup
npm run db:backup

# Or manual pg_dump
pg_dump -U adminpg -h 10.50.30.42 kostMan > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🔄 Rollback Strategy

### If Migration Fails

```bash
# 1. Restore from backup
psql -U adminpg -h 10.50.30.42 kostMan < backup.sql

# 2. Or use Drizzle rollback (if available)
# Check drizzle documentation for rollback support

# 3. Or manually revert changes
psql -U adminpg -h 10.50.30.42 kostMan
# Execute reverse SQL commands
```

---

## 🌍 Environment-Specific Configs

### Development

```env
DATABASE_URL="postgresql://adminpg:password@localhost:5432/kostman_dev"
```

**Strategy:** Use `db:push` for quick iterations

### Staging

```env
DATABASE_URL="postgresql://user:pass@staging-server:5432/kostman_staging"
```

**Strategy:** Use `db:migrate` to test production flow

### Production

```env
DATABASE_URL="postgresql://user:pass@production-server:5432/kostman"
```

**Strategy:** Use `db:migrate` with backups and monitoring

---

## 📊 Migration Best Practices

### ✅ DO

- ✅ Use `db:push` for development
- ✅ Use `db:migrate` for production
- ✅ Test migrations on staging first
- ✅ Backup before production migrations
- ✅ Review generated SQL files
- ✅ Use descriptive migration names
- ✅ Commit migration files to Git

### ❌ DON'T

- ❌ Run `db:push` on production
- ❌ Edit migration files manually
- ❌ Delete migration history
- ❌ Skip testing migrations
- ❌ Run migrations without backups
- ❌ Make schema changes directly in production

---

## 🐛 Troubleshooting

### Error: "relation already exists"

```bash
# Table exists but migration tries to create it
# Solution: Use db:push or drop the table first
DROP TABLE IF EXISTS table_name CASCADE;
npm run db:migrate
```

### Error: "column already exists"

```bash
# Column exists but migration tries to add it
# Solution: Remove the migration or alter manually
ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;
npm run db:migrate
```

### Error: "cannot connect to database"

```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Verify server is running
nc -zv 10.50.30.42 5432
```

---

## 📚 Additional Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle Kit Migrations](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Last Updated:** January 21, 2026
