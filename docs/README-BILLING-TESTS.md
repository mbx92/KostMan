# Billing Manual Testing Scripts

This directory contains manual testing scripts for the billing functionality. These scripts are designed to be **fast, lightweight, and easy to use** - perfect for when the comprehensive integration tests are too slow or timing out.

## 🚀 Quick Start

### Option 1: Quick Smoke Test (Fastest - ~5 seconds)
```bash
npx tsx scripts/quick-bill-test.ts
```

This runs a quick smoke test using your existing data:
- ✅ Login
- ✅ Generate a test bill
- ✅ Mark it as paid
- ✅ Test filters

**Best for:** Quick verification that billing is working

---

### Option 2: Interactive CLI (Most Flexible)
```bash
npx tsx scripts/billing-cli.ts
```

An interactive menu-driven tool that lets you:
- Login with your credentials
- List available rooms
- Generate bills with custom parameters
- List bills with filters
- Mark bills as paid
- Delete bills

**Best for:** Manual testing with real data, exploring edge cases

---

### Option 3: Comprehensive Manual Tests (Most Thorough)
```bash
# Run all tests
npx tsx scripts/test-billing-manual.ts all

# Run specific test
npx tsx scripts/test-billing-manual.ts generate-single
npx tsx scripts/test-billing-manual.ts generate-multi
npx tsx scripts/test-billing-manual.ts generate-proration
npx tsx scripts/test-billing-manual.ts mark-paid
npx tsx scripts/test-billing-manual.ts list-bills
npx tsx scripts/test-billing-manual.ts delete-bill
```

This creates its own test data and runs comprehensive tests:
- ✅ Single-month bill generation
- ✅ Multi-month bill generation
- ✅ Proration calculations
- ✅ Payment marking
- ✅ Bill filtering
- ✅ Bill deletion

**Best for:** Thorough testing without the integration test overhead

---

## 📋 Environment Setup

### Required Environment Variables

Create a `.env` file with:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/kostman
BASE_URL=http://localhost:3000

# For quick-bill-test.ts (optional)
TEST_EMAIL=your_email@example.com
TEST_PASSWORD=your_password
```

### Test User Setup

For the manual tests to work, you need test users. You can either:

**Option A: Use existing users**
- Just use your existing owner/admin credentials

**Option B: Create test users**
```sql
-- Run this in your database
INSERT INTO users (name, email, password, role) VALUES
('Test Admin', 'test_admin@billing.test', '$2b$10$...', 'admin'),
('Test Owner', 'test_owner@billing.test', '$2b$10$...', 'owner');
```

---

## 🎯 Testing Scenarios

### Test 1: Basic Bill Generation
```bash
npx tsx scripts/test-billing-manual.ts generate-single
```

Tests:
- Single-month bill creation
- Calculation accuracy (room price + usage + water + trash)
- Tenant and room association
- Metadata correctness

### Test 2: Multi-Month Billing
```bash
npx tsx scripts/test-billing-manual.ts generate-multi
```

Tests:
- 3-month billing period
- Auto-calculated periodEnd
- Multiplied recurring charges
- Additional costs

### Test 3: Proration
```bash
npx tsx scripts/test-billing-manual.ts generate-proration
```

Tests:
- Mid-month move-in (Jan 15)
- Proration factor calculation (17/31 days)
- Prorated: room price, water fee, trash fee
- NOT prorated: usage cost

### Test 4: Payment Marking
```bash
npx tsx scripts/test-billing-manual.ts mark-paid
```

Tests:
- Marking bill as paid
- Setting paidAt timestamp
- Preventing duplicate payment marking

### Test 5: Filtering
```bash
npx tsx scripts/test-billing-manual.ts list-bills
```

Tests:
- Filter by property
- Filter by payment status
- Filter by period
- Combined filters

### Test 6: Deletion
```bash
npx tsx scripts/test-billing-manual.ts delete-bill
```

Tests:
- Deleting unpaid bills
- Preventing deletion of paid bills

---

## 🔍 Comparison with Integration Tests

| Feature | Integration Tests | Manual Scripts |
|---------|------------------|----------------|
| **Setup Time** | ~60 seconds | ~2 seconds |
| **Execution Time** | ~45-60 seconds | ~5-10 seconds |
| **Server Prep** | Full Nuxt setup | Direct API calls |
| **Timeout Issues** | Common | Rare |
| **Flexibility** | Fixed scenarios | Customizable |
| **Output** | Test framework | Colored, detailed |
| **Debugging** | Harder | Easier |

---

## 💡 Tips

### 1. Quick Iteration During Development
```bash
# Make code changes, then quickly test
npx tsx scripts/quick-bill-test.ts
```

### 2. Test Specific Scenarios
```bash
# Only test proration logic
npx tsx scripts/test-billing-manual.ts generate-proration
```

### 3. Interactive Exploration
```bash
# Use CLI to manually test edge cases
npx tsx scripts/billing-cli.ts
```

### 4. Verify Calculations
The scripts show expected vs actual values:
```
Verifying calculations:
  Room Price: 3000000 (expected: 3000000) ✓
  Usage Cost: 225000 (expected: 225000) ✓
  Total: 3300000 (expected: 3300000) ✓
