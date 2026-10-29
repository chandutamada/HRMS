'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import dynamic from 'next/dynamic';

const GoogleGeofenceMap = dynamic(
  () => import('@/components/maps/GoogleGeofenceMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[380px] w-full rounded-2xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2 border border-slate-200">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <span className="text-xs font-medium">Loading OpenStreetMap Geofence Visualizer...</span>
      </div>
    ),
  }
);
import {
  MapPin,
  Plus,
  Sliders,
  History,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Navigation,
  Compass,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export default function OfficesPage() {
  const { user, activeCompany } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit / Geofence Update Form State
  const [editLat, setEditLat] = useState<number>(13.0498300);
  const [editLng, setEditLng] = useState<number>(77.6202400);
  const [editRadius, setEditRadius] = useState<number>(50);
  const [updateReason, setUpdateReason] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Distance Test Simulator State
  const [simLat, setSimLat] = useState<number>(13.0498350);
  const [simLng, setSimLng] = useState<number>(77.6202420);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Delete Office State
  const [deletingOffice, setDeletingOffice] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create Office Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeCode, setNewOfficeCode] = useState('');
  const [newOfficeAddress, setNewOfficeAddress] = useState('');
  const [newOfficeLat, setNewOfficeLat] = useState(13.04983);
  const [newOfficeLng, setNewOfficeLng] = useState(77.62024);
  const [newOfficeRadius, setNewOfficeRadius] = useState(50);

  const fetchOffices = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<any[]>('/offices', {
        companyId: activeCompany?.id,
      });
      setOffices(data);
      if (data.length > 0) {
        setSelectedOffice(data[0]);
        setEditLat(data[0].latitude);
        setEditLng(data[0].longitude);
        setEditRadius(data[0].radiusMeters);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOffices();
  }, [activeCompany]);

  const handleSelectOffice = (office: any) => {
    setSelectedOffice(office);
    setEditLat(office.latitude);
    setEditLng(office.longitude);
    setEditRadius(office.radiusMeters);
    setMessage(null);
    setSimResult(null);
  };

  const handleUpdateGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffice) return;
    if (!updateReason.trim()) {
      setMessage({ type: 'error', text: 'A mandatory reason is required to modify geofence configuration' });
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const res = await api.put(`/offices/${selectedOffice.id}/geofence`, {
        latitude: editLat,
        longitude: editLng,
        radiusMeters: editRadius,
        reason: updateReason,
      });

      setMessage({ type: 'success', text: `Geofence updated to ${editRadius}m radius. Audit entry recorded.` });
      setUpdateReason('');
      fetchOffices();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update geofence' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSimulateDistance = async () => {
    if (!selectedOffice) return;
    setIsSimulating(true);
    try {
      const res = await api.post('/offices/test-distance', {
        officeId: selectedOffice.id,
        latitude: Number(simLat),
        longitude: Number(simLng),
      });
      setSimResult(res);
    } catch (err: any) {
      alert(err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleDeleteOffice = async () => {
    if (!deletingOffice) return;
    setIsDeleting(true);
    try {
      await api.delete(`/offices/${deletingOffice.id}`);
      setMessage({
        type: 'success',
        text: `Office "${deletingOffice.name}" successfully removed.`,
      });
      const remaining = offices.filter((o) => o.id !== deletingOffice.id);
      setDeletingOffice(null);
      if (selectedOffice?.id === deletingOffice.id) {
        if (remaining.length > 0) {
          handleSelectOffice(remaining[0]);
        } else {
          setSelectedOffice(null);
        }
      }
      await fetchOffices();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to remove office location',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/offices', {
        name: newOfficeName,
        code: newOfficeCode,
        address: newOfficeAddress,
        latitude: Number(newOfficeLat),
        longitude: Number(newOfficeLng),
        radiusMeters: Number(newOfficeRadius),
        companyId: activeCompany?.id,
      });
      setShowCreateModal(false);
      fetchOffices();
    } catch (err: any) {
      alert(err.message || 'Error creating office');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Office Geofence Configuration</h1>
          <p className="text-xs text-slate-500">
            Configure Google Maps office geofence coordinates and default 50-metre attendance validation boundary.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Office Location</span>
        </button>
      </div>

      {/* Main Grid: Office List + Interactive Map & Geofence Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Office Selection List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Office Locations ({offices.length})
            </h3>
            <div className="space-y-2">
              {offices.map((office) => {
                const isSelected = selectedOffice?.id === office.id;
                return (
                  <div
                    key={office.id}
                    onClick={() => handleSelectOffice(office)}
                    className={`group relative w-full rounded-xl border p-3.5 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                        : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">{office.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{office.code}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          {office.radiusMeters}m
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingOffice(office);
                          }}
                          title="Remove this office location"
                          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition opacity-80 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-slate-500 line-clamp-1">{office.address}</p>

                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/50 pt-2 text-[10px] text-slate-400 font-mono">
                      <span>{office.latitude.toFixed(4)}, {office.longitude.toFixed(4)}</span>
                      <span>{office._count?.employees || 0} Employees Assigned</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Haversine Distance Test Simulator */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-800">Distance Validation Simulator</h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Test how employee coordinates evaluate against the {selectedOffice?.radiusMeters || 50}m geofence.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Simulated Lat</label>
                <input
                  type="number"
                  step="0.000001"
                  value={simLat}
                  onChange={(e) => setSimLat(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Simulated Lng</label>
                <input
                  type="number"
                  step="0.000001"
                  value={simLng}
                  onChange={(e) => setSimLng(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSimulateDistance}
              disabled={isSimulating}
              className="w-full rounded-xl bg-slate-800 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition"
            >
              {isSimulating ? 'Evaluating...' : 'Run Haversine Distance Check'}
            </button>

            {simResult && (
              <div
                className={`rounded-xl p-3 border text-xs ${
                  simResult.isWithinGeofence
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{simResult.status}</span>
                  <span>{simResult.distanceMeters}m away</span>
                </div>
                <p className="mt-1 text-[11px]">
                  {simResult.isWithinGeofence
                    ? `Within ${simResult.geofenceRadiusMeters}m geofence radius. Attendance event will succeed.`
                    : `Outside ${simResult.geofenceRadiusMeters}m radius (${simResult.distanceMeters}m). Attendance check will be rejected.`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Map View & Geofence Editor */}
        <div className="lg:col-span-2 space-y-4">
          {selectedOffice ? (
            <>
              {/* Google Maps Visualizer */}
              <GoogleGeofenceMap
                key={selectedOffice.id}
                initialLat={selectedOffice.latitude}
                initialLng={selectedOffice.longitude}
                radiusMeters={editRadius}
                officeName={selectedOffice.name}
                isEditable={true}
                onLocationChange={(newLat, newLng) => {
                  setEditLat(newLat);
                  setEditLng(newLng);
                }}
                onRadiusChange={(newRad) => setEditRadius(newRad)}
                height="380px"
              />

              {/* Geofence Configuration & Audit Form */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Update Geofence Parameters for {selectedOffice.name}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Default: 50m
                  </span>
                </div>

                {message && (
                  <div
                    className={`mt-4 rounded-xl p-3 text-xs flex items-center gap-2 ${
                      message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {message.type === 'success' ? (
                      <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{message.text}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateGeofence} className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editLat}
                        onChange={(e) => setEditLat(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editLng}
                        onChange={(e) => setEditLng(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Radius (Metres)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        value={editRadius}
                        onChange={(e) => setEditRadius(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-emerald-700"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Mandatory Reason for Change (Audit Log Required)
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="e.g. Office expansion, calibrated GPS coordinates for south entrance gate"
                      value={updateReason}
                      onChange={(e) => setUpdateReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingOffice(selectedOffice)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove Office Location</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition"
                    >
                      {isUpdating ? 'Recording Geofence Change...' : 'Save Geofence Configuration'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              No office location selected
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add Office Location */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1">Add New Office Location</h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure coordinates and geofence for company office.
            </p>

            <form onSubmit={handleCreateOffice} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Office Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pune Tech Park Branch"
                  value={newOfficeName}
                  onChange={(e) => setNewOfficeName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Office Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PN-01"
                    value={newOfficeCode}
                    onChange={(e) => setNewOfficeCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Radius (Metres)</label>
                  <input
                    type="number"
                    min="20"
                    max="500"
                    value={newOfficeRadius}
                    onChange={(e) => setNewOfficeRadius(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Address</label>
                <input
                  type="text"
                  required
                  placeholder="Street address, city, state, pin"
                  value={newOfficeAddress}
                  onChange={(e) => setNewOfficeAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newOfficeLat}
                    onChange={(e) => setNewOfficeLat(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newOfficeLng}
                    onChange={(e) => setNewOfficeLng(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-500 transition shadow-sm"
                >
                  Save Office Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Remove Office Location */}
      {deletingOffice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 border border-red-100 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Remove Office Location?</h3>
                <p className="text-xs text-slate-500 font-mono">{deletingOffice.name} ({deletingOffice.code})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to remove this office location? Any assigned employees ({deletingOffice._count?.employees || 0} staff) will be safely unlinked to protect company records, and geofence audit history will be archived.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingOffice(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOffice}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isDeleting ? 'Removing Office...' : 'Yes, Remove Office'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
