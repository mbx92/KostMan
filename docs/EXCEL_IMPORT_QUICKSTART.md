# 📊 Excel Import - Quick Start Guide

> Import properties, rooms, dan tenants secara batch menggunakan file Excel

## 🎯 Features

- ✅ **5-Step Wizard** - Upload → Preview → Validate → Import → Result
- ✅ **Drag & Drop Upload** - Mudah upload file Excel
- ✅ **Data Preview** - Lihat data sebelum import
- ✅ **Smart Validation** - Deteksi error & warning otomatis
- ✅ **Progress Tracking** - Real-time import progress
- ✅ **Transaction Safe** - Automatic rollback on error
- ✅ **Template Download** - Download template Excel yang benar

## 🚀 Quick Start

### 1. Access Import Page
```
http://localhost:3000/admin/import
```

### 2. Upload File Excel
- Drag & drop file ke area upload, ATAU
- Click "Pilih File" untuk browse file

### 3. Preview Data
- Cek summary: Properties, Rooms, Tenants
- Review data di tabs: Properties, Rooms, Tenants
- Perhatikan warning (if any)

### 4. Validate & Import
- Click "Validasi & Lanjut"
- Review hasil validasi
- Pilih import options
- Click "Mulai Import"

### 5. View Results
- Lihat statistics: Created, Updated, Skipped
- Check detail breakdown
- Navigate ke data page atau import lagi

## 📁 File Excel Structure

### Template Columns (19 total):

```
users_email                     | owner@example.com
property_name                   | PONDOK UMA TAKI
property_address                | Jl. Example No. 1
property_description            | Kost nyaman
rooms_name                      | TAKI-01
rooms_price                     | 800000
property_settings_cost_per_kwh  | 2200
water                           | 15000
trash                           | 25000
room_status                     | occupied
use_trash_service               | true
move_in_date                    | 20260101
ocupant_count                   | 1
tenant_name                     | John Doe
tenant_id_card_number           | 1234567890123456
tenant_phone                    | 081234567890
meter_start                     | 1200
meter_end                       | 1700
recorder_by                     | owner@example.com
```

### Download Template:
Click **"Download Template"** button di halaman import untuk mendapatkan template Excel yang sudah benar.

## 🎨 UI Preview

### Step 1: Upload
```
┌─────────────────────────────────────────┐
│  📤 Drag & Drop Excel File Here        │
│                                          │
│         [Pilih File Button]              │
│                                          │
│  Format: .xlsx, .xls (Max 10MB)         │
│                                          │
│  ℹ️  Belum punya template?              │
│  [Download Template]                     │
└─────────────────────────────────────────┘
```

### Step 2: Preview
```
┌──────────┬──────────┬──────────┬──────────┐
│ Properties│  Rooms   │ Tenants  │ Occupied │
│    11     │   173    │   116    │   123    │
└──────────┴──────────┴──────────┴──────────┘

[Properties Tab] [Rooms Tab] [Tenants Tab]

Property Name    | Rooms | Cost/kWh | Water | Trash
──────────────────────────────────────────────────
KUBU GADANG     |   8   |  2200    | 15000 | 25000
PONDOK ANGGREK  |  36   |  2200    | 15000 | 25000
...
```

### Step 3: Validation
```
✅ Data Valid (3)
  ✓ 11 properties siap diimport
  ✓ 173 rooms siap diimport
  ✓ 116 tenants siap diimport

⚠️  Peringatan (2)
  ⚠ 90 tenants menggunakan data dummy (NIK/Phone)
  ⚠ 41 rooms memiliki harga 0

Options:
☑ Skip data duplikat
☐ Update data yang sudah ada
☑ Generate password default
☑ Generate PIN default
```

### Step 4: Import Progress
```
Progress: 80% ████████████████░░░░

✅ Import Users              (1 items)   ✓ Selesai
✅ Import Properties         (11 items)  ✓ Selesai
✅ Import Property Settings  (11 items)  ✓ Selesai
✅ Import Tenants           (116 items)  ✓ Selesai
🔄 Import Rooms             (173 items)  Proses...
```

