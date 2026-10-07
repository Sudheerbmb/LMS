import React, { useState, useEffect } from 'react'
import type { 
  User, 
  Notification, 
  DashboardSummary
} from './lib/api'
import { 
  getCurrentUser, 
  getDashboardSummary, 
  getNotifications, 
  login as loginApi, 
  register as registerApi
} from './lib/api'
import { Sidebar } from './components/Sidebar'
import { Search, Bell, ChevronDown } from 'lucide-react'
import { DashboardPage } from './pages/DashboardPage'
import { CoursesPage } from './pages/CoursesPage'
import { AssessmentsPage } from './pages/AssessmentsPage'
import { AssignmentsPage } from './pages/AssignmentsPage'
import { ClassroomPage } from './pages/ClassroomPage'
import { AdminPage } from './pages/AdminPage'
import { TimetablePage } from './pages/TimetablePage'



export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('lms_access_token'))
  const [user, setUser] = useState<User | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [currentTab, setCurrentTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authRole, setAuthRole] = useState<'student' | 'teacher'>('student')
  const [authError, setAuthError] = useState('')
  const [submittingAuth, setSubmittingAuth] = useState(false)

  useEffect(() => {
    if (token) {
      loadInitialData()
    } else {
      setLoading(false)
    }
  }, [token])

