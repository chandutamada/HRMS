package com.hrms.tracking.util;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

public final class GeofenceUtil {

    private static final double EARTH_RADIUS_METERS = 6371000.0;
    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");
    private static final LocalTime OFFICE_START = LocalTime.of(9, 0);
    private static final LocalTime OFFICE_END = LocalTime.of(17, 30);

    private GeofenceUtil() {}

    /**
     * Haversine Distance Calculation (meters) between two latitude/longitude coordinates.
     */
    public static double calculateHaversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);

        double c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
        return EARTH_RADIUS_METERS * c;
    }

    /**
     * Check if a given coordinate is within a geofence radius.
     */
    public static boolean isWithinRadius(double userLat, double userLon, double officeLat, double officeLon, double radiusMeters) {
        return calculateHaversineDistance(userLat, userLon, officeLat, officeLon) <= radiusMeters;
    }

    /**
     * Check if the current time in Asia/Kolkata falls within standard office hours (09:00 - 17:30 IST, Monday-Saturday).
     */
    public static boolean isWithinOfficeHours() {
        ZonedDateTime now = ZonedDateTime.now(IST_ZONE);
        if (now.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return false;
        }
        LocalTime time = now.toLocalTime();
        return !time.isBefore(OFFICE_START) && !time.isAfter(OFFICE_END);
    }

    /**
     * Check if a given epoch timestamp falls within standard office hours (09:00 - 17:30 IST).
     */
    public static boolean isWithinOfficeHours(long epochMilli) {
        ZonedDateTime dt = ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(epochMilli), IST_ZONE);
        if (dt.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return false;
        }
        LocalTime time = dt.toLocalTime();
        return !time.isBefore(OFFICE_START) && !time.isAfter(OFFICE_END);
    }
}
