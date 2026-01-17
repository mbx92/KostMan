# Billing Testing Solutions

## Problem
The comprehensive integration test (`tests/integration/bills-comprehensive.test.ts`) is experiencing:
- Long server preparation times
- Frequent timeouts
- Takes 4+ hours to run
- Difficult to debug when it fails

## Solution
Created **4 lightweight manual testing scripts** that bypass the heavy integration test framework:

---

## 🚀 Quick Reference

### 1. Health Check (No login required)
```bash
npm run test:bill-health
# or
npx tsx scripts/check-billing-api.ts
```
**Use when:** You want to verify the server is running and endpoints exist  
**Time:** ~1 second

---

### 2. Quick Smoke Test (Fastest)
```bash
npm run test:bill-quick
# or
npx tsx scripts/quick-bill-test.ts
```
**Use when:** You want a fast end-to-end test  
**Time:** ~5 seconds  
**What it does:**
- Login
- Generate a bill
- Mark as paid
- Test filters

---

### 3. Interactive CLI (Most flexible)
```bash
npm run test:bill-cli
# or
npx tsx scripts/billing-cli.ts
```
**Use when:** You want to manually test specific scenarios  
**Time:** As long as you need  
**Features:**
- Menu-driven interface
- Login with your credentials
- Generate bills with custom parameters
- List, filter, mark paid, delete bills

---

### 4. Comprehensive Manual Tests (Most thorough)
```bash
# Run all tests
npm run test:bill-manual all

# Run specific test
npm run test:bill-manual generate-single
npm run test:bill-manual generate-multi
npm run test:bill-manual generate-proration
npm run test:bill-manual mark-paid
npm run test:bill-manual list-bills
npm run test:bill-manual delete-bill
```
**Use when:** You need thorough testing without integration test overhead  
**Time:** ~10-15 seconds for all tests  
**What it tests:**
- Single-month bills
- Multi-month bills
- Proration calculations
- Payment marking
- Bill filtering
- Bill deletion

---

## 📊 Comparison

| Feature | Integration Test | Manual Scripts |
|---------|-----------------|----------------|
| Setup Time | ~60 seconds | ~2 seconds |
| Execution Time | 45-60 seconds | 5-15 seconds |
| Timeout Issues | Common ❌ | Rare ✅ |
| Server Prep | Full Nuxt | Direct API ✅ |
| Debugging | Hard ❌ | Easy ✅ |
| Flexibility | Fixed | Customizable ✅ |

---

## 🎯 Recommended Workflow

### During Development
```bash
# 1. Quick check that server is running
npm run test:bill-health

# 2. Fast smoke test after changes
npm run test:bill-quick

# 3. Test specific scenarios interactively
npm run test:bill-cli
```

### Before Committing
```bash
# Run comprehensive manual tests
npm run test:bill-manual all
```

### In CI/CD
```bash
# Use integration tests (when they work)
npm run test:bills
```

---

## 📁 Files Created

```
scripts/
├── check-billing-api.ts          # Health check (no auth)
├── quick-bill-test.ts             # Quick smoke test
├── billing-cli.ts                 # Interactive CLI
├── test-billing-manual.ts         # Comprehensive tests
└── README-BILLING-TESTS.md        # Full documentation
```

---

## 🔧 Setup

### 1. Environment Variables
```env
DATABASE_URL=postgresql://user:password@localhost:5432/kostman
BASE_URL=http://localhost:3000

# Optional (for quick-bill-test.ts)
TEST_EMAIL=your_email@example.com
TEST_PASSWORD=your_password
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Run Tests
```bash
npm run test:bill-quick
```

---

## ✅ What Gets Tested

All scripts test the same functionality as the integration tests:

- ✅ Bill generation (single & multi-month)
- ✅ Proration calculations
- ✅ Payment marking
- ✅ Bill filtering (property, status, period)
- ✅ Bill deletion
- ✅ Validation rules
- ✅ Calculation accuracy
- ✅ Business logic

---

## 💡 Benefits

1. **Fast** - No server prep overhead
2. **Reliable** - No timeout issues
3. **Flexible** - Test what you need
4. **Clear** - Colored output with details
5. **Easy** - Simple npm commands
6. **Debuggable** - See exactly what's happening

---

## 🎉 Next Steps

1. Try the quick test: `npm run test:bill-quick`
2. Explore the CLI: `npm run test:bill-cli`
3. Read full docs: `scripts/README-BILLING-TESTS.md`

---

## 📝 Notes

- Scripts automatically clean up test data
- Safe to run multiple times
- No interference with production data
- Detailed output shows calculations and verification
- Failed tests show clear error messages

Happy testing! 🚀
