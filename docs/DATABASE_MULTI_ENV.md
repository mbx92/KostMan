# Database Configuration Feature - KostMan

## 📋 Overview

Fitur Multi-Environment Database Configuration memungkinkan administrator untuk mengelola dan beralih antara konfigurasi database yang berbeda untuk Development, Staging, dan Production. Dilengkapi dengan tools untuk copy database dan restart server dari UI.

## ✨ Features

- ✅ **Multiple Database Environments** - Simpan konfigurasi untuk Dev, Staging, dan Production
- ✅ **Easy Switching** - Beralih antar database dengan satu klik
- ✅ **Database Copy Tool** - Clone database lengkap dengan semua data
- ✅ **Server Restart** - Restart aplikasi dari UI tanpa SSH
- ✅ **Secure Storage** - Database credentials disimpan dengan aman di `system_settings` table
- ✅ **Password Masking** - Password di-mask saat ditampilkan untuk keamanan
- ✅ **Admin Only** - Hanya admin yang dapat mengakses fitur ini

## 🎯 Use Cases

1. **Development & Testing** - Developer bisa switch antara database lokal dan staging
2. **Multi-Tenant Setup** - Kelola koneksi ke database client yang berbeda
3. **Backup Database** - Maintain backup database connection untuk failover
4. **Data Migration** - Test migrasi di staging sebelum apply ke production
5. **Quick Database Clone** - Copy kostMan_dev ke kostman_prod dengan satu klik
6. **Remote Server Management** - Restart server tanpa perlu SSH access

## 🚀 Quick Start

### 1. Akses Database Configuration

1. Login sebagai **Admin**
2. Navigasi ke **Settings** (menu kiri atau `/settings`)
3. Scroll ke section **Database Configuration**
4. Klik tombol **Configure Databases**

### 2. Configure Database URLs

Di halaman Database Configuration:

1. Masukkan connection URL untuk setiap environment:
   - **Development**: Database lokal atau development server
   - **Staging**: Database staging/testing
   - **Production**: Database production

2. Format URL:
   ```
   postgresql://[user]:[password]@[host]:[port]/[database]
   ```

3. Contoh:
   ```
   postgresql://kostman_dev:MyPass123@localhost:5432/kostman_dev
   postgresql://kostman_stage:StagePass@staging.example.com:5432/kostman_staging
   postgresql://kostman_prod:ProdPass@production.example.com:5432/kostman_prod
   ```

4. Klik **Save Configuration**

### 3. Switch Active Environment

1. Di bagian **Active Environment**, pilih environment yang diinginkan
2. Klik tombol **Switch to [Environment]**
3. Server akan menggunakan database yang dipilih
4. **⚠️ Restart server** untuk perubahan fully aktif

### 4. Copy Database (Clone kostMan_dev ke kostman_prod)

Di halaman Database Configuration, scroll ke section **Copy Database**:

1. **Source Database**: Masukkan nama database sumber (default: `kostMan_dev`)
2. **Target Database**: Masukkan nama database tujuan (contoh: `kostman_prod`)
3. Klik **Copy Database**
4. Tunggu proses selesai (beberapa menit untuk database besar)
5. Database baru siap digunakan!

**⚠️ Warning**: Target database akan di-drop dan dibuat ulang jika sudah ada!

**Alternatif via Command Line**:
```bash
# Copy kostMan_dev ke kostman_prod
bash scripts/copy-database.sh kostMan_dev kostman_prod

# Or with default values
bash scripts/copy-database.sh
```

### 5. Restart Server dari UI

Setelah switch environment atau copy database, restart server:

1. Di halaman Database Configuration, scroll ke section **Server Control**
2. Klik **Restart Server**
3. Halaman akan reload otomatis setelah server restart
4. Login kembali jika diperlukan

**Note**: Fitur ini memerlukan PM2 atau systemd untuk auto-restart.

## 📡 API Endpoints

### GET `/api/database-config`

Mendapatkan konfigurasi database saat ini.

**Authorization**: Admin only

**Response**:
```json
{
  "activeEnvironment": "development",
  "environments": {
    "development": {
      "url": "postgresql://user:pass@localhost:5432/db",
      "masked": "postgresql://user:p***s@localhost:5432/db"
    },
    "staging": {
      "url": "postgresql://user:pass@staging:5432/db",
      "masked": "postgresql://user:p***s@staging:5432/db"
    },
    "production": {
      "url": "postgresql://user:pass@prod:5432/db",
      "masked": "postgresql://user:p***s@prod:5432/db"
    }
  }
}
```

### PUT `/api/database-config`

Update konfigurasi database.

**Authorization**: Admin only

**Request Body**:
```json
{
  "development": "postgresql://user:pass@localhost:5432/db",
  "staging": "postgresql://user:pass@staging:5432/db",
  "production": "postgresql://user:pass@prod:5432/db"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Database configuration updated successfully",
  "updatedEnvironments": ["development", "staging", "production"]
}
```

