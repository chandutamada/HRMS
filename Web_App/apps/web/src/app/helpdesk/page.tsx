'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  LifeBuoy,
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  Plus,
} from 'lucide-react';

export default function HelpdeskPage() {
  const { user, activeCompany } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<any[]>('/helpdesk/tickets', {
        companyId: activeCompany?.id,
      });
      setTickets(data || []);
      if (data?.length > 0 && !selectedTicket) {
        loadTicketDetails(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicketDetails = async (id: string) => {
    try {
      const t = await api.get(`/helpdesk/tickets/${id}`);
      setSelectedTicket(t);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [activeCompany]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newMessage.trim()) return;

    try {
      await api.post(`/helpdesk/tickets/${selectedTicket.id}/messages`, {
        message: newMessage,
      });
      setNewMessage('');
      loadTicketDetails(selectedTicket.id);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    }
  };

  const handleUpdateStatus = async (status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') => {
    if (!selectedTicket) return;
    const notes = prompt(`Enter resolution notes for ${status.toLowerCase()}:`) || '';

    try {
      await api.put(`/helpdesk/tickets/${selectedTicket.id}/status`, {
        status,
        resolutionNotes: notes,
      });
      loadTicketDetails(selectedTicket.id);
      fetchTickets();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Helpdesk & Support</h1>
        <p className="text-xs text-slate-500">
          Track employee tickets regarding geofence attendance, leave inquiries, and payroll issues.
        </p>
      </div>

      {/* 2-Column: Tickets List + Conversation Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Active Tickets ({tickets.length})
          </h3>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {tickets.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No support tickets found</p>
            ) : (
              tickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => loadTicketDetails(t.id)}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                        : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-emerald-700">
                        {t.ticketNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          t.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{t.subject}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{t.description}</p>

                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/50 pt-2 text-[10px] text-slate-400">
                      <span>{t.employee?.firstName} {t.employee?.lastName}</span>
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Conversation Thread */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-[650px]">
          {selectedTicket ? (
            <>
              {/* Ticket Top bar */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    {selectedTicket.ticketNumber} • {selectedTicket.category}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedTicket.subject}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Raised by {selectedTicket.employee?.firstName} {selectedTicket.employee?.lastName} on{' '}
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </p>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleUpdateStatus('IN_PROGRESS')}
                    className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
                  >
                    Resolve
                  </button>
                </div>
              </div>

              {/* Original description box */}
              <div className="my-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs text-slate-700">
                <strong className="block text-slate-800 mb-1">Issue Description:</strong>
                {selectedTicket.description}
              </div>

              {/* Messages History */}
              <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
                {selectedTicket.messages?.map((msg: any) => {
                  const isStaff = msg.sender?.id !== selectedTicket.employee?.userId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-md rounded-2xl p-3 text-xs ${
                          isStaff
                            ? 'bg-slate-900 text-white rounded-br-none'
                            : 'bg-slate-100 text-slate-800 rounded-bl-none'
                        }`}
                      >
                        <span className={`block text-[10px] font-semibold mb-1 ${isStaff ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {msg.sender?.employee?.firstName || msg.sender?.email}
                        </span>
                        <p>{msg.message}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Response input */}
              <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Type a response to this ticket..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-500 transition shadow-sm"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400 text-xs">
              Select a ticket on the left to view conversation thread
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
