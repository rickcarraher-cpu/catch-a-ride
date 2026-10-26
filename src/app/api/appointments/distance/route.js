// ── OSM-based routing correction factor ──────────────────────────────────────
// OSRM and Valhalla use OpenStreetMap data.  Real-world testing shows their
// distances already closely match Google Maps (e.g. 26.5 mi vs 26.2 mi for a
// known Nissan Stadium → White House, TN route).  The previous 1.15 multiplier
// was over-inflating results.  Set to 1.0 (no correction) so that Math.ceil
// alone provides the small upward rounding needed.
const OSM_CORRECTION_FACTOR = 1.0;

export async function POST(request) {
  try {
    const { origin, destination } = await request.json();

    if (!origin || !destination) {
      return Response.json(
        { error: "Origin and destination are required" },
        { status: 400 },
      );
    }

    console.log(`[Distance] Calculating: "${origin}" → "${destination}"`);

    // Track all failures for diagnostics
    const failures = [];

    // ══════════════════════════════════════════════════════════════════
    // PRIORITY 1: OSRM + Nominatim (free, reliable, real road routing)
    // ══════════════════════════════════════════════════════════════════
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt === 2) {
        console.log(`[Distance] ⏳ OSRM+Nominatim retry — waiting 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      console.log(`[Distance] Trying OSRM + Nominatim [attempt ${attempt}]...`);
      const osrmResult = await tryOsrmFallback(origin, destination);
      if (osrmResult.success) {
        console.log(
          `[Distance] ✅ OSRM + Nominatim succeeded (attempt ${attempt})`,
        );
        return Response.json({
          ...osrmResult.data,
          retries_attempted: attempt - 1,
          failures,
        });
      }
      const msg = `OSRM + Nominatim (attempt ${attempt}): ${osrmResult.error}`;
      failures.push(msg);
      console.log(`[Distance] ${msg}`);
    }

    // ══════════════════════════════════════════════════════════════════
    // PRIORITY 2: OSRM + Photon geocoding (alternate free geocoder)
    // ══════════════════════════════════════════════════════════════════
    console.log("[Distance] Trying OSRM + Photon...");
    const osrmPhotonResult = await tryOsrmWithPhoton(origin, destination);
    if (osrmPhotonResult.success) {
      console.log("[Distance] ✅ OSRM + Photon succeeded");
      return Response.json({ ...osrmPhotonResult.data, failures });
    }
    failures.push(`OSRM + Photon: ${osrmPhotonResult.error}`);
    console.log(`[Distance] OSRM + Photon failed: ${osrmPhotonResult.error}`);

    // ══════════════════════════════════════════════════════════════════
    // PRIORITY 3: Valhalla + Nominatim (alternate free router)
    // ══════════════════════════════════════════════════════════════════
    console.log("[Distance] Trying Valhalla + Nominatim...");
    const valhallaNominatimResult = await tryValhallaWithNominatim(
      origin,
      destination,
    );
    if (valhallaNominatimResult.success) {
      console.log("[Distance] ✅ Valhalla + Nominatim succeeded");
      return Response.json({ ...valhallaNominatimResult.data, failures });
    }
    failures.push(`Valhalla + Nominatim: ${valhallaNominatimResult.error}`);
    console.log(
      `[Distance] Valhalla + Nominatim failed: ${valhallaNominatimResult.error}`,
    );

    // ══════════════════════════════════════════════════════════════════
    // PRIORITY 4: Valhalla + Photon (alternate free router + geocoder)
    // ══════════════════════════════════════════════════════════════════
    console.log("[Distance] Trying Valhalla + Photon...");
    const valhallaPhotonResult = await tryValhallaWithPhoton(
      origin,
      destination,
    );
    if (valhallaPhotonResult.success) {
      console.log("[Distance] ✅ Valhalla + Photon succeeded");
      return Response.json({ ...valhallaPhotonResult.data, failures });
    }
    failures.push(`Valhalla + Photon: ${valhallaPhotonResult.error}`);
    console.log(
      `[Distance] Valhalla + Photon failed: ${valhallaPhotonResult.error}`,
    );

    // ══════════════════════════════════════════════════════════════════
    // PRIORITY 5: Google APIs (only if all free routing failed)
    // These keys are typically for frontend map display only. If they
    // happen to work for Distance Matrix / Routes API, great — bonus.
    // ══════════════════════════════════════════════════════════════════
    const keysToTry = [];
    if (process.env.GOOGLE_MAPS_API_KEY) {
      keysToTry.push({
        key: process.env.GOOGLE_MAPS_API_KEY,
        source: "GOOGLE_MAPS_API_KEY",
      });
    }
    if (
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !==
        process.env.GOOGLE_MAPS_API_KEY
    ) {
      keysToTry.push({
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        source: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      });
    }

    for (const { key, source } of keysToTry) {
      const keyPrefix = key.substring(0, 8);
      console.log(`[Distance] Trying Google key ${keyPrefix}... (${source})`);

      const routesResult = await tryRoutesApi(origin, destination, key);
      if (routesResult.success) {
        console.log(`[Distance] ✅ Google Routes API succeeded`);
        return Response.json({ ...routesResult.data, failures });
      }
      failures.push(`Routes API (${source}): ${routesResult.error}`);

      const matrixResult = await tryDistanceMatrixApi(origin, destination, key);
      if (matrixResult.success) {
        console.log(`[Distance] ✅ Google Distance Matrix succeeded`);
        return Response.json({ ...matrixResult.data, failures });
      }
      failures.push(`Distance Matrix (${source}): ${matrixResult.error}`);

      // If denied, don't bother with more keys
      const denied = [routesResult.error, matrixResult.error].some(
        (e) =>
          e &&
          (e.includes("REQUEST_DENIED") || e.includes("PERMISSION_DENIED")),
      );
      if (denied) {
        console.log(`[Distance] Google key denied — skipping remaining keys`);
        break;
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // PRIORITY 6: OSRM routing + Google Geocoding (hybrid)
    // ══════════════════════════════════════════════════════════════════
    for (const { key, source } of keysToTry) {
      console.log(`[Distance] Trying OSRM + Google Geocoding (${source})...`);
      const osrmGoogleResult = await tryOsrmWithGoogleGeocoding(
        origin,
        destination,
        key,
      );
      if (osrmGoogleResult.success) {
        console.log("[Distance] ✅ OSRM + Google Geocoding succeeded");
        return Response.json({ ...osrmGoogleResult.data, failures });
      }
      failures.push(
        `OSRM + Google Geocoding (${source}): ${osrmGoogleResult.error}`,
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // LAST RESORT: Haversine straight-line estimates (×1.6 multiplier)
    // These are rough — flagged clearly as estimates in the UI
    // ══════════════════════════════════════════════════════════════════
    console.log(
      "[Distance] ⚠️ All routing failed — falling back to estimates...",
    );

    // Try Google Geocoding + Haversine
    for (const { key, source } of keysToTry) {
      const geoResult = await tryGeocodingFallback(origin, destination, key);
      if (geoResult.success) {
        console.log(
          "[Distance] Google Geocoding + Haversine estimate succeeded",
        );
        return Response.json({ ...geoResult.data, failures });
      }
      failures.push(
        `Google Geocoding + Haversine (${source}): ${geoResult.error}`,
      );
    }

    // Nominatim + Haversine
    const nominatimResult = await tryNominatimHaversine(origin, destination);
    if (nominatimResult.success) {
      console.log("[Distance] Nominatim + Haversine estimate succeeded");
      return Response.json({ ...nominatimResult.data, failures });
    }
    failures.push(`Nominatim + Haversine: ${nominatimResult.error}`);

    // Photon + Haversine
    const photonHaversineResult = await tryPhotonHaversine(origin, destination);
    if (photonHaversineResult.success) {
      console.log("[Distance] Photon + Haversine estimate succeeded");
      return Response.json({ ...photonHaversineResult.data, failures });
    }
    failures.push(`Photon + Haversine: ${photonHaversineResult.error}`);

    // Everything failed
    console.error(
      `[Distance] ALL methods failed for: "${origin}" → "${destination}"`,
    );
    console.error(`[Distance] Failure log:`, JSON.stringify(failures));
    return Response.json(
      {
        error:
          "Could not calculate distance — please check both addresses and try again.",
        failures,
      },
      { status: 400 },
    );
  } catch (err) {
    console.error("Distance calculation error:", err);
    return Response.json(
      { error: err.message || "Failed to calculate distance" },
      { status: 500 },
    );
  }
}

// ── Timeout-aware fetch helper ───────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── Diagnostic GET endpoint ──────────────────────────────────────────────────
export async function GET() {
  const results = {};

  // Test Google keys
  const keys = [];
  if (process.env.GOOGLE_MAPS_API_KEY) {
    keys.push({
      key: process.env.GOOGLE_MAPS_API_KEY,
      source: "GOOGLE_MAPS_API_KEY",
    });
  }
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    keys.push({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      source: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    });
  }
  for (const { key, source } of keys) {
    const keyPrefix = key.substring(0, 8);
    const kr = {};
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent("New York, NY")}&key=${key}`;
      const geoRes = await fetchWithTimeout(geoUrl);
      const geoData = await geoRes.json();
      kr.geocoding = {
        status: geoData.status,
        working: geoData.status === "OK",
      };
    } catch (e) {
      kr.geocoding = { working: false, error: e.message };
    }
    try {
      const dmUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent("New York, NY")}&destinations=${encodeURIComponent("Boston, MA")}&units=imperial&key=${key}`;
      const dmRes = await fetchWithTimeout(dmUrl);
      const dmData = await dmRes.json();
      kr.distanceMatrix = {
        status: dmData.status,
        working: dmData.status === "OK",
      };
    } catch (e) {
      kr.distanceMatrix = { working: false, error: e.message };
    }
    kr.anyWorking = kr.geocoding?.working || kr.distanceMatrix?.working;
    results[`${source} (${keyPrefix}...)`] = kr;
  }

  // Test OSRM (free)
  try {
    const osrmTest = await tryOsrmFallback("New York, NY", "Boston, MA");
    results.osrm_nominatim = {
      working: osrmTest.success,
      miles: osrmTest.data?.miles,
    };
  } catch (e) {
    results.osrm_nominatim = { working: false, error: e.message };
  }

  // Test Valhalla (free)
  try {
    const valhallaTest = await tryValhallaWithNominatim(
      "New York, NY",
      "Boston, MA",
    );
    results.valhalla_nominatim = {
      working: valhallaTest.success,
      miles: valhallaTest.data?.miles,
    };
  } catch (e) {
    results.valhalla_nominatim = { working: false, error: e.message };
  }

  // Test Photon geocoder (free)
  try {
    const photonCoords = await photonGeocode("New York, NY");
    results.photon_geocoder = { working: !!photonCoords, coords: photonCoords };
  } catch (e) {
    results.photon_geocoder = { working: false, error: e.message };
  }

  const anyWorking = Object.values(results).some(
    (r) => r.anyWorking || r.working,
  );
  return Response.json({
    results,
    overallStatus: anyWorking ? "working" : "check_logs",
  });
}

// ── Routes API ───────────────────────────────────────────────────────────────
async function tryRoutesApi(origin, destination, apiKey) {
  try {
    const routesUrl =
      "https://routes.googleapis.com/directions/v2:computeRoutes";
    const routesBody = {
      origin: { address: origin },
      destination: { address: destination },
      travelMode: "DRIVE",
      units: "IMPERIAL",
    };

    const routesRes = await fetchWithTimeout(routesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify(routesBody),
    });

    const routesData = await routesRes.json();

    if (routesData.error) {
      return {
        success: false,
        error: routesData.error.message || routesData.error.status,
      };
    }

    const route = routesData.routes?.[0];
    if (!route || !route.distanceMeters) {
      return { success: false, error: "No route found" };
    }

    const miles = route.distanceMeters / 1609.344;
    const roundedMiles = Math.ceil(miles);
    const durationSeconds = parseInt(route.duration?.replace("s", "") || "0");
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const durationText =
      hours > 0
        ? `${hours} hr${hours > 1 ? "s" : ""} ${minutes} min${minutes !== 1 ? "s" : ""}`
        : `${minutes} min${minutes !== 1 ? "s" : ""}`;
    const totalMinutes = Math.ceil(durationSeconds / 60);

    return {
      success: true,
      data: {
        miles: roundedMiles,
        text: `${roundedMiles} mi`,
        duration: durationText,
        durationMinutes: totalMinutes,
        method: "routes_api",
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Distance Matrix API ──────────────────────────────────────────────────────
async function tryDistanceMatrixApi(origin, destination, apiKey) {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();

    if (data.status !== "OK") {
      return {
        success: false,
        error: `Status: ${data.status}${data.error_message ? " — " + data.error_message : ""}`,
      };
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      return {
        success: false,
        error: `Element status: ${element?.status || "missing"}`,
      };
    }

    const meters = element.distance.value;
    const miles = meters / 1609.344;
    const roundedMiles = Math.ceil(miles);
    const durationMinutes = Math.ceil(element.duration.value / 60);

    return {
      success: true,
      data: {
        miles: roundedMiles,
        text: `${roundedMiles} mi`,
        duration: element.duration.text,
        durationMinutes,
        method: "distance_matrix",
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── OSRM free routing (no API key needed) ────────────────────────────────────
async function tryOsrmFallback(origin, destination) {
  try {
    const [originCoords, destCoords] = await Promise.all([
      nominatimGeocode(origin),
      nominatimGeocode(destination),
    ]);
    if (!originCoords)
      return {
        success: false,
        error: `Could not geocode origin via Nominatim: ${origin}`,
      };
    if (!destCoords)
      return {
        success: false,
        error: `Could not geocode destination via Nominatim: ${destination}`,
      };

    return await osrmRoute(originCoords, destCoords);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── OSRM with Photon geocoding (free, no API key) ───────────────────────────
async function tryOsrmWithPhoton(origin, destination) {
  try {
    const [originCoords, destCoords] = await Promise.all([
      photonGeocode(origin),
      photonGeocode(destination),
    ]);
    if (!originCoords)
      return {
        success: false,
        error: `Could not geocode origin via Photon: ${origin}`,
      };
    if (!destCoords)
      return {
        success: false,
        error: `Could not geocode destination via Photon: ${destination}`,
      };

    return await osrmRoute(originCoords, destCoords);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Valhalla with Nominatim geocoding (free, no API key) ─────────────────────
async function tryValhallaWithNominatim(origin, destination) {
  try {
    const [originCoords, destCoords] = await Promise.all([
      nominatimGeocode(origin),
      nominatimGeocode(destination),
    ]);
    if (!originCoords)
      return {
        success: false,
        error: `Could not geocode origin via Nominatim: ${origin}`,
      };
    if (!destCoords)
      return {
        success: false,
        error: `Could not geocode destination via Nominatim: ${destination}`,
      };

    return await valhallaRoute(originCoords, destCoords);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Valhalla with Photon geocoding (free, no API key) ────────────────────────
async function tryValhallaWithPhoton(origin, destination) {
  try {
    const [originCoords, destCoords] = await Promise.all([
      photonGeocode(origin),
      photonGeocode(destination),
    ]);
    if (!originCoords)
      return {
        success: false,
        error: `Could not geocode origin via Photon: ${origin}`,
      };
    if (!destCoords)
      return {
        success: false,
        error: `Could not geocode destination via Photon: ${destination}`,
      };

    return await valhallaRoute(originCoords, destCoords);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── OSRM with Google Geocoding (handles addresses Nominatim can't) ───────────
async function tryOsrmWithGoogleGeocoding(origin, destination, apiKey) {
  try {
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(origin, apiKey),
      geocodeAddress(destination, apiKey),
    ]);
    if (!originCoords)
      return {
        success: false,
        error: `Could not geocode origin via Google: ${origin}`,
      };
    if (!destCoords)
      return {
        success: false,
        error: `Could not geocode destination via Google: ${destination}`,
      };

    // Google returns { lat, lng }, OSRM needs { lat, lon }
    return await osrmRoute(
      { lat: originCoords.lat, lon: originCoords.lng },
      { lat: destCoords.lat, lon: destCoords.lng },
    );
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Shared OSRM routing from coordinates ─────────────────────────────────────
async function osrmRoute(originCoords, destCoords) {
  try {
    console.log(
      `[Distance] OSRM coords: origin(${originCoords.lat},${originCoords.lon}) → dest(${destCoords.lat},${destCoords.lon})`,
    );
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    const osrmRes = await fetchWithTimeout(osrmUrl, {}, 8000);
    const osrmData = await osrmRes.json();

    if (osrmData.code !== "Ok" || !osrmData.routes?.[0]) {
      return {
        success: false,
        error: `OSRM error: ${osrmData.code || "no route"}`,
      };
    }

    const route = osrmData.routes[0];
    const rawMiles = route.distance / 1609.344;
    const correctedMiles = rawMiles * OSM_CORRECTION_FACTOR;
    const roundedMiles = Math.ceil(correctedMiles);
    console.log(
      `[Distance] OSRM raw: ${rawMiles.toFixed(1)} mi × ${OSM_CORRECTION_FACTOR} = ${correctedMiles.toFixed(1)} mi → ${roundedMiles} mi`,
    );
    const totalSeconds = route.duration;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const durationText =
      hours > 0
        ? `${hours} hr${hours > 1 ? "s" : ""} ${minutes} min${minutes !== 1 ? "s" : ""}`
        : `${minutes} min${minutes !== 1 ? "s" : ""}`;

    return {
      success: true,
      data: {
        miles: roundedMiles,
        text: `${roundedMiles} mi`,
        duration: durationText,
        durationMinutes: Math.ceil(totalSeconds / 60),
        method: "osrm",
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Shared Valhalla routing from coordinates (free, no API key) ──────────────
async function valhallaRoute(originCoords, destCoords) {
  try {
    console.log(
      `[Distance] Valhalla coords: origin(${originCoords.lat},${originCoords.lon}) → dest(${destCoords.lat},${destCoords.lon})`,
    );
    const valhallaBody = {
      locations: [
        { lat: originCoords.lat, lon: originCoords.lon },
        { lat: destCoords.lat, lon: destCoords.lon },
      ],
      costing: "auto",
      units: "miles",
    };
    const valhallaUrl = "https://valhalla1.openstreetmap.de/route";
    const valhallaRes = await fetchWithTimeout(
      valhallaUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valhallaBody),
      },
      8000,
    );
    const valhallaData = await valhallaRes.json();

    if (valhallaData.trip && valhallaData.trip.summary) {
      const summary = valhallaData.trip.summary;
      const rawMiles = summary.length; // already in miles since we set units: "miles"
      const correctedMiles = rawMiles * OSM_CORRECTION_FACTOR;
      const roundedMiles = Math.ceil(correctedMiles);
      console.log(
        `[Distance] Valhalla raw: ${rawMiles.toFixed(1)} mi × ${OSM_CORRECTION_FACTOR} = ${correctedMiles.toFixed(1)} mi → ${roundedMiles} mi`,
      );
      const totalSeconds = summary.time;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const durationText =
        hours > 0
          ? `${hours} hr${hours > 1 ? "s" : ""} ${minutes} min${minutes !== 1 ? "s" : ""}`
          : `${minutes} min${minutes !== 1 ? "s" : ""}`;

      return {
        success: true,
        data: {
          miles: roundedMiles,
          text: `${roundedMiles} mi`,
          duration: durationText,
          durationMinutes: Math.ceil(totalSeconds / 60),
          method: "valhalla",
        },
      };
    }

    return {
      success: false,
      error:
        valhallaData.error || valhallaData.status_message || "No route found",
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Nominatim geocoder (free, no API key) ────────────────────────────────────
async function nominatimGeocode(address) {
  try {
    // First try the raw address with US country code restriction
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: { "User-Agent": "LimoServiceApp/1.0" },
      },
      6000,
    );
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }

    // Retry without country code restriction (handles edge cases)
    const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res2 = await fetchWithTimeout(
      url2,
      {
        headers: { "User-Agent": "LimoServiceApp/1.0" },
      },
      6000,
    );
    const data2 = await res2.json();
    if (data2?.[0]) {
      return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon) };
    }

    // Try with "USA" appended if not already present (helps with partial addresses)
    const lowerAddr = address.toLowerCase();
    if (!lowerAddr.includes("usa") && !lowerAddr.includes("united states")) {
      const url3 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", USA")}&format=json&limit=1`;
      const res3 = await fetchWithTimeout(
        url3,
        {
          headers: { "User-Agent": "LimoServiceApp/1.0" },
        },
        6000,
      );
      const data3 = await res3.json();
      if (data3?.[0]) {
        return { lat: parseFloat(data3[0].lat), lon: parseFloat(data3[0].lon) };
      }
    }

    // Try stripping common business/landmark words that confuse Nominatim
    const cleaned = cleanAddressForNominatim(address);
    if (cleaned && cleaned !== address) {
      console.log(
        `[Distance] Nominatim retry with cleaned address: "${cleaned}"`,
      );
      const url4 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleaned)}&format=json&limit=1&countrycodes=us`;
      const res4 = await fetchWithTimeout(
        url4,
        {
          headers: { "User-Agent": "LimoServiceApp/1.0" },
        },
        6000,
      );
      const data4 = await res4.json();
      if (data4?.[0]) {
        return { lat: parseFloat(data4[0].lat), lon: parseFloat(data4[0].lon) };
      }

      // Also try cleaned + USA
      const url5 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleaned + ", USA")}&format=json&limit=1`;
      const res5 = await fetchWithTimeout(
        url5,
        {
          headers: { "User-Agent": "LimoServiceApp/1.0" },
        },
        6000,
      );
      const data5 = await res5.json();
      if (data5?.[0]) {
        return { lat: parseFloat(data5[0].lat), lon: parseFloat(data5[0].lon) };
      }
    }

    // Try extracting just the city/state part as a last resort
    const cityState = extractCityState(address);
    if (cityState) {
      console.log(
        `[Distance] Nominatim fallback to city/state: "${cityState}"`,
      );
      const url6 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityState)}&format=json&limit=1&countrycodes=us`;
      const res6 = await fetchWithTimeout(
        url6,
        {
          headers: { "User-Agent": "LimoServiceApp/1.0" },
        },
        6000,
      );
      const data6 = await res6.json();
      if (data6?.[0]) {
        return { lat: parseFloat(data6[0].lat), lon: parseFloat(data6[0].lon) };
      }
    }

    console.log(`[Distance] Nominatim could not geocode: "${address}"`);
    return null;
  } catch (err) {
    console.log(`[Distance] Nominatim error for "${address}": ${err.message}`);
    return null;
  }
}

// ── Photon geocoder (free, no API key, powered by Komoot/OSM) ────────────────
async function photonGeocode(address) {
  try {
    // Photon is a free geocoding service backed by OpenStreetMap data
    // No rate limit headers needed, but be a good citizen with User-Agent
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&lang=en`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: { "User-Agent": "LimoServiceApp/1.0" },
      },
      6000,
    );
    const data = await res.json();

    if (data?.features?.[0]?.geometry?.coordinates) {
      const coords = data.features[0].geometry.coordinates;
      // Photon returns [lon, lat] in GeoJSON format
      return { lat: coords[1], lon: coords[0] };
    }

    // Retry with cleaned address
    const cleaned = cleanAddressForNominatim(address);
    if (cleaned && cleaned !== address) {
      const url2 = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleaned)}&limit=1&lang=en`;
      const res2 = await fetchWithTimeout(
        url2,
        {
          headers: { "User-Agent": "LimoServiceApp/1.0" },
        },
        6000,
      );
      const data2 = await res2.json();
      if (data2?.features?.[0]?.geometry?.coordinates) {
        const coords2 = data2.features[0].geometry.coordinates;
        return { lat: coords2[1], lon: coords2[0] };
      }
    }

    // Try city/state extraction
    const cityState = extractCityState(address);
    if (cityState) {
      const url3 = `https://photon.komoot.io/api/?q=${encodeURIComponent(cityState)}&limit=1&lang=en`;
      const res3 = await fetchWithTimeout(
        url3,
        {
          headers: { "User-Agent": "LimoServiceApp/1.0" },
        },
        6000,
      );
      const data3 = await res3.json();
      if (data3?.features?.[0]?.geometry?.coordinates) {
        const coords3 = data3.features[0].geometry.coordinates;
        return { lat: coords3[1], lon: coords3[0] };
      }
    }

    console.log(`[Distance] Photon could not geocode: "${address}"`);
    return null;
  } catch (err) {
    console.log(`[Distance] Photon error for "${address}": ${err.message}`);
    return null;
  }
}

