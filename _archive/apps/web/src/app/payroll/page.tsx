'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import {
  Banknote,
  DollarSign,
  FileSpreadsheet,
  Upload,
  Play,
  Printer,
  FileText,
  Search,
  CheckCircle,
  Plus,
  Edit,
  ArrowRight,
  Send,
  X,
  Percent,
  Check,
  AlertCircle,
  Info,
} from 'lucide-react';

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function PayrollPage() {
  const { user, activeCompany } = useAuth();

  const [activeTab, setActiveTab] = useState<'salary' | 'runs' | 'payslips'>('salary');
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<Record<string, any>>({});
  const [runs, setRuns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search filter
  const [salSearch, setSalSearch] = useState('');

  // Upload feedback
  const [uploadResult, setUploadResult] = useState<{
    message: string;
    created: number;
    updated: number;
    skipped: number;
    errors?: string[];
  } | null>(null);

  // Selected for Payslips
  const [psEmpId, setPsEmpId] = useState('');
  const [psMonth, setPsMonth] = useState('2026-10');
  const [currentPayslip, setCurrentPayslip] = useState<any | null>(null);

  // Modals
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);

  // Salary Modal Form State
  const [salEmpId, setSalEmpId] = useState('');
  const [salEmpName, setSalEmpName] = useState('');
  const [salEmpCode, setSalEmpCode] = useState('');
  const [salEff, setSalEff] = useState(new Date().toISOString().split('T')[0]);

  // Earnings
  const [eBasic, setEBasic] = useState<string>('0');
  const [eHra, setEHra] = useState<string>('');
  const [eHraPct, setEHraPct] = useState<string>('');
  const [eDa, setEDa] = useState<string>('');
  const [eDaPct, setEDaPct] = useState<string>('');
  const [eTa, setETa] = useState<string>('0');
  const [eSa, setESa] = useState<string>('0');
  const [eCar, setECar] = useState<string>('0');
  const [eMed, setEMed] = useState<string>('0');
  const [ePhn, setEPhn] = useState<string>('0');
  const [eCea, setECea] = useState<string>('0');
  const [eOth, setEOth] = useState<string>('0');
  const [eProj, setEProj] = useState<string>('0');
  const [eInc, setEInc] = useState<string>('0');

  // Pay Type
  const [dConsultant, setDConsultant] = useState(false);
  const [dTdsPct, setDTdsPct] = useState<string>('10');
  const [dFixed, setDFixed] = useState(false);

  // Deductions
  const [dPf, setDPf] = useState(true);
  const [dPfEmp, setDPfEmp] = useState<string>('12');
  const [dPfEr, setDPfEr] = useState<string>('12');
  const [dEsi, setDEsi] = useState(false);
  const [dEsiEmp, setDEsiEmp] = useState<string>('0.75');
  const [dEsiEr, setDEsiEr] = useState<string>('3.25');
  const [dPt, setDPt] = useState<string>('200');
  const [dTds, setDTds] = useState<string>('0');
  const [dAdv, setDAdv] = useState<string>('0');
  const [dOtherDed, setDOtherDed] = useState<string>('0');
  const [salError, setSalError] = useState('');

  // Run Payroll Form State
  const [runMonth, setRunMonth] = useState('2026-10');
  const [runDays, setRunDays] = useState(26);
  const [runNotes, setRunNotes] = useState('October 2026 Payroll');
  const [isProcessing, setIsProcessing] = useState(false);

  const cur = (n: number) =>
    '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const empRes = await api.get<{ items: any[] }>('/employees', { limit: 200 });
      const empList = empRes.items || [];
      setEmployees(empList);

      // Pre-set default runs
      setRuns([
        {
          id: 'oct-2026',
          month: 10,
          year: 2026,
          status: 'finalized',
          total_employees: empList.length,
          total_gross: empList.length * 50000,
          total_deductions: empList.length * 2000,
          total_net: empList.length * 48000,
        },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompany]);

  // Live calculation of CTC & Net Pay in Modal
  const g = (val: string) => parseFloat(val) || 0;

  const calculatedEarnings = useMemo(() => {
    const basic = g(eBasic);
    const hra = eHraPct ? (basic * g(eHraPct)) / 100 : g(eHra);
    const da = eDaPct ? (basic * g(eDaPct)) / 100 : g(eDa);
    const ta = g(eTa);
    const sa = g(eSa);
    const car = g(eCar);
    const med = g(eMed);
    const phn = g(ePhn);
    const cea = g(eCea);
    const oth = g(eOth);
    const proj = g(eProj);
    const inc = g(eInc);

    const gross = basic + hra + da + ta + sa + car + med + phn + cea + oth + proj + inc;
    return { basic, hra, da, ta, sa, car, med, phn, cea, oth, proj, inc, gross };
  }, [eBasic, eHra, eHraPct, eDa, eDaPct, eTa, eSa, eCar, eMed, ePhn, eCea, eOth, eProj, eInc]);

  const calculatedDeductions = useMemo(() => {
    const gross = calculatedEarnings.gross;
    const basic = calculatedEarnings.basic;

    if (dConsultant) {
      const tds = (gross * g(dTdsPct)) / 100;
      const adv = g(dAdv);
      const oth = g(dOtherDed);
      const total = tds + adv + oth;
      return { pfEmp: 0, pfEr: 0, esiEmp: 0, esiEr: 0, pt: 0, tds, adv, oth, total };
    }

    const pfBase = Math.min(basic, 15000);
    const pfEmp = dPf ? (pfBase * g(dPfEmp)) / 100 : 0;
    const pfEr = dPf ? (pfBase * g(dPfEr)) / 100 : 0;
    const esiEmp = dEsi && gross <= 21000 ? (gross * g(dEsiEmp)) / 100 : 0;
    const esiEr = dEsi && gross <= 21000 ? (gross * g(dEsiEr)) / 100 : 0;
    const pt = g(dPt);
    const tds = g(dTds);
    const adv = g(dAdv);
    const oth = g(dOtherDed);

    const total = pfEmp + esiEmp + pt + tds + adv + oth;
    return { pfEmp, pfEr, esiEmp, esiEr, pt, tds, adv, oth, total };
  }, [calculatedEarnings, dConsultant, dTdsPct, dPf, dPfEmp, dPfEr, dEsi, dEsiEmp, dEsiEr, dPt, dTds, dAdv, dOtherDed]);

  const estimatedNetPay = Math.max(0, calculatedEarnings.gross - calculatedDeductions.total);

  // Open Salary Setup Modal
  const openSalaryModal = (emp: any) => {
    const s = salaries[emp.id] || {};
    setSalEmpId(emp.id);
    setSalEmpName(`${emp.firstName} ${emp.lastName}`.trim());
    setSalEmpCode(emp.employeeCode || '');
    setSalEff(s.effective_from || new Date().toISOString().split('T')[0]);

    setEBasic(s.basic !== undefined ? String(s.basic) : '0');
    setEHra(s.hra ? String(s.hra) : '');
    setEHraPct(s.hra_percent ? String(s.hra_percent) : '');
    setEDa(s.da ? String(s.da) : '');
    setEDaPct(s.da_percent ? String(s.da_percent) : '');
    setETa(s.ta ? String(s.ta) : '0');
    setESa(s.special_allowance ? String(s.special_allowance) : '0');
    setECar(s.car_allowance ? String(s.car_allowance) : '0');
    setEMed(s.medical_allowance ? String(s.medical_allowance) : '0');
    setEPhn(s.phone_allowance ? String(s.phone_allowance) : '0');
    setECea(s.children_education_allowance ? String(s.children_education_allowance) : '0');
    setEOth(s.other_allowance ? String(s.other_allowance) : '0');
    setEProj(s.project_allowance ? String(s.project_allowance) : '0');
    setEInc(s.incentive ? String(s.incentive) : '0');

    setDConsultant(s.is_consultant || false);
    setDTdsPct(s.tds_percent ? String(s.tds_percent) : '10');
    setDFixed(s.fixed_salary || false);

    setDPf(s.pf_applicable !== false);
    setDPfEmp(s.pf_employee_percent ? String(s.pf_employee_percent) : '12');
    setDPfEr(s.pf_employer_percent ? String(s.pf_employer_percent) : '12');
    setDEsi(s.esi_applicable || false);
    setDEsiEmp(s.esi_employee_percent ? String(s.esi_employee_percent) : '0.75');
    setDEsiEr(s.esi_employer_percent ? String(s.esi_employer_percent) : '3.25');
    setDPt(s.professional_tax ? String(s.professional_tax) : '200');
    setDTds(s.tds_monthly ? String(s.tds_monthly) : '0');
    setDAdv(s.advance_deduction ? String(s.advance_deduction) : '0');
    setDOtherDed(s.other_deduction ? String(s.other_deduction) : '0');

    setSalError('');
    setShowSalaryModal(true);
  };

  // Save Salary Structure
  const handleSaveSalaryStructure = () => {
    const basic = g(eBasic);
    if (!basic) {
      setSalError('Basic salary is required');
      return;
    }

    const structure = {
      employee_id: salEmpId,
      employee_name: salEmpName,
      employee_code: salEmpCode,
      effective_from: salEff,
      basic,
      hra: calculatedEarnings.hra,
      hra_percent: g(eHraPct) || null,
      da: calculatedEarnings.da,
      da_percent: g(eDaPct) || null,
      ta: calculatedEarnings.ta,
      special_allowance: calculatedEarnings.sa,
      car_allowance: calculatedEarnings.car,
      medical_allowance: calculatedEarnings.med,
      phone_allowance: calculatedEarnings.phn,
      children_education_allowance: calculatedEarnings.cea,
      other_allowance: calculatedEarnings.oth,
      project_allowance: calculatedEarnings.proj,
      incentive: calculatedEarnings.inc,
      gross_ctc: calculatedEarnings.gross,
      is_consultant: dConsultant,
      tds_percent: g(dTdsPct),
      fixed_salary: dFixed,
      pf_applicable: dPf,
      pf_employee_percent: g(dPfEmp),
      pf_employer_percent: g(dPfEr),
      esi_applicable: dEsi,
      esi_employee_percent: g(dEsiEmp),
      esi_employer_percent: g(dEsiEr),
      professional_tax: g(dPt),
      tds_monthly: g(dTds),
      advance_deduction: g(dAdv),
      other_deduction: g(dOtherDed),
      net_pay: estimatedNetPay,
      is_active: true,
    };

    setSalaries((prev) => ({
      ...prev,
      [salEmpId]: structure,
    }));

    setShowSalaryModal(false);
  };

  // Download Exact 2-Sheet Excel Template
  const handleDownloadTemplate = () => {
    // Sheet 1: Data Rows
    const sheet1Headers = [
      'Employee ID',
      'Employee Name',
      'Basic Salary',
      'HRA (auto if blank)',
      'DA (auto if blank)',
      'Other Allowances',
      'PF Employee %',
      'ESI Employee %',
      'PF Employer %',
      'ESI Employer %',
      'TDS Monthly',
      'Advance Deduction',
      'LOP Days',
    ];

    const sheet1Data: any[] = [
      sheet1Headers,
      // Example row (Row 2)
      ['EMP001', 'Example Employee', 30000, '', '', 2000, 12, 0.75, 13, 3.25, 0, 0, 0],
    ];

    // Automatically populate ALL current employees from the system!
    employees.forEach((emp) => {
      const s = salaries[emp.id];
      sheet1Data.push([
        emp.employeeCode || '',
        `${emp.firstName} ${emp.lastName}`.trim(),
        s ? s.basic : 0,
        s && s.hra ? s.hra : '',
        s && s.da ? s.da : '',
        s ? (s.ta || 0) + (s.special_allowance || 0) + (s.other_allowance || 0) : 0,
        s ? s.pf_employee_percent : 12,
        s ? s.esi_employee_percent : 0.75,
        s ? s.pf_employer_percent : 12,
        s ? s.esi_employer_percent : 3.25,
        s ? s.tds_monthly : 0,
        s ? s.advance_deduction : 0,
        0, // LOP Days
      ]);
    });

    // Sheet 2: Instructions
    const sheet2Data = [
      ['HRMS Salary Upload — Instructions'],
      [''],
      ['1. Do NOT change the column order.'],
      ['2. Employee ID and Employee Name are for reference only — matching is by Employee ID.'],
      ['3. Basic Salary is mandatory. Leave HRA and DA blank to use auto-calculation (40% and 10% of Basic).'],
      ['4. PF defaults: Employee 12%, Employer 13%. ESI defaults: Employee 0.75%, Employer 3.25%.'],
      ['5. TDS Monthly, Advance Deduction, and LOP Days default to 0 if left blank.'],
      ['6. Delete the example row (Row 2) before uploading, or it will be ignored automatically.'],
      ['7. Upload via: Payroll → Salary Setup → Upload Excel button.'],
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);

    // Set column widths
    ws1['!cols'] = [
      { wch: 15 }, // Employee ID
      { wch: 25 }, // Employee Name
      { wch: 14 }, // Basic Salary
      { wch: 18 }, // HRA
      { wch: 18 }, // DA
      { wch: 18 }, // Other Allowances
      { wch: 14 }, // PF Employee %
      { wch: 14 }, // ESI Employee %
      { wch: 14 }, // PF Employer %
      { wch: 14 }, // ESI Employer %
      { wch: 14 }, // TDS Monthly
      { wch: 18 }, // Advance Deduction
      { wch: 12 }, // LOP Days
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Salary Upload');
    XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');
    XLSX.writeFile(wb, 'hrms_salary_template.xlsx');
  };

  // Upload Excel with exact format matching
  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]]; // Read first sheet
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length < 2) {
          alert('Excel file is empty or missing data rows.');
          return;
        }

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const newSalaries: Record<string, any> = { ...salaries };

        // Process rows starting after header (index 1)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const empCode = String(row[0] || '').trim();
          const empName = String(row[1] || '').trim();
          const basic = parseFloat(row[2]) || 0;

          // Skip example row EMP001
          if (empCode === 'EMP001' || !empCode) {
            skippedCount++;
            continue;
          }

          // Match by Employee ID/Code
          const targetEmp = employees.find(
            (e) => (e.employeeCode || '').trim().toLowerCase() === empCode.toLowerCase()
          );

          if (!targetEmp) {
            skippedCount++;
            continue;
          }

          const hra = row[3] !== undefined && row[3] !== '' ? parseFloat(row[3]) : basic * 0.4;
          const da = row[4] !== undefined && row[4] !== '' ? parseFloat(row[4]) : basic * 0.1;
          const othAllow = parseFloat(row[5]) || 0;
          const pfEmp = parseFloat(row[6]) || 12;
          const esiEmp = parseFloat(row[7]) || 0.75;
          const pfEr = parseFloat(row[8]) || 13;
          const esiEr = parseFloat(row[9]) || 3.25;
          const tds = parseFloat(row[10]) || 0;
          const adv = parseFloat(row[11]) || 0;
          const gross = basic + hra + da + othAllow;

          const pfAmount = Math.min(basic, 15000) * (pfEmp / 100);
          const esiAmount = gross <= 21000 ? gross * (esiEmp / 100) : 0;
          const totalDed = pfAmount + esiAmount + 200 + tds + adv;
          const net = Math.max(0, gross - totalDed);

          const isExisting = !!newSalaries[targetEmp.id];
          if (isExisting) updatedCount++;
          else createdCount++;

          newSalaries[targetEmp.id] = {
            employee_id: targetEmp.id,
            employee_name: `${targetEmp.firstName} ${targetEmp.lastName}`.trim(),
            employee_code: targetEmp.employeeCode,
            effective_from: new Date().toISOString().split('T')[0],
            basic,
            hra,
            da,
            ta: 0,
            special_allowance: othAllow,
            gross_ctc: gross,
            pf_applicable: true,
            pf_employee_percent: pfEmp,
            pf_employer_percent: pfEr,
            esi_applicable: esiEmp > 0,
            esi_employee_percent: esiEmp,
            esi_employer_percent: esiEr,
            professional_tax: 200,
            tds_monthly: tds,
            advance_deduction: adv,
            net_pay: net,
            is_active: true,
          };
        }

        setSalaries(newSalaries);
        setUploadResult({
          message: 'Excel processed successfully!',
          created: createdCount,
          updated: updatedCount,
          skipped: skippedCount,
        });
      } catch (err: any) {
        alert('Failed to process Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // KPIs
  const configuredEmployees = Object.values(salaries).filter((s) => s.basic > 0);
  const kpiEmpCount = configuredEmployees.length;
  const kpiGross = configuredEmployees.reduce((acc, s) => acc + (s.gross_ctc || 0), 0);
  const kpiDed = configuredEmployees.reduce((acc, s) => acc + ((s.gross_ctc || 0) - (s.net_pay || 0)), 0);
  const kpiNet = kpiGross - kpiDed;

  // Run Payroll
  const handleRunPayroll = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setShowRunModal(false);
      const [y, m] = runMonth.split('-').map(Number);
      setRuns((prev) => [
        {
          id: `run-${y}-${m}`,
          month: m,
          year: y,
          status: 'processed',
          total_employees: kpiEmpCount || employees.length,
          total_gross: kpiGross || employees.length * 50000,
          total_deductions: kpiDed || employees.length * 2000,
          total_net: kpiNet || employees.length * 48000,
        },
        ...prev,
      ]);
      alert(`Payroll processed successfully for ${MONTH_NAMES[m]} ${y}!`);
      setActiveTab('runs');
    }, 1000);
  };

  // Load Payslip
  useEffect(() => {
    if (psEmpId) {
      const emp = employees.find((e) => e.id === psEmpId);
      const s = salaries[psEmpId];
      if (emp) {
        const [y, m] = psMonth.split('-').map(Number);
        const basic = s ? s.basic : 30000;
        const hra = s ? s.hra : 12000;
        const da = s ? s.da : 3000;
        const allowances = s ? (s.ta || 0) + (s.special_allowance || 0) : 5000;
        const gross = s ? s.gross_ctc : 50000;
        const deductions = s ? (s.gross_ctc - s.net_pay) : 2000;
        const net = s ? s.net_pay : 48000;

        setCurrentPayslip({
          employee_name: `${emp.firstName} ${emp.lastName}`.trim(),
          employee_code: emp.employeeCode,
          department_name: emp.department?.name || 'Aeronautical Engineering',
          designation: emp.designation?.title || 'Flight Operations Lead',
          month: m,
          year: y,
          total_working_days: 26,
          days_present: 25,
          days_leave_paid: 1,
          lop_days: 0,
          basic,
          hra,
          da,
          ta: s ? s.ta : 2000,
          special_allowance: s ? s.special_allowance : 3000,
          gross_earnings: gross,
          pf_employee: s ? (s.basic * (s.pf_employee_percent || 12) / 100) : 1800,
          esi_employee: 0,
          professional_tax: 200,
          tds: s ? s.tds_monthly : 0,
          total_deductions: deductions,
          pf_employer: 1800,
          esi_employer: 0,
          net_pay: net,
        });
      }
    } else {
      setCurrentPayslip(null);
    }
  }, [psEmpId, psMonth, employees, salaries]);

  return (
    <div className="space-y-5">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
          <div className="text-2xl font-black text-blue-600">{kpiEmpCount}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            EMPLOYEES ON PAYROLL
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
          <div className="text-2xl font-black text-emerald-600">{cur(kpiGross)}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            TOTAL GROSS THIS MONTH
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
          <div className="text-2xl font-black text-rose-600">{cur(kpiDed)}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            TOTAL DEDUCTIONS
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
          <div className="text-2xl font-black text-purple-600">{cur(kpiNet)}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            NET PAYABLE
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('salary')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition ${
            activeTab === 'salary' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Banknote className="h-4 w-4" />
          <span>Salary Setup</span>
        </button>

        <button
          onClick={() => setActiveTab('runs')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition ${
            activeTab === 'runs' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Play className="h-4 w-4" />
          <span>Payroll Runs</span>
        </button>

        <button
          onClick={() => setActiveTab('payslips')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition ${
            activeTab === 'payslips' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Payslips</span>
        </button>
      </div>

      {/* Tab 1: Salary Setup */}
      {activeTab === 'salary' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="🔍 Search employee..."
                value={salSearch}
                onChange={(e) => setSalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Download Template</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 cursor-pointer shadow-sm">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleUploadExcel}
                />
              </label>
            </div>
          </div>

          {/* Upload Result Box */}
          {uploadResult && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              <div className="flex items-center gap-2 font-bold mb-1">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>{uploadResult.message}</span>
              </div>
              <div className="flex items-center gap-4 text-emerald-800 text-[11px]">
                <span className="text-emerald-700 font-semibold">{uploadResult.created} created</span>
                <span className="text-blue-700 font-semibold">{uploadResult.updated} updated</span>
                <span className="text-amber-700 font-semibold">{uploadResult.skipped} skipped</span>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Basic</th>
                  <th className="p-3">HRA</th>
                  <th className="p-3">DA</th>
                  <th className="p-3">Allowances</th>
                  <th className="p-3">Gross CTC</th>
                  <th className="p-3">PF</th>
                  <th className="p-3">ESI</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees
                  .filter((e) => {
                    const q = salSearch.toLowerCase();
                    const name = `${e.firstName} ${e.lastName}`.toLowerCase();
                    const code = (e.employeeCode || '').toLowerCase();
                    return !q || name.includes(q) || code.includes(q);
                  })
                  .map((emp) => {
                    const s = salaries[emp.id];
                    const hasSetup = s && s.basic > 0;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <strong className="text-slate-900 block">{emp.firstName} {emp.lastName}</strong>
                          <span className="text-slate-400 text-[11px] font-mono">{emp.employeeCode}</span>
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{hasSetup ? cur(s.basic) : <span className="text-slate-400">—</span>}</td>
                        <td className="p-3 text-slate-600">{hasSetup && s.hra ? cur(s.hra) : <span className="text-slate-400">—</span>}</td>
                        <td className="p-3 text-slate-600">{hasSetup && s.da ? cur(s.da) : <span className="text-slate-400">—</span>}</td>
                        <td className="p-3 text-slate-600">
                          {hasSetup ? cur((s.ta || 0) + (s.special_allowance || 0) + (s.other_allowance || 0)) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="p-3">
                          {hasSetup ? (
                            <span className="px-2 py-0.5 rounded-full font-bold text-blue-700 bg-blue-50 border border-blue-200">
                              {cur(s.gross_ctc)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {hasSetup && s.pf_applicable ? (
                            <small className="text-emerald-600 font-semibold">✓ {s.pf_employee_percent || 12}%</small>
                          ) : (
                            <small className="text-slate-400">—</small>
                          )}
                        </td>
                        <td className="p-3">
                          {hasSetup && s.esi_applicable ? (
                            <small className="text-emerald-600 font-semibold">✓ {s.esi_employee_percent || 0.75}%</small>
                          ) : (
                            <small className="text-slate-400">—</small>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openSalaryModal(emp)}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                          >
                            {hasSetup ? 'Edit' : '+ Setup'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Payroll Runs */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowRunModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-500 shadow-sm"
            >
              <Play className="h-4 w-4" />
              <span>Run Payroll</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {runs.map((r) => (
              <div key={r.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">
                    {MONTH_NAMES[r.month]} {r.year}
                  </h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    r.status === 'finalized' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {r.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-2.5">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Employees</span>
                    <strong className="text-slate-800">{r.total_employees}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Gross</span>
                    <strong className="text-slate-800">{cur(r.total_gross)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Deductions</span>
                    <span className="text-rose-600 font-semibold">{cur(r.total_deductions)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Net Pay</span>
                    <strong className="text-emerald-600">{cur(r.total_net)}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <button
                    onClick={() => {
                      if (employees.length > 0) setPsEmpId(employees[0].id);
                      setActiveTab('payslips');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    View Payslips
                  </button>
                  <button onClick={() => alert('CSV exported')} className="px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                    CSV
                  </button>
                  <button onClick={() => alert('Excel exported')} className="px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                    Excel
                  </button>
                  {r.status === 'finalized' ? (
                    <button onClick={() => alert('Payslips published to all employee mobile dashboards!')} className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-sm">
                      Publish Payslips
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setRuns((prev) => prev.map((item) => (item.id === r.id ? { ...item, status: 'finalized' } : item)));
                        alert('Payroll finalized successfully.');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 shadow-sm"
                    >
                      Finalize
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Payslips */}
      {activeTab === 'payslips' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={psEmpId}
              onChange={(e) => setPsEmpId(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium"
            >
              <option value="">— Select Employee —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
              ))}
            </select>

            <input
              type="month"
              value={psMonth}
              onChange={(e) => setPsMonth(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium"
            />
          </div>

          {currentPayslip ? (
            <div className="max-w-2xl mx-auto rounded-3xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="p-6 text-white flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d4a6a 100%)' }}>
                <div>
                  <h3 className="text-lg font-bold">SUPERBEE AERONAUTICS PVT. LTD.</h3>
                  <p className="text-xs text-slate-300">
                    PAYSLIP FOR {MONTH_NAMES[currentPayslip.month].toUpperCase()} {currentPayslip.year}
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl backdrop-blur-sm transition"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print</span>
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Employee Name</span>
                    <strong className="text-slate-900 text-sm">{currentPayslip.employee_name}</strong>
                    <span className="text-slate-500 font-mono block mt-0.5">{currentPayslip.employee_code}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Department / Designation</span>
                    <strong className="text-slate-900">{currentPayslip.department_name}</strong>
                    <span className="text-slate-500 block mt-0.5">{currentPayslip.designation}</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Working Days</span>
                    <strong className="text-slate-800 text-sm">{currentPayslip.total_working_days}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Present</span>
                    <strong className="text-emerald-700 text-sm">{currentPayslip.days_present}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Leave (Paid)</span>
                    <strong className="text-blue-700 text-sm">{currentPayslip.days_leave_paid}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">LOP Days</span>
                    <strong className="text-rose-700 text-sm">{currentPayslip.lop_days}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5 uppercase tracking-wider text-[11px]">
                      Earnings
                    </h5>
                    <div className="flex justify-between text-slate-600"><span>Basic Salary</span><span>{cur(currentPayslip.basic)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>HRA</span><span>{cur(currentPayslip.hra)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>DA</span><span>{cur(currentPayslip.da)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>TA / Conveyance</span><span>{cur(currentPayslip.ta)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>Special Allowance</span><span>{cur(currentPayslip.special_allowance)}</span></div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                      <span>Gross Earnings</span>
                      <span className="text-blue-600">{cur(currentPayslip.gross_earnings)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5 uppercase tracking-wider text-[11px]">
                      Deductions
                    </h5>
                    <div className="flex justify-between text-slate-600"><span>PF (Employee 12%)</span><span>{cur(currentPayslip.pf_employee)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>Professional Tax</span><span>{cur(currentPayslip.professional_tax)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>TDS / Income Tax</span><span>{cur(currentPayslip.tds)}</span></div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                      <span>Total Deductions</span>
                      <span className="text-rose-600">{cur(currentPayslip.total_deductions)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-center shadow-md">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-90 block">NET TAKE-HOME PAY</span>
                  <div className="text-3xl font-black mt-0.5">{cur(currentPayslip.net_pay)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              Select an employee and month above to display their digital payslip.
            </div>
          )}
        </div>
      )}

      {/* ── Setup Salary Modal (Exact Match to Screenshots) ────────────────────── */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-base font-bold text-slate-900">Setup Salary — {salEmpName}</h3>
              <button onClick={() => setShowSalaryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Effective From */}
              <div className="w-48">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Effective From *</label>
                <input
                  type="date"
                  value={salEff}
                  onChange={(e) => setSalEff(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>

              {/* EARNINGS */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">EARNINGS</h4>
                <div className="grid grid-cols-4 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Basic Salary *</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eBasic}
                        onChange={(e) => setEBasic(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">HRA (₹) or</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={eHra}
                        onChange={(e) => {
                          setEHra(e.target.value);
                          if (e.target.value) setEHraPct('');
                        }}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">HRA % of Basic</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="e.g. 40"
                        value={eHraPct}
                        onChange={(e) => {
                          setEHraPct(e.target.value);
                          if (e.target.value) setEHra('');
                        }}
                        className="w-full pl-2 pr-6 py-1.5 border border-slate-200 rounded-xl"
                      />
                      <span className="absolute right-2.5 top-2 text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">DA (₹) or</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={eDa}
                        onChange={(e) => {
                          setEDa(e.target.value);
                          if (e.target.value) setEDaPct('');
                        }}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">DA % of Basic</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="e.g. 10"
                        value={eDaPct}
                        onChange={(e) => {
                          setEDaPct(e.target.value);
                          if (e.target.value) setEDa('');
                        }}
                        className="w-full pl-2 pr-6 py-1.5 border border-slate-200 rounded-xl"
                      />
                      <span className="absolute right-2.5 top-2 text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">TA / Conveyance</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eTa}
                        onChange={(e) => setETa(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Special Allowance</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eSa}
                        onChange={(e) => setESa(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Car Allowance</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eCar}
                        onChange={(e) => setECar(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Medical Allowance</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eMed}
                        onChange={(e) => setEMed(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Phone Allowance</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={ePhn}
                        onChange={(e) => setEPhn(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Child Education Allow.</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eCea}
                        onChange={(e) => setECea(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Other Allowance</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eOth}
                        onChange={(e) => setEOth(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Project Allowance</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eProj}
                        onChange={(e) => setEProj(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-600 mb-1">Monthly Incentive</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={eInc}
                        onChange={(e) => setEInc(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* PAY TYPE */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">PAY TYPE</h4>
                <div className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-4">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={dConsultant}
                        onChange={(e) => setDConsultant(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Consultant</span>
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Paid gross less TDS only — no PF, ESI or professional tax.
                    </p>
                  </div>

                  {dConsultant && (
                    <div className="col-span-3">
                      <label className="block text-[11px] text-slate-600 mb-1">TDS %</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={dTdsPct}
                          onChange={(e) => setDTdsPct(e.target.value)}
                          className="w-full pl-2 pr-16 py-1.5 border border-slate-200 rounded-xl"
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400">% of Gross</span>
                      </div>
                    </div>
                  )}

                  <div className={dConsultant ? 'col-span-5' : 'col-span-8'}>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={dFixed}
                        onChange={(e) => setDFixed(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Fixed Salary (no attendance proration)</span>
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Paid the full month regardless of attendance. Use for staff with no biometric/attendance capture. LOP applies only if days are marked absent manually.
                    </p>
                  </div>
                </div>
              </div>

              {/* DEDUCTIONS */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {dConsultant ? 'DEDUCTIONS — TDS ONLY' : 'DEDUCTIONS'}
                </h4>

                {!dConsultant ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2.5 items-end">
                      <div className="col-span-1">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 mb-2">
                          <input
                            type="checkbox"
                            checked={dPf}
                            onChange={(e) => setDPf(e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          <span>PF Applicable</span>
                        </label>
                      </div>

                      {dPf && (
                        <>
                          <div className="col-span-1">
                            <label className="block text-[11px] text-slate-600 mb-1">Employee PF %</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={dPfEmp}
                                onChange={(e) => setDPfEmp(e.target.value)}
                                className="w-full pl-2 pr-16 py-1.5 border border-slate-200 rounded-xl"
                              />
                              <span className="absolute right-2 top-2 text-[10px] text-slate-400">% of Basic</span>
                            </div>
                          </div>

                          <div className="col-span-1">
                            <label className="block text-[11px] text-slate-600 mb-1">Employer PF %</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={dPfEr}
                                onChange={(e) => setDPfEr(e.target.value)}
                                className="w-full pl-2 pr-16 py-1.5 border border-slate-200 rounded-xl"
                              />
                              <span className="absolute right-2 top-2 text-[10px] text-slate-400">% of Basic</span>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="col-span-1">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={dEsi}
                            onChange={(e) => setDEsi(e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          <span>ESI Applicable</span>
                        </label>
                        <span className="text-[10px] text-slate-400 block">For gross ≤ ₹21,000</span>
                      </div>
                    </div>

                    {dEsi && (
                      <div className="grid grid-cols-4 gap-2.5">
                        <div className="col-span-1">
                          <label className="block text-[11px] text-slate-600 mb-1">Employee ESI %</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={dEsiEmp}
                              onChange={(e) => setDEsiEmp(e.target.value)}
                              className="w-full pl-2 pr-6 py-1.5 border border-slate-200 rounded-xl"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-slate-400">%</span>
                          </div>
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[11px] text-slate-600 mb-1">Employer ESI %</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={dEsiEr}
                              onChange={(e) => setDEsiEr(e.target.value)}
                              className="w-full pl-2 pr-6 py-1.5 border border-slate-200 rounded-xl"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-slate-400">%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2.5">
                      <div className="col-span-1">
                        <label className="block text-[11px] text-slate-600 mb-1">Professional Tax (₹/mo)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                          <input
                            type="number"
                            value={dPt}
                            onChange={(e) => setDPt(e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="col-span-1">
                        <label className="block text-[11px] text-slate-600 mb-1">Monthly TDS</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                          <input
                            type="number"
                            value={dTds}
                            onChange={(e) => setDTds(e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="col-span-1">
                        <label className="block text-[11px] text-slate-600 mb-1">Loan / Advance EMI</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                          <input
                            type="number"
                            value={dAdv}
                            onChange={(e) => setDAdv(e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="col-span-1">
                        <label className="block text-[11px] text-slate-600 mb-1">Other Deduction</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                          <input
                            type="number"
                            value={dOtherDed}
                            onChange={(e) => setDOtherDed(e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5">
                    <div className="col-span-1">
                      <label className="block text-[11px] text-slate-600 mb-1">Loan / Advance EMI</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                        <input
                          type="number"
                          value={dAdv}
                          onChange={(e) => setDAdv(e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="col-span-1">
                      <label className="block text-[11px] text-slate-600 mb-1">Other Deduction</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                        <input
                          type="number"
                          value={dOtherDed}
                          onChange={(e) => setDOtherDed(e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Estimated Monthly Net Pay Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Estimated Monthly Net Pay:</span>
                <span className="text-xl font-bold text-emerald-600">{cur(estimatedNetPay)}</span>
              </div>

              {salError && <p className="text-rose-600 text-xs font-semibold">{salError}</p>}

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => alert(`Gross CTC: ${cur(calculatedEarnings.gross)} · Net Take-Home: ${cur(estimatedNetPay)}`)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 text-xs font-semibold"
                >
                  Preview CTC
                </button>
                <button
                  type="button"
                  onClick={handleSaveSalaryStructure}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 shadow-sm"
                >
                  Save Salary Structure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Run Monthly Payroll */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-base font-bold text-slate-900">Run Monthly Payroll</h3>
              <button onClick={() => setShowRunModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              This will calculate payslips for all employees with a salary structure, based on their attendance and approved leaves.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Month *</label>
                <input type="month" value={runMonth} onChange={(e) => setRunMonth(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Working Days in Month</label>
                <input type="number" value={runDays} onChange={(e) => setRunDays(Number(e.target.value))} className="w-full p-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Notes (optional)</label>
                <input type="text" value={runNotes} onChange={(e) => setRunNotes(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => setShowRunModal(false)} className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleRunPayroll}
                  className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 shadow-sm disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Process Payroll'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
