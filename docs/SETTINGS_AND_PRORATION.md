# Settings API & Proration Implementation

**Date:** 2026-01-17  
**Status:** ✅ Complete

## Overview

This document details the implementation of two new features:
1. **Global Settings API** - System-wide configuration management
2. **Bill Proration** - Fair billing for mid-month move-ins

---

## 1. Global Settings API

### Purpose
Provide a centralized way to manage application-wide default settings that can be used as fallbacks when property-specific settings are not available.

### Database Schema

**Table:** `global_settings`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key | VARCHAR(100) | Setting key (unique) |
| value | VARCHAR(500) | Setting value |
| description | VARCHAR(255) | Optional description |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

### API Endpoints

#### GET /api/settings
Retrieve all global settings as a key-value object.

**Authentication:** Required (Admin, Owner, or Staff)

**Response:**
```json
{
  "defaultCostPerKwh": {
    "value": "1500",
    "description": "Default electricity cost per kWh",
    "updatedAt": "2026-01-17T08:30:00Z"
  },
  "defaultWaterFee": {
    "value": "50000",
    "description": "Default monthly water fee",
    "updatedAt": "2026-01-17T08:30:00Z"
  },
  "companyName": {
    "value": "KostMan Inc",
    "description": "",
    "updatedAt": "2026-01-17T08:30:00Z"
  }
}
```

#### PUT /api/settings
Update or create global settings.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "defaultCostPerKwh": "1500",
  "defaultWaterFee": "50000",
  "defaultTrashFee": "25000",
  "companyName": "KostMan Inc"
}
```

**Response:**
```json
{
  "message": "Settings updated successfully",
  "updated": 4,
  "settings": [
    {
      "id": "uuid",
      "key": "defaultCostPerKwh",
      "value": "1500",
      "description": null,
      "createdAt": "2026-01-17T08:30:00Z",
      "updatedAt": "2026-01-17T08:30:00Z"
    }
    // ... more settings
  ]
}
```

### Usage Examples

#### Retrieve Settings
```typescript
const settings = await $fetch('/api/settings', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

console.log(settings.defaultCostPerKwh.value); // "1500"
```

#### Update Settings (Admin Only)
```typescript
const response = await $fetch('/api/settings', {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${adminToken}`
  },
  body: {
    defaultCostPerKwh: '1600',
    companyName: 'My Kost Company'
  }
});
```

### Validation

- **Key:** Required, 1-100 characters
- **Value:** Required, 1-500 characters
- **Description:** Optional, max 255 characters

### Authorization

- **GET:** All authenticated users (Admin, Owner, Staff)
- **PUT:** Admin only

---

## 2. Bill Proration Feature

### Purpose
Calculate fair, proportional charges for tenants who move in mid-month, ensuring they only pay for the days they occupy the room.

### How It Works

#### Proration Logic

1. **Check if proration applies:**
   - Room must have a `moveInDate`
   - Bill period must be the same month as move-in
   - Move-in date must be after the 1st of the month

2. **Calculate proration factor:**
   ```
   daysInMonth = total days in the billing month
   daysOccupied = daysInMonth - moveInDate.day + 1
   prorationFactor = daysOccupied / daysInMonth
   ```

3. **Apply proration:**
   - **Room Price:** `price × monthsCovered × prorationFactor`
   - **Water Fee:** `waterFee × monthsCovered × prorationFactor`
   - **Trash Fee:** `trashFee × monthsCovered × prorationFactor`
   - **Usage Cost:** NOT prorated (based on actual meter reading)
   - **Additional Cost:** NOT prorated

### Examples

#### Example 1: Move-in on January 15th

**Scenario:**
- Room price: Rp 3,000,000/month
- Water fee: Rp 50,000/month
- Trash fee: Rp 25,000/month
- Move-in date: January 15, 2026
- Bill period: 2026-01

**Calculation:**
```
Days in January: 31
Days occupied: 31 - 15 + 1 = 17 days
Proration factor: 17/31 ≈ 0.5484

Room price: 3,000,000 × 0.5484 = Rp 1,645,200
Water fee: 50,000 × 0.5484 = Rp 27,420
Trash fee: 25,000 × 0.5484 = Rp 13,710
Usage cost: (meterEnd - meterStart) × costPerKwh (NOT prorated)

Total: Rp 1,686,330 + usage cost
```

#### Example 2: Move-in on February 15th (28 days)

**Scenario:**
- Room price: Rp 2,800,000/month
- Move-in date: February 15, 2026
- Bill period: 2026-02

**Calculation:**
```
Days in February: 28
Days occupied: 28 - 15 + 1 = 14 days
Proration factor: 14/28 = 0.5

Room price: 2,800,000 × 0.5 = Rp 1,400,000
Water fee: 50,000 × 0.5 = Rp 25,000
Trash fee: 25,000 × 0.5 = Rp 12,500
```

#### Example 3: No Proration (Move-in on 1st)

**Scenario:**
- Move-in date: January 1, 2026
- Bill period: 2026-01

**Result:** Full month charges (proration factor = 1.0)

#### Example 4: No Proration (Subsequent Month)

**Scenario:**
- Move-in date: December 15, 2025
- Bill period: 2026-01 (next month)

**Result:** Full month charges (proration only applies to move-in month)

### API Usage

The proration is **automatic** - no changes needed to the API call:

```typescript
// Generate bill for room with moveInDate
const bill = await $fetch('/api/bills/generate', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`
  },
  body: {
    roomId: 'room-uuid',
    period: '2026-01',
    meterStart: 100,
    meterEnd: 150,
    costPerKwh: 1500,
    waterFee: 50000,
    trashFee: 25000,
    monthsCovered: 1
  }
});

