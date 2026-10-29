'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Calendar,
  Download,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

export default function DailyReportPage() {
  const { user, activeCompany } = useAuth();

  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any[]>(`/attendance/daily?report_date=${reportDate}`);
      setReportData(res || []);
    } catch (err) {
      console.error('Failed to load daily report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportDate, activeCompany]);

  const fmtLate = (m: number) => {
    if (!m) return '—';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h ? `${h}h ${mm}m` : `${mm}m`;
  };

  const filtered = reportData.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.employee_name.toLowerCase().includes(q) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(q))
    );
  });

  const exportCSV = () => {
    if (!reportData.length) return;
    const headers = ['#', 'Employee', 'Code', 'Department', 'Status', 'First In', 'Last Out', 'Hours', 'Late By', 'Early Exit'];
    const rows = reportData.map((r, i) => [
      i + 1,
      r.employee_name,
      r.employee_code,
      r.department_name || '',
      r.status,
      r.first_in ? new Date(r.first_in).toLocaleTimeString() : '',
      r.last_out ? new Date(r.last_out).toLocaleTimeString() : '',
      r.total_hours || 0,
      r.late_minutes || 0,
      r.early_exit_minutes || 0,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_daily_${reportDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Filter Bar */}
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
            Load
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="p-3 w-10">#</th>
                <th className="p-3">Employee</th>
                <th className="p-3">Code</th>
                <th className="p-3">Department</th>
                <th className="p-3">Status</th>
                <th className="p-3">First In</th>
                <th className="p-3">Last Out</th>
                <th className="p-3">Total Hours</th>
                <th className="p-3">Late By</th>
                <th className="p-3">Early Exit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">
                    No records found for this date.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.employee_id || i} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                    <td className="p-3 font-semibold text-slate-900">{r.employee_name}</td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{r.employee_code}</td>
                    <td className="p-3 text-slate-600">{r.department_name || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'present'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.status === 'late'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : r.status === 'half_day'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {r.status === 'present'
                          ? 'Present'
                          : r.status === 'late'
                          ? 'Late'
                          : r.status === 'half_day'
                          ? 'Half Day'
                          : 'Absent'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-emerald-600">
                      {r.first_in ? new Date(r.first_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="p-3 text-slate-600">
                      {r.last_out ? new Date(r.last_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="p-3 text-slate-700 font-medium">{r.total_hours > 0 ? `${r.total_hours} hrs` : '—'}</td>
                    <td className="p-3">
                      {r.late_minutes > 0 ? (
                        <span className="text-amber-600 font-semibold">{fmtLate(r.late_minutes)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3">
                      {r.early_exit ? (
                        <span className="text-rose-600 font-semibold">{r.early_exit_minutes} min early</span>
                      ) : (
                        '—'
                      )}
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
