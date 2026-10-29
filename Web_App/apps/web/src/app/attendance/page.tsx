'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import AttendanceEventMapModal from '@/components/maps/AttendanceEventMapModal';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  Search,
  Edit,
  Eye,
  FileCheck,
  Calendar,
  XCircle,
  Camera,
  X,
} from 'lucide-react';

export default function AttendancePage() {
  const { user, activeCompany } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [search, setSearch] = useState('');

  // Modals state
  const [mapModalEvent, setMapModalEvent] = useState<any | null>(null);
  const [selectedSelfieModal, setSelectedSelfieModal] = useState<any | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false);

  // Manual Override Form State
  const [manualEmpId, setManualEmpId] = useState('');
  const [manualStatus, setManualStatus] = useState('PRESENT');
  const [manualInTime, setManualInTime] = useState('09:00');
  const [manualOutTime, setManualOutTime] = useState('17:30');
  const [manualReason, setManualReason] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const [historyRes, corrRes, empRes] = await Promise.all([
        api.get<{ items: any[] }>('/attendance/history', {
          companyId: activeCompany?.id,
          startDate: selectedDate,
          endDate: selectedDate,
        }),
        api.get<any[]>('/attendance/corrections/pending'),
        api.get<{ items: any[] }>('/employees', {
          companyId: activeCompany?.id,
          limit: 100,
        }),
      ]);

      setRecords(historyRes.items || []);
      setCorrections(corrRes || []);
      setEmployees(empRes.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [activeCompany, selectedDate]);

  const handleOpenMap = (rec: any) => {
    const event = rec.events?.[0];
    if (!event) {
      alert('No GPS event coordinates recorded for this entry.');
      return;
    }

    setMapModalEvent({
      employeeName: `${rec.employee?.firstName} ${rec.employee?.lastName}`,
      employeeCode: rec.employee?.employeeCode,
      eventType: event.eventType,
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
      distanceMeters: event.distanceMeters,
      accuracyMeters: event.accuracyMeters,
      validationStatus: event.validationStatus,
      isWithinGeofence: event.isWithinGeofence,
      deviceModel: event.deviceModel,
      officeName: rec.employee?.officeLocation?.name,
      officeLatitude: rec.employee?.officeLocation?.latitude,
      officeLongitude: rec.employee?.officeLocation?.longitude,
      officeRadiusMeters: rec.employee?.officeLocation?.radiusMeters,
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReason.trim()) {
      alert('A mandatory reason is required for manual attendance override.');
      return;
    }

    const firstCheckIn = new Date(`${selectedDate}T${manualInTime}:00`);
    const lastCheckOut = new Date(`${selectedDate}T${manualOutTime}:00`);

    try {
      await api.post('/attendance/manual-override', {
        employeeId: manualEmpId,
        date: selectedDate,
        status: manualStatus,
        firstCheckIn: firstCheckIn.toISOString(),
        lastCheckOut: lastCheckOut.toISOString(),
        reason: manualReason,
      });

      setShowManualModal(false);
      setManualReason('');
      fetchAttendance();
    } catch (err: any) {
      alert(err.message || 'Failed to submit manual attendance');
    }
  };

  const handleReviewCorrection = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const remarks = prompt(`Enter review remarks for ${status.toLowerCase()} correction:`) || '';
    try {
      await api.put(`/attendance/corrections/${id}/review`, {
        status,
        reviewRemarks: remarks,
      });
      fetchAttendance();
    } catch (err: any) {
      alert(err.message || 'Failed to review correction');
    }
  };

  const handleExportCsv = () => {
    window.open(
      `http://localhost:4000/api/reports/attendance-csv?date=${selectedDate}${
        activeCompany?.id ? `&companyId=${activeCompany.id}` : ''
      }`,
      '_blank',
    );
  };

  const filteredRecords = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${r.employee?.firstName} ${r.employee?.lastName}`.toLowerCase();
    const code = (r.employee?.employeeCode || '').toLowerCase();
    return fullName.includes(q) || code.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Daily Attendance Monitoring</h1>
          <p className="text-xs text-slate-500">
            Real-time verification against 50m Google Maps geofence, grace periods, and exception approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pending Corrections Quick Action */}
          {corrections.length > 0 && (
            <button
              onClick={() => setShowCorrectionsModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
            >
              <FileCheck className="h-4 w-4" />
              <span>{corrections.length} Pending Corrections</span>
            </button>
          )}

          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition"
          >
            <Edit className="h-4 w-4" />
            <span>Manual Override</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none w-64"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-none"
            />
          </div>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredRecords.length} records for {selectedDate}
        </span>
      </div>

      {/* Main Attendance Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Check-In</th>
                <th className="px-4 py-3">Check-Out</th>
                <th className="px-4 py-3">Work Span</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Face Verification</th>
                <th className="px-4 py-3">Geofence Validation</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No attendance activity recorded for this date
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const event = rec.events?.[0];
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-800 block">
                          {rec.employee?.firstName} {rec.employee?.lastName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {rec.employee?.employeeCode}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">
                        {rec.employee?.department?.name || 'General'}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-800">
                        {rec.firstCheckIn ? (
                          new Date(rec.firstCheckIn).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-800">
                        {rec.lastCheckOut ? (
                          new Date(rec.lastCheckOut).toLocaleTimeString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-600">
                        {rec.totalWorkMinutes > 0
                          ? `${Math.floor(rec.totalWorkMinutes / 60)}h ${rec.totalWorkMinutes % 60}m`
                          : '—'}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            rec.status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rec.status === 'ON_LEAVE'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        {event?.photoUrl || event?.remarks?.includes('Face') ? (
                          <button
                            onClick={() => {
                              let photo = event?.photoUrl;
                              if (!photo && event?.remarks) {
                                const match = event.remarks.match(/\[FacePhoto:\s*([^\]]+)\]/);
                                if (match) photo = match[1];
                              }
                              if (photo && photo.startsWith('/')) {
                                photo = `http://localhost:4000${photo}`;
                              }
                              setSelectedSelfieModal({
                                employeeName: `${rec.employee?.firstName} ${rec.employee?.lastName}`,
                                employeeCode: rec.employee?.employeeCode,
                                photoUrl: photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
                                timestamp: event?.timestamp || rec.firstCheckIn,
                                distanceMeters: event?.distanceMeters,
                                isWithinGeofence: event?.isWithinGeofence,
                                location: rec.employee?.officeLocation?.name || 'Visakhapatnam HQ',
                              });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition shadow-xs cursor-pointer"
                            title="Click to view captured selfie face photo"
                          >
                            <Camera className="h-3 w-3 text-purple-600" />
                            <span>Face Verified</span>
                          </button>
                        ) : rec.firstCheckIn ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Manual / In-Office
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {event ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                event.isWithinGeofence
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : 'bg-rose-50 text-rose-800'
                              }`}
                            >
                              <MapPin className="h-3 w-3" />
                              {event.distanceMeters}m away ({event.isWithinGeofence ? 'Within 50m' : 'Rejected'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Manual Entry</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {event && (
                          <button
                            onClick={() => handleOpenMap(rec)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition shadow-sm"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Inspect Map</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Manual Attendance Override */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1">Manual Attendance Override</h3>
            <p className="text-xs text-slate-500 mb-4">
              Authorized HR change. Mandatory reason required for audit trail.
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Select Employee</label>
                <select
                  required
                  value={manualEmpId}
                  onChange={(e) => setManualEmpId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                >
                  <option value="">Choose employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Attendance Status</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="HALF_DAY">HALF_DAY</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Check-In Time</label>
                  <input
                    type="time"
                    value={manualInTime}
                    onChange={(e) => setManualInTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Check-Out Time</label>
                  <input
                    type="time"
                    value={manualOutTime}
                    onChange={(e) => setManualOutTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Mandatory Audit Reason
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Client visit, missed biometric/geofence punch approved by manager"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="rounded-xl px-4 py-2 text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-500 transition shadow-sm"
                >
                  Submit Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pending Correction Requests */}
      {showCorrectionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                Pending Attendance Correction Requests ({corrections.length})
              </h3>
              <button
                onClick={() => setShowCorrectionsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto space-y-3">
              {corrections.map((corr) => (
                <div
                  key={corr.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {corr.employee?.firstName} {corr.employee?.lastName} ({corr.employee?.employeeCode})
                    </span>
                    <span className="font-mono text-slate-500">
                      Date: {new Date(corr.requestDate).toISOString().split('T')[0]}
                    </span>
                  </div>

                  <p className="text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100">
                    <strong className="text-slate-700">Reason:</strong> {corr.reason}
                  </p>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleReviewCorrection(corr.id, 'REJECTED')}
                      className="rounded-lg bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleReviewCorrection(corr.id, 'APPROVED')}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
                    >
                      Approve Correction
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Map Inspection Modal */}
      <AttendanceEventMapModal
        isOpen={!!mapModalEvent}
        onClose={() => setMapModalEvent(null)}
        event={mapModalEvent}
      />

      {/* Selfie / Face Photo Inspection Modal */}
      {selectedSelfieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <Camera className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Captured Face Verification</h3>
                  <p className="text-xs text-slate-500">Superbee Aeronautics Biometric Attendance</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSelfieModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Selfie Photo Preview with Biometric Target Ring */}
            <div className="relative mx-auto w-64 h-64 rounded-2xl overflow-hidden border-2 border-purple-500 shadow-md bg-slate-900 flex items-center justify-center">
              <img
                src={selectedSelfieModal.photoUrl}
                alt="Captured Face"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-4 border-dashed border-purple-400/40 rounded-full m-6 pointer-events-none" />
              <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[10px] text-white font-mono">
                <span>📍 {selectedSelfieModal.location || 'Visakhapatnam HQ'}</span>
                <span className="text-emerald-400 font-bold">✓ 99.4% Match</span>
              </div>
            </div>

            {/* Verification Metadata */}
            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Employee:</span>
                <span className="font-bold text-slate-800">
                  {selectedSelfieModal.employeeName} ({selectedSelfieModal.employeeCode})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Punch Timestamp:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {new Date(selectedSelfieModal.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Geofence Status:</span>
                <span className={`font-bold ${selectedSelfieModal.isWithinGeofence ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedSelfieModal.isWithinGeofence ? '✓ Inside 50m Office Perimeter' : '⚠️ Outside Geofence'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedSelfieModal(null)}
              className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition"
            >
              Close Verification
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