### POST `/api/database-config/switch`

Switch active database environment.

**Authorization**: Admin only

**Request Body**:
```json
{
  "environment": "staging"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Database environment switched to staging",
  "activeEnvironment": "staging",
  "note": "Server restart may be required for changes to take full effect"
}
```

### POST `/api/database-config/copy`

Copy/clone entire database to a new database.

**Authorization**: Admin only

**Request Body**:
```json
{
  "sourceDb": "kostMan_dev",
  "targetDb": "kostman_prod",
  "sourceUrl": "postgresql://user:pass@host:5432/source_db", // optional
  "targetUrl": "postgresql://user:pass@host:5432/target_db"  // optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "Database copied successfully from kostMan_dev to kostman_prod",
  "sourceDatabase": "kostMan_dev",
  "targetDatabase": "kostman_prod"
}
```

**Notes**:
- If URLs not provided, uses current DATABASE_URL
- Target database will be dropped if exists
- All data and schema copied
- May take several minutes for large databases

### POST `/api/system/restart`

Restart the application server.

**Authorization**: Admin only

**Request Body** (optional):
```json
{
  "method": "pm2" // or "process"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Server restart initiated via PM2",
  "method": "pm2",
  "note": "Server will restart in a few seconds"
}
```

**Notes**:
- Uses PM2 if available, otherwise process.exit()
- Requires PM2 or systemd for auto-restart
- Page will auto-reload after restart

## 🗄️ Database Schema

Konfigurasi disimpan di tabel `system_settings`:

| Key | Description | Example Value |
|-----|-------------|---------------|
| `db_config_development` | Development DB URL | `postgresql://...` |
| `db_config_staging` | Staging DB URL | `postgresql://...` |
| `db_config_production` | Production DB URL | `postgresql://...` |
| `db_active_environment` | Currently active env | `development` |

## 🔐 Security

- ✅ **Admin-only access** - Hanya role admin yang bisa akses
- ✅ **Password masking** - Password tidak ditampilkan penuh di UI
- ✅ **Secure storage** - Credentials tersimpan di database
- ⚠️ **Recommendation**: Gunakan encrypted connections (SSL) untuk production

## ⚙️ Configuration Files

### Backend API
- `server/api/database-config/index.get.ts` - GET endpoint
- `server/api/database-config/index.put.ts` - PUT endpoint
- `server/api/database-config/switch.post.ts` - Switch endpoint
- `server/api/database-config/copy.post.ts` - **NEW** Copy/clone database endpoint
- `server/api/system/restart.post.ts` - **NEW** Server restart endpoint

### Frontend UI
- `app/pages/settings/database-config.vue` - Admin UI page (with copy & restart tools)
- `app/pages/settings/index.vue` - Settings menu (updated)

### Scripts
- `scripts/copy-database.sh` - **NEW** CLI tool for copying databases

## 📝 Implementation Details

### Password Masking Logic

```typescript
function maskDatabaseUrl(url: string): string {
  const parsed = new URL(url)
  const password = parsed.password
  
  if (password) {
    const masked = password.length > 2 
      ? password[0] + '*'.repeat(password.length - 2) + password[password.length - 1]
      : '*'.repeat(password.length)
    
    parsed.password = masked
  }
  
  return parsed.toString()
}
```

### Environment Badge Colors

| Environment | Color | Icon |
|------------|-------|------|
| Development | Blue | Code Bracket |
| Staging | Amber | Beaker |
| Production | Red | Server |

## 🧪 Testing

### Manual Testing Steps

1. **Setup Test**:
   ```bash
   # Create test databases
   createdb kostman_dev
   createdb kostman_staging
   createdb kostman_prod
   ```

2. **Configure URLs**:
   - Navigate to `/settings/database-config`
   - Add all three database URLs
   - Save configuration

3. **Switch Environments**:
   - Switch to staging
   - Verify active environment changes
   - Check if data from staging DB appears

4. **Restart Server**:
   ```bash
   npm run dev
   # or
   pm2 restart kostman
   ```

### API Testing

```bash
# Get current config
curl -X GET http://localhost:3000/api/database-config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Update config
curl -X PUT http://localhost:3000/api/database-config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "development": "postgresql://user:pass@localhost:5432/dev_db"
  }'

# Switch environment
curl -X POST http://localhost:3000/api/database-config/switch \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"environment": "staging"}'

# Copy database
curl -X POST http://localhost:3000/api/database-config/copy \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceDb": "kostMan_dev",
    "targetDb": "kostman_prod"
  }'

# Restart server
curl -X POST http://localhost:3000/api/system/restart \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method": "pm2"}'
```

### Testing Database Copy

1. **Verify source database has data**:
   ```bash
   psql -h 10.100.10.5 -U mbx -d kostMan_dev -c "SELECT COUNT(*) FROM users;"
   ```

