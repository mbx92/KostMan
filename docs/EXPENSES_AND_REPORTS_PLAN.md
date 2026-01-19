# Implementation Plan: Expenses Module & Reporting System

## Overview
This document outlines the implementation plan for the Expenses Management module and comprehensive Reporting system for KostMan.

---

## 1. EXPENSES MODULE

### 1.1 Database Schema

```typescript
// server/database/schema.ts

export const expenses = pgTable('expenses', {
  id: varchar('id', { length: 21 }).primaryKey(),
  propertyId: varchar('property_id', { length: 21 }).references(() => properties.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 21 }).notNull().references(() => users.id),
  
  // Expense Details
  category: varchar('category', { length: 50 }).notNull(), // 'maintenance', 'utilities', 'supplies', 'salary', 'tax', 'other'
  description: text('description').notNull(),
  amount: integer('amount').notNull(), // in cents/smallest currency unit
  
  // Classification
  type: varchar('type', { length: 20 }).notNull().default('property'), // 'property' or 'global'
  
  // Date & Payment
  expenseDate: date('expense_date').notNull(), // when expense occurred
  paidDate: date('paid_date'), // when actually paid
  isPaid: boolean('is_paid').notNull().default(false),
  paymentMethod: varchar('payment_method', { length: 50 }), // 'cash', 'transfer', 'credit_card', etc.
  
  // Supporting Documents
  receiptUrl: text('receipt_url'), // path to uploaded receipt image/PDF
  notes: text('notes'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const expenseCategories = pgTable('expense_categories', {
  id: varchar('id', { length: 21 }).primaryKey(),
  userId: varchar('user_id', { length: 21 }).notNull().references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).default('#6366f1'), // hex color for UI
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

### 1.2 API Endpoints

#### Create Expense
```
POST /api/expenses
Body: {
  propertyId?: string, // null for global expenses
  category: string,
  description: string,
  amount: number,
  type: 'property' | 'global',
  expenseDate: string,
  paidDate?: string,
  isPaid: boolean,
  paymentMethod?: string,
  receiptUrl?: string,
  notes?: string
}
```

#### List Expenses
```
GET /api/expenses
Query: {
  propertyId?: string, // filter by property, 'global' for global expenses
  type?: 'property' | 'global',
  category?: string,
  startDate?: string,
  endDate?: string,
  isPaid?: boolean,
  page?: number,
  limit?: number
}
```

#### Update Expense
```
PATCH /api/expenses/[id]
Body: (same as create, all fields optional)
```

#### Delete Expense
```
DELETE /api/expenses/[id]
```

#### Expense Categories CRUD
```
GET /api/expenses/categories
POST /api/expenses/categories
PATCH /api/expenses/categories/[id]
DELETE /api/expenses/categories/[id]
```

#### Upload Receipt
```
POST /api/expenses/upload-receipt
Body: FormData with file
Returns: { url: string }
```

### 1.3 Frontend Pages

#### Main Expenses Page
```
app/pages/expenses/index.vue
- Tab navigation: "Property Expenses" | "Global Expenses"
- Filter by property, category, date range, payment status
- Table/Grid view with:
  - Category badge with color
  - Description
  - Amount
  - Expense date / Paid date
  - Payment status (Paid/Unpaid badge)
  - Actions (Edit, Delete, Mark as Paid, View Receipt)
- Create expense button (opens modal)
- Export to Excel/PDF
- Summary cards:
  - Total expenses this month
  - Pending payments
  - Total by category (pie chart)
```

#### Expense Modal Component
```
app/components/ExpenseModal.vue
- Form with all expense fields
- Property selector (disabled if global)
- Category selector with color preview
- Amount input (formatted as currency)
- Date pickers for expense & payment dates
- Receipt upload (drag & drop or browse)
- Receipt preview if exists
- Payment status toggle
- Notes textarea
```

#### Category Management Page
```
app/pages/expenses/categories.vue
- List of custom categories
- Default categories (non-editable)
- Create/Edit/Delete custom categories
- Color picker for each category
- Usage count per category
```

### 1.4 Validations

```typescript
// server/validations/expense.ts
import { z } from 'zod'

