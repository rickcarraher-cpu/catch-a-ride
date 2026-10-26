# ICS Calendar Link Fields Reference

## Overview
The calendar link system generates two separate ICS files:
- **Passenger Version**: `/api/appointments/[id]/ics?recipient=passenger`
- **Driver Version**: `/api/appointments/[id]/ics?recipient=driver`

Both versions include all required fields, with Driver Notes appearing **only** in the driver version.

---

## ✅ Required Fields (All Included)

### 1. **Passenger Name**
- Field: `Passenger: [name]`
- Source: `app.client_name`
- Always included

### 2. **Driver Name**
- Field: `Driver: [name]`
- Source: `app.employee_name`
- Shows "TBD" if not assigned

### 3. **Pickup Time**
- Field: `Date/Time: [formatted datetime]`
- Source: `app.display_full_datetime`
- Example: "Friday, January 17, 2025 at 2:30 PM"

### 4. **Return Date**
- Field: `Return Date: [formatted date]`
- Source: `app.return_date` → `app.display_return_date`
- **Only shown if set** (conditional display)

### 5. **Phone**
- Field: `Phone: [number]`
- Source: `app.client_phone`
- Passenger phone number

### 6. **Pickup Location**
- Field: `Pickup: [address]`
- Source: `app.display_pickup_address` or `app.pickup_address`
- Full formatted address

### 7. **Dropoff Location**
- Field: `Dropoff: [address]`
- Source: `app.display_dropoff_address` or `app.dropoff_address`
- Full formatted address

### 8. **# of Passengers**
- Field: `# of Passengers: [count]`
- Source: `app.num_people`
- Only shown if set

### 9. **Baggage**
- Field: `Bags: [checked] checked / [carry-on] carry-on`
- Source: `app.num_bags_checked`, `app.num_bags_carry_on`
- Example: "Bags: 2 checked / 1 carry-on"
- Only shown if at least one bag count is set

### 10. **Car Seats**
- Field: `Car Seats: [count]`
- Source: `app.num_car_seats`
- Only shown if set

### 11. **Golf Bags**
- Field: `Golf Bags: [count]`
- Source: `app.num_golf_bags`
- Only shown if set

### 12. **Outgoing Flight**
- Field: `Outgoing Flight: [flight info]`
- Source: `app.outgoing_flight_info`
- Example: "American #123, departs 2:30pm, Gate B12"
- Only shown if set

### 13. **Return Flight Info**
- Field: `Returning Flight: [flight info]`
- Source: `app.returning_flight_info`
- Example: "Allegiant #331, arrives 2:00pm from Aruba"
- Only shown if set

### 14. **Passenger Notes**
- Field: `Notes: [notes]`
- Source: `app.notes`
- Included in **both** passenger and driver versions
- Only shown if set

### 15. **Driver Notes** ⚠️
- Field: `Driver Notes: [notes]`
- Source: `app.driver_notes`
- **ONLY included in driver version** (`?recipient=driver`)
- **NOT shown to passengers**
- Only shown if set

---

## Additional Fields Included

The ICS file also includes these helpful fields:

- **Booking Number**: `Booking #[number]`
- **Status**: Trip status (confirmed, tentative, etc.)
- **Vehicle**: Vehicle name/type
- **Service**: Service type (Airport Transfer, etc.)
- **Email**: Passenger email
- **Destination**: Trip destination (if different from dropoff)
- **International Flight**: Flag for international trips
- **Customs Clearance**: Location for customs (international flights)
- **Booked By**: Who created the booking
- **Dispatcher**: Dispatcher name (if applicable)
- **Confirmation Status**: Driver/passenger confirmation status
- **Contact Info**: Business phone number
- **Trip Details Link**: Direct link to view full trip details
- **Confirmation Link**: Link to confirm trip (if applicable)

---

## Format Details

### Plain Text Description
All fields appear in the `DESCRIPTION` field of the ICS file as plain text, formatted for maximum compatibility with all calendar apps.

### HTML Description (X-ALT-DESC)
The same fields are also included in HTML format for calendar apps that support rich formatting (like Google Calendar). This provides:
- **Bold labels** for field names
- **Clickable links** for trip details and confirmation
- **Line breaks** for better readability

### Location Field
The pickup address is set as the `LOCATION` field, allowing users to:
- Tap to open in Google Maps (mobile)
- Tap to open in Apple Maps (iOS)
- Get directions directly from the calendar event

---

## Usage

### Passenger Calendar Link
```
/api/appointments/[id]/ics?recipient=passenger
```
- Includes all fields **except** Driver Notes
- Event title: "[Business Name] — [Service]"
- Example: "Catch A Ride — Airport Transfer"

### Driver Calendar Link
```
/api/appointments/[id]/ics?recipient=driver
```
- Includes **all fields including Driver Notes**
- Event title: "[Passenger Name] — [Service]"
- Example: "John Smith — Airport Transfer"

---

## Conditional Display Logic

Fields only appear when they have values:
- ✅ **Return Date**: Only if `app.return_date` is set
- ✅ **Baggage**: Only if checked or carry-on count > 0
- ✅ **Car Seats**: Only if count > 0
- ✅ **Golf Bags**: Only if count > 0
- ✅ **Flight Info**: Only if flight details are provided
- ✅ **Notes**: Only if notes exist
- ✅ **Driver Notes**: Only if notes exist AND recipient is driver

This keeps the calendar event clean and focused on relevant information.

---

## Testing

To test the calendar links:

1. **Create a test trip** with all fields populated
2. **Download passenger version**: 
   - Navigate to `/passenger/trip/[token]`
   - Click "Add to Calendar" or "Download .ics"
3. **Download driver version**:
   - Navigate to `/driver/trip/[token]`
   - Click "Add to Calendar" or "Download .ics"
4. **Verify**:
   - Passenger version should NOT show Driver Notes
   - Driver version SHOULD show Driver Notes
   - All other fields should appear in both versions

---

## Summary

✅ **All 15 required fields are included**
✅ **Driver Notes only appear in driver version**
✅ **Return Date only appears when set**
✅ **Conditional fields only show when populated**
✅ **Both plain text and HTML formats supported**
✅ **Separate passenger and driver versions**
✅ **Pickup location set as calendar location for easy navigation**
