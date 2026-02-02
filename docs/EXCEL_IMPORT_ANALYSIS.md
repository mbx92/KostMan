# Excel Import Analysis - clean.xlsx

## 📊 File Overview
- **File**: `docs/clean.xlsx`
- **Total Rows**: 174 (termasuk header)
- **Data Rows**: 173 rows
- **Sheets**: 1 (Sheet1)

## 📋 Excel Structure

### Kolom yang Ada (19 columns):
1. `users_email` - Email user/owner
2. `property_name` - Nama properti kost
3. `property_address` - Alamat properti
4. `property_description` - Deskripsi properti
5. `rooms_name` - Nama kamar
6. `rooms_price` - Harga kamar
7. `property_settings_cost_per_kwh` - Biaya per kWh
8. `water` - Biaya air
9. `trash` - Biaya sampah
10. `room_status` - Status kamar (available/occupied/maintenance)
11. `use_trash_service` - Apakah menggunakan layanan sampah
12. `move_in_date` - Tanggal masuk (format: 20260101)
13. `ocupant_count` - Jumlah penghuni
14. `tenant_name` - Nama penyewa
15. `tenant_id_card_number` - Nomor KTP penyewa
16. `tenant_phone` - Nomor telepon penyewa
17. `meter_start` - Meter awal listrik
18. `meter_end` - Meter akhir listrik
19. `recorder_by` - Email yang merekam

## 🗄️ Database Schema Mapping

### ✅ DAPAT DIIMPORT - Berikut mapping-nya:

#### 1. **users** table
- `email` ← `users_email`
- `name` ← Bisa diambil dari email atau set default
- `password` ← Generate default (harus dichange nanti)
- `role` ← Default "owner"
- `status` ← Default "active"

#### 2. **properties** table
- `userId` ← Reference dari user yang dibuat
- `name` ← `property_name`
- `address` ← `property_address`
- `description` ← `property_description`
- `image` ← NULL (tidak ada di Excel)
- `mapUrl` ← NULL (tidak ada di Excel)

#### 3. **propertySettings** table
- `propertyId` ← Reference dari property yang dibuat
- `costPerKwh` ← `property_settings_cost_per_kwh`
- `waterFee` ← `water`
- `trashFee` ← `trash`

#### 4. **tenants** table
- `name` ← `tenant_name`
- `contact` ← `tenant_phone`
- `idCardNumber` ← `tenant_id_card_number`
- `status` ← Default "active" (jika room_status = occupied)
- `pin` ← Generate default (hash dari contact atau set 1234)
- `isDefaultPin` ← true
- `pinChangedAt` ← NULL

#### 5. **rooms** table
- `propertyId` ← Reference dari property
- `tenantId` ← Reference dari tenant (jika occupied)
- `name` ← `rooms_name`
- `price` ← `rooms_price`
- `status` ← `room_status`
- `useTrashService` ← `use_trash_service`
- `moveInDate` ← `move_in_date` (perlu convert dari 20260101 ke DATE format)
- `occupantCount` ← `ocupant_count`

#### 6. **meterReadings** table (OPTIONAL - untuk historical data)
- `roomId` ← Reference dari room
- `period` ← Bisa di-derive dari move_in_date, misal "2026-01"
- `meterStart` ← `meter_start`
- `meterEnd` ← `meter_end`
- `recordedAt` ← NOW() atau dari move_in_date
- `recordedBy` ← Reference dari user (dari recorder_by email)

## ⚠️ Issues & Considerations

### 1. **Data Quality Issues**
- ❌ `tenant_id_card_number` = "0000000000000000" (semua dummy)
- ❌ `tenant_phone` = "000000000000" (semua dummy)
- ⚠️ Beberapa tenant duplikat (nama sama di room berbeda)
- ⚠️ `move_in_date` format number (20260101) perlu dikonversi ke DATE

### 2. **Missing Data**
- Tidak ada password untuk users (perlu generate default)
- Tidak ada user name (hanya email)
- Tidak ada tenant PIN
- Tidak ada property image & mapUrl
- Tidak ada global settings

### 3. **Data Format Issues**
- `move_in_date`: 20260101 → perlu convert ke '2026-01-01'
- `rooms_price`, `property_settings_cost_per_kwh`, `water`, `trash` → sudah number, tinggal convert ke decimal string

## 🎯 Import Strategy

### Phase 1: Core Data
1. ✅ **Create/Find Users** (dari `users_email`)
   - Cek jika user sudah ada berdasarkan email
   - Jika belum ada, create dengan password default

2. ✅ **Create Properties** (dari `property_name`)
   - Group by property_name
   - Create unique properties per user

3. ✅ **Create Property Settings**
   - One-to-one dengan property
   - Ambil dari baris pertama setiap property (asumsi setting sama untuk satu property)

