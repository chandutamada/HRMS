'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <span className="text-xs font-medium text-slate-500">Loading HRMS Platform...</span>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
