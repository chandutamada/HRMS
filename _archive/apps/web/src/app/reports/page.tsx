'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  BarChart3,
  Download,
  Users,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Calendar,
} from 'lucide-react';

export default function ReportsPage() {
  const { user, activeCompany } = useAuth();
  const [headcount, setHeadcount] = useState<any[]>([]);
  const [geofenceLogs, setGeofenceLogs] = useState<any[]>([]);
  const [exportDate, setExportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const [hc, geo] = await Promise.all([
        api.get<any[]>('/reports/headcount', {
          companyId: activeCompany?.id,
        }),
        api.get<any[]>('/reports/geofence-validation', {
          companyId: activeCompany?.id,
        }),
      ]);

      setHeadcount(hc || []);
      setGeofenceLogs(geo || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeCompany]);

  const handleDownloadCsv = () => {
    window.open(
      `http://localhost:4000/api/reports/attendance-csv?date=${exportDate}${
        activeCompany?.id ? `&companyId=${activeCompany.id}` : ''
      }`,
      '_blank',
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">HR Reports & Analytics</h1>
          <p className="text-xs text-slate-500">
            Exportable headcount distribution, geofence validation outcomes, and attendance audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={exportDate}
            onChange={(e) => setExportDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium"
          />
          <button
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition"
          >
            <Download className="h-4 w-4" />
            <span>Export Day CSV</span>
          </button>
        </div>
      </div>

      {/* 2-Column: Department Headcount Distribution + Geofence Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Headcount Card */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Users className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Headcount by Department</h3>
          </div>

          <div className="space-y-2.5">
            {headcount.map((hc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs"
              >
                <div>
                  <strong className="block text-slate-800">{hc.departmentName}</strong>
                  <span className="text-[10px] text-slate-400">{hc.companyName}</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  {hc.employeeCount} Staff
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Geofence Validation Logs */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">Geofence Validation Outcomes Log</h3>
            </div>
            <span className="text-xs text-slate-400">Recent GPS Events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">Employee</th>
                  <th className="px-3.5 py-2.5">Event</th>
                  <th className="px-3.5 py-2.5">Distance</th>
                  <th className="px-3.5 py-2.5">Accuracy</th>
                  <th className="px-3.5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {geofenceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No validation logs recorded
                    </td>
                  </tr>
                ) : (
                  geofenceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5">
                        <strong className="text-slate-800">{log.employeeName}</strong>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {log.employeeCode}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 font-mono text-slate-700">
                        {log.eventType}
                      </td>

                      <td className="px-3.5 py-2.5 font-mono font-semibold">
                        {log.distanceMeters}m
                      </td>

                      <td className="px-3.5 py-2.5 font-mono text-slate-500">
                        ±{log.accuracyMeters}m
                      </td>

                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            log.isWithinGeofence
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {log.validationStatus}
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
    </div>
  );
}
