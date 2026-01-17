# Billing Tests - Quick Reference

## 🚀 Quick Start

```bash
# Run comprehensive billing tests
npm run test tests/integration/bills-comprehensive.test.ts

# Run original billing tests
npm run test tests/integration/bills.test.ts

# Run both
npm run test tests/integration/bills
```

---

## 📊 Test Suites Comparison

| Feature | Original Tests | Comprehensive Tests |
|---------|---------------|---------------------|
| **File** | `bills.test.ts` | `bills-comprehensive.test.ts` |
| **Test Count** | 14 tests | 44+ tests |
| **Proration** | ❌ Not tested | ✅ Fully tested |
| **Edge Cases** | Basic | Extensive |
| **Properties** | 1 property | 2 properties |
| **Rooms** | 1 room | 4 rooms (various configs) |
| **Tenants** | 1 tenant | 2 tenants |
| **Users** | 2 users | 3 users (admin, owner, staff) |

---

## 🧪 Test Categories

### Original Tests (14)
1. ✅ Generate single-month bill
2. ✅ Duplicate payment prevention
3. ✅ Generate multi-month bill
4. ✅ Get all bills
5. ✅ Filter by propertyId
6. ✅ Filter by isPaid
7. ✅ Filter by period
8. ✅ Combined filters
9. ✅ Mark bill as paid (staff)
10. ✅ Cannot mark already paid
11. ✅ Cannot delete paid bill
12. ✅ Invalid period format
13. ✅ Meter validation
14. ✅ Non-existent room

### Comprehensive Tests (44+)
**All original tests PLUS:**

#### Bill Generation (10 tests)
- ✅ Single-month with calculations
- ✅ Multi-month with auto periodEnd
- ✅ Explicit periodEnd
- ✅ Additional costs
- ✅ Room without trash service
- ✅ **Proration for mid-month move-in** ⭐
- ✅ **No proration for subsequent months** ⭐
- ✅ Staff can generate
- ✅ Admin can generate

#### Duplicate Prevention (2 tests)
- ✅ Prevent duplicate paid bills
- ✅ Allow duplicate unpaid bills

#### Validation (6 tests)
- ✅ Invalid period format
- ✅ meterEnd < meterStart
- ✅ Negative costs
- ✅ Invalid monthsCovered
- ✅ Non-existent room
- ✅ Invalid periodEnd

#### GET Bills (8 tests)
- ✅ Retrieve all bills
- ✅ Filter by propertyId
- ✅ Filter by isPaid (true/false)
- ✅ Filter by billPeriod
- ✅ Combined filters
- ✅ Staff can view
- ✅ Admin can view

#### Mark as Paid (4 tests)
- ✅ Owner can mark
- ✅ Reject already paid
- ✅ Staff can mark
- ✅ Reject non-existent

#### Delete Bill (4 tests)
- ✅ Owner can delete unpaid
- ✅ Reject deleting paid
- ✅ Staff can delete unpaid
- ✅ Reject non-existent

#### Authorization (4 tests)
- ✅ Reject unauthenticated generate
- ✅ Reject unauthenticated list
- ✅ Reject unauthenticated pay
- ✅ Reject unauthenticated delete

#### Edge Cases (6 tests)
- ✅ Zero usage
- ✅ Very large meter readings
- ✅ 12-month billing
- ✅ Zero additional cost
- ✅ **February proration (28 days)** ⭐

---

## ⭐ New Features Tested

### 1. Proration Calculation
```typescript
// Room with moveInDate: 2026-01-15
// Bill period: 2026-01
// Expected: Prorated charges (17/31 days)

✅ Room price prorated
✅ Water fee prorated
✅ Trash fee prorated
❌ Usage cost NOT prorated
```

### 2. Multiple Properties
```typescript
✅ Property 1 (costPerKwh: 1500)
✅ Property 2 (costPerKwh: 1600)
✅ Filter bills by property
```

### 3. Room Configurations
```typescript
✅ Standard room (with trash)
✅ Room without trash service
✅ Room with mid-month move-in
✅ Rooms across different properties
```

