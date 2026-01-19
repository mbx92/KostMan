# Strategi Billing KostMan

## Overview
KostMan memiliki 2 jenis tagihan: **Rent Bill** dan **Utility Bill**. Masing-masing memiliki use case berbeda untuk menghindari double charge.

---

## 1. Rent Bill (Tagihan Sewa)

### Kapan Digunakan
- Untuk **pembayaran sewa bulanan atau multi-bulan**
- Untuk **penghuni baru** yang membayar di muka untuk beberapa bulan
- Untuk **perpanjangan sewa** multi-bulan

### Komponen Biaya
- ✅ **Sewa Kamar** (roomPrice × monthsCovered)
- ✅ **Air** (waterFee × occupantCount × monthsCovered)
- ✅ **Sampah** (trashFee × monthsCovered) - jika kamar menggunakan layanan sampah

### Formula
```
totalAmount = (roomPrice × monthsCovered) + (waterFee × occupantCount × monthsCovered) + (trashFee × monthsCovered)
```

### Contoh Use Case

#### Single Month (1 bulan)
```
Periode: 2026-01
Sewa: Rp 850.000 × 1 = Rp 850.000
Air: Rp 25.000 × 4 orang × 1 = Rp 100.000
Sampah: Rp 10.000 × 1 = Rp 10.000
─────────────────────────────────────
TOTAL: Rp 960.000
```

#### Multi-Month (2 bulan)
```
Periode: 2026-01 - 2026-02
Sewa: Rp 850.000 × 2 = Rp 1.700.000
Air: Rp 25.000 × 4 orang × 2 = Rp 200.000
Sampah: Rp 10.000 × 2 = Rp 20.000
─────────────────────────────────────
TOTAL: Rp 1.920.000
```

### Catatan Penting
- ❌ **JANGAN** generate Utility Bill untuk periode yang sama dengan Rent Bill
- ⚠️ Rent Bill **SUDAH INCLUDE** biaya air dan sampah
- 📅 Untuk multi-month, `periodEnd` akan otomatis dihitung
- 🔢 Biaya air dikalikan dengan `occupantCount` (jumlah penghuni)

---

## 2. Utility Bill (Tagihan Utilitas)

### Kapan Digunakan
- Untuk **tagihan bulanan reguler** dengan pencatatan meter listrik
- Untuk **penghuni yang sudah stay** dan bayar per bulan
- Ketika **TIDAK** ada Rent Bill yang di-generate untuk periode tersebut

### Komponen Biaya
- ✅ **Listrik** (berdasarkan pemakaian kWh: (meterEnd - meterStart) × costPerKwh)
- ✅ **Air** (waterFee × occupantCount)
- ✅ **Sampah** (trashFee)
- ✅ **Biaya Tambahan** (additionalCost - opsional)

### Formula
```
usageCost = (meterEnd - meterStart) × costPerKwh
adjustedWaterFee = waterFee × occupantCount
totalAmount = usageCost + adjustedWaterFee + trashFee + additionalCost
```

### Contoh Use Case

#### Monthly Utility Bill
```
Periode: 2026-01
Listrik: (150 - 50) × Rp 1.650 = Rp 165.000
Air: Rp 25.000 × 4 orang = Rp 100.000
Sampah: Rp 10.000
Biaya Tambahan: Rp 0
─────────────────────────────────────
TOTAL: Rp 275.000
```

### Catatan Penting
- ❌ **JANGAN** generate Rent Bill untuk periode yang sama dengan Utility Bill
- ⚠️ Utility Bill **SUDAH INCLUDE** biaya air dan sampah
- 📊 Memerlukan pencatatan **meter listrik** (meterStart & meterEnd)
- 💡 Biaya listrik bersifat **variabel** berdasarkan pemakaian

---

## 3. Scenario Penggunaan

### Scenario A: Penghuni Baru (Multi-Month Payment)
✅ **Generate: RENT BILL ONLY**

```
Penghuni: Baru masuk
Pembayaran: 2 bulan di muka (2026-01 - 2026-02)
Generate: Rent Bill (monthsCovered = 2)
Include: Sewa + Air + Sampah untuk 2 bulan
Utility Bill: TIDAK perlu (sudah include di Rent)
```

### Scenario B: Penghuni Existing (Monthly Billing)
✅ **Generate: UTILITY BILL ONLY**

```
Penghuni: Sudah stay
Pembayaran: Bulanan per periode
Generate: Utility Bill setiap bulan
Include: Listrik (variabel) + Air + Sampah
Rent Bill: TIDAK perlu generate lagi
```

### Scenario C: Perpanjangan Sewa (Extension)
✅ **Generate: RENT BILL ONLY**

```
Penghuni: Perpanjang kontrak
Pembayaran: 3 bulan ke depan
Generate: Rent Bill (monthsCovered = 3)
Include: Sewa + Air + Sampah untuk 3 bulan
Utility Bill: TIDAK perlu untuk periode tersebut
```

### ❌ Scenario SALAH (Double Charge)
**JANGAN LAKUKAN INI:**

```
Periode: 2026-01
❌ Generate Rent Bill → Include air + sampah
❌ Generate Utility Bill → Include air + sampah lagi
Result: Air & Sampah ke-charge 2 kali! ⚠️
```

---

## 4. Best Practices

### ✅ DO (Yang Harus Dilakukan)

1. **Gunakan Rent Bill untuk multi-month**
   - Penghuni baru bayar 2-3 bulan di muka
   - Perpanjangan sewa multi-bulan

