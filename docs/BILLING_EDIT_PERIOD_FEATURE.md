# 📅 Edit Bill Period Feature

## Overview
Feature untuk mengubah periode billing dan otomatis recalculate rent charges berdasarkan months covered yang baru.

---

## ✅ Implementation Complete

### Backend (100%)
- ✅ Validation schema: `updateBillPeriodSchema`
- ✅ API endpoint: `PUT /api/bills/:id/period`
- ✅ Auto-recalculation of rent charges
- ✅ Period overlap validation
- ✅ Transaction support

### Frontend (100%)
- ✅ Edit Period button in bill detail modal
- ✅ Edit Period modal with date pickers
- ✅ Warning message about recalculation
- ✅ Integration with API
- ✅ Auto-refresh after update

---

## 🎯 How It Works

### Backend Logic

1. **Validate New Period**
   - Check period format (YYYY-MM-DD)
   - Ensure end >= start
   - Check for overlaps with other bills (excluding current bill)

2. **Recalculate Months Covered**
   ```typescript
   const newMonthsCovered = calculateMonthsCovered(periodStart, periodEnd)
   ```

3. **Recalculate Rent Charges**
   ```typescript
   const newRentCharges = await calculateRentCharges(roomId, newMonthsCovered)
   ```

4. **Update Database (Transaction)**
   - Update rent billing detail item
   - Recalculate total bill amount
   - Update bill period and months covered

### What Gets Updated

| Item | Updated? | How |
|------|----------|-----|
| Period Start | ✅ Yes | Direct update |
| Period End | ✅ Yes | Direct update |
| Months Covered | ✅ Yes | Recalculated |
| Rent Item Name | ✅ Yes | e.g., "Sewa Kamar (2 bulan)" |
| Rent Quantity | ✅ Yes | New months covered |
| Rent Unit Price | ✅ Yes | Room price |
| Rent Subtotal | ✅ Yes | Qty × Price |
| Rent Total | ✅ Yes | Subtotal - Discount |
| Bill Total | ✅ Yes | Sum of all items |
| Utility Items | ❌ No | Unchanged |
| Other Items | ❌ No | Unchanged |

---

## 📍 How to Use

### Step-by-Step

1. **Open Bill Details**
   - Go to `/billing/consolidated`
   - Click 👁️ (eye) icon on any bill

2. **Click Edit Period Button**
   - Find "Period" field in bill info
   - Click ✏️ (pencil) icon next to it
   - Only visible for non-paid bills

3. **Update Period**
   - Change Period Start date
   - Change Period End date
   - Read the warning message
   - Click "Update Period"

4. **Automatic Updates**
   - ✅ Rent charges recalculated
   - ✅ Months covered updated
   - ✅ Bill total updated
   - ✅ Detail modal refreshed

---

## 🔒 Business Rules

### Protection
- ✅ **Paid bills CANNOT be modified**
- ✅ **Period must not overlap** with other bills for same room
- ✅ **End date must be >= start date**

### Recalculation
- ✅ **Rent item automatically updated**
- ✅ **Months covered recalculated**
- ✅ **Bill total recalculated**
- ❌ **Utility items NOT changed** (manual adjustment needed)
- ❌ **Other items NOT changed**

---

## 💡 Use Cases

### Use Case 1: Extend Billing Period
**Scenario**: Tenant wants to extend from 1 month to 2 months

**Before**:
- Period: 2026-01-01 to 2026-01-31
- Months: 1
- Rent: Rp 1,000,000

**Action**:
- Change Period End to 2026-02-28

**After**:
- Period: 2026-01-01 to 2026-02-28
- Months: 2
- Rent: Rp 2,000,000 (auto-calculated)

---

### Use Case 2: Shorten Billing Period
**Scenario**: Tenant will leave earlier than expected

**Before**:
- Period: 2026-01-01 to 2026-03-31
- Months: 3
- Rent: Rp 3,000,000