export const createExpenseSchema = z.object({
  propertyId: z.string().optional().nullable(),
  category: z.string().min(1).max(50),
  description: z.string().min(3).max(500),
  amount: z.number().int().positive(),
  type: z.enum(['property', 'global']),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isPaid: z.boolean().default(false),
  paymentMethod: z.string().max(50).optional(),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
}).refine(data => {
  if (data.type === 'property' && !data.propertyId) {
    return false
  }
  return true
}, {
  message: 'Property expenses must have a propertyId'
})
```

---

## 2. REPORTING SYSTEM

### 2.1 Cash Report (Real vs Expected)

#### API Endpoint
```
GET /api/reports/cash
Query: {
  month: string, // YYYY-MM
  propertyId?: string // optional, for specific property
}

Response: {
  month: string,
  propertyId?: string,
  propertyName?: string,
  
  expectedCash: {
    totalRent: number,
    totalUtilities: number,
    total: number,
    roomsCount: number,
    occupiedRooms: Array<{
      roomId: string,
      roomName: string,
      rentAmount: number,
      estimatedUtility: number
    }>
  },
  
  realCash: {
    totalRentPaid: number,
    totalUtilitiesPaid: number,
    total: number,
    paidRoomsCount: number,
    paidBills: Array<{
      roomId: string,
      roomName: string,
      rentPaid: number,
      utilityPaid: number,
      paidDate: string
    }>
  },
  
  variance: {
    amount: number,
    percentage: number
  },
  
  unpaidBills: Array<{
    roomId: string,
    roomName: string,
    tenantName: string,
    rentAmount: number,
    utilityAmount: number,
    totalDue: number,
    dueDate: string
  }>
}
```

#### Implementation Logic
```typescript
// Expected cash = All occupied rooms' rent + utilities for the month
// Real cash = Paid bills from occupied rooms only
const occupiedRooms = await db.select()
  .from(rooms)
  .where(and(
    eq(rooms.status, 'occupied'),
    propertyId ? eq(rooms.propertyId, propertyId) : undefined
  ))

// Get rent bills for the month
const rentBills = await db.select()
  .from(rentBills)
  .where(eq(rentBills.period, month))

// Get utility bills for the month  
const utilityBills = await db.select()
  .from(utilityBills)
  .where(eq(utilityBills.period, month))

// Calculate expected vs real
```

#### Frontend Page
```
app/pages/reports/cash.vue
- Month selector (default: current month)
- Property filter (All Properties / Specific)
- Summary cards:
  - Expected Cash (green)
  - Real Cash (blue)
  - Variance (red/green based on +/-)
  - Collection Rate (percentage)
- Comparison chart (bar chart)
- Detailed tables:
  - Expected breakdown by room
  - Real payments by room
  - Unpaid bills list (with action to send reminder)
- Export to Excel/PDF
```

### 2.2 Payment Report

#### API Endpoint
```
GET /api/reports/payments
Query: {
  startDate: string,
  endDate: string,
  propertyId?: string,
  paymentMethod?: string,
  billType?: 'rent' | 'utility' | 'all'
}

Response: {
  summary: {
    totalPayments: number,
    totalAmount: number,
    rentPayments: number,
    utilityPayments: number,
    averagePaymentAmount: number
  },
  
  byPaymentMethod: Array<{
    method: string,
    count: number,
    amount: number,
    percentage: number
  }>,
  
  byProperty: Array<{
    propertyId: string,
    propertyName: string,
    paymentsCount: number,
    totalAmount: number
  }>,
  
  dailyPayments: Array<{
    date: string,
    count: number,
    amount: number
  }>,
  
  payments: Array<{
    id: string,
    billType: 'rent' | 'utility',
    roomName: string,
    tenantName: string,
    amount: number,
    paidDate: string,
    paymentMethod: string,
    period: string
  }>
}
```

#### Frontend Page
```
app/pages/reports/payments.vue
- Date range picker
- Property filter
- Payment method filter
- Bill type filter (Rent/Utility/All)
- Summary cards with icons
- Payment trend chart (line/area chart by day)
- Payment method distribution (pie chart)
- Property comparison (bar chart)
- Detailed payment table with sorting/filtering
- Export functionality
```

### 2.3 Income Report

#### API Endpoint
```
GET /api/reports/income
Query: {
  startDate: string,
  endDate: string,
  propertyId?: string,
  groupBy?: 'day' | 'week' | 'month' // default: 'month'
}

