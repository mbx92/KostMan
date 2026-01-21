# Partial Payment System - Quick Reference

## 🚀 Quick Start

### Migration
```bash
psql -U mbx -h 10.100.10.5 -d kostMan_dev -f server/database/migrations/add-payment-system.sql
```

### Test Scenario
1. Navigate to **Tagihan** (Billing)
2. Find an unpaid bill
3. Click **Catat Pembayaran**
4. Enter 50% of total amount
5. Select payment method, date
6. Click **Catat Pembayaran**
7. Status should change to **DIBAYAR SEBAGIAN** (yellow)
8. Click **History** button to see payment record
9. Record another payment for remaining 50%
10. Status should change to **LUNAS** (green)

## 📊 Status System

| Status | Color | Condition | Actions Available |
|--------|-------|-----------|-------------------|
| **BELUM DIBAYAR** | Red | paidAmount = 0 | Catat Pembayaran |
| **DIBAYAR SEBAGIAN** | Yellow | 0 < paidAmount < totalAmount | Catat Pembayaran, History |
| **LUNAS** | Green | paidAmount >= totalAmount | History only |

## 🎯 Component Props

### PaymentModal
```vue
<PaymentModal
  v-model="isOpen"
  :bill-id="billId"
  :bill-type="'rent' | 'utility'"
  :total-amount="2000000"
  :paid-amount="1000000"
  :is-paid="false"
  @payment-added="handlePaymentAdded"
/>
```

### PaymentHistory
```vue
<PaymentHistory
  :bill-id="billId"
  :bill-type="'rent' | 'utility'"
  @refresh="fetchBills"
/>
```

## 🔌 API Calls

### Fetch Payments
```typescript
const { data } = await useFetch('/api/payments', {
  query: {
    billId: 'uuid',
    billType: 'rent'
  }
})
```

### Record Payment
```typescript
const payment = await $fetch('/api/payments', {
  method: 'POST',
  body: {
    billId: 'uuid',
    billType: 'rent',
    amount: 1000000,
    paymentMethod: 'cash',
    paymentDate: '2024-01-15',
    notes: 'Cicilan pertama'
  }
})
```

### Delete Payment
```typescript
await $fetch(`/api/payments/${paymentId}`, {
  method: 'DELETE'
})
```

## 🗃️ Database Schema

### payments table
```sql
id              UUID PRIMARY KEY
billId          UUID NOT NULL
billType        bill_type NOT NULL ('rent' | 'utility')
amount          NUMERIC(12,2) NOT NULL
paymentMethod   payment_method NOT NULL
paymentDate     DATE NOT NULL
status          payment_status DEFAULT 'completed'
notes           TEXT
recordedBy      UUID REFERENCES users(id)
createdAt       TIMESTAMP DEFAULT NOW()
updatedAt       TIMESTAMP DEFAULT NOW()
```

### Updated bills tables
```sql
-- Added to both rentBills and utilityBills
paidAmount      NUMERIC(12,2) DEFAULT 0
```

## 🧮 Calculations

### Remaining Amount
```typescript
const remaining = totalAmount - paidAmount
```

### Is Paid
```typescript
const isPaid = paidAmount >= totalAmount
```

### Status
```typescript
const status = paidAmount === 0 ? 'BELUM DIBAYAR' 
             : paidAmount >= totalAmount ? 'LUNAS'
             : 'DIBAYAR SEBAGIAN'
```

## 🎨 UI Components Location

| Component | File | Purpose |
|-----------|------|---------|
| PaymentModal | `app/components/PaymentModal.vue` | Record new payment |
| PaymentHistory | `app/components/PaymentHistory.vue` | List all payments |
| RentBillCard | `app/components/billing/RentBillCard.vue` | Rent bill display |
| UtilityBillCard | `app/components/billing/UtilityBillCard.vue` | Utility bill display |
| Billing Page | `app/pages/billing/index.vue` | Main billing page |

## 🔧 Backend Files

| File | Purpose |
|------|---------|
| `server/database/schema.ts` | Table definitions |
| `server/database/migrations/add-payment-system.sql` | Migration script |
| `server/api/payments/index.get.ts` | Fetch payments |
| `server/api/payments/index.post.ts` | Create payment |
| `server/api/payments/[id].delete.ts` | Delete payment |

## 📝 Common Use Cases

