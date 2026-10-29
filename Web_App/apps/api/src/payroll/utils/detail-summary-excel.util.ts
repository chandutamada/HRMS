/**
 * Detail Summary Excel Generator
 *
 * Produces a 6-sheet workbook that mirrors the official HR salary register format:
 *   1. PAY_Sheet   – Full salary register with all earnings & deductions
 *   2. CTC Reco    – Cost-to-company reconciliation
 *   3. PT_Reco     – Professional Tax reconciliation
 *   4. PF_Reco     – Provident Fund reconciliation
 *   5. GROSS_Reco  – Month-over-month gross comparison
 *   6. NET_Reco    – Month-over-month net pay comparison
 */

import * as XLSX from 'xlsx';

export interface DetailSummaryEmployeeRow {
  slNo: number;
  code: string;
  name: string;
  doj: string; // DD/MM/YYYY
  jobType: string; // Permanent | Consultant
  department: string;
  designation: string;
  branch: string;
  bankAccountNo: string;
  resignedDate: string;
  relievedDate: string;
  ifscCode: string;
  uanNumber: string;
  workedDays: number;
  lopDays: number;
  rlopDays: number; // Recovered LOP (usually 0)
  basic: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowance: number;
  consultantFee: number;
  incentive: number;
  allowance: number; // misc allowance
  totalEarnings: number;
  providentFund: number; // employee PF deduction
  professionalTax: number;
  tds: number;
  totalDeductions: number;
  netPay: number;
  remarks: string;

  // CTC Reco extras
  costToCompany: number; // annual CTC
  fixedCtc: number;
  monthlyCtc: number;
  epfEmployer: number; // employer PF contribution
  fixedGross: number;
  proration: number; // prorated gross
  ctcDiff: number; // difference (should be 0)
  medicalInsurance: number;

  // For Month-over-month reco (GROSS & NET)
  prevMonthGross: number;
  prevMonthNet: number;
  grossDiff: number;
  netDiff: number;
  recoRemarks: string; // e.g. "LOP days in June"
}

export interface DetailSummaryData {
  companyName: string;
  monthLabel: string; // e.g. "Jun-2022"
  prevMonthLabel: string; // e.g. "May'22"
  currMonthLabel: string; // e.g. "June'22"
  employees: DetailSummaryEmployeeRow[];
  /** Employees who were part of the Pay Block FFS (full & final settlement) */
  ffEmployees: DetailSummaryEmployeeRow[];
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): number | string {
  if (!v || v === 0) return '- 0';
  return v;
}

function buildHeaderStyle(): any {
  return {
    font: { bold: true, sz: 10, name: 'Arial' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: 'C0C0C0' }, patternType: 'solid' },
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
  };
}

