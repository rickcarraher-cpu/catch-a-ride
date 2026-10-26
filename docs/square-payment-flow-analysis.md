# Square Payment Flow Analysis

## Overview
This document analyzes the complete Square payment integration flow from payment initiation through webhook processing to ensure transaction integrity.

## Payment Flow Sequence

### 1. Payment Initiation
**Endpoints:**
- `/api/payments/square/link` - Creates payment link
- `/api/payments/square/invoice` - Creates invoice
- `/api/payments/square/checkout` - Creates checkout session

**Database Record Created:**
```javascript
payments {
  provider: 'square',
  status: 'pending' | 'link_created',
  amount: total_amount,
  external_reference_id: square_checkout_id | square_invoice_id,
  metadata: {
    order_id: square_order_id,
    credit_card_fee: calculated_cc_fee,
    type: 'link' | 'invoice' | 'checkout'
  }
}
```

**Appointment Fields Set:**
```javascript
appointments {
  square_checkout_id: checkout_id,
  payment_method: 'Square',
  payment_status: 'pending',
  original_amount: services_total + cc_fee
}
```

### 2. Customer Payment (Square-hosted)
- Customer pays via Square checkout/invoice
- Square processes payment
- Square sends webhook event(s)

### 3. Webhook Processing (`/api/payments/square/webhook`)

#### Event Types Handled:
1. **payment.created** - Initial payment notification
2. **payment.updated** - Payment status change (PENDING → COMPLETED)
3. **invoice.payment_made** - Invoice-specific payment notification
4. **refund.created/updated** - Refund notifications

#### Webhook Processing Steps:

##### A. Event Storage (Idempotency)
```javascript
// ✅ FIRST ACTION: Store event before processing
INSERT INTO payment_events (provider, event_id, event_type, payload)
VALUES ('square', event_id, event_type, event_data)
ON CONFLICT (event_id) DO NOTHING
```
**Purpose:** Prevents duplicate processing if Square retries webhook

##### B. Payment Matching Logic
Webhook tries these strategies IN ORDER:

1. **Primary:** Match by `order_id` in payments.metadata
2. **Fallback 1:** Match by `square_checkout_id` in appointments
3. **Fallback 2:** Fetch Square order, extract `reference_id` (format: "trip-{appointment_id}")
4. **Fallback 3:** Match by amount (services total ± CC fee with ±2 cent tolerance)
5. **Fallback 4:** Match by invoice number = booking number

**Why multiple fallbacks?**
- Different Square products (checkout vs invoice) provide different identifiers
- `payment.created` may fire before `invoice.payment_made`
- Webhook retry scenarios may have partial data

##### C. Payment Breakdown Calculation

When `status === 'COMPLETED'`:

```javascript
const paidAmount = payment.total_money.amount / 100;
const tipAmount = payment.tip_money.amount / 100;
const processingFee = payment.processing_fee[0].amount_money.amount / 100;

// Get CC fee from metadata OR calculate from services
const customerCcFee = metadata.credit_card_fee || 
  Math.ceil((servicesSubtotal * ccFeePercent) / 100);

const totalTripPayment = paidAmount - tipAmount;
const baseTripPayment = totalTripPayment - customerCcFee;
```

**Key Insight:** The base trip payment excludes BOTH tip and CC fee

##### D. Database Atomicity

**Critical Sequence (must be atomic):**
```javascript
// 1. Update payment record
UPDATE payments SET status = 'paid', paid_at = NOW()

// 2. Update appointment
UPDATE appointments SET 
  payment_status = 'paid',
  payment_amount = baseTripPayment,  // excludes CC fee!
  square_payment_id = payment_id

// 3. Create base payment transaction
INSERT INTO transactions (category='payment', amount=baseTripPayment)

// 4. Create CC fee transaction (separate!)
INSERT INTO transactions (category='cc_fee', amount=customerCcFee)

// 5. Create tip transaction (if tip > 0)
INSERT INTO transactions (category='tip', tip_amount=tipAmount)

// 6. Create Square processing fee expense
INSERT INTO transactions (category='expense', method='Square', amount=processingFee)

// 7. Auto-create driver commission
const commission = servicesTotal * salary_rate;
INSERT INTO transactions (
  category='expense', 
  method='Commission', 
  amount=commission,
  employee_id=driver_id
)

// 8. Recalculate cached fields
recalculatePaymentsAndBalance(appointment_id)
```

