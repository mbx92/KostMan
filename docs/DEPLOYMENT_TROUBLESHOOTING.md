# 🚨 Deployment Troubleshooting Guide

## Error: "Failed to fetch dynamically imported module"

### Symptoms
```
Failed to load module script: Expected a JavaScript-or-Wasm module 
script but the server responded with a MIME type of "text/css"
```

### Root Causes
1. ❌ Corrupted build cache
2. ❌ Incorrect base URL configuration
3. ❌ NGINX/reverse proxy misconfiguration
4. ❌ Node modules cache issue

---

## 🔧 Solution 1: Clean Rebuild (Most Common)

```bash
# SSH to server
ssh user@your-server.com
cd /path/to/KostMan

# Stop application
pm2 stop kostman

# Clean everything
npm run clean
rm -rf .nuxt .output node_modules/.cache

# Rebuild
npm run build

# Restart
pm2 restart kostman
# or for fresh start
pm2 delete kostman
pm2 start npm --name kostman -- start
pm2 save
```

---

## 🔧 Solution 2: Check Nuxt Config

Pastikan `nuxt.config.ts` punya base URL yang benar:

```typescript
export default defineNuxtConfig({
  app: {
    baseURL: '/',  // For root domain
    // OR
    baseURL: '/kostman/',  // If in subdirectory
    
    buildAssetsDir: '/_nuxt/',
  },
  
  // For production
  nitro: {
    preset: 'node-server',
  },
})
```

---

## 🔧 Solution 3: NGINX Configuration

Jika pakai NGINX reverse proxy, pastikan config benar:

```nginx
server {
    listen 80;
    server_name demo.ocnetworks.web.id;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # IMPORTANT: Set correct MIME types
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve static assets correctly
    location /_nuxt/ {
        proxy_pass http://localhost:3000/_nuxt/;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Restart NGINX:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔧 Solution 4: Use Deployment Script

```bash
# Run automated deployment
bash scripts/deploy-production.sh
```

Script ini akan:
- ✅ Stop app
- ✅ Clean cache
- ✅ Rebuild
- ✅ Migrate DB
- ✅ Restart app

---

## 🔧 Solution 5: Docker Rebuild

Jika pakai Docker:

```bash
# Stop containers
docker-compose down

# Remove images & rebuild
docker-compose build --no-cache

# Start fresh
docker-compose up -d

# Check logs
docker-compose logs -f app
```

---

## 🔧 Solution 6: Check File Permissions

```bash
# Ensure correct ownership
sudo chown -R $USER:$USER /path/to/KostMan

# Fix permissions
chmod -R 755 /path/to/KostMan
chmod -R 777 /path/to/KostMan/.nuxt
chmod -R 777 /path/to/KostMan/.output
```

---

## 🔧 Solution 7: Environment Variables

Pastikan `.env` production punya setting yang benar:

```env
NODE_ENV=production
NUXT_HOST=0.0.0.0
NUXT_PORT=3000
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
ENCRYPTION_KEY="..."
SESSION_SECRET="..."
```

---

## 🐛 Debugging Steps

### 1. Check PM2 Logs
```bash
pm2 logs kostman --lines 100
```

### 2. Check NGINX Error Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### 3. Test Direct Access
```bash
# Bypass NGINX, test Node directly
curl http://localhost:3000

# Should return HTML, not error
```

### 4. Check Build Output
```bash
ls -la .output/public/_nuxt/

# Should see .js and .css files
```

### 5. Verify MIME Types
```bash
# Check server response
curl -I https://demo.ocnetworks.web.id/_nuxt/entry.js

# Should show:
# Content-Type: application/javascript
# NOT: text/css
```

---

## 🚀 Quick Recovery Command

```bash
cd /path/to/KostMan && \
pm2 stop kostman && \
rm -rf .nuxt .output node_modules/.cache && \
npm run build && \
pm2 restart kostman && \
pm2 logs kostman
```

---

## ✅ Verification Checklist

After deployment:

- [ ] `pm2 status` shows app running
- [ ] `pm2 logs kostman` shows no errors
- [ ] Can access login page without JS errors
- [ ] Browser console shows no 404s
- [ ] `/_nuxt/` assets load correctly
- [ ] Login functionality works

---

## 📞 Still Not Working?

### Check Browser Console
1. Open DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Look for 404s or CORS errors

### Common Issues

**Issue:** 404 on `/_nuxt/entry.js`
**Fix:** Rebuild app, check baseURL config

**Issue:** CORS errors
**Fix:** Add CORS headers in NGINX or nuxt config

**Issue:** Mixed content (HTTP/HTTPS)
**Fix:** Ensure all resources use HTTPS

---

## 🔄 Full Reset Procedure

If nothing works, full reset:

```bash
# 1. Stop everything
pm2 stop kostman
sudo systemctl stop nginx

# 2. Full clean
cd /path/to/KostMan
rm -rf .nuxt .output node_modules
npm install

# 3. Fresh build
npm run build

# 4. Restart services
pm2 start npm --name kostman -- start
pm2 save
sudo systemctl start nginx

# 5. Verify
pm2 logs kostman
curl http://localhost:3000
```

---

**Last Updated:** January 21, 2026
