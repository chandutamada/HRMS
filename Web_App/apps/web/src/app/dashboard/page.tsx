'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  ArrowUpRight,
  Headphones,
  Receipt,
  CalendarCheck,
  Plus,
  Eye,
  EyeOff,
  Download,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, activeCompany } = useAuth();

  // Clock state
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [punchMessage, setPunchMessage] = useState<string | null>(null);

  // Live data summaries
  const [reviewCount, setReviewCount] = useState(16);
  const [teamOnLeaveCount, setTeamOnLeaveCount] = useState(10);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live stats if available, with graceful fallback to greytHR defaults
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const [sum, todayAtt] = await Promise.all([
          api.get<{ pendingLeaves?: number; pendingCorrections?: number }>('/reports/dashboard-summary', {
            companyId: activeCompany?.id,
          }).catch(() => null),
          api.get<{ isCheckedIn?: boolean }>('/attendance/today').catch(() => null),
        ]);

        if (sum) {
          const totalReviews = (sum.pendingLeaves || 0) + (sum.pendingCorrections || 0);
          if (totalReviews > 0) setReviewCount(totalReviews);
        }

        if (todayAtt?.isCheckedIn) {
          setIsSignedIn(true);
        }
      } catch (_) {}
    };

    fetchDashboardStats();
  }, [activeCompany]);

  const handlePunchToggle = async () => {
    try {
      setPunchMessage('Recording swipe...');
      // Simulated swipe or live punch
      setIsSignedIn(!isSignedIn);
      setTimeout(() => {
        setPunchMessage(null);
      }, 3000);
    } catch (_) {
      setPunchMessage('Swipe failed. Please retry.');
    }
  };

  const formattedDate = currentTime
    ? currentTime.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '07 June 2023';

  const formattedDay = currentTime
    ? currentTime.toLocaleDateString('en-GB', { weekday: 'long' })
    : 'Wednesday';

  const formattedTime = currentTime
    ? currentTime
        .toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
        .split(':')
        .join(' : ')
    : '09 : 24 : 44';

  return (
    <div className="w-full">
      {/* Outer Card Wrapper matching exact greytHR rounded border aesthetic */}
      <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8">
        {/* Top Header */}
        <div className="pb-3 border-b border-gray-200/90">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Home</h1>
        </div>

        {/* Greeting Banner with Winding Road & Bus Scenic Art */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pt-6 pb-6 border-b border-gray-200/80 gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
              Good Morning,
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Here&apos;s what&apos;s going on with your greytHR portal.
            </p>
          </div>

          {/* greytHR Scenic Road, Sun & Bus Illustration */}
          <div className="self-end md:self-center">
            <GreytHRBannerArt />
          </div>
        </div>

        {/* 3-Column Responsive Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {/* ========================================================================= */}
          {/* COLUMN 1: Review, Upcoming Holidays, Quick Access                         */}
          {/* ========================================================================= */}
          <div className="space-y-6 flex flex-col">
            {/* 1. Review Card */}
            <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-gray-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Review</span>
                <Link
                  href="/leave"
                  className="text-gray-400 hover:text-blue-600 transition"
                  title="View all reviews"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div>
                  <span className="text-4xl font-extrabold text-gray-900 tracking-tight">
                    {reviewCount}
                  </span>
                  <p className="text-xs text-gray-500 font-medium mt-1">Things to review</p>
                </div>
                <ReviewDocIllustration />
              </div>

              {/* 4 Circular Action Badges */}
              <div className="grid grid-cols-4 gap-2 mt-5 pt-3 border-t border-gray-100">
                <Link
                  href="/payroll"
                  className="group flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center bg-gray-50/80 text-gray-600 group-hover:border-blue-500 group-hover:text-blue-600 group-hover:bg-blue-50/50 transition">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 group-hover:text-blue-600">
                    Claims
                  </span>
                </Link>

                <Link
                  href="/helpdesk"
                  className="group flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center bg-gray-50/80 text-gray-600 group-hover:border-blue-500 group-hover:text-blue-600 group-hover:bg-blue-50/50 transition">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 group-hover:text-blue-600">
                    Helpdesk
                  </span>
                </Link>

                <Link
                  href="/leave"
                  className="group flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center bg-gray-50/80 text-gray-600 group-hover:border-blue-500 group-hover:text-blue-600 group-hover:bg-blue-50/50 transition">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 group-hover:text-blue-600">
                    Leaves
                  </span>
                </Link>

                <Link
                  href="/attendance"
                  className="group flex flex-col items-center gap-1.5 focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-full border border-blue-200 bg-blue-50/40 text-blue-600 font-bold text-xs flex items-center justify-center group-hover:bg-blue-100 transition">
                    <span>+ 1</span>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600">More</span>
                </Link>
              </div>
            </div>

            {/* 2. Upcoming Holidays Card */}
            <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-gray-300 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-900">Upcoming Holidays</span>
                <Link href="/calendar" className="text-gray-400 hover:text-blue-600 transition">
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="divide-y divide-gray-100 text-xs">
                <div className="py-2.5">
                  <span className="font-semibold text-gray-800">15 Aug Tuesday</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-gray-800">14 Sep Wednesday</span>
                  <Link href="/leave" className="text-blue-600 font-semibold hover:underline">
                    Apply
                  </Link>
                </div>
                <div className="py-2.5">
                  <span className="font-semibold text-gray-800">04 Oct Tuesday</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-gray-800">05 Oct Wednesday</span>
                  <Link href="/leave" className="text-blue-600 font-semibold hover:underline">
                    Apply
                  </Link>
                </div>
              </div>
            </div>

            {/* 3. Quick Access Card */}
            <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-gray-300 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-900">Quick Access</span>
                <Link href="/reports" className="text-gray-400 hover:text-blue-600 transition">
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-medium text-gray-700">
                <Link href="/payroll" className="hover:text-blue-600 transition truncate">
                  CTC Payslip
                </Link>
                <Link href="/reports" className="hover:text-blue-600 transition truncate">
                  Loan Statement
                </Link>
                <Link href="/payroll" className="hover:text-blue-600 transition truncate">
                  IT Statement
                </Link>
                <Link href="/reports" className="hover:text-blue-600 transition truncate">
                  YTD Reports
                </Link>
                <Link href="/payroll" className="hover:text-blue-600 transition truncate">
                  Reimbursement Payslip
                </Link>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 2: Who is in?, Payslip                                             */}
          {/* ========================================================================= */}
          <div className="space-y-6 flex flex-col">
            {/* 4. Who is in? Card */}
            <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-gray-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Who is in?</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=faces"
                      alt="User"
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                    />
                    <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-[10px] font-bold text-rose-600 ring-2 ring-white">
                      AL
                    </div>
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=faces"
                      alt="User"
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                    />
                    <img
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=faces"
                      alt="User"
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                    />
                  </div>
                  <Link
                    href="/attendance"
                    className="text-xs font-semibold text-blue-600 hover:underline ml-1"
                  >
                    +111 More
                  </Link>
                </div>
              </div>

              {/* Late Arrival subsection */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-gray-700">Late Arrival (10)</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=64&h=64&fit=crop&crop=faces"
                      alt="User"
                      className="h-8 w-8 rounded-full border-2 border-amber-500 object-cover"
                    />
                  </div>
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces"
                    alt="User"
                    className="h-8 w-8 rounded-full border border-gray-200 object-cover"
                  />
                  <div className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-50">
                    OL
                  </div>
                  <div className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-50">
                    MI
                  </div>
                </div>
              </div>

              {/* On time subsection */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-gray-700">On time (2)</p>
                <div className="flex items-center gap-2 mt-2">
                  <img
                    src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=64&h=64&fit=crop&crop=faces"
                    alt="User"
                    className="h-8 w-8 rounded-full border border-gray-200 object-cover"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=64&h=64&fit=crop&crop=faces"
                    alt="User"
                    className="h-8 w-8 rounded-full border border-gray-200 object-cover"
                  />
                </div>
              </div>
            </div>

            {/* 5. Payslip Card */}
            <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-gray-300 transition flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">Payslip</span>
                    <Link href="/payroll" className="text-gray-400 hover:text-blue-600 transition">
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>

                  <div className="text-right">
                    <span className="block text-xs font-semibold text-gray-700">May 2023</span>
                    <span className="block text-2xl font-bold text-gray-900 leading-tight">31</span>
                    <span className="block text-[10px] text-gray-400 font-medium">Paid days</span>
                  </div>
                </div>

                {/* Donut Chart and Salary breakdown */}
                <div className="flex items-center gap-5 mt-4">
                  {/* Two-Color Donut Chart */}
                  <div className="relative flex-shrink-0">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="36"
                        fill="transparent"
                        stroke="#F1F5F9"
                        strokeWidth="13"
                      />
                      {/* Net Pay slice (Coral) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="36"
                        fill="transparent"
                        stroke="#FF6B6B"
                        strokeWidth="13"
                        strokeDasharray="188 226.2"
                        strokeDashoffset="0"
                      />
                      {/* Deduction slice (Blue) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="36"
                        fill="transparent"
                        stroke="#3B82F6"
                        strokeWidth="13"
                        strokeDasharray="38 226.2"
                        strokeDashoffset="-188"
                      />
                    </svg>
                  </div>

                  {/* Financial Breakdown Legend */}
                  <div className="space-y-2 text-xs flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-gray-900 rounded-full inline-block" />
                        <span className="text-gray-700 font-medium">Gross Pay</span>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {showSalary ? '₹ 65,000' : '₹ ****'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-blue-500 rounded-full inline-block" />
                        <span className="text-gray-700 font-medium">Deduction</span>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {showSalary ? '₹ 6,500' : '₹ ****'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-[#FF6B6B] rounded-full inline-block" />
                        <span className="text-gray-700 font-medium">Net Pay</span>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {showSalary ? '₹ 58,500' : '₹ ****'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Links */}
              <div className="flex items-center justify-between mt-6 pt-3 border-t border-gray-100 text-xs font-semibold">
                <Link
                  href="/payroll"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Link>
                <button
                  onClick={() => setShowSalary(!showSalary)}
                  className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showSalary ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      Hide Salary
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Show Salary
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 3: Sign In / Swipes Card, Team on leave                            */}
          {/* ========================================================================= */}
          <div className="space-y-6 flex flex-col">
            {/* 6. Clock-in / Swipe Card */}
            <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-gray-300 transition">
              <span className="block text-sm font-bold text-gray-900">{formattedDate}</span>
              <p className="text-xs text-gray-500 mt-0.5">
                {formattedDay} | General Shift Confirmed
              </p>

              {/* Live Ticking Monospace Time Display */}
              <div className="my-3">
                <span className="text-2xl font-bold text-gray-800 tracking-wider font-mono">
                  {formattedTime}
                </span>
              </div>

              {/* Action row with View Swipes and Royal Blue Sign In button */}
              <div className="flex items-center justify-between pt-1">
                <Link
                  href="/attendance"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  View Swipes
                </Link>
                <button
                  onClick={handlePunchToggle}
                  className={`text-xs font-semibold px-6 py-2 rounded-lg text-white shadow-sm transition active:scale-95 ${
                    isSignedIn
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#3B82F6] hover:bg-[#2563EB]'
                  }`}
                >
                  {isSignedIn ? 'Sign Out' : 'Sign In'}
                </button>
              </div>

              {punchMessage && (
                <div className="mt-2 text-center text-xs font-medium text-emerald-600 animate-fade-in">
                  ✓ {punchMessage}
                </div>
              )}
            </div>

            {/* 7. Team on leave Card */}
            <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-gray-300 transition flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Team on leave</span>
                  <Link href="/leave" className="text-gray-400 hover:text-blue-600 transition">
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Avatar stack */}
                <div className="flex items-center gap-1.5 mt-3">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=faces"
                      alt="User"
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                    />
                    <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-[10px] font-bold text-rose-600 ring-2 ring-white">
                      AL
                    </div>
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=faces"
                      alt="User"
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                    />
                    <img
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=faces"
                      alt="User"
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                    />
                  </div>
                  <Link
                    href="/leave"
                    className="text-xs font-semibold text-blue-600 hover:underline ml-1"
                  >
                    +2 More
                  </Link>
                </div>

                {/* This Month (10) Header */}
                <p className="text-xs font-semibold text-gray-700 mt-5 mb-2.5">
                  This Month ({teamOnLeaveCount})
                </p>

                {/* Team Members List */}
                <div className="space-y-3.5">
                  {/* Member 1: Fatima Farha */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=64&h=64&fit=crop&crop=faces"
                        alt="Fatima"
                        className="w-7 h-7 rounded-full border border-gray-200 object-cover"
                      />
                      <div>
                        <span className="font-semibold text-gray-800">Fatima Farha</span>
                        <span className="text-[11px] text-gray-400 ml-1">(#143)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-800 block">1 day</span>
                      <span className="text-[11px] text-gray-400 block">24 Jun</span>
                    </div>
                  </div>

                  {/* Member 2: Suresh Roi */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=64&h=64&fit=crop&crop=faces"
                        alt="Suresh"
                        className="w-7 h-7 rounded-full border border-gray-200 object-cover"
                      />
                      <div>
                        <span className="font-semibold text-gray-800">Suresh Roi</span>
                        <span className="text-[11px] text-gray-400 ml-1">(#001)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-800 block">3 days</span>
                      <span className="text-[11px] text-gray-400 block">3-6 Jun</span>
                    </div>
                  </div>

                  {/* Member 3: Amit Singh */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=faces"
                        alt="Amit"
                        className="w-7 h-7 rounded-full border border-gray-200 object-cover"
                      />
                      <div>
                        <span className="font-semibold text-gray-800">Amit Singh</span>
                        <span className="text-[11px] text-gray-400 ml-1">(#013)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-800 block">4 days</span>
                      <span className="text-[11px] text-gray-400 block">12 Jun -1 Jun</span>
                    </div>
                  </div>

                  {/* Member 4: Surya Kumar */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=faces"
                        alt="Surya"
                        className="w-7 h-7 rounded-full border border-gray-200 object-cover"
                      />
                      <div>
                        <span className="font-semibold text-gray-800">Surya Kumar</span>
                        <span className="text-[11px] text-gray-400 ml-1">(#0916)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-800 block">10 days</span>
                      <span className="text-[11px] text-gray-400 block">4, 14-15, 24 Jun</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Centered Link */}
              <div className="pt-3 border-t border-gray-100 text-center mt-4">
                <Link
                  href="/leave"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  +6 more
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// greytHR Handcrafted Banner Art (Sun, Mountains, Highway, and Bus)
// ============================================================================
function GreytHRBannerArt() {
  return (
    <svg
      viewBox="0 0 320 100"
      className="w-64 sm:w-72 md:w-80 h-auto overflow-visible select-none"
      fill="none"
    >
      {/* Red/Coral Sun */}
      <circle cx="258" cy="38" r="18" fill="#F87171" />

      {/* Gentle hills in background */}
      <path
        d="M170 85 Q220 25 260 55 T330 25 L330 100 L170 100 Z"
        fill="#FEE2E2"
        opacity="0.35"
      />
      <path
        d="M210 85 C240 35 270 25 315 20 L330 100 L210 100 Z"
        fill="#FFEDD5"
        opacity="0.5"
      />

      {/* Contour sketch lines */}
      <path
        d="M170 85 C210 45 240 40 280 44"
        stroke="#94A3B8"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M235 55 C265 30 295 25 325 28"
        stroke="#94A3B8"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Red Tunnel / Mountain Cutout */}
      <path
        d="M275 32 C300 35 320 50 325 70 L300 85 Z"
        fill="#E11D48"
        opacity="0.7"
      />

      {/* Sketch contour hatchings */}
      <path
        d="M260 48 L268 53 M266 44 L274 49 M272 40 L280 45"
        stroke="#94A3B8"
        strokeWidth="0.8"
      />

      {/* Winding Blue Road with Center Marking */}
      <path
        d="M246 100 C254 82 270 72 290 68"
        stroke="#2563EB"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <path
        d="M235 100 C248 78 266 68 288 64"
        stroke="#94A3B8"
        strokeWidth="1.2"
        strokeDasharray="3 3"
      />

      {/* Distant soaring birds */}
      <path
        d="M210 28 Q213 24 216 28 Q219 24 222 28"
        stroke="#64748B"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M228 34 Q231 31 234 34 Q237 31 240 34"
        stroke="#64748B"
        strokeWidth="0.9"
        fill="none"
      />

      {/* Tour Bus Traveling On Road */}
      <g transform="translate(262, 52) scale(0.68)">
        {/* Wheels */}
        <circle cx="8" cy="24" r="4.5" fill="#1E293B" />
        <circle cx="34" cy="24" r="4.5" fill="#1E293B" />
        <circle cx="8" cy="24" r="2" fill="#94A3B8" />
        <circle cx="34" cy="24" r="2" fill="#94A3B8" />

        {/* Bus Body */}
        <rect
          x="0"
          y="4"
          width="44"
          height="18"
          rx="4"
          fill="#FFFFFF"
          stroke="#0F172A"
          strokeWidth="1.8"
        />
        {/* Bus Roof Color */}
        <path d="M0 8 Q22 7 44 8 L44 4 Q22 3 0 4 Z" fill="#EF4444" />
        {/* Windows */}
        <rect
          x="4"
          y="9"
          width="7"
          height="6"
          rx="1"
          fill="#BAE6FD"
          stroke="#0F172A"
          strokeWidth="1"
        />
        <rect
          x="13"
          y="9"
          width="7"
          height="6"
          rx="1"
          fill="#BAE6FD"
          stroke="#0F172A"
          strokeWidth="1"
        />
        <rect
          x="22"
          y="9"
          width="7"
          height="6"
          rx="1"
          fill="#BAE6FD"
          stroke="#0F172A"
          strokeWidth="1"
        />
        <rect
          x="31"
          y="9"
          width="9"
          height="6"
          rx="1"
          fill="#BAE6FD"
          stroke="#0F172A"
          strokeWidth="1"
        />
        {/* Headlight */}
        <circle cx="43" cy="18" r="1.5" fill="#FBBF24" />
      </g>
    </svg>
  );
}

// ============================================================================
// Review Card Document & Magnifying Glass Illustration
// ============================================================================
function ReviewDocIllustration() {
  return (
    <svg viewBox="0 0 70 70" className="w-16 h-16 select-none" fill="none">
      {/* Document Sheet */}
      <rect
        x="12"
        y="10"
        width="34"
        height="42"
        rx="3"
        fill="#F8FAFC"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />
      <line
        x1="18"
        y1="18"
        x2="38"
        y2="18"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="24"
        x2="34"
        y2="24"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="30"
        x2="30"
        y2="30"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Green folder/envelope underneath */}
      <path d="M8 44 L38 44 L32 54 L4 54 Z" fill="#6EE7B7" opacity="0.8" />
      {/* Magnifying Glass with pink/coral ring */}
      <circle
        cx="36"
        cy="36"
        r="13"
        fill="#FFFFFF"
        fillOpacity="0.4"
        stroke="#F43F5E"
        strokeWidth="2.5"
      />
      <line
        x1="45"
        y1="45"
        x2="57"
        y2="57"
        stroke="#F43F5E"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
