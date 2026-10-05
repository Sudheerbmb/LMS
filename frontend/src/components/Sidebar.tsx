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
    ...(user.role === 'student' ? [{ id: 'certificates', label: 'Certificates', icon: Award }] : []),
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
        style={{ overflow: collapsed ? 'hidden' : 'visible' }}
      >
        <Icon
          style={{
            width: 16, height: 16, flexShrink: 0,
            color: isActive ? 'var(--saffron)' : 'var(--ink-3)'
          }}
        />
        {!collapsed && (
          <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
        style={{ justifyContent: 'space-between' }}
      >
        {/* ── Brand Header ── */}
        <div style={{ padding: '20px 14px 12px', borderBottom: '1px solid var(--nav-border)' }}>
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
                background: 'linear-gradient(135deg, #E8820C 0%, #F59E0B 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(232,130,12,0.3)'
              }}>
                <Flame style={{ width: 18, height: 18, color: 'white' }} />
              </div>
              {!collapsed && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800, color: 'var(--ink)',
                    letterSpacing: '-0.02em', lineHeight: 1.2,
                    whiteSpace: 'nowrap'
                  }}>
                    Acharya
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--saffron)',
                    letterSpacing: '0.05em', textTransform: 'uppercase'
                  }}>
                    {user.role === 'admin' ? 'Admin Console' : user.role === 'teacher' ? 'Teaching Studio' : 'Learning Portal'}
                  </div>
                </div>
              )}
            </button>

            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                background: 'var(--surface-2)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--ink-3)'
              }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed
                ? <ChevronRight style={{ width: 13, height: 13 }} />
                : <ChevronLeft  style={{ width: 13, height: 13 }} />
              }
            </button>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {/* Learn group */}
          {!collapsed && <div className="nav-section-label">Learn</div>}
          {collapsed && <div style={{ height: 12 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {learnGroup.map(item => <NavItem key={item.id} item={item} />)}
          </div>

          {/* Practice group */}
          {practiceGroup.length > 0 && (
            <>
              {!collapsed
                ? <div className="nav-section-label" style={{ marginTop: 20 }}>Practice</div>
                : <div style={{ height: 16, borderTop: '1px solid var(--border)', margin: '12px 4px' }} />
              }
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {practiceGroup.map(item => <NavItem key={item.id} item={item} />)}
              </div>
            </>
          )}

          {/* Progress / Admin group */}
          {progressGroup.length > 0 && (
            <>
              {!collapsed
                ? <div className="nav-section-label" style={{ marginTop: 20 }}>Progress</div>
                : <div style={{ height: 16, borderTop: '1px solid var(--border)', margin: '12px 4px' }} />
              }
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {progressGroup.map(item => <NavItem key={item.id} item={item} />)}
              </div>
            </>
          )}

          {/* AI Copilot shortcut */}
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #FFF8EE 0%, #FFFDF8 100%)',
                border: '1px solid rgba(232, 130, 12, 0.2)',
                borderRadius: 10, padding: collapsed ? '10px 8px' : '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'default'
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #F59E0B, #E8820C)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Sparkles style={{ width: 14, height: 14, color: 'white' }} />
              </div>
              {!collapsed && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--saffron-d)', letterSpacing: '0.02em' }}>
                    Ask Acharya
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>AI Learning Assistant</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer: Notifications + Profile ── */}
        <div style={{ padding: '10px', borderTop: '1px solid var(--nav-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Notification */}
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 9, border: 'none',
              background: showNotifs ? 'var(--saffron-bg)' : 'transparent',
              cursor: 'pointer', color: 'var(--ink-3)', width: '100%',
              transition: 'background 0.15s ease'
            }}
            title="Notifications"
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Bell style={{ width: 16, height: 16 }} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 15, height: 15, borderRadius: '50%',
                  background: '#EF4444', color: 'white',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {!collapsed && (
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {unreadCount > 0 ? `${unreadCount} new` : 'Notifications'}
              </span>
            )}
          </button>

          {/* Profile */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 9, background: 'var(--surface-2)'
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #E8820C, #F59E0B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 11, fontWeight: 800
            }}>
              {(user.display_name || user.email || 'U')[0].toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.display_name || 'User'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'capitalize' }}>
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  style={{
                    padding: 4, borderRadius: 6, border: 'none',
                    background: 'none', cursor: 'pointer', color: 'var(--ink-muted)',
                    display: 'flex', alignItems: 'center', flexShrink: 0
                  }}
                  title="Sign Out"
                >
                  <LogOut style={{ width: 13, height: 13 }} />
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
