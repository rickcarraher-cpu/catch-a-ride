export const SAMPLE_SETTINGS = { company_name: 'Catch A Ride', business_hours_start: '06:00', business_hours_end: '22:00', manual_mileage: 'yes', rate_per_mile: '3', credit_card_fee_percent: '0' };
export const SETTINGS_KEY = 'catcharide-sample-settings-v1';
export const SAFE_SETTINGS = new Set(['business_name', 'provider_label', 'business_phone', 'owner_email', 'additional_owner_emails', 'business_hours_start', 'business_hours_end', 'business_address', 'booking_message', 'rate_per_mile', 'manual_mileage', 'enable_tours', 'enable_weddings', 'enable_third_party_trips', 'default_passenger_locations', 'credit_card_fee_percent']);
export function sampleSettings(storage: Pick<Storage, 'getItem'>) {
  const raw = storage.getItem(SETTINGS_KEY); const saved = raw ? JSON.parse(raw) : {};
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(saved)) if (SAFE_SETTINGS.has(key) && typeof value === 'string' && value.length <= 2000) safe[key] = value;
  return { ...SAMPLE_SETTINGS, business_name: 'Catch A Ride · Sample', ...safe };
}
