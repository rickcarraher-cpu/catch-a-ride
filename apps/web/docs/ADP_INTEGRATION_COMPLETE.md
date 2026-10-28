# ADP Payroll Integration - Complete Implementation Guide

## Overview

This integration allows you to submit payroll data directly to ADP from your earnings page. The system automatically formats driver earnings (commission, tips, cash deductions) and sends them to ADP's Pay Data API.

## ✅ What's Already Complete

### 1. **Backend API** (`/api/payroll/adp`)
- ✅ Fully functional ADP Pay Data API integration
- ✅ Authenticates with ADP OAuth2
- ✅ Formats payroll data correctly
- ✅ Records submissions in `payroll_submissions` table
- ✅ Marks cash transactions as deducted
- ✅ Supports test mode (preview without submitting)
- ✅ Uses `adp_worker_id` field or falls back to database ID

### 2. **Database Schema**
- ✅ `employees.adp_worker_id` column exists
- ✅ `payroll_submissions` table for tracking history
- ✅ Cash deduction tracking in transactions

### 3. **Driver Form**
- ✅ ADP Worker ID field is already in the driver modal form
- ✅ Located in driver edit form at `/drivers`
- ✅ Optional field with clear labeling

### 4. **UI Components**
- ✅ `ADPSubmissionModal.jsx` - Complete modal with preview, submission, and history
- ✅ Test page at `/admin/adp-test` to verify integration

## 🔧 Final Integration Steps

### Step 1: Add ADP Button to Main Earnings Page

The earnings page needs three small additions:

1. **Import the modal** (add after line 24):
```javascript
import { ADPSubmissionModal } from "@/components/ADPSubmissionModal";
import { Building2 } from "lucide-react";
```

2. **Add state** (add after line 452 in `EarningsPage()` function):
```javascript
const [showADPModal, setShowADPModal] = useState(false);
```

3. **Add button** (replace the print button section around line 569):
```javascript
{report && (
  <div className="flex items-center gap-2">
    {isAllDrivers && (
      <button
        onClick={() => setShowADPModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Building2 size={16} />
        Submit to ADP
      </button>
    )}
    <button
      onClick={handlePrint}
      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
    >
      <Printer size={16} />
      Print
    </button>
  </div>
)}
```

4. **Add modal** (add before the final `</>` around line 1058):
```javascript
{showADPModal && isAllDrivers && report && (
  <ADPSubmissionModal
    report={report}
    periodLabel={periodLabel}
    startDate={start}
    endDate={end}
    onClose={() => setShowADPModal(false)}
  />
)}
```

**See `/apps/web/docs/earnings-page-adp-patch.txt` for the exact code changes.**

### Step 2: Configure ADP Credentials

Add these environment variables:

```bash
ADP_CLIENT_ID=your_adp_client_id
ADP_CLIENT_SECRET=your_adp_client_secret
ADP_API_URL=https://api.adp.com  # or test environment URL
ADP_COMMISSION_CODE=COMM  # Your commission code in ADP
ADP_TIPS_CODE=TIPS  # Your tips code in ADP
ADP_CASH_DEDUCTION_CODE=CASHDED  # Your cash deduction code
ADP_PAYROLL_GROUP_CODE=DEFAULT  # Your payroll group
ADP_PAYROLL_FILE_NUMBER=001  # Your file number
```

### Step 3: Add ADP Worker IDs to Drivers

For each driver:
1. Go to **Drivers** page
2. Click on a driver
3. Scroll to **"ADP Worker ID"** field
4. Enter their ADP Worker ID (e.g., `EMP-12345`)
5. Save

**If left blank**, the system uses the database ID as fallback.

## 🚀 How to Use

### Testing (Recommended First)

1. Visit `/admin/adp-test`
2. Select a date range
3. Click "Submit to ADP"
4. Click "Test Preview" to verify data without sending
5. Review the formatted data
6. If everything looks good, try "Submit to ADP"

### Production Use

1. Go to **Earnings** page (`/earnings`)
2. Select **"All Drivers"** from driver dropdown
3. Select a time period (month, year, or custom range)
4. Click **"Submit to ADP"** button (blue, next to Print)
5. Review the payroll summary:
   - See all drivers and their earnings
   - Verify ADP Worker IDs
   - Check commission, tips, and cash deductions
6. Click **"Test Preview"** to validate without sending
7. Click **"Submit to ADP"** to send to ADP
8. View **"Submission History"** tab for past submissions

## 📊 What Gets Sent to ADP

For each driver:

| Field | Description | Source |
|-------|-------------|--------|
| Worker ID | ADP employee identifier | `adp_worker_id` or database `id` |
| Commission | Driver earnings | `trip revenue × salary_rate` |
| Tips | Customer tips | Sum of tips from paid trips |
| Cash Deduction | Cash collected by driver | Subtracted from net payroll |
| Net Payroll | Final amount due | `Commission + Tips - Cash` |

## 🔍 Features

### Preview & Validation
- ✅ See exactly what will be sent before submitting
- ✅ Test mode to validate without actual submission
- ✅ Expandable driver details showing full breakdown

### Safety Features
- ✅ Only shows on "All Drivers" view
- ✅ Test mode prevents accidental submissions
- ✅ Confirmation messages
- ✅ Error handling with clear messages

### History & Tracking
- ✅ View past 10 submissions
- ✅ See submission date, driver count, total compensation
- ✅ Stored in `payroll_submissions` table
- ✅ Links back to source data via date range

### Automated Processing
- ✅ Marks cash transactions as deducted
- ✅ Prevents double-deduction
- ✅ Records submission in database
- ✅ Links transactions to payroll submission

## 🛠 Technical Details

### API Endpoint
- **POST** `/api/payroll/adp`
- **Body**: `{ startDate, endDate, testMode }`
- **Response**: Submission summary + ADP response

### Database Tables

**payroll_submissions**
- Tracks each submission to ADP
- Stores response from ADP
- Links to date range submitted

**transactions**
- `cash_deducted_in_payroll` - Boolean flag
- `payroll_submission_id` - Links to submission

### ADP Worker ID Logic
```javascript
// In the backend API:
const workerId = driver.adp_worker_id || driver.id.toString();
```

If `adp_worker_id` is set, it's used. Otherwise, the database ID is used. This makes the system backward compatible.

## 📝 Notes

- **Backward Compatible**: Works even if you don't add ADP Worker IDs
- **Optional Field**: You can leave ADP Worker ID blank for drivers not in ADP yet
- **No Data Loss**: All existing driver data is preserved
- **Safe Testing**: Test mode lets you verify before sending
- **History Tracking**: All submissions are logged for audit trail

## 🎯 Quick Start Checklist

- [ ] Configure ADP environment variables
- [ ] Add ADP Worker IDs to driver records (or leave blank to use database IDs)
- [ ] Test at `/admin/adp-test`
- [ ] Integrate ADP button into earnings page (4 small code changes)
- [ ] Submit test payroll with "Test Preview"
- [ ] Submit real payroll to ADP

## 📞 Support

For issues:
1. Check environment variables are set correctly
2. Verify ADP credentials have API access
3. Test with `/admin/adp-test` page first
4. Check submission history for error messages
5. Review ADP API documentation: https://developers.adp.com/articles/api/pay-data-input-api

---

**Created**: {{CURRENT_DATE}}
**Integration Status**: Complete - Ready for final integration into earnings page
