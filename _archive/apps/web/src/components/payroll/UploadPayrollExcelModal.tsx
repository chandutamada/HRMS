'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle,
  X,
  Users,
  DollarSign,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface UploadPayrollExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  companyId?: string;
  employees: any[];
  onUploadSuccess: () => void;
}

export default function UploadPayrollExcelModal({
  isOpen,
  onClose,
  year,
  month,
  companyId,
  employees,
  onUploadSuccess,
}: UploadPayrollExcelModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parsingError, setParsingError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // 1. Download Pre-Populated Sample Template
  const handleDownloadTemplate = () => {
    const templateData = employees.map((emp) => ({
      'Employee Code': emp.employeeCode || '',
      'Full Name': emp.fullName || `${emp.firstName} ${emp.lastName}`,
      'Department': emp.department || 'Aeronautics',
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
      `Payroll_Template_${monthNames[month - 1]}_${year}.xlsx`
    );
  };

  // 2. Handle File Selection and Parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsingError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(ws) as any[];

        if (!rawJson || rawJson.length === 0) {
          setParsingError('The selected spreadsheet contains no data rows.');
          setParsedRows([]);
          return;
        }

        const formatted = rawJson
          .map((row) => ({
            employeeCode: String(
              row['Employee Code'] ||
                row['employeeCode'] ||
                row['Emp Code'] ||
                row['Code'] ||
                ''
            ).trim(),
            fullName: String(
              row['Full Name'] ||
                row['fullName'] ||
                row['Employee Name'] ||
                row['Name'] ||
                ''
            ).trim(),
            basicSalary: Number(
              row['Basic Salary'] ||
                row['basicSalary'] ||
                row['Basic'] ||
                row['BASIC'] ||
                0
            ),
            hra: Number(row['HRA'] || row['hra'] || row['Hra'] || 0),
            conveyance: Number(
              row['Conveyance'] || row['conveyance'] || 0
            ),
            da: Number(row['DA'] || row['da'] || 0),
            medicalAllowance: Number(
              row['Medical Allowance'] ||
                row['medicalAllowance'] ||
                row['Medical'] ||
                0
            ),
            specialAllowance: Number(
              row['Special Allowance'] ||
                row['specialAllowance'] ||
                row['Special'] ||
                0
            ),
            otherAllowances: Number(
              row['Other Allowances'] ||
                row['otherAllowances'] ||
                row['Other'] ||
                0
            ),
            epfEmployee: Number(
              row['EPF (Employee)'] ||
                row['epfEmployee'] ||
                row['EPF'] ||
                row['PF'] ||
                0
            ),
            professionalTax: Number(
              row['Professional Tax'] ||
                row['professionalTax'] ||
                row['PT'] ||
                0
            ),
            tds: Number(
              row['TDS / Tax'] || row['TDS'] || row['tds'] || row['Tax'] || 0
            ),
            lopDays: Number(
              row['LOP Days'] || row['lopDays'] || row['LOP'] || 0
            ),
          }))
          .filter((r) => r.employeeCode);

        if (formatted.length === 0) {
          setParsingError(
            'Could not find "Employee Code" column in the sheet. Please make sure the column is named "Employee Code".'
          );
          setParsedRows([]);
          return;
        }

        setParsedRows(formatted);
      } catch (err: any) {
        setParsingError('Failed to parse file: ' + err.message);
        setParsedRows([]);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  // 3. Submit and Apply Bulk Payroll
  const handleApply = async () => {
    if (parsedRows.length === 0) {
      alert('Please upload a valid Excel file first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<any>('/payroll/bulk-upload', {
        year,
        month,
        companyId,
        records: parsedRows,
      });

      alert(
        `🎉 ${res.message || 'Successfully populated payroll for all employees!'}`
      );
      onUploadSuccess();
      onClose();
    } catch (err: any) {
      alert('Upload failed: ' + (err.message || 'Error processing request'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalUploadedGross = parsedRows.reduce(
    (acc, r) =>
      acc +
      (r.basicSalary +
        r.hra +
        r.conveyance +
        r.da +
        r.medicalAllowance +
        r.specialAllowance +
        r.otherAllowances),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Bulk Upload Payroll Details via Excel
              </h3>
              <p className="text-xs text-slate-500">
                Period: <strong>{monthNames[month - 1]} {year}</strong> • Auto-fills all employees and carries forward salary details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Step 1: Download Template Callout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 p-4">
            <div className="space-y-1">
              <h4 className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Download className="h-4 w-4 text-emerald-700" />
                Step 1: Download Current Pre-Populated Template
              </h4>
              <p className="text-emerald-800 text-[11px]">
                Contains all {employees.length} active employees with their codes and default salary columns ready for editing.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 font-bold text-emerald-700 shadow-sm border border-emerald-200 hover:bg-emerald-100/50 transition shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Download Excel Template</span>
            </button>
          </div>

          {/* Step 2: Drag & Drop Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 p-8 cursor-pointer transition text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md border border-slate-200 group-hover:scale-110 transition text-emerald-600">
              <Upload className="h-6 w-6" />
            </div>
            <h4 className="mt-3 font-bold text-slate-800 text-sm">
              {file ? file.name : 'Click to select or drag & drop Payroll Excel / CSV'}
            </h4>
            <p className="mt-1 text-slate-500 text-[11px]">
              Supports standard Microsoft Excel (.xlsx, .xls) and CSV (.csv) files
            </p>
          </div>

          {/* Error Message */}
          {parsingError && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{parsingError}</span>
            </div>
          )}

          {/* Step 3: Parsed Data Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h4 className="font-bold text-slate-800">
                    Parsed Data Preview ({parsedRows.length} Employees Detected)
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500">
                    Total Gross Payroll:{' '}
                    <strong className="text-slate-900 font-mono">
                      ₹{totalUploadedGross.toLocaleString('en-IN')}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-inner max-h-56">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2 text-right">Basic (₹)</th>
                      <th className="px-3 py-2 text-right">HRA (₹)</th>
                      <th className="px-3 py-2 text-right">Medical (₹)</th>
                      <th className="px-3 py-2 text-right">EPF (₹)</th>
                      <th className="px-3 py-2 text-right">PT (₹)</th>
                      <th className="px-3 py-2 text-right">TDS (₹)</th>
                      <th className="px-3 py-2 text-center">LOP Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="px-3 py-1.5 font-bold text-emerald-700">
                          {row.employeeCode}
                        </td>
                        <td className="px-3 py-1.5 font-sans font-medium text-slate-800">
                          {row.fullName || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium">
                          {row.basicSalary.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600">
                          {row.hra.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600">
                          {row.medicalAllowance.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-right text-rose-600">
                          {row.epfEmployee.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-right text-rose-600">
                          {row.professionalTax.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-right text-rose-600">
                          {row.tds.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-1.5 text-center text-slate-600 font-sans">
                          {row.lopDays > 0 ? (
                            <span className="rounded bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[10px] font-bold">
                              {row.lopDays}d LOP
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Carry-Forward Notice:</strong> Applying these values updates each employee&apos;s active Salary Structure. The same breakdown will automatically carry forward to subsequent months until edited again.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isSubmitting || parsedRows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 disabled:opacity-50 transition"
          >
            {isSubmitting ? (
              <span>Applying Payroll Data...</span>
            ) : (
              <>
                <span>Apply to All {parsedRows.length || 0} Employees</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