function buildTitleStyle(): any {
  return {
    font: { bold: true, sz: 12, name: 'Arial' },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
}

function buildDataStyle(): any {
  return {
    font: { sz: 9, name: 'Arial' },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
  };
}

function buildTotalStyle(): any {
  return {
    font: { bold: true, sz: 9, name: 'Arial' },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'FFFF99' }, patternType: 'solid' },
    border: {
      top: { style: 'thin' },
      bottom: { style: 'double' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
  };
}

/**
 * Write a cell into the worksheet with a style.
 */
function setCell(
  ws: XLSX.WorkSheet,
  colIndex: number,
  rowIndex: number,
  value: any,
  style?: any,
) {
  const addr = XLSX.utils.encode_cell({ c: colIndex, r: rowIndex });
  let cellType: string = 'n';
  if (typeof value === 'string') cellType = 's';
  else if (typeof value === 'number') cellType = 'n';

  ws[addr] = { v: value, t: cellType, s: style };

  // Keep track of sheet range
  if (!ws['!ref']) {
    ws['!ref'] = XLSX.utils.encode_range({ s: { c: colIndex, r: rowIndex }, e: { c: colIndex, r: rowIndex } });
  } else {
    const range = XLSX.utils.decode_range(ws['!ref']!);
    if (colIndex < range.s.c) range.s.c = colIndex;
    if (rowIndex < range.s.r) range.s.r = rowIndex;
    if (colIndex > range.e.c) range.e.c = colIndex;
    if (rowIndex > range.e.r) range.e.r = rowIndex;
    ws['!ref'] = XLSX.utils.encode_range(range);
  }
}

function mergeRange(ws: XLSX.WorkSheet, r1: number, c1: number, r2: number, c2: number) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

// ─────────────────────────────────────────────────────────
// Sheet 1: PAY_Sheet
// ─────────────────────────────────────────────────────────

const PAY_COLS = [
  'Sl No.', 'Code', 'Name', 'DOJ', 'Job Type', 'Department', 'Designation', 'Branch',
  'Bank Ac No', 'Resigned Date', 'Relieved Date', 'IFSC Code', 'Employee UAN',
  'Emp Worked days', 'LOP Days', 'RLOP',
  'BASIC', 'HRA', 'Conveyance', 'Special Allowance', 'Other Allowance',
  'Consultant Fee', 'Incentive', 'Allowance',
  'Total Earnings',
  'Provident Fund', 'Profession Tax', 'TDS',
  'Total Deductions', 'NETPAY', 'Remarks',
];

function buildPaySheet(data: DetailSummaryData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const titleStyle = buildTitleStyle();
  const hStyle = buildHeaderStyle();
  const dStyle = buildDataStyle();
  const tStyle = buildTotalStyle();

  // Row 0: Company name (merged across all columns)
  setCell(ws, 1, 0, data.companyName, titleStyle);
  mergeRange(ws, 0, 1, 0, PAY_COLS.length);

  // Row 1: "Salary Register for the month of : Jun-2022"
  setCell(ws, 1, 1, `Salary Register for the month of : ${data.monthLabel}`, titleStyle);
  mergeRange(ws, 1, 1, 1, PAY_COLS.length);

  // Row 2: blank spacer

  // Row 3: Headers
  PAY_COLS.forEach((col, ci) => setCell(ws, ci, 3, col, hStyle));

  const buildPayRow = (emp: DetailSummaryEmployeeRow, rowIdx: number) => {
    const vals: any[] = [
      emp.slNo, emp.code, emp.name, emp.doj, emp.jobType,
      emp.department, emp.designation, emp.branch,
      emp.bankAccountNo, emp.resignedDate, emp.relievedDate,
      emp.ifscCode, emp.uanNumber,
      emp.workedDays, fmt(emp.lopDays), fmt(emp.rlopDays),
      fmt(emp.basic), fmt(emp.hra), fmt(emp.conveyance),
      fmt(emp.specialAllowance), fmt(emp.otherAllowance),
      fmt(emp.consultantFee), fmt(emp.incentive), fmt(emp.allowance),
      emp.totalEarnings,
      fmt(emp.providentFund), fmt(emp.professionalTax), fmt(emp.tds),
      emp.totalDeductions, emp.netPay,
      emp.remarks || '',
    ];
    vals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, dStyle));
  };

  // Main block header row already written at row 3
  // Data rows start at row 4
  let rowIdx = 4;
  data.employees.forEach((emp) => {
    buildPayRow(emp, rowIdx++);
  });

  // Totals row for main block
  const mainTotals: any[] = [
    '', '', ' Total', '', '', '', '', '', '', '', '', '', '',
    '', '', '',
    data.employees.reduce((s, e) => s + e.basic, 0),
    data.employees.reduce((s, e) => s + e.hra, 0),
    data.employees.reduce((s, e) => s + e.conveyance, 0),
    data.employees.reduce((s, e) => s + e.specialAllowance, 0),
    data.employees.reduce((s, e) => s + e.otherAllowance, 0),
    data.employees.reduce((s, e) => s + e.consultantFee, 0),
    data.employees.reduce((s, e) => s + e.incentive, 0),
    data.employees.reduce((s, e) => s + e.allowance, 0),
    data.employees.reduce((s, e) => s + e.totalEarnings, 0),
    data.employees.reduce((s, e) => s + e.providentFund, 0),
    data.employees.reduce((s, e) => s + e.professionalTax, 0),
    data.employees.reduce((s, e) => s + e.tds, 0),
    data.employees.reduce((s, e) => s + e.totalDeductions, 0),
    data.employees.reduce((s, e) => s + e.netPay, 0),
    '',
  ];
  mainTotals.forEach((v, ci) => setCell(ws, ci, rowIdx++, v, tStyle));

  // ── Pay Block FFS ───────────────────────────────────────
  rowIdx++; // blank line

  setCell(ws, 1, rowIdx, 'Pay Block FFS', titleStyle);
  mergeRange(ws, rowIdx, 1, rowIdx, PAY_COLS.length);
  rowIdx++;

  rowIdx++; // blank
  // FFS headers (same cols)
  PAY_COLS.forEach((col, ci) => setCell(ws, ci, rowIdx, col, hStyle));
  rowIdx++;

  if (data.ffEmployees.length > 0) {
    data.ffEmployees.forEach((emp) => buildPayRow(emp, rowIdx++));
  } else {
    // Empty row placeholder
    const emptyRow = Array(PAY_COLS.length).fill('');
    emptyRow.forEach((v, ci) => setCell(ws, ci, rowIdx, v, dStyle));
    rowIdx++;
  }

  // FFS Totals
  const ffsTotals: any[] = [
    '', '', 'Total', '', '', '', '', '', '', '', '', '', '',
    '', '', '',
    data.ffEmployees.reduce((s, e) => s + e.basic, 0),
    data.ffEmployees.reduce((s, e) => s + e.hra, 0),
    data.ffEmployees.reduce((s, e) => s + e.conveyance, 0),
    data.ffEmployees.reduce((s, e) => s + e.specialAllowance, 0),
    data.ffEmployees.reduce((s, e) => s + e.otherAllowance, 0),
    data.ffEmployees.reduce((s, e) => s + e.consultantFee, 0),
    data.ffEmployees.reduce((s, e) => s + e.incentive, 0),
    data.ffEmployees.reduce((s, e) => s + e.allowance, 0),
    data.ffEmployees.reduce((s, e) => s + e.totalEarnings, 0),
    data.ffEmployees.reduce((s, e) => s + e.providentFund, 0),
    data.ffEmployees.reduce((s, e) => s + e.professionalTax, 0),
    data.ffEmployees.reduce((s, e) => s + e.tds, 0),
    data.ffEmployees.reduce((s, e) => s + e.totalDeductions, 0),
    data.ffEmployees.reduce((s, e) => s + e.netPay, 0),
    '',
  ];
  ffsTotals.forEach((v, ci) => setCell(ws, ci, rowIdx++, v, tStyle));

  rowIdx++; // blank

  // ── Grand Total ─────────────────────────────────────────
  const allEmps = [...data.employees, ...data.ffEmployees];
  setCell(ws, 1, rowIdx, 'Grand Total', { font: { bold: true, sz: 10, name: 'Arial' } } as any);
  const grandTotals: any[] = [
    '', '', '', '', '', '', '', '', '', '', '', '', '',
    '', '', '',
    allEmps.reduce((s, e) => s + e.basic, 0),
    allEmps.reduce((s, e) => s + e.hra, 0),
    allEmps.reduce((s, e) => s + e.conveyance, 0),
    allEmps.reduce((s, e) => s + e.specialAllowance, 0),
    allEmps.reduce((s, e) => s + e.otherAllowance, 0),
    allEmps.reduce((s, e) => s + e.consultantFee, 0),
    allEmps.reduce((s, e) => s + e.incentive, 0),
    allEmps.reduce((s, e) => s + e.allowance, 0),
    allEmps.reduce((s, e) => s + e.totalEarnings, 0),
    allEmps.reduce((s, e) => s + e.providentFund, 0),
    allEmps.reduce((s, e) => s + e.professionalTax, 0),
    allEmps.reduce((s, e) => s + e.tds, 0),
    allEmps.reduce((s, e) => s + e.totalDeductions, 0),
    allEmps.reduce((s, e) => s + e.netPay, 0),
    '',
  ];
  grandTotals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, tStyle));

  // Column widths
  ws['!cols'] = [
    { wch: 5 },  // Sl No
    { wch: 8 },  // Code
    { wch: 22 }, // Name
    { wch: 11 }, // DOJ
    { wch: 11 }, // Job Type
    { wch: 16 }, // Dept
    { wch: 20 }, // Designation
    { wch: 12 }, // Branch
    { wch: 18 }, // Bank Ac No
    { wch: 12 }, // Resigned
    { wch: 12 }, // Relieved
    { wch: 13 }, // IFSC
    { wch: 15 }, // UAN
    { wch: 13 }, // Worked Days
    { wch: 9 },  // LOP
    { wch: 7 },  // RLOP
    { wch: 10 }, // BASIC
    { wch: 10 }, // HRA
    { wch: 11 }, // Conveyance
    { wch: 15 }, // Special Allow
    { wch: 14 }, // Other Allow
    { wch: 13 }, // Consultant Fee
    { wch: 10 }, // Incentive
    { wch: 10 }, // Allowance
    { wch: 13 }, // Total Earnings
    { wch: 13 }, // PF
    { wch: 13 }, // PT
    { wch: 10 }, // TDS
    { wch: 14 }, // Total Deductions
    { wch: 10 }, // NETPAY
    { wch: 18 }, // Remarks
  ];

  ws['!rows'] = [{ hpx: 18 }, { hpx: 18 }, { hpx: 6 }, { hpx: 40 }];

  return ws;
}

