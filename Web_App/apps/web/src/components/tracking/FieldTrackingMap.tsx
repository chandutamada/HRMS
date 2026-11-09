'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io, Socket } from 'socket.io-client';
import {
  Navigation,
  Gauge,
  BatteryCharging,
  BatteryMedium,
  BatteryLow,
  Radio,
  Wifi,
  WifiOff,
  Route as RouteIcon,
  MapPin,
  ShieldAlert,
} from 'lucide-react';

export interface FieldTelemetryPacket {
  employeeId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  battery?: number;
  timestamp?: string;
  employeeName?: string;
}

interface FieldTrackingMapProps {
  initialEmployeeId?: string;
  initialEmployeeName?: string;
  initialPosition?: [number, number];
  height?: string;
  className?: string;
}

/**
 * Fetch road-snapped geometry from free OSRM Routing Service.
 * Formats coordinates into `lng,lat;lng,lat` and calls:
 * https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson
 * Inverts the returned GeoJSON [lng, lat] back to Leaflet [lat, lng].
 * Falls back to raw waypoints on failure.
 */
export async function fetchRoadGeometry(
  waypoints: Array<[number, number]>
): Promise<Array<[number, number]>> {
  if (!waypoints || waypoints.length < 2) {
    return waypoints || [];
  }

  // To prevent URL overflow and stay within OSRM limits, sample down if point count is very large
  let sampledWaypoints = waypoints;
  if (waypoints.length > 50) {
    const step = Math.ceil(waypoints.length / 50);
    sampledWaypoints = [
      waypoints[0],
      ...waypoints.slice(1, -1).filter((_, idx) => idx % step === 0),
      waypoints[waypoints.length - 1],
    ];
  }

  try {
    // OSRM expects coordinates in lng,lat format
    const coordsString = sampledWaypoints
      .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
      .join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OSRM HTTP error: ${res.status}`);
    }

    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes[0]?.geometry?.coordinates) {
      const geoJsonCoords: Array<[number, number]> = data.routes[0].geometry.coordinates;
      // Invert GeoJSON [lng, lat] to Leaflet [lat, lng]
      const leafLatlngs: Array<[number, number]> = geoJsonCoords.map(([lng, lat]) => [lat, lng]);
      return leafLatlngs;
    }

    throw new Error('OSRM response did not contain valid route coordinates');
  } catch (err) {
    console.warn('[FieldTrackingMap] OSRM Road-Snapping failed, falling back to raw waypoints:', err);
    return waypoints;
  }
}

export default function FieldTrackingMap({
  initialEmployeeId,
  initialEmployeeName = 'Field Specialist',
  initialPosition = [18.1502552, 83.3905899],
  height = '560px',
  className = '',
}: FieldTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const rawWaypointsRef = useRef<Array<[number, number]>>([initialPosition]);
  const socketRef = useRef<Socket | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isRoadSnapped, setIsRoadSnapped] = useState(true);
  const [isSnappingInProgress, setIsSnappingInProgress] = useState(false);
  const [stops, setStops] = useState<any[]>([]);

  const [telemetry, setTelemetry] = useState<FieldTelemetryPacket>({
    employeeId: initialEmployeeId || 'field-emp-1',
    latitude: initialPosition[0],
    longitude: initialPosition[1],
    speed: 0,
    battery: 100,
    timestamp: new Date().toISOString(),
    employeeName: initialEmployeeName,
  });

  // Custom Pulsing DivIcon for Live Field Specialist
  const createPulsingMarkerIcon = useCallback((speed = 0) => {
    const isMoving = speed > 1.0;
    return L.divIcon({
      className: 'live-field-worker-icon',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <!-- Outer Pulsing Radar Ring -->
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: ${isMoving ? 'rgba(16, 185, 129, 0.35)' : 'rgba(37, 99, 235, 0.35)'};
            animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          
          <!-- Mid Ring -->
          <div style="
            position: absolute;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${isMoving ? '#10b981' : '#2563eb'};
            border: 3px solid #ffffff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 15px;
          ">
            ${isMoving ? '🚗' : '👷'}
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }, []);

  // Fetch Existing History & Waypoints on Load so the map shows the full road journey immediately
  useEffect(() => {
    async function loadDayRoute() {
      if (!initialEmployeeId) return;
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await fetch(`/api/tracking/history?employeeCode=${encodeURIComponent(initialEmployeeId)}&date=${todayStr}`);
        if (res.ok) {
          const data = await res.json();
          if (data.waypoints && data.waypoints.length > 0) {
            const pts: Array<[number, number]> = data.waypoints.map((w: any) => [w.lat, w.lng]);
            rawWaypointsRef.current = pts;
            const last = pts[pts.length - 1];

            if (markerRef.current) markerRef.current.setLatLng(last);
            if (mapRef.current) mapRef.current.panTo(last);

            setIsSnappingInProgress(true);
            try {
              const snapped = await fetchRoadGeometry(pts);
              if (polylineRef.current) {
                polylineRef.current.setLatLngs(snapped);
                setIsRoadSnapped(snapped.length > pts.length);
              }
              if (mapRef.current && polylineRef.current && pts.length > 1) {
                mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
              }
            } catch {
              if (polylineRef.current) polylineRef.current.setLatLngs(pts);
            } finally {
              setIsSnappingInProgress(false);
            }
          }

          // Render interactive numbered stop markers (1, 2, 3...)
          if (data.stops && data.stops.length > 0 && mapRef.current) {
            stopMarkersRef.current.forEach((m) => m.remove());
            stopMarkersRef.current = [];
            setStops(data.stops);

            data.stops.forEach((stop: any) => {
              const stopIcon = L.divIcon({
                className: 'stop-marker-num',
                html: `
                  <div style="background:#ef4444;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.4);cursor:pointer;">
                    ${stop.index}
                  </div>
                `,
                iconSize: [26, 26],
                iconAnchor: [13, 13],
              });

              const sm = L.marker([stop.lat, stop.lng], { icon: stopIcon })
                .bindPopup(`
                  <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;padding:3px;">
                    <div style="font-weight:bold;color:#b91c1c;margin-bottom:2px;">📍 Stop #${stop.index} (${stop.durationFormatted || 'Halt'})</div>
                    <div style="color:#334155;margin-bottom:4px;">${stop.address}</div>
                    <div style="font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:3px;">
                      Arrival: <b>${stop.arrivalIst}</b> • Departure: <b>${stop.departureIst}</b>
                    </div>
                  </div>
                `)
                .addTo(mapRef.current!);

              stopMarkersRef.current.push(sm);
            });
          }
        }
      } catch (err) {
        console.warn('[FieldTrackingMap] Failed to load day route history:', err);
      }
    }

    loadDayRoute();
  }, [initialEmployeeId]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Map instance
    const map = L.map(mapContainerRef.current, {
      center: initialPosition,
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Free OpenStreetMap Cartographic Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | OSRM Routing',
    }).addTo(map);

    // Road-Snapped Polyline
    const polyline = L.polyline([initialPosition], {
      color: '#0284c7', // Sky-600 / Cobalt
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Live Worker Marker
    const marker = L.marker(initialPosition, {
      icon: createPulsingMarkerIcon(0),
      zIndexOffset: 1000,
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <b style="color: #1e293b; font-size: 13px;">${initialEmployeeName}</b>
        <div style="color: #64748b; font-size: 11px; margin-top: 2px;">Field Operations Active</div>
      </div>
    `);

    mapRef.current = map;
    markerRef.current = marker;
    polylineRef.current = polyline;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      polylineRef.current = null;
    };
  }, [initialPosition, initialEmployeeName, createPulsingMarkerIcon]);

  // Handle incoming telemetry and update marker + road-snapped polyline
  const handleIncomingPing = useCallback(
    async (packet: FieldTelemetryPacket) => {
      if (!packet.latitude || !packet.longitude) return;

      const newLat = Number(packet.latitude);
      const newLng = Number(packet.longitude);
      const newCoord: [number, number] = [newLat, newLng];

      setTelemetry((prev) => ({
        ...prev,
        ...packet,
        latitude: newLat,
        longitude: newLng,
        speed: packet.speed ?? prev.speed,
        battery: packet.battery ?? prev.battery,
        timestamp: packet.timestamp || new Date().toISOString(),
      }));

      const map = mapRef.current;
      const marker = markerRef.current;
      const polyline = polylineRef.current;

      if (!map || !marker || !polyline) return;

      // 1. Smoothly pan the map and update marker position
      map.panTo(newCoord, { animate: true, duration: 1.0 });
      marker.setLatLng(newCoord);
      marker.setIcon(createPulsingMarkerIcon(packet.speed ?? 0));

      // 2. Stationary vs Moving Drift Gatekeeper:
      // When stationary (speed < 0.5 m/s or km/h), do NOT append wander coordinates to Leaflet polyline!
      const currentSpeed = Number(packet.speed ?? 0);
      const isMoving = currentSpeed >= 0.5;

      const prevPoints = rawWaypointsRef.current;
      const lastPoint = prevPoints[prevPoints.length - 1];

      // Calculate real distance to last point
      const distMeters = lastPoint
        ? map.distance(L.latLng(lastPoint[0], lastPoint[1]), L.latLng(newLat, newLng))
        : 999;

      // Only append new polyline vertices when worker is moving and has displaced >= 25 meters
      if (isMoving && distMeters >= 25) {
        rawWaypointsRef.current = [...prevPoints, newCoord];

        // 3. Road-Snapping Engine (OSRM Routing Pipeline)
        if (rawWaypointsRef.current.length >= 2) {
          setIsSnappingInProgress(true);
          try {
            const snappedCoords = await fetchRoadGeometry(rawWaypointsRef.current);
            polyline.setLatLngs(snappedCoords);
            setIsRoadSnapped(snappedCoords.length > rawWaypointsRef.current.length);
          } catch {
            // Graceful fallback to raw points
            polyline.setLatLngs(rawWaypointsRef.current);
            setIsRoadSnapped(false);
          } finally {
            setIsSnappingInProgress(false);
          }
        }
      }
    },
    [createPulsingMarkerIcon]
  );

  // Socket.io Real-Time Listener with Authentication & Infinite Reconnection
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('hrms_token') : null;

    const socket = io(`${apiBase}/tracking`, {
      transports: ['websocket', 'polling'],
      auth: { token },
      query: { token },
      reconnection: true,
      reconnectionAttempts: 99,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Dedicated Field Tracking Event: { employeeId, latitude, longitude, speed, battery, timestamp }
    socket.on('field-tracking', (packet: FieldTelemetryPacket) => {
      if (!initialEmployeeId || packet.employeeId === initialEmployeeId) {
        handleIncomingPing(packet);
      }
    });

    // Fallback standard location events
    socket.on('employee_location_updated', (data: any) => {
      if (!initialEmployeeId || data.employeeId === initialEmployeeId) {
        handleIncomingPing({
          employeeId: data.employeeId,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed,
          battery: data.batteryLevel ?? data.battery,
          timestamp: data.timestamp,
        });
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [initialEmployeeId, handleIncomingPing]);

  // Battery icon helper
  const renderBatteryIcon = (pct = 100) => {
    if (pct > 60) return <BatteryCharging className="h-4 w-4 text-emerald-500" />;
    if (pct > 25) return <BatteryMedium className="h-4 w-4 text-amber-500" />;
    return <BatteryLow className="h-4 w-4 text-rose-500" />;
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-xl ${className}`}>
      {/* A. Leaflet Interactive Map View */}
      <div ref={mapContainerRef} style={{ height, width: '100%' }} className="z-0" />

      {/* B. Floating Real-Time Telemetry HUD (Top-Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md border border-slate-200/80 transition-all">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Radio className={`h-5 w-5 ${isConnected ? 'animate-pulse text-indigo-600' : 'text-slate-400'}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                {telemetry.employeeName || initialEmployeeName}
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  (telemetry.speed || 0) >= 0.5
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${(telemetry.speed || 0) >= 0.5 ? 'bg-emerald-500 animate-ping' : 'bg-blue-500'}`} />
                {(telemetry.speed || 0) >= 0.5 ? 'IN TRANSIT' : '● STATIONARY AT SITE (Live)'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 mt-1">
              {/* Speed */}
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-slate-400" />
                <span>{(telemetry.speed || 0).toFixed(1)} km/h</span>
              </div>

              {/* Battery */}
              <div className="flex items-center gap-1.5">
                {renderBatteryIcon(telemetry.battery)}
                <span>{telemetry.battery ?? 100}%</span>
              </div>

              {/* Stops Count */}
              {stops.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                  <MapPin className="h-3 w-3 text-rose-500" />
                  <span>{stops.length} Stops</span>
                </div>
              )}

              {/* GPS Coordinates */}
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span>
                  {telemetry.latitude.toFixed(4)}, {telemetry.longitude.toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* C. OSRM Road-Snapping Status Badge */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-white shadow-md backdrop-blur-md border border-slate-700 w-fit">
          <RouteIcon className="h-3.5 w-3.5 text-cyan-400" />
          <span>
            {isSnappingInProgress
              ? 'OSRM Snapping in Progress...'
              : isRoadSnapped
              ? 'OSRM Road-Snapped Path Active'
              : 'Direct Waypoint Fallback'}
          </span>
          <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] text-cyan-300 font-mono">
            {rawWaypointsRef.current.length} pts
          </span>
        </div>
      </div>

      {/* D. Floating Connection Status Badge (Top-Right) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-md border border-slate-200">
        {isConnected ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-700">Live Socket Active</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-amber-700">Connecting Socket...</span>
          </>
        )}
      </div>

      {/* E. Bottom Controls / Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-xl bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-md backdrop-blur-md border border-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-[#0284c7]" />
          <span>Snapped Road Polyline</span>
        </div>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.panTo([telemetry.latitude, telemetry.longitude], { animate: true });
            }
          }}
          className="text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
        >
          <Navigation className="h-3 w-3" />
          <span>Re-Center</span>
        </button>
      </div>
    </div>
  );
}
