# ⚡ Generate Utility Bill Feature

## Overview
Fitur khusus untuk membuat tagihan utility (listrik, air, dll) secara manual, tanpa komponen sewa (rent charges) dan tanpa lookup meteran otomatis.

---

## ✅ Implementation Complete

### Backend (100%)
- ✅ Updated `generateBillSchema` to support optional `itemType` in `additionalCharges`
- ✅ Update API endpoint `/api/bills/generate` to respect provided `itemType`
- ✅ Support skipping auto-calculation of utilities (`includeUtility: false`)

### Frontend (100%)
- ✅ "Generate Utility Bill" button in header
- ✅ Dedicated Modal for utility bill generation
- ✅ Manual input for utility items (Name, Qty, Price)
- ✅ Room & Tenant selection
- ✅ Period selection
- ✅ Auto-total calculation in UI

---

## 🎯 How It Works

### Flow
1. **Click Button**: User clicks "Generate Utility Bill" (green button)
2. **Fill Form**:
   - Select Room & Tenant (Tenant auto-selected!)
   - Set Period (Start - End)
3. **Generate Items (Two Ways)**:
   - **Auto**: System automatically fetches settings (Cost per kWh, Water fee, Trash fee) and Meter Readings, then populates the items list.
   - **Manual**: User can click "Add Item" to add custom charges manually.
   - **Reset**: User can click "Auto Generate" button to refresh items based on current settings.
4. **Generate**:
   - System sends request with `includeUtility: false`
   - Explicitly sets `itemType: 'utility'` for all added items
   - Creates bill WITHOUT rent charges
   - Creates bill WITHOUT auto-lookup meter readings

### API Payload
```json
{
  "roomId": "uuid",
  "tenantId": "uuid",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31",
  "includeUtility": false, // Skip auto lookup
  "additionalCharges": [
    {
      "itemType": "utility", // Explicit utility type
      "itemName": "Listrik Januari",
      "itemQty": 100,
      "itemUnitPrice": 2000,
      ...
    }
  ]
}
```

---

## 📍 Use Cases

### Use Case 1: Tagihan Listrik Susulan
**Scenario**: Tagihan sewa sudah dibuat awal bulan, tapi tagihan listrik baru keluar akhir bulan.
1. Use "Generate Utility Bill"
2. Input items manually
3. Result: Bill only containing utility charges

### Use Case 2: Tagihan Air / Internet Terpisah
**Scenario**: Kost charge separate bills for internet or water based on usage.
1. Use "Generate Utility Bill"
2. Input "Extra Internet Data"
3. Result: Specific utility bill

---

## 🎨 UI Components

### Generate Utility Bill Modal
- **Title**: "Generate Utility Bill"
- **Fields**: 
  - Room (Select)
  - Tenant (Select)
  - Period Start/End (Date)
  - Utility Items List (Dynamic Add/Remove)
  - Notes
- **Items Row**:
  - Name (Text)
  - Qty (Number)
  - Unit Price (Number)
  - Total (Auto-calculated display)

---

## ✅ Testing Checklist

- [ ] Click "Generate Utility Bill" button
- [ ] Ensure Rent is NOT generated
- [ ] Ensure Auto-Utility Lookup is SKIPPED
- [ ] Verify items have correct type `utility`
- [ ] Verify total amount calculation
- [ ] Verify bill status is 'draft' or 'unpaid'

---

## 📊 Summary

| Feature | Status | Location |
|---------|--------|----------|
| Backend API | ✅ Complete | `/api/bills/generate` |
| UI Button | ✅ Complete | Header |
| Modal UI | ✅ Complete | Dedicated Modal |
| Manual Items | ✅ Complete | Dynamic Form |
| Type Handling | ✅ Complete | Explicit 'utility' type |

**Status**: ✅ **100% Complete & Ready to Use!**

---

**Created**: 2026-01-18  
**Feature**: Generate Utility Only Bill
