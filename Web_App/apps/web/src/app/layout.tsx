import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import AppLayout from '@/components/layout/AppLayout';

export const metadata = {
  title: 'HRMS Enterprise - GreytHR-Inspired Management Platform',
  description:
    'Complete Human Resource Management System with Google Maps Geofencing for SUPERBEE, GTIDS, and GTIB',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
