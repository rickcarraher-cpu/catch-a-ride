# ADP Payroll Integration - Code Additions for Earnings Page

## Step 1: Add Import at the top of /apps/web/src/app/earnings/page.jsx

After the existing imports (around line 25), add:

```javascript
import { ADPSubmissionModal } from "@/components/ADPSubmissionModal";
import { Building2 } from "lucide-react";
```

## Step 2: Add State in EarningsPage function

Inside the `EarningsPage()` function, after the existing state declarations (around line 450), add:

```javascript
// ADP Submission Modal state
const [showADPModal, setShowADPModal] = useState(false);
```

## Step 3: Add ADP Button in Header

Find the section with the print button (around line 569-577). It looks like:

```javascript
{report && (
  <button
    onClick={handlePrint}
    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
  >
    <Printer size={16} />
    Print
  </button>
)}
```

Replace it with:

```javascript
{report && (
  <div className="flex items-center gap-2">
    {/* Show ADP button only for "All Drivers" view */}
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

## Step 4: Add Modal Component at the end

At the very end of the component, right before the closing `</>` tag (around line 1060), add:

```javascript
{/* ADP Submission Modal */}
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

## Complete Context

The end of the component should look like:

```javascript
      {/* Trip Edit Modal - unchanged */}
      {isModalOpen && editingTrip && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <TripModal
            trip={editingTrip}
            clients={clients}
            drivers={drivers}
            services={services}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
          />
        </Suspense>
      )}

      {/* ADP Submission Modal */}
      {showADPModal && isAllDrivers && report && (
        <ADPSubmissionModal
          report={report}
          periodLabel={periodLabel}
          startDate={start}
          endDate={end}
          onClose={() => setShowADPModal(false)}
        />
      )}
    </>
  );
}
```

## Summary of Changes

1. **Import**: Added ADPSubmissionModal and Building2 icon
2. **State**: Added showADPModal state variable
3. **Button**: Added "Submit to ADP" button next to print (only shown for All Drivers view)
4. **Modal**: Added ADPSubmissionModal component at end of JSX

The ADP button will only appear when viewing the "All Drivers" report for a specific period. When clicked, it opens a modal that:
- Shows a preview of all driver earnings
- Displays ADP Worker IDs (or fallback to database IDs)
- Allows test mode or live submission
- Shows submission history
- Confirms successful submission
