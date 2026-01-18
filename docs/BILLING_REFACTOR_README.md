# 🔄 Billing System Refactoring

## Overview

Sistem billing KostMan telah di-refactor dari sistem terpisah (rent_bills + utility_bills) menjadi **sistem billing terkonsolidasi** yang lebih efisien dan mudah dikelola.

## 🎯 Tujuan Refactoring

1. **Satu Tagihan Komprehensif** - Satu tagihan mencakup sewa, utilitas, dan biaya lainnya
2. **Perhitungan Presisi** - Tanggal exact (YYYY-MM-DD) untuk kalkulasi yang akurat
3. **Multi-Month Support** - Generate tagihan untuk beberapa bulan sekaligus
4. **Reporting Lebih Baik** - Data terkonsolidasi untuk analisis keuangan
5. **Biaya Gateway Lebih Rendah** - Satu transaksi per penyewa

## 📁 File Structure

```
server/
├── database/
│   └── schema.ts                    # ✅ Updated with new billing tables
├── validations/
│   └── billing.ts                   # ✅ New validation schemas
├── utils/
│   └── billing.ts                   # ✅ NEW - Billing calculation utilities
└── api/
    └── bills/
        ├── generate.post.ts         # ✅ Generate consolidated bill
        ├── index.get.ts             # ✅ List bills with filters
        ├── [id].get.ts              # ✅ Get bill details
        ├── [id].put.ts              # ✅ Update bill
        ├── [id].delete.ts           # ✅ Delete draft bill
        └── [id]/
            └── payment.post.ts      # ✅ Record payment

scripts/
└── migrate-billing.ts               # ✅ NEW - Migration script

docs/
├── BILLING_REFACTOR_PLAN.md         # 📋 Original refactor plan
├── BILLING_API.md                   # 📚 API documentation
├── BILLING_IMPLEMENTATION_CHECKLIST.md  # ✅ Implementation checklist
└── BILLING_IMPLEMENTATION_SUMMARY.md    # 📊 Implementation summary
```

## 🗄️ Database Schema

### New Tables

#### `billings`
Main bill record dengan informasi periode, status, dan total amount.

```typescript
{
  id: uuid,
  roomId: uuid,
  tenantId: uuid,
  billingCode: string,        // BILL-2026-01-001
  billStatus: enum,           // draft | unpaid | paid
  periodStart: date,          // YYYY-MM-DD
  periodEnd: date,            // YYYY-MM-DD
  monthsCovered: decimal,     // 1.00, 0.50, 3.00, etc.
  totalChargedAmount: decimal,
  notes: string,
  generatedBy: uuid,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `billing_details`
Line items untuk setiap tagihan.

```typescript
{
  id: uuid,
  billId: uuid,
  itemType: enum,             // rent | utility | others
  itemName: string,
  itemQty: decimal,
  itemUnitPrice: decimal,
  itemSubAmount: decimal,
  itemDiscount: decimal,
  itemTotalAmount: decimal,
  notes: string
}
```

#### `payments`
Tracking pembayaran untuk tagihan.

```typescript
{
  id: uuid,
  billId: uuid,
  paymentMethod: enum,        // cash | online
  paymentAmount: decimal,
  paymentDate: date,
  paymentProof: string,
  processedBy: uuid,
  notes: string
}
```

## 🔧 API Endpoints

### Generate Bill
```bash
POST /api/bills/generate
```

Generate tagihan baru dengan kalkulasi otomatis untuk rent dan utility.

**Request Body:**
```json
{
  "roomId": "uuid",
  "tenantId": "uuid",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "notes": "Optional notes",
  "additionalCharges": [
    {
      "itemName": "Parkir",
      "itemQty": 1,
      "itemUnitPrice": 50000
    }
  ]
}
```

### List Bills
```bash
GET /api/bills?billStatus=unpaid&roomId=uuid
```

### Get Bill Detail
```bash
GET /api/bills/:id
```

### Update Bill
```bash
PUT /api/bills/:id
```

### Delete Bill
```bash
DELETE /api/bills/:id
```

### Record Payment
```bash
POST /api/bills/:id/payment
```

**Request Body:**
```json
{
  "paymentMethod": "cash",
  "paymentAmount": 1200000,
  "paymentDate": "2026-01-15"
}
```

## 🧮 Business Logic

### Months Covered Calculation

Sistem menghitung `monthsCovered` dengan algoritma:

1. Hitung total hari dalam periode (inclusive)
2. Identifikasi semua bulan dalam periode
3. Hitung rata-rata hari per bulan
4. Bagi total hari dengan rata-rata

**Contoh:**
- Periode: 2026-01-01 to 2026-03-31
- Total hari: 90
- Bulan: Jan (31), Feb (28), Mar (31)
- Rata-rata: 30 hari/bulan
- **Result: 3.00 months**

### Billing Code Format

Format: `BILL-YYYY-MM-XXX`

- `BILL` - Fixed prefix
- `YYYY` - Year from periodStart
- `MM` - Month from periodStart
- `XXX` - Auto-increment sequence

**Contoh:** `BILL-2026-01-001`, `BILL-2026-01-002`

### Auto Status Updates

- Bill dibuat sebagai `draft`
- Saat payment pertama: `draft` → `unpaid`
- Saat fully paid: `unpaid` → `paid`

## 🔄 Migration

### Running Migration

```bash
# Test migration (dry run)
npm run migrate:billing:test

