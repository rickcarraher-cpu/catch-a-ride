import BookingButton from "../src/components/BookingButton";
import StatusMessage from "../src/components/StatusMessage";
import PhoneLink from "../src/components/PhoneLink";
import HoursInfo from "../src/components/HoursInfo";
import ServiceArea from "../src/components/ServiceArea";
import ContactEmail from "../src/components/ContactEmail";

export default function Page() {
  return (
    <div>
      <h1>Catch A Ride</h1>
      <p>The page is loading.</p>
      <p>Book a ride or check your booking status.</p>
      <BookingButton />
      <StatusMessage />
      <PhoneLink />
      <HoursInfo />
      <ServiceArea />
      <ContactEmail />
    </div>
  );
}
