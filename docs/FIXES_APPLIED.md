# Fixes Applied

## Fix #1: Split Date/Time Inputs in Trip Edit Modal ✅
**File:** `/apps/web/src/components/Trips/TripModal/FormSections/PassengerDriverSection.jsx`
**Change:** Split the combined `datetime-local` input into separate `date` and `time` inputs for better usability
**Status:** COMPLETE

## Fix #2: Schedule Timeline Duration Default ✅  
**File:** `/apps/web/src/app/schedule-timeline/page.jsx` (line 102)
**Change:** Already has `|| 75` default - no change needed
**Status:** ALREADY FIXED

## Fix #3: Schedule Builder Duration Default ⏳
**File:** `/apps/web/src/app/schedule-builder/page.jsx` (line 34)
**Change:** Need to change `|| 0` to `|| 75` in getTripDuration function
**Status:** IN PROGRESS
