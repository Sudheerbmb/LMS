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
  Users,
  Bell,
  X,
  Trash2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Flame
} from 'lucide-react'

type SidebarProps = {
  user: User
  notifications: LMSNotification[]
  currentTab: string
  setCurrentTab: (tab: string) => void
  onRefreshNotifications?: () => void
  onLogout: () => void
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

  // Dynamic labels per role
  const timetableLabel = user.role === 'admin' ? 'Timetable Engine' : user.role === 'teacher' ? 'My Schedule' : 'Timetable'
  const coursesLabel   = user.role === 'teacher' ? 'My Courses' : user.role === 'admin' ? 'Courses' : 'My Courses'
  const classroomLabel = user.role === 'teacher' ? 'Live Training' : user.role === 'admin' ? 'Live Classrooms' : 'Live Classes'

  const learnGroup = [
    { id: 'overview',   label: 'Home',         icon: LayoutDashboard },
    { id: 'courses',    label: coursesLabel,    icon: BookOpen },
    { id: 'classroom',  label: classroomLabel,  icon: Video },
    { id: 'timetable',  label: timetableLabel,  icon: CalendarDays },
  ]

  const practiceGroup = [
    ...(user.role !== 'admin' ? [{ id: 'coding',       label: 'Coding Playground', icon: Code2 }] : []),
    ...(user.role !== 'admin' ? [{ id: 'assignments',   label: 'Assignments',       icon: FileText }] : []),
    ...(user.role !== 'admin' ? [{ id: 'assessments',   label: 'Assessments',       icon: CheckSquare }] : []),
  ]

  const progressGroup = [
    ...(user.role === 'admin'   ? [{ id: 'admin',         label: 'Institute Admin', icon: Users }] : []),
  ]

  const handleDeleteSingle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      setLocalNotifications(prev => prev.filter(n => n.id !== id))
      await deleteNotification(id)
      onRefreshNotifications?.()
    } catch (err) { console.error(err) }
  }

  const handleMarkAllRead = async () => {
    setActionLoading(true)
    try {
      await markAllNotificationsRead()
      setLocalNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
      onRefreshNotifications?.()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const handleFlushAll = async () => {
    if (!window.confirm('Delete all notifications?')) return
    setActionLoading(true)
    try {
      await flushAllNotifications()
      setLocalNotifications([])
      onRefreshNotifications?.()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const NavItem = ({ item }: { item: { id: string; label: string; icon: React.ElementType } }) => {
    const Icon = item.icon
    const isActive = currentTab === item.id
    return (
      <button
        onClick={() => setCurrentTab(item.id)}
        className={`nav-item ${isActive ? 'active' : ''}`}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '9px 12px',
          borderRadius: 10,
          border: 'none',
          background: isActive ? '#FFF3EA' : 'transparent',
          color: isActive ? '#FF7A18' : '#64748B',
          fontWeight: isActive ? 600 : 500,
          fontSize: 13,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          transition: 'all 0.15s ease',
          position: 'relative',
          overflow: collapsed ? 'hidden' : 'visible'
        }}
      >
        {isActive && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '15%',
              bottom: '15%',
              width: 3,
              borderRadius: '0 4px 4px 0',
              background: '#FF7A18'
            }}
          />
        )}
        <Icon
          style={{
            width: 17,
            height: 17,
            flexShrink: 0,
            color: isActive ? '#FF7A18' : '#64748B'
          }}
        />
        {!collapsed && (
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </span>
        )}
      </button>
    )
  }

  return (
    <>
      <aside
        className={`nav-rail ${collapsed ? 'collapsed' : ''}`}
        style={{
          width: collapsed ? 72 : 240,
          minWidth: collapsed ? 72 : 240,
          background: '#FAFAF8',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'width 0.2s ease',
          zIndex: 40
        }}
      >
        {/* ── Brand Header ── */}
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button
              onClick={() => setCurrentTab('overview')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, overflow: 'hidden', flexShrink: 1, minWidth: 0
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #FF7A18 0%, #FF9E40 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(255,122,24,0.3)'
              }}>
                <Flame style={{ width: 18, height: 18, color: 'white' }} />
              </div>
              {!collapsed && (
                <div style={{ minWidth: 0, overflow: 'hidden', textAlign: 'left' }}>
                  <div style={{
                    fontSize: 15, fontWeight: 800, color: '#111827',
                    letterSpacing: '-0.02em', lineHeight: 1.15,
                    whiteSpace: 'nowrap'
                  }}>
                    Acharya
                  </div>
                  <div style={{
                    fontSize: 9.5, fontWeight: 700, color: '#94A3B8',
                    letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1
                  }}>
                    LEARNING OS
                  </div>
                </div>
              )}
            </button>

            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(0,0,0,0.08)',
                background: 'white', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#64748B'
              }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed
                ? <ChevronRight style={{ width: 12, height: 12 }} />
                : <ChevronLeft  style={{ width: 12, height: 12 }} />
              }
            </button>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          {/* Learn group */}
          {!collapsed && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px 8px' }}>
              LEARN
            </div>
          )}
          {collapsed && <div style={{ height: 8 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {learnGroup.map(item => <NavItem key={item.id} item={item} />)}
          </div>

          {/* Practice group */}
          {practiceGroup.length > 0 && (
            <>
              {!collapsed ? (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '16px 10px 8px' }}>
                  PRACTICE
                </div>
              ) : (
                <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '12px 4px' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {practiceGroup.map(item => <NavItem key={item.id} item={item} />)}
              </div>
            </>
          )}

          {/* Progress / Manage group */}
          {progressGroup.length > 0 && (
            <>
              {!collapsed ? (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '16px 10px 8px' }}>
                  MANAGE
                </div>
              ) : (
                <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '12px 4px' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {progressGroup.map(item => <NavItem key={item.id} item={item} />)}
              </div>
            </>
          )}

          {/* AI Copilot shortcut card */}
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #F5EEFF 0%, #EDE5FF 100%)',
                border: '1px solid rgba(139, 92, 246, 0.18)',
                borderRadius: 12, padding: collapsed ? '10px 8px' : '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
              }}>
                <Sparkles style={{ width: 14, height: 14, color: 'white' }} />
              </div>
              {!collapsed && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6D28D9', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Ask Acharya <span style={{ color: '#FF7A18', fontSize: 10 }}>✦</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#7C3AED', opacity: 0.85 }}>Your AI Learning Assistant</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer: Notifications + Profile ── */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Notification */}
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 10, border: 'none',
              background: showNotifs ? '#FFF3EA' : 'transparent',
              cursor: 'pointer', color: '#64748B', width: '100%',
              transition: 'background 0.15s ease'
            }}
            title="Notifications"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bell style={{ width: 16, height: 16, color: '#64748B' }} />
              {!collapsed && (
                <span style={{ fontSize: 12.5, fontWeight: 500, color: '#475569' }}>
                  Notifications
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <span style={{
                padding: '2px 6px', borderRadius: 10,
                background: '#FF7A18', color: 'white',
                fontSize: 10, fontWeight: 700
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10, background: 'transparent',
              cursor: 'pointer', transition: 'background 0.15s ease'
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #FF7A18 0%, #FF9E40 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 13, fontWeight: 800,
              boxShadow: '0 2px 6px rgba(255,122,24,0.25)'
            }}>
              {(user.display_name || user.email || 'S')[0].toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.display_name || (user.role === 'admin' ? 'System Admin' : 'User')}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'capitalize' }}>
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  style={{
                    padding: 4, borderRadius: 6, border: 'none',
                    background: 'none', cursor: 'pointer', color: '#94A3B8',
                    display: 'flex', alignItems: 'center', flexShrink: 0
                  }}
                  title="Sign Out"
                >
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Notification Drawer ── */}
      {showNotifs && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowNotifs(false)}
        >
          <div
            style={{
              position: 'absolute', left: collapsed ? 76 : 228, top: 16, bottom: 16,
              width: 360, background: 'white',
              borderRadius: 16, boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell style={{ width: 16, height: 16, color: 'var(--saffron)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Notifications</span>
                {unreadCount > 0 && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 99,
                    background: 'var(--saffron-bg)', color: 'var(--saffron-d)',
                    fontSize: 11, fontWeight: 700
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {localNotifications.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllRead} disabled={actionLoading}
                      style={{ fontSize: 11, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                      <CheckCheck style={{ width: 12, height: 12 }} /> Read all
                    </button>
                    <button
                      onClick={handleFlushAll} disabled={actionLoading}
                      style={{ fontSize: 11, fontWeight: 600, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} /> Clear
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowNotifs(false)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
              {localNotifications.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <Bell style={{ width: 32, height: 32, color: 'var(--ink-muted)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>No notifications</p>
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    Class updates and announcements will appear here.
                  </p>
                </div>
              ) : (
                localNotifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={async () => {
                      if (!notif.read_at) {
                        try {
                          await markNotificationRead(notif.id)
                          setLocalNotifications(prev =>
                            prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n)
                          )
                          onRefreshNotifications?.()
                        } catch (err) { console.error(err) }
                      }
                    }}
                    style={{
                      padding: '12px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 4,
                      background: !notif.read_at ? 'var(--saffron-bg)' : 'transparent',
                      border: !notif.read_at ? '1px solid rgba(232,130,12,0.15)' : '1px solid transparent',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        {!notif.read_at && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--saffron)', flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notif.title}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {notif.body}
                      </p>
                      <span style={{ fontSize: 10, color: 'var(--ink-muted)', display: 'block', marginTop: 4 }}>
                        {new Date(notif.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button
                      onClick={e => handleDeleteSingle(e, notif.id)}
                      style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-muted)', flexShrink: 0 }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
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
