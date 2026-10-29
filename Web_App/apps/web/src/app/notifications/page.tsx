'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Bell,
  BellOff,
  Megaphone,
  Lightbulb,
  Cake,
  AlertTriangle,
  Info,
  Check,
  RotateCw,
  Sliders,
  X,
  Calendar,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface FeedItem {
  id: string;
  type: 'announcement' | 'birthday' | 'alert' | 'info' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  expires_at?: string | null;
}

interface BirthdayItem {
  employee_id: string;
  employee_name: string;
  is_today: boolean;
  days_until: number;
}

interface ThoughtItem {
  thought: string;
  author?: string | null;
  date?: string | null;
}

export default function NotificationsPage() {
  const { user, activeCompany } = useAuth();

  // State
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayItem[]>([]);
  const [thought, setThought] = useState<ThoughtItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showPostModal, setShowPostModal] = useState(false);
  const [showThoughtModal, setShowThoughtModal] = useState(false);

  // Form State - Post Announcement
  const [postType, setPostType] = useState<'announcement' | 'info' | 'alert' | 'birthday'>('announcement');
  const [postTitle, setPostTitle] = useState('');
  const [postMessage, setPostMessage] = useState('');
  const [postExpiry, setPostExpiry] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Form State - Thought of the day
  const [thoughtDate, setThoughtDate] = useState(new Date().toISOString().split('T')[0]);
  const [thoughtText, setThoughtText] = useState('');
  const [thoughtAuthor, setThoughtAuthor] = useState('');
  const [isSavingThought, setIsSavingThought] = useState(false);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [feedData, bdayData, thoughtData] = await Promise.all([
        api.get<FeedItem[]>('/notifications/feed').catch(() => []),
        api.get<BirthdayItem[]>('/notifications/birthdays').catch(() => []),
        api.get<ThoughtItem | null>('/notifications/thought').catch(() => null),
      ]);

      setFeed(feedData || []);
      setBirthdays(bdayData || []);
      setThought(thoughtData);
    } catch (err) {
      console.error('Failed to load notifications data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [activeCompany]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setFeed((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postMessage.trim()) return;

    setIsPosting(true);
    try {
      await api.post('/notifications/feed', {
        type: postType,
        title: postTitle.trim(),
        message: postMessage.trim(),
        expires_at: postExpiry ? `${postExpiry}T23:59:59` : null,
      });

      setShowPostModal(false);
      setPostTitle('');
      setPostMessage('');
      setPostExpiry('');
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to post announcement');
    } finally {
      setIsPosting(false);
    }
  };

  const handleSaveThought = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thoughtText.trim()) return;

    setIsSavingThought(true);
    try {
      await api.post('/notifications/thought', {
        date: thoughtDate,
        thought: thoughtText.trim(),
        author: thoughtAuthor.trim() || null,
      });

      setShowThoughtModal(false);
      setThoughtText('');
      setThoughtAuthor('');
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to save thought of the day');
    } finally {
      setIsSavingThought(false);
    }
  };

  const handleSendBirthdayGreetings = async () => {
    const todayBirthdays = birthdays.filter((b) => b.is_today);
    if (!todayBirthdays.length) {
      alert('No birthdays today!');
      return;
    }

    try {
      for (const b of todayBirthdays) {
        await api.post('/notifications/feed', {
          type: 'birthday',
          title: 'Happy Birthday! 🎂',
          message: `Wishing ${b.employee_name} a very Happy Birthday! May this special day bring you great success, joy, and happiness! 🎉`,
        });
      }
      alert(`Birthday greetings posted for: ${todayBirthdays.map((b) => b.employee_name).join(', ')}`);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to send greetings');
    }
  };

  // Helper for border and icon styling
  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'birthday':
        return {
          border: 'border-l-amber-500',
          iconColor: 'text-amber-500',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Cake,
        };
      case 'announcement':
        return {
          border: 'border-l-blue-500',
          iconColor: 'text-blue-500',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: Megaphone,
        };
      case 'alert':
        return {
          border: 'border-l-rose-500',
          iconColor: 'text-rose-500',
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: AlertTriangle,
        };
      case 'info':
        return {
          border: 'border-l-emerald-500',
          iconColor: 'text-emerald-500',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Info,
        };
      default:
        return {
          border: 'border-l-purple-500',
          iconColor: 'text-purple-500',
          badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: Bell,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-emerald-600" />
            <span>Notifications &amp; Feed</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Announcements, thought of the day &amp; birthday greetings for Superbee Aeronautics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LIVE FEED
          </span>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Thought + Feed */}
        <div className="lg:col-span-8 space-y-4">
          {/* Thought of the Day Card */}
          <div
            className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d4a6a 100%)' }}
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0 text-amber-300 backdrop-blur-sm border border-white/10">
                <Lightbulb className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-amber-300">
                    Thought of the Day
                  </span>
                  {thought?.date && (
                    <span className="text-[10px] text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                      {thought.date}
                    </span>
                  )}
                </div>

                {thought?.thought ? (
                  <>
                    <p className="text-sm font-medium italic text-slate-100 leading-relaxed">
                      "{thought.thought}"
                    </p>
                    {thought.author && (
                      <p className="text-xs text-amber-200/90 font-semibold mt-2 text-right">
                        — {thought.author}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300">No thought of the day set for today.</p>
                    <button
                      onClick={() => setShowThoughtModal(true)}
                      className="rounded-xl bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm transition"
                    >
                      Set Today's Thought
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Feed Header */}
          <div className="flex items-center justify-between pt-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Live Organization Feed</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPostModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
              >
                <Megaphone className="h-3.5 w-3.5" />
                <span>Post Announcement</span>
              </button>

              <button
                onClick={loadAll}
                title="Refresh feed"
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition shadow-sm"
              >
                <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Feed Cards Container */}
          <div className="space-y-3">
            {feed.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 shadow-sm">
                <BellOff className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No notifications or announcements yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "Post Announcement" to broadcast news, alerts, or greetings to all employees.
                </p>
              </div>
            ) : (
              feed.map((item) => {
                const style = getTypeStyles(item.type);
                const TypeIcon = style.icon;
                const formattedDate = new Date(item.created_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all border-l-4 ${
                      style.border
                    } ${item.is_read ? 'opacity-60 bg-slate-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`p-2 rounded-xl bg-slate-100 ${style.iconColor} flex-shrink-0`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-bold text-slate-900 leading-snug">
                            {item.title}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                            {formattedDate}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                          {item.message}
                        </p>
                      </div>

                      {!item.is_read && (
                        <button
                          onClick={() => handleMarkRead(item.id)}
                          title="Mark as read"
                          className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sidebar (4 cols): Birthdays & Quick Actions */}
        <div className="lg:col-span-4 space-y-5">
          {/* Upcoming Birthdays Strip */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-3">
              <Cake className="h-4 w-4 text-amber-500" />
              <span>Upcoming Birthdays (30 days)</span>
            </div>

            <div className="space-y-2">
              {birthdays.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  No birthdays in the next 30 days.
                </div>
              ) : (
                birthdays.map((b) => (
                  <div
                    key={b.employee_id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{b.is_today ? '🎂' : '🎈'}</span>
                      <span className="font-semibold text-slate-800 truncate">
                        {b.employee_name}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        b.is_today
                          ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {b.is_today ? 'Today!' : `${b.days_until} ${b.days_until === 1 ? 'day' : 'days'}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-3">
              <Sliders className="h-4 w-4 text-slate-600" />
              <span>Quick Actions</span>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => setShowThoughtModal(true)}
                className="w-full flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 p-2.5 text-xs font-semibold text-blue-700 transition"
              >
                <Lightbulb className="h-4 w-4 text-blue-600" />
                <span>Set Thought of the Day</span>
              </button>

              <button
                onClick={handleSendBirthdayGreetings}
                className="w-full flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 p-2.5 text-xs font-semibold text-emerald-700 transition"
              >
                <Cake className="h-4 w-4 text-emerald-600" />
                <span>Send Birthday Greetings</span>
              </button>

              <button
                onClick={() => setShowPostModal(true)}
                className="w-full flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 p-2.5 text-xs font-semibold text-slate-700 transition"
              >
                <Megaphone className="h-4 w-4 text-slate-600" />
                <span>Post Announcement</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Post Announcement */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Post Announcement</h3>
              </div>
              <button
                onClick={() => setShowPostModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePostAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Type</label>
                <select
                  value={postType}
                  onChange={(e: any) => setPostType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 font-medium"
                >
                  <option value="announcement">📢 Announcement</option>
                  <option value="info">ℹ️ Information</option>
                  <option value="alert">⚠️ Alert</option>
                  <option value="birthday">🎂 Birthday</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office closed on Monday"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write your announcement or message here..."
                  value={postMessage}
                  onChange={(e) => setPostMessage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expires On (optional)</label>
                <input
                  type="date"
                  value={postExpiry}
                  onChange={(e) => setPostExpiry(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="rounded-xl px-4 py-2 text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPosting}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-white font-semibold hover:bg-blue-500 transition shadow-sm disabled:opacity-50"
                >
                  {isPosting ? 'Posting...' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Set Thought of the Day */}
      {showThoughtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Set Thought of the Day</h3>
              </div>
              <button
                onClick={() => setShowThoughtModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveThought} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={thoughtDate}
                  onChange={(e) => setThoughtDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inspiring Thought *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Innovation distinguishes between a leader and a follower."
                  value={thoughtText}
                  onChange={(e) => setThoughtText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Author (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Steve Jobs"
                  value={thoughtAuthor}
                  onChange={(e) => setThoughtAuthor(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowThoughtModal(false)}
                  className="rounded-xl px-4 py-2 text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingThought}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-white font-semibold hover:bg-emerald-500 transition shadow-sm disabled:opacity-50"
                >
                  {isSavingThought ? 'Saving...' : 'Save Thought'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
