'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Calendar,
  Download,
  Search,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export default function MonthlySummaryPage() {
  const { user, activeCompany } = useAuth();

  const [month, setMonth] = useState('10');
  const [year, setYear] = useState('2026');
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any[]>(`/attendance/monthly?month=${month}&year=${year}`);
      setSummaryData(res || []);
    } catch (err) {
      console.error('Failed to load monthly summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [month, year, activeCompany]);

  const pctColor = (p: number) => {
    if (p >= 90) return 'text-emerald-600 font-bold';
    if (p >= 75) return 'text-amber-600 font-bold';
    return 'text-rose-600 font-bold';
  };

  const filtered = summaryData.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.employee_name.toLowerCase().includes(q) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(q))
    );
  });

  const exportCSV = () => {
    if (!summaryData.length) return;
    const headers = ['#', 'Name', 'Code', 'Dept', 'Working Days', 'Present', 'Absent', 'Late Days', 'Half Days', '%'];
    const rows = summaryData.map((r, i) => [
      i + 1,
      r.employee_name,
      r.employee_code,
      r.department_name || '',
      r.total_working_days,
      r.present_days,
      r.absent_days,
      r.late_days,
      r.half_days,
      `${r.attendance_percentage}%`,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly_summary_${month}_${year}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium"
          >
            <option value="1">Jan</option>
            <option value="2">Feb</option>
            <option value="3">Mar</option>
            <option value="4">Apr</option>
            <option value="5">May</option>
            <option value="6">Jun</option>
            <option value="7">Jul</option>
            <option value="8">Aug</option>
            <option value="9">Sep</option>
            <option value="10">Oct</option>
            <option value="11">Nov</option>
            <option value="12">Dec</option>
          </select>

          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-20 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium"
          />

          <button
            onClick={loadSummary}
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
                <th className="p-3">Working Days</th>
                <th className="p-3">Present</th>
                <th className="p-3">Absent</th>
                <th className="p-3">Late Days</th>
                <th className="p-3">Half Days</th>
                <th className="p-3 text-right">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">
                    No data found for this month.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.employee_id || i} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                    <td className="p-3 font-semibold text-slate-900">{r.employee_name}</td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{r.employee_code}</td>
                    <td className="p-3 text-slate-600">{r.department_name || '—'}</td>
                    <td className="p-3 text-slate-700 font-medium">{r.total_working_days}</td>
                    <td className="p-3 text-emerald-600 font-semibold">{r.present_days}</td>
                    <td className="p-3 text-rose-600 font-semibold">{r.absent_days}</td>
                    <td className="p-3 text-amber-600 font-semibold">{r.late_days}</td>
                    <td className="p-3 text-indigo-600 font-semibold">{r.half_days}</td>
                    <td className={`p-3 text-right ${pctColor(r.attendance_percentage)}`}>
                      {r.attendance_percentage}%
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
