# Date-Based Billing Cycle Proposal

## Executive Summary

Proposal untuk mengubah sistem billing dari **Calendar Month** ke **Date-Based Billing Cycle** untuk mendukung billing yang mengikuti tanggal move-in tenant.

**Status**: Proposal - Menunggu persetujuan tim  
**Impact**: Breaking change - Memerlukan database migration  
**Estimated Effort**: High (3-5 hari development + testing)

---

## Current System (Calendar Month Billing)

### Cara Kerja
- Billing berdasarkan **bulan kalender** (Jan, Feb, Mar, dst)
- Period format: `YYYY-MM` (contoh: `2026-01`, `2026-02`)
- Satu rent bill = satu atau lebih bulan kalender penuh
- Move-in date hanya digunakan untuk validasi (minimal 31 hari setelah move-in baru bisa billing)

### Contoh Skenario
```
Tenant: Ardi
Room: 102 Kost Akasia
Move-in: 21 Januari 2026
Room Price: Rp 850.000/bulan

Billing Timeline:
- 21 Jan 2026: Move-in
- 22 Feb 2026: Bisa generate rent bill untuk periode "2026-02" (full month Feb)
  - Tagihan: Rp 850.000 untuk 1-28 Feb (28 hari)
- 1 Mar 2026: Bisa generate rent bill untuk periode "2026-03" (full month Mar)
  - Tagihan: Rp 850.000 untuk 1-31 Mar (31 hari)
```

### Kelebihan
✅ Sederhana - mudah dipahami (billing per bulan kalender)  
✅ Schema database simple (`period VARCHAR(7)`)  
✅ Kompatibel dengan akuntansi standar (per month)  
✅ Mudah filter dan group by month  

### Kekurangan
❌ Tidak fair - tenant bayar sama untuk 28 hari (Feb) vs 31 hari (Mar)  
❌ Move-in mid-month menghasilkan billing yang tidak aligned  
❌ Due date tidak konsisten dengan move-in date  
❌ Reminder tidak bisa otomatis (tidak ada due date tracking)  

---

## Proposed System (Date-Based Billing Cycle)

### Cara Kerja
- Billing berdasarkan **tanggal move-in** (date-based cycle)
- Period format: `YYYY-MM-DD to YYYY-MM-DD` atau simpan start/end date terpisah
- Satu rent bill = 30 hari (atau 1 month sejak start date)
- Due date = tanggal yang sama setiap bulan (sesuai move-in date)

### Contoh Skenario
```
Tenant: Ardi
Room: 102 Kost Akasia
Move-in: 21 Januari 2026
Room Price: Rp 850.000/bulan
Due Date: Tanggal 21 setiap bulan

Billing Timeline:
- 21 Jan 2026: Move-in, billing pertama otomatis
  - Period: 21 Jan - 20 Feb
  - Tagihan: Rp 850.000
  - Due Date: 20 Feb 2026 (atau 21 Feb, tergantung kebijakan)
  
- 21 Feb 2026: Generate billing kedua
  - Period: 21 Feb - 20 Mar
  - Tagihan: Rp 850.000
  - Due Date: 20 Mar 2026
  
- 21 Mar 2026: Generate billing ketiga
  - Period: 21 Mar - 20 Apr
  - Tagihan: Rp 850.000
  - Due Date: 20 Apr 2026
```

### Kelebihan
✅ **Fair billing** - setiap period selalu 30/31 hari (atau fixed duration)  
✅ **Konsisten dengan move-in** - billing date aligned dengan move-in date  
✅ **Due date tracking** - bisa otomatis reminder sebelum due date  
✅ **Lebih intuitif** untuk tenant (bayar setiap tanggal yang sama)  
✅ **Support proration** - mudah hitung partial month saat move-out  

### Kekurangan
❌ **Kompleks** - logic lebih rumit (handle month boundaries, leap year, dst)  
❌ **Database migration** - perlu ubah schema dan migrate existing data  
❌ **Reporting** - lebih susah group by calendar month untuk laporan  
❌ **Multi-month payment** - lebih kompleks (3 bulan = 90 hari? atau 3 cycles?)  

---

## Database Schema Changes