// ─────────────────────────────────────────────────────────
// Sheet 2: CTC Reco
// ─────────────────────────────────────────────────────────

const CTC_COLS = [
  'Code', 'Code', 'Name', 'Emp Worked days',
  'Cost to company', 'VP', 'Fixed CTC', 'Monthly Cost to company',
  'Consultant fee', 'Stipend', 'Medical Insurance', 'Provident fund Employer',
  'Fixed Gross', 'Proration', 'Total Earnings', 'Dif',
  'Incentive', 'Allowance', 'Diff', 'Remarks',
];

function buildCtcSheet(data: DetailSummaryData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const titleStyle = buildTitleStyle();
  const hStyle = buildHeaderStyle();
  const dStyle = buildDataStyle();
  const tStyle = buildTotalStyle();

  setCell(ws, 1, 0, data.companyName, titleStyle);
  mergeRange(ws, 0, 1, 0, CTC_COLS.length);
  setCell(ws, 1, 1, 'CTC Reco', titleStyle);
  mergeRange(ws, 1, 1, 1, CTC_COLS.length);

  CTC_COLS.forEach((col, ci) => setCell(ws, ci, 3, col, hStyle));

  const allEmps = [...data.employees, ...data.ffEmployees];

  let rowIdx = 4;
  allEmps.forEach((emp, i) => {
    const vals: any[] = [
      i + 1,
      emp.code,
      emp.name,
      emp.workedDays,
      fmt(emp.costToCompany),
      '- 0',
      fmt(emp.fixedCtc),
      fmt(emp.monthlyCtc),
      fmt(emp.consultantFee),
      '- 0', // Stipend
      fmt(emp.medicalInsurance),
      fmt(emp.epfEmployer),
      fmt(emp.fixedGross),
      fmt(emp.proration),
      fmt(emp.totalEarnings),
      fmt(emp.ctcDiff),
      fmt(emp.incentive),
      fmt(emp.allowance),
      fmt(emp.ctcDiff), // diff2
      emp.remarks || '',
    ];
    vals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, dStyle));
    rowIdx++;
  });

  // Totals
  const totals: any[] = [
    '', '', '', 'Total',
    allEmps.reduce((s, e) => s + e.costToCompany, 0),
    '- 0',
    allEmps.reduce((s, e) => s + e.fixedCtc, 0),
    allEmps.reduce((s, e) => s + e.monthlyCtc, 0),
    '- 0', '- 0',
    allEmps.reduce((s, e) => s + e.medicalInsurance, 0),
    allEmps.reduce((s, e) => s + e.epfEmployer, 0),
    allEmps.reduce((s, e) => s + e.fixedGross, 0),
    allEmps.reduce((s, e) => s + e.proration, 0),
    allEmps.reduce((s, e) => s + e.totalEarnings, 0),
    allEmps.reduce((s, e) => s + e.ctcDiff, 0),
    allEmps.reduce((s, e) => s + e.incentive, 0),
    allEmps.reduce((s, e) => s + e.allowance, 0),
    '- 0', '',
  ];
  totals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, tStyle));

  ws['!cols'] = [
    { wch: 5 }, { wch: 8 }, { wch: 24 }, { wch: 14 },
    { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 20 },
    { wch: 14 }, { wch: 10 }, { wch: 17 }, { wch: 20 },
    { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 8 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 },
  ];

  return ws;
}

