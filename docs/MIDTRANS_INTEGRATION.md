# Midtrans Integration Setup

## Arsitektur

Aplikasi KostMan menyimpan **kredensial Midtrans di database**, bukan di environment variables. Ini memungkinkan:

✅ **Multi-user support** - Setiap user memiliki kredensial sendiri  
✅ **Dynamic configuration** - Bisa diubah via UI tanpa restart  
✅ **Security** - Server key dienkripsi dengan AES-256  
✅ **Flexibility** - Bisa pakai Sandbox dan Production mode berbeda per user  

## Setup Awal

### 1. Environment Variables (Opsional - Hanya untuk Sync Awal)

File `.env` hanya digunakan untuk **initial sync** ke database:

```env
MIDTRANS_SERVER_KEY=Mid-server-xxx
MIDTRANS_CLIENT_KEY=Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
```

### 2. Sync ke Database

Jalankan script untuk sync credentials dari `.env` ke database:

```bash
npx tsx scripts/sync-midtrans-env.ts
```

Script ini akan:
- ✅ Mengambil credentials dari `.env`
- ✅ Encrypt server key dengan AES-256
- ✅ Menyimpan ke tabel `integration_settings`
- ✅ Link dengan user pertama di database

### 3. Konfigurasi via UI

Setelah sync, Anda bisa mengubah kredensial via **halaman Settings**:

1. Login ke aplikasi
2. Buka **Settings** → **Payment Integrations**
3. Toggle **Midtrans** → ON
4. Isi **Server Key** dan **Client Key**
5. Set **Production Mode** (ON/OFF)
6. Klik **Save Configuration**

## Database Schema

```sql
CREATE TABLE integration_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50),  -- 'midtrans'
  is_enabled BOOLEAN,
  server_key VARCHAR(255),  -- ENCRYPTED
  client_key VARCHAR(255),
  is_production BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, provider)
);
```

## Enkripsi

**Server Key** dienkripsi menggunakan:
- **Algorithm**: AES-256-CBC
- **Encryption Key**: `ENCRYPTION_KEY` dari `.env`
- **Decrypt**: Hanya dilakukan server-side saat payment processing

**Client Key** tidak dienkripsi (karena akan exposed di frontend).

## Cara Kerja

### 1. Payment Link Generation
```typescript
// Backend otomatis ambil credentials dari database user
const config = await getDecryptedIntegration(userId, 'midtrans')
const snapUrl = await createMidtransTransaction(config.serverKey, paymentData)
```

### 2. Webhook Verification
```typescript
// Webhook ambil credentials user yang aktif
const config = await db.select()
  .from(integrationSettings)
  .where(eq(integrationSettings.isEnabled, true))
  .limit(1)

const serverKey = decrypt(config.serverKey)
verifySignature(serverKey, webhookData)
```

### 3. Status Check
```typescript
// Status check pakai credentials user yang login
const config = await getUserMidtransConfig(userId)
const status = await checkMidtransStatus(config.serverKey, orderId)
```

## Migration dari .env

Jika sebelumnya pakai `.env`, lakukan:

1. ✅ Pastikan credentials ada di `.env`
2. ✅ Run `npx tsx scripts/sync-midtrans-env.ts`
3. ✅ Verifikasi di UI Settings → Payment Integrations
4. ❌ **JANGAN** hapus `.env` dulu (backup)
5. ✅ Test payment flow
6. ✅ Setelah yakin OK, bisa hapus dari `.env` (opsional)

## Troubleshooting

### Form Settings Kosong?

**Penyebab**: Database belum diisi.

**Solusi**:
```bash
npx tsx scripts/sync-midtrans-env.ts
```

### "Invalid Signature" di Webhook?

**Penyebab**: Server key di database tidak match dengan Midtrans.

**Solusi**:
1. Cek di Midtrans Dashboard → Settings → Access Keys
2. Update via UI Settings atau re-run sync script

### "Payment gateway not configured"?

**Penyebab**: Integration tidak enabled atau user belum setup.

**Solusi**:
1. Buka Settings → Payment Integrations
2. Toggle Midtrans → ON
3. Simpan kredensial yang valid

## Production Checklist

Sebelum deploy production:

- [ ] Set `MIDTRANS_IS_PRODUCTION=true` di `.env` atau
- [ ] Toggle **Production Mode = ON** di UI Settings
- [ ] Ganti Server Key & Client Key dengan Production keys
- [ ] Test webhook dengan Midtrans Webhook Tester
- [ ] Verifikasi signature verification works
- [ ] Set environment variable `ENCRYPTION_KEY` yang kuat

## API Endpoints

### Get Integrations
```http
GET /api/settings/integrations
Authorization: Bearer <token>

Response:
{
  "midtrans": {
    "isEnabled": true,
    "serverKey": "***hidden***",  // Masked for security
    "clientKey": "Mid-client-xxx",
    "isProduction": false
  }
}
```

### Update Integration
```http
PUT /api/settings/integrations/midtrans
Authorization: Bearer <token>
Content-Type: application/json

{
  "isEnabled": true,
  "serverKey": "Mid-server-xxx",
  "clientKey": "Mid-client-xxx",
  "isProduction": false
}
```

## Security Notes

1. **Server Key** selalu dienkripsi di database
2. **Server Key** di-mask (`***hidden***`) di response API GET
3. **Server Key** hanya didekripsi saat payment processing
4. **Client Key** tidak dienkripsi (akan exposed ke frontend)
5. **Environment variables** hanya untuk initial setup, tidak dipakai runtime

## Best Practices

1. ✅ Gunakan UI Settings untuk update credentials
2. ✅ Jangan commit `.env` ke git
3. ✅ Rotate keys secara berkala
4. ✅ Monitor webhook logs
5. ✅ Set up Midtrans IP whitelist jika production

---

**Dokumentasi**: [Midtrans Snap Documentation](https://docs.midtrans.com/en/snap/overview)  
**Dashboard**: [Midtrans Dashboard](https://dashboard.midtrans.com/)
