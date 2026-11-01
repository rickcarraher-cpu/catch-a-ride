import { STORAGE_KEY, decodeWorkspace, sampleWorkspace, saveTrip } from './workspace-model';
export const WIZARD_KEY = 'catcharide-original-wizard-samples-v1';
import { SAMPLE_SETTINGS, sampleSettings } from './sample-settings';
export { SAMPLE_SETTINGS } from './sample-settings';
export const SAMPLE_SERVICES = [{ id: 1, name: 'Airport Transfer', default_price: 50, duration_minutes: 60, is_addon: false }, { id: 2, name: 'Point to Point', default_price: 50, duration_minutes: 60, is_addon: false }];
export const SAMPLE_VEHICLES = [{ id: 1, name: 'Sample Sedan', category: 'Sedan', capacity: 4, is_active: true }];
type SampleClient = { id: string; name: string; email: string; phone: string; street_address: string; city: string; state: string; zip_code: string; notification_preference: string };
type SampleState = { clients: SampleClient[]; appointments: Record<string, unknown>[] };
export function initialWizardSamples(): SampleState {
  return { clients: [{ id: 'sample-client-1', name: 'Sample Passenger', email: 'passenger@example.test', phone: '2025550100', street_address: '100 Sample Street', city: 'Hendersonville', state: 'TN', zip_code: '37075', notification_preference: 'none' }], appointments: [] };
}
export function createSampleFetch(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  const read = (): SampleState => {
    const raw = storage.getItem(WIZARD_KEY);
    if (!raw) return initialWizardSamples();
    const state = JSON.parse(raw);
    if (!Array.isArray(state.clients) || !Array.isArray(state.appointments) || state.clients.length > 200 || state.appointments.length > 200) throw new Error('Reset your isolated sample workspace: saved wizard data is invalid.');
    return state;
  };
  const reply = (data: unknown, status = 200) => Response.json(data, { status });
  return async (input: string, init: RequestInit = {}): Promise<Response> => {
    // Deliberately never calls global fetch. Unsupported routes fail closed.
    if (!input.startsWith('/api/')) return reply({ error: 'External requests are disabled in sample mode.' }, 403);
    const url = new URL(input, 'https://sample.invalid');
    const path = url.pathname; const method = (init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    const state = read();
    const write = () => storage.setItem(WIZARD_KEY, JSON.stringify(state));
    if (method === 'GET' && path === '/api/settings') return reply(sampleSettings(storage));
    if (method === 'GET' && path === '/api/vehicles') return reply(SAMPLE_VEHICLES);
    if (method === 'GET' && path === '/api/vehicles/categories') return reply({ categories: ['Sedan', 'SUV', 'Van'] });
    if (method === 'GET' && ['/api/settings/preferred-locations', '/api/vehicle-assignments', '/api/weddings'].includes(path)) return reply([]);
    if (path === '/api/clients' && method === 'GET') return reply(state.clients);
    if (path === '/api/clients' && method === 'POST') {
      if (state.clients.length >= 200 || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) return reply({ error: 'Use a sample passenger name within the field limits.' }, 400);
      const client = { id: crypto.randomUUID(), name: body.name, phone: String(body.phone || '').slice(0, 40), email: String(body.email || '').slice(0, 254), street_address: String(body.street_address || '').slice(0, 200), city: String(body.city || '').slice(0, 100), state: String(body.state || '').slice(0, 10), zip_code: String(body.zip_code || '').slice(0, 20), notification_preference: 'none' };
      state.clients.push(client); write(); return reply(client, 201);
    }
    if (/^\/api\/clients\/[^/]+$/.test(path) && method === 'PATCH') {
      const client = state.clients.find(c => c.id === path.split('/')[3]);
      if (!client) return reply({ error: 'Sample passenger not found.' }, 404);
      for (const key of ['phone', 'email', 'street_address', 'city', 'state', 'zip_code'] as const) if (body[key] !== undefined) client[key] = String(body[key] || '').slice(0, 254);
      write(); return reply(client);
    }
    if (/^\/api\/clients\/[^/]+\/appointments$/.test(path) && method === 'GET') return reply(state.appointments.filter(a => a.client_id === path.split('/')[3]));
    if (path === '/api/appointments/lookup') {
      if (method === 'GET') {
        const trip = state.appointments.find(a => String(a.booking_number) === url.searchParams.get('booking_number'));
        return trip ? reply(trip) : reply({ error: 'No sample booking found.' }, 404);
      }
      if (method === 'POST') {
        const value = String(body.value || '').toLowerCase();
        const found = value ? state.clients.filter(c => body.type === 'phone' ? c.phone.replace(/\D/g, '').includes(value.replace(/\D/g, '') || 'no-match') : String(c[body.type === 'email' ? 'email' : 'name']).toLowerCase().includes(value)) : [];
        return reply({ found: found.length > 0, client: found[0] || null, all_matches: found });
      }
    }
    if (path === '/api/appointments' && method === 'POST') {
      if (state.appointments.length >= 200) return reply({ error: 'Sample booking limit reached.' }, 400);
      const client = state.clients.find(c => c.id === body.client_id);
      if (!client || typeof body.start_time !== 'string') return reply({ error: 'Sample passenger and pickup time are required.' }, 400);
      const raw = storage.getItem(STORAGE_KEY); const workspace = raw ? decodeWorkspace(raw) : sampleWorkspace();
      const id = crypto.randomUUID();
      const pickup = String(body.pickup_address || [body.pickup_street, body.pickup_city, body.pickup_state, body.pickup_zip].filter(Boolean).join(', ') || 'Not specified');
      const dropoff = String(body.dropoff_address || [body.dropoff_street, body.dropoff_city, body.dropoff_state, body.dropoff_zip].filter(Boolean).join(', ') || body.destination || 'Not specified');
      const driverId = body.employee_id ? String(body.employee_id) : '';
      const next = saveTrip(workspace, id, { passenger: client.name, pickup, dropoff, when: body.start_time.slice(0, 16), driverId, status: 'scheduled' });
      // One authoritative record: save full payload and workspace projection together.
      // Refuse a save on storage failure; no service messages or payments are performed.
      const record = { ...body, id, client_name: client.name, booking_number: `SAMPLE-${state.appointments.length + 1}`, send_notification: false, payment_url: null };
      state.appointments.push(record);
      const previous = storage.getItem(WIZARD_KEY);
      write();
      try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); }
      catch (error) { storage.setItem(WIZARD_KEY, previous || JSON.stringify(initialWizardSamples())); throw error; }
      return reply(record, 201);
    }
    return reply({ error: 'This operation is disconnected in sample mode. No payment, email, SMS or external request was made.' }, 501);
  };
}
export async function sampleFetch(input: string, init?: RequestInit) {
  if (typeof window === 'undefined' || window.location.pathname !== '/preview/book') throw new Error('Original wizard samples are only available on the isolated booking preview.');
  return createSampleFetch(window.localStorage)(input, init);
}