### Current Schema
```typescript
export const rentBills = pgTable("rent_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").references(() => rooms.id).notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  period: varchar("period", { length: 7 }).notNull(), // ❌ YYYY-MM only
  periodEnd: varchar("period_end", { length: 7 }),    // ❌ For multi-month
  monthsCovered: integer("months_covered").default(1),
  roomPrice: decimal("room_price", { precision: 12, scale: 2 }).notNull(),
  waterFee: decimal("water_fee", { precision: 12, scale: 2 }).default("0"),
  trashFee: decimal("trash_fee", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paidAt: timestamp("paid_at"),
  generatedAt: timestamp("generated_at").notNull(),
});
```

### Proposed Schema (Option A: Date Range)
```typescript
export const rentBills = pgTable("rent_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").references(() => rooms.id).notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  
  // ✅ NEW: Date range fields
  periodStartDate: date("period_start_date").notNull(), // 2026-01-21
  periodEndDate: date("period_end_date").notNull(),     // 2026-02-20
  dueDate: date("due_date").notNull(),                  // 2026-02-20 or 2026-02-21
  
  // Keep for backward compatibility/reporting
  period: varchar("period", { length: 7 }),             // Still "2026-01" for reporting
  
  // Pricing
  roomPrice: decimal("room_price", { precision: 12, scale: 2 }).notNull(),
  waterFee: decimal("water_fee", { precision: 12, scale: 2 }).default("0"),
  trashFee: decimal("trash_fee", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Payment tracking
  isPaid: boolean("is_paid").default(false),
  paidAt: timestamp("paid_at"),
  
  // Metadata
  generatedAt: timestamp("generated_at").notNull(),
  billingCycleDay: integer("billing_cycle_day"),        // Store cycle day (21)
});
```

### Proposed Schema (Option B: Cycle-Based)
```typescript
export const rentBills = pgTable("rent_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").references(() => rooms.id).notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  
  // ✅ NEW: Cycle tracking
  billingCycleNumber: integer("billing_cycle_number").notNull(), // 1, 2, 3, ...
  cycleStartDate: date("cycle_start_date").notNull(),
  cycleEndDate: date("cycle_end_date").notNull(),
  dueDate: date("due_date").notNull(),
  
  // Keep period for backward compatibility
  period: varchar("period", { length: 7 }),
  
  // Pricing (same as above)
  // ...
});
```

---

## API Changes Required

### 1. Rent Bill Generation API
**Current**: `POST /api/rent-bills/generate`
```typescript
// Current input
{
  roomId: string;
  period: string;        // "2026-01"
  monthsCovered: number; // 1, 2, 3, ...
}
```

**Proposed**:
```typescript
// Option A: Explicit dates
{
  roomId: string;
  periodStartDate: string;  // "2026-01-21"
  periodEndDate: string;    // "2026-02-20" (auto-calculate or manual)
  dueDate?: string;         // "2026-02-20" (optional, auto dari endDate)
}

// Option B: Cycle-based (simpler)
{
  roomId: string;
  cycleNumber?: number;     // Auto-increment if not provided
  // Start/end dates auto-calculated from moveInDate + cycleNumber
}
```

### 2. Validation Logic Changes
```typescript
// Current: Check calendar month overlap
const existingBills = await db.select()
  .from(rentBills)
  .where(eq(rentBills.period, input.period));

// Proposed: Check date range overlap
const existingBills = await db.select()
  .from(rentBills)
  .where(
    and(
      eq(rentBills.roomId, input.roomId),
      or(
        // New period starts during existing period
        and(
          gte(input.periodStartDate, rentBills.periodStartDate),
          lte(input.periodStartDate, rentBills.periodEndDate)
        ),
        // New period ends during existing period
        and(
          gte(input.periodEndDate, rentBills.periodStartDate),
          lte(input.periodEndDate, rentBills.periodEndDate)
        ),
        // New period completely contains existing period
        and(
          lte(input.periodStartDate, rentBills.periodStartDate),
          gte(input.periodEndDate, rentBills.periodEndDate)
        )
      )
    )
  );
```