// ── Address cleaning helpers ─────────────────────────────────────────────────
function cleanAddressForNominatim(address) {
  // Strip common business/landmark/venue terms that confuse Nominatim
  const noiseWords = [
    "hotel",
    "motel",
    "resort",
    "inn",
    "suites",
    "lodge",
    "airport",
    "terminal",
    "international",
    "restaurant",
    "bar",
    "grill",
    "cafe",
    "bistro",
    "church",
    "center",
    "centre",
    "plaza",
    "mall",
    "tower",
    "the",
    "at",
    "&",
  ];

  let cleaned = address;

  // Remove noise words (case-insensitive, whole word only)
  for (const word of noiseWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    cleaned = cleaned.replace(regex, "");
  }

  // Clean up extra spaces and commas
  cleaned = cleaned
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();

  return cleaned || null;
}

function extractCityState(address) {
  // Try to pull city/state from a comma-separated address
  // e.g. "The Hermitage Hotel, Nashville, TN" → "Nashville, TN"
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // If we have at least 2 parts, try the last 2 (likely city, state)
  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2).join(", ");
    // Check if one of them looks like a state abbreviation
    const stateMatch = lastTwo.match(/\b[A-Z]{2}\b/);
    if (stateMatch) {
      return lastTwo;
    }
  }

  // Try to find a state abbreviation anywhere and grab context
  const stateRegex = /,?\s*([^,]+),?\s*\b([A-Z]{2})\b/;
  const match = address.match(stateRegex);
  if (match) {
    return `${match[1].trim()}, ${match[2]}`;
  }

  return null;
}

