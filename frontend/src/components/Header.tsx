import React, { useState } from 'react'
import type { User, Notification as LMSNotification } from '../lib/api'
import { markNotificationRead, markAllNotificationsRead, deleteNotification, flushAllNotifications } from '../lib/api'
import {
  LayoutDashboard,
  BookOpen,
  Video,
  CalendarDays,
  Code2,
  FileText,
  CheckSquare,
  Award,
  Users,
  Bell,
  X,
  Trash2,
  CheckCheck,
  LogOut
} from 'lucide-react'

type HeaderProps = {
  user: User
  notifications: LMSNotification[]
  currentTab: string
  setCurrentTab: (tab: string) => void
  onRefreshNotifications?: () => void
  onLogout: () => void
}

const ROLE_CONFIG: Record<string, { label: string; badgeBg: string; badgeText: string; border: string }> = {
  admin: {
    label: 'Administrator',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeText: '#F59E0B',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  teacher: {
    label: 'Faculty Portal',
    badgeBg: 'rgba(234, 88, 12, 0.15)',
    badgeText: '#FB923C',
    border: 'rgba(234, 88, 12, 0.35)',
  },
  student: {
    label: 'Student Workspace',
    badgeBg: 'rgba(251, 191, 36, 0.15)',
    badgeText: '#FDE047',
    border: 'rgba(251, 191, 36, 0.35)',
  },
}

export const Header: React.FC<HeaderProps> = ({
  user,
  notifications: initialNotifications,
  currentTab,
  setCurrentTab,
  onRefreshNotifications,
  onLogout,
}) => {
  const [showNotifs, setShowNotifs] = useState(false)
  const [localNotifications, setLocalNotifications] = useState<LMSNotification[]>(initialNotifications)
  const [actionLoading, setActionLoading] = useState(false)

  React.useEffect(() => {
    setLocalNotifications(initialNotifications)
  }, [initialNotifications])

  const unreadCount = localNotifications.filter((n) => !n.read_at).length
  const roleCfg = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.student

  const timetableLabel =
    user.role === 'admin'
      ? 'Timetable Engine'
      : user.role === 'teacher'
      ? 'Faculty Schedule'
      : 'Batch Timetable'

  const coursesLabel =
    user.role === 'teacher'
      ? 'Courses Handled'
      : user.role === 'admin'
      ? 'Courses & Subjects'
      : 'Courses & Roadmap'

  const liveSessionLabel =
    user.role === 'teacher'
      ? 'Live Training Sessions'
      : user.role === 'admin'
      ? 'Live Classrooms'
      : 'Live Interactive Classes'

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses', label: coursesLabel, icon: BookOpen },
    { id: 'classroom', label: liveSessionLabel, icon: Video },
    { id: 'timetable', label: timetableLabel, icon: CalendarDays },
    ...(user.role !== 'admin'
      ? [{ id: 'coding', label: 'Coding Playground', icon: Code2 }]
      : []),
    ...(user.role !== 'admin'
      ? [{ id: 'assignments', label: 'Assignments', icon: FileText }]
      : []),
    ...(user.role !== 'admin'
      ? [{ id: 'assessments', label: 'Assessments', icon: CheckSquare }]
      : []),
    ...(user.role === 'student'
      ? [{ id: 'certificates', label: 'Certificates', icon: Award }]
      : []),
    ...(user.role === 'admin'
      ? [{ id: 'admin', label: 'Institute Admin', icon: Users }]
      : []),
  ]

  const handleDeleteSingle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      setLocalNotifications((prev) => prev.filter((n) => n.id !== id))
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
      setLocalNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      )
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
      setLocalNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      )
      await markNotificationRead(id)
      onRefreshNotifications?.()
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  return (
    <header
      className="sticky top-0 z-40 select-none w-full"
      style={{
        background: '#06080F',
        borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      }}
    >
      <div className="w-full px-4 lg:px-6 flex items-center justify-between h-16 gap-3">
        {/* ── Left: Branding & Role ───────────────────── */}
        <div
          onClick={() => setCurrentTab('overview')}
          className="flex items-center gap-3 cursor-pointer shrink-0 group"
        >
          <div className="relative">
            <img
              src="/acharya_logo.png"
              alt="Acharya LMS"
              className="w-10 h-10 rounded-xl object-cover border border-amber-500/40 shadow-lg shadow-amber-500/20 group-hover:border-amber-400 transition-all"
            />
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#06080F]" title="Online" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-white tracking-tight group-hover:text-amber-400 transition-colors">
                Acharya LMS
              </span>
              <span
                className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md border"
                style={{
                  background: roleCfg.badgeBg,
                  color: roleCfg.badgeText,
                  borderColor: roleCfg.border,
                }}
              >
                {user.role}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {roleCfg.label}
            </p>
          </div>
        </div>

        {/* ── Center: Top Navigation Tabs ───────────────── */}
        <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-2 mx-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(234,88,12,0.2) 100%)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(245,158,11,0.4)'
                    : '1px solid transparent',
                  boxShadow: isActive ? '0 0 15px rgba(245,158,11,0.15)' : 'none',
                }}
              >
                <Icon
                  className="w-4 h-4"
                  style={{
                    color: isActive ? '#F59E0B' : 'currentColor',
                  }}
                />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* ── Right: Notifications, User, & Logout ──────── */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all"
              style={{
                background: showNotifs
                  ? 'rgba(245,158,11,0.18)'
                  : 'rgba(255,255,255,0.04)',
                border: showNotifs
                  ? '1px solid rgba(245,158,11,0.45)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: showNotifs ? '#FDE68A' : '#CBD5E1',
                cursor: 'pointer',
              }}
              title="System Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-slate-950 font-black shadow-sm"
                  style={{
                    background:
                      'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
                    fontSize: '0.62rem',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifs && (
              <div
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{
                  background: '#111726',
                  border: '1px solid rgba(245,158,11,0.25)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.85)',
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    borderBottom: '1px solid rgba(245,158,11,0.15)',
                    background: '#0B0F19',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Notifications
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
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
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto py-1">
                  {localNotifications.length === 0 ? (
                    <div className="text-xs text-center py-8 text-slate-400">
                      <Bell className="w-6 h-6 mx-auto text-slate-600 mb-2 opacity-50" />
                      <p className="font-semibold text-slate-300">
                        All caught up!
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        No notifications available
                      </p>
                    </div>
                  ) : (
                    localNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() =>
                          !n.read_at && handleMarkSingleRead(n.id)
                        }
                        className={`px-4 py-3 flex items-start justify-between gap-3 transition-colors group cursor-pointer ${
                          n.read_at
                            ? 'hover:bg-white/[0.02]'
                            : 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                        }`}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div
                            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                            style={{
                              background: n.read_at
                                ? 'rgba(255,255,255,0.2)'
                                : '#F59E0B',
                              boxShadow: n.read_at
                                ? 'none'
                                : '0 0 8px #F59E0B',
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs ${
                                n.read_at
                                  ? 'font-medium text-slate-300'
                                  : 'font-bold text-white'
                              }`}
                            >
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

          {/* User Profile Chip */}
          <div
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-colors cursor-default"
            style={{
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.18)',
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs select-none shadow-sm"
              style={{
                background:
                  user.role === 'admin'
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : user.role === 'teacher'
                    ? 'linear-gradient(135deg, #EA580C, #C2410C)'
                    : 'linear-gradient(135deg, #FBBF24, #F59E0B)',
                color: user.role === 'student' ? '#0F172A' : '#ffffff',
              }}
            >
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold leading-tight text-white max-w-[120px] truncate">
                {user.display_name}
              </p>
              <p className="text-[10px] leading-tight text-amber-400/90 font-semibold capitalize">
                {user.role}
              </p>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
