'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import { useTrackingSocket } from '@/hooks/useTrackingSocket';

const TrackingDashboardMap = dynamic(
  () => import('@/components/tracking/TrackingDashboardMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] w-full rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <span className="text-xs font-medium">Loading OpenStreetMap Telemetry Visualizer...</span>
      </div>
    ),
  }
);

const GoogleMapsTimelineView = dynamic(
  () => import('@/components/tracking/GoogleMapsTimelineView'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[650px] w-full rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a73e8] border-t-transparent" />
        <span className="text-xs font-semibold">Loading Journey Timeline Engine...</span>
      </div>
    ),
  }
);

const FieldTrackingMap = dynamic(
  () => import('@/components/tracking/FieldTrackingMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] w-full rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <span className="text-xs font-semibold">Loading OSRM Road-Snapped Tactical Map...</span>
      </div>
    ),
  }
);
import {
  Radio,
  MapPin,
  Clock,
  ShieldCheck,
  Plane,
  Users,
  Search,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Navigation,
  Compass,
  Battery,
  Zap,
  Activity,
  ChevronRight,
  ExternalLink,
  X,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

interface LiveTrackingResponse {
  stats: {
    totalEmployees: number;
    onSiteCount: number;
    offSiteCount: number;
    insideGeofenceCount: number;
    outsideGeofenceCount: number;
    activeFieldRoutesCount: number;
    isOfficeHoursActive: boolean;
    officeWorkingHoursText: string;
  };
  employees: any[];
}

export default function TrackingPage() {
  const { user, activeCompany } = useAuth();
  const [data, setData] = useState<LiveTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'ON_SITE' | 'OFF_SITE'>('ALL');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'FIELD_OSRM' | 'TIMELINE' | 'RADAR'>('FIELD_OSRM');

  // Switch Work Location Modal state
  const [switchingEmployee, setSwitchingEmployee] = useState<any | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchSuccessMessage, setSwitchSuccessMessage] = useState<string | null>(null);

  // Selected Session Route Modal state
  const [inspectingSession, setInspectingSession] = useState<any | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Get JWT token for WebSocket auth
  const wsToken =
    typeof window !== 'undefined' ? localStorage.getItem('hrms_token') : null;

  // Real-time WebSocket — updates employee locations without polling
  const { status: wsStatus, wsOnlineCount } = useTrackingSocket({
    token: wsToken,
    onLocationUpdate: (payload) => {
      setData((prev) => {
        if (!prev) return prev;
        const updatedEmployees = prev.employees.map((emp) => {
          if (emp.id !== payload.employeeId) return emp;
          return {
            ...emp,
            isOnline: true,
            lastSeenAt: payload.timestamp,
            liveLocation: {
              ...emp.liveLocation,
              latitude: payload.latitude,
              longitude: payload.longitude,
              accuracy: payload.accuracy,
              speed: payload.speed,
              heading: payload.heading,
              batteryLevel: payload.batteryLevel,
              isMoving: payload.isMoving,
              isWithinGeofence: payload.isWithinGeofence,
              isWithinOfficeHours: payload.isWithinOfficeHours,
              distanceToOfficeMeters: payload.distanceToOfficeMeters,
              updatedAt: payload.timestamp,
            },
          };
        });
        return { ...prev, employees: updatedEmployees };
      });

      // Keep selected employee panel in sync
      setSelectedEmployee((prev: any) => {
        if (!prev || prev.id !== payload.employeeId) return prev;
        return {
          ...prev,
          liveLocation: {
            ...prev.liveLocation,
            latitude: payload.latitude,
            longitude: payload.longitude,
            speed: payload.speed,
            heading: payload.heading,
            batteryLevel: payload.batteryLevel,
            isMoving: payload.isMoving,
            isWithinGeofence: payload.isWithinGeofence,
            distanceToOfficeMeters: payload.distanceToOfficeMeters,
            updatedAt: payload.timestamp,
          },
        };
      });
    },
    onEmployeeOnline: (payload) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          employees: prev.employees.map((emp) =>
            emp.id === payload.employeeId ? { ...emp, isOnline: true } : emp,
          ),
        };
      });
    },
    onEmployeeOffline: (payload) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          employees: prev.employees.map((emp) =>
            emp.id === payload.employeeId ? { ...emp, isOnline: false } : emp,
          ),
        };
      });
    },
  });

  const fetchTrackingData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await api.get<LiveTrackingResponse>('/tracking/live', {
        search: searchQuery || undefined,
        type: selectedTypeFilter !== 'ALL' ? selectedTypeFilter : undefined,
        companyId: activeCompany?.id || undefined,
      });
      setData(res);
      if (selectedEmployee) {
        const updated = res.employees.find((e) => e.id === selectedEmployee.id);
        if (updated) setSelectedEmployee(updated);
      }
    } catch (err) {
      console.error('Failed to fetch tracking data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, selectedTypeFilter, selectedEmployee, activeCompany]);

  useEffect(() => {
    fetchTrackingData();
    // WebSocket handles real-time updates — HTTP sync is a fallback every 60s
    // to pick up employees who reconnected via HTTP only (no WS)
    const interval = setInterval(() => {
      fetchTrackingData(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchTrackingData]);

  // Handle Work Location Toggle (ON_SITE ⇄ OFF_SITE)
  const handleToggleWorkLocation = async (emp: any, newType: 'ON_SITE' | 'OFF_SITE') => {
    setIsSwitching(true);
    try {
      await api.put(`/tracking/employee/${emp.id}/work-location`, {
        workLocationType: newType,
      });
      setSwitchSuccessMessage(`Successfully updated ${emp.fullName} to ${newType === 'ON_SITE' ? 'On-Site (Office)' : 'Off-Site (Field)'}`);
      setSwitchingEmployee(null);
      await fetchTrackingData(true);
      setTimeout(() => setSwitchSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Failed to update work location type:', err);
    } finally {
      setIsSwitching(false);
    }
  };

  // Inspect Route Points and Checkpoints
  const handleInspectRoute = async (sessionId: string) => {
    setIsLoadingSession(true);
    try {
      const session = await api.get<any>(`/tracking/sessions/${sessionId}`);
      setInspectingSession(session);
      setTimeout(() => {
        document.getElementById('telemetry-map-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Failed to load session route details:', err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const stats = data?.stats;
  const employees = data?.employees || [];

  // Export Field Tracking Report to Professional Multi-Sheet Excel
  const exportTrackingExcel = () => {
    if (!employees || employees.length === 0) {
      alert('No employee tracking records to export.');
      return;
    }

    const companyName = activeCompany?.name || 'Gram Tarang Inclusive Development Services Private Limited';
    const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const todayStr = new Date().toISOString().split('T')[0];

    // Sheet 1: Master Real-Time Field Telemetry & Geofence Audit
    const ws1Aoa: any[][] = [
      [companyName.toUpperCase()],
      ['EXECUTIVE REAL-TIME FIELD OPERATIONS & LIVE GPS AUDIT REPORT'],
      [`Audit Date: ${todayStr}`, '', `Generated At: ${nowIST} (IST)`, '', `Generated By: ${user?.email || 'HR Manager'}`],
      [],
      [
        'S.No',
        'Employee Code',
        'Full Name',
        'Department',
        'Designation',
        'Assigned Duty Mode',
        'Telemetry Status',
        'Current Speed (km/h)',
        'Battery Level (%)',
        'Geofence Compliance',
        'Distance to Office (m)',
        'Latitude',
        'Longitude',
        'Last Known Location',
        'Last Reported (IST)',
      ],
    ];

    employees.forEach((emp, idx) => {
      const live = emp.liveLocation;
      const speed = live?.speed ? Number(live.speed.toFixed(1)) : 0;
      const isMoving = speed >= 0.5;
      const statusText = !live
        ? 'AWAITING BROADCAST'
        : isMoving
        ? `IN TRANSIT (${speed} km/h)`
        : 'STATIONARY AT SITE';

      ws1Aoa.push([
        idx + 1,
        emp.employeeCode || `EMP-${idx + 1}`,
        `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Staff Member',
        emp.department?.name || 'Operations',
        emp.designation?.title || 'Field Specialist',
        emp.workLocationType === 'ON_SITE' ? 'ON-SITE (OFFICE)' : 'OFF-SITE (FIELD)',
        statusText,
        speed,
        live?.batteryLevel ?? 100,
        live?.isWithinGeofence ? 'INSIDE 50M GEOFENCE' : 'OUTSIDE PERIMETER',
        live?.distanceToOfficeMeters ? Math.round(live.distanceToOfficeMeters) : 0,
        live?.latitude ? Number(live.latitude.toFixed(6)) : 'N/A',
        live?.longitude ? Number(live.longitude.toFixed(6)) : 'N/A',
        emp.office?.name || emp.officeLocation?.name || 'Assigned Field Cluster',
        live?.updatedAt
          ? new Date(live.updatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
          : '--:--',
      ]);
    });

    // Sheet 2: Fleet KPI Summary
    const ws2Aoa: any[][] = [
      [companyName.toUpperCase()],
      ['WORKFORCE FLEET DEPLOYMENT KPI SUMMARY'],
      [`Date: ${todayStr}`],
      [],
      ['Operational Metric', 'Current Count', 'Percentage', 'Operational Notes'],
      ['Total Enrolled Workforce', employees.length, '100%', 'Registered on platform'],
      ['On-Site Office Personnel', data?.stats?.onSiteCount || 0, `${(((data?.stats?.onSiteCount || 0) / Math.max(1, employees.length)) * 100).toFixed(1)}%`, 'Assigned to office premises'],
      ['Off-Site Field Specialists', data?.stats?.offSiteCount || 0, `${(((data?.stats?.offSiteCount || 0) / Math.max(1, employees.length)) * 100).toFixed(1)}%`, 'Dispatched on field missions'],
      ['Active Routes Broadcasting Live', data?.stats?.activeFieldRoutesCount || 0, `${(((data?.stats?.activeFieldRoutesCount || 0) / Math.max(1, employees.length)) * 100).toFixed(1)}%`, 'Streaming live GPS telemetry'],
      ['Inside 50m Geofence Perimeter', data?.stats?.insideGeofenceCount || 0, `${(((data?.stats?.insideGeofenceCount || 0) / Math.max(1, employees.length)) * 100).toFixed(1)}%`, 'Geofence compliant'],
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Aoa);
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Aoa);

    ws1['!cols'] = [
      { wch: 8 },  // S.No
      { wch: 16 }, // Code
      { wch: 22 }, // Name
      { wch: 20 }, // Dept
      { wch: 22 }, // Desig
      { wch: 18 }, // Mode
      { wch: 24 }, // Status
      { wch: 18 }, // Speed
      { wch: 16 }, // Battery
      { wch: 22 }, // Geofence
      { wch: 20 }, // Distance
      { wch: 14 }, // Lat
      { wch: 14 }, // Lng
      { wch: 28 }, // Location
      { wch: 18 }, // Reported
    ];

    ws2['!cols'] = [
      { wch: 34 },
      { wch: 16 },
      { wch: 16 },
      { wch: 32 },
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Field_Telemetry_Log');
    XLSX.utils.book_append_sheet(wb, ws2, 'Fleet_KPI_Summary');

    XLSX.writeFile(wb, `field_operations_live_tracking_${todayStr}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Office Hours & Dual-Tracking Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl border border-indigo-900/40">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
                Dual-Track Workforce Monitoring Hub
              </span>
              {/* WebSocket status badge */}
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                wsStatus === 'connected'
                  ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
                  : wsStatus === 'connecting'
                  ? 'bg-amber-900/50 text-amber-300 border-amber-700'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
                  wsStatus === 'connecting' ? 'bg-amber-400 animate-ping' :
                  'bg-slate-500'
                }`} />
                {wsStatus === 'connected'
                  ? `Live · ${wsOnlineCount} online`
                  : wsStatus === 'connecting'
                  ? 'Connecting…'
                  : 'Polling'}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Live Location & Field Operations Tracking
            </h1>
            <p className="mt-1 text-xs text-slate-300 max-w-2xl">
              Real-time GPS geofence compliance and dynamic route breadcrumbs • {activeCompany?.name || 'All Registered Companies'}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2 border border-slate-700/70 text-xs">
              <Clock className="h-4 w-4 text-emerald-400" />
              <div className="text-right">
                <span className="block text-[10px] text-slate-400 uppercase">Office Working Hours</span>
                <strong className="text-white font-mono">{stats?.officeWorkingHoursText || '09:00 AM – 05:30 PM (IST)'}</strong>
              </div>
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  stats?.isOfficeHoursActive
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                {stats?.isOfficeHoursActive ? 'ACTIVE NOW' : 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await api.post<any>('/tracking/simulate-breach', {});
                    alert(res.message || 'Geofence breach simulated!');
                    fetchTrackingData(true);
                  } catch (err: any) {
                    alert(err.message || 'Failed to simulate breach');
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600/70 hover:bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-all border border-amber-500/40 shadow-sm"
                title="Simulate an office employee stepping out of geofence"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-200" />
                <span>Simulate Office Breach</span>
              </button>

              <button
                onClick={() => fetchTrackingData(true)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600/60 hover:bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-all border border-indigo-500/40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Updating...' : 'Sync Radar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {switchSuccessMessage && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-medium text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{switchSuccessMessage}</span>
        </div>
      )}

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Staff</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{stats?.totalEmployees ?? 0}</span>
            <span className="text-xs text-slate-500">enrolled</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">On-Site Office</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{stats?.onSiteCount ?? 0}</span>
            <span className="text-xs text-emerald-600 font-medium">50m geofence</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In-Office Inside 50m</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-700">{stats?.insideGeofenceCount ?? 0}</span>
            <span className="text-xs text-slate-500">
              / {stats?.onSiteCount ?? 0} ({stats?.onSiteCount ? Math.round(((stats.insideGeofenceCount) / stats.onSiteCount) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Off-Site Field Ops</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Plane className="h-4 w-4 rotate-45" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-700">{stats?.offSiteCount ?? 0}</span>
            <span className="text-xs text-indigo-600 font-medium">drone/client missions</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Routes</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{stats?.activeFieldRoutesCount ?? 0}</span>
            <span className="text-xs text-slate-500">broadcasting live</span>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveViewMode('FIELD_OSRM')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer ${
              activeViewMode === 'FIELD_OSRM'
                ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-300'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Navigation className="h-4 w-4 text-cyan-200" />
            <span>OSRM Road-Snapped Live Field Ops</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewMode('TIMELINE')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer ${
              activeViewMode === 'TIMELINE'
                ? 'bg-[#1a73e8] text-white shadow-md ring-2 ring-blue-300'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Field Journey Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewMode('RADAR')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer ${
              activeViewMode === 'RADAR'
                ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-400'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Radio className="h-4 w-4 text-emerald-400" />
            <span>Workforce Radar</span>
          </button>
        </div>

        <span className="text-xs text-slate-500 font-medium hidden md:inline-block">
          Select any employee to view their road-snapped journey, places visited, and street addresses
        </span>
      </div>

      {/* Main Tactical Map View */}
      <div id="telemetry-map-section">
        {activeViewMode === 'FIELD_OSRM' ? (
          <FieldTrackingMap
            initialEmployeeId={selectedEmployee?.id}
            initialEmployeeName={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : (employees[0] ? `${employees[0].firstName} ${employees[0].lastName}` : 'Field Specialist')}
            initialPosition={
              selectedEmployee?.liveLocation?.latitude && selectedEmployee?.liveLocation?.longitude
                ? [selectedEmployee.liveLocation.latitude, selectedEmployee.liveLocation.longitude]
                : (employees[0]?.liveLocation?.latitude && employees[0]?.liveLocation?.longitude
                    ? [employees[0].liveLocation.latitude, employees[0].liveLocation.longitude]
                    : [18.1502552, 83.3905899])
            }
            height="560px"
          />
        ) : activeViewMode === 'TIMELINE' ? (
          <GoogleMapsTimelineView
            employees={employees}
            initialEmployeeId={selectedEmployee?.id}
            onSelectEmployee={(emp) => setSelectedEmployee(emp)}
            onRefreshParent={() => fetchTrackingData(true)}
          />
        ) : (
          <TrackingDashboardMap
            employees={employees}
            selectedEmployeeId={selectedEmployee?.id}
            onSelectEmployee={(emp) => setSelectedEmployee(emp)}
            selectedSessionData={inspectingSession}
            onCloseSession={() => setInspectingSession(null)}
            defaultOffice={employees[0]?.office || null}
            height={inspectingSession ? '600px' : '520px'}
          />
        )}
      </div>

      {/* Staff Directory & Telemetry Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 p-4 gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-800">Monitored Personnel Directory</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {employees.length} employees
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, code, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-64 rounded-xl border border-slate-200 pl-9 pr-3 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-medium">
              <button
                onClick={() => setSelectedTypeFilter('ALL')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  selectedTypeFilter === 'ALL'
                    ? 'bg-white text-slate-800 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedTypeFilter('ON_SITE')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  selectedTypeFilter === 'ON_SITE'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                On-Site (Office)
              </button>
              <button
                onClick={() => setSelectedTypeFilter('OFF_SITE')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  selectedTypeFilter === 'OFF_SITE'
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Off-Site (Field)
              </button>
            </div>

            {/* Export Field Tracking Report Button */}
            <button
              onClick={exportTrackingExcel}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition cursor-pointer"
              title="Download full workforce field telemetry and geofence compliance report in Excel (.xlsx)"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Field Report (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Assigned Mode</th>
                <th className="px-4 py-3.5">Geofence & Location Status</th>
                <th className="px-4 py-3.5">Office Hours</th>
                <th className="px-4 py-3.5">Telemetry & Speed</th>
                <th className="px-4 py-3.5">Field Route Mission</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No employees matching the current filter.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isOnSite = emp.workLocationType === 'ON_SITE';
                  const live = emp.liveLocation;
                  const isWithin = live?.isWithinGeofence;
                  const session = emp.latestSession;

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        selectedEmployee?.id === emp.id ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      {/* Employee Info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-bold text-xs ${
                              isOnSite ? 'bg-emerald-600' : 'bg-indigo-600'
                            }`}
                          >
                            {emp.fullName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{emp.fullName}</span>
                            <span className="text-[11px] text-slate-400">
                              {emp.employeeCode} • {emp.designation}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Mode Badge & Switch Button */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              isOnSite
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {isOnSite ? (
                              <MapPin className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Plane className="h-3 w-3 text-indigo-600 rotate-45" />
                            )}
                            {isOnSite ? 'ON-SITE (Office)' : 'OFF-SITE (Field)'}
                          </span>
                          <button
                            title="Toggle Work Location"
                            onClick={() => setSwitchingEmployee(emp)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Geofence Status */}
                      <td className="px-4 py-4">
                        {isOnSite ? (
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                isWithin ? 'text-emerald-700' : 'text-amber-600'
                              }`}
                            >
                              {isWithin ? (
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              )}
                              {isWithin ? 'Inside 50m Geofence' : 'Outside Office Bounds'}
                            </span>
                            {live?.distanceToOfficeMeters !== undefined && (
                              <span className="block text-[10px] text-slate-400 font-mono">
                                Distance: {Math.round(live.distanceToOfficeMeters)}m from office
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-indigo-700 inline-flex items-center gap-1">
                              <Compass className="h-3.5 w-3.5 text-indigo-500" />
                              Field Dynamic Mission
                            </span>
                            {live ? (
                              <span className="block text-[10px] text-slate-400 font-mono">
                                GPS: {live.latitude.toFixed(4)}, {live.longitude.toFixed(4)}
                              </span>
                            ) : (
                              <span className="block text-[10px] text-slate-400">Waiting for GPS signal</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Office Hours */}
                      <td className="px-4 py-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            live?.isWithinOfficeHours
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {live?.isWithinOfficeHours ? 'Office Hours Active' : 'Outside 09:00-17:30'}
                        </span>
                      </td>

                      {/* Telemetry & Speed */}
                      <td className="px-4 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[11px] text-slate-700">
                            <Zap className="h-3 w-3 text-amber-500" />
                            <span>
                              {live?.speed ? `${(live.speed * 3.6).toFixed(1)} km/h` : 'Stationary (0 km/h)'}
                            </span>
                          </div>
                          {live?.batteryLevel !== undefined && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Battery className="h-3 w-3 text-emerald-500" />
                              <span>{live.batteryLevel}% battery</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Field Mission Data */}
                      <td className="px-4 py-4">
                        {session ? (
                          <div>
                            <span className="font-bold text-indigo-700">
                              {session.distanceKm.toFixed(2)} km
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {session.pointsCount} points • {session.checkpointsCount} stops
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Timeline View Button */}
                          <button
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setActiveViewMode('TIMELINE');
                              document.getElementById('telemetry-map-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1a73e8] px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Navigation className="h-3 w-3" />
                            <span>Timeline</span>
                          </button>

                          {/* Breach Live Tracking Button */}
                          {isOnSite && !isWithin && (
                            <button
                              onClick={() => {
                                setSelectedEmployee(emp);
                                setActiveViewMode('TIMELINE');
                                document.getElementById('telemetry-map-section')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 text-xs font-bold transition-colors animate-pulse cursor-pointer shadow-sm"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              <span>Track Live</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setActiveViewMode('RADAR');
                              document.getElementById('telemetry-map-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                          >
                            Radar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Switch Work Location Modal */}
      {switchingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Change Employee Work Mode</h3>
              <button
                onClick={() => setSwitchingEmployee(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Update working mode for <strong>{switchingEmployee.fullName}</strong> ({switchingEmployee.employeeCode}).
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleToggleWorkLocation(switchingEmployee, 'ON_SITE')}
                disabled={isSwitching}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${
                  switchingEmployee.workLocationType === 'ON_SITE'
                    ? 'border-emerald-600 bg-emerald-50/50'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    <span>On-Site (Office 50m Geofence)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Monitored against the office perimeter during office hours.
                  </p>
                </div>
                {switchingEmployee.workLocationType === 'ON_SITE' && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                )}
              </button>

              <button
                onClick={() => handleToggleWorkLocation(switchingEmployee, 'OFF_SITE')}
                disabled={isSwitching}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${
                  switchingEmployee.workLocationType === 'OFF_SITE'
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-indigo-800 text-sm">
                    <Plane className="h-4 w-4 text-indigo-600 rotate-45" />
                    <span>Off-Site (Field Operations / Drone)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tracked via GPS route breadcrumbs, traveled km, and stop checkpoints.
                  </p>
                </div>
                {switchingEmployee.workLocationType === 'OFF_SITE' && (
                  <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                )}
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSwitchingEmployee(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Field Route Session Modal */}
      {inspectingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-indigo-400 rotate-45" />
                <div>
                  <h3 className="text-sm font-bold">Field Route Mission Details</h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Session ID: {inspectingSession.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectingSession(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Traveled</span>
                  <span className="text-base font-bold text-indigo-700">{inspectingSession.distanceKm?.toFixed(2) || '0.00'} km</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Route Points</span>
                  <span className="text-base font-bold text-slate-800">{inspectingSession.routePoints?.length || 0} recorded</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Stationary Stops</span>
                  <span className="text-base font-bold text-emerald-700">{inspectingSession.checkpoints?.length || 0} stops</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Stationary Checkpoints & Dwell Stops (variance &le; 15m for &ge; 120s)
                </h4>
                {inspectingSession.checkpoints?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4">No stationary stops recorded for this session.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Stop #</th>
                          <th className="px-3 py-2">Coordinates</th>
                          <th className="px-3 py-2">Arrived At</th>
                          <th className="px-3 py-2">Departed At</th>
                          <th className="px-3 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectingSession.checkpoints.map((cp: any, i: number) => (
                          <tr key={cp.id || i} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-bold text-indigo-700">#{cp.pointIndex ?? i + 1}</td>
                            <td className="px-3 py-2.5 font-mono text-[11px]">
                              {cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 font-mono">
                              {new Date(cp.arrivedAt).toLocaleTimeString()}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 font-mono">
                              {cp.departedAt ? new Date(cp.departedAt).toLocaleTimeString() : 'In Progress'}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{cp.notes || 'Stationary Dwell Stop'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-3 bg-slate-50 flex justify-end">
              <button
                onClick={() => setInspectingSession(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
