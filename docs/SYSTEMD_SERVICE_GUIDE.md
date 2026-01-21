# 🔧 Systemd Service Management Guide

## KosMan Service Configuration

### Service File Location
```
/etc/systemd/system/kosman.service
```

---

## 🚀 Quick Commands

### Basic Operations
```bash
# Start service
sudo systemctl start kosman

# Stop service
sudo systemctl stop kosman

# Restart service
sudo systemctl restart kosman

# Check status
sudo systemctl status kosman

# Enable auto-start on boot
sudo systemctl enable kosman

# Disable auto-start
sudo systemctl disable kosman
```

### Logs & Debugging
```bash
# View real-time logs
sudo journalctl -u kosman -f

# View last 100 lines
sudo journalctl -u kosman -n 100

# View logs since today
sudo journalctl -u kosman --since today

# View logs with timestamps
sudo journalctl -u kosman -o short-precise

# Clear old logs (keep last 3 days)
sudo journalctl --vacuum-time=3d
```

---

## 📋 Deployment Workflow

### Method 1: Automated Deployment
```bash
# Run deployment script
sudo bash scripts/deploy-systemd.sh
```

This will:
1. Stop service
2. Pull latest code
3. Clean build cache
4. Install dependencies
5. Build application
6. Run migrations
7. Update service file
8. Restart service

### Method 2: Manual Deployment
```bash
# 1. Stop service
sudo systemctl stop kosman

# 2. Navigate to app
cd /home/mbx/projects/kosMan

# 3. Pull updates
git pull origin main

# 4. Clean & rebuild
rm -rf .nuxt .output node_modules/.cache
npm ci --omit=dev
NODE_ENV=production npm run build

# 5. Migrate database
npm run db:push

# 6. Reload systemd (if service file changed)
sudo systemctl daemon-reload

# 7. Start service
sudo systemctl start kosman

# 8. Check status
sudo systemctl status kosman
```

---

## 🔧 Service File Configuration

### Current Configuration
```ini
[Unit]
Description=KosMan Nuxt Application
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=mbx
Group=mbx
WorkingDirectory=/home/mbx/projects/kosMan

# Load environment variables from .env file
EnvironmentFile=/home/mbx/projects/kosMan/.env

# Override specific values
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=3004

# Execute the application
ExecStart=/root/.nvm/versions/node/v22.19.0/bin/node .output/server/index.mjs

# Restart configuration
Restart=always
RestartSec=10
StartLimitIntervalSec=60
StartLimitBurst=3

# Security & Resource Limits
NoNewPrivileges=true
PrivateTmp=true
LimitNOFILE=65535

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kosman

[Install]
WantedBy=multi-user.target
```

### Update Service File
```bash
# 1. Edit service file
sudo nano /etc/systemd/system/kosman.service

# 2. Save changes (Ctrl+O, Enter, Ctrl+X)

# 3. Reload systemd
sudo systemctl daemon-reload

# 4. Restart service
sudo systemctl restart kosman
```

---

## 🐛 Troubleshooting

### Issue 1: Service Fails to Start

**Check logs:**
```bash
sudo journalctl -u kosman -n 50 --no-pager
```

**Common causes:**
- ❌ Database not running
- ❌ Port already in use
- ❌ Missing environment variables
- ❌ Build artifacts missing

**Solutions:**
```bash
# Check if port is in use
sudo lsof -i :3004
# If something is using it, kill it:
sudo kill -9 <PID>

# Check database connection
psql -U adminpg -h 10.50.30.42 -d kostMan -c "SELECT 1"

# Verify .env file exists
ls -la /home/mbx/projects/kosMan/.env

# Check build output exists
ls -la /home/mbx/projects/kosMan/.output/server/index.mjs
```

---

### Issue 2: Permission Errors

**Error:** `Failed to execute /root/.nvm/...`

**Solution:**
```bash
# Change ownership
sudo chown -R mbx:mbx /home/mbx/projects/kosMan

# Or update service to run as correct user
sudo nano /etc/systemd/system/kosman.service
# Change User=mbx to match actual user
```

---

### Issue 3: Environment Variables Not Loaded

**Check .env file:**
```bash
cat /home/mbx/projects/kosMan/.env
```

**Verify service can read it:**
```bash
sudo systemctl show kosman | grep EnvironmentFile
```

**Solution:**
```bash
# Ensure .env file has correct format (no spaces around =)
# Correct:
DATABASE_URL="postgresql://..."
JWT_SECRET="abc123"

# Wrong:
DATABASE_URL = "postgresql://..."
```

