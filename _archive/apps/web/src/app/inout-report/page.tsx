'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Clock,
  Search,
  Download,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Fingerprint,
  MapPin,
  Layers,
} from 'lucide-react';

export default function InOutReportPage() {
  const { user, activeCompany } = useAuth();

  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any[]>(`/attendance/inout?report_date=${reportDate}`);
      setReportData(res || []);
    } catch (err) {
      console.error('Failed to load In/Out report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportDate, activeCompany]);

  const filteredData = reportData.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(q))
    );
  });

  const total = reportData.length;
  const present = reportData.filter((r) => r.status !== 'absent').length;
  const late = reportData.filter((r) => r.is_late).length;
  const absent = reportData.filter((r) => r.status === 'absent').length;
  const bio = reportData.filter((r) => r.source === 'biometric').length;
  const gps = reportData.filter((r) => r.source === 'gps').length;

  const exportCSV = () => {
    if (!reportData.length) {
      alert('No data to export.');
      return;
    }
    const headers = ['#', 'Name', 'Code', 'Department', 'Source', 'Check In', 'Check Out', 'Hours', 'Location', 'Status'];
    const rows = reportData.map((r, i) => [
      i + 1,
      r.name,
      r.employee_code,
      r.department || '',
      r.source || '',
      r.checkin || '',
      r.checkout || '',
      r.total_hours || 0,
      r.location || '',
      r.is_late ? 'Late' : r.status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_inout_${reportDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium"
          />
          <button
            onClick={loadReport}
            className="px-3.5 py-1.5 bg-blue-600 text-white font-semibold text-xs rounded-xl hover:bg-blue-500 shadow-sm"
          >
            Load Report
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="🔍 Search name / code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
          <div className="text-xl font-black text-slate-700">{total}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total</div>
        </div>

        <div className="p-3 bg-white border-t-2 border-emerald-500 border-x border-b border-slate-200 rounded-xl text-center shadow-sm">
          <div className="text-xl font-black text-emerald-600">{present}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Present</div>
        </div>

        <div className="p-3 bg-white border-t-2 border-amber-500 border-x border-b border-slate-200 rounded-xl text-center shadow-sm">
          <div className="text-xl font-black text-amber-500">{late}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Late</div>
        </div>

        <div className="p-3 bg-white border-t-2 border-rose-500 border-x border-b border-slate-200 rounded-xl text-center shadow-sm">
          <div className="text-xl font-black text-rose-600">{absent}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Absent</div>
        </div>

        <div className="p-3 bg-white border-t-2 border-blue-600 border-x border-b border-slate-200 rounded-xl text-center shadow-sm">
          <div className="text-xl font-black text-blue-600">{bio}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Biometric</div>
        </div>

        <div className="p-3 bg-white border-t-2 border-emerald-600 border-x border-b border-slate-200 rounded-xl text-center shadow-sm">
          <div className="text-xl font-black text-emerald-700">{gps}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">GPS / Field</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="p-3 w-10">#</th>
                <th className="p-3">Name</th>
                <th className="p-3">Code</th>
                <th className="p-3">Department</th>
                <th className="p-3">Source</th>
                <th className="p-3">Check In</th>
                <th className="p-3">Check Out</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">
                    No records found for this date.
                  </td>
                </tr>
              ) : (
                filteredData.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                    <td className="p-3 font-semibold text-slate-900">{r.name}</td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{r.employee_code}</td>
                    <td className="p-3 text-slate-600">{r.department || '—'}</td>
                    <td className="p-3">
                      {r.source === 'biometric' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Fingerprint className="h-3 w-3" />
                          <span>Biometric</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <MapPin className="h-3 w-3" />
                          <span>GPS</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-emerald-600">{r.checkin || '—'}</td>
                    <td className="p-3 text-slate-600">{r.checkout || '—'}</td>
                    <td className="p-3 text-slate-700 font-medium">{r.total_hours > 0 ? `${r.total_hours} hrs` : '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.location === 'In Office' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {r.location}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'present'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.status === 'half_day' || r.is_late
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {r.status === 'present' && !r.is_late
                          ? 'Present'
                          : r.is_late
                          ? 'Late'
                          : r.status === 'half_day'
                          ? 'Half Day'
                          : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
