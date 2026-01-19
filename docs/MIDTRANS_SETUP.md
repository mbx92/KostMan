# Setup Midtrans - Panduan Singkat

## ⚠️ PENTING

**Kredensial Midtrans disimpan di DATABASE, bukan di `.env`**

File `.env` hanya untuk sync awal, setelah itu semua dikelola via UI Settings.

---

## Langkah Setup

### 1️⃣ Pastikan .env terisi (untuk sync awal)

```env
MIDTRANS_SERVER_KEY=Mid-server-xxx
MIDTRANS_CLIENT_KEY=Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
```

### 2️⃣ Sync ke Database

```bash
npx tsx scripts/sync-midtrans-env.ts
```

Output:
```
🔄 Syncing Midtrans credentials from .env to database...
📍 Syncing for user: admin@example.com (uuid-xxx)
➕ Creating new Midtrans integration...
✅ Midtrans integration created successfully!

📋 Summary:
   Provider: midtrans
   Client Key: Mid-client-xxx
   Server Key: Mid-server...
   Mode: SANDBOX
   Status: ENABLED

🎉 Done! You can now see the settings in the UI.
```

### 3️⃣ Verifikasi di UI

1. Login ke aplikasi
2. Buka **Settings** → **Payment Integrations**
3. Seharusnya sudah terisi dan toggle **ON**

### 4️⃣ Update Kredensial (Opsional)

Bisa diubah langsung via UI Settings tanpa restart server.

---

## Cara Kerja

### Sebelum (❌ Tidak Fleksibel)
```
.env → Hardcoded → All users pakai credentials sama
```

### Sekarang (✅ Fleksibel)
```
.env → Database (encrypted) → Per-user credentials
     ↓
Settings UI → Update langsung
```

---

## Troubleshooting

### Form Settings kosong?
```bash
npx tsx scripts/sync-midtrans-env.ts
```

### Error "Payment gateway not configured"?
1. Buka Settings
2. Toggle Midtrans ON
3. Pastikan Server Key & Client Key terisi
4. Save

### Webhook Invalid Signature?
Pastikan Server Key di Settings sama dengan di Midtrans Dashboard.

---

## File yang Berubah

✅ `server/api/payments/midtrans/create.post.ts` - Ambil dari DB  
✅ `server/api/payments/midtrans/webhook.post.ts` - Verify dari DB  
✅ `server/api/payments/midtrans/status/[orderId].get.ts` - Check dari DB  
✅ `server/api/settings/integrations/[provider].put.ts` - Save & encrypt  
✅ `app/pages/settings/index.vue` - UI Form  

---

## Production Deployment

1. Set `ENCRYPTION_KEY` di environment (untuk encrypt/decrypt)
2. Run sync script sekali
3. Via UI Settings, toggle Production Mode ON
4. Ganti credentials dengan Production keys
5. Test payment flow

---

📖 **Dokumentasi Lengkap**: [docs/MIDTRANS_INTEGRATION.md](./MIDTRANS_INTEGRATION.md)
