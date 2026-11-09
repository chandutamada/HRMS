'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io, Socket } from 'socket.io-client';
import { MapPin, Navigation, Clock, Battery, Activity } from 'lucide-react';

interface StopItem {
  index: number;
  lat: number;
  lng: number;
  address: string;
  arrivalIst: string;
  departureIst: string;
  durationFormatted: string;
}

interface TimelineItem {
  type: 'ORIGIN' | 'TRANSIT' | 'STOP' | 'DESTINATION';
  title: string;
  address?: string;
  lat?: number;
  lng?: number;
  timeIst?: string;
  arrivalIst?: string;
  departureIst?: string;
  startIst?: string;
  endIst?: string;
  durationFormatted?: string;
  distanceKm?: number;
  speedKmh?: number;
  stopIndex?: number;
  statusBadge: string;
}

export default function FieldTrackingView({
  employeeCode,
  companyId,
}: {
  employeeCode: string;
  companyId: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const lastPolylinePointRef = useRef<[number, number] | null>(null);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stops, setStops] = useState<StopItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [tripSummary, setTripSummary] = useState<any>(null);
  const [livePos, setLivePos] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Leaflet Map safely on client
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [18.1895, 83.3871],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const polyline = L.polyline([], {
      color: '#0284c7',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    mapRef.current = map;
    polylineRef.current = polyline;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      polylineRef.current = null;
    };
  }, []);

  // Fetch History from NestJS Proxy
  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/tracking/history?employeeCode=${encodeURIComponent(employeeCode)}&date=${selectedDate}`
        );
        if (res.ok) {
          const data = await res.json();
          const waypoints: Array<[number, number]> = (data.waypoints || []).map((w: any) => [w.lat, w.lng]);
          const loadedStops: StopItem[] = data.stops || [];

          setStops(loadedStops);
          setTimeline(data.timeline || []);
          setTripSummary(data.tripSummary || null);

          if (mapRef.current && polylineRef.current) {
            polylineRef.current.setLatLngs(waypoints);
            if (waypoints.length > 0) {
              lastPolylinePointRef.current = waypoints[waypoints.length - 1];
            }

            // Clear previous stop markers
            stopMarkersRef.current.forEach((m) => m.remove());
            stopMarkersRef.current = [];

            // Add interactive numbered stop markers
            loadedStops.forEach((stop) => {
              const stopIcon = L.divIcon({
                className: 'stop-marker-icon',
                html: `
                  <div style="background:#ef4444;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.4);cursor:pointer;">
                    ${stop.index}
                  </div>
                `,
                iconSize: [26, 26],
                iconAnchor: [13, 13],
              });

              const stopMarker = L.marker([stop.lat, stop.lng], { icon: stopIcon })
                .bindPopup(`
                  <div style="font-size:12px;font-family:sans-serif;padding:3px;">
                    <b style="color:#b91c1c;">📍 Stop #${stop.index}</b> (${stop.durationFormatted})<br/>
                    <span style="color:#334155;">${stop.address}</span><br/>
                    <div style="margin-top:4px;font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:2px;">
                      Arrival: <b>${stop.arrivalIst}</b> • Departure: <b>${stop.departureIst}</b>
                    </div>
                  </div>
                `)
                .addTo(mapRef.current!);

              stopMarkersRef.current.push(stopMarker);
            });

            if (waypoints.length > 0) {
              mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
            }
          }
        }
      } catch (_) {
      } finally {
        setIsLoading(false);
      }
    }
    loadHistory();
  }, [employeeCode, selectedDate]);

  // Connect Socket.io with Auth Token and Infinite Reconnect
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('hrms_token') : null;

    const socket: Socket = io(`${apiBase}/tracking`, {
      transports: ['websocket', 'polling'],
      auth: { token },
      query: { token },
      reconnection: true,
      reconnectionAttempts: 99,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      socket.emit('join_company', { companyId });
    });

    socket.on('field-tracking', (telemetry: any) => {
      if (telemetry.employeeCode === employeeCode || telemetry.employeeId === employeeCode) {
        setLivePos(telemetry);

        if (mapRef.current) {
          const latLng: [number, number] = [telemetry.latitude, telemetry.longitude];

          // Jitter / Stationary Drift Protection:
          // Do NOT append redundant stationary drift points to the Leaflet polyline
          const speed = Number(telemetry.speedKmh ?? 0);
          const isMoving = speed >= 1.0;

          const lastPt = lastPolylinePointRef.current;
          const dist = lastPt ? mapRef.current.distance(L.latLng(lastPt[0], lastPt[1]), L.latLng(latLng[0], latLng[1])) : 999;

          if (isMoving && dist >= 25) {
            if (polylineRef.current) {
              polylineRef.current.addLatLng(latLng);
            }
            lastPolylinePointRef.current = latLng;
          }

          // Update or create live marker
          if (!markerRef.current) {
            const liveIcon = L.divIcon({
              className: 'live-worker-icon',
              html: `
                <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
                  <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:${isMoving ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)'};animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
                  <div style="position:absolute;width:26px;height:26px;border-radius:50%;background:${isMoving ? '#10b981' : '#2563eb'};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;">${isMoving ? '🚗' : '👷'}</div>
                </div>
              `,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            });

            markerRef.current = L.marker(latLng, { icon: liveIcon })
              .bindPopup(`<b>${telemetry.employeeName || employeeCode}</b><br/>Speed: ${telemetry.speedKmh} km/h`)
              .addTo(mapRef.current);
          } else {
            markerRef.current.setLatLng(latLng);
            markerRef.current.setPopupContent(
              `<b>${telemetry.employeeName || employeeCode}</b><br/>Status: ${isMoving ? 'In Transit' : 'Stationary at Site'}<br/>Speed: ${telemetry.speedKmh} km/h`
            );
          }
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [employeeCode, companyId]);

  const handleFocusPoint = (lat?: number, lng?: number, stopIdx?: number) => {
    if (!lat || !lng || !mapRef.current) return;
    mapRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
    if (stopIdx && stopMarkersRef.current[stopIdx - 1]) {
      stopMarkersRef.current[stopIdx - 1].openPopup();
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-900 text-slate-100">
      {/* Left Sidebar: Detailed Mission Timeline */}
      <div className="w-[420px] flex flex-col border-r border-slate-800 bg-slate-950 p-4 overflow-y-auto">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Field Journey Timeline (IST)</h2>
            {tripSummary && (
              <span className="text-[11px] font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800">
                {tripSummary.totalDistanceKm} km
              </span>
            )}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white border border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Live Telemetry Heartbeat Card */}
        {livePos && (
          <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/30 p-3">
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className={`h-2 w-2 rounded-full ${(livePos.speedKmh || 0) >= 0.5 ? 'bg-emerald-400' : 'bg-blue-400'} animate-ping`} />
                {(livePos.speedKmh || 0) >= 0.5 ? '● IN TRANSIT' : '● STATIONARY AT SITE (Live)'}
              </span>
              <span className="font-mono text-slate-200">{livePos.speedKmh} km/h</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
              <span>Bearing: {livePos.bearing}° · Battery: {livePos.battery ?? 100}%</span>
              <span className="text-slate-500 font-mono text-[10px]">Active Pulse</span>
            </div>
          </div>
        )}

        {/* Granular Timeline Breakdown: Origin -> Transit -> Halt -> Destination */}
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            <span>Mission Segments & Halts ({timeline.length > 0 ? timeline.length : stops.length})</span>
            {stops.length > 0 && <span className="text-rose-400">{stops.length} Checkpoints</span>}
          </div>

          {isLoading ? (
            <p className="text-xs text-slate-500 mt-2">Loading mission route and checkpoints...</p>
          ) : timeline.length > 0 ? (
            timeline.map((item, idx) => {
              const isOrigin = item.type === 'ORIGIN';
              const isTransit = item.type === 'TRANSIT';
              const isStop = item.type === 'STOP';
              const isDest = item.type === 'DESTINATION';

              return (
                <div
                  key={idx}
                  onClick={() => handleFocusPoint(item.lat, item.lng, item.stopIndex)}
                  className={`rounded-xl border p-3 text-xs transition cursor-pointer ${
                    isStop
                      ? 'bg-slate-900 border-rose-900/50 hover:border-rose-500'
                      : isTransit
                      ? 'bg-slate-900/60 border-slate-800 hover:border-cyan-500'
                      : 'bg-slate-900 border-slate-800 hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-white">
                    {isOrigin && <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />}
                    {isTransit && <Navigation className="h-4 w-4 text-cyan-400 shrink-0" />}
                    {isStop && <MapPin className="h-4 w-4 text-rose-500 shrink-0" />}
                    {isDest && <Clock className="h-4 w-4 text-amber-400 shrink-0" />}

                    <span className="truncate">{item.title}</span>

                    <span
                      className={`ml-auto text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isStop
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : isTransit
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {item.statusBadge}
                    </span>
                  </div>

                  {item.address && (
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.address}</p>
                  )}

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 font-mono">
                    {isStop && (
                      <>
                        <span>Arr: {item.arrivalIst}</span>
                        <span>Dep: {item.departureIst}</span>
                        <span className="text-amber-400 font-bold">{item.durationFormatted}</span>
                      </>
                    )}
                    {isTransit && (
                      <>
                        <span>From: {item.startIst}</span>
                        <span>To: {item.endIst}</span>
                        <span className="text-cyan-400 font-bold">{item.durationFormatted}</span>
                      </>
                    )}
                    {(isOrigin || isDest) && (
                      <>
                        <span>Timestamp: {item.timeIst}</span>
                        <span className="text-slate-400">Click to focus →</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : stops.length > 0 ? (
            stops.map((stop) => (
              <div
                key={stop.index}
                onClick={() => handleFocusPoint(stop.lat, stop.lng, stop.index)}
                className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-xs hover:border-rose-500 cursor-pointer transition"
              >
                <div className="flex items-center gap-2 font-semibold text-white">
                  <MapPin className="h-4 w-4 text-rose-500" />
                  <span>Stop #{stop.index}</span>
                  <span className="ml-auto text-[10px] text-amber-400 font-bold">{stop.durationFormatted}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 truncate">{stop.address}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5">
                  <span>Arrival: {stop.arrivalIst}</span>
                  <span>Departure: {stop.departureIst}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 mt-2">No movement or stops recorded for this date.</p>
          )}
        </div>
      </div>

      {/* Main Map Canvas */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