// ── Nominatim + Haversine last resort (no API key) ───────────────────────────
async function tryNominatimHaversine(origin, destination) {
  try {
    const [originCoords, destCoords] = await Promise.all([
      nominatimGeocode(origin),
      nominatimGeocode(destination),
    ]);
    if (!originCoords || !destCoords)
      return {
        success: false,
        error: "Could not geocode addresses via Nominatim",
      };

    const straightMiles = haversineDistance(
      originCoords.lat,
      originCoords.lon,
      destCoords.lat,
      destCoords.lon,
    );
    const estMiles = Math.ceil(straightMiles * 1.6);
    const estMinutes = Math.ceil(estMiles * 2);
    const hours = Math.floor(estMinutes / 60);
    const mins = estMinutes % 60;
    const durationText =
      hours > 0
        ? `~${hours} hr${hours > 1 ? "s" : ""} ${mins} min${mins !== 1 ? "s" : ""}`
        : `~${mins} min${mins !== 1 ? "s" : ""}`;

    return {
      success: true,
      data: {
        miles: estMiles,
        text: `~${estMiles} mi`,
        duration: durationText,
        durationMinutes: estMinutes,
        method: "estimate",
        note: "⚠️ ESTIMATE ONLY — Google Maps and all routing services failed. This is a straight-line estimate (×1.5). Actual driving distance may differ. Please verify with Google Maps.",
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Photon + Haversine very last resort (no API key) ─────────────────────────
async function tryPhotonHaversine(origin, destination) {
  try {
    const [originCoords, destCoords] = await Promise.all([
      photonGeocode(origin),
      photonGeocode(destination),
    ]);
    if (!originCoords || !destCoords)
      return {
        success: false,
        error: "Could not geocode addresses via Photon",
      };

    const straightMiles = haversineDistance(
      originCoords.lat,
      originCoords.lon,
      destCoords.lat,
      destCoords.lon,
    );
    const estMiles = Math.ceil(straightMiles * 1.6);
    const estMinutes = Math.ceil(estMiles * 2);
    const hours = Math.floor(estMinutes / 60);
    const mins = estMinutes % 60;
    const durationText =
      hours > 0
        ? `~${hours} hr${hours > 1 ? "s" : ""} ${mins} min${mins !== 1 ? "s" : ""}`
        : `~${mins} min${mins !== 1 ? "s" : ""}`;

    return {
      success: true,
      data: {
        miles: estMiles,
        text: `~${estMiles} mi`,
        duration: durationText,
        durationMinutes: estMinutes,
        method: "photon_estimate",
        note: "⚠️ ESTIMATE ONLY — Google Maps and all routing services failed. This is a straight-line estimate (×1.5). Actual driving distance may differ. Please verify with Google Maps.",
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Google Geocoding + Haversine (kept as legacy) ────────────────────────────
// ── Geocoding + Haversine fallback ───────────────────────────────────────────
async function tryGeocodingFallback(origin, destination, apiKey) {
  try {
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(origin, apiKey),
      geocodeAddress(destination, apiKey),
    ]);

    if (!originCoords || !destCoords) {
      return {
        success: false,
        error: "Could not geocode one or both addresses",
      };
    }

    const straightLineMiles = haversineDistance(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng,
    );
    const estimatedMiles = Math.ceil(straightLineMiles * 1.6);
    const estimatedMinutes = Math.ceil(estimatedMiles * 2);
    const hours = Math.floor(estimatedMinutes / 60);
    const mins = estimatedMinutes % 60;
    const durationText =
      hours > 0
        ? `~${hours} hr${hours > 1 ? "s" : ""} ${mins} min${mins !== 1 ? "s" : ""}`
        : `~${mins} min${mins !== 1 ? "s" : ""}`;

    return {
      success: true,
      data: {
        miles: estimatedMiles,
        text: `~${estimatedMiles} mi`,
        duration: durationText,
        durationMinutes: estimatedMinutes,
        method: "geocode_estimate",
        note: "⚠️ ESTIMATE ONLY — Google routing APIs failed. This is a straight-line estimate (×1.5). Actual driving distance may differ. Please verify with Google Maps.",
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function geocodeAddress(address, apiKey) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return null;
    return data.results[0].geometry.location;
  } catch (err) {
    return null;
  }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}
