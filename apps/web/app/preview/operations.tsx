import { useState } from 'react';
import { useLocation, Link } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import Settings from '../../src/app/settings-2/page';
import Assignments from '../../src/app/schedule-timeline/page';
import { requireDashboardPreview } from '../lib/recovered-dashboard.server';
import './dashboard.css';
import './operations.css';
export function loader() { requireDashboardPreview(); return null; }
export function headers() { return { 'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow' }; }
export default function OriginalOperations() {
  const path = useLocation().pathname;
  const [client] = useState(() => new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}}));
  const [notice,setNotice]=useState('');
  return <main className="sample-operations" onClickCapture={e=>{
    const anchor=(e.target as HTMLElement).closest('a');
    if(anchor && anchor.getAttribute('href') && !anchor.getAttribute('href')!.startsWith('/preview/')) {e.preventDefault();setNotice('This destination is not restored in sample mode.');}
  }}><aside className="recovery-notice"><strong>Original screens · SAMPLE MODE ONLY</strong><p>Browser samples only. No live database or services. Do not enter real credentials. Ordinary settings and assignment saves stay in this browser.</p><p>Messaging, payment, credential, cleanup and unsupported actions are blocked. Timeline trips appear on their booked date; starter sample: November 10, 2026.</p><Link to="/preview/dashboard">Back to original dashboard</Link>{notice&&<p role="status">{notice}</p>}</aside>
  <QueryClientProvider client={client}><Toaster richColors />{path==='/preview/settings'?<Settings/>:<Assignments/>}</QueryClientProvider></main>;
}