// Bill will automatically include prorated charges if applicable
console.log(bill.roomPrice); // Prorated amount
console.log(bill.waterFee);  // Prorated amount
console.log(bill.trashFee);  // Prorated amount
console.log(bill.usageCost); // NOT prorated
```

### Edge Cases Handled

1. **Room without moveInDate:** No proration (full month)
2. **Move-in on 1st of month:** No proration (full month)
3. **Subsequent months after move-in:** No proration (full month)
4. **Room without trash service:** Trash fee = 0 (regardless of proration)
5. **Different month lengths:** Correctly calculates days (28, 29, 30, or 31)
6. **Leap years:** Automatically handled by JavaScript Date

### Database Changes

No schema changes required - uses existing `moveInDate` field in `rooms` table.

---

## Testing

### Settings API Tests

**File:** `tests/settings.test.ts`

**Test Coverage:**
- ✅ GET settings (empty initial state)
- ✅ GET settings (with data)
- ✅ PUT settings (admin)
- ✅ PUT settings (reject non-admin)
- ✅ Authentication required
- ✅ Validation (empty keys)
- ✅ Update existing settings
- ✅ Create new settings

**Total Tests:** 8

### Proration Tests

**File:** `tests/proration.test.ts`

**Test Coverage:**
- ✅ Prorate for mid-month move-in (15th)
- ✅ No proration for 1st of month
- ✅ No proration for subsequent months
- ✅ Room without trash service
- ✅ Room without moveInDate
- ✅ Different month lengths (February)
- ✅ Correct calculation for various scenarios

**Total Tests:** 7

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test tests/settings.test.ts
npm run test tests/proration.test.ts
```

---

## Implementation Files

### Settings API

1. **Schema:** `server/database/schema.ts`
   - Added `globalSettings` table

2. **Validation:** `server/validations/settings.ts`
   - `settingSchema`
   - `updateSettingsSchema`

3. **Endpoints:**
   - `server/api/settings/index.get.ts` - GET settings
   - `server/api/settings/index.put.ts` - PUT settings

4. **Tests:** `tests/settings.test.ts`

### Proration Feature

1. **Logic:** `server/api/bills/generate.post.ts`
   - Updated cost calculation section
   - Added proration factor calculation
   - Applied proration to recurring charges

2. **Tests:** `tests/proration.test.ts`

---

## Migration Steps

### 1. Update Database Schema

```bash
npm run db:push
```

This will create the `global_settings` table.

### 2. Seed Default Settings (Optional)

```typescript
// Example: Seed default settings
await $fetch('/api/settings', {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${adminToken}`
  },
  body: {
    defaultCostPerKwh: '1500',
    defaultWaterFee: '50000',
    defaultTrashFee: '25000',
    companyName: 'KostMan',
    currency: 'IDR'
  }
});
```

### 3. Test Proration

No migration needed - proration works automatically with existing data.

---

## Performance Considerations

### Settings API
- **GET:** Single query, returns all settings
- **PUT:** One query per setting (upsert pattern)
- **Caching:** Consider caching settings in memory for high-traffic apps

### Proration
- **Overhead:** Minimal (simple date calculations)
- **No additional queries:** Uses existing room data
- **Performance impact:** Negligible

---

## Future Enhancements

### Settings API
1. **Setting categories** (e.g., billing, system, ui)
2. **Data type validation** (number, boolean, string)
3. **Setting history/audit log**
4. **User-level settings override**
5. **Settings import/export**

### Proration
1. **Custom proration rules** (e.g., round up/down)
2. **Proration for move-out** (partial month when leaving)
3. **Proration preview** (show calculation before generating bill)
4. **Proration report** (track prorated vs full bills)

---

## API Summary

### New Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings` | All roles | Get all settings |
| PUT | `/api/settings` | Admin only | Update settings |

### Updated Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| POST | `/api/bills/generate` | Now supports automatic proration |

---

## Status

- ✅ Settings API implemented
- ✅ Proration logic implemented
- ✅ Tests created (15 total tests)
- ✅ Documentation complete
- ⏳ Database migration pending (requires DB connection)

**Next Steps:**
1. Run `npm run db:push` when database is available
2. Run tests to verify functionality
3. Update implementation status document
4. Consider frontend integration

---

**Implementation Date:** 2026-01-17  
**Implemented By:** Antigravity AI  
**Status:** Ready for testing