// ─────────────────────────────────────────────────────────
// Sheet 3: PT_Reco
// ─────────────────────────────────────────────────────────

const PT_COLS = ['Sl No.', 'Code', 'Name', 'Total Earnings', 'PT calculation', 'As per sheet', 'Diff', 'Remarks'];

function buildPtSheet(data: DetailSummaryData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const titleStyle = buildTitleStyle();
  const hStyle = buildHeaderStyle();
  const dStyle = buildDataStyle();
  const tStyle = buildTotalStyle();

  setCell(ws, 1, 0, data.companyName, titleStyle);
  mergeRange(ws, 0, 1, 0, PT_COLS.length);
  setCell(ws, 1, 1, 'PT Reco', titleStyle);
  mergeRange(ws, 1, 1, 1, PT_COLS.length);

  PT_COLS.forEach((col, ci) => setCell(ws, ci, 3, col, hStyle));

  const allEmps = [...data.employees, ...data.ffEmployees];

  let rowIdx = 4;
  allEmps.forEach((emp, i) => {
    // PT calculation: standard Indian slab based on total earnings
    const ptCalc = getPtCalculation(emp.totalEarnings);
    // For consultants, PT as per sheet is 0 (they are exempt in many states)
    const ptAsPerSheet = emp.jobType === 'Consultant' ? 0 : emp.professionalTax;
    const ptDiff = ptCalc - ptAsPerSheet;
    const ptRemarks = emp.jobType === 'Consultant' ? 'No PT for consultant' : '';

    const vals: any[] = [
      i + 1, emp.code, emp.name,
      emp.totalEarnings,
      ptCalc || '- 0',
      ptAsPerSheet || '- 0',
      ptDiff || '- 0',
      ptRemarks,
    ];
    vals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, dStyle));
    rowIdx++;
  });

  const totalPtCalc = allEmps.reduce((s, e) => s + getPtCalculation(e.totalEarnings), 0);
  const totalPtSheet = allEmps.reduce((s, e) => s + (e.jobType === 'Consultant' ? 0 : e.professionalTax), 0);
  const totalDiff = totalPtCalc - totalPtSheet;

  const totals: any[] = [
    '', '', 'Total',
    allEmps.reduce((s, e) => s + e.totalEarnings, 0),
    totalPtCalc || '- 0',
    totalPtSheet || '- 0',
    totalDiff || '- 0',
    '',
  ];
  totals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, tStyle));

  ws['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 26 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 22 },
  ];

  return ws;
}