Response: {
  summary: {
    totalIncome: number,
    rentIncome: number,
    utilityIncome: number,
    otherIncome: number, // future: additional fees
    averageMonthlyIncome: number,
    growthRate: number // compared to previous period
  },
  
  byPeriod: Array<{
    period: string, // based on groupBy
    rentIncome: number,
    utilityIncome: number,
    total: number
  }>,
  
  byProperty: Array<{
    propertyId: string,
    propertyName: string,
    totalIncome: number,
    rentIncome: number,
    utilityIncome: number,
    occupancyRate: number,
    averageRentPerRoom: number
  }>,
  
  topPerformingRooms: Array<{
    roomId: string,
    roomName: string,
    propertyName: string,
    totalPaid: number,
    paymentsCount: number
  }>
}
```

#### Frontend Page
```
app/pages/reports/income.vue
- Date range selector with presets (This Month, Last Month, Last 3 Months, etc.)
- Property filter
- Group by selector
- Summary cards with trend indicators
- Income trend chart (multi-line: rent vs utility)
- Property comparison chart
- Income composition (stacked bar chart by period)
- Top performing rooms table
- Export functionality
```

### 2.4 Tenant Report

#### API Endpoint
```
GET /api/reports/tenants
Query: {
  propertyId?: string,
  status?: 'active' | 'inactive' | 'all',
  sortBy?: 'name' | 'moveInDate' | 'totalPaid' | 'outstandingBalance'
}

Response: {
  summary: {
    totalTenants: number,
    activeTenants: number,
    inactiveTenants: number,
    averageTenancyDuration: number, // in months
    occupancyRate: number
  },
  
  tenants: Array<{
    id: string,
    name: string,
    contact: string,
    roomName: string,
    propertyName: string,
    moveInDate: string,
    moveOutDate?: string,
    status: string,
    monthlyRent: number,
    
    paymentHistory: {
      totalPaid: number,
      totalBills: number,
      paidBills: number,
      unpaidBills: number,
      onTimePayments: number,
      latePayments: number,
      outstandingBalance: number
    },
    
    tenancyDuration: number, // in days
    lastPaymentDate?: string
  }>,
  
  byProperty: Array<{
    propertyId: string,
    propertyName: string,
    tenantsCount: number,
    occupancyRate: number
  }>
}
```

#### Frontend Page
```
app/pages/reports/tenants.vue
- Property filter
- Status filter (Active/Inactive/All)
- Search by name/contact
- Summary cards
- Tenants table with:
  - Tenant info (name, contact, photo)
  - Room & property
  - Move-in date & duration
  - Payment statistics (badges for good/bad payer)
  - Outstanding balance (red if > 0)
  - Actions (View Details, View Bills, Contact)
- Occupancy rate by property (gauge chart)
- Tenant distribution by property (pie chart)
- Payment behavior analysis (on-time vs late)
- Export functionality
```

### 2.5 Electricity Usage Report

#### API Endpoint
```
GET /api/reports/electricity
Query: {
  startDate: string,
  endDate: string,
  propertyId?: string,
  roomId?: string
}

Response: {
  summary: {
    totalUsage: number, // kWh
    totalCost: number,
    averageUsagePerRoom: number,
    averageCostPerRoom: number,
    highestUsageRoom: {
      roomName: string,
      usage: number
    },
    lowestUsageRoom: {
      roomName: string,
      usage: number
    }
  },
  
  byPeriod: Array<{
    period: string, // YYYY-MM
    totalUsage: number,
    totalCost: number,
    roomsReported: number
  }>,
  
  byRoom: Array<{
    roomId: string,
    roomName: string,
    propertyName: string,
    
    readings: Array<{
      period: string,
      previousReading: number,
      currentReading: number,
      usage: number, // kWh
      cost: number,
      pricePerKwh: number,
      readingDate: string
    }>,
    
    totalUsage: number,
    totalCost: number,
    averageUsage: number,
    trend: 'increasing' | 'decreasing' | 'stable'
  }>,
  
  unusualUsage: Array<{
    roomId: string,
    roomName: string,
    period: string,
    usage: number,
    averageUsage: number,
    deviation: number // percentage
  }>
}
```

#### Frontend Page
```
app/pages/reports/electricity.vue
- Date range selector
- Property filter
- Room filter (multiselect)
- Summary cards with icons
- Usage trend chart (area chart showing total kWh over time)
- Cost trend chart
- Room comparison chart (bar chart of usage per room)
- Detailed table with:
  - Room info
  - Period-by-period readings
  - Usage (kWh)
  - Cost
  - Trend indicator (↑↓→)
