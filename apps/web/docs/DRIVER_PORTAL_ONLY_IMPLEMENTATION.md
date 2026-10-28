# Driver Portal Only Mode - Implementation Guide

## Summary
Added a feature toggle to stop sending automatic confirmations (email and SMS) to drivers when trips are assigned. When enabled, drivers must use the portal to view their schedule and accept/reject trips. Direct/manual messages from admin still work as normal.

## Changes Made

### 1. Backend Logic ✅ COMPLETE
**File:** `/apps/web/src/app/api/utils/confirmations/confirmationService.js`

- Added check for `driver_portal_only` setting (defaults to "no" - OFF)
- When set to "yes", driver email and SMS notifications are skipped
- Added logging to explain when notifications are skipped
- Passenger notifications continue to work normally
- Office notifications continue to work normally
- Direct/manual messages (not automatic confirmations) still work

### 2. Settings UI Toggle ⚠️ NEEDS MANUAL UPDATE  
**File:** `/apps/web/src/app/settings/page.jsx`

Add this toggle in the Notifications section, between the "Send Texts" toggle (line ~527) and the "Require Login" toggle (line ~534):

```jsx
{/* Driver Portal Only Mode toggle */}
<div className="flex items-center justify-between pt-2 border-t border-gray-100">
  <div>
    <p className="text-sm font-medium text-gray-700">
      Driver Portal Only Mode
    </p>
    <p className="text-xs text-gray-400">
      Stop auto-confirmations to drivers — they must check portal to accept/reject trips
    </p>
  </div>
  <button
    type="button"
    onClick={() =>
      handleUpdate(
        "driver_portal_only",
        settings?.driver_portal_only === "yes" ? "no" : "yes",
      )
    }
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      settings?.driver_portal_only === "yes"
        ? "bg-orange-500"
        : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        settings?.driver_portal_only === "yes"
          ? "translate-x-6"
          : "translate-x-1"
      }`}
    />
  </button>
</div>
{settings?.driver_portal_only === "yes" && (
  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
    <p className="text-xs text-orange-800 font-medium">
      🚫 Driver auto-confirmations are OFF — drivers must use the portal to view their schedule. Direct messages from admin still work.
    </p>
  </div>
)}
```

## How It Works

1. **Default State (driver_portal_only = "no" or not set)**
   - Drivers receive email and SMS confirmations when trips are assigned/changed
   - Normal behavior, no changes

2. **Portal-Only Mode (driver_portal_only = "yes")**
   - NO automatic email confirmations to drivers
   - NO automatic SMS confirmations to drivers  
   - Drivers must log into the portal to see their schedule
   - Drivers must accept/reject trips through the portal
   - Direct messages from admin (manual sends) still work

3. **What Still Works**
   - Passenger notifications (email & SMS)
   - Office notifications (email)
   - Location notifications (email)
   - Direct/manual messages from admin to drivers
   - All portal functionality

## Testing

1. Go to Settings → General → Notifications
2. Toggle "Driver Portal Only Mode" ON
3. Create/edit a trip and assign a driver
4. Verify: NO email/SMS sent to driver automatically
5. Verify: Passenger still receives confirmation
6. Verify: Trip appears in driver portal
7. Toggle OFF and verify notifications resume

## Database

The setting is stored in the `settings` table:
- **key:** `driver_portal_only`
- **value:** `"yes"` (enabled) or `"no"` (disabled, default)

No database migration needed - the settings system handles new keys automatically.