2. **Gunakan Utility Bill untuk monthly reguler**
   - Penghuni existing yang bayar per bulan
   - Ketika perlu track pemakaian listrik aktual

3. **Cek periode sebelum generate**
   - Pastikan tidak ada overlap periode
   - Lihat history billing sebelum buat baru

4. **Update occupantCount di Room**
   - Pastikan jumlah penghuni selalu update
   - Biaya air akan otomatis adjust

### ❌ DON'T (Yang Harus Dihindari)

1. **Jangan generate Rent + Utility untuk periode sama**
   - Akan terjadi double charge air & sampah

2. **Jangan lupa set monthsCovered di Rent Bill**
   - Default = 1 bulan
   - Untuk multi-month, set sesuai jumlah bulan

3. **Jangan lupakan meter reading di Utility Bill**
   - meterStart & meterEnd harus akurat
   - Berpengaruh ke biaya listrik

---

## 5. Flow Chart Keputusan

```
┌─────────────────────────────┐
│  Penghuni mau bayar?        │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │ Berapa bulan?│
    └──────┬───────┘
           │
      ┌────┴────┐
      │         │
      ▼         ▼
   1 bulan   >1 bulan
      │         │
      │         ▼
      │    ┌──────────────────┐
      │    │ RENT BILL        │
      │    │ (Multi-Month)    │
      │    │ Include:         │
      │    │ - Sewa           │
      │    │ - Air            │
      │    │ - Sampah         │
      │    └──────────────────┘
      │
      ▼
   ┌─────────────────┐
   │ Sudah ada       │
   │ Rent Bill?      │
   └────┬────────────┘
        │
    ┌───┴───┐
    │       │
    ▼       ▼
  Ya      Tidak
    │       │
    │       ▼
    │   ┌──────────────────┐
    │   │ UTILITY BILL     │
    │   │ Include:         │
    │   │ - Listrik (var)  │
    │   │ - Air            │
    │   │ - Sampah         │
    │   └──────────────────┘
    │
    ▼
┌────────────────────┐
│ ⚠️  JANGAN         │
│ Generate           │
│ Utility Bill!      │
│ (Double charge)    │
└────────────────────┘
```

---

## 6. Database Schema Reference

### Rent Bills
```typescript
{
  period: "2026-01",           // Periode awal
  periodEnd: "2026-02",        // Periode akhir (untuk multi-month)
  monthsCovered: 2,            // Jumlah bulan
  roomPrice: "1700000",        // Total sewa (sudah × months)
  waterFee: "200000",          // Total air (waterFee × occupant × months)
  trashFee: "20000",           // Total sampah (trashFee × months)
  totalAmount: "1920000"       // Grand total
}
```

### Utility Bills
```typescript
{
  period: "2026-01",           // Periode
  meterStart: 50,              // Meter awal
  meterEnd: 150,               // Meter akhir
  costPerKwh: "1650",          // Tarif per kWh
  usageCost: "165000",         // Biaya listrik
  waterFee: "100000",          // Biaya air (× occupant)
  trashFee: "10000",           // Biaya sampah
  additionalCost: "0",         // Biaya tambahan
  totalAmount: "275000"        // Grand total
}
```

---

## 7. FAQ

### Q: Bagaimana kalau penghuni bayar 1 bulan tapi mau include listrik juga?
**A:** Gunakan **Utility Bill**. Utility Bill support single month dan sudah include listrik + air + sampah.

### Q: Penghuni bayar 3 bulan, tapi mau track listrik tiap bulan?
**A:** 
- Generate **Rent Bill** untuk 3 bulan (include sewa + air + sampah)
- **JANGAN** generate Utility Bill untuk 3 bulan tersebut
- Jika mau track listrik, bisa pakai Meter Reading API terpisah

### Q: Bagaimana kalau ada penghuni yang pindah di tengah bulan?
**A:** Untuk proration (perhitungan pro-rata), gunakan Utility Bill dengan perhitungan manual. Rent Bill tidak support proration.

### Q: Biaya air dikalikan berapa kali?
**A:** 
- **Rent Bill**: waterFee × occupantCount × monthsCovered
- **Utility Bill**: waterFee × occupantCount

### Q: Apa bedanya Rent Bill monthsCovered=1 dengan Utility Bill?
**A:** 
- **Rent Bill (1 month)**: Flat rate, tidak track meter listrik, cocok untuk pembayaran sewa murni
- **Utility Bill**: Track meter listrik, biaya listrik variabel sesuai pemakaian

---

## 8. Migration Notes

### Existing Data
Jika ada data lama yang sudah ter-generate dengan aturan berbeda:
1. **Cek data existing** - Pastikan tidak ada double charge
2. **Update documentasi** - Inform user tentang perubahan sistem
3. **Generate ulang** - Jika perlu, hapus dan generate ulang dengan aturan baru

### Version History
- **v1.0** (Jan 2026): Utility Bill hanya untuk multi-month
- **v2.0** (Jan 2026): Rent Bill include water+trash untuk all billing types
- **Current**: Rent Bill dan Utility Bill terpisah dengan use case berbeda

---

## Support

Jika ada pertanyaan atau butuh bantuan:
- 📖 Baca dokumentasi ini dengan teliti
- ⚠️ Selalu cek periode sebelum generate
- 🔍 Review total amount sebelum finalize
- 📞 Hubungi developer jika ada anomali billing

---

**Last Updated:** January 19, 2026
**Version:** 2.0