```

---

## 🐛 Troubleshooting

### "No rooms found"
Create a room first or use the interactive CLI to see available rooms.

### "Login failed"
Check your credentials in `.env` or use the interactive CLI to login manually.

### "Connection refused"
Make sure your Nuxt dev server is running:
```bash
npm run dev
```

### "Database connection error"
Verify your `DATABASE_URL` in `.env` is correct.

---

## 📊 What Gets Tested

### ✅ Bill Generation
- [x] Single-month bills
- [x] Multi-month bills
- [x] Proration for mid-month move-ins
- [x] Additional costs
- [x] Trash service flag
- [x] Calculation accuracy

### ✅ Business Logic
- [x] Duplicate prevention for paid bills
- [x] Cannot delete paid bills
- [x] Cannot mark paid bill as paid again
- [x] Meter validation (end >= start)

### ✅ Filtering
- [x] By property
- [x] By payment status
- [x] By period
- [x] Combined filters

### ✅ Operations
- [x] Mark as paid
- [x] Delete unpaid bills
- [x] List bills

---

## 🎨 Output Examples

### Quick Test Output
```
╔═══════════════════════════════════════╗
║   Quick Billing Test                  ║
╚═══════════════════════════════════════╝

[1/6] Logging in...
✓ Logged in successfully

[2/6] Fetching rooms...
✓ Using room: Room 101 (abc-123)

[3/6] Generating test bill...
✓ Bill generated: xyz-789
  Room Price: Rp 3,000,000
  Usage Cost: Rp 225,000
  Water Fee: Rp 50,000
  Trash Fee: Rp 25,000
  Total: Rp 3,300,000

╔═══════════════════════════════════════╗
║   ✓ All tests passed!                 ║
╚═══════════════════════════════════════╝
```

### Manual Test Output
```
════════════════════════════════════════════════════════════
  Test: Generate Single-Month Bill
════════════════════════════════════════════════════════════

ℹ️  Generating bill with data:
{
  "roomId": "abc-123",
  "period": "2026-01",
  "monthsCovered": 1,
  ...
}

✅ Bill generated successfully!

Verifying calculations:
  Room Price: 3000000 (expected: 3000000)
  Usage Cost: 225000 (expected: 225000)
  Water Fee: 50000 (expected: 50000)
  Trash Fee: 25000 (expected: 25000)
  Total: 3300000 (expected: 3300000)

✅ Calculations are correct!
```

---

## 🚀 Next Steps

1. **Start with the quick test** to verify basic functionality
2. **Use the CLI** for manual exploration and edge cases
3. **Run comprehensive tests** when you need thorough validation
4. **Keep integration tests** for CI/CD pipelines (when they work!)

---

## 📝 Notes

- All scripts automatically clean up after themselves
- Test data is isolated and won't affect production
- Scripts use colored output for better readability
- Each test shows detailed verification steps
- Failed tests show clear error messages

---

## 🎉 Benefits

✅ **Fast** - No server prep overhead  
✅ **Reliable** - No timeout issues  
✅ **Flexible** - Test what you need  
✅ **Clear** - Detailed output with colors  
✅ **Easy** - Simple commands  
✅ **Practical** - Real-world testing  

Happy testing! 🚀
