import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { requireDashboardPreview } from '../lib/recovered-dashboard.server';
import { STORAGE_KEY, sampleWorkspace, decodeWorkspace, saveTrip, addDriver, removeDriver, emptyTrip } from './workspace-model';
import type { Workspace, Trip } from './workspace-model';
import './workspace.css';

export function loader() { requireDashboardPreview(); return null; }
export function headers() { return { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }; }
export default function TestWorkspace() {
  const [state, setState] = useState<Workspace>(sampleWorkspace);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'trips' | 'drivers'>('trips');
  const [draft, setDraft] = useState<Omit<Trip, 'id'>>(emptyTrip);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setState(decodeWorkspace(raw)); }
    catch { setError('Saved test data could not be loaded. Reset sample data to start again; nothing was changed on the live site.'); }
    setReady(true);
  }, []);
  function persist(next: Workspace, notice: string) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setState(next); setError(''); setMessage(notice); return true;
    } catch { setError('Your browser could not save test data. Changes were not saved. Enable browser storage and try again.'); return false; }
  }
  function submitTrip(event: FormEvent) {
    event.preventDefault();
    try {
      const next = saveTrip(state, editId || crypto.randomUUID(), draft);
      if (persist(next, editId ? 'Test trip updated.' : 'Test trip created.')) { setShowForm(false); setEditId(null); setDraft(emptyTrip); }
    } catch (e) { setError((e as Error).message); }
  }
  function changeStatus(trip: Trip, status: Trip['status']) {
    try { persist(saveTrip(state, trip.id, { ...trip, status }), `Test trip ${status}.`); }
    catch (e) { setError((e as Error).message); }
  }
  const trips = state.trips.filter(t => (filter === 'all' || t.status === filter) && `${t.passenger} ${t.pickup} ${t.dropoff}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="test-workspace">
    <aside className="test-banner"><strong>ISOLATED TEST WORKSPACE — SAMPLE DATA ONLY</strong>
      <p>No login required because no private data is connected. Do not enter real customer details.</p>
      <p>Saved only in this browser on this preview address. Not shared across devices. Payments, email and texts are disabled.</p>
    </aside>
    <div className="test-container">
      <header><div><p className="test-brand">Catch A Ride</p><h1>Practice dashboard</h1></div><Link to="/preview/dashboard">Original layout preview</Link></header>
      <p className="test-disclaimer">Interactive test workflows, not the finished migration. Your live booking site is unchanged.</p>
      <nav aria-label="Test workspace sections"><button aria-pressed={tab === 'trips'} onClick={() => setTab('trips')}>Bookings &amp; Schedule</button><button aria-pressed={tab === 'drivers'} onClick={() => setTab('drivers')}>Drivers</button></nav>
      {message && <p role="status" className="test-success">{message}</p>}{error && <p role="alert" className="test-error">{error}</p>}
      {!ready ? <p>Loading browser test workspace…</p> : <>
      <section className="test-stats" aria-label="Sample trip counts"><p><strong>{state.trips.filter(t => t.status === 'scheduled').length}</strong> Scheduled</p><p><strong>{state.drivers.length}</strong> Sample drivers</p><p><strong>{state.trips.filter(t => t.status === 'completed').length}</strong> Completed</p></section>
      {tab === 'trips' ? <section aria-labelledby="trip-title"><div className="test-section-title"><h2 id="trip-title">Test bookings</h2><button onClick={() => { setDraft(emptyTrip); setEditId(null); setShowForm(true); setError(''); }}>Book a test trip</button></div>
        {showForm && <form onSubmit={submitTrip} className="test-panel"><h3>{editId ? 'Edit test trip' : 'New test trip'}</h3>
          <div className="test-fields">
            <label>Sample passenger<input name="passenger" value={draft.passenger} maxLength={100} required onChange={e => setDraft({ ...draft, passenger: e.target.value })} /></label>
            <label>Pickup<input name="pickup" value={draft.pickup} maxLength={200} required onChange={e => setDraft({ ...draft, pickup: e.target.value })} /></label>
            <label>Destination<input name="destination" value={draft.dropoff} maxLength={200} required onChange={e => setDraft({ ...draft, dropoff: e.target.value })} /></label>
            <label>Pickup date and time (local)<input name="when" type="datetime-local" required value={draft.when} onChange={e => setDraft({ ...draft, when: e.target.value })} /></label>
            <label>Assign sample driver<select value={draft.driverId} onChange={e => setDraft({ ...draft, driverId: e.target.value })}><option value="">Unassigned</option>{state.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label>Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Trip['status'] })}>{['scheduled', 'completed', 'cancelled'].map(s => <option key={s}>{s}</option>)}</select></label>
          </div><div className="test-actions"><button type="submit">Save test trip</button><button type="button" className="test-secondary" onClick={() => setShowForm(false)}>Discard changes</button></div>
        </form>}
        <div className="test-filters"><label>Search test trips<input value={search} onChange={e => setSearch(e.target.value)} /></label><label>Filter status<select value={filter} onChange={e => setFilter(e.target.value)}>{['all', 'scheduled', 'completed', 'cancelled'].map(s => <option key={s}>{s}</option>)}</select></label></div>
        <div className="test-trip-list">{trips.length === 0 && <p>No test trips match.</p>}{trips.map(trip => <article className="test-panel" key={trip.id}><div className="test-section-title"><h3>{trip.passenger}</h3><span className="test-status">{trip.status}</span></div>
          <p>{trip.pickup} → {trip.dropoff}</p><p>Pickup: {trip.when.replace('T', ' ')} (local)</p><p>Driver: {state.drivers.find(d => d.id === trip.driverId)?.name || 'Unassigned'}</p>
          <div className="test-actions"><button aria-label={`Edit ${trip.passenger}`} onClick={() => { setDraft({ ...trip }); setEditId(trip.id); setShowForm(true); }}>Edit / assign driver</button>
            {trip.status === 'scheduled' && <><button className="test-secondary" aria-label={`Complete ${trip.passenger}`} onClick={() => changeStatus(trip, 'completed')}>Mark completed</button><button className="test-danger" aria-label={`Cancel ${trip.passenger}`} onClick={() => changeStatus(trip, 'cancelled')}>Cancel test trip</button></>}
          </div></article>)}</div>
      </section> : <section><h2>Sample drivers</h2><form className="test-panel" onSubmit={e => { e.preventDefault(); try { if (persist(addDriver(state, crypto.randomUUID(), driverName), 'Sample driver added.')) setDriverName(''); } catch (e) { setError((e as Error).message); } }}><label>New sample driver name<input required maxLength={80} value={driverName} onChange={e => setDriverName(e.target.value)} /></label><button type="submit">Add sample driver</button></form>
        {state.drivers.map(d => <article className="test-panel" key={d.id}><h3>{d.name}</h3><p>{state.trips.filter(t => t.driverId === d.id && t.status === 'scheduled').length} scheduled test trips</p><button className="test-danger" aria-label={`Remove ${d.name}`} onClick={() => { try { persist(removeDriver(state, d.id), 'Sample driver removed.'); } catch (e) { setError((e as Error).message); } }}>Remove sample driver</button></article>)}
      </section>}
      <section className="test-panel"><h2>Disconnected services</h2><p>Payments, invoicing, email and SMS are not connected. No charges or notifications can be sent from this workspace.</p></section>
      <footer>{!resetting ? <button className="test-secondary" onClick={() => setResetting(true)}>Reset sample data</button> : <div><p>Replace all trips and drivers in this browser workspace with the original samples?</p><div className="test-actions"><button className="test-danger" onClick={() => { if (persist(sampleWorkspace(), 'Sample data reset.')) { setResetting(false); setShowForm(false); setSearch(''); setFilter('all'); } }}>Confirm reset</button><button className="test-secondary" onClick={() => setResetting(false)}>Keep my test data</button></div></div>}</footer>
      </>}
    </div>
  </main>;
}