---

### Issue 4: "Module Failed to Fetch" Error

**This is a build cache issue.**

**Solution:**
```bash
sudo systemctl stop kosman
cd /home/mbx/projects/kosMan
rm -rf .nuxt .output node_modules/.cache
NODE_ENV=production npm run build
sudo systemctl start kosman
```

---

### Issue 5: Service Keeps Restarting

**Check restart loop:**
```bash
sudo journalctl -u kosman --since "5 minutes ago"
```

**Common causes:**
- Application crashes immediately
- Database connection fails
- Port conflict

**Solution:**
```bash
# Test application manually first
cd /home/mbx/projects/kosMan
NODE_ENV=production PORT=3004 node .output/server/index.mjs

# If it works manually but not as service, check permissions
```

---

## 🔍 Monitoring & Health Checks

### Check Service Health
```bash
# Is service active?
systemctl is-active kosman

# Is service enabled?
systemctl is-enabled kosman

# Full status
systemctl status kosman --no-pager -l
```

### Check Application
```bash
# Test HTTP endpoint
curl http://localhost:3004

# Check if app is listening
sudo netstat -tulpn | grep :3004
# or
sudo ss -tulpn | grep :3004
```

### Monitor Resources
```bash
# CPU & Memory usage
systemctl status kosman

# Detailed resource usage
systemd-cgtop
```

---

## 🔄 Rollback Procedure

If deployment fails:

```bash
# 1. Stop current version
sudo systemctl stop kosman

# 2. Checkout previous version
cd /home/mbx/projects/kosMan
git log --oneline -n 5  # Find commit hash
git checkout <previous-commit-hash>

# 3. Rebuild
rm -rf .nuxt .output
NODE_ENV=production npm run build

# 4. Restart
sudo systemctl start kosman

# 5. Verify
sudo systemctl status kosman
curl http://localhost:3004
```

---

## 📊 Log Analysis

### Find Errors
```bash
# Show only errors
sudo journalctl -u kosman -p err -n 50

# Search for specific error
sudo journalctl -u kosman | grep -i "error"

# Export logs to file
sudo journalctl -u kosman --since today > kosman-logs.txt
```

### Log Rotation
```bash
# Check log size
sudo journalctl --disk-usage

# Limit log size (keep last 500MB)
sudo journalctl --vacuum-size=500M

# Keep only last 7 days
sudo journalctl --vacuum-time=7d
```

---

## 🔒 Security Best Practices

### Service Hardening

Add to service file for better security:

```ini
[Service]
# Run as non-root user
User=mbx
Group=mbx

# Prevent privilege escalation
NoNewPrivileges=true

# Private /tmp
PrivateTmp=true

# Read-only root filesystem (if applicable)
# ReadOnlyDirectories=/

# Limit file descriptors
LimitNOFILE=65535

# Restrict network access (if not needed)
# RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
```

---

## 📈 Performance Tuning

### Increase File Limits
```bash
# Edit limits
sudo nano /etc/security/limits.conf

# Add:
mbx soft nofile 65535
mbx hard nofile 65535

# Verify
ulimit -n
```

### Node.js Memory Limit
```ini
# In service file
Environment=NODE_OPTIONS="--max-old-space-size=2048"
```

---

## 🔄 Auto-Restart Configuration

Current config will:
- ✅ Auto-restart on failure
- ✅ Wait 10 seconds between restarts
- ✅ Give up after 3 failures in 60 seconds

Adjust in service file:
```ini
Restart=always          # always, on-failure, on-abnormal
RestartSec=10          # Seconds to wait
StartLimitBurst=3      # Max restarts
StartLimitIntervalSec=60  # Within this time
```

---

## 📚 Additional Resources

- [systemd documentation](https://www.freedesktop.org/software/systemd/man/)
- [journalctl manual](https://www.freedesktop.org/software/systemd/man/journalctl.html)
- [Node.js production best practices](https://nodejs.org/en/docs/guides/simple-profiling/)

---

## ✅ Deployment Checklist

Before deploying:

- [ ] Pull latest code
- [ ] Backup database
- [ ] Stop service
- [ ] Clean build cache
- [ ] Install dependencies
- [ ] Build application
- [ ] Run migrations
- [ ] Update service file
- [ ] Reload systemd
- [ ] Start service
- [ ] Check logs
- [ ] Test application
- [ ] Monitor for errors

---

**Last Updated:** January 21, 2026
