# Excel Import Feature - Documentation

## 📋 Overview

Fitur import Excel memungkinkan pengguna untuk import data properties, rooms, dan tenants secara batch dari file Excel.

## 🎯 Features

### 1. **5-Step Import Wizard**
- ✅ **Step 1: Upload** - Upload file Excel dengan drag & drop
- ✅ **Step 2: Preview** - Preview data yang akan diimport
- ✅ **Step 3: Validation** - Validasi data sebelum import
- ✅ **Step 4: Import** - Progress tracking import process
- ✅ **Step 5: Result** - Summary dan detail hasil import

### 2. **File Upload**
- Drag & drop support
- File type validation (.xlsx, .xls)
- File size limit (10MB)
- Template download feature

### 3. **Data Preview**
- Summary cards (Properties, Rooms, Tenants, Occupied)
- Tabbed view untuk different entities
- Data table dengan pagination
- Warning indicators untuk data quality issues

### 4. **Data Validation**
- Pre-import validation
- Warning untuk dummy data
- Error detection untuk incomplete data
- Clear validation results display

### 5. **Import Options**
- Skip duplicates
- Update existing data
- Generate default passwords
- Generate default PINs

### 6. **Progress Tracking**
- Real-time progress bar
- Step-by-step status indicators
- Detailed import logs

### 7. **Result Summary**
- Success/failure indicator
- Statistics (created, updated, skipped)
- Detailed breakdown per entity
- Error list (if any)

## 📊 Excel File Structure

### Required Columns (19 total):

| Column Name | Type | Description | Example |
|-------------|------|-------------|---------|
| `users_email` | String | Email user/owner | owner@example.com |
| `property_name` | String | Nama properti | PONDOK UMA TAKI |
| `property_address` | String | Alamat properti | Jl. Example No. 1 |
| `property_description` | String | Deskripsi properti | Kost nyaman |
| `rooms_name` | String | Nama kamar | TAKI-01 |
| `rooms_price` | Number | Harga kamar | 800000 |
| `property_settings_cost_per_kwh` | Number | Biaya per kWh | 2200 |
| `water` | Number | Biaya air | 15000 |
| `trash` | Number | Biaya sampah | 25000 |
| `room_status` | Enum | Status kamar | available/occupied/maintenance |
| `use_trash_service` | Boolean | Gunakan layanan sampah | true/false |
| `move_in_date` | Number | Tanggal masuk | 20260101 |
| `ocupant_count` | Number | Jumlah penghuni | 1 |
| `tenant_name` | String | Nama penyewa | John Doe |
| `tenant_id_card_number` | String | NIK penyewa | 1234567890123456 |
| `tenant_phone` | String | Nomor HP penyewa | 081234567890 |
| `meter_start` | Number | Meter awal | 1200 |
| `meter_end` | Number | Meter akhir | 1700 |
| `recorder_by` | String | Email perekam | owner@example.com |

