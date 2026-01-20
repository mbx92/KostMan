# MinIO Storage Strategy untuk KostMan

## Overview
Brainstorming penggunaan MinIO sebagai solusi storage dan CDN untuk mengelola asset gambar dan dokumen hasil generate bill.

---

## 🎯 Use Cases

### 1. **Image Storage**
- Foto cover properti (properties)
- Foto kamar (rooms)
- Foto profil user (future)
- Icon/logo aplikasi

### 2. **Document Storage**
- PDF tagihan yang di-generate
- Invoice untuk tenant
- Laporan bulanan/tahunan
- Bukti pembayaran (receipt)

---

## 🏗️ Arsitektur Implementasi

### Setup MinIO

```yaml
# docker-compose.yml (tambahkan service MinIO)
services:
  minio:
    image: minio/minio:latest
    container_name: kostman-minio
    ports:
      - "9000:9000"      # API
      - "9001:9001"      # Console UI
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: miniopassword123
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    networks:
      - kostman-network

volumes:
  minio_data:
```

### Bucket Structure

```
kostman-bucket/
├── properties/
│   ├── {propertyId}/
│   │   ├── cover.jpg
│   │   └── gallery/
│   │       ├── img1.jpg
│   │       └── img2.jpg
├── rooms/
│   └── {roomId}/
│       ├── cover.jpg
│       └── gallery/
├── bills/
│   └── {year}/
│       └── {month}/
│           ├── rent/
│           │   └── {billId}.pdf
│           └── utility/
│               └── {billId}.pdf
├── receipts/
│   └── {year}/
│       └── {month}/
│           └── {receiptId}.pdf
└── reports/
    └── {year}/
        ├── income-{month}.pdf
        └── profit-loss-{month}.pdf
```

---

## 💡 Implementasi

### 1. **MinIO Client Setup**

```typescript
// server/utils/minio.ts
import { Client } from 'minio'

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
  region: process.env.MINIO_REGION || 'us-east-1',
  secretKey: process.env.MINIO_SECRET_KEY || 'miniopassword123',
})

const BUCKET_NAME = 'kostman-bucket'

// Ensure bucket exists
export async function ensureBucketExists() {
  const exists = await minioClient.bucketExists(BUCKET_NAME)
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME, 'us-east-1')
    
    // Set bucket policy to allow public read for images
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/properties/*`, `arn:aws:s3:::${BUCKET_NAME}/rooms/*`],
        },
      ],
    }
    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy))
  }
}
```

### 2. **Upload API Endpoint**

```typescript
// server/api/upload/image.post.ts
import { minioClient, ensureBucketExists } from '~/server/utils/minio'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  await ensureBucketExists()
  
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, message: 'No file uploaded' })
  
  const file = form.find(item => item.name === 'file')
  if (!file || !file.data) throw createError({ statusCode: 400, message: 'Invalid file' })
  
  const type = form.find(item => item.name === 'type')?.data.toString() || 'properties'
  const id = form.find(item => item.name === 'id')?.data.toString() || nanoid()
  
  // Generate unique filename
  const ext = file.filename?.split('.').pop() || 'jpg'
  const fileName = `${type}/${id}/cover-${Date.now()}.${ext}`
  
  // Upload to MinIO
  await minioClient.putObject('kostman-bucket', fileName, file.data, file.data.length, {
    'Content-Type': file.type || 'image/jpeg',
  })
  
  // Generate public URL
  const url = `${process.env.MINIO_PUBLIC_URL || 'http://localhost:9000'}/kostman-bucket/${fileName}`
  
  return { url, fileName }
})
```

### 3. **PDF Generation & Upload**

```typescript
// server/utils/billPdf.ts
import PDFDocument from 'pdfkit'
import { minioClient } from './minio'

