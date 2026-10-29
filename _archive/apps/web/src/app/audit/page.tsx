'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ShieldAlert, Search, Filter } from 'lucide-react';

export default function AuditLogsPage() {
  const { user, activeCompany } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<{ items: any[] }>('/audit-logs', {
        companyId: activeCompany?.id,
        action: actionFilter || undefined,
        limit: 50,
      });
      setLogs(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeCompany, actionFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Audit Trails</h1>
        <p className="text-xs text-slate-500">
          Immutable audit records of sensitive HR actions: attendance overrides, geofence radius updates, leave approvals, and payroll modifications.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700">Filter Action:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-medium"
          >
            <option value="">All Actions</option>
            <option value="GEOFENCE_UPDATED">GEOFENCE_UPDATED</option>
            <option value="MANUAL_ATTENDANCE_OVERRIDE">MANUAL_ATTENDANCE_OVERRIDE</option>
            <option value="ATTENDANCE_CORRECTION_APPROVED">ATTENDANCE_CORRECTION_APPROVED</option>
            <option value="PAYROLL_OVERRIDE">PAYROLL_OVERRIDE</option>
            <option value="PAYROLL_FINALIZED">PAYROLL_FINALIZED</option>
            <option value="EMPLOYEE_CREATED">EMPLOYEE_CREATED</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Total Logged Events: {logs.length}
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Mandatory Reason</th>
                <th className="px-4 py-3">Values Changed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    No audit records recorded yet
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-800">
                        {log.action}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {log.entityName}
                    </td>

                    <td className="px-4 py-3 text-slate-600 font-sans">
                      {log.actorEmail || 'System'}
                    </td>

                    <td className="px-4 py-3 font-sans text-slate-800 max-w-xs truncate">
                      {log.reason || '—'}
                    </td>

                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {log.afterJson || '—'}
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
