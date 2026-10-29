import { calculateHaversineDistance, isWithinGeofenceRadius } from './geofence.util';

describe('Geofence Distance & Haversine Calculation Utility', () => {
  // Office: Bangalore Manyata Tech Park Campus
  const officeLat = 13.0498300;
  const officeLon = 77.6202400;
  const radiusMeters = 50;

  it('should calculate 0 meters when coordinates are identical', () => {
    const dist = calculateHaversineDistance(officeLat, officeLon, officeLat, officeLon);
    expect(dist).toBe(0);
  });

  it('should validate point within 50 meters as inside geofence', () => {
    // 5 meters north
    const userLat = 13.0498700;
    const userLon = 77.6202400;

    const result = isWithinGeofenceRadius(userLat, userLon, officeLat, officeLon, radiusMeters);
    expect(result.distanceMeters).toBeLessThan(50);
    expect(result.isWithin).toBe(true);
  });

  it('should reject coordinates outside 50 meters radius', () => {
    // ~150 meters away
    const userLat = 13.0512000;
    const userLon = 77.6202400;

    const result = isWithinGeofenceRadius(userLat, userLon, officeLat, officeLon, radiusMeters);
    expect(result.distanceMeters).toBeGreaterThan(50);
    expect(result.isWithin).toBe(false);
  });

  it('should correctly measure distance between Hyderabad Hitec City and Bangalore Tech Park', () => {
    const hydLat = 17.4474400;
    const hydLon = 78.3762300;

    const distance = calculateHaversineDistance(officeLat, officeLon, hydLat, hydLon);
    // Bangalore to Hyderabad is ~500 km (approx 490 - 510 km)
    expect(distance).toBeGreaterThan(480000);
    expect(distance).toBeLessThan(530000);
  });
});
