'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  MapPin,
  Clock,
  Users,
  CalendarCheck,
  CalendarDays,
  Banknote,
  Megaphone,
  LifeBuoy,
  BarChart3,
  ShieldAlert,
  Building,
  Radio,
  Bell,
  CalendarRange,
  FileSpreadsheet,
} from 'lucide-react';

const mainNav = [
  { name: 'Live Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Notifications & Feed', href: '/notifications', icon: Bell },
  { name: 'Leave Management', href: '/leave', icon: CalendarCheck },
  { name: 'Payroll Management', href: '/payroll', icon: Banknote },
  { name: 'Employees', href: '/employees', icon: Users },
];

const reportNav = [
  { name: 'Daily Report', href: '/daily', icon: Clock },
  { name: 'Monthly Summary', href: '/monthly', icon: CalendarRange },
  { name: 'In/Out Report', href: '/inout-report', icon: FileSpreadsheet },
  { name: 'Live Field Tracking', href: '/tracking', icon: Radio },
];

const adminNav = [
  { name: 'Offices & Geofences', href: '/offices', icon: MapPin },
  { name: 'Circulars', href: '/circulars', icon: Megaphone },
  { name: 'IT Helpdesk', href: '/helpdesk', icon: LifeBuoy },
  { name: 'Audit Logs', href: '/audit', icon: ShieldAlert },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { activeCompany } = useAuth();

  const isCutmap = activeCompany?.code?.toUpperCase() === 'CUTMAP';

  // For CUTMAP (Centurion University Admission Staff), remove Notifications & Feed, Leave Management, Payroll Management, IT Helpdesk
  const filteredMainNav = isCutmap
    ? mainNav.filter((item) => !['Notifications & Feed', 'Leave Management', 'Payroll Management'].includes(item.name))
    : mainNav;

  const filteredAdminNav = isCutmap
    ? adminNav.filter((item) => item.name !== 'IT Helpdesk')
    : adminNav;

  const renderLink = (item: { name: string; href: string; icon: any }) => {
    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`));
    const Icon = item.icon;

    return (
      <Link
        key={item.name}
        href={item.href}
        className={`flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-slate-900 text-slate-300">
      {/* Brand Logo Header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold shadow-md shadow-blue-500/20">
          <Building className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-bold text-white tracking-wide truncate">
            {activeCompany ? `${activeCompany.code} HRMS` : 'ENTERPRISE HRMS'}
          </span>
          <span className="block text-[10px] text-blue-400 font-medium truncate" title={activeCompany?.name}>
            {activeCompany ? activeCompany.name : 'Multi-Tenant Portal'}
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {/* Main Section */}
        <div className="space-y-1">
          {filteredMainNav.map(renderLink)}
        </div>

        {/* Attendance Reports Section */}
        <div className="space-y-1 pt-2">
          <span className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Attendance Reports
          </span>
          <div className="space-y-1 mt-1">
            {reportNav.map(renderLink)}
          </div>
        </div>

        {/* Administration Section */}
        <div className="space-y-1 pt-2">
          <span className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Administration
          </span>
          <div className="space-y-1 mt-1">
            {filteredAdminNav.map(renderLink)}
          </div>
        </div>
      </nav>

      {/* Footer Info */}
      <div className="border-t border-slate-800 p-4">
        <div className="rounded-xl bg-slate-800/60 p-3 border border-slate-700/50 text-[11px] text-slate-400">
          <div className="flex items-center justify-between text-slate-300 font-semibold mb-1">
            <span className="truncate pr-1">{activeCompany?.code || 'Enterprise'}</span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>
          <div className="truncate text-[10px] text-slate-400 mt-0.5" title={activeCompany?.name}>
            {activeCompany?.name || 'Centurion University Campus'}
          </div>
        </div>
      </div>
    </aside>
  );
}