4. ✅ **Create Tenants**
   - Deduplicate berdasarkan nama + contact
   - Skip jika tenant_name kosong/null

5. ✅ **Create Rooms**
   - Link ke property dan tenant
   - Convert move_in_date format

### Phase 2: Optional Historical Data
6. ⚠️ **Create Meter Readings** (Optional)
   - Jika ada meter_start dan meter_end
   - Buat period dari move_in_date

## 📝 Recommended Import Script Structure

```javascript
// Pseudo-code
1. Parse Excel → get all rows
2. Transform & Deduplicate:
   - Extract unique users
   - Extract unique properties per user
   - Extract unique tenants (deduplicate by name+contact)
   - Prepare rooms data with references

3. Database Transaction:
   BEGIN TRANSACTION
   
   // 3.1 Users
   for each unique email:
     - findOrCreate user
     - store user id mapping
   
   // 3.2 Properties
   for each unique property per user:
     - create property
     - store property id mapping
   
   // 3.3 Property Settings
   for each property:
     - create property settings
   
   // 3.4 Tenants
   for each unique tenant:
     - create tenant (if has name and not dummy data)
     - store tenant id mapping
   
   // 3.5 Rooms
   for each room:
     - create room with property and tenant references
     - store room id mapping
   
   // 3.6 Meter Readings (Optional)
   for each room with meter data:
     - create meter reading
   
   COMMIT TRANSACTION

4. Error Handling:
   - Log any errors
   - Rollback on failure
   - Generate import report
```

## ✅ Conclusion

**JAWABAN: YA, MEMUNGKINKAN untuk diimport ke database!**

### Pros:
- ✅ Struktur Excel cocok dengan database schema
- ✅ Semua data penting tersedia
- ✅ Mapping jelas dan straightforward
- ✅ 173 rows data cukup untuk testing

### Cons:
- ⚠️ Perlu handle deduplikasi (properties, tenants)
- ⚠️ Perlu generate default values (password, PIN)
- ⚠️ Data dummy untuk contact info (KTP, phone)
- ⚠️ Perlu konversi format tanggal

### Next Steps:
1. Buat script import dengan Drizzle ORM
2. Implement transaction untuk data integrity
3. Add validation dan error handling
4. Generate laporan hasil import
5. (Optional) Add rollback mechanism

## 📌 Sample Data Preview

```javascript
{
  "users_email": "owner@example.com",
  "property_name": "PONDOK UMA TAKI",
  "property_address": "Jalan Tukad Bilok Gang Uma Taki",
  "property_description": "Uma Taki",
  "rooms_name": "TAKI-01",
  "rooms_price": 800000,
  "property_settings_cost_per_kwh": 2200,
  "water": 15000,
  "trash": 25000,
  "room_status": "occupied",
  "use_trash_service": true,
  "move_in_date": 20260101,
  "ocupant_count": 1,
  "tenant_name": "LITA",
  "tenant_id_card_number": "0000000000000000",
  "tenant_phone": "000000000000",
  "meter_start": 1200,
  "meter_end": 1700,
  "recorder_by": "owner@example.com"
}
```

## 🏷️ Properties Found in Excel

Berdasarkan analisis, ada **11 properties** unik dengan total **173 kamar**:

1. **KUBU GADANG** - 8 rooms (8 occupied)
2. **KUBU GADING** - 9 rooms (7 occupied)
3. **KUBU BATAN TIMBUL** - 4 rooms (0 occupied)
4. **KUBU BEDUGUL** - 41 rooms (26 occupied) ⚠️ rooms_price = 0
5. **PONDOK ANGGREK** - 36 rooms (19 occupied)
6. **PONDOK JEPUN** - 19 rooms (17 occupied)
7. **PONDOK LOTUS** - 10 rooms (0 occupied)
8. **PONDOK MOKA** - 10 rooms (10 occupied)
9. **PONDOK SANDAT** - 9 rooms (9 occupied)
10. **PONDOK UMA TAKI** - 17 rooms (17 occupied)
11. **PONDOK TULIP** - 10 rooms (10 occupied)

### Statistics:
- **Total Rooms**: 173
- **Occupied**: 123 rooms (71%)
- **Available**: 50 rooms (29%)
- **Tenants**: 116 unique tenants (after deduplication)
- **User**: 1 (owner@example.com)

### Data Quality Notes:
- ⚠️ **NO address/description** untuk semua properties (column exists tapi semua NULL/empty)
- ⚠️ **Dummy data**: 123 records dengan NIK = "0000000000000000"
- ⚠️ **Dummy phone**: 90 records dengan phone = "000000000000"
- ⚠️ **KUBU BEDUGUL**: Semua rooms_price = 0 (perlu diverifikasi)

---

**Created**: 2026-02-02  
**Purpose**: Import Analysis untuk clean.xlsx → KostMan Database