2. **Run copy via UI** or CLI:
   ```bash
   bash scripts/copy-database.sh kostMan_dev kostman_prod
   ```

3. **Verify target database**:
   ```bash
   psql -h 10.100.10.5 -U mbx -d kostman_prod -c "SELECT COUNT(*) FROM users;"
   ```

4. **Compare data**:
   ```bash
   # Should have same number of records
   psql -h 10.100.10.5 -U mbx -d kostMan_dev -c "SELECT COUNT(*) FROM properties;" 
   psql -h 10.100.10.5 -U mbx -d kostman_prod -c "SELECT COUNT(*) FROM properties;"
   ```

### Testing Server Restart

1. **Check current uptime**:
   ```bash
   pm2 status  # or systemctl status kostman
   ```

2. **Trigger restart from UI**:
   - Go to Database Configuration page
   - Click "Restart Server" button
   - Page should reload automatically

3. **Verify restart**:
   ```bash
   pm2 status  # Check restart count increased
   # or
   systemctl status kostman
   ```

## ⚠️ Important Notes

1. **Server Restart**: Setelah switch environment, restart server untuk perubahan fully aktif
2. **Migration**: Pastikan schema database sama antar environment
3. **Backup First**: Selalu backup sebelum switch ke database baru
4. **Testing**: Test di development/staging sebelum switch production
5. **Permissions**: Database user harus punya permissions yang sesuai
6. **Database Copy**: 
   - Target database akan di-DROP jika sudah ada
   - Semua data di target akan hilang
   - Proses bisa memakan waktu untuk database besar
   - Pastikan disk space cukup untuk dump file
7. **Server Restart Requirements**:
   - Memerlukan PM2 atau systemd untuk auto-restart
   - Tanpa process manager, server akan mati tanpa restart
   - Gunakan PM2 di production untuk reliability

## 🔄 Workflow Example

### Scenario: Testing di Staging

1. **Current State**: Production database aktif
2. **Prepare Staging**:
   - Configure staging database URL
   - Verify staging DB has latest schema
3. **Switch to Staging**:
   - Click "Switch to Staging"
   - Restart application
4. **Test Features**:
   - Test new features di staging
   - Verify data integrity
5. **Switch Back**:
   - Switch back to production
   - Restart application

### Scenario: Multi-Tenant Setup

1. **Tenant A Database**:
   - Configure as production
   - Default active environment
2. **Tenant B Database**:
   - Configure as staging
   - Switch when serving Tenant B
3. **Development Database**:
   - Configure as development
   - For testing new features

### Scenario: Copy Dev to Production

1. **Preparation**:
   - Ensure kostMan_dev has clean, production-ready data
   - Backup existing kostman_prod if needed
   - Check disk space availability

2. **Copy Process**:
   - Go to Database Configuration page
   - Scroll to "Copy Database" section
   - Source: `kostMan_dev`
   - Target: `kostman_prod`
   - Click "Copy Database"
   - Wait for completion (shows success toast)

3. **Configure Production URL**:
   - Update Production database URL to point to `kostman_prod`
   - Save configuration

4. **Switch to Production**:
   - Click "Switch to Production"
   - Click "Restart Server"
   - System now uses production database

5. **Verify**:
   - Check if data appears correctly
   - Test core functionality
   - Monitor logs for errors

## 📊 UI Components

### Active Environment Display
- Visual cards showing all three environments
- Current active environment highlighted
- Quick switch buttons
- Real-time status badges

### Configuration Form
- Secure password inputs with show/hide toggle
- URL validation
- Help text with format examples
- Save/Reset buttons

### Information Panels
- Connection URL format guide
- Security warnings
- Tips and best practices
- Restart notifications

## 🎨 UI Features

- 🎨 **Color-coded environments** - Easy visual identification
- 👁️ **Password visibility toggle** - Show/hide sensitive data
- 🔄 **One-click switching** - Quick environment changes
- 📱 **Responsive design** - Works on all screen sizes
- 🌙 **Dark mode support** - Follows system theme

## 🚧 Future Enhancements

Potential improvements:

1. **Auto-reconnection** - Automatic database reconnection without restart
2. **Connection Testing** - Test button to verify DB connection
3. **Connection Pooling** - Pool multiple connections
4. **Audit Log** - Track who switched environments and when
5. **Environment Variables** - Integration with .env files
6. **Database Migration Tools** - Migrate schema between environments
7. **Health Monitoring** - Monitor database connection health
8. **Backup Before Switch** - Auto-backup before environment switch

## 📞 Support

Jika ada pertanyaan atau issues:
1. Check error logs di `/settings/logs`
2. Verify database credentials
3. Ensure database is accessible
4. Check network connectivity
5. Review server logs for connection errors

---

**Implementation Date**: February 14, 2026  
**Status**: ✅ Production Ready  
**Access Level**: Admin Only
