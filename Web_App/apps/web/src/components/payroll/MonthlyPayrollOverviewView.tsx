'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import {
  Users,
  Banknote,
  DollarSign,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  Download,
  Calendar,
  Search,
  Filter,
  Edit,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Clock,
} from 'lucide-react';
import UploadPayrollExcelModal from './UploadPayrollExcelModal';
import EditEmployeePayrollModal from './EditEmployeePayrollModal';

interface MonthlyPayrollOverviewViewProps {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  activeCompany?: any;
}

export default function MonthlyPayrollOverviewView({
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  activeCompany,
}: MonthlyPayrollOverviewViewProps) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isFinalizingAll, setIsFinalizingAll] = useState<boolean>(false);
  const [isDownloadingDetailSummary, setIsDownloadingDetailSummary] = useState<boolean>(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const fetchOverview = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any>('/payroll/monthly-overview', {
        year: selectedYear,
        month: selectedMonth,
        companyId: activeCompany?.id,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to fetch monthly payroll overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [selectedYear, selectedMonth, activeCompany]);

  // Navigate months
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Download Excel Template with Current Employees
  const handleDownloadTemplate = () => {
    if (!data?.employees || data.employees.length === 0) {
      alert('No employees found to export.');
      return;
    }

    const templateData = data.employees.map((emp: any) => ({
      'Employee Code': emp.employeeCode || '',
      'Full Name': emp.fullName || '',
      'Department': emp.department || '',
      'Designation': emp.designation || '',
      'Basic Salary': emp.basicSalary || 50000,
      'HRA': emp.hra || 20000,
      'Conveyance': emp.conveyance || 0,
      'DA': emp.da || 0,
      'Medical Allowance': emp.medicalAllowance || 1250,
      'Special Allowance': emp.specialAllowance || 0,
      'Other Allowances': emp.otherAllowances || 0,
      'EPF (Employee)': emp.epf || 6000,
      'Professional Tax': emp.professionalTax || 200,
      'TDS / Tax': emp.tds || 0,
      'LOP Days': emp.lopDays || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll_Data');
    XLSX.writeFile(
      wb,
      `Payroll_Template_${monthNames[selectedMonth - 1]}_${selectedYear}.xlsx`
    );
  };

  // Download official 6-sheet Detail Summary Excel
  const handleDownloadDetailSummary = async () => {
    setIsDownloadingDetailSummary(true);
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
        ...(activeCompany?.id ? { companyId: activeCompany.id } : {}),
      });

      // Use a direct fetch so we can handle a binary response (xlsx buffer)
      const token =
        typeof window !== 'undefined'
          ? (localStorage.getItem('hrms_token') || '')
          : '';

      const activeCompanyId =
        typeof window !== 'undefined'
          ? (localStorage.getItem('hrms_active_company_id') || '')
          : '';

      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

      const res = await fetch(
        `${apiBaseUrl}/payroll/detail-summary/excel?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            ...(activeCompanyId ? { 'x-company-id': activeCompanyId } : {}),
          },
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server error ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const shortMonth = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][selectedMonth - 1];
      link.download = `Detail_Summary_${shortMonth}-${selectedYear}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download Detail Summary: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDownloadingDetailSummary(false);
    }
  };

  // Finalize an individual employee's payslip
  const handleFinalizeSingle = async (employeeId: string, empName: string, recordId: string | null) => {
    if (!confirm(`Are you sure you want to finalize the payslip for ${empName}? It will become immediately visible in the employee app.`)) {
      return;
    }

    try {
      if (recordId) {
        await api.put(`/payroll/records/${recordId}/finalize`);
      } else {
        // Find employee in data to generate & finalize
        const emp = data?.employees?.find((e: any) => e.employeeId === employeeId);
        if (!emp) return;

        const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
        await api.post('/payroll/individual-generate', {
          employeeId: emp.employeeId,
          year: selectedYear,
          month: selectedMonth,
          totalDays,
          paidDays: emp.paidDays,
          basicSalary: emp.basicSalary,
          hra: emp.hra,
          hraEnabled: emp.hra > 0,
          medicalAllowance: emp.medicalAllowance,
          medicalAllowanceEnabled: emp.medicalAllowance > 0,
          otherAllowance: emp.otherAllowances,
          otherAllowanceEnabled: emp.otherAllowances > 0,
          epf: emp.epf,
          professionalTax: emp.professionalTax,
          tds: emp.tds,
          lopDays: emp.lopDays,
          finalize: true,
        });
      }

      alert(`🎉 Payslip for ${empName} has been finalized and dispatched to the employee app!`);
      fetchOverview();
    } catch (err: any) {
      alert('Failed to finalize payslip: ' + (err.message || 'Error'));
    }
  };

  // Finalize all employees for the month in 1-click
  const handleFinalizeAll = async () => {
    const unfinalizedCount = data?.summary?.pendingEmployees || 0;
    const confirmMsg =
      unfinalizedCount > 0
        ? `Are you sure you want to finalize payroll for all ${data?.employees?.length || 0} employees for ${monthNames[selectedMonth - 1]} ${selectedYear}?\n\nThis will publish the official payslips to all employee mobile apps and web portals immediately.`
        : `All employees are already finalized for ${monthNames[selectedMonth - 1]} ${selectedYear}. Do you want to re-verify and refresh notifications?`;

    if (!confirm(confirmMsg)) return;

    setIsFinalizingAll(true);
    try {
      const res = await api.put<any>('/payroll/finalize-all', {
        year: selectedYear,
        month: selectedMonth,
        companyId: activeCompany?.id,
      });

      alert(`🎉 ${res.message || 'Payroll finalized for all employees!'}`);
      fetchOverview();
    } catch (err: any) {
      alert('Error finalizing payroll: ' + (err.message || 'Failed'));
    } finally {
      setIsFinalizingAll(false);
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return [];
    return data.employees.filter((emp: any) => {
      const matchSearch =
        emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept =
        departmentFilter === 'ALL' || emp.department === departmentFilter;
      return matchSearch && matchDept;
    });
  }, [data, searchQuery, departmentFilter]);

  const departmentsList = useMemo(() => {
    if (!data?.employees) return [];
    const depts = new Set<string>();
    data.employees.forEach((emp: any) => {
      if (emp.department) depts.add(emp.department);
    });
    return Array.from(depts);
  }, [data]);

  const isMonthFullyFinalized =
    data?.summary?.totalEmployees > 0 &&
    data?.summary?.finalizedEmployees === data?.summary?.totalEmployees;

  return (
    <div className="space-y-6">
      {/* Top Controls & Month Navigator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-sm"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-900 tracking-tight">
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </span>
                {isMonthFullyFinalized ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                    <CheckCircle className="h-3 w-3 text-emerald-600" />
                    Finalized & Published
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold">
                    <Clock className="h-3 w-3 text-amber-600" />
                    Draft / Carry-Forward Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {data?.period?.totalDays || 30} Calendar Days • Company: {activeCompany?.name || 'SUPERBEE'}
              </p>
            </div>
          </div>

          <button
            onClick={handleNextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-sm"
            title="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Action Buttons: Excel Template, Excel Upload, Finalize All */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Template Button */}
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
            title="Download Excel spreadsheet with all employees"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Download Template</span>
          </button>

          {/* Download Detail Summary Button */}
          <button
            onClick={handleDownloadDetailSummary}
            disabled={isDownloadingDetailSummary}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            title="Download official 6-sheet Detail Summary Excel (PAY_Sheet, CTC Reco, PT Reco, PF Reco, Gross Reco, Net Reco)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              {isDownloadingDetailSummary ? 'Generating...' : 'Detail Summary'}
            </span>
          </button>

          {/* Upload Excel Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-400" />
            <span>Upload Excel</span>
          </button>

          {/* Finalize All Button */}
          <button
            onClick={handleFinalizeAll}
            disabled={isFinalizingAll || isMonthFullyFinalized}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition ${
              isMonthFullyFinalized
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            <span>
              {isFinalizingAll
                ? 'Finalizing All...'
                : isMonthFullyFinalized
                ? 'All Finalized'
                : `Finalize All (${monthNames[selectedMonth - 1]})`}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Employees
            </span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 font-mono">
            {data?.summary?.totalEmployees || 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Active in company</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Finalized Payslips
            </span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-black text-emerald-700 font-mono">
            {data?.summary?.finalizedEmployees || 0}{' '}
            <span className="text-xs text-slate-400 font-normal">
              / {data?.summary?.totalEmployees || 0}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-medium">
            {isMonthFullyFinalized ? '✓ 100% Published' : `${data?.summary?.pendingEmployees || 0} Drafts Pending`}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Gross Payroll
            </span>
            <Banknote className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 font-mono">
            ₹{(data?.summary?.totalGrossPayout || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Before deductions</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Deductions
            </span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-xl font-black text-rose-700 font-mono">
            ₹{(data?.summary?.totalDeductions || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">PF, PT, TDS & LOP</div>
        </div>

        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Net Payout
            </span>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-black text-emerald-900 font-mono">
            ₹{(data?.summary?.totalNetPayout || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-bold">Total Disbursable</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee name, code, dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 font-medium shrink-0">Department:</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-slate-50 focus:bg-white outline-none"
          >
            <option value="ALL">All Departments</option>
            {departmentsList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main All-Employee Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            <span className="text-xs font-medium">Loading employee payroll details...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-center">
            <Users className="h-10 w-10 text-slate-300 mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No employees found</h4>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery ? 'Try clearing your search query.' : 'Click "Upload Excel" to populate employee salary structures.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Employee</th>
                  <th className="px-3 py-3.5 text-right">Basic (₹)</th>
                  <th className="px-3 py-3.5 text-right">HRA (₹)</th>
                  <th className="px-3 py-3.5 text-right">Allowances</th>
                  <th className="px-3 py-3.5 text-right">Gross (₹)</th>
                  <th className="px-3 py-3.5 text-right">Deductions</th>
                  <th className="px-3 py-3.5 text-center">LOP</th>
                  <th className="px-4 py-3.5 text-right">Net Salary</th>
                  <th className="px-3 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredEmployees.map((emp: any) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/60 transition group">
                    {/* Employee Profile */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700 text-xs shrink-0 border border-slate-200 overflow-hidden">
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl.startsWith('http') ? emp.avatarUrl : `http://localhost:4000${emp.avatarUrl}`}
                              alt={emp.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            emp.firstName?.[0] || 'E'
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition flex items-center gap-1.5">
                            <span>{emp.fullName}</span>
                            {emp.isCarriedForward && (
                              <span
                                className="inline-block rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.2 text-[9px] font-semibold border border-emerald-200"
                                title="Salary carried forward from previous month"
                              >
                                Carried Forward
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {emp.employeeCode} • {emp.department} • {emp.designation}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Basic */}
                    <td className="px-3 py-3 text-right font-mono font-medium text-slate-800">
                      ₹{emp.basicSalary.toLocaleString('en-IN')}
                    </td>

                    {/* HRA */}
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      ₹{emp.hra.toLocaleString('en-IN')}
                    </td>

                    {/* Allowances (Medical + Special + Other) */}
                    <td className="px-3 py-3 text-right font-mono text-slate-600">
                      ₹{(emp.medicalAllowance + emp.otherAllowances + emp.specialAllowance + emp.conveyance).toLocaleString('en-IN')}
                    </td>

                    {/* Gross */}
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                      ₹{emp.grossEarnings.toLocaleString('en-IN')}
                    </td>

                    {/* Deductions (EPF + PT + TDS) */}
                    <td className="px-3 py-3 text-right font-mono text-rose-600">
                      -₹{(emp.epf + emp.professionalTax + emp.tds).toLocaleString('en-IN')}
                    </td>

                    {/* LOP */}
                    <td className="px-3 py-3 text-center">
                      {emp.lopDays > 0 ? (
                        <span className="inline-flex rounded-lg bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700 font-mono">
                          {emp.lopDays}d
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">0</span>
                      )}
                    </td>

                    {/* Net Salary */}
                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-700 text-sm">
                      ₹{emp.netSalary.toLocaleString('en-IN')}
                    </td>

                    {/* Status Badge */}
                    <td className="px-3 py-3 text-center">
                      {emp.isFinalized ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[10px] font-bold">
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                          Finalized
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-[10px] font-bold">
                          <Clock className="h-3 w-3 text-amber-600" />
                          Ready
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingEmployee(emp)}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition shadow-xs"
                          title="Edit salary components (carries forward to future months)"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>

                        {/* Finalize Button (if not yet finalized) */}
                        {!emp.isFinalized && (
                          <button
                            onClick={() =>
                              handleFinalizeSingle(emp.employeeId, emp.fullName, emp.recordId)
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-500 transition"
                            title="Finalize & release payslip to employee"
                          >
                            <CheckCircle className="h-3 w-3" />
                            <span>Finalize</span>
                          </button>
                        )}

                        {/* Download PDF Button (if finalized) */}
                        {emp.isFinalized && emp.recordId && (
                          <a
                            href={`http://localhost:4000/api/payroll/payslips/${emp.recordId}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-xs"
                            title="Download official PDF payslip"
                          >
                            <Download className="h-3 w-3" />
                            <span>PDF</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Upload Modal */}
      <UploadPayrollExcelModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        year={selectedYear}
        month={selectedMonth}
        companyId={activeCompany?.id}
        employees={data?.employees || []}
        onUploadSuccess={fetchOverview}
      />

      {/* Edit Employee Salary Modal */}
      <EditEmployeePayrollModal
        isOpen={!!editingEmployee}
        onClose={() => setEditingEmployee(null)}
        employeeData={editingEmployee}
        year={selectedYear}
        month={selectedMonth}
        onSuccess={fetchOverview}
      />
    </div>
  );
}
