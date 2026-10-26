# ICS Calendar Link Testing Guide

## Quick Test Checklist

### ✅ Test 1: Verify All Fields Appear

1. **Create a test trip** with these fields populated:
   - Passenger Name: "John Smith"
   - Driver Name: "Jane Driver"
   - Pickup Time: Any future date/time
   - Return Date: Set a return date
   - Phone: "615-555-1234"
   - Pickup Location: "123 Main St, Nashville, TN 37201"
   - Dropoff Location: "Nashville International Airport"
   - # of Passengers: 3
   - Checked Bags: 2
   - Carry-on Bags: 1
   - Car Seats: 1
   - Golf Bags: 2
   - Outgoing Flight: "American #123, departs 2:30pm"
   - Return Flight: "Delta #456, arrives 5:00pm"
   - Passenger Notes: "Need extra trunk space"
   - Driver Notes: "Use back entrance" ⚠️

2. **Download both calendar versions**:
   - Passenger: `/api/appointments/[id]/ics?recipient=passenger`
   - Driver: `/api/appointments/[id]/ics?recipient=driver`

3. **Open both .ics files in a text editor** and verify:
   - ✅ Passenger version does NOT contain "Driver Notes: Use back entrance"
   - ✅ Driver version DOES contain "Driver Notes: Use back entrance"
   - ✅ Both versions contain all other fields

---

### ✅ Test 2: Verify Conditional Fields

1. **Create a trip WITHOUT**:
   - Return date
   - Baggage
   - Car seats
   - Golf bags
   - Flight info
   - Notes

2. **Download the .ics file**

3. **Verify** these fields do NOT appear:
   - ❌ "Return Date:"
   - ❌ "Bags:"
   - ❌ "Car Seats:"
   - ❌ "Golf Bags:"
   - ❌ "Outgoing Flight:"
   - ❌ "Returning Flight:"
   - ❌ "Notes:"
   - ❌ "Driver Notes:"

4. **Verify** these fields DO appear:
   - ✅ "Passenger:"
   - ✅ "Driver:"
   - ✅ "Date/Time:"
   - ✅ "Phone:"
   - ✅ "Pickup:"
   - ✅ "Dropoff:"

---

### ✅ Test 3: Calendar App Integration

1. **Download passenger .ics file**
2. **Import into Google Calendar**
3. **Click the event** and verify:
   - Event title shows business name + service
   - Description shows all passenger fields
   - Location field is set to pickup address
   - Clicking location opens Google Maps
   - Driver Notes are NOT visible

4. **Download driver .ics file**
5. **Import into Google Calendar** (or Apple Calendar)
6. **Click the event** and verify:
   - Event title shows passenger name + service
   - Description shows all fields INCLUDING Driver Notes
   - Location field is set to pickup address

---

### ✅ Test 4: Return Date Conditional Display

**Test Case A: With Return Date**
1. Create trip with return_date set
2. Download .ics
3. Verify "Return Date: [date]" appears

**Test Case B: Without Return Date**
1. Create trip with return_date = null
2. Download .ics
3. Verify "Return Date:" does NOT appear

---

## Expected ICS File Structure

### Passenger Version Example
```
BEGIN:VCALENDAR
...
BEGIN:VEVENT
SUMMARY:Catch A Ride — Airport Transfer
DESCRIPTION:Booking #26-1234\n
Passenger: John Smith\n
Phone: 615-555-1234\n
\n
Driver: Jane Driver\n
Vehicle: Black Yukon\n
\n
Date/Time: Friday, January 17, 2025 at 2:30 PM\n
Return Date: Saturday, January 18, 2025 at 5:00 PM\n
\n
Pickup: 123 Main St, Nashville, TN 37201\n
Dropoff: Nashville International Airport\n
\n
# of Passengers: 3\n
Bags: 2 checked / 1 carry-on\n
Car Seats: 1\n
Golf Bags: 2\n
\n
Outgoing Flight: American #123, departs 2:30pm\n
Returning Flight: Delta #456, arrives 5:00pm\n
\n
Service: Airport Transfer\n
\n
Notes: Need extra trunk space\n
\n
Contact Catch A Ride: 615-555-0000\n
Trip Details: https://app.url/booking/123
LOCATION:123 Main St, Nashville, TN 37201
...
END:VEVENT
END:VCALENDAR
```

### Driver Version Example
```
BEGIN:VCALENDAR
...
BEGIN:VEVENT
SUMMARY:John Smith — Airport Transfer
DESCRIPTION:Booking #26-1234\n
Passenger: John Smith\n
Phone: 615-555-1234\n
\n
Driver: Jane Driver\n
Vehicle: Black Yukon\n
\n
Date/Time: Friday, January 17, 2025 at 2:30 PM\n
Return Date: Saturday, January 18, 2025 at 5:00 PM\n
\n
Pickup: 123 Main St, Nashville, TN 37201\n
Dropoff: Nashville International Airport\n
\n
# of Passengers: 3\n
Bags: 2 checked / 1 carry-on\n
Car Seats: 1\n
Golf Bags: 2\n
\n
Outgoing Flight: American #123, departs 2:30pm\n
Returning Flight: Delta #456, arrives 5:00pm\n
\n
Service: Airport Transfer\n
\n
Notes: Need extra trunk space\n
Driver Notes: Use back entrance\n
\n
Contact Catch A Ride: 615-555-0000\n
Trip Details: https://app.url/booking/123
LOCATION:123 Main St, Nashville, TN 37201
...
END:VEVENT
END:VCALENDAR
```

**Key Difference**: Driver version includes "Driver Notes: Use back entrance"

---

## Common Issues & Solutions

### Issue: Driver Notes appear in passenger version
**Solution**: Check that the code uses `isDriver && app.driver_notes` condition

### Issue: Return Date always shows even when null
**Solution**: Verify the conditional check `returnDateDisplay ? ... : ""`

### Issue: Fields appear as "undefined" or "null"
**Solution**: Check the filter at the end removes empty/null values

### Issue: Calendar app doesn't show location
**Solution**: Verify `LOCATION:` field is set in ICS file

---

## Automated Testing (Future)

Consider adding automated tests for:
- [ ] Passenger version excludes driver notes
- [ ] Driver version includes driver notes
- [ ] Return date only appears when set
- [ ] Empty fields are filtered out
- [ ] HTML description matches plain text content
- [ ] Location field is set correctly
- [ ] Event titles differ between passenger/driver versions
