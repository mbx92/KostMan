# Bill API Testing Guide

## Prerequisites

1. Ensure database is accessible and schema is migrated:
   ```bash
   npm run db:push
   ```

2. Have a valid authentication token (login as admin or owner)

3. Have at least one property, room, and tenant created

## Test Scenarios

### 1. Generate a Single-Month Bill

**Endpoint:** `POST /api/bills/generate`

**Request:**
```json
{
  "roomId": "your-room-uuid",
  "period": "2026-01",
  "monthsCovered": 1,
  "meterStart": 1000,
  "meterEnd": 1150,
  "costPerKwh": 1500,
  "waterFee": 50000,
  "trashFee": 25000,
  "additionalCost": 0
}
```

**Expected Response:**
```json
{
  "id": "generated-uuid",
  "roomId": "your-room-uuid",
  "tenantId": "tenant-uuid-or-null",
  "period": "2026-01",
  "periodEnd": null,
  "monthsCovered": 1,
  "meterStart": 1000,
  "meterEnd": 1150,
  "costPerKwh": "1500.00",
  "roomPrice": "1500000.00",
  "usageCost": "225000.00",
  "waterFee": "50000.00",
  "trashFee": "25000.00",
  "additionalCost": "0.00",
  "totalAmount": "1800000.00",
  "isPaid": false,
  "paidAt": null,
  "generatedAt": "2026-01-17T06:00:00.000Z"
}
```

**Cost Breakdown:**
- Room Price: 1,500,000 × 1 month = 1,500,000
- Usage Cost: (1150 - 1000) × 1,500 = 225,000
- Water Fee: 50,000 × 1 month = 50,000
- Trash Fee: 25,000 × 1 month = 25,000
- **Total: 1,800,000**

---

### 2. Generate a Multi-Month Bill

**Request:**
```json
{
  "roomId": "your-room-uuid",
  "period": "2026-02",
  "monthsCovered": 3,
  "meterStart": 1150,
  "meterEnd": 1500,
  "costPerKwh": 1500,
  "waterFee": 50000,
  "trashFee": 25000,
  "additionalCost": 10000
}
```

**Expected Response:**
```json
{
  "id": "generated-uuid",
  "period": "2026-02",
  "periodEnd": "2026-04",
  "monthsCovered": 3,
  "roomPrice": "4500000.00",
  "usageCost": "525000.00",
  "waterFee": "150000.00",
  "trashFee": "75000.00",
  "additionalCost": "10000.00",
  "totalAmount": "5260000.00",
  ...
}
```

**Cost Breakdown:**
- Room Price: 1,500,000 × 3 months = 4,500,000
- Usage Cost: (1500 - 1150) × 1,500 = 525,000
- Water Fee: 50,000 × 3 months = 150,000
- Trash Fee: 25,000 × 3 months = 75,000
- Additional: 10,000
- **Total: 5,260,000**

---

### 3. Test Duplicate Payment Prevention

**Step 1:** Mark the first bill as paid
```bash
PATCH /api/bills/{bill-id}/pay
```

**Expected Response:**
```json
{
  "id": "bill-uuid",
  "isPaid": true,
  "paidAt": "2026-01-17T06:05:00.000Z",
  ...
}
```

**Step 2:** Try to generate another bill for the same tenant and period
```bash
POST /api/bills/generate
{
  "roomId": "same-room-uuid",
  "period": "2026-01",
  ...
}
```

**Expected Response:** `409 Conflict`
```json
{
  "statusCode": 409,
  "statusMessage": "Tenant has already paid for this period"
}
```

---

### 4. Filter Bills by Property

**Request:**
```bash
GET /api/bills?propertyId=your-property-uuid
```

**Expected Response:**
```json
[
  {
    "id": "bill-1",
    "roomId": "room-in-property-1",
    ...
  },
  {
    "id": "bill-2",
    "roomId": "room-in-property-2",
    ...
  }
]
```

---

### 5. Filter Bills by Payment Status

**Request:**
```bash
GET /api/bills?isPaid=false
```

**Expected Response:** Array of unpaid bills only

---

### 6. Filter Bills by Period

**Request:**
```bash
GET /api/bills?billPeriod=2026-01
```

**Expected Response:** Array of bills for January 2026 only

---

### 7. Combined Filters

**Request:**
```bash
GET /api/bills?propertyId=your-property-uuid&isPaid=false&billPeriod=2026-01
```

**Expected Response:** Unpaid bills for January 2026 in the specified property

---

### 8. Delete an Unpaid Bill

**Request:**
```bash
DELETE /api/bills/{bill-id}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Bill deleted successfully"
}
```

---

### 9. Try to Delete a Paid Bill (Should Fail)

**Request:**
```bash
DELETE /api/bills/{paid-bill-id}
```

**Expected Response:** `400 Bad Request`
```json
{
  "statusCode": 400,
  "statusMessage": "Cannot delete a paid bill. Please contact admin if you need to reverse this."
}
```

---

### 10. Try to Mark Already Paid Bill (Should Fail)

**Request:**
```bash
PATCH /api/bills/{already-paid-bill-id}/pay
```

**Expected Response:** `400 Bad Request`
```json
{
  "statusCode": 400,
  "statusMessage": "Bill is already marked as paid"
}
```

---

## Error Cases to Test

### Invalid Room ID
```json
{
  "roomId": "non-existent-uuid",
  ...
}
```
**Expected:** `404 Not Found - Room not found`

### Invalid Period Format
```json
{
  "period": "2026/01",
  ...
}
```
**Expected:** `400 Bad Request - Period must be in YYYY-MM format`

### Meter End < Meter Start
```json
{
  "meterStart": 1500,
  "meterEnd": 1000,
  ...
}
```
**Expected:** `400 Bad Request - Meter end must be greater than or equal to meter start`

### Unauthorized Access (Non-owner trying to generate bill)
**Expected:** `403 Forbidden - You do not own this property`

---

## Using cURL

### Generate Bill
```bash
curl -X POST http://localhost:3022/api/bills/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "roomId": "your-room-uuid",
    "period": "2026-01",
    "monthsCovered": 1,
    "meterStart": 1000,
    "meterEnd": 1150,
    "costPerKwh": 1500,
    "waterFee": 50000,
    "trashFee": 25000,
    "additionalCost": 0
  }'
```

### Get Bills with Filters
```bash
curl -X GET "http://localhost:3022/api/bills?propertyId=your-property-uuid&isPaid=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mark as Paid
```bash
curl -X PATCH http://localhost:3022/api/bills/{bill-id}/pay \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Delete Bill
```bash
curl -X DELETE http://localhost:3022/api/bills/{bill-id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Notes

- All monetary values are returned as strings with 2 decimal places
- Dates are in ISO 8601 format
- The `generatedAt` field is automatically set when creating a bill
- The `paidAt` field is automatically set when marking as paid
- Trash fee is only applied if the room has `useTrashService: true`
- Multi-month bills automatically calculate `periodEnd` if not provided
