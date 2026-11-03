'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Building, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('hr@gramtarang.org');
  const [password, setPassword] = useState('Password@123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = (id: string, pass: string) => {
    setIdentifier(id);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/25">
            <Building className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Superbee Aeronautics</h1>
          <p className="mt-1 text-xs text-slate-400">
            HRMS Enterprise Platform with Geofenced Attendance
          </p>
        </div>

        {/* Demo Quick-Fill Buttons */}
        <div className="mt-6 rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3 text-xs">
          <span className="block text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            Administrator Credentials
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoFill('hr@gramtarang.org', 'Password@123')}
              className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/50 p-2 text-left text-[11px] text-slate-200 transition"
            >
              <strong className="block text-emerald-300">HR Admin</strong>
              <span className="text-[10px] text-slate-400">hr@gramtarang.org</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill('superadmin@superbeeaeronautics.com', 'Admin@123456')}
              className="rounded-lg bg-slate-700/60 hover:bg-slate-700 p-2 text-left text-[11px] text-slate-200 transition"
            >
              <strong className="block text-white">Super Admin</strong>
              <span className="text-[10px] text-slate-400">superadmin@...</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Email or Employee Code
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. superadmin@hrms.internal or SB-001"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Sign In to HRMS</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* HR-Managed Credentials Notice */}
          <div className="mt-4 pt-3 border-t border-slate-700/60 text-center">
            <p className="text-[11px] text-slate-400">
              Employee UserID and Password are provided by HR.
              <br />
              Contact your HR administrator if you need your login credentials.
            </p>
          </div>
        </form>

        {/* Security footnote */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>MySQL 8.4 • JWT Authenticated • Multi-Company Isolated</span>
        </div>
      </div>
    </div>
  );
}
