/**
 * Open-source Reverse Geocoding Utility (Nominatim & Photon by Komoot)
 * Free, zero-API key, zero commercial dependency with intelligent caching.
 */

const memoryCache = new Map<string, string>();

function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/**
 * Format raw Nominatim response into a clean, human-readable street address.
 */
function formatNominatimAddress(data: any): string {
  if (!data) return '';
  const addr = data.address;
  if (!addr) return data.display_name || '';

  const parts: string[] = [];

  // Building or house number
  if (addr.house_number && addr.road) {
    parts.push(`${addr.house_number}, ${addr.road}`);
  } else if (addr.road) {
    parts.push(addr.road);
  } else if (addr.commercial || addr.office || addr.industrial) {
    parts.push(addr.commercial || addr.office || addr.industrial);
  }

  // Locality / Suburb / Area
  if (addr.neighbourhood && !parts.includes(addr.neighbourhood)) {
    parts.push(addr.neighbourhood);
  } else if (addr.suburb && !parts.includes(addr.suburb)) {
    parts.push(addr.suburb);
  } else if (addr.village && !parts.includes(addr.village)) {
    parts.push(addr.village);
  }

  // City / Town / District
  const city = addr.city || addr.town || addr.county || addr.district;
  if (city && !parts.includes(city)) {
    parts.push(city);
  }

  // State
  if (addr.state && !parts.includes(addr.state)) {
    parts.push(addr.state);
  }

  // Postcode
  if (addr.postcode) {
    parts.push(addr.postcode);
  }

  return parts.length > 0 ? parts.join(', ') : data.display_name || 'Location recorded';
}

/**
 * Format raw Photon response into clean address.
 */
function formatPhotonAddress(feature: any): string {
  if (!feature?.properties) return '';
  const props = feature.properties;
  const parts: string[] = [];

  if (props.housenumber && props.street) {
    parts.push(`${props.housenumber}, ${props.street}`);
  } else if (props.name) {
    parts.push(props.name);
  } else if (props.street) {
    parts.push(props.street);
  }

  if (props.district && !parts.includes(props.district)) {
    parts.push(props.district);
  }
  if (props.city && !parts.includes(props.city)) {
    parts.push(props.city);
  }
  if (props.state && !parts.includes(props.state)) {
    parts.push(props.state);
  }
  if (props.postcode) {
    parts.push(props.postcode);
  }

  return parts.length > 0 ? parts.join(', ') : 'Address recorded';
}

/**
 * Reverse geocode GPS coordinates to exact street address.
 * Attempts Nominatim first, then Photon fallback, then coordinate string.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  if (typeof window === 'undefined') return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  const cacheKey = getCacheKey(lat, lon);

  // 1. Check in-memory cache
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  // 2. Check localStorage cache
  try {
    const cached = localStorage.getItem(`geo_${cacheKey}`);
    if (cached) {
      memoryCache.set(cacheKey, cached);
      return cached;
    }
  } catch (_) {}

  // 3. Try OpenStreetMap Nominatim API
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'CampusFieldTrack-HRPortal/1.0',
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const formatted = formatNominatimAddress(data);
      if (formatted) {
        memoryCache.set(cacheKey, formatted);
        try {
          localStorage.setItem(`geo_${cacheKey}`, formatted);
        } catch (_) {}
        return formatted;
      }
    }
  } catch (_) {
    // Continue to fallback
  }

  // 4. Try Photon by Komoot API fallback
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const formatted = formatPhotonAddress(data.features[0]);
        if (formatted) {
          memoryCache.set(cacheKey, formatted);
          try {
            localStorage.setItem(`geo_${cacheKey}`, formatted);
          } catch (_) {}
          return formatted;
        }
      }
    }
  } catch (_) {
    // Fallback
  }

  // Fallback to formatted coordinates
  const fallback = `Lat: ${lat.toFixed(5)}, Lng: ${lon.toFixed(5)}`;
  memoryCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Reverse geocode a list of checkpoints or stops sequentially with a small delay
 * to respect the OpenStreetMap Nominatim 1 req/sec usage policy.
 */
export async function batchReverseGeocode<T extends { latitude: number; longitude: number }>(
  items: T[],
  onItemGeocoded?: (index: number, address: string) => void
): Promise<string[]> {
  const addresses: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cacheKey = getCacheKey(item.latitude, item.longitude);

    let address = memoryCache.get(cacheKey);
    if (!address) {
      try {
        const cached = localStorage.getItem(`geo_${cacheKey}`);
        if (cached) address = cached;
      } catch (_) {}
    }

    if (!address) {
      address = await reverseGeocode(item.latitude, item.longitude);
      // Wait 350ms between uncached calls to respect OSM rate limit
      if (i < items.length - 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    addresses.push(address);
    if (onItemGeocoded) {
      onItemGeocoded(i, address);
    }
  }

  return addresses;
}
