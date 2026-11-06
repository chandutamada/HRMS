'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Megaphone,
  Plus,
  CheckSquare,
  Users,
  Eye,
  CheckCircle2,
} from 'lucide-react';

export default function CircularsPage() {
  const { user, activeCompany, companies } = useAuth();
  const [circulars, setCirculars] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(['SUPERBEE', 'GTIDS', 'CUTMAP']);
  const [requiresAck, setRequiresAck] = useState(true);

  // Stats Modal
  const [statsData, setStatsData] = useState<any | null>(null);

  const fetchCirculars = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<any[]>('/circulars');
      setCirculars(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCirculars();
  }, [activeCompany]);

  const handleCheckboxToggle = (code: string) => {
    if (selectedCompanies.includes(code)) {
      if (selectedCompanies.length === 1) return; // Keep at least one
      setSelectedCompanies(selectedCompanies.filter((c) => c !== code));
    } else {
      setSelectedCompanies([...selectedCompanies, code]);
    }
  };

  const handleCreateCircular = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/circulars', {
        title,
        content,
        targetCompanyCodes: selectedCompanies,
        requiresAcknowledgement: requiresAck,
      });

      setShowCreateModal(false);
      setTitle('');
      setContent('');
      fetchCirculars();
    } catch (err: any) {
      alert(err.message || 'Error publishing circular');
    }
  };

  const handleViewStats = async (id: string) => {
    try {
      const data = await api.get(`/circulars/${id}/stats`);
      setStatsData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load stats');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Company Circulars & Announcements</h1>
          <p className="text-xs text-slate-500">
            Target circulars by company checkboxes (SUPERBEE, GTIDS, CUTMAP) and monitor employee acknowledgements.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Publish Circular</span>
        </button>
      </div>

      {/* Circulars List */}
      <div className="space-y-4">
        {circulars.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Megaphone className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">{c.title}</h3>
              </div>

              {/* Target Company Badges */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-medium">Target:</span>
                {c.targetCompanyCodes?.map((code: string) => (
                  <span
                    key={code}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700 border border-slate-200"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-600 whitespace-pre-line bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              {c.content}
            </p>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>Published: {new Date(c.createdAt).toLocaleDateString()}</span>

              <button
                onClick={() => handleViewStats(c.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                <Users className="h-3.5 w-3.5" />
                <span>View Acknowledgement Stats ({c._count?.acknowledgements || 0})</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Publish Circular */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1">Publish New Circular</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select target companies using checkboxes.
            </p>

            <form onSubmit={handleCreateCircular} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Company Holidays & Work Policy"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              {/* Target Companies Checkboxes (Mandatory Feature) */}
              <div>
                <label className="block font-medium text-slate-700 mb-2">
                  Target Companies (Select Checkboxes)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['SUPERBEE', 'GTIDS', 'CUTMAP'].map((code) => {
                    const isChecked = selectedCompanies.includes(code);
                    return (
                      <label
                        key={code}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 cursor-pointer transition ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-semibold'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxToggle(code)}
                          className="h-4 w-4 rounded accent-emerald-600 cursor-pointer"
                        />
                        <span className="font-mono">{code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Circular Content</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter circular announcement text..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reqAck"
                  checked={requiresAck}
                  onChange={(e) => setRequiresAck(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-600"
                />
                <label htmlFor="reqAck" className="text-slate-700 cursor-pointer">
                  Require Employee Acknowledgement
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-500 transition shadow-sm"
                >
                  Publish Immediately
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {statsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-base font-bold text-slate-800 mb-1">Acknowledgement Statistics</h3>
            <p className="text-slate-500 mb-4">{statsData.title}</p>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Total Target Employees:</span>
                <strong className="text-slate-800">{statsData.totalTargetEmployees}</strong>
              </div>
              <div className="flex justify-between">
                <span>Total Acknowledged:</span>
                <strong className="text-emerald-700">{statsData.totalAcknowledged}</strong>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                <span>Acknowledgement Rate:</span>
                <span className="text-emerald-700">{statsData.acknowledgementRate}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStatsData(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-white font-medium hover:bg-slate-900"
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
