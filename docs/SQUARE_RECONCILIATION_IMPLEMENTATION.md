# Square Payment Reconciliation System - Implementation Summary

## Overview
Created a comprehensive system to compare Square's actual payment data with database records and fix discrepancies automatically.

## What Was Created

### 1. API Endpoints

#### `/api/payments/square/reconcile` (POST)
**Purpose**: Compare Square payment data with database and fix discrepancies

**Features**:
- Fetch actual payment data from Square API using `square_payment_id`
- Compare Square amounts (payment, tip, fee) with database transactions
- Show detailed discrepancies
- Apply automatic corrections (delete incorrect, create correct transactions)
- Recalculate appointment totals

**Usage**:
```javascript
// Compare data
fetch('/api/payments/square/reconcile', {
  method: 'POST',
  body: JSON.stringify({ tripIdentifier: '26-1140' })
});

// Apply correction
fetch('/api/payments/square/reconcile', {
  method: 'POST',
  body: JSON.stringify({ 
    tripIdentifier: '26-1140',
    action: 'apply_correction'
  })
});
```

#### `/api/payments/square/reconcile` (PUT)
**Purpose**: Add manual transactions (cash tips, etc.)

**Usage**:
```javascript
fetch('/api/payments/square/reconcile', {
  method: 'PUT',
  body: JSON.stringify({
    tripId: 1167,
    category: 'tip',
    method: 'Cash',
    amount: 0,
    tipAmount: 20.00,
    description: 'Cash tip received'
  })
});
```

#### `/api/appointments/recalculate-all-totals` (POST)
**Purpose**: Bulk recalculate totals for all trips with transactions

**Features**:
- Finds all trips with transactions
- Recalculates payments_total, tips_total, balance_due
- Dry-run mode to preview changes
- Returns list of updated trips

**Usage**:
```javascript
// Preview changes
fetch('/api/appointments/recalculate-all-totals', {
  method: 'POST',
  body: JSON.stringify({ dryRun: true })
});

// Apply updates
fetch('/api/appointments/recalculate-all-totals', {
  method: 'POST',
  body: JSON.stringify({ dryRun: false })
});
```

#### `/api/fix-trip-26-1140` (POST)
**Purpose**: One-click fix for the specific Donna McQueen trip

**What it does**:
1. Deletes incorrect transactions (IDs 1490, 1491)
2. Adds correct Square payment ($73.00)
3. Adds correct Square tip ($14.60)
4. Adds correct CC fee ($2.84)
5. Keeps existing cash tip ($20.00)
6. Recalculates all totals
7. Updates payment status

### 2. UI Pages

#### `/square-reconcile`
**Main reconciliation tool with:**

1. **Bulk Recalculation Section** (top of page)
   - Preview button to see all trips needing updates
   - Shows total checked, updates needed, errors
   - Displays sample of changes (first 10)
   - Apply button to fix all at once

2. **Individual Trip Search**
   - Search by trip ID or booking number
   - Shows trip information
   - Displays Square vs. Database comparison table
   - Highlights discrepancies in red
   - "Apply Correction" button

3. **Add Manual Transaction**
   - Form to add cash/Venmo/Zelle tips
   - Category, method, amount, tip amount fields
   - Auto-recalculates totals after adding

4. **Transaction History**
   - Shows all transactions for the trip
   - Color-coded by category
   - Running totals at bottom

5. **Current Totals Display**
   - Original amount, payments, tips, balance

#### `/fix-trip-26-1140`
**Dedicated page for the Donna McQueen fix:**

- Clear explanation of the issue
- Shows what Square recorded vs. what's in database
- Lists exactly what will be fixed
- One-click fix button
- Detailed success results showing:
  - Summary of fixed amounts
  - Updated trip totals
  - Complete transaction list
  - Next steps confirmation

### 3. Documentation

#### `/docs/SQUARE_RECONCILIATION_GUIDE.md`
Comprehensive guide covering:
- How to use the reconciliation tool
- Step-by-step fix instructions for trip #26-1140
- Common issues and solutions
- Best practices
- Technical details
- Database tables and queries

## Fixing Trip #26-1140 (Donna McQueen)

### The Problem
**Square's Actual Data (8/28/2026):**
- Base: $73.00
- Tip: $14.60
- Fee: $2.84
- Total: $84.76

**Database Has:**
- Payment: $70.00 ❌
- Tip (Square): $0.00 ❌ (missing)
- Tip (Cash): $20.00 ✅
- Fee: $3.00 ❌

### Quick Fix Options

#### Option 1: Use the Dedicated Fix Page (Recommended)
1. Navigate to `/fix-trip-26-1140`
2. Review the issue description
3. Click "Fix Trip #26-1140 Now"
4. Confirm the fix
5. View the success results

**Result**: 
- Payment: $73.00 ✅
- Square Tip: $14.60 ✅
- Cash Tip: $20.00 ✅
- Fee: $2.84 ✅
- Total Tips: $34.60 ✅

#### Option 2: Use the Reconciliation Tool
1. Navigate to `/square-reconcile`
2. Enter "26-1140" in search box
3. Click "Search"
4. Review the comparison
5. Click "Add Transaction" to add the missing $14.60 tip
6. Manually correct the payment and fee amounts

