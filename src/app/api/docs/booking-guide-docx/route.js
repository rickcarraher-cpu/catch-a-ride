export async function GET(request) {
  try {
    // Create Word document content in HTML format that Word can import
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Booking Guide - CatchARide</title>
  <style>
    body {
      font-family: Calibri, Arial, sans-serif;
      line-height: 1.6;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 1in;
    }
    h1 {
      color: #2563eb;
      font-size: 28pt;
      margin-bottom: 0.5em;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 0.3em;
    }
    h2 {
      color: #1e40af;
      font-size: 18pt;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      page-break-after: avoid;
    }
    h3 {
      color: #3b82f6;
      font-size: 14pt;
      margin-top: 1em;
      margin-bottom: 0.3em;
      page-break-after: avoid;
    }
    h4 {
      color: #60a5fa;
      font-size: 12pt;
      margin-top: 0.8em;
      margin-bottom: 0.3em;
      page-break-after: avoid;
    }
    p {
      margin: 0.5em 0;
      font-size: 11pt;
    }
    ul {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }
    li {
      margin: 0.3em 0;
      font-size: 11pt;
    }
    .tip-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 1em;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    .tip-title {
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 0.5em;
    }
    .step-box {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 1em;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    .intro {
      font-size: 12pt;
      color: #4b5563;
      margin-bottom: 2em;
    }
    .footer {
      margin-top: 3em;
      padding-top: 1em;
      border-top: 2px solid #e5e7eb;
      font-size: 10pt;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>📖 Booking Guide</h1>
  <p class="intro">
    Welcome! This guide will walk you through the entire booking process step-by-step. 
    Follow these instructions to book your ride quickly and easily.
  </p>

  <h2>💡 Helpful Tips Before You Start</h2>

  <div class="tip-box">
    <div class="tip-title">⏰ Book Early for Airport Trips</div>
    <p>For airport pickups, we recommend scheduling your ride 2-3 hours before your flight departure time to account for traffic and check-in.</p>
  </div>

  <div class="tip-box">
    <div class="tip-title">✅ Round-Trip Convenience</div>
    <p>Booking a round-trip saves time and ensures your return ride is scheduled. Your pickup and dropoff locations are automatically reversed.</p>
  </div>

  <div class="tip-box">
    <div class="tip-title">ℹ️ Flight Tracking</div>
    <p>When you provide your flight information, we can track your flight and adjust pickup times if there are delays.</p>
  </div>

  <div class="tip-box">
    <div class="tip-title">⚠️ Special Requests</div>
    <p>Need extra help with luggage? Have specific pickup instructions? Add them in the special requests field so your driver is prepared.</p>
  </div>

  <h2>📋 Step-by-Step Booking Instructions</h2>

  <div class="step-box">
    <h3>Step 1: Your Information</h3>
    
    <h4>Enter your name</h4>
    <ul>
      <li>Enter your full name so we know who to pick up</li>
      <li>This will be saved for future bookings</li>
    </ul>

    <h4>Contact information</h4>
    <ul>
      <li><strong>Phone number:</strong> We'll use this to contact you about your trip</li>
      <li><strong>Email (optional):</strong> For booking confirmations and receipts</li>
    </ul>
  </div>

  <div class="step-box">
    <h3>Step 2: Contact Preferences & Trip Type</h3>
    
    <h4>How should we contact you?</h4>
    <ul>
      <li><strong>Email & SMS:</strong> Get confirmations via both email and text message</li>
      <li><strong>Email Only:</strong> Receive confirmations only via email</li>
      <li><strong>SMS Only:</strong> Receive confirmations only via text message</li>
      <li><strong>None:</strong> No confirmations (not recommended)</li>
    </ul>

    <h4>Choose your trip type</h4>
    <ul>
      <li><strong>One-Way:</strong> Single trip from pickup to destination</li>
      <li><strong>Round-Trip:</strong> Book both your outgoing and return trips at once</li>
    </ul>

    <h4>Round-trip benefits</h4>
    <ul>
      <li>Book both trips together and save time</li>
      <li>Your pickup and dropoff locations are automatically reversed for the return trip</li>
      <li>Ensures your return ride is scheduled</li>
    </ul>
  </div>

  <div class="step-box">
    <h3>Step 3: When Do You Need a Ride?</h3>
    
    <h4>Select your pickup date and time</h4>
    <ul>
      <li>Choose the date from the calendar</li>
      <li>Enter the time you need to be picked up</li>
      <li>For airport trips, we recommend 2-3 hours before your flight</li>
    </ul>

    <h4>Round-trip return (if applicable)</h4>
    <ul>
      <li>If you selected round-trip, also enter your return date and time</li>
      <li>Both trips will be booked together</li>
    </ul>
  </div>

  <div class="step-box">
    <h3>Step 4: Passengers & Baggage</h3>
    
    <h4>How many passengers?</h4>
    <ul>
      <li>Enter the total number of people traveling</li>
      <li>This helps us assign the right vehicle size</li>
    </ul>

    <h4>Baggage details</h4>
    <ul>
      <li><strong>Checked bags:</strong> Large suitcases that go in the trunk</li>
      <li><strong>Carry-on bags:</strong> Smaller bags you'll keep with you</li>
      <li><strong>Car seats:</strong> Let us know if you need child car seats</li>
      <li><strong>Golf bags:</strong> Special equipment requiring extra space</li>
    </ul>
  </div>

  <div class="step-box">
    <h3>Step 5: Where Are You Going?</h3>
    
    <h4>Pickup location</h4>
    <ul>
      <li>Enter your pickup address (street, city, state, ZIP)</li>
      <li>Or select from common locations like airports or hotels</li>
      <li>Be as specific as possible for accurate pickup</li>
    </ul>

    <h4>Dropoff location</h4>
    <ul>
      <li>Enter your destination address</li>
      <li>Or select from common locations</li>
      <li>For round-trips, these locations will be reversed for your return</li>
    </ul>
  </div>

  <div class="step-box">
    <h3>Step 6: Trip Details</h3>
    
    <h4>Flight information (for airport trips)</h4>
    <ul>
      <li><strong>Outgoing flight:</strong> Enter your flight number and airline</li>
      <li><strong>Return flight:</strong> Enter your return flight details</li>
      <li>This helps us track your flight and adjust pickup time if needed</li>
    </ul>

    <h4>Special requests</h4>
    <ul>
      <li>Add any special instructions for your driver</li>
      <li>Examples: "Please call when you arrive", "Need help with luggage"</li>
    </ul>
  </div>

  <div class="step-box">
    <h3>Step 7: Add-ons (Optional)</h3>
    
    <h4>Additional services</h4>
    <ul>
      <li><strong>Extra stops:</strong> Add stops along the way</li>
      <li><strong>Car seats:</strong> Request child car seats</li>
      <li><strong>Other services:</strong> Any additional services you need</li>
    </ul>

    <h4>Round-trip add-ons</h4>
    <ul>
      <li>For round-trips, choose which leg each add-on applies to</li>
      <li>Options: Outgoing only, Return only, or Both trips</li>
    </ul>
  </div>

  <div class="step-box">
    <h3>Step 8: Review & Pay</h3>
    
    <h4>Review your booking</h4>
    <ul>
      <li>Check all your trip details</li>
      <li>Verify pickup and dropoff locations</li>
      <li>Confirm date and time</li>
      <li>Review the total price</li>
    </ul>

    <h4>Payment</h4>
    <ul>
      <li>You'll receive a payment link after booking</li>
      <li>Pay securely online via credit card</li>
      <li>Or choose to pay with cash, Venmo, or Zelle</li>
    </ul>

    <h4>Confirmation</h4>
    <ul>
      <li>You'll receive a confirmation via your chosen method (email/SMS)</li>
      <li>Your driver will be notified</li>
      <li>You can make changes by contacting us</li>
    </ul>
  </div>

  <h2>📞 Need Help?</h2>
  <div class="tip-box">
    <p>If you have questions while booking, feel free to contact us. We're here to help make your ride as smooth as possible!</p>
  </div>

  <div class="footer">
    <p>CatchARide Limo Service | Booking Guide</p>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
    `.trim();

    // Return as Word document
    return new Response(htmlContent, {
      headers: {
        "Content-Type": "application/vnd.ms-word",
        "Content-Disposition":
          'attachment; filename="CatchARide-Booking-Guide.doc"',
      },
    });
  } catch (error) {
    console.error("Error generating booking guide:", error);
    return Response.json(
      { error: "Failed to generate booking guide" },
      { status: 500 },
    );
  }
}
