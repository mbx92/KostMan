# Quick Test Guide

## Run Bill Integration Tests

### Step 1: Ensure Database is Ready
```bash
npm run db:push
```

### Step 2: Start Dev Server (in separate terminal)
```bash
npm run dev
```

### Step 3: Run Tests
```bash
# Run only bill tests (fastest - ~5-8 seconds)
npm run test:bills

# Or run all integration tests
npm run test:integration
```

## What Gets Tested

✅ **14 Tests covering:**
- Bill generation (single & multi-month)
- Duplicate payment prevention
- Filtering (by property, status, period)
- Payment operations
- Deletion protection
- Validation rules

## Expected Output

```
✓ tests/integration/bills.test.ts (14 tests passed)
  Duration: ~5-8 seconds
```

## Troubleshooting

**Database connection error?**
- Check if PostgreSQL is running
- Verify `.env` has correct `DATABASE_URL`

**Server not running?**
- Start dev server: `npm run dev`
- Wait for "Nuxt is ready" message

**Tests failing?**
- Ensure schema is up to date: `npm run db:push`
- Check dev server is on port 3000

## Test Optimization

Tests are optimized for speed:
- ⚡ Single setup/teardown cycle
- ⚡ Reused test data
- ⚡ Sequential execution
- ⚡ Minimal database operations

**Result: ~5-8 seconds execution time**