# Run actual migration
npm run migrate:billing
```

Migration script akan:
1. ✅ Migrate semua `rent_bills` ke sistem baru
2. ✅ Migrate semua `utility_bills` ke sistem baru
3. ✅ Convert format periode (YYYY-MM → YYYY-MM-DD)
4. ✅ Generate billing codes untuk data lama
5. ✅ Migrate payment records

### Backup Database First!

```bash
# Backup database sebelum migration
pg_dump -U username -d database_name > backup_$(date +%Y%m%d).sql
```

## 📊 Comparison: Old vs New

| Aspect | Old System | New System |
|--------|-----------|------------|
| **Bills per Tenant** | 2+ (rent + utility) | 1 (consolidated) |
| **Period Format** | YYYY-MM | YYYY-MM-DD (exact dates) |
| **Multi-Month** | Limited | Full support |
| **Payment Tracking** | Boolean flag | Detailed payment records |
| **Reporting** | Fragmented | Consolidated |
| **Payment Gateway Cost** | Higher (multiple transactions) | Lower (single transaction) |

## 🧪 Testing

### Manual Testing with Postman

1. Import Postman collection dari `postman/KostMan.postman_collection.json`
2. Test endpoints:
   - Generate bill untuk 1 bulan
   - Generate bill untuk 3 bulan
   - List bills dengan filter
   - Record payment
   - Check auto status update

### Unit Tests (TODO)

```bash
npm run test:unit
```

### Integration Tests (TODO)

```bash
npm run test:integration
```

## 📚 Documentation

- **Refactor Plan**: `docs/BILLING_REFACTOR_PLAN.md`
- **API Documentation**: `docs/BILLING_API.md`
- **Implementation Checklist**: `docs/BILLING_IMPLEMENTATION_CHECKLIST.md`
- **Implementation Summary**: `docs/BILLING_IMPLEMENTATION_SUMMARY.md`

## ⚠️ Important Notes

### Old Tables (DEPRECATED)

Tabel `rent_bills` dan `utility_bills` masih ada di database untuk keperluan migration, tapi **sudah tidak digunakan lagi** oleh sistem baru.

**Jangan hapus** tabel lama sampai:
1. ✅ Migration berhasil
2. ✅ Data terverifikasi
3. ✅ Sistem baru sudah stabil di production

### Breaking Changes

API endpoints lama masih berfungsi untuk backward compatibility:
- `/api/rent-bills/*` - Still works (deprecated)
- `/api/utility-bills/*` - Still works (deprecated)

Tapi **disarankan** untuk migrasi ke endpoints baru:
- `/api/bills/*` - New consolidated endpoints

## 🚀 Deployment Checklist

- [ ] Backup database production
- [ ] Deploy code ke staging
- [ ] Run migration di staging
- [ ] Test semua endpoints di staging
- [ ] Get approval dari stakeholders
- [ ] Schedule maintenance window
- [ ] Deploy ke production
- [ ] Run migration di production
- [ ] Verify data integrity
- [ ] Monitor for errors
- [ ] Notify users

## 🎓 Training Materials

### For Staff
- [ ] Video tutorial: Generate tagihan baru
- [ ] Video tutorial: Catat pembayaran
- [ ] FAQ document

### For Admins
- [ ] System architecture overview
- [ ] Database schema explanation
- [ ] Troubleshooting guide

## 📞 Support

Jika ada issues atau pertanyaan:

1. **Check Documentation** - Baca docs di folder `docs/`
2. **Check Code** - Review implementation di `server/api/bills/`
3. **Check Migration** - Review script di `scripts/migrate-billing.ts`

## 🏆 Status

**Implementation**: ✅ **Complete** (Backend)  
**Testing**: ⏸️ Pending  
**Frontend**: ⏸️ Pending  
**Deployment**: ⏸️ Pending  

**Overall Progress**: 🟢 **60% Complete**

---

**Last Updated**: 2026-01-18  
**Version**: 1.0  
**Branch**: `feature/billing-refactor`