### Scenario 1: 50% now, 50% later
```typescript
// First payment
amount: totalAmount * 0.5
// Status: DIBAYAR SEBAGIAN

// Second payment
amount: totalAmount - paidAmount
// Status: LUNAS
```

### Scenario 2: Multiple small payments
```typescript
// Payment 1: 500k of 2M
amount: 500000
// Status: DIBAYAR SEBAGIAN (Terbayar: 500k, Sisa: 1.5M)

// Payment 2: 700k
amount: 700000
// Status: DIBAYAR SEBAGIAN (Terbayar: 1.2M, Sisa: 800k)

// Payment 3: 800k
amount: 800000
// Status: LUNAS
```

### Scenario 3: Correction (delete payment)
```typescript
// Wrong payment recorded
DELETE /api/payments/{paymentId}
// paidAmount recalculated
// Status may change from LUNAS to DIBAYAR SEBAGIAN
```

## ⚠️ Validation Rules

| Rule | Error Message |
|------|---------------|
| Amount <= 0 | "Amount must be greater than 0" |
| Amount > remaining | "Amount exceeds remaining balance" |
| Bill already paid | "Bill is already fully paid" |
| Missing required field | "Field is required" |

## 🎯 Event Handlers

### In Billing Page
```typescript
// Open payment modal
const openPaymentModal = (billId: string, billType: 'rent' | 'utility') => {
  paymentBillId.value = billId
  paymentBillType.value = billType
  paymentModalOpen.value = true
}

// Open payment history
const openPaymentHistory = (billId: string, billType: 'rent' | 'utility') => {
  paymentHistoryBillId.value = billId
  paymentHistoryBillType.value = billType
  paymentHistoryOpen.value = true
}

// Handle payment added
const handlePaymentAdded = async () => {
  await store.fetchRentBills()
  await store.fetchUtilityBills()
  paymentModalOpen.value = false
  toast.add({ title: 'Success', color: 'success' })
}
```

### In Bill Cards
```typescript
// Emit events
emit('recordPayment', billId)
emit('viewPayments', billId)
```

## 🧪 Testing Commands

### Check if migration ran
```sql
\dt payments
SELECT * FROM payments LIMIT 5;
```

### Check bill with payments
```sql
SELECT 
  rb.id,
  rb."totalAmount",
  rb."paidAmount",
  rb."isPaid",
  COUNT(p.id) as payment_count
FROM "rentBills" rb
LEFT JOIN payments p ON p."billId" = rb.id AND p."billType" = 'rent'
GROUP BY rb.id
LIMIT 10;
```

### Get payment history
```sql
SELECT 
  p.*,
  u.name as recorded_by_name
FROM payments p
LEFT JOIN users u ON p."recordedBy" = u.id
WHERE p."billId" = 'bill-uuid-here'
  AND p."billType" = 'rent'
ORDER BY p."paymentDate" DESC;
```

## 🚨 Troubleshooting

### Button not showing
- Check `bill.isPaid` is false
- Refresh page
- Check console for errors

### Amount validation error
- Ensure amount <= remaining balance
- Check `paidAmount` in database is correct

### History not updating
- Call `refreshPayments()` after delete
- Check API returns 200 status
- Verify database updated

### Status not changing
- Check `paidAmount` calculation
- Verify `isPaid` field updated
- Refresh bills data after payment

## 📚 Documentation Files

- **User Guide**: `docs/PARTIAL_PAYMENT_GUIDE.md`
- **Implementation**: `docs/PARTIAL_PAYMENT_IMPLEMENTATION.md`
- **This File**: `docs/PARTIAL_PAYMENT_QUICK_REF.md`

## ✅ Pre-Deployment Checklist

- [ ] Migration tested in dev
- [ ] All TypeScript errors fixed
- [ ] Manual testing completed
- [ ] Staff trained on new feature
- [ ] Production database backed up
- [ ] Migration ready to run on prod
- [ ] Code deployed to production
- [ ] Verify feature works in prod
- [ ] Monitor for errors

## 🎉 Success Indicators

- ✅ No TypeScript errors
- ✅ All tests passing
- ✅ Migration runs successfully
- ✅ Bills show correct status
- ✅ Payments recorded correctly
- ✅ History displays properly
- ✅ Delete works without errors
- ✅ UI responsive on mobile
- ✅ Toast notifications appear
- ✅ Data persists correctly

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: ✅ Production Ready
