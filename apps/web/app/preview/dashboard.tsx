import { useEffect, useState } from "react";
import { TripsTable } from "../../src/components/Trips/TripsTable";
import { STORAGE_KEY, decodeWorkspace, sampleWorkspace } from "./workspace-model";
import type { Workspace } from "./workspace-model";
import { WIZARD_KEY } from "./wizard-samples";
import { Link, useLoaderData } from "react-router";
import { renderRecoveredDashboard, requireDashboardPreview } from "../lib/recovered-dashboard.server";
import "./dashboard.css";

export function loader() {
  requireDashboardPreview();
  return { markup: renderRecoveredDashboard() };
}

export default function RecoveredDashboardPreview() {
  const { markup } = useLoaderData<typeof loader>();
  const [samples, setSamples] = useState<Workspace | null>(null);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setSamples(raw ? decodeWorkspace(raw) : sampleWorkspace());
      const wizard = localStorage.getItem(WIZARD_KEY);
      if (wizard) { const data = JSON.parse(wizard); if (Array.isArray(data.appointments)) setRecords(data.appointments); }
    } catch { setNotice("Browser sample data could not be loaded. Your live data is unchanged."); }
  }, []);
  const trips = (samples?.trips || []).map(trip => {
    const original = records.find(record => record.id === trip.id) || {};
    return { ...original, id: trip.id, client_name: trip.passenger,
      display_short_date: trip.when.slice(0, 10), display_time: trip.when.slice(11),
      start_time: `${trip.when}:00`, pickup_address: trip.pickup, dropoff_address: trip.dropoff,
      employee_name: samples?.drivers.find(driver => driver.id === trip.driverId)?.name || 'Unassigned',
      status: trip.status, booking_number: original.booking_number || 'SAMPLE',
      payment_status: 'unpaid', balance_due: 0, total_price: 0,
    };
  });
  const disconnected = () => setNotice("This action is not connected in sample mode. No payment, message or database change was made.");
  return <main className="recovery-preview">
    <aside className="recovery-notice" aria-label="Preview limitations">
      <strong>Original dashboard · Isolated sample mode</strong>
      <p>Original layout with working sample booking links and browser-saved trips below.
        Other dashboard controls remain disabled. No live database, charges, emails or texts are connected.</p>
      <p><Link to="/preview/book">Book a Trip — original wizard (sample mode)</Link></p>
      <p><Link to="/preview/workspace">Open interactive sample workspace</Link></p>
      <Link to="/account/signin">Return to protected sign-in</Link>
    </aside>
    <div className="recovered-layout" dangerouslySetInnerHTML={{ __html: markup }} />
    <section id="sample-trips" className="dashboard-sample-trips" aria-labelledby="sample-trips-title">
      <h2 id="sample-trips-title">Sample bookings — all dates</h2>
      <p>Original trip table, browser sample records only. Displayed balances are placeholders, not verified prices. Editing and other actions are not connected here yet.</p>
      <Link to="/preview/book">Book a Trip</Link>
      {notice && <p role="status">{notice}</p>}
      <TripsTable trips={trips} isLoading={!samples} error={null} onEdit={disconnected} onDelete={disconnected} onInvoice={disconnected} onPay={disconnected} />
    </section>
  </main>;
}

export function headers() {
  return { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
}
