import React, { useState } from 'react'
import type { User, Notification as LMSNotification } from '../lib/api'
import { markNotificationRead, markAllNotificationsRead, deleteNotification, flushAllNotifications } from '../lib/api'
import { Bell, X, ChevronDown, Trash2, CheckCheck } from 'lucide-react'

type HeaderProps = {
  user: User
  notifications: LMSNotification[]
  onRefreshNotifications?: () => void
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:   { bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', text: '#ffffff', border: 'rgba(245,158,11,0.5)' },
  teacher: { bg: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)', text: '#ffffff', border: 'rgba(234,88,12,0.5)' },
  student: { bg: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)', text: '#0F172A', border: 'rgba(251,191,36,0.6)' },
}

const ROLE_LABELS: Record<string, string> = {
  admin:   'Administrator',
  teacher: 'Faculty',
  student: 'Student',
}

export const Header: React.FC<HeaderProps> = ({ user, notifications: initialNotifications, onRefreshNotifications }) => {
  const [showNotifs, setShowNotifs] = useState(false)
  const [localNotifications, setLocalNotifications] = useState<LMSNotification[]>(initialNotifications)
  const [actionLoading, setActionLoading] = useState(false)

  // Keep local in sync with props
  React.useEffect(() => {
    setLocalNotifications(initialNotifications)
  }, [initialNotifications])

  const unreadCount = localNotifications.filter((n) => !n.read_at).length
  const roleColor = ROLE_COLORS[user.role] ?? ROLE_COLORS.student
  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  const handleDeleteSingle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      setLocalNotifications(prev => prev.filter(n => n.id !== id))
      await deleteNotification(id)
      onRefreshNotifications?.()
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const handleFlushAll = async () => {
    try {
      setActionLoading(true)
      setLocalNotifications([])
      await flushAllNotifications()
      onRefreshNotifications?.()
    } catch (err) {
      console.error('Failed to flush notifications:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      setActionLoading(true)
      setLocalNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
      await markAllNotificationsRead()
      onRefreshNotifications?.()
    } catch (err) {
      console.error('Failed to mark all read:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkSingleRead = async (id: string) => {
    try {
      setLocalNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      await markNotificationRead(id)
      onRefreshNotifications?.()
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  return (
    <header
      className="h-16 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30 select-none"
      style={{
        background: '#06080F',
        borderBottom: '1px solid rgba(245, 158, 11, 0.12)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Left: breadcrumb ───────────────────── */}
      <div className="flex items-center gap-2.5">
        <span
          className="text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-md"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.35)' }}
        >
          Acharya LMS
        </span>
        <span style={{ color: 'rgba(245,158,11,0.4)', fontSize: '0.875rem' }}>›</span>
        <span
          className="text-xs sm:text-sm font-bold capitalize text-white flex items-center gap-1.5"
        >
          {ROLE_LABELS[user.role] ?? user.role} Workspace
        </span>
      </div>

      {/* ── Right: actions ─────────────────────── */}
      <div className="flex items-center gap-3.5">

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all"
            style={{
              background: showNotifs ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)',
              border: showNotifs ? '1px solid rgba(245,158,11,0.45)' : '1px solid rgba(255,255,255,0.08)',
              color: showNotifs ? '#FDE68A' : '#CBD5E1',
              cursor: 'pointer',
            }}
            title="Notifications"
          >
            <Bell style={{ width: 16, height: 16 }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-white font-extrabold shadow-sm"
                style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)', fontSize: '0.6rem' }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifs && (
            <div
              className="absolute right-0 mt-2 w-84 sm:w-96 rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{
                background: '#111726',
                border: '1px solid rgba(245,158,11,0.25)',
                boxShadow: '0 10px 35px rgba(0,0,0,0.8)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid rgba(245,158,11,0.15)', background: '#0B0F19' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Notifications
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-semibold">
                    {localNotifications.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {localNotifications.length > 0 && (
                    <>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          disabled={actionLoading}
                          className="px-2 py-1 text-[10px] font-bold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 rounded-md border border-amber-500/20 flex items-center gap-1 transition-all"
                          title="Mark all as read"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Read All</span>
                        </button>
                      )}
                      <button
                        onClick={handleFlushAll}
                        disabled={actionLoading}
                        className="px-2 py-1 text-[10px] font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 rounded-md border border-rose-500/20 flex items-center gap-1 transition-all"
                        title="Flush all notifications"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Flush All</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowNotifs(false)}
                    style={{ color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto py-1">
                {localNotifications.length === 0 ? (
                  <div className="text-xs text-center py-8 text-slate-400">
                    <Bell className="w-6 h-6 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="font-semibold text-slate-300">All caught up!</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">No notifications available</p>
                  </div>
                ) : (
                  localNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read_at && handleMarkSingleRead(n.id)}
                      className={`px-4 py-3 flex items-start justify-between gap-3 transition-colors group cursor-pointer ${
                        n.read_at ? 'hover:bg-white/[0.02]' : 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                      }`}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{
                            background: n.read_at ? 'rgba(255,255,255,0.2)' : '#F59E0B',
                            boxShadow: n.read_at ? 'none' : '0 0 8px #F59E0B',
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs ${n.read_at ? 'font-medium text-slate-300' : 'font-bold text-white'}`}>
                            {n.title}
                          </p>
                          <p className="text-[11px] mt-0.5 text-slate-400 leading-relaxed break-words">
                            {n.body}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSingle(e, n.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px" style={{ background: 'rgba(245,158,11,0.15)' }} />

        {/* User Pill */}
        <div
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors cursor-default"
          style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs select-none shadow-sm"
            style={{ background: roleColor.bg, color: roleColor.text, border: `1px solid ${roleColor.border}` }}
          >
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold leading-tight text-white">
              {user.display_name}
            </p>
            <p className="text-[10px] leading-tight text-amber-400/80 font-medium">
              {roleLabel}
            </p>
          </div>
          <ChevronDown style={{ width: 13, height: 13, color: '#F59E0B' }} />
        </div>
      </div>
    </header>
  )
}
