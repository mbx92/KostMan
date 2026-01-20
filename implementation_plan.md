# Implementation Plan: Bill Reminders & Notifications

## Goal Description
Implement a dedicated `/reminders` page to view and manage unpaid bills, and integrate bill reminders into the global notification system (Navbar) and Dashboard.

## User Review Required
> [!NOTE]
> The user selected **Option A (Clean List View)** for the reminders page.
> **Verification Note**: `npm run test:bill-cli` currently points to `rent-bills` endpoints only. It may be outdated as it attempts to send meter readings (utility data) to rent bill endpoints. I will focus on the reminders implementation first, but be aware existing CLI tests might be partial.

## Proposed Changes

### Frontend
#### [MODIFY] `app/components/layout/TheHeader.vue`
*   Integrate `useKosStore` (or directly call the new reminders API) to fetch bill counts.
*   Update the notification dropdown to include a section for "Overdue Bills".
*   Show a red badge count for unpaid overdue bills.

#### [NEW] `app/pages/reminders/index.vue`
*   **Design**: Option A (Clean List View).
*   **Structure**:
    *   **Group 1**: OVERDUE (Red/Urgent). List of bills past due date.
    *   **Group 2**: DUE SOON (Orange/Warning). List of bills due in <= 3 days.
    *   **Group 3**: UPCOMING (Gray/Info). Other unpaid bills.
*   **Actions**: "Send WhatsApp" (opens wa.me link) and "View Detail" (opens modal or billing page).

#### [MODIFY] `app/pages/index.vue`
*   Add the "Bill Reminder Banner" (Yellow alert style) if there are overdue bills.
*   Banner links to `/reminders`.

### Backend (Server)
#### [NEW] `server/api/reminders/index.get.ts`
*   **Purpose**: Dedicated endpoint for fetching reminder data efficiently.
*   **Logic**:
    *   Query `rentBills` AND `utilityBills` where `isPaid = false`.
    *   Calculate `daysOverdue` for each.
    *   Sort by due date (oldest first).
    *   Return structure: `{ overdue: [], dueSoon: [], upcoming: [], counts: { overdue: 0, total: 0 } }`.

#### [MODIFY] `app/stores/kos.ts`
*   Add `fetchReminders()` action that calls the new endpoint.
*   Add state `reminders` to store this data.

## Verification Plan

### Manual Verification
1.  **Seed Data**: Run `npm run db:seed-notif` to ensure we have "Overdue" and "Future" bills.
2.  **Navbar**: Check the bell icon badge matches the number of overdue bills.
3.  **Reminders Page**:
    *   Go to `/reminders`
    *   Verify "Si Telat Bayar" appears in the **OVERDUE** section.
    *   Verify "Si Rajin Bayar" appears in **UPCOMING** or **DUE SOON** (depending on seed date).
4.  **WhatsApp Link**: Click "Send WhatsApp" and verify it opens a URL with the correct contact number and message template.