export async function generateAndUploadBillPDF(bill: any) {
  const doc = new PDFDocument()
  const chunks: Buffer[] = []
  
  doc.on('data', (chunk) => chunks.push(chunk))
  
  // Generate PDF content
  doc.fontSize(20).text('TAGIHAN PEMBAYARAN', { align: 'center' })
  doc.fontSize(12).text(`No: ${bill.id}`)
  doc.text(`Tanggal: ${new Date(bill.dueDate).toLocaleDateString('id-ID')}`)
  doc.text(`Penghuni: ${bill.tenantName}`)
  doc.text(`Kamar: ${bill.roomName}`)
  doc.moveDown()
  doc.text(`Total: Rp ${bill.totalAmount.toLocaleString('id-ID')}`)
  doc.end()
  
  // Wait for PDF generation
  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })
  
  // Upload to MinIO
  const year = new Date(bill.dueDate).getFullYear()
  const month = new Date(bill.dueDate).getMonth() + 1
  const type = bill.type === 'rent' ? 'rent' : 'utility'
  const fileName = `bills/${year}/${month}/${type}/${bill.id}.pdf`
  
  await minioClient.putObject('kostman-bucket', fileName, buffer, buffer.length, {
    'Content-Type': 'application/pdf',
  })
  
  // Generate presigned URL (valid for 7 days)
  const url = await minioClient.presignedGetObject('kostman-bucket', fileName, 7 * 24 * 60 * 60)
  
  return { url, fileName }
}
```

### 4. **Update Database Schema**

```typescript
// Tambahkan field untuk menyimpan path MinIO
export const rentBills = pgTable('rent_bills', {
  // ... existing fields
  pdfUrl: varchar('pdf_url', { length: 512 }),
  pdfPath: varchar('pdf_path', { length: 256 }), // MinIO path
})

export const properties = pgTable('properties', {
  // ... existing fields
  image: varchar('image', { length: 512 }), // Existing (bisa URL eksternal atau MinIO)
  imagePath: varchar('image_path', { length: 256 }), // MinIO path internal
})
```

---

## ✅ Kelebihan MinIO

### 1. **Self-Hosted & Free**
- Open source, gratis sepenuhnya
- Tidak ada biaya per GB seperti AWS S3
- Full control atas data

### 2. **S3 Compatible**
- API compatible dengan AWS S3
- Mudah migrasi ke/dari S3 jika perlu
- Support semua S3 SDK dan tools

### 3. **Performance**
- Sangat cepat untuk local/private cloud
- Bisa di-deploy di server yang sama (low latency)
- High throughput untuk upload/download

### 4. **Docker Ready**
- Mudah setup dengan Docker Compose
- Scaling horizontal mudah
- Container-based deployment

### 5. **Multi-Tenancy**
- Support multiple buckets
- Fine-grained access control
- Policy-based permissions

### 6. **Versioning & Lifecycle**
- Object versioning support
- Lifecycle policies untuk auto-delete old files
- Immutable objects

---

## ⚠️ Kekurangan MinIO

### 1. **Bukan True CDN**
- MinIO adalah object storage, bukan CDN
- Tidak ada edge locations global
- Latency tergantung jarak ke server

### 2. **Perlu Infrastructure Management**
- Harus maintain server sendiri
- Backup responsibility
- Monitoring & security updates

### 3. **Bandwidth Costs (Jika Cloud)**
- Jika deploy di VPS, bandwidth bisa mahal
- Tidak ada CDN caching
- Semua request hit origin server

### 4. **No Auto Image Optimization**
- Tidak ada auto resize/compress seperti Cloudinary
- Harus handle transformation sendiri
- Perlu additional processing layer

---

## 🔄 Solusi Hybrid: MinIO + CDN

### Arsitektur Recommended

```
User Request
    ↓
Cloudflare CDN (Cache)
    ↓
Nginx Reverse Proxy (Optional)
    ↓