### 4. Extended Validation
```typescript
✅ Negative costs rejected
✅ Invalid monthsCovered rejected
✅ PeriodEnd before period rejected
```

---

## 📈 Coverage Comparison

| Endpoint | Original | Comprehensive |
|----------|----------|---------------|
| `POST /api/bills/generate` | ✅ Basic | ✅ Extensive |
| `GET /api/bills` | ✅ Basic | ✅ All filters |
| `PATCH /api/bills/:id/pay` | ✅ Basic | ✅ All roles |
| `DELETE /api/bills/:id` | ✅ Basic | ✅ All scenarios |
| **Proration** | ❌ | ✅ Complete |
| **Edge Cases** | ⚠️ Limited | ✅ Extensive |
| **Authorization** | ⚠️ Partial | ✅ Complete |

---

## 🎯 When to Use Which

### Use Original Tests (`bills.test.ts`)
- ✅ Quick smoke testing
- ✅ Basic functionality verification
- ✅ Faster execution (~15s)

### Use Comprehensive Tests (`bills-comprehensive.test.ts`)
- ✅ Full regression testing
- ✅ Before production deployment
- ✅ Testing proration feature
- ✅ Testing edge cases
- ✅ Complete coverage (~45s)

### Use Both
- ✅ CI/CD pipeline
- ✅ Pre-merge validation
- ✅ Release testing

---

## 🔧 Test Execution

### Run Specific Test Suite
```bash
# Original tests only
npm run test tests/integration/bills.test.ts

# Comprehensive tests only
npm run test tests/integration/bills-comprehensive.test.ts

# Both test files
npm run test tests/integration/bills
```

### Run Specific Test Category
```bash
# Run only proration tests
npm run test tests/integration/bills-comprehensive.test.ts -t "Proration"

# Run only validation tests
npm run test tests/integration/bills-comprehensive.test.ts -t "Validation"

# Run only edge cases
npm run test tests/integration/bills-comprehensive.test.ts -t "Edge Cases"
```

### Run with Options
```bash
# With coverage
npm run test -- --coverage tests/integration/bills-comprehensive.test.ts

# In watch mode
npm run test -- --watch tests/integration/bills-comprehensive.test.ts

# Verbose output
npm run test -- --reporter=verbose tests/integration/bills-comprehensive.test.ts
```

---

## 📊 Expected Results

### Original Tests
```
Test Files  1 passed (1)
     Tests  14 passed (14)
  Duration  ~15s
```

### Comprehensive Tests
```
Test Files  1 passed (1)
     Tests  44 passed (44)
  Duration  ~45s
```

### Both Combined
```
Test Files  2 passed (2)
     Tests  58 passed (58)
  Duration  ~60s
```

---

## 🎨 Test Data

### Users
- **Admin** - Full access
- **Owner** - Property owner
- **Staff** - Staff member

### Properties
- **Property 1** - Main test property
- **Property 2** - Secondary property

### Rooms
- **Room 101** - Standard (Property 1)
- **Room 201** - Different property (Property 2)
- **Room 102** - With proration (Property 1)
- **Room 103** - No trash service (Property 1)

### Tenants
- **Tenant 1** - Primary
- **Tenant 2** - Secondary

---

## ✅ Checklist

Before deploying billing features:

- [ ] Run original tests - All pass
- [ ] Run comprehensive tests - All pass
- [ ] Test proration manually
- [ ] Test multi-month billing
- [ ] Test all filters
- [ ] Test authorization
- [ ] Review edge cases
- [ ] Check database cleanup

---

## 📚 Documentation

- **Full Guide:** `docs/BILLING_COMPREHENSIVE_TESTS.md`
- **Settings & Proration:** `docs/SETTINGS_AND_PRORATION.md`
- **Implementation Status:** `docs/IMPLEMENTATION_STATUS.md`

---

**Created:** 2026-01-17  
**Status:** ✅ Ready to use
