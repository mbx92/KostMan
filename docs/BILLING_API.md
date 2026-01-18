# 📚 API Documentation - Consolidated Billing System

## Overview

This document describes the API endpoints for the new consolidated billing system. The system generates a single monthly bill that includes rent charges, utility charges, and other additional charges.

---

## Authentication

All endpoints require authentication. Include the session token in your requests.

---

## Endpoints

### 1. Generate Bill

**POST** `/api/bills/generate`

Generate a new consolidated bill for a tenant covering a specific period.

#### Request Body

```json
{
  "roomId": "uuid",
  "tenantId": "uuid",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "notes": "Optional notes",
  "additionalCharges": [
    {
      "itemName": "Parking",
      "itemQty": 1,
      "itemUnitPrice": 50000,
      "itemDiscount": 0,
      "notes": "Monthly parking fee"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Bill generated successfully",
  "data": {
    "id": "uuid",
    "billingCode": "BILL-2026-01-001",
    "roomId": "uuid",
    "tenantId": "uuid",
    "billStatus": "draft",
    "periodStart": "2026-01-01",
    "periodEnd": "2026-01-31",
    "monthsCovered": 1.00,
    "totalChargedAmount": 1200000,
    "details": [
      {
        "itemType": "rent",
        "itemName": "Sewa Kamar",
        "itemQty": 1,
        "itemUnitPrice": 1000000,
        "itemTotalAmount": 1000000
      },
      {
        "itemType": "utility",
        "itemName": "Listrik - Januari 2026 (100 kWh)",
        "itemQty": 100,
        "itemUnitPrice": 1500,
        "itemTotalAmount": 150000
      }
    ]
  }
}
```

---

### 2. List Bills

**GET** `/api/bills`

Get a list of bills with optional filtering.

#### Query Parameters

- `roomId` (optional): Filter by room ID
- `tenantId` (optional): Filter by tenant ID
- `billStatus` (optional): Filter by status (draft, unpaid, paid)
- `periodStart` (optional): Filter by period start date (YYYY-MM-DD)
- `periodEnd` (optional): Filter by period end date (YYYY-MM-DD)

#### Example

```
GET /api/bills?billStatus=unpaid&roomId=uuid
```

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "billingCode": "BILL-2026-01-001",
      "billStatus": "unpaid",
      "periodStart": "2026-01-01",
      "periodEnd": "2026-01-31",
      "monthsCovered": 1.00,
      "totalChargedAmount": 1200000,
      "room": {
        "id": "uuid",
        "name": "Room 101",
        "price": "1000000"
      },
      "tenant": {
        "id": "uuid",
        "name": "John Doe",
        "contact": "08123456789"
      },
      "details": [...]
    }
  ]
}
```

---

### 3. Get Bill Detail

**GET** `/api/bills/:id`

Get detailed information about a specific bill.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "billingCode": "BILL-2026-01-001",
    "billStatus": "unpaid",
    "periodStart": "2026-01-01",
    "periodEnd": "2026-01-31",
    "monthsCovered": 1.00,
    "totalChargedAmount": 1200000,
    "totalPaid": 500000,
    "balance": 700000,
    "room": {...},
    "tenant": {...},
    "details": [...],
    "payments": [
      {
        "id": "uuid",
        "paymentMethod": "cash",
        "paymentAmount": 500000,
        "paymentDate": "2026-01-15",
        "processedBy": "uuid"
      }
    ]
  }
}
```

---

### 4. Update Bill

**PUT** `/api/bills/:id`

Update bill status or notes.

#### Request Body

```json
{
  "billStatus": "unpaid",
  "notes": "Updated notes"
}
```

#### Response

```json
{
  "success": true,
  "message": "Bill updated successfully",
  "data": {...}
}
```

---

### 5. Delete Bill

**DELETE** `/api/bills/:id`

Delete a draft bill. Only draft bills can be deleted.

#### Response

```json
{
  "success": true,
  "message": "Bill deleted successfully"
}
```

---

### 6. Record Payment

**POST** `/api/bills/:id/payment`

Record a payment for a bill.

#### Request Body

```json
{
  "paymentMethod": "cash",
  "paymentAmount": 500000,
  "paymentDate": "2026-01-15",
  "paymentProof": "path/to/proof.jpg",
  "notes": "Partial payment"
}
```

#### Response

```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "id": "uuid",
      "paymentMethod": "cash",
      "paymentAmount": 500000,
      "paymentDate": "2026-01-15"
    },
    "bill": {
      "billStatus": "unpaid"
    }
  }
}
```

---

## Business Logic

### Months Covered Calculation

The system calculates `monthsCovered` using the following algorithm:

1. Calculate total days in the period (inclusive)
2. Identify all months within the period
3. Calculate average days per month
4. Divide total days by average days per month

**Example:**
- Period: 2026-01-01 to 2026-03-31
- Total days: 90
- Months: Jan (31), Feb (28), Mar (31)
- Average: 30 days/month
- Result: 90 / 30 = **3.00 months**

### Billing Code Format

Format: `BILL-YYYY-MM-XXX`

- `BILL`: Fixed prefix
- `YYYY`: Year from periodStart
- `MM`: Month from periodStart
- `XXX`: Auto-increment sequence (001, 002, etc.)

### Automatic Status Updates

- Bill starts as `draft`
- When first payment is recorded: `draft` → `unpaid`
- When fully paid: `unpaid` → `paid`

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Authentication required |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error |

---

## Migration Notes

This new billing system replaces the old separate `rent_bills` and `utility_bills` tables. The old tables are kept for migration purposes but marked as deprecated.

### Key Differences

| Old System | New System |
|------------|------------|
| Separate rent and utility bills | Single consolidated bill |
| Period format: YYYY-MM | Period format: YYYY-MM-DD |
| Multiple payment links | Single payment link |
| Limited reporting | Comprehensive reporting |

---

## Examples

### Generate Multi-Month Bill

```bash
curl -X POST /api/bills/generate \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "uuid",
    "tenantId": "uuid",
    "periodStart": "2026-01-01",
    "periodEnd": "2026-03-31",
    "additionalCharges": [
      {
        "itemName": "Parkir (3 bulan)",
        "itemQty": 3,
        "itemUnitPrice": 50000
      }
    ]
  }'
```

### Get Unpaid Bills

```bash
curl -X GET '/api/bills?billStatus=unpaid'
```

### Record Full Payment

```bash
curl -X POST /api/bills/{id}/payment \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "online",
    "paymentAmount": 1200000,
    "paymentDate": "2026-01-15"
  }'
```

---

**Version**: 1.0  
**Last Updated**: 2026-01-18  
**Status**: ✅ Implemented
