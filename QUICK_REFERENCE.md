# Quick Reference - Bill Testing

## 🚀 Setup Commands

```bash
# 1. Seed users (if not done already)
npm run db:seed

# 2. Seed bill test data
npm run db:seed-bills

# 3. Start server
npm run dev
```

## 🔑 Login Credentials

```
Email:    owner@example.com
Password: password123
```

## 📦 Postman Collection

**File:** `postman/KostMan-Bill-Testing.postman_collection.json`

**Import Steps:**
1. Open Postman
2. Click "Import"
3. Select the collection file
4. Done!

## 🧪 Testing Flow

1. **Login** → Token auto-saved ✅
2. **List Rooms** → Room ID auto-saved ✅
3. **Generate Bill** → Bill ID auto-saved ✅
4. **List Bills** → View all bills
5. **Mark as Paid** → Update bill status
6. **Delete Bill** → Clean up

## 📋 Sample Request Bodies

### Generate Single-Month Bill
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
**Expected Total:** Rp 1,830,000

### Generate Multi-Month Bill (3 months)
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
**Expected Total:** Rp 5,175,000

### Generate Bill Without Trash Service
```json
{
  "roomId": "{{roomId}}",
  "period": "2026-01",
  "monthsCovered": 1,
  "meterStart": 3000,
  "meterEnd": 3150,
  "costPerKwh": 1500,
  "waterFee": 50000,
  "trashFee": 0,
  "additionalCost": 50000
}
```
**Expected Total:** Rp 2,125,000

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/rooms` | List rooms |
| `GET` | `/api/meter-readings?roomId=xxx` | Get meter readings |
| `POST` | `/api/bills/generate` | Generate bill |
| `GET` | `/api/bills` | List all bills |
| `GET` | `/api/bills?isPaid=false` | Unpaid bills |
| `GET` | `/api/bills?isPaid=true` | Paid bills |
| `GET` | `/api/bills?roomId=xxx` | Bills by room |
| `PATCH` | `/api/bills/:id/pay` | Mark as paid |
| `DELETE` | `/api/bills/:id` | Delete bill |

## 💡 Quick Tips

- **Auto Variables:** Token, roomId, and billId are automatically saved
- **Period Format:** Must be `YYYY-MM` (e.g., "2026-01")
- **Multi-Month:** Set `monthsCovered` to 2, 3, etc.
- **No Trash:** Set `trashFee: 0` for rooms without trash service
- **Additional Costs:** Use `additionalCost` for late fees, penalties, etc.

## 🧮 Bill Calculation Formula

```
Total = (roomPrice × monthsCovered) 
      + (meterEnd - meterStart) × costPerKwh
      + (waterFee × monthsCovered)
      + (trashFee × monthsCovered)
      + additionalCost
```

## 🏠 Test Rooms Available

After seeding, you'll have:
- **Room A1** - Occupied, with trash (Rp 1,500,000/month)
- **Room A2** - Occupied, with trash (Rp 1,500,000/month)
- **Room A3** - Occupied, **no trash** (Rp 1,800,000/month)
- **Room B1** - Available (Rp 1,600,000/month)
- **Room B2** - Maintenance (Rp 1,600,000/month)

## 📊 Meter Readings Available

- **Room A1:** Dec 2025 (1000→1150), Jan 2026 (1150→1320)
- **Room A2:** Dec 2025 (2000→2200), Jan 2026 (2200→2380)
- **Room A3:** Jan 2026 (3000→3150)

## 🔄 Reset Everything

```bash
npm run db:push && npm run db:seed && npm run db:seed-bills
```

## 📖 Full Documentation

- **Postman Guide:** `postman/README.md`
- **Setup Guide:** `BILL_TESTING_SETUP.md`
- **Seeder Docs:** `server/database/README-BILL-SEEDER.md`