### 3. Date Picker Disable Logic
```typescript
// Current: Disable calendar months
const isDateUnavailable = computed(() => {
  return (date: DateValue) => {
    const periodStr = `${date.year}-${String(date.month).padStart(2, '0')}`;
    return existingRentBillPeriods.includes(periodStr);
  };
});

// Proposed: Disable date ranges
const isDateUnavailable = computed(() => {
  return (date: DateValue) => {
    const checkDate = new Date(date.year, date.month - 1, date.day);
    
    // Check if date falls within any existing billing period
    for (const bill of existingRentBills.value) {
      const start = new Date(bill.periodStartDate);
      const end = new Date(bill.periodEndDate);
      if (checkDate >= start && checkDate <= end) {
        return true;
      }
    }
    
    // Check if 30 days from this date would overlap
    const periodEnd = new Date(checkDate);
    periodEnd.setDate(periodEnd.getDate() + 30);
    for (const bill of existingRentBills.value) {
      const start = new Date(bill.periodStartDate);
      const end = new Date(bill.periodEndDate);
      if (periodEnd > start && checkDate < end) {
        return true;
      }
    }
    
    return false;
  };
});
```

### 4. Reminder System
```typescript
// NEW: Auto-calculate reminders based on due date
const upcomingDueBills = await db.select()
  .from(rentBills)
  .where(
    and(
      eq(rentBills.isPaid, false),
      gte(rentBills.dueDate, today),
      lte(rentBills.dueDate, threeDaysFromNow)
    )
  );
```

---

## UI/UX Changes

### 1. Generate Rent Bill Modal
**Current**:
- Select: Property
- Select: Room
- DatePicker (month): Period Mulai
- Input: Jumlah Bulan

**Proposed (Option A - Manual)**:
- Select: Property
- Select: Room
- DatePicker (day): Period Start Date (default: move-in date + last cycle end)
- DatePicker (day): Period End Date (auto: start + 30 days, editable)
- DatePicker (day): Due Date (auto: end date, editable)

**Proposed (Option B - Auto)**:
- Select: Property
- Select: Room
- Button: "Generate Next Billing Cycle" (auto-calculate everything)
- Display: Preview period (21 Feb - 20 Mar), Due: 20 Mar

### 2. Billing History Table
**Current**:
| Period | Room | Months | Total | Status |
|--------|------|--------|-------|--------|
| 2026-01 | 102 | 1 | 850.000 | Paid |

**Proposed**:
| Period | Room | Days | Due Date | Total | Status |
|--------|------|------|----------|-------|--------|
| 21 Jan - 20 Feb | 102 | 30 | 20 Feb | 850.000 | Paid |
| 21 Feb - 20 Mar | 102 | 30 | 20 Mar | 850.000 | Unpaid |

### 3. Date Picker Behavior
**Current**: Granularity = month, disable months with bills  
**Proposed**: Granularity = day, disable dates in existing periods

---

## Migration Strategy

### Phase 1: Database Migration
```sql
-- Add new columns (nullable first)
ALTER TABLE rent_bills 
  ADD COLUMN period_start_date DATE,
  ADD COLUMN period_end_date DATE,
  ADD COLUMN due_date DATE,
  ADD COLUMN billing_cycle_day INTEGER;

-- Migrate existing data (estimate dates from period)
UPDATE rent_bills
SET 
  period_start_date = (period || '-01')::DATE,
  period_end_date = (
    DATE_TRUNC('month', (period || '-01')::DATE) + INTERVAL '1 month' - INTERVAL '1 day'
  )::DATE,
  due_date = (
    DATE_TRUNC('month', (period || '-01')::DATE) + INTERVAL '1 month' - INTERVAL '1 day'
  )::DATE,
  billing_cycle_day = 1
WHERE period_start_date IS NULL;

-- Make columns required
ALTER TABLE rent_bills 
  ALTER COLUMN period_start_date SET NOT NULL,
  ALTER COLUMN period_end_date SET NOT NULL,
  ALTER COLUMN due_date SET NOT NULL;
```

### Phase 2: Code Update
1. Update Drizzle schema
2. Update validation logic
3. Update API endpoints
4. Update UI components
5. Update PDF generator

### Phase 3: Testing
1. Unit tests for date overlap logic
2. Integration tests for billing generation
3. E2E tests for full flow
4. Manual testing dengan various scenarios

### Phase 4: Deployment
1. Database backup
2. Run migration script
3. Deploy new code
4. Verify existing data
5. Monitor errors

---

## Alternative: Hybrid Approach