// Safeguard: Ensure Admin is redirected if on student/teacher specific tabs
  useEffect(() => {
    if (user?.role === 'admin' && (currentTab === 'assessments' || currentTab === 'assignments')) {
      setCurrentTab('overview')
    }
  }, [user?.role, currentTab])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      const summary = await getDashboardSummary()
      setDashboardSummary(summary)
      const notifs = await getNotifications()
      setNotifications(notifs || [])
    } catch (err) {
      console.error(err)
      handleLogout()
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setSubmittingAuth(true)
    try {
      if (authMode === 'login') {
        const res = await loginApi({ email: authEmail, password: authPassword })
        localStorage.setItem('lms_access_token', res.access_token)
        setToken(res.access_token)
      } else {
        if (authPassword !== authConfirmPassword) {
          setAuthError('Passwords do not match.')
          return
        }
        await registerApi({
          email: authEmail,
          password: authPassword,
          display_name: authName,
          phone_number: authPhone ? authPhone.trim() : undefined,
          role: authRole,
        })
        alert(`Registration submitted successfully! Your ${authRole === 'teacher' ? 'Faculty' : 'Student'} account is pending administrator approval.`)
        setAuthMode('login')
        setAuthPassword('')
        setAuthConfirmPassword('')
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.')
    } finally {
      setSubmittingAuth(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('lms_access_token')
    setToken(null)
    setUser(null)
    setDashboardSummary(null)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(0,0,0,0.06)', borderTopColor: '#E8820C', animation: 'spin 0.75s linear infinite', margin: '0 auto 20px', boxShadow: '0 4px 16px rgba(232,130,12,0.15)' }} />
          <div style={{ fontSize: 18, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, color: '#171717', marginBottom: 6 }}>Acharya</div>
          <p style={{ fontSize: 11, color: '#A3A3A3', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading your workspace...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user || !token) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(420px, 1fr)',
        background: 'var(--canvas)',
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* ── Left: Cinematic Visual Brand Environment ── */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          overflow: 'hidden',
          background: '#0D1117'
        }}>
          {/* Background Cinematic Image with Editorial Overlays */}
          <img
            src="/assets/hero-learning.jpg"
            alt="Acharya Intelligence"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.65,
              filter: 'saturate(1.1) brightness(0.95)'
            }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(13,17,23,0.4) 0%, rgba(13,17,23,0.75) 60%, rgba(13,17,23,0.95) 100%)'
          }} />

          {/* Top Brand Logo */}
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/acharya_logo.png"
              alt="Acharya LMS"
              style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
            />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Acharya
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--saffron-l)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Learning Operating System
              </div>
            </div>
          </div>

          {/* Editorial Brand Statement */}
          <div style={{ position: 'relative', zIndex: 10, maxWidth: 540 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 9999,
              background: 'rgba(255, 138, 0, 0.15)',
              border: '1px solid rgba(255, 181, 71, 0.3)',
              color: 'var(--saffron-l)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 18
            }}>
              <span>Next-Gen Education</span>
            </div>

            <h1 style={{
              margin: 0,
              marginBottom: 16,
              fontSize: 44,
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 400,
              lineHeight: 1.12,
              color: '#FFFFFF',
              letterSpacing: '-0.02em'
            }}>
              Learn with clarity.<br />
              <em style={{ fontStyle: 'italic', color: 'var(--saffron-l)' }}>Build with intelligence.</em>
            </h1>

            <p style={{
              margin: 0,
              fontSize: 15,
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: 1.65,
              fontWeight: 400
            }}>
              Acharya is your intelligent learning operating system for courses, live classrooms, automated assessments, and continuous mastery.
            </p>
          </div>

          {/* Footer Metadata */}
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}>
            <span>&copy; {new Date().getFullYear()} Acharya Learning OS</span>
            <span>Enterprise Edition • AI-Native</span>
          </div>
        </div>

        {/* ── Right: Floating Glass Authentication Panel ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 36px',
          background: 'var(--canvas)',
          overflowY: 'auto'
        }}>
          <div style={{
            width: '100%',
            maxWidth: 400,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-med)',
            borderRadius: 24,
            padding: '36px 32px',
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.08)'
          }}>
            {/* Form Header */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{
                margin: 0,
                marginBottom: 6,
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                {authMode === 'login' ? 'Sign in to workspace' : 'Create candidate account'}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {authMode === 'login'
                  ? 'Enter your institutional credentials to access courses and live labs.'
                  : 'Enroll in technical courses with personalized AI learning plans.'}
              </p>
            </div>

            {/* Error Message */}
            {authError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--danger)',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 18
              }}>
                {authError}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {authMode === 'register' && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border-med)',
                        background: 'white',
                        fontSize: 13,
                        color: 'var(--ink)',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="+91 98765 43210 (optional)"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border-med)',
                        background: 'white',
                        fontSize: 13,
                        color: 'var(--ink)',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Registering As Role *
                    </label>
                    <select
                      value={authRole}
                      onChange={(e) => setAuthRole(e.target.value as 'student' | 'teacher')}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border-med)',
                        background: 'white',
                        fontSize: 13,
                        color: 'var(--ink)',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher (Faculty)</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@domain.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border-med)',
                    background: 'white',
                    fontSize: 13,
                    color: 'var(--ink)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Password *
                  </label>
                  {authMode === 'login' && (
                    <span style={{ fontSize: 11, color: 'var(--saffron-d)', cursor: 'pointer', fontWeight: 600 }}>
                      Forgot?
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border-med)',
                    background: 'white',
                    fontSize: 13,
                    color: 'var(--ink)',
                    outline: 'none'
                  }}
                />
              </div>

              {authMode === 'register' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border-med)',
                      background: 'white',
                      fontSize: 13,
                      color: 'var(--ink)',
                      outline: 'none'
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submittingAuth}
                style={{
                  marginTop: 6,
                  padding: '12px 18px',
                  borderRadius: 12,
                  background: 'var(--ink)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 700,
                  border: 'none',
                  cursor: submittingAuth ? 'not-allowed' : 'pointer',
                  opacity: submittingAuth ? 0.6 : 1,
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                  transition: 'all 0.15s ease'
                }}
              >
                {submittingAuth ? 'Verifying...' : authMode === 'login' ? 'Sign in to Workspace' : `Register as ${authRole === 'teacher' ? 'Faculty' : 'Student'}`}
              </button>
            </form>

            {/* Toggle Mode */}
            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
              {authMode === 'login' ? "New candidate? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--saffron-d)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                {authMode === 'login' ? 'Create Account' : 'Sign in'}
              </button>
            </p>

            {/* Sample Login Accounts (1-Click Quick Fill) */}
            {authMode === 'login' && (
              <div style={{
                marginTop: 20,
                borderTop: '1px solid var(--border-med)',
                paddingTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ⚡ Sample Quick-Fill Accounts
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>1-Click Login</span>
                </div>

                {/* Faculty Group */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--saffron-d)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Faculty (Course Instructors)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('sarah.fullstack@institute.edu'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 10,
                        background: 'var(--canvas-warm)',
                        border: '1px solid var(--border-med)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      title="Dr. Sarah Connor - Full Stack Web Dev Faculty"
                    >
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>Dr. Sarah Connor</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>Full Stack Faculty</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAuthEmail('alan.genai@institute.edu'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 10,
                        background: 'var(--canvas-warm)',
                        border: '1px solid var(--border-med)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      title="Dr. Alan Turing - Generative AI & Deep Learning Faculty"
                    >
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>Dr. Alan Turing</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>Gen AI Faculty</span>
                    </button>
                  </div>
                </div>

                {/* Students Group */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Enrolled Scholars (Students)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('alex.student@institute.edu'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 10,
                        background: 'var(--canvas-warm)',
                        border: '1px solid var(--border-med)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      title="Alex Mercer - Student"
                    >
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>Alex Mercer</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>Full Stack Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAuthEmail('priya.student@institute.edu'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 10,
                        background: 'var(--canvas-warm)',
                        border: '1px solid var(--border-med)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      title="Priya Sharma - Student"
                    >
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>Priya Sharma</span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>Gen AI Student</span>
                    </button>
                  </div>
                </div>

                {/* System Admin */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Administration
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAuthEmail('admin@example.com'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 10,
                      background: 'var(--canvas-warm)',
                      border: '1px solid var(--border-med)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    title="System Admin - Full LMS Management"
                  >
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>System Admin</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>admin@example.com</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      data-role={user.role}
      style={{
        minHeight: '100vh', width: '100%',
        display: 'flex',
        background: 'var(--canvas)',
        color: 'var(--ink)',
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* ── Navigation Rail ── */}
      <Sidebar
        user={user}
        notifications={notifications}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onRefreshNotifications={async () => {
          const notifs = await getNotifications().catch(() => [])
          setNotifications(notifs || [])
        }}
        onLogout={handleLogout}
      />

      {/* ── Main Content Area with Header ── */}
      <div style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header Bar */}
        <header style={{
          height: 60,
          background: '#FAFAF8',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          gap: 20,
          flexShrink: 0
        }}>
          {/* Search Bar */}
          <div style={{ flex: 1, maxWidth: 540, position: 'relative' }}>
            <Search style={{ width: 15, height: 15, color: '#94A3B8', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search classes, recordings, or topics..."
              style={{
                width: '100%',
                padding: '8px 38px 8px 36px',
                borderRadius: 12,
                background: 'white',
                border: '1px solid rgba(0,0,0,0.08)',
                fontSize: 12.5,
                color: '#111827',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            />
            <div style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              padding: '2px 6px', borderRadius: 6, background: '#F1F5F9', border: '1px solid #E2E8F0',
              fontSize: 10, fontWeight: 700, color: '#64748B'
            }}>
              ⌘ K
            </div>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => {}}
              style={{
                position: 'relative', padding: 6, borderRadius: 8, background: 'none',
                border: 'none', cursor: 'pointer', color: '#64748B'
              }}
              title="Notifications"
            >
              <Bell style={{ width: 17, height: 17 }} />
              {notifications.some(n => !n.read_at) && (
                <span style={{
                  position: 'absolute', top: 5, right: 5, width: 7, height: 7,
                  borderRadius: '50%', background: '#EF4444'
                }} />
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, fontWeight: 800,
                boxShadow: '0 2px 6px rgba(139, 92, 246, 0.25)'
              }}>
                {(user.display_name || user.email || 'S')[0].toUpperCase()}
              </div>
              <ChevronDown style={{ width: 13, height: 13, color: '#64748B' }} />
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--canvas)' }}>
          {currentTab === 'overview' && (
            <DashboardPage user={user} summary={dashboardSummary} setCurrentTab={setCurrentTab} />
          )}
          {currentTab === 'courses' && <CoursesPage user={user} setCurrentTab={setCurrentTab} />}
          {currentTab === 'classroom' && <ClassroomPage user={user} />}
          {currentTab === 'timetable' && <TimetablePage user={user} />}
          {currentTab === 'assignments' && user.role !== 'admin' && <AssignmentsPage user={user} />}
          {currentTab === 'assessments' && user.role !== 'admin' && <AssessmentsPage user={user} />}
          {currentTab === 'admin' && user.role === 'admin' && <AdminPage user={user} />}
        </main>
      </div>
    </div>
  )
}

export default App
