# Refaktor Meter Reading & Utility Bill — Dokumentasi Perubahan Backend

> **Tanggal:** 19 Februari 2026  
> **Cakupan:** Ekstraksi service layer, integritas transaksional, auto-generasi utility bill, dan sinkronisasi frontend store.

---

## Daftar Isi

- [Ringkasan](#ringkasan)
- [Arsitektur](#arsitektur)
- [Service Layer: `utilityBillService.ts`](#service-layer-utilitybillservicets)
- [API Endpoint](#api-endpoint)
  - [POST `/api/meter-readings`](#post-apimeter-readings)
  - [PUT `/api/meter-readings`](#put-apimeter-readings)
  - [PATCH `/api/meter-readings/:id`](#patch-apimeter-readingsid)
  - [DELETE `/api/meter-readings/:id`](#delete-apimeter-readingsid)
  - [POST `/api/utility-bills`](#post-apiutility-bills)
  - [DELETE `/api/utility-bills/:id`](#delete-apiutility-billsid)
  - [PATCH `/api/utility-bills/:id/pay`](#patch-apiutility-billsidpay)
- [Perubahan Frontend Store](#perubahan-frontend-store)
- [Diagram Alur Transaksi](#diagram-alur-transaksi)
- [Penanganan Error](#penanganan-error)
- [Keputusan Desain](#keputusan-desain)

---

## Ringkasan

Sebelumnya, pembuatan utility bill dilakukan **di sisi frontend** setelah meter reading disimpan. Hal ini menimbulkan beberapa masalah:

- **Tidak atomik** — jika pembuatan bill gagal, meter reading sudah tersimpan tanpa bill yang sesuai.
- **Banyak API call** — frontend melakukan 2–4 request berurutan (simpan reading → buat bill → cek rent bill → generate rent bill).
- **Kalkulasi biaya tidak konsisten** — biaya diambil dari state cache frontend, bukan dari database yang merupakan sumber kebenaran.
- **Tidak ada sinkronisasi saat update/delete** — mengubah atau menghapus meter reading membuat utility bill menjadi basi atau yatim piatu (orphaned).

Refaktor ini memindahkan **seluruh manajemen siklus hidup utility bill ke backend**, dibungkus dalam transaksi database untuk menjamin integritas data.

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Nuxt)                          │
│  app/stores/kos.ts                                          │
│    addMeterReading()     → POST   /api/meter-readings       │
│    updateMeterReading()  → PATCH  /api/meter-readings/:id   │
│    deleteMeterReading()  → DELETE /api/meter-readings/:id   │
│                                                              │
│  Format response: { meterReading, utilityBill }              │
│  Store lokal menyinkronkan meterReadings[] dan utilityBills[]│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Handler (H3)                           │
│  server/api/meter-readings/                                  │
│    index.post.ts    — Buat reading + auto-buat bill         │
│    index.put.ts     — Upsert reading + buat/update bill     │
│    [id].patch.ts    — Patch reading + update bill            │
│    [id].delete.ts   — Hapus reading + hapus bill (unpaid)   │
│                                                              │
│  Semua menggunakan db.transaction() untuk atomisitas         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Service Layer                                   │
│  server/services/utilityBillService.ts                        │
│                                                              │
│  Semua fungsi menerima parameter opsional `tx`:              │
│    tx diberikan  → berjalan di client transaksi              │
│    tx kosong     → fallback ke `db` global                   │
│                                                              │
│  Fungsi-fungsi:                                              │
│    verifyRoomExists(roomId, tx?)                             │
│    verifyRoomOwnership(roomData, user, tx?)                  │
│    calculateUtilityBillCosts(input, occupantCount)           │
│    createUtilityBill(input, user, tx?)                       │
│    updateUtilityBill(id, input, user, tx?)                   │
│    getUtilityBillById(id, tx?)                               │
│    verifyBillOwnership(bill, user, tx?)                      │
│    updateUtilityBillPaid(id, tx?)                            │
│    deleteUtilityBill(id, user, tx?)                          │
│    findUtilityBillByRoomAndPeriod(roomId, period, tx?)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Layer: `utilityBillService.ts`

**File:** `server/services/utilityBillService.ts`

### Tipe Data

```typescript
type DbClient = NodePgDatabase<Record<string, never>>;
// Kompatibel dengan `db` (global) maupun `tx` (transaksi)

interface UtilityBillInput {
  roomId: string;
  period: string;
  meterStart: number;
  meterEnd: number;
  costPerKwh: number;
  waterFee: number;
  trashFee: number;
  additionalCost?: number;
}

interface UtilityBillUser {
  id: string;
  role: string;
}
```

### Daftar Fungsi

| Fungsi | Tujuan | Validasi |
|---|---|---|
| `verifyRoomExists(roomId, tx?)` | Mengembalikan data kamar atau throw 404 | — |
| `verifyRoomOwnership(roomData, user, tx?)` | Cek kepemilikan properti; admin dilewati | Throw 403 |
| `calculateUtilityBillCosts(input, occupantCount)` | Fungsi murni — menghitung `usageCost`, `adjustedWaterFee`, `totalAmount` | — |
| `createUtilityBill(input, user, tx?)` | Orkestrasi lengkap: verifikasi → hitung → insert | 404/403 |
| `updateUtilityBill(id, input, user, tx?)` | Hitung ulang biaya dari data meter baru dan update bill yang ada | 400 jika sudah lunas, 404, 403 |
| `getUtilityBillById(id, tx?)` | Ambil bill atau throw 404 | 404 |
| `verifyBillOwnership(bill, user, tx?)` | Cek kepemilikan kamar → properti | 403 |
| `updateUtilityBillPaid(id, tx?)` | Tandai bill sebagai lunas | 400 jika sudah lunas |
| `deleteUtilityBill(id, user, tx?)` | Hapus bill dengan guard kepemilikan + lunas | 400 jika lunas, 403 |
| `findUtilityBillByRoomAndPeriod(roomId, period, tx?)` | Mengembalikan bill atau `null` | — |

### Rumus Kalkulasi Biaya

```
usageCost        = (meterEnd - meterStart) × costPerKwh
adjustedWaterFee = waterFee × occupantCount
totalAmount      = usageCost + adjustedWaterFee + trashFee + additionalCost
```

- `occupantCount` default ke `1` jika tidak diisi.
- `trashFee` diset ke `0` jika kamar memiliki `useTrashService: false`.
- `waterFee`, `costPerKwh`, `trashFee` diambil dari `propertySettings` (per-properti), bukan dari pengaturan global.

---

## API Endpoint

### POST `/api/meter-readings`

**Tujuan:** Membuat meter reading baru dan otomatis membuat utility bill terkait.

**Role:** `ADMIN`, `OWNER`, `STAFF`

**Alur:**
1. Validasi input dengan `meterReadingSchema`
2. Cek duplikat reading (roomId + period) → 409 jika sudah ada
3. **Transaksi:**
   - Insert meter reading
   - Ambil data kamar → propertySettings
   - Panggil `createUtilityBill()` dengan biaya yang sudah dihitung
4. Kembalikan `{ meterReading, utilityBill }`

**Response:** `{ meterReading: MeterReading, utilityBill: UtilityBill | null }`

`utilityBill` bernilai `null` jika propertySettings belum ada.

---

### PUT `/api/meter-readings`

**Tujuan:** Upsert meter reading (insert atau update jika konflik) dan buat atau update utility bill terkait.

**Role:** `ADMIN`, `OWNER`, `STAFF`

**Alur:**
1. Validasi input dengan `meterReadingSchema`
2. **Transaksi:**
   - Upsert meter reading (`onConflictDoUpdate` pada `roomId + period`)
   - Ambil data kamar → propertySettings
   - `findUtilityBillByRoomAndPeriod()`:
     - Bill ada → `updateUtilityBill()` (hitung ulang biaya)
     - Tidak ada → `createUtilityBill()`
3. Kembalikan `{ meterReading, utilityBill }`

**Response:** `{ meterReading: MeterReading, utilityBill: UtilityBill | null }`

---

### PATCH `/api/meter-readings/:id`

**Tujuan:** Update sebagian meter reading (meterStart dan/atau meterEnd) dan sinkronkan utility bill terkait.

**Role:** `ADMIN`, `OWNER`

**Alur:**
1. Validasi input dengan `meterReadingUpdateSchema`
2. Ambil reading yang ada → 404 jika tidak ditemukan
3. Validasi silang: `newEnd >= newStart` → 400 jika tidak valid
4. **Transaksi:**
   - Update meter reading
   - `findUtilityBillByRoomAndPeriod()`:
     - Bill ada → `updateUtilityBill()` (hitung ulang biaya dari nilai meter baru)
   - Jika bill sudah lunas → transaksi di-rollback (400)
5. Kembalikan `{ meterReading, utilityBill }`

**Response:** `{ meterReading: MeterReading, utilityBill: UtilityBill | null }`

---

### DELETE `/api/meter-readings/:id`

**Tujuan:** Menghapus meter reading beserta utility bill yang belum lunas.

**Role:** `ADMIN`, `OWNER` (atau pencatat asli)

**Alur:**
1. Ambil reading yang ada → 404 jika tidak ditemukan
2. Cek otorisasi (admin, owner, atau pencatat)
3. `findUtilityBillByRoomAndPeriod()`:
   - Bill ada dan **sudah lunas** → **blokir penghapusan** (400)
   - Bill ada dan **belum lunas** → akan dihapus
4. **Transaksi:**
   - Hapus utility bill via `deleteUtilityBill()`
   - Hapus meter reading
5. Kembalikan pesan sukses

**Response:** `{ message: string }`

**Penting:** Menghapus meter reading yang memiliki utility bill yang sudah lunas **tidak diizinkan**. User harus menangani bill yang sudah lunas terlebih dahulu sebelum reading bisa dihapus.

---

### POST `/api/utility-bills`

**Tujuan:** Membuat utility bill secara manual (independen dari meter reading).

**Role:** `ADMIN`, `OWNER`

**Alur:**
1. Validasi dengan `utilityBillCreateSchema`
2. Panggil service `createUtilityBill()`
3. Kembalikan bill yang dibuat

Endpoint ini tetap tersedia untuk pembuatan bill manual di luar alur meter reading.

---

### DELETE `/api/utility-bills/:id`

**Tujuan:** Menghapus utility bill secara langsung.

**Role:** `ADMIN`, `OWNER`

**Guard:** Cek kepemilikan + tidak bisa menghapus jika sudah lunas.

---

### PATCH `/api/utility-bills/:id/pay`

**Tujuan:** Menandai utility bill sebagai lunas.

**Role:** `ADMIN`, `OWNER`, `STAFF`

**Guard:** Tidak bisa menandai jika sudah lunas sebelumnya.

---

## Perubahan Frontend Store

**File:** `app/stores/kos.ts`

### `addMeterReading()`

**Sebelum:** Melakukan 4 API call berurutan (insert reading → buat utility bill → cek rent bill → generate rent bill). Biaya utility bill dihitung dari state cache frontend.

**Sesudah:** Cukup 1 panggilan `POST /api/meter-readings`. Membaca response `{ meterReading, utilityBill }` dan memperbarui array `meterReadings` serta `utilityBills` di store lokal.

### `updateMeterReading()`

**Sebelum:** Memanggil `PATCH /api/meter-readings/:id` dan mengharapkan response berupa `MeterReading` saja. Tidak memperbarui utility bills di store lokal.

**Sesudah:** Membaca response `{ meterReading, utilityBill }`. Memperbarui meter reading di store lokal dan menyinkronkan utility bill jika dikembalikan.

### `deleteMeterReading()`

**Sebelum:** Memanggil `DELETE /api/meter-readings/:id` dan hanya menghapus meter reading dari store lokal. Utility bill yang sudah dihapus di backend tetap muncul sebagai entri "hantu" sampai re-fetch berikutnya.

**Sesudah:** Sebelum memanggil API, menyimpan `roomId` + `period` dari reading. Setelah berhasil, menghapus meter reading **dan** utility bill yang sesuai dari store lokal.

---

## Diagram Alur Transaksi

### Buat (POST)

```
db.transaction(tx) {
  ┌─ tx.insert(meterReadings)           ──► meterReading
  │
  ├─ tx.select(rooms)                   ──► roomData
  ├─ tx.select(propertySettings)         ──► settings
  │
  └─ createUtilityBill(input, user, tx)  ──► utilityBill
       ├─ verifyRoomExists(tx)
       ├─ verifyRoomOwnership(tx)
       ├─ calculateUtilityBillCosts()
       └─ tx.insert(utilityBills)
}
// KEDUANYA berhasil atau KEDUANYA di-rollback
```

### Hapus (DELETE)

```
// Pengecekan awal (di luar transaksi)
├─ Ambil reading → guard 404
├─ Cek otorisasi → guard 403
├─ findUtilityBillByRoomAndPeriod()
└─ Jika bill.isPaid → 400 (blokir)

db.transaction(tx) {
  ├─ deleteUtilityBill(billId, user, tx)
  │    ├─ getUtilityBillById(tx)
  │    ├─ verifyBillOwnership(tx)
  │    └─ tx.delete(utilityBills)
  │
  └─ tx.delete(meterReadings)
}
// KEDUANYA dihapus atau TIDAK SAMA SEKALI
```

---

## Penanganan Error

| Skenario | Kode HTTP | Pesan |
|---|---|---|
| Duplikat meter reading (room + period sama) | 409 | Meter reading sudah ada |
| Kamar tidak ditemukan | 404 | Room not found |
| User bukan pemilik properti | 403 | Forbidden |
| Bill sudah lunas (update/delete) | 400 | Cannot update/delete a paid bill |
| Meter reading tidak ditemukan | 404 | Meter reading not found |
| Hapus reading dengan bill yang sudah lunas | 400 | Cannot delete — associated bill is paid |
| `meterEnd < meterStart` | 400 | Meter end must be >= meter start |
| Error server tidak terduga | 500 | Internal Server Error |

Error H3 (`createError`) yang dilempar di dalam transaksi akan di-throw ulang apa adanya melalui blok catch, sehingga kode status yang benar tetap dipertahankan.

---

## Keputusan Desain

### 1. Mengapa memindahkan pembuatan bill ke backend?

- **Sumber kebenaran tunggal** — biaya selalu diambil dari `propertySettings` di database, bukan dari state cache frontend yang mungkin sudah basi.
- **Atomisitas** — meter reading dan utility bill dibuat/diupdate/dihapus bersamaan. Tidak ada state parsial.
- **Lebih sedikit API call** — 1 request menggantikan 2–4 request.

### 2. Mengapa parameter `tx` opsional, bukan wajib?

Kompatibilitas mundur. Fungsi-fungsi service juga dipanggil dari handler API utility bill yang berdiri sendiri (seperti `POST /api/utility-bills`, `DELETE /api/utility-bills/:id`) yang tidak memerlukan transaksi eksternal. Ketika `tx` tidak diberikan, fungsi menggunakan instance `db` global.

### 3. Mengapa memblokir penghapusan reading yang bill-nya sudah lunas?

Bill yang sudah lunas merepresentasikan catatan keuangan yang sudah selesai. Menghapus meter reading yang menghasilkannya akan meninggalkan bill yatim piatu tanpa data pendukung. User harus menangani bill yang sudah lunas terlebih dahulu.

### 4. Mengapa `utilityBill: null` di response?

Jika `propertySettings` belum ada untuk properti kamar tersebut, bill tidak bisa dihitung. Daripada menggagalkan seluruh request, meter reading tetap disimpan dan `utilityBill` dikembalikan sebagai `null`. Ini adalah degradasi yang anggun — user bisa menambahkan property settings nanti dan men-trigger ulang pembuatan bill via PUT.

### 5. Mengapa `createUtilityBill` tidak dihapus dari frontend store?

Fungsi tersebut masih di-export untuk potensi use case **pembuatan bill manual** (misalnya admin membuat bill tanpa meter reading). Fungsi ini tidak lagi dipanggil dari `addMeterReading()` tapi tetap tersedia.