### Sample Data:

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
  "tenant_id_card_number": "1234567890123456",
  "tenant_phone": "081234567890",
  "meter_start": 1200,
  "meter_end": 1700,
  "recorder_by": "owner@example.com"
}
```

## 🔧 Technical Implementation

### Frontend (`pages/admin/import.vue`)

**Key Features:**
- Vue 3 Composition API
- Nuxt UI components
- XLSX library untuk parsing Excel
- Reactive state management
- Multi-step wizard navigation

**State Management:**
```javascript
- currentStep: Current wizard step (1-5)
- uploadedFile: Uploaded file object
- previewData: Processed preview data
- validationResults: Validation results
- importOptions: User-selected import options
- importProgress: Real-time import progress
- importResult: Final import result
```

**Key Methods:**
- `parseExcelFile()` - Parse uploaded Excel file
- `processPreviewData()` - Process and transform data for preview
- `validateData()` - Validate data before import
- `startImport()` - Execute import process
- `downloadTemplate()` - Generate and download Excel template

### Backend (`server/api/import/excel.post.ts`)

**Key Features:**
- Zod validation schema
- Database transaction support
- Duplicate detection
- Error handling & rollback
- Progress tracking

**Import Flow:**
```
1. Validate request body
2. Start database transaction
3. Import users (deduplicate by email)
4. Import properties (deduplicate by user + name)
5. Import property settings
6. Import tenants (deduplicate by name + phone)
7. Import rooms (deduplicate by property + name)
8. Commit transaction
9. Return stats and details
```

**Transaction Safety:**
- All operations dalam single transaction
- Automatic rollback on error
- Data integrity maintained

## 🎨 UI/UX Design

### Design Principles:
1. **Progressive Disclosure** - Information revealed step by step
2. **Clear Feedback** - Visual indicators untuk setiap action
3. **Error Prevention** - Validation sebelum destructive actions
4. **Undo/Retry** - Option untuk retry atau start over
5. **Responsive** - Mobile-friendly design

### Color Coding:
- 🟢 **Green** - Success, completed, occupied
- 🔵 **Blue** - Info, properties, processing
- 🟠 **Orange** - Warning, dummy data
- 🔴 **Red** - Error, failed
- ⚫ **Gray** - Neutral, available, pending

### Icons:
- `i-heroicons-cloud-arrow-up` - Upload
- `i-heroicons-eye` - Preview
- `i-heroicons-shield-check` - Validation
- `i-heroicons-arrow-down-tray` - Import
- `i-heroicons-check-circle` - Success
- `i-heroicons-x-circle` - Error
- `i-heroicons-exclamation-triangle` - Warning

## 📡 API Endpoints

### POST `/api/import/excel`

**Request Body:**
```json
{
  "data": [
    {
      "users_email": "owner@example.com",
      "property_name": "PONDOK EXAMPLE",
      ...
    }
  ],
  "options": {
    "skipDuplicates": true,
    "updateExisting": false,
    "generateDefaultPassword": true,
    "generateDefaultPin": true
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Data berhasil diimport",
  "stats": {
    "created": 150,
    "updated": 10,
    "skipped": 5
  },
  "details": {
    "users": 1,
    "properties": 11,
    "propertySettings": 11,
    "tenants": 116,
    "rooms": 173
  }
}
```

**Response (Error):**
```json
{
  "statusCode": 400,
  "message": "Validation error",
  "data": [...]
}
```

## 🔒 Security & Permissions

### Access Control:
- ✅ Middleware: `auth` - User must be authenticated
- ✅ Layout: `admin` - Admin layout required
- 🔜 TODO: Add role-based permission (only owner/admin can import)

### Data Security:
- Password hashing dengan bcrypt
- PIN hashing dengan bcrypt
- SQL injection prevention (Drizzle ORM)
- File type validation
- File size restriction

## 🧪 Testing Guide

### Manual Testing Steps:

1. **Upload Test:**
   - ✅ Upload valid .xlsx file
   - ✅ Upload invalid file type (should reject)
   - ✅ Upload file > 10MB (should reject)
   - ✅ Drag & drop functionality

2. **Preview Test:**
   - ✅ Verify counts are correct
   - ✅ Check table data display
   - ✅ Tab navigation works
   - ✅ Warning indicators show correctly

3. **Validation Test:**
   - ✅ Valid data passes validation
   - ✅ Invalid data shows errors
   - ✅ Warnings displayed for dummy data

4. **Import Test:**
   - ✅ Import completes successfully
   - ✅ Progress updates in real-time
   - ✅ Stats are accurate
   - ✅ Data appears in database

5. **Error Handling:**
   - ✅ File parse errors handled
   - ✅ Database errors cause rollback
   - ✅ Network errors show message
   - ✅ Retry functionality works

### Test Data:
Use `docs/clean.xlsx` as test file:
- 173 rooms across 11 properties
- 116 unique tenants
- 1 user (owner@example.com)

## 🚀 Usage Guide

### For End Users:

1. **Navigate to Import Page:**
   ```
   /admin/import
   ```

2. **Upload Excel File:**
   - Click "Pilih File" or drag & drop
   - Wait for file to upload

3. **Review Preview:**
   - Check summary cards
   - Review data in tables
   - Note any warnings

4. **Configure Options:**
   - Select import options
   - Review validation results

5. **Start Import:**
   - Click "Mulai Import"
   - Wait for completion
   - Review results

6. **Post-Import:**
   - View imported data
   - Or import another file

### For Developers:

1. **Add Custom Validation:**
   ```javascript
   // In validateData()
   if (customCondition) {
     validationResults.value.errors.push('Custom error message')
   }
   ```

2. **Extend Import Options:**
   ```javascript
   // Add new option
   const importOptions = ref({
     ...existing,
     newOption: false
   })
   ```

3. **Add New Entity Type:**
   - Update preview processing
   - Add new tab in preview
   - Extend API import logic
   - Update validation

## 📈 Performance Considerations

### Frontend:
- ✅ Pagination for large datasets (preview limited to 10 rows)
- ✅ Lazy loading for tabs
- ✅ Debounced file processing
- 🔜 TODO: Web Workers for Excel parsing (large files)

### Backend:
- ✅ Transaction batching
- ✅ Bulk inserts where possible
- ✅ Index usage for lookups
- 🔜 TODO: Queue system for very large imports

### Recommendations:
- Max file size: 10MB
- Max rows: ~5000 (tested with 173)
- Timeout: 60 seconds server-side

## 🐛 Known Issues & Limitations

1. **Date Format:**
   - Currently only supports numeric format (20260101)
   - TODO: Support standard date formats

2. **Meter Readings:**
   - Currently not imported
   - TODO: Create meter_readings during import

3. **File Size:**
   - Large files (>5000 rows) may timeout
   - TODO: Implement chunked import

4. **Duplicate Detection:**
   - Based on simple field matching
   - TODO: More sophisticated fuzzy matching

## 🔄 Future Enhancements

### Phase 2:
- [ ] Import validation dry-run mode
- [ ] Export current data to Excel
- [ ] Import history/logs
- [ ] Scheduled imports
- [ ] CSV format support

### Phase 3:
- [ ] Real-time collaboration
- [ ] Conflict resolution UI
- [ ] Advanced mapping options
- [ ] Custom validation rules
- [ ] API webhook notifications

## 📚 Related Documentation

- Database Schema: `server/database/schema.ts`
- Excel Analysis: `docs/EXCEL_IMPORT_ANALYSIS.md`
- API Reference: `server/api/import/excel.post.ts`

## 🆘 Troubleshooting

### Common Issues:

**Issue: "File format not supported"**
- Solution: Ensure file is .xlsx or .xls format

**Issue: "Import failed with transaction error"**
- Solution: Check database connection and constraints

**Issue: "Validation errors"**
- Solution: Review Excel file structure matches template

**Issue: "Timeout during import"**
- Solution: Reduce file size or split into multiple files

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-02  
**Maintainer:** KostMan Development Team
