# 🗄️ PostgreSQL Setup & Configuration

## Current Setup

**Database Server:** 10.100.10.5 (same server as application)  
**Database Name:** kostMan_dev  
**User:** mbx  
**Port:** 5432

---

## ✅ Verify PostgreSQL Installation

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL version
psql --version

# Check if listening on port
sudo netstat -tulpn | grep 5432
```

---

## 🔧 PostgreSQL Service Management

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Stop PostgreSQL
sudo systemctl stop postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Enable auto-start on boot
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

---

## 🔌 Test Database Connection

```bash
# From application directory
bash scripts/test-db-connection.sh

# Or manual test
psql "postgresql://mbx:nopassword123!@10.100.10.5:5432/kostMan_dev" -c "SELECT 1;"
```

---

## 🗃️ Database Management

### Create Database (if not exists)

```bash
# Connect as postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE "kostMan_dev";

# Create user (if not exists)
CREATE USER mbx WITH PASSWORD 'nopassword123!';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE "kostMan_dev" TO mbx;

# Exit
\q
```

### Access Database

```bash
# Connect to database
psql "postgresql://mbx:nopassword123!@10.100.10.5:5432/kostMan_dev"

# Common commands:
\l              # List databases
\dt             # List tables
\d table_name   # Describe table
\q              # Quit
```

---

## 📊 Database Backup & Restore

### Backup Database

```bash
# Create backup
pg_dump -U mbx -h 10.100.10.5 "kostMan_dev" > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup with compression
pg_dump -U mbx -h 10.100.10.5 "kostMan_dev" | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Using application script (via API)
curl -X POST http://localhost:3004/api/backup/database -o backup.sql
```

### Restore Database

```bash
# Restore from backup
psql -U mbx -h 10.100.10.5 "kostMan_dev" < backup.sql

# Restore from compressed backup
gunzip -c backup.sql.gz | psql -U mbx -h 10.100.10.5 "kostMan_dev"

# Drop and recreate before restore (CAREFUL!)
sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"kostMan_dev\";"
sudo -u postgres psql -c "CREATE DATABASE \"kostMan_dev\" OWNER mbx;"
psql -U mbx -h 10.100.10.5 "kostMan_dev" < backup.sql
```

---

## 🔒 Security Configuration

### Update PostgreSQL Config

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Key settings:
listen_addresses = 'localhost,10.100.10.5'
port = 5432
max_connections = 100

# Save and restart
sudo systemctl restart postgresql
```

### Update pg_hba.conf (Access Control)

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add/verify these lines:
# TYPE  DATABASE        USER    ADDRESS         METHOD
local   all            postgres                 peer
local   all            all                      peer
host    kostMan_dev    mbx     10.100.10.5/32  md5
host    kostMan_dev    mbx     127.0.0.1/32    md5

# Reload configuration
sudo systemctl reload postgresql
```

---

## 🔍 Monitoring & Performance

### Check Database Size

```sql
SELECT 
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'kostMan_dev';
```

### Check Table Sizes

```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Active Connections

```sql
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query
FROM pg_stat_activity
WHERE datname = 'kostMan_dev';
```

### Kill Connections

```sql
-- Terminate all connections to database (for maintenance)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'kostMan_dev'
  AND pid <> pg_backend_pid();
```

---

## 🚀 Performance Tuning

### Analyze & Vacuum

```sql
-- Analyze database (update statistics)
ANALYZE;

-- Vacuum (reclaim storage)
VACUUM;

-- Full vacuum (locks tables, use during maintenance)
VACUUM FULL;

-- Auto-vacuum status
SELECT * FROM pg_stat_progress_vacuum;
```

### Create Indexes

```sql
-- Example: Index on foreign keys
CREATE INDEX idx_rooms_property_id ON rooms(property_id);
CREATE INDEX idx_rooms_tenant_id ON rooms(tenant_id);
CREATE INDEX idx_rent_bills_room_id ON rent_bills(room_id);
CREATE INDEX idx_utility_bills_room_id ON utility_bills(room_id);
```

---

## 🐛 Troubleshooting

### Issue 1: Cannot Connect

**Error:** `psql: could not connect to server`

**Solutions:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if listening on correct port
sudo netstat -tulpn | grep 5432

# Check logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

### Issue 2: Authentication Failed

**Error:** `password authentication failed for user "mbx"`

**Solutions:**
```bash
# Reset password
sudo -u postgres psql
ALTER USER mbx WITH PASSWORD 'nopassword123!';
\q

# Check pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Ensure md5 or scram-sha-256 is used for host connections

# Reload config
sudo systemctl reload postgresql
```

---

### Issue 3: Database Does Not Exist

**Error:** `database "kostMan_dev" does not exist`

**Solution:**
```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE \"kostMan_dev\" OWNER mbx;"

# Run migrations
cd /home/mbx/projects/kosMan
npm run db:push
```

---

### Issue 4: Too Many Connections

**Error:** `too many connections for role "mbx"`

**Solutions:**
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity WHERE usename = 'mbx';

-- Increase connection limit
ALTER USER mbx CONNECTION LIMIT 20;

-- Or in postgresql.conf
max_connections = 100
```

---

## 📈 Monitoring Tools

### PostgreSQL Activity

```bash
# htop with PostgreSQL filter
htop -p $(pgrep -d',' postgres)

# pg_top (if installed)
sudo apt install ptop
pg_top -U mbx -d kostMan_dev

# Check disk usage
du -sh /var/lib/postgresql/14/main
```

### Query Performance

```sql
-- Slow queries
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Table statistics
SELECT * FROM pg_stat_user_tables WHERE schemaname = 'public';
```

---

## 🔄 Maintenance Schedule

### Daily
```bash
# Auto-vacuum should handle this
# Monitor via: SELECT * FROM pg_stat_progress_vacuum;
```

### Weekly
```bash
# Manual analyze
sudo -u postgres psql kostMan_dev -c "ANALYZE;"

# Check database size
bash scripts/check-db-size.sh
```

### Monthly
```bash
# Full backup
pg_dump -U mbx -h 10.100.10.5 kostMan_dev | gzip > monthly_backup_$(date +%Y%m).sql.gz

# Vacuum full (during low traffic)
sudo -u postgres psql kostMan_dev -c "VACUUM FULL;"
```

---

## 🔗 Integration with Application

### Environment Variables

```env
# .env file
DATABASE_URL="postgresql://mbx:nopassword123!@10.100.10.5:5432/kostMan_dev"
```

### Drizzle Configuration

```typescript
// drizzle.config.ts
export default {
  schema: './server/database/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
}
```

### Connection Pooling

For production, consider using PgBouncer:

```bash
# Install PgBouncer
sudo apt install pgbouncer

# Configure
sudo nano /etc/pgbouncer/pgbouncer.ini
```

---

## ✅ Pre-Deployment Checklist

Before deploying:

- [ ] PostgreSQL service is running
- [ ] Database exists and accessible
- [ ] User has correct permissions
- [ ] Backup created
- [ ] Connection test passes
- [ ] Migrations ready
- [ ] Application can connect

Test with:
```bash
bash scripts/test-db-connection.sh
```

---

**Last Updated:** January 21, 2026
