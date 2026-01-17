# Bill Testing Seeder - Summary

## ✅ What Was Created

### 1. **Bill Testing Seeder** (`server/database/seed-bills.ts`)
A comprehensive seeder that creates test data for manual billing API testing:
- Uses existing users from `seed.ts` (owner@example.com)
- Creates 2 properties with settings
- Creates 3 active tenants
- Creates 5 rooms (3 occupied, 1 available, 1 maintenance)
- Creates 5 meter readings for testing
- Provides detailed Postman testing instructions in console output

### 2. **Postman Collection** (`postman/KostMan-Bill-Testing.postman_collection.json`)
Ready-to-use Postman collection with:
- Authentication endpoints
- Property, Room, Tenant, and Meter Reading endpoints
- Bill generation (single & multi-month)
- Bill listing with filters
- Bill payment and deletion
- Automatic variable extraction (token, roomId, billId)

### 3. **Documentation**
- `postman/README.md` - Complete Postman testing guide
- `server/database/README-BILL-SEEDER.md` - Seeder documentation

### 4. **NPM Script**
Added `db:seed-bills` to package.json for easy execution

## 🚀 Quick Start

### 1. Seed the Database
```bash
# First time setup - create users
npm run db:seed

# Create bill testing data
npm run db:seed-bills
```

### 2. Import to Postman
1. Open Postman
2. Import `postman/KostMan-Bill-Testing.postman_collection.json`
3. Start testing!

### 3. Test in Postman
1. Run "Login as Owner" (token auto-saved)
2. Run "List Rooms" (roomId auto-saved)
3. Run "Generate Bill - Single Month"
4. Run "List All Bills"
5. Run "Mark Bill as Paid"

## 📊 Test Data Created

### Properties
- **Kost Mawar** - Jl. Mawar No. 123, Jakarta Selatan
  - Cost/kWh: Rp 1,500
  - Water: Rp 50,000
  - Trash: Rp 25,000

- **Kost Melati** - Jl. Melati No. 456, Jakarta Barat
  - Cost/kWh: Rp 1,600
  - Water: Rp 55,000
  - Trash: Rp 30,000

### Rooms
- **A1** - Occupied by Budi Santoso (Rp 1,500,000/month, with trash)
  - Meter: Dec 2025 (1000→1150), Jan 2026 (1150→1320)
  
- **A2** - Occupied by Siti Nurhaliza (Rp 1,500,000/month, with trash)
  - Meter: Dec 2025 (2000→2200), Jan 2026 (2200→2380)
  
- **A3** - Occupied by Ahmad Wijaya (Rp 1,800,000/month, **no trash**)
  - Meter: Jan 2026 (3000→3150)
  
- **B1** - Available (Rp 1,600,000/month)
- **B2** - Maintenance (Rp 1,600,000/month)

## 🧪 Test Scenarios Covered

✅ Single-month billing
✅ Multi-month billing (advance payment)
✅ Rooms with trash service
✅ Rooms without trash service
✅ Bills with additional costs
✅ Paid vs unpaid bills
✅ Bill filtering by status and room
✅ Duplicate bill prevention

## 📝 Example Bill Calculations

### Single Month (Room A1, Jan 2026)
```
Room Price:    Rp 1,500,000
Usage Cost:    Rp   255,000  (170 kWh × Rp 1,500)
Water Fee:     Rp    50,000
Trash Fee:     Rp    25,000
Additional:    Rp         0
────────────────────────────
Total:         Rp 1,830,000
```

### Multi-Month (3 months)
```
Room Price:    Rp 4,500,000  (Rp 1,500,000 × 3)
Usage Cost:    Rp   450,000  (300 kWh × Rp 1,500)
Water Fee:     Rp   150,000  (Rp 50,000 × 3)
Trash Fee:     Rp    75,000  (Rp 25,000 × 3)
Additional:    Rp         0
────────────────────────────
Total:         Rp 5,175,000
```

## 🔑 Test Credentials

**Email:** owner@example.com  
**Password:** password123

## 📚 Additional Resources

- **Postman Guide:** `postman/README.md`
- **Seeder Docs:** `server/database/README-BILL-SEEDER.md`
- **Quick Test Script:** `npm run test:bill-quick`
- **CLI Tool:** `npm run test:bill-cli`

## 🔄 Reset Data

To start fresh:
```bash
npm run db:push           # Reset database schema
npm run db:seed           # Seed base users
npm run db:seed-bills     # Seed bill test data
```

## ✨ Features

- **No user duplication** - Uses existing users from seed.ts
- **Realistic data** - Indonesian addresses, phone numbers, ID cards
- **Ready for Postman** - Complete collection with auto-variables
- **Comprehensive scenarios** - Covers all billing edge cases
- **Easy to use** - One command to seed, one click to import
- **Well documented** - Detailed guides and examples

---

**Created:** 2026-01-17  
**Purpose:** Manual billing API testing in Postman  
**Status:** ✅ Ready to use