- Unusual usage alerts (rooms with >20% deviation)
- Export to Excel with all readings
```

### 2.6 Profit & Loss Report

#### API Endpoint
```
GET /api/reports/profit-loss
Query: {
  startDate: string,
  endDate: string,
  propertyId?: string,
  groupBy?: 'month' | 'quarter' | 'year'
}

Response: {
  summary: {
    totalRevenue: number,
    totalExpenses: number,
    netProfit: number,
    profitMargin: number, // percentage
    
    revenueBreakdown: {
      rentIncome: number,
      utilityIncome: number,
      otherIncome: number
    },
    
    expenseBreakdown: {
      byCategory: Array<{
        category: string,
        amount: number,
        percentage: number
      }>,
      propertyExpenses: number,
      globalExpenses: number
    }
  },
  
  byPeriod: Array<{
    period: string,
    revenue: number,
    expenses: number,
    profit: number,
    profitMargin: number
  }>,
  
  byProperty: Array<{
    propertyId: string,
    propertyName: string,
    revenue: number,
    expenses: number,
    profit: number,
    profitMargin: number,
    
    revenueBreakdown: {
      rent: number,
      utilities: number
    },
    
    expenseBreakdown: Array<{
      category: string,
      amount: number
    }>
  }>,
  
  cashFlow: {
    openingBalance: number,
    totalInflow: number,
    totalOutflow: number,
    closingBalance: number
  }
}
```

#### Frontend Page
```
app/pages/reports/profit-loss.vue
- Date range selector
- Property filter
- Group by selector
- Summary section:
  - Revenue card (green)
  - Expenses card (red)
  - Net Profit card (blue/red based on value)
  - Profit Margin gauge
- Profit trend chart (line chart with revenue, expenses, profit lines)
- Revenue vs Expenses comparison (stacked bar chart)
- Expense breakdown (pie/donut chart by category)
- Property performance comparison table
- Cash flow statement
- Export to PDF (formatted P&L statement)
```

### 2.7 Shared Report Components

```typescript
// app/components/reports/ReportHeader.vue
- Title
- Date range display
- Filters applied display
- Export buttons (Excel, PDF, Print)
- Refresh button

// app/components/reports/SummaryCard.vue
- Metric value (large number)
- Label
- Icon
- Trend indicator (up/down arrow with percentage)
- Color coding based on metric type

// app/components/reports/ReportChart.vue
- Wrapper for Chart.js/ApexCharts
- Responsive
- Theme-aware (dark mode support)
- Export as image