Tetap gunakan calendar month, tapi tambah **proration** dan **due date tracking**.

### Changes Required
```typescript
export const rentBills = pgTable("rent_bills", {
  // ... existing fields
  
  // NEW: Add due date tracking
  dueDate: date("due_date"),                    // Based on move-in date
  billingCycleDay: integer("billing_cycle_day"), // Store cycle day from move-in
  
  // NEW: Add proration support
  isProrated: boolean("is_prorated").default(false),
  proratedDays: integer("prorated_days"),
  proratedFromDate: date("prorated_from_date"),
  proratedToDate: date("prorated_to_date"),
});
```

### Example Flow
```
Move-in: 21 Jan 2026
Billing Cycle Day: 21

First Billing (Prorated):
- Period: 2026-01 (calendar month)
- Prorated: true
- Days: 11 days (21-31 Jan)
- Amount: 850.000 × 11/31 = 301.612
- Due Date: 31 Jan 2026

Second Billing:
- Period: 2026-02 (calendar month)
- Prorated: false (full month)
- Days: 28 days
- Amount: 850.000
- Due Date: 20 Feb 2026 (or 21 Feb based on policy)

Third Billing:
- Period: 2026-03
- Amount: 850.000
- Due Date: 20 Mar 2026
```

**Pros**: Lebih sederhana dari full date-based, tetap support calendar month reporting  
**Cons**: Masih ada inconsistency (28 vs 31 days bayar sama)

---

## Decision Matrix

| Criteria | Calendar Month | Date-Based | Hybrid (Proration) |
|----------|---------------|------------|-------------------|
| **Fairness** | ❌ Low | ✅ High | ⚠️ Medium |
| **Complexity** | ✅ Low | ❌ High | ⚠️ Medium |
| **Development Effort** | ✅ None | ❌ High (3-5 days) | ⚠️ Medium (2-3 days) |
| **Reporting** | ✅ Easy | ❌ Complex | ✅ Easy |
| **Due Date Tracking** | ❌ No | ✅ Yes | ✅ Yes |
| **Intuitive for Tenant** | ⚠️ Medium | ✅ High | ⚠️ Medium |
| **Migration Risk** | ✅ None | ❌ High | ⚠️ Medium |

---

## Recommendation

### For Small-Medium Kost (< 50 rooms)
**Recommended**: **Date-Based Billing Cycle**
- Lebih fair untuk tenant
- Better tenant satisfaction
- Professional reminder system
- Worth the development effort

### For Large Kost Operation (> 50 rooms)
**Recommended**: **Hybrid Approach**
- Balance antara fairness dan simplicity
- Easier migration
- Keep calendar month for accounting
- Add proration for first/last month

### For Minimal Change
**Recommended**: **Keep Calendar Month** + enhance UX
- Add proration calculator tool
- Add manual due date field
- Improve reminder based on move-in date awareness

---

## Next Steps

1. **Team Decision**: Pilih approach (Date-Based vs Hybrid vs Keep)
2. **Requirements Clarification**:
   - Billing cycle: 30 days fixed atau 1 month (variable)?
   - Due date: End date atau end date +1?
   - Multi-month payment: Bagaimana handle?
   - Proration: Required untuk first month?
3. **Create Detailed Spec**: Jika approve, buat spec detail untuk development
4. **Development**: Estimate 3-5 hari untuk date-based, 2-3 hari untuk hybrid
5. **Testing**: Comprehensive testing dengan edge cases
6. **Deployment**: Plan migration dengan minimal downtime

---

## Questions for Discussion

1. **Billing Cycle Duration**: 30 days fixed atau 1 calendar month sejak start date?
2. **Due Date Policy**: End date sama dengan due date, atau +1 day grace period?
3. **Multi-Month Payment**: Bagaimana handle 3 bulan bayar sekaligus?
4. **Proration**: Required untuk first month? Last month (move-out)?
5. **Existing Data**: Migrate atau keep as-is dan apply new system untuk billing baru?
6. **Reporting**: Tetap perlu report per calendar month atau per cycle OK?
7. **Late Payment**: Denda keterlambatan based on due date?

---

**Document Version**: 1.0  
**Created**: 2026-01-19  
**Author**: Development Team  
**Status**: Draft - Awaiting Team Review
