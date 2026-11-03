'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  CalendarCheck,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  ShieldCheck,
  Plane,
  Award,
  Calculator,
  Printer,
  Info,
  ChevronRight,
  UserCheck,
  HeartPulse,
  Baby,
  Building,
  MapPin,
  Calendar,
} from 'lucide-react';

export default function LeavePage() {
  const { user, activeCompany } = useAuth();
  const [activeTab, setActiveTab] = useState<'applications' | 'policies' | 'document' | 'calculator'>('applications');
  const [applications, setApplications] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [policyDoc, setPolicyDoc] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Review modal state
  const [reviewModalApp, setReviewModalApp] = useState<any>(null);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Calculator State
  const [calcEmpId, setCalcEmpId] = useState('');
  const [encashmentData, setEncashmentData] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const [appRes, typeRes, docRes, empRes] = await Promise.all([
        api.get<any[]>('/leave/applications', {
          companyId: activeCompany?.id,
        }),
        api.get<any[]>('/leave/types', {
          companyId: activeCompany?.id,
        }),
        api.get<any>('/leave/policy-document').catch(() => null),
        api.get<any>('/employees', {
          companyId: activeCompany?.id,
          limit: 100,
        }).catch(() => null),
      ]);

      setApplications(appRes || []);
      setLeaveTypes(typeRes || []);
      if (docRes) setPolicyDoc(docRes);
      if (empRes?.items) {
        setEmployees(empRes.items);
        if (empRes.items.length > 0 && !calcEmpId) {
          setCalcEmpId(empRes.items[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load leave data:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeCompany]);

  const handleOpenReview = (app: any, status: 'APPROVED' | 'REJECTED') => {
    setReviewModalApp(app);
    setReviewStatus(status);
    setReviewRemarks(status === 'APPROVED' ? 'Approved as per leave balance' : 'Rejected due to operational constraints');
  };

  const handleConfirmReview = async () => {
    if (!reviewModalApp) return;
    setIsSubmittingReview(true);
    try {
      await api.put(`/leave/applications/${reviewModalApp.id}/review`, {
        status: reviewStatus,
        reviewRemarks,
      });
      setReviewModalApp(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to review leave application');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleCalculateEncashment = async () => {
    if (!calcEmpId) return;
    setIsCalculating(true);
    try {
      const res = await api.get(`/leave/encashment-estimate/${calcEmpId}`);
      setEncashmentData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to compute encashment');
    } finally {
      setIsCalculating(false);
    }
  };

  // Metrics
  const pendingCount = applications.filter((a) => a.status === 'PENDING').length;
  const approvedCount = applications.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter((a) => a.status === 'REJECTED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{activeCompany?.name || 'Superbee'} Leave Management Desk</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              {activeCompany?.code || 'MSME Unit'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeCompany?.name || 'Superbee Aeronautics Pvt. Ltd.'} • Official Leave Policy & Workflow Portal
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('applications')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'applications'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Applications ({pendingCount} Pending)
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'policies'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Leave Rules & Types
          </button>
          <button
            onClick={() => setActiveTab('document')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'document'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Official Policy PDF View
          </button>
          <button
            onClick={() => {
              setActiveTab('calculator');
              if (!encashmentData && calcEmpId) handleCalculateEncashment();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'calculator'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            EL Encashment Tool
          </button>
        </div>
      </div>

      {/* TAB 1: APPLICATIONS & REVIEW DESK */}
      {activeTab === 'applications' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending Action</span>
                <p className="text-2xl font-black text-amber-900 mt-1">{pendingCount}</p>
                <span className="text-[10px] text-amber-600">Requires RM / HR Approval</span>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-60" />
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Approved Leaves</span>
                <p className="text-2xl font-black text-emerald-900 mt-1">{approvedCount}</p>
                <span className="text-[10px] text-emerald-600">Debited from balances</span>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-500 opacity-60" />
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Rejected Leaves</span>
                <p className="text-2xl font-black text-rose-900 mt-1">{rejectedCount}</p>
                <span className="text-[10px] text-rose-600">Balances restored</span>
              </div>
              <XCircle className="w-8 h-8 text-rose-500 opacity-60" />
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Active Policy Rules</span>
                <p className="text-2xl font-black text-blue-900 mt-1">5 Types</p>
                <span className="text-[10px] text-blue-600">CL, SL, EL, ML, PL configured</span>
              </div>
              <ShieldCheck className="w-8 h-8 text-blue-500 opacity-60" />
            </div>
          </div>

          {/* Applications Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Leave Applications Registry</h3>
                <p className="text-xs text-slate-500">Live feed of leave requests submitted across {activeCompany?.code || 'company'} units</p>
              </div>
              <span className="text-xs font-semibold text-slate-600">Total: {applications.length} Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Leave Type</th>
                    <th className="px-4 py-3">From - To</th>
                    <th className="px-4 py-3">Duration (Days)</th>
                    <th className="px-4 py-3">Policy Note / Sandwich</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No leave applications recorded in this period
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => {
                      const isEL = app.leaveType?.code === 'EL';
                      const isCL = app.leaveType?.code === 'CL';
                      const isSandwich = isEL && Number(app.totalDays) > 1;

                      return (
                        <tr key={app.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-slate-900 block">
                              {app.employee?.firstName} {app.employee?.lastName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {app.employee?.employeeCode} • {app.employee?.department?.name || 'Aeronautics'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                                {app.leaveType?.code}
                              </span>
                              {app.leaveType?.name}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 font-mono text-slate-700">
                            {new Date(app.startDate).toISOString().split('T')[0]} to{' '}
                            {new Date(app.endDate).toISOString().split('T')[0]}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="font-bold text-slate-900">{app.totalDays} Days</span>
                            {app.isHalfDay && (
                              <span className="block text-[10px] text-slate-500 font-medium">(Half Day)</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            {isSandwich ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                Sandwich Rule Applied
                              </span>
                            ) : isCL ? (
                              <span className="text-[10px] text-slate-500">Max 2 days in row rule</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Standard Rule</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate" title={app.reason}>
                            {app.reason}
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                app.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : app.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {app.status}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            {app.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenReview(app, 'APPROVED')}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition shadow-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleOpenReview(app, 'REJECTED')}
                                  className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Reviewed</span>
                            )}
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
      )}

      {/* TAB 2: POLICIES & ENTITLEMENTS TABLE */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-bold">{activeCompany?.name || 'Superbee Aeronautics Pvt. Ltd.'} Leave Entitlement Matrix:</span> Below are the
              official 5 leave types standardized under the MSME Manufacturing Unit guidelines. All employees are bound
              by the advance notice requirements, probation rules, and sandwich leave conditions.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Types of Leave & Eligibility Matrix</h3>
              <span className="text-xs text-slate-500 font-mono">MSME Manufacturing Unit Spec</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Leave Type</th>
                    <th className="px-4 py-3">Annual Entitlement</th>
                    <th className="px-4 py-3">Eligibility</th>
                    <th className="px-4 py-3">Carry Forward</th>
                    <th className="px-4 py-3">Advance Notice</th>
                    <th className="px-4 py-3">Policy Notes & Restrictions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800 font-bold">CL</span>
                        Casual Leave
                      </div>
                      <span className="text-[10px] text-slate-400">Personal & unforeseen reasons</span>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900 text-sm">7 Days</td>
                    <td className="px-4 py-4 text-slate-700">
                      From Date of Joining
                      <span className="block text-[10px] text-slate-400">Pro-rata basis during probation</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                        No (Lapses)
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-700">At least 2 days</td>
                    <td className="px-4 py-4 text-slate-600 max-w-sm">
                      Max 2 days in a row. &gt;2 days treated as EL or LOP. Cannot be suffixed or prefixed to weekly offs/holidays.
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 font-bold">SL</span>
                        Sick Leave
                      </div>
                      <span className="text-[10px] text-slate-400">Illness & medical recovery</span>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900 text-sm">7 Days</td>
                    <td className="px-4 py-4 text-slate-700">
                      From Date of Joining
                      <span className="block text-[10px] text-slate-400">Pro-rata for mid-year joiners</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                        No (Lapses)
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-700">Immediate RM/HR intimation</td>
                    <td className="px-4 py-4 text-slate-600 max-w-sm">
                      Medical/Doctor's certificate mandatory for absence &gt;1 day. Cannot be encashed or carried forward.
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70 bg-emerald-50/20">
                    <td className="px-4 py-4">
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 font-bold">EL</span>
                        Earned Leave (Privileged)
                      </div>
                      <span className="text-[10px] text-emerald-600">Vacations & long breaks</span>
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-900 text-sm">
                      15 Days
                      <span className="block text-[10px] font-normal text-slate-500">1.25 days per month</span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      Post-Probation / 6 Months
                      <span className="block text-[10px] text-slate-400">After 240 days of continuous service</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        Yes (Max 30 Days)
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-700">
                      At least 10 days
                      <span className="block text-[10px] text-slate-400">Handover 2 days prior</span>
                    </td>
                    <td className="px-4 py-4 text-slate-600 max-w-sm">
                      <span className="font-bold text-amber-800">Sandwich Leave Rule applies:</span> Weekly offs &
                      holidays suffixed/prefixed are included as leave. Encashed on exit at basic pay.
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-800 font-bold">ML</span>
                        Maternity Leave
                      </div>
                      <span className="text-[10px] text-slate-400">Female childbirth benefit</span>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900 text-sm">26 Weeks</td>
                    <td className="px-4 py-4 text-slate-700">
                      Married female post-probation
                      <span className="block text-[10px] text-slate-400">&gt;80 days service in past 12 months</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        No
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-700">2 weeks advance notice</td>
                    <td className="px-4 py-4 text-slate-600 max-w-sm">
                      First 2 children (12 weeks for 3rd child onwards). Up to 8 weeks pre-delivery, 18 weeks post-delivery. Fully paid.
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-800 font-bold">PL</span>
                        Paternity Leave
                      </div>
                      <span className="text-[10px] text-slate-400">Male child support</span>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-900 text-sm">15 Days</td>
                    <td className="px-4 py-4 text-slate-700">
                      Married male post-probation
                      <span className="block text-[10px] text-slate-400">Probation availed with LOP</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        No
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-700">2 weeks advance notice</td>
                    <td className="px-4 py-4 text-slate-600 max-w-sm">
                      Must be availed within 15 days of child's birth. Maximum 2 instances during entire employment.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Sandwich Rule Detailed Callout Box */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-200 p-1 text-amber-800">
                <AlertCircle className="w-4 h-4" />
              </span>
              <h4 className="font-bold text-amber-900 text-sm">Sandwich Leave Rule Policy (Section 4 & Note 1)</h4>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Weekly offs and company holidays falling between or adjacent to leave days are counted towards the leave
              period unless the employee physically logs attendance on the intermediate day.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="font-bold text-[11px] text-slate-800 block">Friday Leave:</span>
                <p className="text-[11px] text-slate-600 mt-1">
                  If Saturday & Sunday are weekly offs and you take Friday off:
                  <span className="font-bold text-amber-800 block mt-0.5">Friday + Saturday + Sunday = 3 Days Leave</span>
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="font-bold text-[11px] text-slate-800 block">Monday Leave:</span>
                <p className="text-[11px] text-slate-600 mt-1">
                  If Saturday & Sunday are weekly offs and you take Monday off:
                  <span className="font-bold text-amber-800 block mt-0.5">Saturday + Sunday + Monday = 3 Days Leave</span>
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-amber-200">
                <span className="font-bold text-[11px] text-slate-800 block">Friday & Monday Bridge:</span>
                <p className="text-[11px] text-slate-600 mt-1">
                  If you apply for Earned Leave on both Friday and Monday:
                  <span className="font-bold text-amber-800 block mt-0.5">Fri + Sat + Sun + Mon = 4 Days Leave</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OFFICIAL LEAVE POLICY DOCUMENT */}
      {activeTab === 'document' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">Document Ref: SAPL/HR/POL/2026/01</span>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save as PDF
            </button>
          </div>

          {/* Formatted Official Paper */}
          <div className="rounded-3xl border border-slate-300 bg-white p-8 md:p-12 shadow-sm space-y-8 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
            {/* Header with Superbee Aeronautics */}
            <div className="text-center border-b-2 border-slate-900 pb-6 space-y-2">
              <div className="flex items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400 font-black text-xl">
                  🐝
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-wider uppercase">
                  {activeCompany?.name || 'Superbee Aeronautics Pvt. Ltd.'}
                </h2>
              </div>
              <p className="text-sm font-bold text-slate-700 uppercase tracking-widest">
                LEAVE POLICY (MSME Manufacturing Unit)
              </p>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                <p>
                  <span className="font-bold">Registered Office:</span> C/o Centurion University of Technology and Management
                  (CUTM), Ramchandrapur, Jatni, Bhubaneswar, Khurda, Odisha, 752050
                </p>
                <p>
                  <span className="font-bold">Corporate Office:</span> Flat No – 501, Akruthi Vijayalakshmi Residency, P & T
                  Colony, Seethammadhara, Visakhapatnam, AP-530013
                </p>
              </div>
            </div>

            {/* Section 1 & 2 */}
            <div className="space-y-4 text-xs text-slate-800 leading-relaxed">
              <div>
                <h3 className="font-bold text-slate-900 text-sm uppercase">1. Objective</h3>
                <p className="mt-1 text-slate-700">
                  This policy aims to define and standardize the types of leave available to employees, ensuring uniformity,
                  compliance with applicable labour laws, and promoting operational efficiency while supporting employee
                  well-being and work-life balance.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm uppercase">2. Scope</h3>
                <p className="mt-1 text-slate-700">
                  This policy applies to all full-time employees of the company. Pro-rata leave may be applicable to
                  part-time, contract, or probationary staff.
                </p>
              </div>

              {/* Section 3 Types */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm uppercase mb-2">3. Types of Leave</h3>
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                      <tr>
                        <th className="p-2.5">Leave Type</th>
                        <th className="p-2.5">Annual Entitlement</th>
                        <th className="p-2.5">Eligibility</th>
                        <th className="p-2.5">Carry Forward</th>
                        <th className="p-2.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2.5 font-bold">Casual Leave (CL)</td>
                        <td className="p-2.5">7 days</td>
                        <td className="p-2.5">From Date of Joining</td>
                        <td className="p-2.5 font-semibold text-rose-700">No (Lapses)</td>
                        <td className="p-2.5 text-slate-600">For unforeseen personal reasons. Max 2 days in a row.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">Sick Leave (SL)</td>
                        <td className="p-2.5">7 days</td>
                        <td className="p-2.5">From Date of Joining</td>
                        <td className="p-2.5 font-semibold text-rose-700">No (Lapses)</td>
                        <td className="p-2.5 text-slate-600">Medical certificate required for &gt;1 day.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">Earned Leave (EL)</td>
                        <td className="p-2.5">15 days (After 240 days)</td>
                        <td className="p-2.5">Post-probation or 6 months</td>
                        <td className="p-2.5 font-semibold text-emerald-700">Yes (Max 30 days)</td>
                        <td className="p-2.5 text-slate-600">Also known as Privileged Leave. Sandwich rule applies.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">Maternity Leave</td>
                        <td className="p-2.5">26 weeks</td>
                        <td className="p-2.5">Female with &gt;80 days service</td>
                        <td className="p-2.5 font-semibold text-rose-700">No</td>
                        <td className="p-2.5 text-slate-600">Applicable for first two children.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">Paternity Leave</td>
                        <td className="p-2.5">15 days</td>
                        <td className="p-2.5">After 6 months of service</td>
                        <td className="p-2.5 font-semibold text-rose-700">No</td>
                        <td className="p-2.5 text-slate-600">Within 15 days of child's birth.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4 & 5 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm uppercase">4. General Guidelines</h3>
                  <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-700">
                    <li>
                      <span className="font-bold">Leave Request:</span> Must be submitted via portal at least 2 days in
                      advance.
                    </li>
                    <li>
                      <span className="font-bold">Approval:</span> Approved by Reporting Manager & HR Manager.
                    </li>
                    <li>
                      <span className="font-bold">Sandwich Leave:</span> Weekly offs & holidays between leaves count as
                      leave.
                    </li>
                    <li>
                      <span className="font-bold">Uninformed Absence:</span> Treated as Loss of Pay (LOP) with disciplinary
                      action.
                    </li>
                    <li>
                      <span className="font-bold">Leave Balance:</span> Updated monthly and shared via HR Manager.
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm uppercase">5. Leave during Probation Period</h3>
                  <p className="mt-1.5 text-slate-700">
                    Employees under probation can avail CL and SL only on a pro-rata basis. EL accrual starts post-probation
                    or after 6 months of continuous service.
                  </p>

                  <h3 className="font-bold text-slate-900 text-sm uppercase mt-4">6. Leave Encashment Policy</h3>
                  <p className="mt-1 text-slate-700">
                    Unused Earned Leave can be encashed upon resignation or retirement at the basic pay rate. Maximum 30 days
                    can be carried forward; additional days lapse. Encashment is not applicable during continuous
                    employment.
                  </p>
                </div>
              </div>

              {/* Section 7 & 8 */}
              <div className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm uppercase">7. Exceptions & Flexibility</h3>
                  <p className="mt-1 text-slate-700">
                    In emergencies or critical illness, Leave Without Pay (LWP) may be granted at Management discretion.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm uppercase flex items-center gap-1.5">
                    <Plane className="w-4 h-4 text-emerald-700" />
                    8. Considerations for Drone Operations Teams
                  </h3>
                  <ul className="list-disc list-inside mt-1 text-slate-700 space-y-0.5">
                    <li>Leave during active flight testing / project deadlines should be avoided unless critical.</li>
                    <li>Field engineers and drone pilots must coordinate leave with flight test schedules.</li>
                  </ul>
                </div>
              </div>

              {/* Notes: Sandwich Leave illustrated */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 space-y-1">
                <span className="font-bold text-slate-900 text-xs">Official Sandwich Leave Illustrations:</span>
                <p className="text-[11px] text-slate-700">
                  • If Saturday and Sunday are holidays, and you take leave on Friday, then Friday, Saturday, and Sunday
                  will all be counted as leave.
                </p>
                <p className="text-[11px] text-slate-700">
                  • Similarly, if you take leave on Monday, then Saturday, Sunday, and Monday will be counted as leave.
                </p>
                <p className="text-[11px] text-slate-700">
                  • If you apply for Earned Leave on Friday and Monday, then Friday + Saturday + Sunday + Monday = 4 days
                  will be considered as leave.
                </p>
              </div>
            </div>

            {/* Signature Block */}
            <div className="border-t border-slate-300 pt-8 flex items-center justify-between text-xs text-slate-600">
              <div>
                <p className="font-bold text-slate-900">Authorized by:</p>
                <p>HR Management Committee</p>
                <p>{activeCompany?.name || 'Superbee Aeronautics Pvt. Ltd.'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900">Effective Date:</p>
                <p>Calendar Year 2026 onwards</p>
                <p>MSME Manufacturing Unit Compliance</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEAVE ENCASHMENT ESTIMATOR TOOL */}
      {activeTab === 'calculator' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                Earned Leave (EL) Exit Encashment Calculator
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculate employee encashment at basic pay rate upon resignation or retirement (Section 6 Policy: Max 30
                days carry forward).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-end gap-3 pt-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-slate-700">Select Employee</label>
                <select
                  value={calcEmpId}
                  onChange={(e) => setCalcEmpId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode}) • {emp.department?.name || 'Aeronautics'}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCalculateEncashment}
                disabled={isCalculating || !calcEmpId}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50"
              >
                {isCalculating ? 'Computing...' : 'Calculate Encashment'}
              </button>
            </div>

            {encashmentData && (
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block uppercase">Accumulated EL</span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">
                      {encashmentData.totalEarnedLeaveBalance} Days
                    </span>
                    <span className="text-[10px] text-slate-400">Total available balance</span>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-700 block uppercase">Encashable Days</span>
                    <span className="text-2xl font-black text-emerald-900 mt-1 block">
                      {encashmentData.encashableDays} Days
                    </span>
                    <span className="text-[10px] text-emerald-600">Capped at 30 days max</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block uppercase">Daily Basic Rate</span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">
                      ₹{encashmentData.dailyBasicRate?.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400">Basic Pay / 30</span>
                  </div>

                  <div className="bg-emerald-600 text-white p-4 rounded-xl shadow-md">
                    <span className="text-[11px] font-bold text-emerald-100 block uppercase">Total Encashment</span>
                    <span className="text-2xl font-black text-white mt-1 block">
                      ₹{encashmentData.estimatedEncashmentAmount?.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-emerald-200">Paid upon exit settlement</span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-slate-900">Policy Encashment Clause (Section 6):</span>
                  <p>{encashmentData.policyNote}</p>
                  {encashmentData.lapsedDays > 0 && (
                    <p className="text-rose-600 font-semibold">
                      Notice: {encashmentData.lapsedDays} days exceed the 30-day carry-forward ceiling and will lapse
                      per policy.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {reviewStatus === 'APPROVED' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </h3>
              <button onClick={() => setReviewModalApp(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-slate-800">
                  {reviewModalApp.employee?.firstName} {reviewModalApp.employee?.lastName} (
                  {reviewModalApp.employee?.employeeCode})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Leave Type:</span>
                <span className="font-bold text-slate-800">
                  {reviewModalApp.leaveType?.name} ({reviewModalApp.leaveType?.code})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <span className="font-bold text-slate-900">
                  {reviewModalApp.totalDays} Days ({new Date(reviewModalApp.startDate).toISOString().split('T')[0]} to{' '}
                  {new Date(reviewModalApp.endDate).toISOString().split('T')[0]})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reason:</span>
                <span className="text-slate-700 italic">{reviewModalApp.reason}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Review Remarks / Justification</label>
              <textarea
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                placeholder="Enter remarks for the employee..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewModalApp(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReview}
                disabled={isSubmittingReview}
                className={`rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm transition ${
                  reviewStatus === 'APPROVED'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {isSubmittingReview ? 'Processing...' : `Confirm ${reviewStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
