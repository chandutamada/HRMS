'use client';

import React from 'react';
import { X, MapPin, ShieldCheck, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';
import dynamic from 'next/dynamic';

const GoogleGeofenceMap = dynamic(
  () => import('./GoogleGeofenceMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] w-full rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
        Loading Event Location Map...
      </div>
    ),
  }
);

interface AttendanceEventMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    employeeName: string;
    employeeCode: string;
    eventType: string;
    timestamp: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
    accuracyMeters: number;
    validationStatus: string;
    isWithinGeofence: boolean;
    deviceModel?: string;
    officeName?: string;
    officeLatitude?: number;
    officeLongitude?: number;
    officeRadiusMeters?: number;
  } | null;
}

export default function AttendanceEventMapModal({
  isOpen,
  onClose,
  event,
}: AttendanceEventMapModalProps) {
  if (!isOpen || !event) return null;

  const officeLat = event.officeLatitude || event.latitude;
  const officeLng = event.officeLongitude || event.longitude;
  const radius = event.officeRadiusMeters || 50;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              Attendance Event Location Inspection
            </h3>
            <p className="text-xs text-slate-500">
              {event.employeeName} ({event.employeeCode}) • {event.eventType} at {new Date(event.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-100/70 border-b border-slate-200 text-xs">
          <div className="rounded-lg bg-white p-2.5 shadow-sm border border-slate-200">
            <span className="text-slate-500 block">Validation Outcome</span>
            <div className="mt-1 flex items-center gap-1.5 font-semibold">
              {event.isWithinGeofence ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle className="h-3.5 w-3.5" /> Inside Geofence
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Outside Geofence
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-white p-2.5 shadow-sm border border-slate-200">
            <span className="text-slate-500 block">Distance to Office</span>
            <span className="mt-1 block font-mono font-bold text-slate-800 text-sm">
              {event.distanceMeters} metres
            </span>
          </div>

          <div className="rounded-lg bg-white p-2.5 shadow-sm border border-slate-200">
            <span className="text-slate-500 block">GPS Accuracy</span>
            <span className="mt-1 block font-mono text-slate-700">
              ±{event.accuracyMeters}m
            </span>
          </div>

          <div className="rounded-lg bg-white p-2.5 shadow-sm border border-slate-200">
            <span className="text-slate-500 block">Device Details</span>
            <div className="mt-1 flex items-center gap-1 text-slate-700 truncate">
              <Smartphone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.deviceModel || 'Android Mobile'}</span>
            </div>
          </div>
        </div>

        {/* Map View */}
        <div className="p-4">
          <GoogleGeofenceMap
            initialLat={officeLat}
            initialLng={officeLng}
            radiusMeters={radius}
            officeName={event.officeName || 'Assigned Office Geofence'}
            isEditable={false}
            height="320px"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 bg-slate-50 text-xs text-slate-500">
          <span>Coordinates: {event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-900 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
