'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { MapPin, Navigation, Clock, Battery, Activity } from 'lucide-react';

// Leaflet dynamic import to prevent SSR window issues in Next.js
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((m) => m.Polyline), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

export default function FieldTrackingView({
  employeeCode,
  companyId,
}: {
  employeeCode: string;
  companyId: string;
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [livePos, setLivePos] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch History from NestJS Proxy
  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/tracking/history?employeeCode=${encodeURIComponent(employeeCode)}&date=${selectedDate}`);
        if (res.ok) {
          const data = await res.json();
          if (data.waypoints) {
            setWaypoints(data.waypoints.map((w: any) => [w.lat, w.lng]));
          }
          if (data.stops) {
            setStops(data.stops);
          }
        }
      } catch (_) {
      } finally {
        setIsLoading(false);
      }
    }
    loadHistory();
  }, [employeeCode, selectedDate]);

  // 2. Connect Socket.io for Real-Time Moving Marker
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
        // Append live fix to polyline dynamically
        setWaypoints((prev) => [...prev, [telemetry.latitude, telemetry.longitude]]);
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

      {/* Main Map View */}
      <div className="flex-1 relative">
        <MapContainer
          center={livePos ? [livePos.latitude, livePos.longitude] : (waypoints[0] || [18.1895, 83.3871])}
          zoom={14}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Road-accurate Polyline */}
          {waypoints.length > 1 && (
            <Polyline
              positions={waypoints}
              pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.8, lineJoin: 'round' }}
            />
          )}

          {/* Stop Markers */}
          {stops.map((stop) => (
            <Marker key={stop.index} position={[stop.lat, stop.lng]}>
              <Popup>
                <div className="text-xs font-sans">
                  <b>Stop #{stop.index}</b> ({stop.durationFormatted})<br />
                  {stop.address}<br />
                  Time: {stop.arrivalIst} – {stop.departureIst}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Live Position Marker */}
          {livePos && (
            <Marker position={[livePos.latitude, livePos.longitude]}>
              <Popup>
                <div className="text-xs">
                  <b>{livePos.employeeName}</b><br />
                  Speed: {livePos.speedKmh} km/h<br />
                  Battery: {livePos.battery}%
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
