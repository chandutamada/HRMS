/**
 * Haversine Formula Utility for Calculating Distance Between Two GPS Coordinates
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters

  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_METERS * c;

  // Round to 2 decimal places
  return Math.round(distance * 100) / 100;
}

/**
 * Validate whether a coordinate is within the permitted radius
 */
export function isWithinGeofenceRadius(
  currentLat: number,
  currentLon: number,
  officeLat: number,
  officeLon: number,
  radiusMeters: number,
): { isWithin: boolean; distanceMeters: number } {
  const distanceMeters = calculateHaversineDistance(
    currentLat,
    currentLon,
    officeLat,
    officeLon,
  );

  return {
    isWithin: distanceMeters <= radiusMeters,
    distanceMeters,
  };
}