**Action**:
- Change Period End to 2026-02-28

**After**:
- Period: 2026-01-01 to 2026-02-28
- Months: 2
- Rent: Rp 2,000,000 (auto-calculated)

---

### Use Case 3: Adjust Start Date
**Scenario**: Tenant moved in later than planned

**Before**:
- Period: 2026-01-01 to 2026-01-31
- Months: 1
- Rent: Rp 1,000,000

**Action**:
- Change Period Start to 2026-01-15

**After**:
- Period: 2026-01-15 to 2026-01-31
- Months: 0.55 (17 days / 31 days)
- Rent: Rp 550,000 (auto-calculated)

---

## ⚠️ Important Notes

### Manual Adjustments Needed

After changing period, you may need to manually adjust:

1. **Utility Items**
   - If period changed, utility readings may need update
   - Use Edit Item feature to adjust

2. **Other Charges**
   - Parking, cleaning, etc. may need adjustment
   - Use Edit Item feature to modify

### Warning Message

The modal shows a warning:
> **Note:** Changing the period will automatically recalculate the rent charges based on the new months covered.

This reminds users that:
- Rent will be recalculated
- Other items won't change automatically
- Manual adjustment may be needed

---

## 🔧 API Details

### Endpoint
```
PUT /api/bills/:id/period
```

### Request Body
```json
{
  "periodStart": "2026-01-01",
  "periodEnd": "2026-02-28"
}
```

### Response
```json
{
  "success": true,
  "message": "Bill period updated and rent charges recalculated successfully",
  "data": {
    "id": "uuid",
    "periodStart": "2026-01-01",
    "periodEnd": "2026-02-28",
    "monthsCovered": "2.00",
    "totalChargedAmount": "2000000.00",
    ...
  }
}
```

### Error Responses

**400 - Validation Error**
```json
{
  "statusCode": 400,
  "message": "Period end must be greater than or equal to period start"
}
```

**400 - Paid Bill**
```json
{
  "statusCode": 400,
  "message": "Cannot modify period of a paid bill"
}
```

**400 - Period Overlap**
```json
{
  "statusCode": 400,
  "message": "Billing period overlaps with existing bill: BILL-2026-01-002"
}
```

---

## 🎨 UI Components

### Edit Period Button
- **Location**: Bill detail modal → Period field
- **Icon**: ✏️ (pencil)
- **Visibility**: Hidden for paid bills
- **Action**: Opens Edit Period modal

### Edit Period Modal
- **Title**: "Edit Bill Period"
- **Warning**: Yellow alert box
- **Fields**: 
  - Period Start (date picker)
  - Period End (date picker)
- **Buttons**:
  - Cancel (outline)
  - Update Period (primary)

---

## ✅ Testing Checklist

- [ ] Edit period for draft bill
- [ ] Edit period for unpaid bill
- [ ] Try to edit paid bill (should be hidden)
- [ ] Extend period (increase months)
- [ ] Shorten period (decrease months)
- [ ] Change start date only
- [ ] Change end date only
- [ ] Try overlapping period (should error)
- [ ] Try end < start (should error)
- [ ] Verify rent recalculation
- [ ] Verify total recalculation
- [ ] Verify utility items unchanged
- [ ] Verify other items unchanged

---

## 📊 Summary

| Feature | Status | Location |
|---------|--------|----------|
| Backend API | ✅ Complete | `/api/bills/:id/period` |
| Validation | ✅ Complete | `updateBillPeriodSchema` |
| Frontend UI | ✅ Complete | Bill Detail Modal |
| Edit Button | ✅ Complete | Period field |
| Edit Modal | ✅ Complete | Separate modal |
| Auto Recalc | ✅ Complete | Rent charges |
| Protection | ✅ Complete | Paid bills |

**Status**: ✅ **100% Complete & Ready to Use!**

---

**Created**: 2026-01-18  
**Version**: 1.0  
**Feature**: Edit Bill Period with Auto Rent Recalculation