/** Standard Karnataka/AP PT slab (monthly) */
function getPtCalculation(totalEarnings: number): number {
  if (totalEarnings <= 0) return 0;
  if (totalEarnings <= 14999) return 0;
  if (totalEarnings <= 19999) return 150;
  return 200;
}

// ─────────────────────────────────────────────────────────
// Sheet 4: PF_Reco
// ─────────────────────────────────────────────────────────

const PF_COLS = [
  'Sl No.', 'Code', 'Name', 'Emp worked days',
  'Basic+spl+other all+con', ' Arrears', ' Recovery',
  'PF Wage', 'PF Calculation wage',
  'Provident Fund', 'Provident Fund Recovery', 'Provident Fund Arrears',
  'Total PF', 'As per sheet', 'As per sheet arrears', 'Diff', 'Remarks',
];

const PF_WAGE_CEILING = 15000; // EPFO statutory ceiling

function buildPfSheet(data: DetailSummaryData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const titleStyle = buildTitleStyle();
  const hStyle = buildHeaderStyle();
  const dStyle = buildDataStyle();
  const tStyle = buildTotalStyle();

  setCell(ws, 1, 0, data.companyName, titleStyle);
  mergeRange(ws, 0, 1, 0, PF_COLS.length);
  setCell(ws, 1, 1, 'PF Reco', titleStyle);
  mergeRange(ws, 1, 1, 1, PF_COLS.length);

  PF_COLS.forEach((col, ci) => setCell(ws, ci, 3, col, hStyle));

  const allEmps = [...data.employees, ...data.ffEmployees];

  let rowIdx = 4;
  allEmps.forEach((emp, i) => {
    const pfBase = emp.basic + emp.specialAllowance + emp.otherAllowance + emp.consultantFee;
    const pfWage = pfBase; // actual wage subjected to PF
    const pfCalcWage = Math.min(pfWage, PF_WAGE_CEILING);
    const pfCalc = emp.jobType === 'Consultant' ? 0 : Math.round(pfCalcWage * 0.12);
    const totalPf = pfCalc; // no arrears in standard month
    const diff = totalPf - emp.providentFund;

    const vals: any[] = [
      i + 1, emp.code, emp.name,
      emp.workedDays,
      pfBase || '- 0',
      '- 0', // arrears
      '- 0', // recovery
      pfWage || '- 0',
      pfCalcWage || '- 0',
      pfCalc || '- 0',
      '- 0', // PF Recovery
      '- 0', // PF Arrears
      totalPf || '- 0',
      emp.providentFund || '- 0',
      '- 0', // as per sheet arrears
      diff || '- 0',
      emp.remarks || '',
    ];
    vals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, dStyle));
    rowIdx++;
  });

  const totalPfBase = allEmps.reduce((s, e) => s + e.basic + e.specialAllowance + e.otherAllowance + e.consultantFee, 0);
  const totalPfWage = totalPfBase;
  const totalPfCalcWage = allEmps.reduce((s, e) => s + Math.min(e.basic + e.specialAllowance + e.otherAllowance + e.consultantFee, PF_WAGE_CEILING), 0);
  const totalPfCalc = allEmps.reduce((s, e) => {
    if (e.jobType === 'Consultant') return s;
    const pfBase2 = e.basic + e.specialAllowance + e.otherAllowance + e.consultantFee;
    return s + Math.round(Math.min(pfBase2, PF_WAGE_CEILING) * 0.12);
  }, 0);
  const totalPfSheet = allEmps.reduce((s, e) => s + e.providentFund, 0);

  const totals: any[] = [
    '', '', '', '',
    totalPfBase || '- 0',
    '- 0', '- 0',
    totalPfWage || '- 0',
    totalPfCalcWage || '- 0',
    totalPfCalc || '- 0',
    '- 0', '- 0',
    totalPfCalc || '- 0',
    totalPfSheet || '- 0',
    '- 0',
    (totalPfCalc - totalPfSheet) || '- 0',
    '',
  ];
  totals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, tStyle));

  ws['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 24 }, { wch: 14 },
    { wch: 22 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 18 },
    { wch: 14 }, { wch: 22 }, { wch: 20 },
    { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 14 },
  ];

  return ws;
}

