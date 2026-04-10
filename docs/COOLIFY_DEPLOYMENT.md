# 🚀 Panduan Deploy KostMan ke Coolify

Panduan ini menjelaskan cara migrasi deployment KostMan dari systemd service ke **Coolify** — platform self-hosted PaaS yang mirip Heroku/Railway.

---

## 📋 Daftar Isi

1. [Prasyarat](#prasyarat)
2. [Cara Kerja Coolify](#cara-kerja-coolify)
3. [Setup Coolify di Server](#setup-coolify-di-server)
4. [Setup PostgreSQL di Coolify](#setup-postgresql-di-coolify)
5. [Deploy Aplikasi KostMan](#deploy-aplikasi-kostman)
6. [Konfigurasi Environment Variables](#konfigurasi-environment-variables)
7. [Database Migration](#database-migration)
8. [Domain & SSL](#domain--ssl)
9. [Persistent Storage](#persistent-storage)
10. [Migrasi dari Systemd](#migrasi-dari-systemd)
11. [Troubleshooting](#troubleshooting)

---

## Prasyarat

- Server Linux (Ubuntu 22.04 / Debian 12 direkomendasikan)
- Minimal **2 vCPU, 2GB RAM** (4GB direkomendasikan)
- Docker **sudah terinstall** di server
- Akses SSH ke server
- Domain yang sudah diarahkan ke IP server (opsional, bisa pakai IP langsung)
- Repository KostMan ada di **GitHub / GitLab / Gitea**

---

## Cara Kerja Coolify

Coolify bekerja dengan cara:
1. Pull source code dari Git repository kamu
2. Build Docker image menggunakan `Dockerfile` yang sudah ada
3. Jalankan container secara otomatis
4. Kelola reverse proxy (Traefik) untuk routing domain & SSL (Let's Encrypt)

> KostMan sudah memiliki `Dockerfile` yang siap pakai — tidak perlu konfigurasi tambahan.

---

## Setup Coolify di Server

### Install Coolify

SSH ke server kamu, lalu jalankan:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Proses instalasi akan:
- Install Docker (jika belum ada)
- Pull dan jalankan Coolify container
- Setup Traefik sebagai reverse proxy

Setelah selesai, akses Coolify di:
```
http://<IP_SERVER>:8000
```

### Buat Akun Admin

Buka browser, akses `http://<IP_SERVER>:8000`, lalu:
1. Daftarkan akun admin pertama kali
2. Setup nama instance Coolify kamu
3. Pilih server — pilih **"Localhost"** (server tempat Coolify berjalan)

---

## Setup PostgreSQL di Coolify

KostMan menggunakan PostgreSQL. Kamu bisa membuat database baru di Coolify.

### Langkah-langkah

1. Di dashboard Coolify → klik **"Resources"** → **"+ New"**
2. Pilih **"Database"** → Pilih **"PostgreSQL"**
3. Konfigurasi:
   - **Name**: `kostman-db`
   - **PostgreSQL Version**: `15` atau `16`
   - **Database Name**: `kostman`
   - **Username**: `kostman_user`
   - **Password**: buat password yang kuat (simpan!)
4. Klik **"Save"** → **"Start"**

### Catat Connection String

Setelah database aktif, Coolify akan menampilkan **Internal URL** dan **External URL**:

```
# Internal URL (digunakan oleh app di server yang sama)
postgresql://kostman_user:PASSWORD@localhost:5432/kostman

# Atau format URL yang ditampilkan Coolify:
postgresql://kostman_user:PASSWORD@kostman-db:5432/kostman
```

> **Penting**: Gunakan **Internal URL** agar komunikasi antar container lebih cepat dan aman.

---

## Deploy Aplikasi KostMan

### 1. Hubungkan Git Repository

Di Coolify → **"Sources"** → **"+ Add"**:
- Pilih **GitHub**, **GitLab**, atau **Gitea**
- Ikuti proses OAuth / token yang diminta
- Authorize akses ke repository `KostMan`

### 2. Buat Resource Baru

1. Klik **"Resources"** → **"+ New"** → **"Application"**
2. Pilih source: **GitHub** (atau sesuai platform kamu)
3. Pilih repository `KostMan`
4. Pilih branch: `main` (atau branch yang digunakan untuk production)

### 3. Konfigurasi Build

Di halaman konfigurasi aplikasi:

| Setting | Value |
|---|---|
| **Build Pack** | `Dockerfile` |
| **Dockerfile Location** | `/Dockerfile` |
| **Port** | `3000` |
| **Build Context** | `/` |

Coolify akan otomatis mendeteksi `Dockerfile` di root project.

### 4. Konfigurasi Healthcheck (Opsional tapi Disarankan)

Di tab **"Health Check"**:

```
Path: /api/health
Port: 3000
Interval: 30
Timeout: 10
Retries: 3
```

> Jika endpoint `/api/health` belum ada, bisa dilewati dulu.

---

## Konfigurasi Environment Variables

Di tab **"Environment Variables"** pada aplikasi KostMan, tambahkan semua variabel berikut:

### Variabel Wajib

```env
# App
NODE_ENV=production
NUXT_HOST=0.0.0.0
NUXT_PORT=3000

# Database (gunakan Internal URL dari PostgreSQL yang dibuat di Coolify)
DATABASE_URL=postgresql://kostman_user:PASSWORD@localhost:5432/kostman

# Security Keys (WAJIB diisi dengan nilai unik & rahasia)
# Generate dengan: openssl rand -hex 32
JWT_SECRET=isi-dengan-64-karakter-random-hex
ENCRYPTION_KEY=isi-dengan-64-karakter-random-hex
SESSION_SECRET=isi-dengan-64-karakter-random-hex
```

### Generate Security Keys

Jalankan di terminal server atau lokal (butuh openssl):

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"
```

### Variabel Opsional (Midtrans)

```env
MIDTRANS_SERVER_KEY=Mid-server-xxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=Mid-client-xxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
```

> Midtrans bisa dikonfigurasi lewat UI settings jika tidak diisi di sini.

---

## Database Migration

Setelah aplikasi deploy pertama kali, jalankan migrasi database.

### Opsi 1: Melalui Coolify Terminal

Di halaman aplikasi → tab **"Terminal"** → jalankan:

```bash
node -e "
const { drizzle } = require('drizzle-orm/node-postgres');
// atau gunakan script migrate yang sudah ada
"
```

Atau lebih mudah, tambahkan **Command Override** sementara di konfigurasi:

```bash
node -e "require('./server/database/migrate')" && node .output/server/index.mjs
```

### Opsi 2: Via SSH + Docker Exec

SSH ke server, lalu:

```bash
# Lihat container ID KostMan
docker ps | grep kostman

# Masuk ke container
docker exec -it <CONTAINER_ID> sh

# Jalankan migrasi dari dalam container
# (jika build output ada drizzle)
```

### Opsi 3: Auto-migrate saat Start (Rekomendasi)

Edit `Dockerfile` untuk jalankan migrasi sebelum start app:

```dockerfile
# Di stage production, ubah CMD menjadi:
CMD ["sh", "-c", "node -e \"import('./.output/server/index.mjs').then(m => m)\""]
```

Atau buat `entrypoint.sh`:

```bash
#!/bin/sh
echo "Running database migrations..."
# npm run db:migrate  # jika ada migration script

echo "Starting application..."
exec node .output/server/index.mjs
```

> **Catatan**: Untuk project ini, migration biasanya sudah embedded. Cek apakah app otomatis migrate saat start.

---

## Domain & SSL

### Setup Domain

1. Di halaman aplikasi Coolify → tab **"Domains"**
2. Tambahkan domain: `kostman.yourdomain.com`
3. Pastikan DNS record sudah diarahkan ke IP server:
   ```
   A  kostman.yourdomain.com  →  <IP_SERVER>
   ```

### SSL (Let's Encrypt)

Coolify otomatis request SSL certificate via Let's Encrypt melalui Traefik:

1. Aktifkan **"HTTPS"** di pengaturan domain
2. Aktifkan **"Force HTTPS"** untuk redirect HTTP → HTTPS
3. Tunggu beberapa menit hingga certificate aktif

> **Penting**: DNS harus sudah propagasi sebelum SSL bisa di-generate.

---

## Persistent Storage

Karena KostMan menggunakan PostgreSQL (bukan SQLite), data sudah persisten di container database Coolify.

### Backup Files (jika ada upload)

Jika aplikasi menyimpan file upload (misal foto profil, bill PDF), tambahkan volume:

Di tab **"Storages"** pada aplikasi:

```
Source (Host Path): /data/kostman/uploads
Destination (Container Path): /app/uploads
```

---

## Migrasi dari Systemd

Jika sebelumnya menggunakan systemd service (`kosman.service`), ikuti langkah berikut untuk migrasi:

### 1. Export Data dari Database Lama

```bash
# Di server lama
pg_dump -U mbx -h 10.100.10.5 kostMan_dev > kostman_backup_$(date +%Y%m%d).sql
```

### 2. Import ke Database PostgreSQL Coolify

Pertama, dapatkan port eksternal PostgreSQL dari Coolify (biasanya 5432 atau custom port):

```bash
# Copy file backup ke server
scp kostman_backup_*.sql user@server:/tmp/

# Restore ke database Coolify
psql -U kostman_user -h localhost -p <COOLIFY_DB_PORT> kostman < /tmp/kostman_backup_*.sql
```

Atau melalui Coolify terminal pada container PostgreSQL.

### 3. Stop Systemd Service

Setelah verifikasi data sudah benar di deployment Coolify:

```bash
# Hentikan dan disable service lama
sudo systemctl stop kosman
sudo systemctl disable kosman

# (Opsional) Hapus service file
sudo rm /etc/systemd/system/kosman.service
sudo systemctl daemon-reload
```

### 4. Update DNS

Pastikan domain kamu sekarang diarahkan ke reverse proxy Coolify (Traefik), bukan langsung ke port 3004.

---

## Deployment Otomatis (Auto Deploy)

Coolify mendukung auto-deploy saat ada push ke branch tertentu.

### Setup Webhook

1. Di aplikasi Coolify → tab **"Webhooks"**
2. Copy URL webhook yang diberikan
3. Di GitHub/GitLab repository → **Settings** → **Webhooks** → **Add webhook**
4. Paste URL, pilih event: **Push**

Sekarang setiap `git push origin main` akan otomatis trigger build & deploy baru di Coolify.

---

## Monitoring & Logs

### Lihat Logs

Di halaman aplikasi Coolify → tab **"Logs"**:
- Real-time logs dari container
- Filter berdasarkan waktu

### Via CLI di Server

```bash
# Lihat semua container yang berjalan
docker ps

# Lihat logs container KostMan
docker logs <CONTAINER_ID> -f --tail=100

# Lihat logs Traefik (reverse proxy)
docker logs traefik -f
```

---

## Troubleshooting

### Build Gagal

**Masalah**: Build Docker gagal karena `better-sqlite3` atau dependency native.

**Solusi**: Dockerfile sudah meng-handle ini dengan `apk add python3 make g++`. Pastikan tidak ada perubahan di Dockerfile yang menghapus langkah ini.

---

### Coolify Tidak Bisa Akses GitHub

**Masalah**: Deployment gagal sebelum build dimulai, dengan error seperti:

```bash
fatal: unable to access 'https://github.com/mbx92/KostMan/': Could not resolve host: github.com
```

**Penyebab**: Container helper Coolify tidak bisa melakukan DNS resolve ke `github.com`. Ini biasanya masalah DNS / outbound network di host Docker, bukan masalah pada aplikasi KostMan.

**Solusi**:
1. Verifikasi DNS dari host server:
   ```bash
   getent hosts github.com
   nslookup github.com
   curl -I https://github.com
   ```
2. Verifikasi DNS dari network Docker / Coolify:
   ```bash
   docker run --rm --network coolify alpine:3.20 sh -c "apk add --no-cache bind-tools curl >/dev/null && nslookup github.com && curl -I https://github.com"
   ```
3. Jika host bisa resolve tapi container tidak, set DNS Docker secara eksplisit di `/etc/docker/daemon.json`:
   ```json
   {
     "dns": ["1.1.1.1", "8.8.8.8"]
   }
   ```
4. Restart Docker dan container Coolify:
   ```bash
   sudo systemctl restart docker
   docker ps --format '{{.Names}}' | grep coolify
   docker restart coolify
   ```
5. Jika masih gagal, cek firewall / outbound policy server. Pastikan traffic keluar ke DNS (`53/tcp`, `53/udp`) dan HTTPS (`443/tcp`) tidak diblokir.

**Catatan**: Error ini terjadi sebelum `Dockerfile` project dijalankan, jadi perubahan aplikasi tidak akan memperbaikinya sampai konektivitas server ke GitHub normal.

---

### Aplikasi Tidak Bisa Koneksi ke Database

**Masalah**: `DATABASE_URL` salah atau container tidak bisa saling komunikasi.

**Solusi**:
1. Cek environment variable `DATABASE_URL` di Coolify
2. Pastikan menggunakan **Internal URL** dari PostgreSQL Coolify
3. Format yang benar: `postgresql://user:pass@SERVICE_NAME:5432/dbname`
4. Cek apakah kedua service ada di network yang sama di Coolify

---

### SSL Certificate Tidak Aktif

**Masalah**: HTTPS tidak bekerja.

**Solusi**:
1. Pastikan DNS sudah propagasi (cek dengan `nslookup domain.com`)
2. Pastikan port 80 dan 443 terbuka di firewall server:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   ```
3. Cek log Traefik untuk error Let's Encrypt

---

### Port Conflict dengan Deployment Lama

**Masalah**: Port 3004 masih dipakai systemd service lama.

**Solusi**:
```bash
# Cek proses yang pakai port 3004
sudo lsof -i :3004

# Stop service lama
sudo systemctl stop kosman
```

Coolify menggunakan Traefik di port 80/443, tidak mengekspos port aplikasi langsung.

---

### Coolify Tidak Bisa Pull dari Private Repository

**Masalah**: Build gagal karena repository private.

**Solusi**:
1. Di Coolify → **Sources** → pastikan GitHub/GitLab sudah terkoneksi
2. Atau gunakan deploy key — buat SSH key dan tambahkan ke repository sebagai deploy key

---

## Perbandingan: Systemd vs Coolify

| Aspek | Systemd Service | Coolify |
|---|---|---|
| **Setup** | Manual, perlu konfigurasi server | GUI-based, mudah |
| **Deploy** | Manual SSH + pull + restart | Auto-deploy via Git push |
| **SSL** | Manual (certbot) | Otomatis (Let's Encrypt) |
| **Rollback** | Manual | Satu klik di Coolify |
| **Monitoring** | `journalctl` | Web UI + logs |
| **Multiple Apps** | Perlu config tiap app | Managed via satu dashboard |
| **Database** | External / manual | Bisa create & manage di UI |
| **Resource Usage** | Ringan | Lebih berat (Docker overhead) |

---

## Referensi

- [Coolify Documentation](https://coolify.io/docs)
- [Coolify GitHub](https://github.com/coollabsio/coolify)
- [Nuxt.js Deployment Guide](https://nuxt.com/docs/getting-started/deployment)
- [KostMan Dockerfile](../Dockerfile)
- [KostMan Docker Compose](../docker-compose.yml)
