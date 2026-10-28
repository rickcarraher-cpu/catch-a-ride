# Timesheet Report Page - Critical Fixes

## Issue 1: Edit Button Opens Blank Trip
**Problem**: Clicking "Edit" passes the minimal trip object (from the summary) instead of fetching the full trip data with all relationships.

**Fix Location**: Around line 990+ where driversWithTrips.map renders DriverSection components.

**ADD this handler function** (before the return statement in the main component):
```javascript
const [editingTrip, setEditingTrip] = useState(null);
const [isModalOpen, setIsModalOpen] = useState(false);

const handleEditTrip = async (tripId) => {
  try {
    const response = await fetch(`/api/appointments/${tripId}`);
    if (!response.ok) throw new Error('Failed to fetch trip');
    const tripData = await response.json();
    setEditingTrip(tripData);
    setIsModalOpen(true);
  } catch (err) {
    console.error('Failed to open trip:', err);
    alert('Could not load trip details');
  }
};

const handleModalClose = () => {
  setIsModalOpen(false);
  setEditingTrip(null);
  queryClient.invalidateQueries({ queryKey: ["timesheets"] });
};

const handleModalSuccess = async () => {
  setIsModalOpen(false);
  setEditingTrip(null);
  await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
};
```

**UPDATE the DriverSection component calls** to pass the handler:
```javascript
<DriverSection
  key={d.driver.id}
  driver={d}
  onEditTrip={handleEditTrip}  // Pass the ID, not the trip object
  onRefreshData={() => queryClient.invalidateQueries({ queryKey: ["timesheets"] })}
/>
```

**UPDATE the Edit buttons** in DriverSection (line ~271 and ~284):
Change from:
```javascript
onClick={() => onEditTrip(trip)}
```
To:
```javascript
onClick={() => onEditTrip(trip.id)}
```

**ADD the TripModal** at the end of the main component (before closing divs):
```javascript
{isModalOpen && editingTrip && (
  <Suspense fallback={
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
      </div>
    </div>
  }>
    <TripModal
      key={`trip-${editingTrip.id}`}
      trip={editingTrip}
      clients={[]} // Will be loaded by TripModal
      drivers={[]} // Will be loaded by TripModal
      services={[]} // Will be loaded by TripModal
      onClose={handleModalClose}
      onSuccess={handleModalSuccess}
    />
  </Suspense>
)}
```

---

## Issue 2: Trips Showing as Unpaid When Balance is $0
**Problem**: Using `trip.paid` flag instead of checking `balance_due` amount.

**Fix Location**: DriverSection component, around line 120

**REPLACE**:
```javascript
const paidTrips = trips.filter((t) => t.paid);
const unpaidTrips = trips.filter((t) => !t.paid);
```

**WITH**:
```javascript
// Use balance_due to determine paid status (more accurate)
const paidTrips = trips.filter((t) => {
  const balanceDue = parseFloat(t.balance_due);
  return !isNaN(balanceDue) ? balanceDue <= 0 : t.paid;
});
const unpaidTrips = trips.filter((t) => {
  const balanceDue = parseFloat(t.balance_due);
  const isPaid = !isNaN(balanceDue) ? balanceDue <= 0 : t.paid;
  return !isPaid;
});
```

---

## Testing
After making these changes:
1. Navigate to the Timesheet Report page
2. Click "Edit" on any trip → should load the full trip data
3. Check that trips with $0 balance show in the "Paid" section
4. Check that trips with balance > $0 show in the "Unpaid" section