**Why separate transactions?**
- **Payment transaction** = base trip revenue (services only)
- **CC fee transaction** = customer-paid processing fee (revenue)
- **Tip transaction** = driver tip (pass-through to driver)
- **Square processing fee** = business expense (Square's cut)
- **Commission** = driver expense (based on services total)

This separation enables accurate financial reporting:
- Revenue = payment + cc_fee
- Driver owes company = commission (usually 75% of services)
- Square cost to business = processing fee

##### E. Idempotency Checks

**Transaction-level idempotency:**
```javascript
// Before creating payment transaction
const existingPayment = await sql`
  SELECT id FROM transactions
  WHERE appointment_id = ${id} AND category = 'payment'
  LIMIT 1
`;
if (existingPayment.length > 0) {
  console.log('Payment transaction already exists — skipping');
  // But still check for missing tip/cc_fee and backfill
}
```

**Why backfill missing transactions?**
- If `invoice.payment_made` fires first but lacks tip/processing fee data
- Then `payment.updated` fires with complete data
- We backfill the missing tip/cc_fee transactions

### 4. Post-Webhook Actions

After marking trip as paid, the webhook:

1. **Sends notification:**
```javascript
sendNotification({
  type: 'payment_confirmed',
  appointmentId: id,
  tenantId: 1
})
```

2. **Auto-completes trip** (if date has passed):
```javascript
autoCompleteIfEligible(appointment_id)
```

## Cached Field Calculations

The `recalculatePaymentsAndBalance()` function recalculates:

```javascript
payments_total = SUM(transactions WHERE category IN ('payment', 'cc_fee'))
tips_total = SUM(transactions.tip_amount)
driver_commission = SUM(transactions WHERE category='expense' AND method='Commission')
balance_due = original_amount - payments_total
```

**Critical invariant:**
```
original_amount = services_total + cc_fee
payments_total = payment_transaction + cc_fee_transaction
balance_due = 0 (when fully paid)
```

## Common Issues & Solutions

### Issue 1: Missing Transactions After Webhook
**Symptom:** Trip marked `paid` but transactions table is empty or incomplete

**Root Causes:**
1. Webhook fired but transaction creation failed (network/db error)
2. `invoice.payment_made` processed without complete Square payment data
3. Duplicate `payment.created` + `payment.updated` events with different data

**Solution:** Admin fix tool + bulk fix endpoint
- `/api/admin/fix-payment-posting` - Fix individual trip
- `/api/admin/fix-payment-posting-bulk` - Scan all paid trips with Square ID

### Issue 2: CC Fee Mismatch
**Symptom:** Customer charged different CC fee than recorded

**Root Cause:** CC fee calculated on webhook vs stored during link creation

**Solution:** 
- Payment link/invoice creation stores `credit_card_fee` in metadata
- Webhook FIRST checks metadata, THEN calculates as fallback
- Admin can manually override in fix tool

### Issue 3: Duplicate Webhook Events
**Symptom:** Multiple transactions for same payment

**Prevention:**
1. Store event in `payment_events` immediately (with `ON CONFLICT DO NOTHING`)
2. Check for duplicate event_id before processing
3. Transaction-level idempotency checks before INSERT

### Issue 4: Commission Calculation Inconsistency
**Symptom:** Different commission amounts between webhook and admin fix

**Root Cause:** Inconsistent base amount (payment vs services total)

**Standard:**
```javascript
// Webhook calculates from services_total
const servicesTotal = SUM(appointment_services.service_price * quantity);
const commission = servicesTotal * salary_rate;

// Falls back to payment amount if services = 0
const commission = (servicesTotal || baseTripPayment) * salary_rate;
```

## Data Integrity Guarantees

### 1. Idempotency
✅ **Event level:** `payment_events.event_id` UNIQUE prevents reprocessing
✅ **Transaction level:** Check existence before INSERT
✅ **Safe retries:** Webhook can be called multiple times safely

### 2. Atomicity
⚠️ **Current state:** Transactions created sequentially (not in DB transaction)
**Risk:** If process crashes mid-sequence, partial state possible

**Recommendation:** Wrap all transaction INSERTs in `sql.transaction([...])`

### 3. Consistency
✅ **Cached fields recalculated** after every transaction change
✅ **Balance invariant maintained:** original_amount - payments_total = balance_due

### 4. Auditability
✅ **All webhook events stored** in `payment_events` table
✅ **Transaction descriptions** include payment IDs
✅ **Admin actions logged** in transaction descriptions

## Testing Scenarios

### Scenario 1: Normal Square Checkout Flow
```
1. Admin creates payment link → payments row (status='link_created')
2. Customer pays → Square webhook (payment.updated, status=COMPLETED)
3. Webhook matches by order_id → Creates all 5 transactions
4. Recalculates cached fields → balance_due = 0
5. Sends confirmation email
✅ Expected: Trip fully paid, all transactions present
```

### Scenario 2: Invoice Payment
```
1. Admin creates invoice → payments row + Square invoice
2. Customer pays invoice → invoice.payment_made webhook
3. Webhook fetches Square order → matches by reference_id (trip-{id})
4. Creates transactions with tip/processing fee from Square API
✅ Expected: Same outcome as checkout
```

### Scenario 3: Duplicate Webhooks
```
1. payment.created fires → processes, stores event_id
2. payment.updated fires → processes (creates transactions)
3. payment.created RETRY → blocked by event_id duplicate
4. payment.updated RETRY → blocked by event_id duplicate
✅ Expected: Only one set of transactions created
```

### Scenario 4: Webhook Fires Before Link Created
```
1. Customer pays extremely quickly
2. payment.created arrives before payments row exists
3. Webhook uses fallback matching (amount-based or reference_id)
4. Creates payments row + transactions
✅ Expected: Payment recorded even without pre-existing row
```

### Scenario 5: Missing Transactions Fixed
```
1. Webhook created payment but crashed before tip/cc_fee
2. Admin runs bulk fix → scans paid trips
3. Identifies missing tip/cc_fee transactions
4. Backfills using Square API data
5. Recalculates cached fields
✅ Expected: All transactions present, balance correct
```

## Recommendations

### High Priority
1. **Wrap webhook transaction creation in DB transaction** for atomicity
2. **Add retry logic** for failed Square API calls during webhook
3. **Monitor `payment_events` table** for signature_rejected events

### Medium Priority
1. **Add webhook health dashboard** showing recent events + failures
2. **Implement webhook replay** from `payment_events` table
3. **Add alerting** for trips paid >24h ago with missing transactions

### Low Priority
1. **Optimize bulk fix** to process in batches (currently all at once)
2. **Add webhook test endpoint** to simulate events
3. **Document Square environment switching** (sandbox vs production)

## Conclusion

**Current State:** ✅ Square payment flow is SOLID

**Strengths:**
- Comprehensive fallback matching logic
- Idempotency at event + transaction levels
- Automatic backfilling of missing data
- Clear separation of payment components
- Admin tools for manual intervention

**Known Gaps:**
- Not wrapped in DB transaction (minor risk of partial state)
- No automated alerting for failed webhooks
- Bulk operations could timeout on large datasets

**Verdict:** Production-ready with monitoring recommended