MinIO Server (Origin)
```

### Implementasi Cloudflare CDN

1. **Setup Cloudflare untuk domain**
   - `cdn.kostman.app` → CNAME ke server MinIO
   - Enable Cloudflare Proxy (orange cloud)

2. **Cache Rules**
   ```
   Cache TTL: 1 month untuk images
   Cache TTL: 1 day untuk PDFs
   Browser Cache: 7 days
   ```

3. **Access via**
   ```
   https://cdn.kostman.app/kostman-bucket/properties/abc123/cover.jpg
   ```

### Keuntungan Hybrid:
- ✅ MinIO sebagai storage (murah, control penuh)
- ✅ Cloudflare sebagai CDN (gratis, global edge)
- ✅ Caching otomatis
- ✅ DDoS protection
- ✅ SSL gratis

---

## 🆚 Perbandingan Alternatif

| Feature | MinIO + CF | Cloudinary | Supabase Storage | AWS S3 + CloudFront |
|---------|-----------|-----------|------------------|---------------------|
| **Biaya Setup** | Free | Free tier | Free tier | Pay as you go |
| **Storage Cost** | Server only | $0.02/GB | $0.021/GB | $0.023/GB |
| **CDN** | Via Cloudflare | Built-in | Via CDN | CloudFront |
| **Image Transform** | Manual | Auto | Manual | Manual + Lambda |
| **Bandwidth** | Server cost | Free 25GB/mo | Free 200GB/mo | $0.09/GB |
| **Complexity** | Medium | Low | Low | High |
| **Control** | Full | Limited | Limited | Full |

---

## 📋 Langkah Implementasi

### Phase 1: Setup MinIO (Week 1)
- [ ] Add MinIO to docker-compose
- [ ] Create MinIO client utility
- [ ] Setup bucket & policies
- [ ] Test upload/download

### Phase 2: Upload API (Week 2)
- [ ] Create upload endpoint untuk images
- [ ] Integrate dengan Property/Room forms
- [ ] Add file validation (size, type)
- [ ] Generate thumbnail (optional)

### Phase 3: PDF Generation (Week 3)
- [ ] Setup PDFKit atau Puppeteer
- [ ] Generate bill PDF dengan template
- [ ] Auto-upload ke MinIO
- [ ] Save URL di database

### Phase 4: CDN Integration (Week 4)
- [ ] Setup Cloudflare untuk domain
- [ ] Configure cache rules
- [ ] Update all URLs to use CDN
- [ ] Test performance

### Phase 5: Migration (Week 5)
- [ ] Migrate existing external URLs (optional)
- [ ] Batch upload existing images
- [ ] Update database records
- [ ] Cleanup old URLs

---

## 🔐 Security Considerations

### 1. **Access Control**
```typescript
// Private files (bills, receipts) - Presigned URLs
const url = await minioClient.presignedGetObject(
  'kostman-bucket', 
  `bills/${billId}.pdf`, 
  24 * 60 * 60 // Valid 24 hours
)

// Public files (property images) - Public URLs
const url = `https://cdn.kostman.app/kostman-bucket/properties/${propertyId}/cover.jpg`
```

### 2. **File Validation**
```typescript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
  throw createError({ statusCode: 400, message: 'Invalid file type' })
}
if (file.data.length > MAX_FILE_SIZE) {
  throw createError({ statusCode: 400, message: 'File too large' })
}
```

### 3. **Environment Variables**
```env
# .env
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_USE_SSL=false
MINIO_PUBLIC_URL=https://cdn.kostman.app
```

---

## 📊 Estimasi Biaya (VPS Hosting)

### Scenario: 100 Properties, 500 Rooms, 1000 Bills/month

**Storage:**
- Images: 100 properties × 2MB + 500 rooms × 1MB = 700MB
- PDFs: 1000 bills/month × 100KB × 12 months = 1.2GB
- **Total: ~2GB/tahun**

**Bandwidth:**
- View bills: 1000 views/month × 100KB = 100MB/month
- View images: 5000 views/month × 500KB = 2.5GB/month
- **Total: ~2.6GB/month = 31GB/tahun**

**VPS Requirements:**
- 2GB RAM
- 20GB SSD (untuk OS + MinIO + buffer)
- 100GB bandwidth/month
- **Cost: ~$5-10/month (Hetzner, DigitalOcean)**

**Cloudflare CDN: FREE**
- Unlimited bandwidth
- Global CDN
- DDoS protection

**Total Cost: $60-120/tahun** (jauh lebih murah dari Cloudinary paid plan)

---

## 🎯 Rekomendasi Final

### ✅ **GUNAKAN MinIO + Cloudflare Jika:**
- Budget terbatas
- Sudah punya VPS/server
- Perlu control penuh atas data
- Traffic masih moderate (<100K request/month)
- Aplikasi untuk single country/region

### ❌ **JANGAN Gunakan MinIO Jika:**
- Butuh auto image optimization
- Traffic global dengan high volume
- Tidak ingin maintain infrastructure
- Perlu advanced features (AI tagging, face detection, dll)

### 💡 **Hybrid Approach (Best of Both Worlds):**
- MinIO untuk **documents** (bills, reports, receipts)
- Cloudinary untuk **images** (properties, rooms)
- Alasan: Documents tidak perlu CDN/optimization, images benefit dari Cloudinary transforms

---

## 📚 Resources

- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [MinIO JavaScript SDK](https://min.io/docs/minio/linux/developers/javascript/minio-javascript.html)
- [Cloudflare CDN Setup](https://developers.cloudflare.com/cache/)
- [S3 API Compatibility](https://min.io/product/s3-compatibility)

---

**Status:** 📝 Brainstorming/Planning  
**Next Action:** Review & decide on implementation approach  
**Owner:** Dev Team  
**Updated:** January 20, 2026