// ─────────────────────────────────────────────────────────
// Sheet 5: GROSS_Reco
// ─────────────────────────────────────────────────────────

const GROSS_COLS = ['Sl No.', 'Code', 'Name', '', '', 'Diff', 'Remarks'];

function buildGrossSheet(data: DetailSummaryData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const titleStyle = buildTitleStyle();
  const hStyle = buildHeaderStyle();
  const dStyle = buildDataStyle();
  const tStyle = buildTotalStyle();

  setCell(ws, 1, 0, data.companyName, titleStyle);
  mergeRange(ws, 0, 1, 0, 7);
  setCell(ws, 1, 1, 'Gross Reco', titleStyle);
  mergeRange(ws, 1, 1, 1, 7);

  // Headers with dynamic month labels
  const cols = ['Sl No.', 'Code', 'Name', data.prevMonthLabel, data.currMonthLabel, 'Diff', 'Remarks'];
  cols.forEach((col, ci) => setCell(ws, ci, 3, col, hStyle));

  const allEmps = [...data.employees, ...data.ffEmployees];

  let rowIdx = 4;
  allEmps.forEach((emp, i) => {
    const vals: any[] = [
      i + 1, emp.code, emp.name,
      emp.prevMonthGross || '- 0',
      emp.totalEarnings,
      emp.grossDiff || '- 0',
      emp.recoRemarks || '',
    ];
    vals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, dStyle));
    rowIdx++;
  });

  const totals: any[] = [
    '', '', 'Total',
    allEmps.reduce((s, e) => s + (e.prevMonthGross || 0), 0),
    allEmps.reduce((s, e) => s + e.totalEarnings, 0),
    allEmps.reduce((s, e) => s + (e.grossDiff || 0), 0),
    '',
  ];
  totals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, tStyle));

  ws['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 26 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 22 },
  ];

  return ws;
}

