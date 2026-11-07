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

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stops, setStops] = useState<StopItem[]>([]);
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
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const polyline = L.polyline([], {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.85,
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

          if (mapRef.current && polylineRef.current) {
            polylineRef.current.setLatLngs(waypoints);

            // Clear previous stop markers
            stopMarkersRef.current.forEach((m) => m.remove());
            stopMarkersRef.current = [];

            // Add stop markers
            loadedStops.forEach((stop) => {
              const stopIcon = L.divIcon({
                className: 'stop-marker-icon',
                html: `
                  <div style="background:#ef4444;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
                    ${stop.index}
                  </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              });

              const stopMarker = L.marker([stop.lat, stop.lng], { icon: stopIcon })
                .bindPopup(`
                  <div style="font-size:12px;font-family:sans-serif;">
                    <b>Stop #${stop.index}</b> (${stop.durationFormatted})<br/>
                    ${stop.address}<br/>
                    Time: ${stop.arrivalIst} – ${stop.departureIst}
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

  // Connect Socket.io for Real-Time Moving Marker
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const socket: Socket = io(socketUrl, {
      path: '/tracking/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_company', { companyId });
    });

    socket.on('field-tracking', (telemetry: any) => {
      if (telemetry.employeeCode === employeeCode) {
        setLivePos(telemetry);

        if (mapRef.current) {
          const latLng: [number, number] = [telemetry.latitude, telemetry.longitude];

          // Add point to polyline
          if (polylineRef.current) {
            polylineRef.current.addLatLng(latLng);
          }

          // Update or create live marker
          if (!markerRef.current) {
            const liveIcon = L.divIcon({
              className: 'live-worker-icon',
              html: `
                <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
                  <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.35);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
                  <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:#2563eb;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;">🚗</div>
                </div>
              `,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            });

            markerRef.current = L.marker(latLng, { icon: liveIcon })
              .bindPopup(`<b>${telemetry.employeeName || employeeCode}</b><br/>Speed: ${telemetry.speedKmh} km/h`)
              .addTo(mapRef.current);
          } else {
            markerRef.current.setLatLng(latLng);
            markerRef.current.setPopupContent(
              `<b>${telemetry.employeeName || employeeCode}</b><br/>Speed: ${telemetry.speedKmh} km/h`
            );
          }
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [employeeCode, companyId]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-900 text-slate-100">
      {/* Left Sidebar: Mission Stop Timeline */}
      <div className="w-96 flex flex-col border-r border-slate-800 bg-slate-950 p-4 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Mission Timeline (IST)</h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white border border-slate-700 focus:outline-none"
          />
        </div>

        {/* Live Telemetry Card */}
        {livePos && (
          <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-400 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Live Telemetry
              </span>
              <span>{livePos.speedKmh} km/h</span>
            </div>
            <div className="text-[11px] text-slate-300">
              Bearing: {livePos.bearing}° · Battery: {livePos.battery ?? '--'}%
            </div>
          </div>
        )}

        {/* Stops List */}
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          <span className="text-[11px] font-semibold uppercase text-slate-500">Stops & Landfalls ({stops.length})</span>
          {isLoading ? (
            <p className="text-xs text-slate-500 mt-2">Loading mission route...</p>
          ) : stops.length === 0 ? (
            <p className="text-xs text-slate-500 mt-2">No stationary stops recorded for this date.</p>
          ) : (
            stops.map((stop) => (
              <div key={stop.index} className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-xs">
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
