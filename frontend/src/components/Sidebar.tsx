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

const ROLE_CONFIG: Record<string, { label: string; badgeBg: string; badgeText: string; border: string }> = {
  admin: {
    label: 'Administrator',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    border: 'border-amber-200',
  },
  teacher: {
    label: 'Faculty Member',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-800',
    border: 'border-orange-200',
  },
  student: {
    label: 'Student Scholar',
    badgeBg: 'bg-yellow-50',
    badgeText: 'text-yellow-800',
    border: 'border-yellow-200',
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

  const handleMarkAllRead = async () => {
    setActionLoading(true)
    try {
      await markAllNotificationsRead()
      setLocalNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      )
      onRefreshNotifications?.()
    } catch (err) {
      console.error('Failed to mark notifications read:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleFlushAll = async () => {
    if (!window.confirm('Delete all notifications?')) return
    setActionLoading(true)
    try {
      await flushAllNotifications()
      setLocalNotifications([])
      onRefreshNotifications?.()
    } catch (err) {
      console.error('Failed to clear notifications:', err)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <aside
        className={`sticky top-0 h-screen bg-white border-r border-slate-200/80 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 select-none shadow-xs ${
          collapsed ? 'w-20' : 'w-60'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div
            onClick={() => setCurrentTab('overview')}
            className="flex items-center gap-3 cursor-pointer overflow-hidden group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              <Flame className="w-5 h-5 fill-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-tight text-slate-900 truncate">
                    Acharya LMS
                  </span>
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border w-fit mt-0.5 ${roleCfg.badgeBg} ${roleCfg.badgeText} ${roleCfg.border}`}>
                  {user.role}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {/* Main Academics */}
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group relative ${
                    isActive
                      ? 'bg-amber-50 text-amber-900 border border-amber-200/70 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {isActive && !collapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Tools & Workspace */}
          {toolNavItems.length > 0 && (
            <div className="space-y-1 pt-3 border-t border-slate-100">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <GraduationCap className="w-3 h-3" />
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group relative ${
                      isActive
                        ? 'bg-amber-50 text-amber-900 border border-amber-200/70 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {isActive && !collapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* User Profile & Actions Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex flex-col gap-2">
          {/* Notification Button */}
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200 transition cursor-pointer relative shadow-2xs ${
              showNotifs ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'bg-white'
            }`}
            title="Notifications"
          >
            <div className="relative shrink-0">
              <Bell className="w-4 h-4 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="truncate">
                {unreadCount > 0 ? `${unreadCount} Alerts` : 'Notifications'}
              </span>
            )}
          </button>

          {/* User Profile Card */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                {(user.display_name || user.email || 'U')[0].toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-800 truncate">
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
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-start p-4 md:pl-20 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {localNotifications.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllRead}
                      disabled={actionLoading}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Read All</span>
                    </button>
                    <button
                      onClick={handleFlushAll}
                      disabled={actionLoading}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
                      title="Clear all notifications"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowNotifs(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100">
              {localNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-500">No notifications yet</p>
                  <p className="text-[11px] text-slate-400">Class announcements, timetable alerts, and submissions will appear here.</p>
                </div>
              ) : (
                localNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={async () => {
                      if (!notif.read_at) {
                        try {
                          await markNotificationRead(notif.id)
                          setLocalNotifications((prev) =>
                            prev.map((n) =>
                              n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n
                            )
                          )
                          onRefreshNotifications?.()
                        } catch (err) {
                          console.error(err)
                        }
                      }
                    }}
                    className={`p-3 rounded-xl transition cursor-pointer flex items-start justify-between gap-3 ${
                      !notif.read_at ? 'bg-amber-50/60 border border-amber-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        {!notif.read_at && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                        <h4 className="text-xs font-bold text-slate-800 truncate">
                          {notif.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                        {notif.body}
                      </p>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(notif.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteSingle(e, notif.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md shrink-0 transition"
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