// ─────────────────────────────────────────────────────────
// Sheet 6: NET_Reco
// ─────────────────────────────────────────────────────────

function buildNetSheet(data: DetailSummaryData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const titleStyle = buildTitleStyle();
  const hStyle = buildHeaderStyle();
  const dStyle = buildDataStyle();
  const tStyle = buildTotalStyle();

  setCell(ws, 1, 0, data.companyName, titleStyle);
  mergeRange(ws, 0, 1, 0, 7);
  setCell(ws, 1, 1, 'Net Reco', titleStyle);
  mergeRange(ws, 1, 1, 1, 7);

  const cols = ['Sl No.', 'Code', 'Name', data.prevMonthLabel, data.currMonthLabel, 'Diff', 'Remarks'];
  cols.forEach((col, ci) => setCell(ws, ci, 3, col, hStyle));

  const allEmps = [...data.employees, ...data.ffEmployees];

  let rowIdx = 4;
  allEmps.forEach((emp, i) => {
    const vals: any[] = [
      i + 1, emp.code, emp.name,
      emp.prevMonthNet || '- 0',
      emp.netPay,
      emp.netDiff || '- 0',
      emp.recoRemarks || '',
    ];
    vals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, dStyle));
    rowIdx++;
  });

  const totals: any[] = [
    '', '', 'Total',
    allEmps.reduce((s, e) => s + (e.prevMonthNet || 0), 0),
    allEmps.reduce((s, e) => s + e.netPay, 0),
    allEmps.reduce((s, e) => s + (e.netDiff || 0), 0),
    '',
  ];
  totals.forEach((v, ci) => setCell(ws, ci, rowIdx, v, tStyle));

  ws['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 26 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 22 },
  ];

  return ws;
}

// ─────────────────────────────────────────────────────────
// Main export function
// ─────────────────────────────────────────────────────────

/**
 * Generates the complete 6-sheet Detail Summary workbook as a Buffer.
 */
export function generateDetailSummaryExcel(data: DetailSummaryData): Buffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildPaySheet(data), 'PAY_Sheet');
  XLSX.utils.book_append_sheet(wb, buildCtcSheet(data), 'CTC Reco');
  XLSX.utils.book_append_sheet(wb, buildPtSheet(data), 'PT_Reco');
  XLSX.utils.book_append_sheet(wb, buildPfSheet(data), 'PF_Reco');
  XLSX.utils.book_append_sheet(wb, buildGrossSheet(data), 'GROSS_Reco');
  XLSX.utils.book_append_sheet(wb, buildNetSheet(data), 'NET_Reco');

  const xlsxBuffer = XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    cellStyles: true, // needed for styles
  });

  return xlsxBuffer;
}
