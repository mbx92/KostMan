# Partial Payment System - User Guide

## Overview
Sistem pembayaran cicilan memungkinkan penghuni membayar tagihan secara bertahap. Setiap pembayaran dicatat sebagai transaksi terpisah yang dapat dilacak dan dikelola.

## Fitur Utama

### 1. Status Tagihan
Tagihan kini memiliki 3 status:
- **BELUM DIBAYAR** (Merah): Belum ada pembayaran sama sekali
- **DIBAYAR SEBAGIAN** (Kuning): Sudah ada pembayaran tapi belum lunas
- **LUNAS** (Hijau): Sudah dibayar penuh

### 2. Informasi Pembayaran
Untuk tagihan yang dibayar sebagian, sistem menampilkan:
- **Total Tagihan**: Jumlah yang harus dibayar
- **Terbayar**: Jumlah yang sudah dibayar
- **Sisa**: Jumlah yang masih harus dibayar

### 3. Riwayat Pembayaran
Setiap pembayaran dicatat dengan detail:
- Jumlah pembayaran
- Metode pembayaran (Tunai, Transfer, dsb)
- Tanggal pembayaran
- Catatan (opsional)
- Dicatat oleh (staff yang mencatat)

## Cara Menggunakan

### Mencatat Pembayaran

1. **Buka Halaman Tagihan**
   - Navigasi ke menu "Tagihan"
   - Pilih tab "Sewa" atau "Utilitas"

2. **Pilih Tagihan**
   - Cari tagihan yang ingin dicatat pembayarannya
   - Pastikan status tagihan bukan "LUNAS"

3. **Klik Tombol "Catat Pembayaran"**
   - Tombol biru dengan ikon uang
   - Hanya muncul untuk tagihan yang belum lunas

4. **Isi Form Pembayaran**
   - **Jumlah**: Masukkan nominal yang dibayar
     - Minimal: Rp 1
     - Maksimal: Sisa yang belum dibayar
     - Gunakan tombol "50%" atau "Lunas" untuk input cepat
   - **Metode Pembayaran**: Pilih dari dropdown
     - Tunai
     - Transfer Bank
     - E-Wallet (GoPay, OVO, Dana)
     - Virtual Account
     - QRIS
     - Lainnya
   - **Tanggal**: Pilih tanggal pembayaran (default: hari ini)
   - **Catatan**: Opsional, untuk informasi tambahan

5. **Simpan**
   - Klik tombol "Catat Pembayaran"
   - Sistem akan memvalidasi dan menyimpan data
   - Status tagihan akan diupdate otomatis

### Melihat Riwayat Pembayaran

1. **Dari Card Tagihan**
   - Untuk tagihan dengan status "DIBAYAR SEBAGIAN"
   - Klik tombol "History" di pojok kanan atas card

2. **Detail yang Ditampilkan**
   - List semua pembayaran untuk tagihan tersebut
   - Urutan: Pembayaran terbaru di atas
   - Informasi per pembayaran:
     - Nominal (ukuran besar, warna hijau)
     - Metode pembayaran
     - Tanggal pembayaran
     - Dicatat oleh (nama staff)
     - Tombol hapus (ikon merah)

### Menghapus Pembayaran

⚠️ **Perhatian**: Fitur ini hanya untuk koreksi kesalahan input

1. **Buka Riwayat Pembayaran**
   - Ikuti langkah "Melihat Riwayat Pembayaran"

2. **Klik Tombol Hapus**
   - Ikon trash merah di sebelah kanan pembayaran

3. **Konfirmasi**
   - Dialog konfirmasi akan muncul
   - Klik "Hapus" untuk melanjutkan

4. **Hasil**
   - Pembayaran dihapus dari riwayat
   - Jumlah terbayar pada tagihan dikurangi
   - Status tagihan diupdate (bisa kembali ke BELUM DIBAYAR atau tetap DIBAYAR SEBAGIAN)

## Skenario Penggunaan

### Skenario 1: Pembayaran Bertahap
**Situasi**: Tagihan sewa Rp 2.000.000, penghuni bayar 2 kali

**Langkah**:
1. Penghuni bayar Rp 1.000.000 (50%)
   - Catat pembayaran: Rp 1.000.000
   - Status: DIBAYAR SEBAGIAN
   - Terbayar: Rp 1.000.000
   - Sisa: Rp 1.000.000

2. Minggu depan, penghuni bayar sisanya Rp 1.000.000
   - Catat pembayaran: Rp 1.000.000
   - Status: LUNAS
   - Terbayar: Rp 2.000.000
   - Sisa: Rp 0

### Skenario 2: Pembayaran Kecil-kecilan
**Situasi**: Tagihan Rp 1.500.000, penghuni bayar 3 kali dengan nominal berbeda

**Langkah**:
1. Pembayaran 1: Rp 500.000 (33%)
   - Status: DIBAYAR SEBAGIAN
   - Sisa: Rp 1.000.000

