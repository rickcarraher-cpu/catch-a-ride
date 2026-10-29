import BookingButton from "../src/components/BookingButton";
import StatusMessage from "../src/components/StatusMessage";
import PhoneLink from "../src/components/PhoneLink";

export default function Page() {
  return (
    <div>
      <h1>Catch A Ride</h1>
      <p>The page is loading.</p>
      <p>Book a ride or check your booking status.</p>
      <BookingButton />
      <StatusMessage />
      <PhoneLink />
    </div>
  );
}
