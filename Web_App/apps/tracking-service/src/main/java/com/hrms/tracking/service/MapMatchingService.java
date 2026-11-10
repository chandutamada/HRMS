package com.hrms.tracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

/**
 * Server-Side Map Matching & Snap-to-Roads Service.
 * Snaps raw jittery GPS breadcrumbs to OpenStreetMap road network geometry via OSRM /match API.
 */
@Service
@Slf4j
public class MapMatchingService {

    @Value("${hrms.tracking.osrm.url:https://router.project-osrm.org}")
    private String osrmBaseUrl;

    @Value("${hrms.tracking.osrm.enabled:true}")
    private boolean osrmEnabled;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final int MAX_COORDINATES_PER_CHUNK = 60;

    /**
     * Matches raw [lat, lng] points to the road network.
     * Returns a high-accuracy, road-aligned curved polyline of [latitude, longitude] pairs.
     */
    public List<List<Double>> matchToRoads(List<List<Double>> rawCoordinates) {
        if (rawCoordinates == null || rawCoordinates.size() < 2) {
            return rawCoordinates != null ? new ArrayList<>(rawCoordinates) : new ArrayList<>();
        }

        if (!osrmEnabled) {
            return rawCoordinates;
        }

        try {
            // If coordinate list is small, process directly
            if (rawCoordinates.size() <= MAX_COORDINATES_PER_CHUNK) {
                return callOsrmMatch(rawCoordinates);
            }

            // Chunk larger paths into overlapping windows to stay within HTTP GET URL limits
            List<List<Double>> matchedPolyline = new ArrayList<>();
            int step = MAX_COORDINATES_PER_CHUNK - 5; // 5 points overlap

            for (int i = 0; i < rawCoordinates.size(); i += step) {
                int end = Math.min(i + MAX_COORDINATES_PER_CHUNK, rawCoordinates.size());
                List<List<Double>> chunk = rawCoordinates.subList(i, end);
                if (chunk.size() < 2) break;

                List<List<Double>> chunkMatched = callOsrmMatch(chunk);
                if (!chunkMatched.isEmpty()) {
                    if (matchedPolyline.isEmpty()) {
                        matchedPolyline.addAll(chunkMatched);
                    } else {
                        // Skip duplicate start point
                        matchedPolyline.addAll(chunkMatched.subList(1, chunkMatched.size()));
                    }
                }

                if (end >= rawCoordinates.size()) break;
            }

            return matchedPolyline.isEmpty() ? rawCoordinates : matchedPolyline;

        } catch (Exception e) {
            log.warn("Map matching failed, falling back to raw route: {}", e.getMessage());
            return rawCoordinates;
        }
    }

    private List<List<Double>> callOsrmMatch(List<List<Double>> coordinates) {
        StringBuilder coordsParam = new StringBuilder();
        for (int i = 0; i < coordinates.size(); i++) {
            List<Double> pt = coordinates.get(i);
            // OSRM expects {longitude},{latitude}
            coordsParam.append(String.format(java.util.Locale.US, "%.6f,%.6f", pt.get(1), pt.get(0)));
            if (i < coordinates.size() - 1) {
                coordsParam.append(";");
            }
        }

        String url = String.format(
                "%s/match/v1/driving/%s?geometries=geojson&overview=full&tidy=true&steps=false",
                osrmBaseUrl.replaceAll("/+$", ""),
                coordsParam.toString()
        );

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String code = root.path("code").asText();
                if ("Ok".equalsIgnoreCase(code)) {
                    JsonNode matchings = root.path("matchings");
                    if (matchings.isArray() && matchings.size() > 0) {
                        List<List<Double>> snapped = new ArrayList<>();
                        for (JsonNode matching : matchings) {
                            JsonNode geomCoords = matching.path("geometry").path("coordinates");
                            if (geomCoords.isArray()) {
                                for (JsonNode coord : geomCoords) {
                                    double lon = coord.get(0).asDouble();
                                    double lat = coord.get(1).asDouble();
                                    // Return as [latitude, longitude] for frontend map rendering
                                    snapped.add(List.of(lat, lon));
                                }
                            }
                        }
                        if (!snapped.isEmpty()) {
                            return snapped;
                        }
                    }
                }
            }
        } catch (RestClientException e) {
            log.debug("OSRM /match service returned error: {}", e.getMessage());
        } catch (Exception e) {
            log.warn("Error parsing OSRM response: {}", e.getMessage());
        }

        return coordinates;
    }
}