### Step 5: Result
```
        ✅
   Import Berhasil!
Data berhasil diimport ke database

┌─────────┬─────────┬─────────┐
│ Created │ Updated │ Skipped │
│   300   │    10   │    5    │
└─────────┴─────────┴─────────┘

Detail:
- Users: 1 created
- Properties: 11 created
- Property Settings: 11 created
- Tenants: 116 created
- Rooms: 173 created

[Import Lagi] [Lihat Data]
```

## ⚙️ Import Options

### Skip Duplicates
- ✅ **Enabled (Default)**: Skip data yang sudah ada di database
- ❌ **Disabled**: Akan error jika ada duplicate

### Update Existing
- ✅ **Enabled**: Update data yang sudah ada dengan data baru
- ❌ **Disabled (Default)**: Skip data yang sudah ada

### Generate Default Password
- ✅ **Enabled (Default)**: Generate password "password123" untuk user baru
- ❌ **Disabled**: Perlu set password manual

### Generate Default PIN
- ✅ **Enabled (Default)**: Generate PIN "1234" untuk tenant baru
- ❌ **Disabled**: Tenant tidak punya PIN

## 🎯 Data Mapping

### From Excel → To Database:

**Users Table:**
```
users_email → users.email
(generated)  → users.name (from email)
(generated)  → users.password (hashed)
"owner"      → users.role
"active"     → users.status
```

**Properties Table:**
```
property_name        → properties.name
property_address     → properties.address
property_description → properties.description
users_email (ref)    → properties.userId
```

**Property Settings Table:**
```
property_settings_cost_per_kwh → propertySettings.costPerKwh
water                          → propertySettings.waterFee
trash                          → propertySettings.trashFee
```

**Tenants Table:**
```
tenant_name           → tenants.name
tenant_phone          → tenants.contact
tenant_id_card_number → tenants.idCardNumber
"active"              → tenants.status
(generated)           → tenants.pin (hashed)
```

**Rooms Table:**
```
rooms_name        → rooms.name
rooms_price       → rooms.price
room_status       → rooms.status
use_trash_service → rooms.useTrashService
move_in_date      → rooms.moveInDate (converted)
ocupant_count     → rooms.occupantCount
property (ref)    → rooms.propertyId
tenant (ref)      → rooms.tenantId
```

## ⚠️ Important Notes

### Date Format
- Excel uses numeric format: `20260101`
- Converted to: `2026-01-01`

### Deduplication Rules
- **Users**: By `email`
- **Properties**: By `userId` + `name`
- **Tenants**: By `name` + `contact`
- **Rooms**: By `propertyId` + `name`

### Data Quality Warnings
- Dummy NIK: `0000000000000000`
- Dummy Phone: `000000000000`
- Zero Price: `0` (for KUBU BEDUGUL in sample)

### Default Values
- User password: `password123` (must change after login)
- Tenant PIN: `1234` (must change after login)
- Property address: `"Alamat belum diisi"` (if empty)
- Room occupant count: `1` (if not specified)

## 🐛 Troubleshooting

### File Upload Failed
**Problem:** File tidak bisa diupload
**Solution:**
- Pastikan format .xlsx atau .xls
- Max size 10MB
- Check file tidak corrupt

### Validation Errors
**Problem:** Data tidak valid
**Solution:**
- Download template untuk referensi
- Check column names exact match
- Verify data types (number vs string)

### Import Failed
**Problem:** Import process error
**Solution:**
- Check database connection
- Review error message detail
- Check for constraint violations
- Try with smaller dataset

### Duplicate Data
**Problem:** Data sudah ada
**Solution:**
- Enable "Skip Duplicates" option, OR
- Enable "Update Existing" option, OR
- Remove duplicate rows from Excel

## 📞 Support

**Documentation:**
- Full Documentation: `docs/EXCEL_IMPORT_FEATURE.md`
- Excel Analysis: `docs/EXCEL_IMPORT_ANALYSIS.md`
- Database Schema: `server/database/schema.ts`

**Test File:**
- Sample Excel: `docs/clean.xlsx` (173 rooms, 11 properties)

**Code:**
- Frontend: `pages/admin/import.vue`
- Backend API: `server/api/import/excel.post.ts`

---

**Quick Tips:**
- 💡 Always preview data before importing
- 💡 Start with small dataset untuk testing
- 💡 Use template untuk structure reference
- 💡 Enable "Skip Duplicates" untuk safety
- 💡 Keep backup sebelum import besar

**Happy Importing! 🚀**