// app/components/reports/ReportTable.vue
- Sortable columns
- Filterable
- Pagination
- Row actions
- Summary row (totals)
- Export selection
```

---

## 3. IMPLEMENTATION PHASES

### Phase 1: Expenses Module (Week 1-2)
1. Database schema & migrations
2. Backend API endpoints
3. Validations
4. Basic CRUD pages
5. Expense modal component
6. Receipt upload functionality
7. Testing

### Phase 2: Basic Reports (Week 3-4)
1. Cash Report (Real vs Expected)
2. Payment Report
3. Income Report
4. Shared report components
5. Export functionality
6. Testing

### Phase 3: Advanced Reports (Week 5-6)
1. Tenant Report
2. Electricity Usage Report
3. Profit & Loss Report
4. Dashboard integration (summary widgets)
5. Automated report scheduling (email PDF monthly)
6. Testing

### Phase 4: Enhancements (Week 7)
1. Custom expense categories
2. Recurring expenses
3. Budget vs Actual tracking
4. Report templates
5. Advanced filters & date presets
6. Performance optimization
7. Final testing & bug fixes

---

## 4. TECHNICAL CONSIDERATIONS

### 4.1 Performance
- Use database indexes on:
  - expenses: propertyId, userId, expenseDate, type, category
  - Add composite indexes for common query patterns
- Implement pagination for large datasets
- Cache report calculations for frequently accessed periods
- Use aggregation queries efficiently

### 4.2 File Storage
- Receipt uploads: Store in `public/receipts/` or cloud storage (S3/R2)
- Naming convention: `{userId}/{expenseId}_{timestamp}.{ext}`
- Maximum file size: 5MB
- Allowed formats: JPG, PNG, PDF
- Generate thumbnails for images

### 4.3 Export Functionality
- Excel: Use `xlsx` library
- PDF: Use `jsPDF` with custom templates
- Include:
  - Report title & date range
  - Filters applied
  - Summary section
  - Detailed data table
  - Charts as images
  - Footer with generated date & user

### 4.4 Security
- Verify user owns property before accessing expenses
- Sanitize file uploads (scan for malware if possible)
- Rate limit report generation endpoints
- Implement RBAC (admin can see all, manager only their properties)

### 4.5 Data Validation
- Ensure expense dates are not in future
- Validate paid dates are >= expense dates
- Prevent negative amounts
- Require receipt for expenses > threshold amount
- Validate property exists for property-type expenses

---

## 5. TESTING CHECKLIST

### Unit Tests
- [ ] Expense CRUD operations
- [ ] Report calculation logic
- [ ] Date range validations
- [ ] Amount calculations
- [ ] Permission checks

### Integration Tests
- [ ] Expense creation with receipt upload
- [ ] Report generation with filters
- [ ] Export functionality
- [ ] Multi-property scenarios
- [ ] Edge cases (no data, single data point)

### E2E Tests
- [ ] Complete expense workflow
- [ ] Generate each report type
- [ ] Export reports
- [ ] Filter combinations
- [ ] Mobile responsiveness

---

## 6. DEPENDENCIES

```json
{
  "dependencies": {
    "xlsx": "^0.18.5",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "chart.js": "^4.4.1",
    "vue-chartjs": "^5.3.0",
    "date-fns": "^3.0.0"
  }
}
```

---

## 7. UI/UX NOTES

- Use consistent color coding across all reports:
  - Revenue/Income: Green (#10b981)
  - Expenses: Red (#ef4444)
  - Profit: Blue (#3b82f6)
  - Neutral: Gray (#6b7280)
  
- Date range presets:
  - Today
  - Yesterday
  - This Week
  - Last Week
  - This Month
  - Last Month
  - Last 3 Months
  - Last 6 Months
  - This Year
  - Last Year
  - Custom Range
  
- Export file naming:
  - `{ReportType}_{PropertyName}_{DateRange}_{Timestamp}.{ext}`
  - Example: `ProfitLoss_KosMelati_2026-01_20260119.pdf`

- Mobile considerations:
  - Stack charts vertically
  - Horizontal scroll for wide tables
  - Simplified filters (drawer/modal)
  - Summary cards in 2-column grid
  
- Loading states:
  - Skeleton loaders for charts
  - Progress bar for exports
  - Shimmer effect for tables

---

## 8. FUTURE ENHANCEMENTS

- Automated expense categorization using ML
- OCR for receipt data extraction
- Budget planning & alerts
- Expense approval workflow
- Integration with accounting software (QuickBooks, Xero)
- Mobile app for expense capture (take photo of receipt on-the-go)
- Predictive analytics (forecast income/expenses)
- Benchmark reports (compare with industry standards)
- Multi-currency support
- Tax reporting integration

---

## 9. SUCCESS METRICS

- Expense entry time: < 2 minutes per expense
- Report generation time: < 3 seconds
- Export success rate: > 99%
- User adoption rate: > 80% within first month
- Data accuracy: 100% (validated against manual calculations)
- Mobile usability score: > 4.5/5

---

**Document Version:** 1.0  
**Last Updated:** January 19, 2026  
**Author:** KostMan Development Team
