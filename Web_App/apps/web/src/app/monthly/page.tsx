'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Download,
  Search,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';

export default function MonthlySummaryPage() {
  const { user, activeCompany } = useAuth();

  const [month, setMonth] = useState('10');
  const [year, setYear] = useState('2026');
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any[]>(`/attendance/monthly?month=${month}&year=${year}&companyId=${activeCompany?.id || ''}`);
      setSummaryData(res || []);
      setSelectedIds([]);
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

  const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Helper to build rows formatted like the reference workbook
  const buildSummaryRows = (data: any[]) => {
    let sumWorking = 0;
    let sumPresent = 0;
    let sumAbsent = 0;
    let sumLate = 0;
    let sumHalf = 0;

    const dataRows = data.map((r) => {
      sumWorking += Number(r.total_working_days) || 0;
      sumPresent += Number(r.present_days) || 0;
      sumAbsent += Number(r.absent_days) || 0;
      sumLate += Number(r.late_days) || 0;
      sumHalf += Number(r.half_days) || 0;

      let remark = r.remarks || 'Standard Attendance';
      if (r.attendance_percentage < 75) remark = 'Critical / Low Attendance';
      else if (r.attendance_percentage >= 90) remark = 'Excellent Attendance';

      return [
        r.employee_name || '',
        r.employee_code || '',
        r.department_name || '',
        r.total_working_days || 0,
        r.present_days || 0,
        r.absent_days || 0,
        r.late_days || 0,
        r.half_days || 0,
        `${r.attendance_percentage || 0}%`,
        remark,
      ];
    });

    const avgPct = data.length > 0 ? Math.round((sumPresent / (sumWorking || 1)) * 100) : 0;

    const summaryRow = [
      'TOTAL',
      '',
      '',
      sumWorking,
      sumPresent,
      sumAbsent,
      sumLate,
      sumHalf,
      `${avgPct}%`,
      `Totals for ${data.length} Employee(s)`,
    ];

    return { dataRows, summaryRow, avgPct };
  };

  // 1. Export as rich multi-sheet Excel (.xlsx) matching user's reference workbook
  const exportExcel = (recordsToExport?: any[], customFilename?: string) => {
    const data = recordsToExport && recordsToExport.length > 0 ? recordsToExport : summaryData;
    if (!data.length) {
      alert('No monthly summary records available to export.');
      return;
    }

    const monthFullName = `${monthNames[parseInt(month, 10)] || 'Month'} ${year}`;
    const preparedOn = new Date().toISOString().split('T')[0];
    const { dataRows, summaryRow } = buildSummaryRows(data);

    // Sheet 1: Monthly Employee Attendance Summary
    const ws1Aoa: any[][] = [
      ['MONTHLY EMPLOYEE ATTENDANCE SUMMARY'],
      [
        'Month',
        monthFullName,
        '',
        'Department',
        'All Departments',
        '',
        'Prepared On',
        preparedOn,
        '',
        '',
      ],
      [],
      [
        'EMPLOYEE',
        'CODE',
        'DEPARTMENT',
        'WORKING DAYS',
        'PRESENT',
        'ABSENT',
        'LATE DAYS',
        'HALF DAYS',
        'ATTENDANCE %',
        'REMARKS',
      ],
      ...dataRows,
      [],
      summaryRow,
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(ws1Aoa);
    ws1['!cols'] = [
      { wch: 25 }, // EMPLOYEE
      { wch: 14 }, // CODE
      { wch: 22 }, // DEPARTMENT
      { wch: 15 }, // WORKING DAYS
      { wch: 12 }, // PRESENT
      { wch: 12 }, // ABSENT
      { wch: 12 }, // LATE DAYS
      { wch: 12 }, // HALF DAYS
      { wch: 16 }, // ATTENDANCE %
      { wch: 32 }, // REMARKS
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
        '1. Monthly Summary',
        'Enter the reporting month and add one row per employee. The Attendance % is calculated as PRESENT ÷ WORKING DAYS.',
      ],
      [
        '2. Daily Attendance',
        'Enter one row per employee per date. Choose a status from the dropdown and mark Late? as Yes or No.',
      ],
      [
        '3. Employee Details',
        'Maintain employee code, name, department, designation and joining date in the master list.',
      ],
      [
        '4. Working Days',
        'Count only scheduled working days. Exclude weekly offs and official holidays.',
      ],
      [
        '5. Present',
        'Count full-day attendance. A half day is recorded separately in HALF DAYS; follow your organization\'s policy for attendance percentage.',
      ],
      [
        '6. Absent & LOP',
        'Count scheduled working days marked Absent. Unapproved leave is automatically factored into Loss of Pay (LOP) in payroll.',
      ],
      [
        '7. Late Days',
        'Count days marked Late? = Yes. Late days are a subset of attendance and should not be added to working days.',
      ],
      [
        '8. Half Days',
        'Count dates marked Half Day. Half days credit 0.5 towards worked hours.',
      ],
      [
        '9. Sample row',
        'The HR Manager row reproduces the figures: 22 working days, 2 present, 20 absent, 3 late, 0 half days.',
      ],
      [
        '10. Totals',
        'The bottom row totals day counts across employees. Overall attendance is total present ÷ total working days.',
      ],
    ];

    const ws3 = XLSX.utils.aoa_to_sheet(ws3Aoa);
    ws3['!cols'] = [{ wch: 24 }, { wch: 95 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Monthly Summary');
    XLSX.utils.book_append_sheet(wb, ws2, 'Employee Details');
    XLSX.utils.book_append_sheet(wb, ws3, 'Attendance Guide');

    const filename = customFilename || `monthly_employee_attendance_summary_${month}_${year}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // 2. Export as CSV matching the exact template layout
  const exportCSV = (recordsToExport?: any[], customFilename?: string) => {
    const data = recordsToExport && recordsToExport.length > 0 ? recordsToExport : summaryData;
    if (!data.length) {
      alert('No monthly summary records available to export.');
      return;
    }

    const monthFullName = `${monthNames[parseInt(month, 10)] || 'Month'} ${year}`;
    const preparedOn = new Date().toISOString().split('T')[0];
    const { dataRows, summaryRow } = buildSummaryRows(data);

    const fullSheet = [
      ['MONTHLY EMPLOYEE ATTENDANCE SUMMARY', '', '', '', '', '', '', '', '', ''],
      [
        'Month',
        monthFullName,
        '',
        'Department',
        'All Departments',
        '',
        'Prepared On',
        preparedOn,
        '',
        '',
      ],
      [],
      [
        'EMPLOYEE',
        'CODE',
        'DEPARTMENT',
        'WORKING DAYS',
        'PRESENT',
        'ABSENT',
        'LATE DAYS',
        'HALF DAYS',
        'ATTENDANCE %',
        'REMARKS',
      ],
      ...dataRows,
      [],
      summaryRow,
      [],
      ['EMPLOYEE MASTER DETAILS', '', '', '', '', '', '', '', '', ''],
      ['EMPLOYEE CODE', 'EMPLOYEE NAME', 'DEPARTMENT', 'DESIGNATION', 'JOINING DATE', '', '', '', '', ''],
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
      ]),
    ];

    const csvContent = fullSheet
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = customFilename || `monthly_employee_attendance_summary_${month}_${year}.csv`;
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
    const selectedRecords = summaryData.filter((r) =>
      selectedIds.includes(r.employee_code || r.employee_id)
    );
    const filename =
      selectedRecords.length === 1
        ? `monthly_summary_${selectedRecords[0].employee_code || 'employee'}_${month}_${year}.xlsx`
        : `monthly_summary_${selectedRecords.length}_employees_${month}_${year}.xlsx`;
    exportExcel(selectedRecords, filename);
  };

  const handleExportSelectedCSV = () => {
    if (selectedIds.length === 0) {
      alert('Please check at least one employee using the checkbox beside their name.');
      return;
    }
    const selectedRecords = summaryData.filter((r) =>
      selectedIds.includes(r.employee_code || r.employee_id)
    );
    const filename =
      selectedRecords.length === 1
        ? `monthly_summary_${selectedRecords[0].employee_code || 'employee'}_${month}_${year}.csv`
        : `monthly_summary_${selectedRecords.length}_employees_${month}_${year}.csv`;
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
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
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
            className="w-20 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
          />

          <button
            onClick={loadSummary}
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
                title="Download detailed Excel summary for selected employees"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Download Excel ({selectedIds.length})</span>
              </button>
              <button
                onClick={handleExportSelectedCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200"
                title="Download CSV for selected employees"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                <span>CSV</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => exportExcel(summaryData)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 border border-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm"
                title="Download complete monthly summary Excel workbook"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => exportCSV(summaryData)}
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
              Downloads detailed multi-sheet summary (Monthly Summary, Master Details & Notes) directly to your PC.
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
                <th className="p-3">Working Days</th>
                <th className="p-3">Present</th>
                <th className="p-3">Absent</th>
                <th className="p-3">Late Days</th>
                <th className="p-3">Half Days</th>
                <th className="p-3 text-right">Attendance %</th>
                <th className="p-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-slate-400">
                    No data found for this month.
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
                      <td className="p-3 text-slate-700 font-medium">{r.total_working_days}</td>
                      <td className="p-3 text-emerald-600 font-semibold">{r.present_days}</td>
                      <td className="p-3 text-rose-600 font-semibold">{r.absent_days}</td>
                      <td className="p-3 text-amber-600 font-semibold">{r.late_days}</td>
                      <td className="p-3 text-indigo-600 font-semibold">{r.half_days}</td>
                      <td className={`p-3 text-right ${pctColor(r.attendance_percentage)}`}>
                        {r.attendance_percentage}%
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            onClick={() =>
                              exportExcel(
                                [r],
                                `monthly_summary_${r.employee_code || 'emp'}_${month}_${year}.xlsx`
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
                                `monthly_summary_${r.employee_code || 'emp'}_${month}_${year}.csv`
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
