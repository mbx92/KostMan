# Bill Testing with Postman

This guide will help you test the billing functionality using Postman.

## Setup

### 1. Seed the Database

First, make sure you have the base users:
```bash
npm run db:seed
```

Then seed the bill testing data:
```bash
npm run db:seed-bills
```

### 2. Start the Server

```bash
npm run dev
```

The server will run at `http://localhost:3000`

### 3. Import Postman Collection

1. Open Postman
2. Click **Import** button
3. Select the file: `postman/KostMan-Bill-Testing.postman_collection.json`
4. The collection will be imported with all endpoints ready to use

## Testing Workflow

### Step 1: Login

Run the **"Login as Owner"** request in the Authentication folder.

**Credentials:**
- Email: `owner@example.com`
- Password: `password123`

✅ The token will be automatically saved to collection variables.

### Step 2: Get Rooms

Run **"List Rooms"** to see all available rooms.

✅ The first room ID will be automatically saved to `{{roomId}}` variable.

### Step 3: Check Meter Readings

Run **"Get Meter Readings by Room"** to see existing meter readings for the selected room.

This helps you know what meter values to use when generating bills.

### Step 4: Generate Bills

#### Single Month Bill

Run **"Generate Bill - Single Month"**

The request body is pre-filled with example data:
```json
{
  "roomId": "{{roomId}}",
  "period": "2026-01",
  "monthsCovered": 1,
  "meterStart": 1150,
  "meterEnd": 1320,
  "costPerKwh": 1500,
  "waterFee": 50000,
  "trashFee": 25000,
  "additionalCost": 0
}
```

**Expected Result:**
- Room Price: Rp 1,500,000
- Usage Cost: Rp 255,000 (170 kWh × Rp 1,500)
- Water Fee: Rp 50,000
- Trash Fee: Rp 25,000
- **Total: Rp 1,830,000**

✅ The bill ID will be automatically saved to `{{billId}}` variable.

#### Multi-Month Bill (3 months)

Run **"Generate Bill - Multi Month (3 months)"**

```json
{
  "roomId": "{{roomId}}",
  "period": "2026-02",
  "monthsCovered": 3,
  "meterStart": 1320,
  "meterEnd": 1620,
  "costPerKwh": 1500,
  "waterFee": 50000,
  "trashFee": 25000,
  "additionalCost": 0
}
```

**Expected Result:**
- Room Price: Rp 4,500,000 (Rp 1,500,000 × 3)
- Usage Cost: Rp 450,000 (300 kWh × Rp 1,500)
- Water Fee: Rp 150,000 (Rp 50,000 × 3)
- Trash Fee: Rp 75,000 (Rp 25,000 × 3)
- **Total: Rp 5,175,000**

### Step 5: List Bills

Run any of these to filter bills:
- **"List All Bills"** - Get all bills
- **"List Unpaid Bills"** - Filter by `isPaid=false`
- **"List Paid Bills"** - Filter by `isPaid=true`
- **"Get Bills by Room"** - Filter by specific room

### Step 6: Mark Bill as Paid

Run **"Mark Bill as Paid"** using the `{{billId}}` from Step 4.

The bill status will change to `isPaid: true` and `paidAt` timestamp will be set.

### Step 7: Delete Bill

Run **"Delete Bill"** to remove a bill (for cleanup or testing).

## Test Scenarios

### Scenario 1: Standard Monthly Billing
1. Login
2. List Rooms → Get Room A1 ID
3. Check Meter Readings for Room A1
4. Generate single-month bill
5. List unpaid bills → Verify bill appears
6. Mark bill as paid
7. List paid bills → Verify bill appears

### Scenario 2: Multi-Month Advance Payment
1. Login
2. Generate 3-month bill for Room A2
3. Verify total amount = (room price × 3) + (usage) + (water × 3) + (trash × 3)
4. Mark as paid
5. Verify payment date is recorded

### Scenario 3: Room Without Trash Service
1. Login
2. List Rooms → Find Room A3 (useTrashService: false)
3. Generate bill with `trashFee: 0`
4. Verify total excludes trash fee

### Scenario 4: Bill with Additional Costs
1. Login
2. Generate bill with `additionalCost: 50000` (e.g., late fee)
3. Verify total includes additional cost

### Scenario 5: Duplicate Prevention
1. Generate a bill for Room A1, period "2026-01"
2. Try to generate another bill for same room and period
3. Should receive error: "Bill already exists for this period"

## Room IDs from Seeder

After running `npm run db:seed-bills`, check the console output for actual room IDs.

Example output:
```
✓ Room A1 (94a9cad9-847f-...) - Occupied by Budi Santoso
✓ Room A2 (a2b3c4d5-...) - Occupied by Siti Nurhaliza
✓ Room A3 (e5f6g7h8-...) - Occupied by Ahmad Wijaya (No trash)
```

Copy these IDs and use them in your Postman requests.

## Automatic Variables

The Postman collection uses these variables:

| Variable | Description | Auto-set by |
|----------|-------------|-------------|
| `{{baseUrl}}` | API base URL | Manual (default: http://localhost:3000) |
| `{{token}}` | Auth token | Login request |
| `{{roomId}}` | Selected room ID | List Rooms request |
| `{{billId}}` | Generated bill ID | Generate Bill request |

## Tips

### 💡 Quick Testing
1. Run requests in order from top to bottom
2. Variables are automatically populated
3. No need to copy-paste IDs manually

### 💡 Reset Data
To start fresh:
```bash
npm run db:push  # Reset database
npm run db:seed  # Seed users
npm run db:seed-bills  # Seed bill test data
```

### 💡 View Responses
Check the Postman console to see:
- Saved variables
- Response data
- Calculation breakdowns

### 💡 Customize Requests
- Change `period` to test different months
- Adjust `monthsCovered` for different advance payment periods
- Modify meter readings to test different usage amounts
- Add `additionalCost` to test late fees or other charges

## Common Issues

### ❌ "Unauthorized" Error
**Solution:** Run the Login request first to get a fresh token.

### ❌ "Room not found"
**Solution:** Run "List Rooms" to get valid room IDs, or check if seeder ran successfully.

### ❌ "Bill already exists"
**Solution:** This is expected behavior. Either:
- Delete the existing bill first
- Use a different period
- Use a different room

### ❌ "Invalid period format"
**Solution:** Period must be in `YYYY-MM` format (e.g., "2026-01", "2026-12")

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login and get token |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/properties` | List properties |
| GET | `/api/rooms` | List rooms |
| GET | `/api/tenants` | List tenants |
| GET | `/api/meter-readings` | List meter readings |
| POST | `/api/bills/generate` | Generate new bill |
| GET | `/api/bills` | List bills (with filters) |
| PATCH | `/api/bills/:id/pay` | Mark bill as paid |
| DELETE | `/api/bills/:id` | Delete bill |

## Next Steps

After testing manually in Postman:
1. Run automated tests: `npm run test:bill-quick`
2. Run comprehensive tests: `npm run test:bills`
3. Use the CLI tool: `npm run test:bill-cli`

Happy Testing! 🚀
