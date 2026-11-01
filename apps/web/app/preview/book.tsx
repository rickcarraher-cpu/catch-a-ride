import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { requireDashboardPreview } from '../lib/recovered-dashboard.server';
import { DispatchBookingWizard } from '../../src/components/Trips/TripModal/DispatchBookingWizard';
import { SAMPLE_SERVICES } from './wizard-samples';
import { STORAGE_KEY, sampleWorkspace, decodeWorkspace } from './workspace-model';
import './dashboard.css';
import './book.css';
export function loader() { requireDashboardPreview(); return null; }
export function headers() { return { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }; }
export default function OriginalBookingPreview() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  const [workspace, setWorkspace] = useState<ReturnType<typeof sampleWorkspace> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); setWorkspace(raw ? decodeWorkspace(raw) : sampleWorkspace()); }
    catch { setError('Browser sample data could not be loaded. Return to the sample workspace and reset it.'); }
    return () => client.clear();
  }, [client]);
  return <main className="original-booking-preview">
    <aside className="original-booking-warning"><strong>SAMPLE MODE — Original Book A Ride screens</strong><span>Sample details only. Prices/settings are examples, not live rates. Saves stay in this browser. Payments, emails and texts are disconnected.</span></aside>
    {error ? <p role="alert">{error}</p> : !workspace ? <p>Loading original booking wizard…</p> : <QueryClientProvider client={client}>
      <DispatchBookingWizard clients={[]} drivers={workspace.drivers} services={SAMPLE_SERVICES} onClose={() => { window.location.href = '/preview/dashboard'; }} onSuccess={() => { window.location.href = '/preview/workspace'; }} />
    </QueryClientProvider>}
  </main>;
}
