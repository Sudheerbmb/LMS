import React, { useState, useEffect } from 'react'
import type { User, Notification as LMSNotification } from '../lib/api'
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  flushAllNotifications
} from '../lib/api'
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
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Flame,
  Layers,
  GraduationCap
} from 'lucide-react'

type SidebarProps = {
  user: User
  notifications: LMSNotification[]
  currentTab: string
  setCurrentTab: (tab: string) => void
  onRefreshNotifications?: () => void
  onLogout: () => void
}

const ROLE_CONFIG: Record<string, { label: string; badgeBg: string; badgeText: string; border: string; glow: string }> = {
  admin: {
    label: 'Administrator',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
  teacher: {
    label: 'Faculty Member',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-400',
    border: 'border-orange-500/30',
    glow: 'rgba(234, 88, 12, 0.25)',
  },
  student: {
    label: 'Student Scholar',
    badgeBg: 'bg-yellow-500/15',
    badgeText: 'text-yellow-300',
    border: 'border-yellow-500/30',
    glow: 'rgba(234, 179, 8, 0.25)',
  },
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  notifications: initialNotifications,
  currentTab,
  setCurrentTab,
  onRefreshNotifications,
  onLogout,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [localNotifications, setLocalNotifications] = useState<LMSNotification[]>(initialNotifications)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
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
      ? 'Live Training'
      : user.role === 'admin'
      ? 'Live Classrooms'
      : 'Live Classes'

  const mainNavItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses', label: coursesLabel, icon: BookOpen },
    { id: 'classroom', label: liveSessionLabel, icon: Video },
    { id: 'timetable', label: timetableLabel, icon: CalendarDays },
  ]

  const toolNavItems = [
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

  return (
    <>
      <aside
        className={`h-screen sticky top-0 flex flex-col bg-[#0A0E24]/90 backdrop-blur-2xl border-r border-indigo-500/20 shadow-2xl transition-all duration-300 z-40 select-none ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-indigo-500/20 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-violet-600 flex items-center justify-center text-white font-black shadow-lg shadow-cyan-500/25 shrink-0">
              <Flame className="w-5 h-5 fill-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black tracking-tight text-white truncate bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                    Acharya LMS
                  </span>
                  <Sparkles className="w-3 h-3 text-cyan-400 shrink-0 animate-pulse" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border w-fit mt-0.5 ${roleCfg.badgeBg} ${roleCfg.badgeText} ${roleCfg.border}`}>
                  {user.role}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 border border-transparent hover:border-indigo-500/30 transition cursor-pointer shrink-0"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {/* Main Academics */}
          <div className="space-y-1.5">
            {!collapsed && (
              <p className="px-3 text-[10px] font-extrabold text-cyan-400/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>Academic Modules</span>
              </p>
            )}
            {mainNavItems.map((item) => {
              const Icon = item.icon
              const isActive = currentTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group relative border ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 text-white border-cyan-400/40 shadow-lg shadow-cyan-500/25 font-black'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900/90 border-transparent hover:border-indigo-500/30'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-cyan-400 group-hover:text-cyan-300'}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {isActive && !collapsed && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9] animate-pulse" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Tools & Workspace */}
          {toolNavItems.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-indigo-500/20">
              {!collapsed && (
                <p className="px-3 text-[10px] font-extrabold text-violet-400/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <GraduationCap className="w-3 h-3 text-violet-400" />
                  <span>Interactive Tools</span>
                </p>
              )}
              {toolNavItems.map((item) => {
                const Icon = item.icon
                const isActive = currentTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer group relative border ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 text-white border-cyan-400/40 shadow-lg shadow-cyan-500/25 font-black'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900/90 border-transparent hover:border-indigo-500/30'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-violet-400 group-hover:text-violet-300'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {isActive && !collapsed && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9] animate-pulse" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* User Profile & Actions Footer */}
        <div className="p-3 border-t border-amber-500/15 bg-slate-950/60 flex flex-col gap-2">
          {/* Notification Button */}
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition cursor-pointer relative ${
              showNotifs ? 'bg-slate-900 border-amber-500/40 text-amber-400' : ''
            }`}
            title="Notifications"
          >
            <div className="relative shrink-0">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="truncate">
                {unreadCount > 0 ? `${unreadCount} Unread Alerts` : 'Notifications'}
              </span>
            )}
          </button>

          {/* User Profile Card */}
          <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-black text-xs shrink-0 shadow-md">
                {(user.display_name || user.email || 'U')[0].toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white truncate">
                    {user.display_name || 'Academic User'}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {roleCfg.label}
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Notification Drawer Modal */}
      {showNotifs && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-start p-4 md:pl-20 animate-in fade-in duration-200">
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {localNotifications.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllRead}
                      disabled={actionLoading || unreadCount === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition disabled:opacity-40 cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleFlushAll}
                      disabled={actionLoading}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition disabled:opacity-40 cursor-pointer"
                      title="Clear all notifications"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowNotifs(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {localNotifications.length === 0 ? (
                <div className="text-center py-10">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold text-slate-400">No notifications yet</p>
                  <p className="text-[10px] text-slate-500">We'll alert you on important schedule & class updates.</p>
                </div>
              ) : (
                localNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (!n.read_at) {
                        setLocalNotifications((prev) =>
                          prev.map((item) => (item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item))
                        )
                        await markNotificationRead(n.id)
                        onRefreshNotifications?.()
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      !n.read_at
                        ? 'bg-slate-900 border-amber-500/30 shadow-md shadow-amber-500/5'
                        : 'bg-slate-950/60 border-slate-800/80 opacity-70'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <p className="text-xs font-bold text-white">{n.title}</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{n.body}</p>
                      <p className="text-[9px] text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSingle(e, n.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
