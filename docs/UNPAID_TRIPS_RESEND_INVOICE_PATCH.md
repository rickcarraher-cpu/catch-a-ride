# Unpaid Trips Report - Resend Invoice Button Integration

## Summary
Added a "Send Link" button to each trip row in the unpaid trips report, allowing quick payment link generation without opening the full trip modal.

## Changes Required

### 1. Import ResendInvoiceButton Component
At the top of `/apps/web/src/app/reports/unpaid-trips/page.jsx`, add this import after the existing imports:

```javascript
import { ResendInvoiceButton } from "@/components/Reports/ResendInvoiceButton";
```

### 2. Update the Booking # Column
Find the "Booking #" table cell (around line 419-427) and replace it with:

```javascript
{/* Booking # */}
<td className="px-4 py-3">
  <div className="flex items-center gap-2">
    <button
      onClick={() => handleOpenTrip(trip.id)}
      className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
      title="Click to open trip"
    >
      {trip.booking_number || `#${trip.id}`}
    </button>
    {!isCash && (
      <Suspense fallback={null}>
        <ResendInvoiceButton trip={trip} onSuccess={() => refetch()} />
      </Suspense>
    )}
  </div>
</td>
```

## What This Does
- Adds a "Send Link" button next to each booking number
- Button opens a modal to select payment method (Square/Venmo/Zelle)
- Sends payment link via SMS to the passenger
- Only shows for non-cash trips
- Refreshes the report after sending

## Component Already Exists
The `ResendInvoiceButton` component is already implemented at:
`/apps/web/src/components/Reports/ResendInvoiceButton.jsx`
