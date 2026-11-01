import { Link, useLoaderData } from "react-router";
import { renderRecoveredDashboard, requireDashboardPreview } from "../lib/recovered-dashboard.server";
import "./dashboard.css";

export function loader() {
  requireDashboardPreview();
  return { markup: renderRecoveredDashboard() };
}

export default function RecoveredDashboardPreview() {
  const { markup } = useLoaderData<typeof loader>();
  return <main className="recovery-preview">
    <aside className="recovery-notice" aria-label="Preview limitations">
      <strong>Recovered dashboard · View only</strong>
      <p>Original October 27 layout. No customer data is loaded. Buttons and links are disabled.
        Booking, drivers, payments and email are not connected or verified.</p>
      <p><Link to="/preview/book">Book a Trip — original wizard (sample mode)</Link></p>
      <p><Link to="/preview/workspace">Open interactive sample workspace</Link></p>
      <Link to="/account/signin">Return to protected sign-in</Link>
    </aside>
    <div className="recovered-layout" dangerouslySetInnerHTML={{ __html: markup }} />
  </main>;
}

export function headers() {
  return { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
}
