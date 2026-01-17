# Bill Integration Tests

## Overview

Comprehensive integration tests for the Bill API endpoints. Tests are optimized for speed by:
- Reusing test data across multiple tests
- Running tests sequentially to build on previous state
- Minimizing database operations
- Using a single setup/teardown cycle

## Test Coverage

### Endpoints Tested

1. **POST `/api/bills/generate`** - Generate bills
2. **GET `/api/bills`** - List bills with filters
3. **PATCH `/api/bills/:id/pay`** - Mark bill as paid
4. **DELETE `/api/bills/:id`** - Delete bill

### Test Scenarios

#### ✅ Bill Generation (4 tests)
- Generate single-month bill
- Generate multi-month bill with auto-calculated periodEnd
- Validate cost calculations
- Prevent duplicate paid bills for same period

#### ✅ Filtering (5 tests)
- Get all bills
- Filter by propertyId
- Filter by isPaid status
- Filter by billPeriod
- Combined filters

#### ✅ Payment Operations (2 tests)
- Mark bill as paid (staff access)
- Prevent marking already paid bills

#### ✅ Deletion (1 test)
- Prevent deletion of paid bills

#### ✅ Validation (3 tests)
- Invalid period format
- Meter end < meter start
- Non-existent room

**Total: 14 tests**

## Prerequisites

### 1. Database Setup

Ensure your PostgreSQL database is running and accessible:

```bash
# Check .env file has correct DATABASE_URL
DATABASE_URL=postgres://user:password@host:port/database
```

### 2. Apply Schema Changes

```bash
npm run db:push
```

### 3. Start Development Server

The tests require a running Nuxt dev server:

```bash
npm run dev
```

Keep this running in a separate terminal.

## Running Tests

### Run All Integration Tests

```bash
npm run test:integration
```

### Run Only Bill Tests

```bash
npm test:bills
```

### Run in Watch Mode

```bash
npm test tests/integration/bills.test.ts
```

## Test Execution Time

**Optimized for Speed:**
- Expected execution time: **~5-8 seconds**
- Single setup/teardown cycle
- Sequential test execution
- Minimal database operations

### Performance Tips

1. **Use Local Database**: Tests run faster with a local PostgreSQL instance
2. **Keep Dev Server Running**: Avoid server startup time
3. **Run Specific Tests**: Use `test:bills` for faster feedback

## Test Data

The test suite creates the following test data:

- **2 Users**: Owner and Staff
- **1 Property**: "Bill Test Property"
- **1 Tenant**: "Test Tenant"
- **1 Room**: "Room 101" (occupied by tenant)
- **2+ Bills**: Generated during tests

All test data is automatically cleaned up after tests complete.

## Test Structure

```typescript
beforeAll()
  ├─ Create test users (owner, staff)
  ├─ Login users (get tokens)
  ├─ Create property
  ├─ Create tenant
  └─ Create room with tenant

Test 1: Generate single-month bill
Test 2: Duplicate payment prevention
Test 3: Generate multi-month bill
Test 4: Get all bills
Test 5: Filter by propertyId
Test 6: Filter by isPaid
Test 7: Filter by period
Test 8: Combined filters
Test 9: Mark bill as paid
Test 10: Cannot mark already paid bill
Test 11: Cannot delete paid bill
Test 12: Invalid period format validation
Test 13: Meter validation
Test 14: Non-existent room

afterAll()
  ├─ Delete bills
  ├─ Delete room
  ├─ Delete tenant
  ├─ Delete property
  ├─ Delete users
  └─ Close database connection
```

## Expected Test Output

```
✓ tests/integration/bills.test.ts (14)
  ✓ Bill Integration Tests (14)
    ✓ POST /api/bills/generate - Owner can generate single-month bill
    ✓ POST /api/bills/generate - Cannot generate duplicate paid bill for same period
    ✓ POST /api/bills/generate - Can generate multi-month bill with auto-calculated periodEnd
    ✓ GET /api/bills - Can retrieve all bills
    ✓ GET /api/bills?propertyId - Can filter bills by property
    ✓ GET /api/bills?isPaid - Can filter bills by payment status
    ✓ GET /api/bills?billPeriod - Can filter bills by period
    ✓ GET /api/bills - Can use combined filters
    ✓ PATCH /api/bills/:id/pay - Staff can mark bill as paid
    ✓ PATCH /api/bills/:id/pay - Cannot mark already paid bill
    ✓ DELETE /api/bills/:id - Cannot delete paid bill
    ✓ POST /api/bills/generate - Validation fails for invalid period format
    ✓ POST /api/bills/generate - Validation fails when meterEnd < meterStart
    ✓ POST /api/bills/generate - Fails for non-existent room

Test Files  1 passed (1)
     Tests  14 passed (14)
  Start at  06:08:30
  Duration  5.23s
```

## Troubleshooting

### Database Connection Errors

```
Error: Connection timeout
```

**Solution:**
- Check if PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

### Server Not Running

```
Error: fetch failed
```

**Solution:**
- Start dev server: `npm run dev`
- Wait for server to be ready
- Check port 3000 is available

### Test Timeout

```
Error: Test timed out
```

**Solution:**
- Increase timeout in vitest.config.ts
- Check database performance
- Ensure dev server is responsive

### Cleanup Errors

```
Cleanup failed
```

**Solution:**
- Tests will still pass
- Manual cleanup may be needed
- Check database constraints

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: kostman_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup database
        run: npm run db:push
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/kostman_test
          
      - name: Start dev server
        run: npm run dev &
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/kostman_test
          
      - name: Wait for server
        run: npx wait-on http://localhost:3000
        
      - name: Run tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/kostman_test
```

## Best Practices

1. **Keep Tests Fast**: Current suite runs in ~5-8 seconds
2. **Clean Up**: Always clean up test data in afterAll
3. **Sequential Tests**: Tests build on each other for speed
4. **Meaningful Assertions**: Each test validates specific behavior
5. **Error Cases**: Test both success and failure scenarios

## Adding New Tests

To add new bill-related tests:

1. Add test case in sequential order
2. Reuse existing test data when possible
3. Clean up any new data in afterAll
4. Keep test focused on single behavior
5. Use descriptive test names

Example:

```typescript
it('POST /api/bills/generate - Your new test case', async () => {
    // Arrange
    const billData = { /* ... */ };
    
    // Act
    const res = await $fetch('/api/bills/generate', {
        method: 'POST',
        body: billData,
        headers: { Cookie: `auth_token=${ownerToken}` }
    });
    
    // Assert
    expect(res).toHaveProperty('id');
});
```

## Related Documentation

- [Bill Implementation Summary](./BILL_IMPLEMENTATION_SUMMARY.md)
- [Bill API Testing Guide](./BILL_API_TESTING.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
