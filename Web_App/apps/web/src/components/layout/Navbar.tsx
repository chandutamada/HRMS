'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, Company } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Building2,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Shield,
  CheckCircle2,
} from 'lucide-react';

export default function Navbar() {
  const { user, activeCompany, companies, switchCompany, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Poll unread notifications count every 30 seconds
  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      api.get<{ unreadCount: number }>('/notifications/unread-count')
        .then((res) => setUnreadCount(res.unreadCount))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const canSwitchCompany =
    user?.isSuperAdmin ||
    user?.roles?.some((r) => ['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(r));

  const getCompanyColor = (code?: string) => {
    const c = (code || '').toUpperCase();
    if (c.includes('GTIDS')) return 'bg-emerald-600';
    if (c.includes('GTIB')) return 'bg-purple-600';
    return 'bg-blue-600';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
      {/* Left: Company Switcher */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => canSwitchCompany && setShowCompanyMenu(!showCompanyMenu)}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              canSwitchCompany
                ? 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 cursor-pointer shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-700 cursor-default'
            }`}
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white uppercase ${getCompanyColor(activeCompany?.code)}`}>
              {activeCompany?.code?.slice(0, 2) || 'ALL'}
            </div>
            <div className="text-left">
              <span className="block font-semibold leading-tight max-w-[220px] sm:max-w-xs truncate">
                {activeCompany?.name || 'All Companies (Global View)'}
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                {activeCompany?.code || 'GLOBAL VIEW'}
              </span>
            </div>
            {canSwitchCompany && <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
          </button>

          {/* Company dropdown for Super Admin and HR */}
          {showCompanyMenu && canSwitchCompany && (
            <div className="absolute left-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl z-50">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                <span>Switch Active Company</span>
                <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">3 Registered</span>
              </div>
              <button
                onClick={() => {
                  switchCompany(null);
                  setShowCompanyMenu(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                  !activeCompany ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-[10px] font-bold text-white">
                    ALL
                  </div>
                  <span>All Companies (Global View)</span>
                </div>
                {!activeCompany && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </button>
              {companies.map((c) => (
                <button
                  key={c.id || c.code}
                  onClick={() => {
                    switchCompany(c);
                    setShowCompanyMenu(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                    activeCompany?.code === c.code || activeCompany?.id === c.id
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-left min-w-0">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white uppercase ${getCompanyColor(c.code)}`}>
                      {c.code.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{c.code}</p>
                    </div>
                  </div>
                  {(activeCompany?.code === c.code || activeCompany?.id === c.id) && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative">
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-1.5 pr-3 hover:bg-slate-50 transition"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
              {user?.employee?.firstName?.[0] || user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <span className="block text-xs font-semibold text-slate-800 leading-tight">
                {user?.employee?.fullName || user?.email}
              </span>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1 rounded">
                {user?.roles?.[0]?.replace('_', ' ') || 'USER'}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800 truncate">{user?.email}</p>
                <p className="text-[10px] text-slate-500">{user?.employeeCode || 'Administrator'}</p>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
