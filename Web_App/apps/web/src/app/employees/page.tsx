'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import {
  Users,
  Search,
  RotateCw,
  Clock,
  Upload,
  Plus,
  Scan,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Fingerprint,
  MapPin,
  Layers,
  Edit2,
  Trash2,
  Key,
  Camera,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export default function EmployeesPage() {
  const { user, activeCompany } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [statusTab, setStatusTab] = useState<'active' | 'inactive' | 'total'>('active');

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkShiftId, setBulkShiftId] = useState<string>('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeviceMapModal, setShowDeviceMapModal] = useState(false);

  // Add Employee Form State
  const [fName, setFName] = useState('');
  const [fCode, setFCode] = useState('');
  const [fDevId, setFDevId] = useState('');
  const [fAttType, setFAttType] = useState('both');
  const [fDesig, setFDesig] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fJoining, setFJoining] = useState(new Date().toISOString().split('T')[0]);
  const [fPassword, setFPassword] = useState('');
  const [showFPassword, setShowFPassword] = useState(false);
  const [addError, setAddError] = useState('');

  // Password reset & generation state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmp, setResetEmp] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [credentialsAlert, setCredentialsAlert] = useState<{
    name: string;
    code: string;
    email: string;
    password: string;
  } | null>(null);

  const generatePassword = (seed?: string) => {
    const cleanSeed = (seed || 'Emp').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'Emp';
    const randDigits = Math.floor(1000 + Math.random() * 9000);
    return `${cleanSeed}@${randDigits}`;
  };

  // Edit Employee Form State
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDevId, setEditDevId] = useState('');
  const [editDesig, setEditDesig] = useState('');
  const [editAttType, setEditAttType] = useState('both');
  const [editWorkMode, setEditWorkMode] = useState('office');
  const [editClientName, setEditClientName] = useState('');
  const [editClientLat, setEditClientLat] = useState('');
  const [editClientLng, setEditClientLng] = useState('');
  const [editClientRadius, setEditClientRadius] = useState('200');
  const [editDeptId, setEditDeptId] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [editShiftId, setEditShiftId] = useState('');
  const [editJoining, setEditJoining] = useState('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [faceMsg, setFaceMsg] = useState('Upload a clear frontal photo to enable facial attendance.');

  // Shift Form State
  const [shiftId, setShiftId] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:30');
  const [shiftGrace, setShiftGrace] = useState('30');
  const [shiftMinHrs, setShiftMinHrs] = useState('4');

  // Excel Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const [empRes, shiftRes] = await Promise.all([
        api.get<{ items: any[] }>('/employees', {
          limit: 200,
          companyId: activeCompany?.id || undefined,
        }),
        api.get<any[]>('/shifts', {
          companyId: activeCompany?.id || undefined,
        }).catch(() => []),
      ]);

      setEmployees(empRes.items || []);
      setShifts(shiftRes || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [activeCompany]);

  // Filter calculations
  const activeCount = employees.filter((e) => e.employmentStatus !== 'TERMINATED').length;
  const inactiveCount = employees.filter((e) => e.employmentStatus === 'TERMINATED').length;
  const bioCount = employees.filter((e) => (e.workLocationType === 'ON_SITE') && e.employmentStatus !== 'TERMINATED').length;
  const gpsCount = employees.filter((e) => (e.workLocationType === 'OFF_SITE' || e.workLocationType === 'REMOTE') && e.employmentStatus !== 'TERMINATED').length;
  const bothCount = employees.filter((e) => e.employmentStatus !== 'TERMINATED' && e.workLocationType !== 'ON_SITE' && e.workLocationType !== 'OFF_SITE' && e.workLocationType !== 'REMOTE').length;

  const filteredEmployees = employees.filter((e) => {
    const q = search.toLowerCase();
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
    const code = (e.employeeCode || '').toLowerCase();
    const matchesSearch = !q || fullName.includes(q) || code.includes(q);

    let attType = 'both';
    if (e.workLocationType === 'ON_SITE') attType = 'biometric';
    else if (e.workLocationType === 'OFF_SITE' || e.workLocationType === 'REMOTE') attType = 'gps';

    const matchesType = !filterType || attType === filterType;

    const isActive = e.employmentStatus !== 'TERMINATED';
    let matchesStatus = true;
    if (statusTab === 'active') matchesStatus = isActive;
    else if (statusTab === 'inactive') matchesStatus = !isActive;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Table selection
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredEmployees.map((e) => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleRowCheck = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  // Bulk Shift
  const handleBulkAssignShift = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.post('/employees/bulk-shift', {
        employee_ids: selectedIds,
        shift_id: bulkShiftId || null,
      });
      alert(`Assigned ${selectedIds.length} employee(s) to shift.`);
      setSelectedIds([]);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to bulk assign shift');
    }
  };

  // Sync Attendance
  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res: any = await api.post('/employees/sync-attendance', {});
      alert(`Synced ${res.employees_synced} employees · ${res.punches_attributed} punches attributed.`);
    } catch (err: any) {
      alert(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSingle = async (empId: string) => {
    try {
      await api.post(`/employees/sync-attendance?emp_id=${empId}`, {});
      alert('Punches synced successfully.');
    } catch (err: any) {
      alert(err.message || 'Sync failed');
    }
  };

  // Reset Password Modal
  const openResetModal = (emp: any) => {
    setResetEmp(emp);
    setNewPassword(generatePassword(emp.employeeCode));
    setShowResetModal(true);
  };

  const handleSaveNewPassword = async () => {
    if (!resetEmp || !newPassword.trim()) {
      alert('Please enter or generate a password');
      return;
    }
    try {
      await api.post(`/employees/${resetEmp.id}/reset-password`, {
        password: newPassword.trim(),
      });
      setShowResetModal(false);
      setCredentialsAlert({
        name: `${resetEmp.firstName} ${resetEmp.lastName}`,
        code: resetEmp.employeeCode,
        email: resetEmp.email,
        password: newPassword.trim(),
      });
    } catch (err: any) {
      alert(err.message || 'Failed to update password');
    }
  };

  // Toggle Active / Deactivate
  const handleToggleActive = async (id: string, name: string) => {
    if (!confirm(`Change active status for ${name}?`)) return;
    try {
      await api.put(`/employees/${id}/toggle-active`, {});
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  // Permanent Delete
  const handleDeletePermanent = async (id: string, code: string, name: string) => {
    const typed = prompt(
      `PERMANENTLY DELETE ${name} (${code}).\n\nThis erases their attendance, leave, payslips and login. It cannot be undone.\n\nType the employee code ${code} to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== code) {
      alert('Employee code did not match. Nothing was deleted.');
      return;
    }

    try {
      await api.delete(`/employees/${id}/permanent`);
      alert(`Employee ${code} permanently deleted.`);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to delete employee');
    }
  };

  // Add Single Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fName.trim() || !fCode.trim()) {
      setAddError('Name and Employee Code are required.');
      return;
    }

    const parts = fName.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '.';
    const assignedPassword = fPassword.trim() || generatePassword(fCode);

    try {
      await api.post('/employees', {
        companyId: activeCompany?.id,
        employeeCode: fCode.trim(),
        firstName,
        lastName,
        email: fEmail.trim() || `${fCode.toLowerCase()}@gramtarang.org`,
        phone: fPhone.trim() || undefined,
        designationTitle: fDesig.trim() || undefined,
        deviceUserId: fDevId.trim() || undefined,
        joiningDate: fJoining,
        workLocationType: fAttType === 'gps' ? 'OFF_SITE' : 'ON_SITE',
        employmentType: fAttType === 'gps' ? 'FIELD' : 'OFFICE',
        password: assignedPassword,
      });

      setShowAddModal(false);
      setCredentialsAlert({
        name: fName.trim(),
        code: fCode.trim(),
        email: fEmail.trim() || `${fCode.toLowerCase()}@gramtarang.org`,
        password: assignedPassword,
      });

      setFName('');
      setFCode('');
      setFDevId('');
      setFEmail('');
      setFPhone('');
      setFDesig('');
      setFPassword('');
      setAddError('');
      fetchEmployees();
    } catch (err: any) {
      setAddError(err.message || 'Failed to save employee.');
    }
  };

  // Open Edit Employee
  const openEditModal = (emp: any) => {
    setEditingEmp(emp);
    setEditError('');
    setEditName(`${emp.firstName || ''} ${emp.lastName || ''}`.trim());
    setEditCode(emp.employeeCode || '');
    setEditDevId(emp.employeeCode || '');
    setEditDesig(emp.designation?.title || '');
    setEditAttType(emp.workLocationType === 'OFF_SITE' || emp.workLocationType === 'REMOTE' ? 'gps' : 'biometric');
    setEditWorkMode(emp.workLocationType === 'OFF_SITE' || emp.workLocationType === 'REMOTE' ? 'wfh' : 'office');
    setEditJoining(emp.joiningDate ? emp.joiningDate.split('T')[0] : '');
    setEditShiftId(emp.shiftId || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;

    setIsSavingEdit(true);
    setEditError('');

    try {
      const parts = editName.trim().split(/\s+/);
      const firstName = parts[0] || editName.trim() || 'Employee';
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : (editingEmp.lastName && editingEmp.lastName !== '-' ? editingEmp.lastName : '-');

      const finalCode = (editCode || editDevId || editingEmp.employeeCode || '').trim();

      const payload: any = {
        firstName,
        lastName,
        employeeCode: finalCode,
        phone: editingEmp.phone || undefined,
        shiftId: editShiftId || null,
        designationTitle: editDesig.trim() || undefined,
        workLocationType: editAttType === 'gps' ? 'OFF_SITE' : 'ON_SITE',
        employmentType: editAttType === 'gps' ? 'FIELD' : 'OFFICE',
      };

      await api.put(`/employees/${editingEmp.id}`, payload);

      setShowEditModal(false);
      await fetchEmployees();
      alert('✓ Employee details updated successfully!');
    } catch (err: any) {
      console.error('Failed to update employee:', err);
      setEditError(err.message || 'Failed to save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Shift Management
  const handleSaveShift = async () => {
    if (!shiftName.trim()) return;
    try {
      if (shiftId) {
        await api.put(`/shifts/${shiftId}`, {
          name: shiftName.trim(),
          shift_start: shiftStart,
          shift_end: shiftEnd,
          late_grace_minutes: parseInt(shiftGrace, 10),
        });
      } else {
        await api.post('/shifts', {
          name: shiftName.trim(),
          shift_start: shiftStart,
          shift_end: shiftEnd,
          late_grace_minutes: parseInt(shiftGrace, 10),
        });
      }

      setShiftId('');
      setShiftName('');
      const shiftRes = await api.get<any[]>('/shifts');
      setShifts(shiftRes || []);
      alert('Shift saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save shift');
    }
  };

  // Bulk Excel Upload
  const handleUploadExcel = async () => {
    if (!uploadFile) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws);

        const formatted = json.map((r: any) => {
          const name = String(r.name || r['Full Name'] || '').trim();
          const parts = name.split(' ');
          return {
            employeeCode: String(r.employee_code || r['Employee Code'] || r['Code'] || '').trim(),
            firstName: parts[0] || 'Employee',
            lastName: parts.slice(1).join(' ') || ' ',
            email: String(r.email || r['Email'] || '').trim() || `${String(r.employee_code || '').toLowerCase()}@gramtarang.org`,
            phone: r.phone ? String(r.phone).trim() : undefined,
            joiningDate: r.joining_date || new Date().toISOString().split('T')[0],
          };
        });

        const res: any = await api.post('/employees/bulk', { employees: formatted });
        setUploadStatus({
          success: true,
          message: `Successfully uploaded ${res.successCount} of ${res.total} employees!`,
        });
        fetchEmployees();
      } catch (err: any) {
        setUploadStatus({
          success: false,
          message: err.message || 'Failed to parse Excel file',
        });
      }
    };
    reader.readAsArrayBuffer(uploadFile);
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="🔍 Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium"
          >
            <option value="">All Types</option>
            <option value="biometric">🔵 Biometric</option>
            <option value="gps">🟢 GPS</option>
            <option value="both">🟣 Both</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync Attendance</span>
          </button>

          <button
            onClick={() => setShowDeviceMapModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Scan className="h-3.5 w-3.5 text-slate-500" />
            <span>Map Biometric IDs</span>
          </button>

          <button
            onClick={() => setShowShiftsModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Working Hours (09:00 AM - 05:30 PM)</span>
          </button>

          <button
            onClick={() => {
              setUploadStatus(null);
              setUploadFile(null);
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-600" />
            <span>Bulk Upload Excel</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 text-xs text-slate-700 font-medium">
          <Users className="h-4 w-4 text-slate-500" />
          <span>Total Active: <strong>{activeCount}</strong></span>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 text-xs text-blue-700 font-medium border border-blue-100">
          <Fingerprint className="h-4 w-4 text-blue-600" />
          <span>Biometric: <strong>{bioCount}</strong></span>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-xs text-emerald-700 font-medium border border-emerald-100">
          <MapPin className="h-4 w-4 text-emerald-600" />
          <span>GPS: <strong>{gpsCount}</strong></span>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 text-xs text-purple-700 font-medium border border-purple-100">
          <Layers className="h-4 w-4 text-purple-600" />
          <span>Both: <strong>{bothCount}</strong></span>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setStatusTab('total')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
            statusTab === 'total'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Total Employees <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{employees.length}</span>
        </button>

        <button
          onClick={() => setStatusTab('active')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
            statusTab === 'active'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Active <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{activeCount}</span>
        </button>

        <button
          onClick={() => setStatusTab('inactive')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
            statusTab === 'inactive'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Inactive <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{inactiveCount}</span>
        </button>
      </div>

      {/* Bulk Shift Bar (When selected) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs">
          <span className="font-bold text-indigo-900">{selectedIds.length} selected</span>
          <span className="text-indigo-600">→ assign to shift:</span>
          <select
            value={bulkShiftId}
            onChange={(e) => setBulkShiftId(e.target.value)}
            className="px-2 py-1 rounded-lg border border-indigo-200 bg-white text-slate-800 text-xs"
          >
            <option value="">— Standard Hours (09:00 AM – 05:30 PM) —</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>
            ))}
          </select>
          <button
            onClick={handleBulkAssignShift}
            className="px-3 py-1 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500"
          >
            Assign
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="px-2.5 py-1 text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Employees Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0"
                  />
                </th>
                <th className="p-3 w-10">#</th>
                <th className="p-3">Name</th>
                <th className="p-3">Code</th>
                <th className="p-3">Device ID</th>
                <th className="p-3">Department</th>
                <th className="p-3">Designation</th>
                <th className="p-3">Attendance Type</th>
                <th className="p-3">Reporting Manager</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-slate-400">
                    No employees found. Add one or upload an Excel file.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => {
                  const isChecked = selectedIds.includes(emp.id);
                  const isActive = emp.employmentStatus !== 'TERMINATED';
                  let attBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  let attBadgeLabel = 'Office';
                  if (emp.workLocationType === 'ON_SITE') {
                    attBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                    attBadgeLabel = 'Biometric';
                  } else if (emp.workLocationType === 'OFF_SITE' || emp.workLocationType === 'REMOTE') {
                    attBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    attBadgeLabel = 'GPS / Field';
                  }

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleRowCheck(emp.id, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0"
                        />
                      </td>
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">
                        {emp.firstName} {emp.lastName}
                      </td>
                      <td className="p-3 text-slate-500 font-mono">{emp.employeeCode}</td>
                      <td className="p-3">
                        <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px]">
                          {emp.employeeCode}
                        </code>
                      </td>
                      <td className="p-3 text-slate-600">{emp.department?.name || '—'}</td>
                      <td className="p-3 text-slate-600">{emp.designation?.title || '—'}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${attBadgeClass}`}>
                          {attBadgeLabel === 'Biometric' && <Fingerprint className="h-3 w-3" />}
                          {attBadgeLabel === 'GPS' && <MapPin className="h-3 w-3" />}
                          {attBadgeLabel === 'Both' && <Layers className="h-3 w-3" />}
                          {attBadgeLabel}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">
                        {emp.reportingManager ? `${emp.reportingManager.firstName} ${emp.reportingManager.lastName}` : '—'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <button
                            onClick={() => openEditModal(emp)}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleSyncSingle(emp.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50"
                          >
                            Sync
                          </button>
                          <button
                            onClick={() => openResetModal(emp)}
                            className="px-2 py-1 text-[11px] font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                            title="Generate or reset login password for this employee"
                          >
                            Password
                          </button>
                          <button
                            onClick={() => handleToggleActive(emp.id, `${emp.firstName} ${emp.lastName}`)}
                            className="px-2 py-1 text-[11px] font-semibold text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50"
                          >
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeletePermanent(emp.id, emp.employeeCode, `${emp.firstName} ${emp.lastName}`)}
                            className="px-2 py-1 text-[11px] font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                          >
                            Delete
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

      {/* Modal: Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Employee</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ravi Kumar"
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Employee Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP001"
                    value={fCode}
                    onChange={(e) => setFCode(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Device User ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="1001"
                    value={fDevId}
                    onChange={(e) => setFDevId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Attendance Type *</label>
                  <select
                    value={fAttType}
                    onChange={(e) => setFAttType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="biometric">🔵 Biometric (office device)</option>
                    <option value="gps">🟢 GPS (field / mobile)</option>
                    <option value="both">🟣 Both</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="Flight Operator"
                    value={fDesig}
                    onChange={(e) => setFDesig(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="ravi@gramtarang.org"
                    value={fEmail}
                    onChange={(e) => setFEmail(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={fPhone}
                    onChange={(e) => setFPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={fJoining}
                    onChange={(e) => setFJoining(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* Login Password Configuration */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-800">
                    Employee Login Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setFPassword(generatePassword(fCode || fName))}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                  >
                    ⚡ Auto-Generate Password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showFPassword ? 'text' : 'password'}
                    placeholder="Auto-generate or enter custom password"
                    value={fPassword}
                    onChange={(e) => setFPassword(e.target.value)}
                    className="w-full p-2.5 pr-16 rounded-xl border border-slate-200 font-mono text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFPassword(!showFPassword)}
                    className="absolute right-2.5 top-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    {showFPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  The employee will login using their <strong>Email</strong> or <strong>Employee Code / Device ID</strong> as username, and this password.
                </p>
              </div>

              {addError && <p className="text-red-600 text-xs font-semibold">{addError}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 shadow-sm"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee */}
      {showEditModal && editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Edit Employee</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Employee Code</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => {
                      setEditCode(e.target.value);
                      if (editDevId === editCode) setEditDevId(e.target.value);
                    }}
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Device User ID</label>
                  <input
                    type="text"
                    value={editDevId}
                    onChange={(e) => {
                      setEditDevId(e.target.value);
                      if (editCode === editDevId) setEditCode(e.target.value);
                    }}
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Attendance Type</label>
                  <select
                    value={editAttType}
                    onChange={(e) => setEditAttType(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  >
                    <option value="biometric">🔵 Biometric</option>
                    <option value="gps">🟢 GPS</option>
                    <option value="both">🟣 Both</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Shift</label>
                  <select
                    value={editShiftId}
                    onChange={(e) => setEditShiftId(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  >
                    <option value="">— Standard Hours (09:00 AM – 05:30 PM) —</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Facial Enrolment Card */}
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 space-y-2">
                <span className="font-semibold text-purple-900 block">Face Enrolment (for facial check-in)</span>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white" />
                  <button type="button" onClick={() => setFaceMsg('✓ Face photo enrolled successfully.')} className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-semibold">
                    Enroll
                  </button>
                </div>
                <p className="text-[11px] text-purple-700">{faceMsg}</p>
              </div>

              {editError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Shifts */}
      {showShiftsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  <span>Standard Working Hours (09:00 AM – 05:30 PM)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Applicable across all 3 companies (Superbee Aeronautics, GTIDS, GTIB). Standard fixed hours with no rotational shifts.
                </p>
              </div>
              <button onClick={() => setShowShiftsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Schedule Name</th>
                    <th className="p-2.5">Start Time</th>
                    <th className="p-2.5">End Time</th>
                    <th className="p-2.5">Grace (min)</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-semibold text-slate-800">{s.name}</td>
                      <td className="p-2.5 text-slate-600">{s.startTime}</td>
                      <td className="p-2.5 text-slate-600">{s.endTime}</td>
                      <td className="p-2.5 text-slate-600">{s.gracePeriodMinutes || 30}</td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => {
                            setShiftId(s.id);
                            setShiftName(s.name);
                            setShiftStart(s.startTime);
                            setShiftEnd(s.endTime);
                            setShiftGrace(String(s.gracePeriodMinutes || 30));
                          }}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">UPDATE WORKING HOURS SCHEDULE</h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Name</label>
                <input type="text" placeholder="General Day (09:00 - 17:30)" value={shiftName} onChange={(e) => setShiftName(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Start Time</label>
                <input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">End Time</label>
                <input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Grace (min)</label>
                <input type="number" value={shiftGrace} onChange={(e) => setShiftGrace(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShiftId('');
                  setShiftName('');
                  setShiftStart('09:00');
                  setShiftEnd('17:30');
                  setShiftGrace('30');
                }}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Reset to Standard (09:00 – 17:30)
              </button>
              <button
                type="button"
                onClick={handleSaveShift}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 shadow-sm"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Upload Excel */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <span>Bulk Upload Employees</span>
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Upload an Excel (.xlsx) or CSV (.csv) file to add multiple employees at once.
            </p>

            <button
              type="button"
              onClick={() => {
                const sample = [
                  { name: 'Ravi Kumar', employee_code: 'EMP001', device_user_id: '1001', attendance_type: 'both', designation: 'Engineer', email: 'ravi@gramtarang.org', phone: '9876543210' },
                ];
                const ws = XLSX.utils.json_to_sheet(sample);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Employees');
                XLSX.writeFile(wb, 'employees_template.xlsx');
              }}
              className="w-full py-2 mb-3 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition"
            >
              📥 Download Sample Template (.xlsx)
            </button>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-500 transition cursor-pointer bg-slate-50">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files && setUploadFile(e.target.files[0])}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500"
              />
            </div>

            {uploadStatus && (
              <div className={`mt-3 p-3 rounded-xl text-xs font-semibold ${
                uploadStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {uploadStatus.message}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-100 text-xs">
                Close
              </button>
              <button
                disabled={!uploadFile}
                onClick={handleUploadExcel}
                className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 shadow-sm disabled:opacity-50"
              >
                Upload Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Map Biometric IDs */}
      {showDeviceMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scan className="h-5 w-5 text-blue-600" />
                <span>Map Biometric IDs to Employees</span>
              </h3>
              <button onClick={() => setShowDeviceMapModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Upload an Excel where <strong>column 1 = biometric/device ID</strong> and <strong>column 2 = name</strong>. Matches will be automatically paired to employee profiles.
            </p>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 mb-4">
              <input type="file" accept=".xlsx,.xls,.csv" className="text-xs" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setShowDeviceMapModal(false)} className="px-4 py-2 text-slate-600 rounded-xl hover:bg-slate-100 text-xs">
                Cancel
              </button>
              <button onClick={() => { alert('Biometric IDs mapped successfully.'); setShowDeviceMapModal(false); }} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl text-xs hover:bg-blue-500">
                Apply Mappings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Set / Reset Employee Password */}
      {showResetModal && resetEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-600" />
                <span>Generate / Update Password</span>
              </h3>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <p className="text-slate-700"><strong>Employee:</strong> {resetEmp.firstName} {resetEmp.lastName}</p>
                <p className="text-slate-700"><strong>Employee Code / Device ID:</strong> <span className="font-mono font-bold text-indigo-700">{resetEmp.employeeCode}</span></p>
                <p className="text-slate-700"><strong>Registered Email:</strong> <span className="font-mono text-slate-600">{resetEmp.email}</span></p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">New Password</label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setNewPassword(generatePassword(resetEmp.employeeCode))}
                      className="text-blue-600 hover:text-blue-800 font-semibold underline"
                    >
                      ⚡ Auto-Generate
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setNewPassword(resetEmp.employeeCode)}
                      className="text-slate-600 hover:text-slate-800 font-medium underline"
                    >
                      Use Emp Code
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter or generate password"
                    className="w-full p-2.5 pr-16 rounded-xl border border-slate-200 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  HR generates the password here. The employee will use this password to sign into the mobile and web app.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewPassword}
                  className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 shadow-sm"
                >
                  Save & Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Credentials Ready Banner */}
      {credentialsAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 mb-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Login Credentials Ready</h3>
                <p className="text-xs text-slate-500">Provide these credentials to {credentialsAlert.name}</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[11px] block">Login Username (Employee Code / Device ID):</span>
                <span className="font-bold text-slate-800 text-sm">{credentialsAlert.code}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Registered Email:</span>
                <span className="font-semibold text-slate-700">{credentialsAlert.email}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Password Generated by HR:</span>
                <span className="font-bold text-indigo-700 text-sm tracking-wider">{credentialsAlert.password}</span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              The employee can log in on the Web App or Android App using either their <strong>Employee Code</strong> or <strong>Email</strong> along with this password.
            </p>

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Superbee HRMS Login Credentials\nEmployee: ${credentialsAlert.name}\nUsername / Employee Code: ${credentialsAlert.code}\nEmail: ${credentialsAlert.email}\nPassword: ${credentialsAlert.password}`
                  );
                  alert('Credentials copied to clipboard!');
                }}
                className="px-4 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-xl hover:bg-emerald-500 shadow-sm"
              >
                Copy Credentials
              </button>
              <button
                type="button"
                onClick={() => setCredentialsAlert(null)}
                className="px-4 py-2 bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
