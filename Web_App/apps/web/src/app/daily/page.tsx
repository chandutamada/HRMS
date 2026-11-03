'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Download,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

export default function DailyReportPage() {
  const { user, activeCompany } = useAuth();

  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any[]>(`/attendance/daily?report_date=${reportDate}&companyId=${activeCompany?.id || ''}`);
      setReportData(res || []);
      setSelectedIds([]); // reset selection on new load
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

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filtered.map((r) => r.employee_code || r.employee_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleRowCheck = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  // Helper to build rows formatted like the reference workbook
  const buildReportRows = (data: any[]) => {
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;
    let halfDayCount = 0;
    let totalWorkHours = 0;

    const dataRows = data.map((r) => {
      const st = (r.status || 'absent').toLowerCase();
      if (st === 'present') presentCount += 1;
      else if (st === 'late') {
        presentCount += 1;
        lateCount += 1;
      } else if (st === 'half_day') {
        halfDayCount += 1;
      } else if (st === 'leave') {
        leaveCount += 1;
      } else {
        absentCount += 1;
      }

      totalWorkHours += Number(r.total_hours) || 0;

      const isLateVal =
        r.is_late ||
        (st === 'late' || (r.late_minutes && r.late_minutes > 0) ? 'Yes' : 'No');

      const lateByStr = r.late_minutes > 0 ? `${r.late_minutes} min` : '—';
      const earlyStr = r.early_exit_minutes > 0 ? `${r.early_exit_minutes} min` : '—';

      return [
        r.date || reportDate,
        r.employee_code || '',
        r.employee_name || '',
        r.department_name || '',
        (r.status || 'absent').toUpperCase(),
        r.first_in
          ? new Date(r.first_in).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : '',
        r.last_out
          ? new Date(r.last_out).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : '',
        r.total_hours || 0,
        isLateVal,
        lateByStr,
        earlyStr,
        r.notes || (st === 'present' ? 'On Time' : st === 'leave' ? 'Approved Leave' : 'Absent'),
      ];
    });

    const summaryRow = [
      'TOTAL',
      `${data.length} EMPLOYEES`,
      '',
      '',
      `Present: ${presentCount} | Absent: ${absentCount} | Late: ${lateCount} | Half Day: ${halfDayCount} | Leave: ${leaveCount}`,
      '',
      '',
      `${totalWorkHours.toFixed(1)} hrs`,
      '',
      '',
      '',
      'Attendance Summary Register',
    ];

    return { dataRows, summaryRow };
  };

  // 1. Export as rich multi-sheet Excel (.xlsx) matching user's reference workbook
  const exportExcel = (recordsToExport?: any[], customFilename?: string) => {
    const data = recordsToExport && recordsToExport.length > 0 ? recordsToExport : reportData;
    if (!data.length) {
      alert('No daily records available to export.');
      return;
    }

    const preparedOn = new Date().toISOString().split('T')[0];
    const { dataRows, summaryRow } = buildReportRows(data);

    // Sheet 1: Daily Attendance Register
    const ws1Aoa: any[][] = [
      ['DAILY ATTENDANCE REGISTER'],
      [
        'Date',
        reportDate,
        '',
        'Status key',
        'Present / Absent / Half Day / Leave / Holiday / Weekend',
        '',
        'Prepared On',
        preparedOn,
      ],
      [],
      [
        'DATE',
        'EMPLOYEE CODE',
        'EMPLOYEE',
        'DEPARTMENT',
        'STATUS',
        'FIRST IN',
        'LAST OUT',
        'TOTAL HOURS',
        'LATE? (Yes/No)',
        'LATE BY',
        'EARLY EXIT',
        'NOTES',
      ],
      ...dataRows,
      [],
      summaryRow,
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(ws1Aoa);
    ws1['!cols'] = [
      { wch: 14 }, // DATE
      { wch: 16 }, // CODE
      { wch: 26 }, // EMPLOYEE
      { wch: 22 }, // DEPARTMENT
      { wch: 14 }, // STATUS
      { wch: 14 }, // FIRST IN
      { wch: 14 }, // LAST OUT
      { wch: 14 }, // TOTAL HOURS
      { wch: 14 }, // LATE?
      { wch: 12 }, // LATE BY
      { wch: 12 }, // EARLY EXIT
      { wch: 32 }, // NOTES
    ];

    // Sheet 2: Employee Master Details
    const ws2Aoa: any[][] = [
      ['EMPLOYEE MASTER DETAILS'],
      [],
      ['EMPLOYEE CODE', 'EMPLOYEE NAME', 'DEPARTMENT', 'DESIGNATION', 'JOINING DATE'],
      ...data.map((r) => [
        r.employee_code || '',
        r.employee_name || '',
        r.department_name || '',
        r.designation_name || 'Specialist',
        r.joining_date || '',
      ]),
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(ws2Aoa);
    ws2['!cols'] = [
      { wch: 16 },
      { wch: 26 },
      { wch: 22 },
      { wch: 22 },
      { wch: 16 },
    ];

    // Sheet 3: Register Guide & Instructions
    const ws3Aoa: any[][] = [
      ['HOW TO USE THIS ATTENDANCE WORKBOOK'],
      [],
      [
        '1. Daily Attendance',
        'Records daily check-in, check-out, working hours, punctuality flags, and status per employee.',
      ],
      [
        '2. Status Key',
        'Present (standard full day), Late (clocked in past grace period), Half Day, On Leave (pre-approved), Absent.',
      ],
      [
        '3. Late Marking',
        'Marked Late? = Yes whenever First In exceeds the assigned shift start time by 15 or more minutes.',
      ],
      [
        '4. Payroll Integration',
        'Unapproved absences and Loss of Pay (LOP) days are automatically deducted in monthly payslips.',
      ],
      [
        '5. Employee Details',
        'The Employee Master Details sheet stores employee codes, names, departments, designations and joining dates.',
      ],
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(ws3Aoa);
    ws3['!cols'] = [{ wch: 24 }, { wch: 95 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Daily Register');
    XLSX.utils.book_append_sheet(wb, ws2, 'Employee Details');
    XLSX.utils.book_append_sheet(wb, ws3, 'Attendance Guide');

    const filename = customFilename || `daily_attendance_register_${reportDate}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // 2. Export as CSV matching the exact template layout
  const exportCSV = (recordsToExport?: any[], customFilename?: string) => {
    const data = recordsToExport && recordsToExport.length > 0 ? recordsToExport : reportData;
    if (!data.length) {
      alert('No daily records available to export.');
      return;
    }

    const preparedOn = new Date().toISOString().split('T')[0];
    const { dataRows, summaryRow } = buildReportRows(data);

    const fullSheet = [
      ['DAILY ATTENDANCE REGISTER', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'Date',
        reportDate,
        '',
        'Status key',
        'Present / Absent / Half Day / Leave / Holiday / Weekend',
        '',
        'Prepared On',
        preparedOn,
        '',
        '',
        '',
        '',
      ],
      [],
      [
        'DATE',
        'EMPLOYEE CODE',
        'EMPLOYEE',
        'DEPARTMENT',
        'STATUS',
        'FIRST IN',
        'LAST OUT',
        'TOTAL HOURS',
        'LATE? (Yes/No)',
        'LATE BY',
        'EARLY EXIT',
        'NOTES',
      ],
      ...dataRows,
      [],
      summaryRow,
      [],
      ['EMPLOYEE MASTER DETAILS', '', '', '', '', '', '', '', '', '', '', ''],
      ['EMPLOYEE CODE', 'EMPLOYEE NAME', 'DEPARTMENT', 'DESIGNATION', 'JOINING DATE', '', '', '', '', '', '', ''],
      ...data.map((r) => [
        r.employee_code || '',
        r.employee_name || '',
        r.department_name || '',
        r.designation_name || 'Specialist',
        r.joining_date || '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]),
    ];

    const csvContent = fullSheet
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = customFilename || `daily_attendance_register_${reportDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSelectedExcel = () => {
    if (selectedIds.length === 0) {
      alert('Please check at least one employee using the checkbox beside their name.');
      return;
    }
    const selectedRecords = reportData.filter((r) =>
      selectedIds.includes(r.employee_code || r.employee_id)
    );
    const filename =
      selectedRecords.length === 1
        ? `daily_attendance_${selectedRecords[0].employee_code || 'employee'}_${reportDate}.xlsx`
        : `daily_attendance_${selectedRecords.length}_employees_${reportDate}.xlsx`;
    exportExcel(selectedRecords, filename);
  };

  const handleExportSelectedCSV = () => {
    if (selectedIds.length === 0) {
      alert('Please check at least one employee using the checkbox beside their name.');
      return;
    }
    const selectedRecords = reportData.filter((r) =>
      selectedIds.includes(r.employee_code || r.employee_id)
    );
    const filename =
      selectedRecords.length === 1
        ? `daily_attendance_${selectedRecords[0].employee_code || 'employee'}_${reportDate}.csv`
        : `daily_attendance_${selectedRecords.length}_employees_${reportDate}.csv`;
    exportCSV(selectedRecords, filename);
  };

  const allFilteredSelected =
    filtered.length > 0 &&
    filtered.every((r) => selectedIds.includes(r.employee_code || r.employee_id));

  return (
    <div className="space-y-4">
      {/* Top Header & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
          />
          <button
            onClick={loadReport}
            disabled={isLoading}
            className="px-3.5 py-1.5 bg-blue-600 text-white font-semibold text-xs rounded-xl hover:bg-blue-500 shadow-sm disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load'}
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
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
            />
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportSelectedExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 border border-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm animate-pulse"
                title="Download detailed Excel workbook for selected employees"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Download Excel ({selectedIds.length})</span>
              </button>
              <button
                onClick={handleExportSelectedCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200"
                title="Download CSV for selected employees"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                <span>CSV</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => exportExcel(reportData)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 border border-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm"
                title="Download complete daily attendance Excel workbook"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => exportCSV(reportData)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"
                title="Download CSV report"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selected Notification Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-emerald-50/90 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">
              {selectedIds.length} employee{selectedIds.length > 1 ? 's' : ''} checked.
            </span>
            <span className="text-emerald-800">
              Downloads detailed multi-sheet register (Daily Attendance, Master Details & Notes) directly to your PC.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSelectedExcel}
              className="px-3 py-1 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-sm text-xs inline-flex items-center gap-1"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Download Excel</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-800 text-xs font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Select All"
                  />
                </th>
                <th className="p-3 w-8">#</th>
                <th className="p-3">Employee</th>
                <th className="p-3">Code</th>
                <th className="p-3">Department</th>
                <th className="p-3">Status</th>
                <th className="p-3">First In</th>
                <th className="p-3">Last Out</th>
                <th className="p-3">Total Hours</th>
                <th className="p-3">Late By</th>
                <th className="p-3">Early Exit</th>
                <th className="p-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-slate-400">
                    No records found for this date.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const isChecked = selectedIds.includes(r.employee_code || r.employee_id);
                  return (
                    <tr
                      key={r.employee_id || i}
                      className={`transition ${isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            handleRowCheck(r.employee_code || r.employee_id, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{r.employee_name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{r.employee_code}</td>
                      <td className="p-3 text-slate-600">{r.department_name || '—'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'late'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : r.status === 'half_day'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
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
                        {r.first_in
                          ? new Date(r.first_in).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="p-3 text-slate-600">
                        {r.last_out
                          ? new Date(r.last_out).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {r.total_hours > 0 ? `${r.total_hours} hrs` : '—'}
                      </td>
                      <td className="p-3">
                        {r.late_minutes > 0 ? (
                          <span className="text-amber-600 font-semibold">{fmtLate(r.late_minutes)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3">
                        {r.early_exit ? (
                          <span className="text-rose-600 font-semibold">
                            {r.early_exit_minutes} min early
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            onClick={() =>
                              exportExcel(
                                [r],
                                `daily_attendance_${r.employee_code || 'emp'}_${reportDate}.xlsx`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                            title={`Download detailed Excel workbook for ${r.employee_name}`}
                          >
                            <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                            <span>Excel</span>
                          </button>
                          <button
                            onClick={() =>
                              exportCSV(
                                [r],
                                `daily_attendance_${r.employee_code || 'emp'}_${reportDate}.csv`
                              )
                            }
                            className="inline-flex items-center px-1.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                            title={`Download CSV for ${r.employee_name}`}
                          >
                            CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
