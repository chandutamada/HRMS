'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Award,
  AlertCircle,
} from 'lucide-react';

export default function CalendarPage() {
  const { user, activeCompany } = useAuth();
  const [selectedType, setSelectedType] = useState<
    'Holidays' | 'Payslips' | 'Attendance' | 'Office Timing'
  >('Holidays');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const fetchCalendar = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/calendar/view', {
        type: selectedType,
        year,
        month,
        companyId: activeCompany?.id,
      });
      setCalendarData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [selectedType, year, month, activeCompany]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Organization Calendar</h1>
          <p className="text-xs text-slate-500">
            Interactive multi-view calendar: Holidays, Payslips, Attendance, and Office Timing.
          </p>
        </div>

        {/* Dropdown Selector above Calendar (Mandatory requirement) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700">Calendar View:</label>
          <select
            value={selectedType}
            onChange={(e: any) => setSelectedType(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="Holidays">📅 Holidays</option>
            <option value="Payslips">💰 Payslips</option>
            <option value="Attendance">⏱️ Attendance</option>
            <option value="Office Timing">🏢 Office Timing</option>
          </select>
        </div>
      </div>

      {/* Month Navigation & View Indicator */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevMonth}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-bold text-slate-800">
            {monthNames[month - 1]} {year}
          </h2>
          <button
            onClick={handleNextMonth}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
          Showing: {selectedType}
        </span>
      </div>

      {/* Content based on Dropdown Selection */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {selectedType === 'Holidays' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Holidays for {monthNames[month - 1]} {year}
            </h3>
            {calendarData?.items?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No official company holidays scheduled in {monthNames[month - 1]} {year}.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {calendarData?.items?.map((h: any) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">{h.name}</span>
                      <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-mono text-emerald-800 font-bold">
                        {new Date(h.date).toISOString().split('T')[0]}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700">Official Company Holiday</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedType === 'Office Timing' && (
          <div className="max-w-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Standard Scheduled Office Working Hours</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Applicable to all 3 companies (Superbee Aeronautics, GTIDS, GTIB). Standard fixed schedule (no rotational shifts).</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600 font-medium">Office Start Time:</span>
                <strong className="text-slate-900 font-mono">09:00 AM IST</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600 font-medium">Lunch Break Window:</span>
                <strong className="text-slate-900 font-mono">01:00 PM – 02:00 PM IST (1 Hour)</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600 font-medium">Office End Time:</span>
                <strong className="text-slate-900 font-mono">05:30 PM IST</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600 font-medium">Standard Grace Period:</span>
                <strong className="text-emerald-700 font-semibold">30 Minutes (Up to 09:30 AM is On-Time)</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-600 font-medium">Eligible Late Exception:</span>
                <strong className="text-slate-900">Up to 60 Minutes (Subject to HR Approval)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Scheduled Work Span:</span>
                <strong className="text-slate-900 font-mono">8h 30m Gross Span (7h 30m Net Work)</strong>
              </div>
            </div>
          </div>
        )}

        {selectedType === 'Payslips' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Payslip Availability for {monthNames[month - 1]} {year}
            </h3>
            {calendarData?.items?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No finalized payslips available for this month.
              </p>
            ) : (
              <div className="space-y-2">
                {calendarData?.items?.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-xs"
                  >
                    <div>
                      <strong className="text-slate-800 block text-sm">
                        Payslip for {p.payrollPeriod?.month}/{p.payrollPeriod?.year}
                      </strong>
                      <span className="text-slate-500 font-mono">
                        Net Salary: ₹{Number(p.netSalary).toFixed(2)}
                      </span>
                    </div>
                    <a
                      href={`http://localhost:4000/api/payroll/payslips/${p.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
                    >
                      Download PDF
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedType === 'Attendance' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Attendance Records for {monthNames[month - 1]} {year}
            </h3>
            {calendarData?.items?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No attendance activity recorded for this period.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {calendarData?.items?.map((att: any) => (
                  <div
                    key={att.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1"
                  >
                    <span className="font-mono font-bold text-slate-800 block">
                      {new Date(att.date).toISOString().split('T')[0]}
                    </span>
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        att.status === 'PRESENT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {att.status}
                    </span>
                    {att.firstCheckIn && (
                      <p className="text-[10px] text-slate-500 font-mono">
                        Check-In: {new Date(att.firstCheckIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