2. Pembayaran 2: Rp 700.000 (47%)
   - Status: DIBAYAR SEBAGIAN
   - Terbayar: Rp 1.200.000
   - Sisa: Rp 300.000

3. Pembayaran 3: Rp 300.000 (20%)
   - Status: LUNAS

### Skenario 3: Koreksi Kesalahan Input
**Situasi**: Staff salah input nominal pembayaran

**Langkah**:
1. Staff mencatat Rp 2.000.000 (seharusnya Rp 1.000.000)
2. Buka riwayat pembayaran
3. Hapus pembayaran yang salah
4. Catat ulang dengan nominal yang benar

## Database Schema

### Tabel `payments`
```sql
- id: UUID (Primary Key)
- billId: UUID (Foreign Key ke rentBills atau utilityBills)
- billType: ENUM ('rent', 'utility')
- amount: NUMERIC(12,2)
- paymentMethod: ENUM ('cash', 'bank_transfer', 'gopay', 'ovo', 'dana', 'other')
- paymentDate: DATE
- status: ENUM ('pending', 'completed', 'cancelled')
- notes: TEXT (nullable)
- recordedBy: UUID (Foreign Key ke users)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

### Perubahan pada Tabel Tagihan
Ditambahkan kolom:
- `paidAmount`: NUMERIC(12,2) DEFAULT 0

## API Endpoints

### GET /api/payments
Mengambil daftar pembayaran
```typescript
Query Parameters:
- billId?: string
- billType?: 'rent' | 'utility'

Response:
{
  id: string;
  billId: string;
  billType: 'rent' | 'utility';
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  notes: string | null;
  recordedBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}[]
```

### POST /api/payments
Mencatat pembayaran baru
```typescript
Body:
{
  billId: string;
  billType: 'rent' | 'utility';
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  notes?: string;
}

Response:
{
  payment: { id, billId, amount, ... };
  bill: {
    totalAmount: string;
    paidAmount: string;
    remainingAmount: number;
    isPaid: boolean;
  };
}
```

### DELETE /api/payments/[id]
Menghapus pembayaran
```typescript
Response:
{
  success: true;
  bill: {
    totalAmount: string;
    paidAmount: string;
    remainingAmount: number;
    isPaid: boolean;
  };
}
```

## Migration

Untuk mengaktifkan fitur ini, jalankan migration:

```bash
psql -U mbx -d kostMan_dev -f server/database/migrations/add-payment-system.sql
```

Migration ini akan:
1. Membuat enum baru (`bill_type`, `payment_status`)
2. Menambahkan 'other' ke enum `payment_method`
3. Menambahkan kolom `paidAmount` ke tabel `rentBills` dan `utilityBills`
4. Membuat tabel `payments`
5. Membuat index untuk performa
6. Migrasi data: Set `paidAmount = totalAmount` untuk tagihan yang sudah `isPaid = true`

## Troubleshooting

### Tombol "Catat Pembayaran" tidak muncul
- Pastikan tagihan belum berstatus LUNAS
- Refresh halaman

### Error "Amount exceeds remaining balance"
- Pastikan nominal yang diinput tidak melebihi sisa yang belum dibayar
- Cek jumlah yang sudah terbayar di riwayat

### Pembayaran tidak bisa dihapus
- Pastikan ada koneksi internet
- Refresh halaman dan coba lagi
- Cek role/permission user

### Status tidak berubah setelah pembayaran penuh
- Refresh halaman
- Cek apakah total pembayaran sudah >= total tagihan
- Periksa database untuk memastikan `paidAmount` dan `isPaid` sudah terupdate

## Best Practices

1. **Selalu Catat Pembayaran Segera**
   - Hindari menumpuk pencatatan
   - Catat saat uang diterima

2. **Gunakan Metode Pembayaran yang Tepat**
   - Pilih sesuai dengan cara pembayaran sebenarnya
   - Gunakan "Lainnya" jika tidak ada yang sesuai

3. **Tambahkan Catatan untuk Pembayaran Khusus**
   - Misal: "Bayar via keluarga", "Cicilan pertama dari 3x"
   - Memudahkan tracking

4. **Cek Riwayat Sebelum Hapus**
   - Pastikan pembayaran yang akan dihapus memang salah
   - Hapus adalah tindakan permanen

5. **Komunikasi dengan Penghuni**
   - Berikan bukti/screenshot setiap pembayaran dicatat
   - Transparansi mencegah dispute

## Roadmap

Fitur yang akan datang:
- [ ] Export riwayat pembayaran ke PDF
- [ ] Notifikasi WhatsApp otomatis saat pembayaran dicatat
- [ ] Dashboard statistik pembayaran cicilan
- [ ] Reminder pembayaran untuk tagihan yang dibayar sebagian
- [ ] Integrasi dengan sistem akuntansi
