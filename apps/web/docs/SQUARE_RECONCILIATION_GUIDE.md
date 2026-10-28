# Square Payment Reconciliation Tool - Usage Guide

## Overview
The Square Payment Reconciliation Tool helps you compare Square's actual payment data with your database records and fix any discrepancies.

## Access
Navigate to: `/square-reconcile`

## Features

### 1. Individual Trip Reconciliation
- **Search by Trip ID or Booking Number**: Enter any trip identifier (e.g., "26-1140" or "1167")
- **View Comparison**: See side-by-side comparison of Square data vs. database data
- **Apply Correction**: Automatically fix discrepancies with one click
- **Add Manual Transactions**: Add missing transactions (like cash tips)

### 2. Bulk Recalculation
- **Preview Changes**: See which trips need their totals recalculated
- **Apply All Updates**: Recalculate payments_total, tips_total, and balance_due for all trips

## Fixing Trip #26-1140 (Donna McQueen)

### The Issue
**What Square Recorded (8/28/2026 0:32:43):**
- Base Amount: $73.00
- Tip: $14.60
- Processing Fee: $2.84
- **Total Paid: $84.76**

**What's in the Database:**
- Payment: $70.00 (Square - incorrect)
- CC Fee: $3.00 (incorrect)
- Tip: $20.00 (Cash - correct)
- **Missing: $14.60 tip from Square**

**Correct Totals Should Be:**
- Services Total: $73.00
- Square Payment: $73.00
- Square Tip: $14.60
- Cash Tip: $20.00
- CC Fee: $2.84
- **Total Tips: $34.60**

### Step-by-Step Fix

#### Option 1: If Square Payment ID is Available
1. Go to `/square-reconcile`
2. Enter "26-1140" in the search box
3. Click "Search"
4. Review the comparison showing Square actual vs. database
5. Click "Apply Correction" to automatically fix the discrepancies
6. The tool will:
   - Delete incorrect Square transactions
   - Create new transactions matching Square's actual data
   - Recalculate all totals

#### Option 2: Manual Fix (Current Situation)
Since this payment was manually entered and doesn't have a Square payment ID:

1. Go to `/square-reconcile`
2. Enter "26-1140" in the search box
3. Click "Search"
4. You'll see "No Square Payment Data" message
5. View the current database transactions
6. Click "Add Transaction" button
7. Add the missing Square tip:
   - Category: **Tip**
   - Method: **Square**
   - Amount: **0**
   - Tip Amount: **14.60**
   - Description: "Square tip from 8/28/2026 payment"
8. Click "Add Transaction"
9. Now manually delete the incorrect transactions:
   - Navigate to the Trips page
   - Open trip #26-1140
   - Edit/delete the incorrect $70 payment
   - Edit/delete the incorrect $3 CC fee
10. Add correct transactions:
    - Payment: $73.00 (Square)
    - CC Fee: $2.84 (Credit Card Fee)
11. The totals will recalculate automatically

### Alternative: Direct Database Fix

If you prefer to fix this directly in the database:

```sql
-- Delete incorrect transactions
DELETE FROM transactions WHERE id IN (1490, 1491);

-- Add correct Square payment
INSERT INTO transactions (
  appointment_id, category, method, amount, tip_amount, 
  description, transaction_date, created_at
) VALUES (
  1167, 'payment', 'Square', 73.00, 0,
  'Square payment - corrected amount',
  '2026-08-28', NOW()
);

-- Add Square tip
INSERT INTO transactions (
  appointment_id, category, method, amount, tip_amount,
  description, transaction_date, created_at
) VALUES (
  1167, 'tip', 'Square', 0, 14.60,
  'Square tip - corrected amount',
  '2026-08-28', NOW()
);

-- Add correct CC fee
INSERT INTO transactions (
  appointment_id, category, method, amount, tip_amount,
  description, transaction_date, created_at
) VALUES (
  1167, 'cc_fee', 'Credit Card Fee', 2.84, 0,
  'Square processing fee - corrected amount',
  '2026-08-28', NOW()
);

-- Recalculate appointment totals
UPDATE appointments
SET 
  services_total = 73.00,
  original_amount = 73.00,
  payments_total = 73.00,
  tips_total = 34.60, -- 14.60 Square + 20.00 Cash
  balance_due = 0,
  payment_status = 'paid'
WHERE id = 1167;
```

## Common Issues

### Issue: "No Square Payment Data"
**Cause**: The trip doesn't have a `square_payment_id` stored
**Solution**: 
1. Find the Square payment ID from your Square dashboard
2. Update the appointment: `UPDATE appointments SET square_payment_id = 'xxx' WHERE id = 1167`
3. Try the reconciliation again

### Issue: "Trip totals are all zero"
**Cause**: Cached totals weren't recalculated after transactions were added
**Solution**: 
1. Use the Bulk Recalculation tool at the top of the page
2. Click "Preview Changes" to see affected trips
3. Click "Apply All Updates" to fix them all at once

### Issue: "Discrepancy after correction"
**Cause**: There may be multiple payments or manual transactions
**Solution**:
1. Review all transactions in the database
2. Delete any duplicates
3. Ensure only correct transactions exist
4. Use the recalculation tool

## Best Practices

1. **Always check Square first**: Before manually entering payments, verify the actual amounts in your Square dashboard
2. **Use the reconciliation tool regularly**: Run it weekly to catch discrepancies early
3. **Record Square payment IDs**: Always capture the `square_payment_id` from webhooks
4. **Don't manually enter Square payments**: Let the webhook do it automatically
5. **Add cash tips separately**: Use the "Add Transaction" feature for cash/Venmo/Zelle tips

## Future Prevention

To prevent these issues in the future:

1. **Ensure Square webhooks are working**: Check `/api/webhooks/square` logs
2. **Monitor webhook failures**: Check the communication_failures table
3. **Set up Square payment ID capture**: Update the booking flow to store `square_payment_id`
4. **Run bulk recalculation monthly**: Use the tool to catch any missed calculations

## Technical Details

### What the Tool Does

**Individual Reconciliation:**
1. Fetches trip data from database
2. Calls Square API to get actual payment data using `square_payment_id`
3. Compares amounts (payment, tip, fee)
4. Shows discrepancies in a clear table
5. On correction:
   - Deletes incorrect Square transactions
   - Creates new transactions with correct amounts
   - Recalculates appointment totals
   - Updates payment status

**Bulk Recalculation:**
1. Finds all appointments with transactions
2. Sums up transactions by category (payment, tip, fee)
3. Calculates correct totals
4. Updates appointment fields:
   - `payments_total`
   - `tips_total`
   - `balance_due`
   - `payment_status`

### Database Tables Updated
- `transactions` (add/delete records)
- `appointments` (update totals)

### API Endpoints
- `POST /api/payments/square/reconcile` - Reconcile individual trip
- `PUT /api/payments/square/reconcile` - Add manual transaction
- `POST /api/appointments/recalculate-all-totals` - Bulk recalculation
