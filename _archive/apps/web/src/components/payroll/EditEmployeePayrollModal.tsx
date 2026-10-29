'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  X,
  User,
  Calculator,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  DollarSign,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface EditEmployeePayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeData: any | null;
  year: number;
  month: number;
  onSuccess: () => void;
}

export default function EditEmployeePayrollModal({
  isOpen,
  onClose,
  employeeData,
  year,
  month,
  onSuccess,
}: EditEmployeePayrollModalProps) {
  const [basicSalary, setBasicSalary] = useState<number>(50000);
  const [hra, setHra] = useState<number>(20000);
  const [medical, setMedical] = useState<number>(1250);
  const [other, setOther] = useState<number>(0);
  const [epf, setEpf] = useState<number>(6000);
  const [pt, setPt] = useState<number>(200);
  const [tds, setTds] = useState<number>(0);
  const [lopDays, setLopDays] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (employeeData) {
      setBasicSalary(Number(employeeData.basicSalary) || 50000);
      setHra(Number(employeeData.hra) || 20000);
      setMedical(Number(employeeData.medicalAllowance) || 1250);
      setOther(Number(employeeData.otherAllowances) || 0);
      setEpf(Number(employeeData.epf) || 6000);
      setPt(Number(employeeData.professionalTax) || 200);
      setTds(Number(employeeData.tds) || 0);
      setLopDays(Number(employeeData.lopDays) || 0);
    }
  }, [employeeData]);

  if (!isOpen || !employeeData) return null;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const totalDays = new Date(year, month, 0).getDate();
  const allowancesEarnings = hra + medical + other;
  const grossEarnings = basicSalary + allowancesEarnings;
  const perDaySalary = totalDays > 0 ? grossEarnings / totalDays : 0;
  const lopAmount = Math.round(perDaySalary * lopDays);
  const totalDeductions = epf + pt + tds + lopAmount;
  const netSalary = Math.max(0, grossEarnings - totalDeductions);

  const handleSave = async (finalize: boolean) => {
    setIsSubmitting(true);
    try {
      await api.post('/payroll/individual-generate', {
        employeeId: employeeData.employeeId,
        year,
        month,
        totalDays,
        paidDays: Math.max(0, totalDays - lopDays),
        basicSalary,
        hra,
        hraEnabled: hra > 0,
        da: 0,
        daEnabled: false,
        medicalAllowance: medical,
        medicalAllowanceEnabled: medical > 0,
        otherAllowance: other,
        otherAllowanceEnabled: other > 0,
        epf,
        professionalTax: pt,
        tds,
        lopDays,
        lopAmount,
        finalize,
      });

      alert(
        finalize
          ? `🎉 Payslip finalized and official payslip published for ${employeeData.fullName}!`
          : `Saved successfully! The updated salary breakdown will also carry forward to future months.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error updating payroll: ' + (err.message || 'Failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Edit Payroll for {employeeData.fullName}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {employeeData.employeeCode} • {employeeData.department} • {monthNames[month - 1]} {year}
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

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Earnings Section */}
          <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
            <h4 className="font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Sparkles className="h-3.5 w-3.5" />
              Monthly Earnings (₹)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Basic Salary (₹)
                </label>
                <input
                  type="number"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-bold text-slate-800 bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  House Rent Allowance (HRA) (₹)
                </label>
                <input
                  type="number"
                  value={hra}
                  onChange={(e) => setHra(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-medium text-slate-800 bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Medical Allowance (₹)
                </label>
                <input
                  type="number"
                  value={medical}
                  onChange={(e) => setMedical(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-medium text-slate-800 bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Other / Special Allowances (₹)
                </label>
                <input
                  type="number"
                  value={other}
                  onChange={(e) => setOther(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-medium text-slate-800 bg-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-800">
              <span>Gross Monthly Earnings:</span>
              <span className="font-mono text-sm text-emerald-700">
                ₹{grossEarnings.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Deductions Section */}
          <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
            <h4 className="font-bold text-rose-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <AlertCircle className="h-3.5 w-3.5" />
              Monthly Deductions (₹)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Employees Provident Fund (EPF) (₹)
                </label>
                <input
                  type="number"
                  value={epf}
                  onChange={(e) => setEpf(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-medium text-slate-800 bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Professional Tax (PT) (₹)
                </label>
                <input
                  type="number"
                  value={pt}
                  onChange={(e) => setPt(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-medium text-slate-800 bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  TDS / Income Tax (₹)
                </label>
                <input
                  type="number"
                  value={tds}
                  onChange={(e) => setTds(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-medium text-slate-800 bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Loss of Pay (LOP Days)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={totalDays}
                    value={lopDays}
                    onChange={(e) => setLopDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-medium text-slate-800 bg-white focus:border-emerald-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-500 font-mono shrink-0">
                    -₹{lopAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-800">
              <span>Total Deductions:</span>
              <span className="font-mono text-sm text-rose-700">
                ₹{totalDeductions.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Net Salary Summary Callout */}
          <div className="flex items-center justify-between rounded-2xl bg-emerald-600 text-white p-4 shadow-lg shadow-emerald-600/20">
            <div>
              <span className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">
                Net Payable Take-Home Salary
              </span>
              <h3 className="text-2xl font-black font-mono tracking-tight">
                ₹{netSalary.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="text-right text-[11px] text-emerald-100">
              <div>Paid Days: <strong>{totalDays - lopDays}</strong> / {totalDays}</div>
              <div>Gross: ₹{grossEarnings.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Carry-Forward Assurance Notice */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Automatic Carry-Forward:</strong> Saving these numbers updates {employeeData.fullName}&apos;s master salary structure. All future months will automatically pre-populate with these exact values until edited again!
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
            >
              Save & Carry Forward
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 transition disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Finalize & Publish Payslip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
