# Database Management Quick Reference

## 🚀 Quick Actions

### Copy Database (Dev → Prod)
```
1. Login sebagai Admin
2. Settings → Database Configuration
3. Scroll ke "Copy Database"
4. Source: kostMan_dev
5. Target: kostman_prod
6. Click "Copy Database"
7. Wait for success message
```

### Switch Database Environment
```
1. Settings → Database Configuration
2. Click environment card (Dev/Staging/Prod)
3. Click "Switch to [Environment]"
4. Click "Restart Server"
5. Page will reload automatically
```

### Restart Server
```
1. Settings → Database Configuration
2. Scroll to "Server Control"
3. Click "Restart Server"
4. Wait for page reload
```

## 📋 Command Line Alternatives

### Copy Database via CLI
```bash
# Using script
bash scripts/copy-database.sh kostMan_dev kostman_prod

# Manual pg_dump/restore
export PGPASSWORD="your_password"
pg_dump -h HOST -U USER -d kostMan_dev > dump.sql
psql -h HOST -U USER -d kostman_prod < dump.sql
```

### Restart via PM2
```bash
pm2 restart kostman
```

### Restart via Systemd
```bash
sudo systemctl restart kostman
```

## 🔍 Verify Database

### Check Database Exists
```bash
psql -h HOST -U USER -l | grep kostman
```

### Check Record Count
```bash
psql -h HOST -U USER -d DATABASE -c "SELECT COUNT(*) FROM users;"
```

### Compare Two Databases
```bash
# Count users in both
psql -h HOST -U USER -d kostMan_dev -c "SELECT COUNT(*) FROM users;"
psql -h HOST -U USER -d kostman_prod -c "SELECT COUNT(*) FROM users;"
```

## ⚠️ Common Issues

### Copy Database Fails
- Check disk space: `df -h`
- Verify source DB exists
- Ensure DB user has permissions
- Check PostgreSQL logs

### Server Won't Restart
- Verify PM2 is installed: `which pm2`
- Check if systemd service exists: `systemctl status kostman`
- Manual restart: `pm2 restart kostman` or `systemctl restart kostman`

### Can't Connect to New Database
- Verify DATABASE_URL is correct
- Check database exists: `psql -l`
- Test connection: `psql -h HOST -U USER -d DATABASE`
- Restart server after config change

## 🎯 Best Practices

1. **Always backup before copying**: `pg_dump` your target DB first
2. **Test in staging first**: Copy dev→staging, test, then staging→prod
3. **Monitor disk space**: Database dumps need temporary space
4. **Use PM2 in production**: For automatic restart and monitoring
5. **Document database switches**: Keep logs of when environments were switched

## 📞 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Copy takes too long | Normal for large databases (check with `ps aux \| grep pg_dump`) |
| Target DB already exists | It will be dropped automatically (data will be lost) |
| Server restart fails | Check PM2/systemd status, restart manually if needed |
| Can't access UI after restart | Wait 10-15 seconds, clear browser cache, try again |
| Data not showing after switch | Ensure server was restarted, check active environment |

## 🔗 Related Documentation

- Full Guide: [DATABASE_MULTI_ENV.md](DATABASE_MULTI_ENV.md)
- Database Backup: [DATABASE_BACKUP_FEATURE.md](DATABASE_BACKUP_FEATURE.md)
- PostgreSQL Setup: [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)
