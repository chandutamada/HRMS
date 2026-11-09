'use client';

import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
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
  FileSpreadsheet,
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
      const res = await api.get<any[]>(`/attendance/inout?report_date=${reportDate}&companyId=${activeCompany?.id || ''}`);
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

  // Download Sample In/Out Punch Import Template
  const downloadSampleTemplate = () => {
    const sampleRows = [
      {
        'Employee Code': 'EMP001',
        'Employee Name': 'Ramesh Varma',
        'Date': reportDate,
        'Punch In Time': '09:05:00',
        'Punch Out Time': '17:35:00',
        'Punch Source': 'BIOMETRIC',
        'Location': 'Main Corporate Office',
        'Remarks': 'On-time biometric verification',
      },
      {
        'Employee Code': 'EMP002',
        'Employee Name': 'Priya Sharma',
        'Date': reportDate,
        'Punch In Time': '09:42:00',
        'Punch Out Time': '18:10:00',
        'Punch Source': 'MOBILE_GPS',
        'Location': 'Vizianagaram Field Cluster',
        'Remarks': 'Field inspection duty',
      },
      {
        'Employee Code': 'EMP003',
        'Employee Name': 'Kiran Rao',
        'Date': reportDate,
        'Punch In Time': '08:58:00',
        'Punch Out Time': '17:30:00',
        'Punch Source': 'WEB_PORTAL',
        'Location': 'Hyderabad Branch',
        'Remarks': 'Remote office duty',
      },
    ];

    const instructionRows = [
      { 'Column Header': 'Employee Code', 'Required': 'YES', 'Format': 'String (e.g. EMP001)', 'Description': 'Must match an existing registered Employee Code in HRMS' },
      { 'Column Header': 'Employee Name', 'Required': 'NO', 'Format': 'String', 'Description': 'Used for human verification' },
      { 'Column Header': 'Date', 'Required': 'YES', 'Format': 'YYYY-MM-DD', 'Description': 'Valid ISO date format' },
      { 'Column Header': 'Punch In Time', 'Required': 'YES', 'Format': 'HH:mm:ss (24-hr)', 'Description': 'First shift entry time in IST' },
      { 'Column Header': 'Punch Out Time', 'Required': 'NO', 'Format': 'HH:mm:ss (24-hr)', 'Description': 'Final shift departure time in IST' },
      { 'Column Header': 'Punch Source', 'Required': 'YES', 'Format': 'BIOMETRIC | MOBILE_GPS | WEB_PORTAL', 'Description': 'Device source channel' },
      { 'Column Header': 'Location', 'Required': 'NO', 'Format': 'String', 'Description': 'Office name or site location' },
      { 'Column Header': 'Remarks', 'Required': 'NO', 'Format': 'String', 'Description': 'Optional shift notes' },
    ];

    const wb = XLSX.utils.book_new();
    const wsSample = XLSX.utils.json_to_sheet(sampleRows);
    const wsGuide = XLSX.utils.json_to_sheet(instructionRows);

    wsSample['!cols'] = [
      { wch: 15 },
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 32 },
    ];

    wsGuide['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 22 },
      { wch: 55 },
    ];

    XLSX.utils.book_append_sheet(wb, wsSample, 'Punch_Data_Template');
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Column_Guidelines');
    XLSX.writeFile(wb, 'sample_inout_punch_template.xlsx');
  };

  // Export as rich multi-sheet professional Excel (.xlsx)
  const exportExcel = () => {
    if (!reportData.length) {
      alert('No data to export.');
      return;
    }

    const companyName = activeCompany?.name || 'Gram Tarang Inclusive Development Services Private Limited';
    const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Sheet 1: Master Daily In/Out Punch Register
    const ws1Aoa: any[][] = [
      [companyName.toUpperCase()],
      ['EXECUTIVE DAILY IN/OUT ATTENDANCE PUNCH AUDIT REGISTER'],
      [`Report Date: ${reportDate}`, '', `Generated At: ${generatedAt} (IST)`, '', `Generated By: ${user?.email || 'HR Admin'}`],
      [],
      [
        'S.No',
        'Employee Code',
        'Full Name',
        'Department',
        'Punch Date',
        'Check-In (IST)',
        'Check-Out (IST)',
        'Total Hours',
        'Punch Mode / Source',
        'Office / Field Location',
        'Late Arrival',
        'Attendance Status',
      ],
    ];

    reportData.forEach((r, idx) => {
      ws1Aoa.push([
        idx + 1,
        r.employee_code || `EMP-${idx + 1}`,
        r.name || 'Unknown',
        r.department || 'Operations',
        reportDate,
        r.checkin || '--:--',
        r.checkout || '--:--',
        typeof r.total_hours === 'number' ? Number(r.total_hours.toFixed(2)) : (Number(r.total_hours) || 0),
        (r.source || 'BIOMETRIC').toUpperCase(),
        r.location || 'Assigned Duty Center',
        r.is_late ? 'YES (LATE)' : 'NO (ON-TIME)',
        (r.status || 'PRESENT').toUpperCase(),
      ]);
    });

    // Summary footer row
    const totalHoursSum = reportData.reduce((acc, r) => acc + (Number(r.total_hours) || 0), 0);
    const avgHours = reportData.length > 0 ? (totalHoursSum / reportData.length).toFixed(2) : '0.00';
    ws1Aoa.push([]);
    ws1Aoa.push([
      'TOTAL AUDITED',
      `${reportData.length} Staff`,
      '',
      '',
      '',
      '',
      'AVG HOURS:',
      Number(avgHours),
      '',
      '',
      `LATE: ${late}`,
      `PRESENT: ${present} | ABSENT: ${absent}`,
    ]);

    // Sheet 2: Source & Channel Breakdown
    const ws2Aoa: any[][] = [
      [companyName.toUpperCase()],
      ['ATTENDANCE VERIFICATION CHANNEL BREAKDOWN'],
      [`Report Date: ${reportDate}`],
      [],
      ['Channel / Verification Method', 'Count of Staff', 'Percentage (%)', 'Compliance Status'],
      ['Biometric Fingerprint / Facial Machine', bio, `${((bio / Math.max(1, reportData.length)) * 100).toFixed(1)}%`, 'Verified Hardware'],
      ['Mobile Field GPS & Geofence', gps, `${((gps / Math.max(1, reportData.length)) * 100).toFixed(1)}%`, 'Live Field Telemetry'],
      ['Manual / Web Portal', reportData.length - (bio + gps), `${(((reportData.length - (bio + gps)) / Math.max(1, reportData.length)) * 100).toFixed(1)}%`, 'Administrative Entry'],
      [],
      ['Total Records', reportData.length, '100.0%', 'Shift Completed'],
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Aoa);
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Aoa);

    // Auto Column Widths
    ws1['!cols'] = [
      { wch: 8 },  // S.No
      { wch: 16 }, // Code
      { wch: 24 }, // Name
      { wch: 20 }, // Dept
      { wch: 14 }, // Date
      { wch: 16 }, // Check-In
      { wch: 16 }, // Check-Out
      { wch: 14 }, // Total Hours
      { wch: 22 }, // Source
      { wch: 28 }, // Location
      { wch: 16 }, // Late
      { wch: 18 }, // Status
    ];

    ws2['!cols'] = [
      { wch: 38 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 },
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'In_Out_Register');
    XLSX.utils.book_append_sheet(wb, ws2, 'Source_Breakdown');

    XLSX.writeFile(wb, `attendance_inout_audit_${reportDate}.xlsx`);
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
            onClick={downloadSampleTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition"
            title="Download sample formatted Excel template for punch uploads"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
            <span>Sample Template</span>
          </button>

          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 shadow-sm transition"
            title="Download in-detailed multi-sheet Excel audit report"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Excel (.xlsx)</span>
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
