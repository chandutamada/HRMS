package com.hrms.tracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Slf4j
public class ReverseGeocodingService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Map<String, GeocodedAddress> memoryCache = new ConcurrentHashMap<>();
    private final AtomicLong lastRequestTime = new AtomicLong(0);

    // Minimum delay between external geocoding requests (1000ms = 1 sec to strictly respect OSM/Photon rate limits)
    private static final long MIN_REQUEST_INTERVAL_MS = 1000;

    public ReverseGeocodingService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(4))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeocodedAddress {
        private String placeName;
        private String streetAddress;
    }

    /**
     * Resolves human readable place name and street address for a coordinate.
     * Only called for detected stops / checkpoints (never for live telemetry pings).
     */
    public GeocodedAddress resolveAddress(double latitude, double longitude) {
        // Quantize coordinate to 4 decimals (~11 meters) for caching
        String cacheKey = String.format("%.4f,%.4f", latitude, longitude);
        if (memoryCache.containsKey(cacheKey)) {
            return memoryCache.get(cacheKey);
        }

        // Throttle external calls to ensure zero-cost compliance
        rateLimit();

        // 1. Try Photon by Komoot (free, fast OSM-based geocoder)
        GeocodedAddress result = queryPhoton(latitude, longitude);

        // 2. Fallback to OSM Nominatim
        if (result == null || result.getStreetAddress() == null || result.getStreetAddress().isEmpty()) {
            result = queryNominatim(latitude, longitude);
        }

        // 3. Fallback to coordinate string if geocoding services unreachable
        if (result == null) {
            result = new GeocodedAddress(
                    String.format("Location @ %.4f, %.4f", latitude, longitude),
                    String.format("GPS Waypoint (%.5f, %.5f)", latitude, longitude)
            );
        }

        memoryCache.put(cacheKey, result);
        return result;
    }

    private void rateLimit() {
        long now = System.currentTimeMillis();
        long prev = lastRequestTime.get();
        long elapsed = now - prev;
        if (elapsed < MIN_REQUEST_INTERVAL_MS) {
            try {
                Thread.sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }
        lastRequestTime.set(System.currentTimeMillis());
    }

    private GeocodedAddress queryPhoton(double lat, double lon) {
        try {
            String url = String.format("https://photon.komoot.io/reverse?lat=%.6f&lon=%.6f", lat, lon);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(4))
                    .header("User-Agent", "HRMS-Field-Tracking/1.0 (employee-monitoring)")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode features = root.path("features");
                if (features.isArray() && !features.isEmpty()) {
                    JsonNode props = features.get(0).path("properties");
                    String name = props.path("name").asText(null);
                    String street = props.path("street").asText(null);
                    String housenumber = props.path("housenumber").asText(null);
                    String district = props.path("district").asText(null);
                    String city = props.path("city").asText(null);
                    String state = props.path("state").asText(null);

                    StringBuilder address = new StringBuilder();
                    if (housenumber != null && !housenumber.isEmpty()) address.append(housenumber).append(", ");
                    if (street != null && !street.isEmpty()) address.append(street).append(", ");
                    if (district != null && !district.isEmpty()) address.append(district).append(", ");
                    if (city != null && !city.isEmpty()) address.append(city).append(", ");
                    if (state != null && !state.isEmpty()) address.append(state);

                    String finalAddress = address.toString().replaceAll(", $", "").trim();
                    String placeName = name != null && !name.isEmpty() ? name : (city != null ? city : "Waypoint Landmark");

                    if (!finalAddress.isEmpty()) {
                        return new GeocodedAddress(placeName, finalAddress);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Photon reverse geocode lookup failed: {}", e.getMessage());
        }
        return null;
    }

    private GeocodedAddress queryNominatim(double lat, double lon) {
        try {
            String url = String.format("https://nominatim.openstreetmap.org/reverse?lat=%.6f&lon=%.6f&format=json", lat, lon);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(4))
                    .header("User-Agent", "HRMS-Field-Tracking/1.0 (osm-compliance-bot)")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                String displayName = root.path("display_name").asText(null);
                JsonNode addressObj = root.path("address");
                String road = addressObj.path("road").asText(null);
                String suburb = addressObj.path("suburb").asText(null);
                String city = addressObj.path("city").asText(null);
                if (city == null || city.isEmpty()) city = addressObj.path("town").asText(null);

                String placeName = road != null ? road : (suburb != null ? suburb : (city != null ? city : "Landmark Stop"));
                return new GeocodedAddress(placeName, displayName != null ? displayName : placeName);
            }
        } catch (Exception e) {
            log.warn("Nominatim reverse geocode lookup failed: {}", e.getMessage());
        }
        return null;
    }
}