#### Option 3: Direct Database Fix
See the documentation for SQL commands to fix directly.

## Using the Bulk Recalculation Tool

### Problem It Solves
Many trips have `payments_total`, `tips_total`, and `balance_due` set to $0.00 even though they have transactions recorded. This happens when transactions are added manually or via webhook but the cached totals aren't recalculated.

### How to Use
1. Go to `/square-reconcile`
2. At the top, click "Preview Changes"
3. Review the list of trips that need updating
4. See before/after totals for each trip
5. Click "Apply All Updates" to fix them all

### What It Does
For each trip with transactions:
1. Sums all payment transactions → `payments_total`
2. Sums all tip amounts → `tips_total`
3. Calculates `balance_due` = `original_amount` - `payments_total`
4. Updates `payment_status` = 'paid' if balance ≤ 0

## Technical Implementation Details

### Data Flow

**Reconciliation Process:**
```
1. User enters trip ID/booking number
2. System fetches appointment from database
3. System fetches actual payment data from Square API
4. Compare amounts (payment, tip, fee)
5. Calculate discrepancies
6. Display comparison table
7. User clicks "Apply Correction"
8. Delete incorrect Square transactions
9. Create new transactions with correct amounts
10. Recalculate appointment totals
11. Update payment status
```

**Bulk Recalculation Process:**
```
1. Find all appointments with transactions
2. For each appointment:
   - Get all transactions
   - Sum payments by category
   - Calculate new totals
3. Preview or apply updates
4. Update appointments table
```

### Database Changes

**Transactions Table**:
- Adds new transactions with corrected amounts
- Deletes incorrect transactions
- Categories: payment, tip, cc_fee, refund, expense

**Appointments Table**:
- Updates `payments_total`
- Updates `tips_total`
- Updates `balance_due`
- Updates `payment_status`
- Updates `driver_commission` (if employee assigned)

### Square API Integration

Uses Square SDK:
```javascript
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT
});

// Get payment
const payment = await squareClient.paymentsApi.getPayment(paymentId);

// Get order
const order = await squareClient.ordersApi.retrieveOrder(orderId);
```

**Data Extracted**:
- Payment ID
- Total amount
- Base amount
- Tip amount
- Processing fee
- Card details (brand, type, last 4)
- Status

## Best Practices Going Forward

### 1. Always Capture Square Payment IDs
When a Square payment comes in via webhook, store the `square_payment_id` in the appointments table. This allows the reconciliation tool to fetch actual data from Square.

### 2. Don't Manually Enter Square Payments
Let the Square webhook handle all Square payments automatically. Manual entry often leads to incorrect amounts.

### 3. Use the Reconciliation Tool Regularly
Run the tool weekly to catch discrepancies early before they accumulate.

### 4. Add Cash Tips via the Tool
Use the "Add Transaction" feature in the reconciliation UI to properly record cash, Venmo, and Zelle tips.

### 5. Run Bulk Recalculation Monthly
Use the bulk recalculation tool to ensure all cached totals match transaction records.

## Troubleshooting

### "No Square Payment Data"
**Cause**: Trip doesn't have `square_payment_id` stored
**Fix**: Find the payment ID from Square dashboard and update the appointment

### "Discrepancy after correction"
**Cause**: Multiple payments or duplicate transactions
**Fix**: Review all transactions, delete duplicates, use recalculation tool

### "Trip totals are zero"
**Cause**: Cached totals not recalculated
**Fix**: Use bulk recalculation tool

### "Balance due is negative"
**Cause**: Payments exceed service total
**Fix**: Check services_total, verify payment amounts, recalculate

## Files Created

```
/apps/web/src/app/api/payments/square/reconcile/route.js
/apps/web/src/app/api/appointments/recalculate-all-totals/route.js
/apps/web/src/app/api/fix-trip-26-1140/route.js
/apps/web/src/app/square-reconcile/page.jsx
/apps/web/src/app/fix-trip-26-1140/page.jsx
/apps/web/docs/SQUARE_RECONCILIATION_GUIDE.md
/apps/web/docs/SQUARE_RECONCILIATION_IMPLEMENTATION.md (this file)
```

## Next Steps

1. **Fix trip #26-1140 immediately**:
   - Go to `/fix-trip-26-1140`
   - Click the fix button
   - Verify the results

2. **Run bulk recalculation**:
   - Go to `/square-reconcile`
   - Click "Preview Changes" in the bulk section
   - Review the list
   - Click "Apply All Updates"

3. **Verify Square webhook is working**:
   - Check recent trips have `square_payment_id`
   - Review `/api/webhooks/square` logs
   - Ensure webhook URL is registered in Square dashboard

4. **Monitor regularly**:
   - Add `/square-reconcile` to your weekly routine
   - Check for new discrepancies
   - Run bulk recalculation monthly

## Support

For questions or issues:
1. Check the user guide: `/docs/SQUARE_RECONCILIATION_GUIDE.md`
2. Review this implementation doc
3. Test with the tool at `/square-reconcile`
4. Contact the development team if needed
