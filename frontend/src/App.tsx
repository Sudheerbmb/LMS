import React, { useState, useEffect } from 'react'
import type { 
  User, 
  Notification, 
  DashboardSummary,
  AdminInstituteCourse
} from './lib/api'
import { 
  getCurrentUser, 
  getDashboardSummary, 
  getNotifications, 
  login as loginApi, 
  register as registerApi,
  getAdminCourses
} from './lib/api'
import { Sidebar } from './components/Sidebar'
import { DashboardPage } from './pages/DashboardPage'
import { CoursesPage } from './pages/CoursesPage'
import { AssessmentsPage } from './pages/AssessmentsPage'
import { AssignmentsPage } from './pages/AssignmentsPage'
import { CodingPage } from './pages/CodingPage'
import { ClassroomPage } from './pages/ClassroomPage'
import { AdminPage } from './pages/AdminPage'
import { TimetablePage } from './pages/TimetablePage'
import { CertificatesPage } from './pages/CertificatesPage'

const STANDARD_TRACKS = [
  { id: 'python-genai', title: 'Python with Generative AI (GenAI)' },
  { id: 'salesforce-developer', title: 'Salesforce Administration & Development' },
  { id: 'servicenow-csa-cad', title: 'ServiceNow Administration & Development (CSA / CAD)' },
  { id: 'full-stack-web', title: 'Full Stack Web Engineering (React & FastAPI)' },
  { id: 'cloud-devops-aws', title: 'Cloud Computing & DevOps Engineering (AWS & Kubernetes)' },
]

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
  const [authName, setAuthName] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authRole, setAuthRole] = useState<'student' | 'teacher'>('student')
  const [authCourseId, setAuthCourseId] = useState<string>('')
  const [availableCourses, setAvailableCourses] = useState<AdminInstituteCourse[]>([])
  const [authError, setAuthError] = useState('')
  const [submittingAuth, setSubmittingAuth] = useState(false)

  useEffect(() => {
    if (token) {
      loadInitialData()
    } else {
      setLoading(false)
      // Preload courses for registration dropdown
      getAdminCourses()
        .then((res) => {
          if (res && res.length > 0) {
            setAvailableCourses(res)
            setAuthCourseId(res[0].id)
          }
        })
        .catch(() => {})
    }
  }, [token])

  // Safeguard: Ensure Admin is redirected if on student/teacher specific tabs
  useEffect(() => {
    if (user?.role === 'admin' && (currentTab === 'assessments' || currentTab === 'assignments' || currentTab === 'certificates')) {
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
        await registerApi({
          email: authEmail,
          password: authPassword,
          display_name: authName,
          phone_number: authPhone,
          role: authRole,
          course_id: authCourseId || undefined,
          course_ids: authCourseId ? [authCourseId] : undefined,
        })
        alert('Registration complete! Your account is active. Please log in.')
        setAuthMode('login')
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
      <div className="min-h-screen flex font-sans bg-slate-50 text-slate-900">
        {/* Left branding panel */}
        <div className="w-[420px] bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white border-r border-slate-200/80 hidden lg:flex flex-col justify-between p-12 shrink-0 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />

          {/* Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3.5 mb-8">
              <img
                src="/acharya_logo.png"
                alt="Acharya LMS Logo"
                className="w-12 h-12 rounded-2xl object-cover shadow-sm ring-1 ring-amber-500/30"
              />
              <div>
                <div className="font-extrabold text-xl tracking-tight text-slate-900">Acharya LMS</div>
                <div className="text-[11px] text-amber-700 font-bold tracking-wider uppercase">Learning Operating System</div>
              </div>
            </div>

            <h2 className="text-2xl font-black leading-tight mb-3 text-slate-900 tracking-tight">
              AI-Native Technical Education & Live Classrooms
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed font-normal mb-8">
              Engineered for modern academies. Manage multi-subject courses, live Zoom video lectures, chapter roadmaps, assignments, and verifiable certificates.
            </p>

            {/* Feature list */}
            <div className="space-y-4">
              {[
                { label: 'Modular Course & Subject Tracks', desc: 'Group multiple specialized modules under each program', color: 'border-indigo-500' },
                { label: 'Live Video Sessions & Recordings', desc: 'Synchronized live classrooms, recording playback, and AI dialogue notes', color: 'border-amber-500' },
                { label: 'Adaptive Timetable AI Scheduling', desc: 'Autonomous conflict-free scheduling with Zoom links', color: 'border-emerald-500' },
                { label: 'Integrated Coding & Assessments', desc: 'Interactive coding lab sandbox, auto-grading, and anti-cheat telemetry', color: 'border-sky-500' },
              ].map((f) => (
                <div key={f.label} className={`pl-3.5 border-l-2 ${f.color}`}>
                  <div className="font-bold text-xs text-slate-800">{f.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 text-[11px] text-slate-400">
            &copy; {new Date().getFullYear()} Acharya Learning OS. Enterprise Edition.
          </div>
        </div>

        {/* Right: form panel */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto bg-slate-50">
          <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200/80 shadow-md">
            {/* Heading */}
            <div className="mb-6">
              <h1 className="text-2xl font-black text-slate-900 mb-1.5 tracking-tight">
                {authMode === 'login' ? 'Sign in to Acharya' : 'Create an Account'}
              </h1>
              <p className="text-xs text-slate-500">
                {authMode === 'login' ? 'Enter your credentials to access your institute workspace.' : 'Fill in your details and select your technical course track.'}
              </p>
            </div>

            {/* Error */}
            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs mb-4 font-semibold">
                {authError}
              </div>
            )}

            {/* Demo quick-access */}
            {authMode === 'login' && (
              <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-4 mb-6">
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2.5">
                  Instant Demo Access — Click to autofill
                </p>
                <div className="space-y-3">
                  {/* Admin */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Administrator</p>
                    <button
                      type="button"
                      onClick={() => { setAuthEmail('admin@example.com'); setAuthPassword('ChangeMe123!'); setAuthError(''); }}
                      className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-amber-900 text-xs font-bold shadow-2xs hover:bg-amber-100 transition cursor-pointer"
                    >
                      System Administrator
                    </button>
                  </div>

                  {/* Teachers */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Faculty / Mentors</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        ['sarah.connor@institute.edu', 'Dr. Sarah — Python & GenAI'],
                        ['alan.turing@institute.edu', 'Prof. Turing — LLMs & RAG'],
                        ['marc.b@institute.edu', 'Marc Benioff — Salesforce'],
                      ].map(([email, label]) => (
                        <button
                          key={email}
                          type="button"
                          onClick={() => { setAuthEmail(email); setAuthPassword('Teacher123!'); setAuthError(''); }}
                          className="px-2.5 py-1 bg-white border border-orange-200 rounded-lg text-orange-900 text-xs font-semibold shadow-2xs hover:bg-orange-50 transition cursor-pointer"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Students */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Enrolled Candidates</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        ['alex.r@student.edu', 'Alex Rivera — Full Stack Web'],
                        ['priya.s@student.edu', 'Priya Sharma — Python GenAI'],
                        ['rahul.k@student.edu', 'Rahul Kumar — DevOps & Cloud'],
                      ].map(([email, label]) => (
                        <button
                          key={email}
                          type="button"
                          onClick={() => { setAuthEmail(email); setAuthPassword('Student123!'); setAuthError(''); }}
                          className="px-2.5 py-1 bg-white border border-yellow-300 rounded-lg text-yellow-900 text-xs font-semibold shadow-2xs hover:bg-yellow-50 transition cursor-pointer"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Login / Register form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Account Role *</label>
                      <select
                        value={authRole}
                        onChange={(e) => setAuthRole(e.target.value as 'student' | 'teacher')}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher / Mentor</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Target Track *</label>
                      <select
                        value={authCourseId}
                        onChange={(e) => setAuthCourseId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                      >
                        {availableCourses.length > 0 ? (
                          availableCourses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))
                        ) : (
                          STANDARD_TRACKS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@institute.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={submittingAuth}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {submittingAuth ? 'Processing...' : authMode === 'login' ? 'Sign In to Workspace' : 'Register & Enroll'}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-500">
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                className="text-amber-600 font-bold hover:underline cursor-pointer"
              >
                {authMode === 'login' ? 'Register Now' : 'Sign In'}
              </button>
            </p>
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

      {/* ── Main Content Area ── */}
      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', background: 'var(--canvas)' }}>
        {currentTab === 'overview' && (
          <DashboardPage user={user} summary={dashboardSummary} setCurrentTab={setCurrentTab} />
        )}
        {currentTab === 'courses' && <CoursesPage user={user} setCurrentTab={setCurrentTab} />}
        {currentTab === 'classroom' && <ClassroomPage user={user} />}
        {currentTab === 'timetable' && <TimetablePage user={user} />}
        {currentTab === 'coding' && <CodingPage user={user} />}
        {currentTab === 'assignments' && user.role !== 'admin' && <AssignmentsPage user={user} />}
        {currentTab === 'assessments' && user.role !== 'admin' && <AssessmentsPage user={user} />}
        {currentTab === 'certificates' && user.role === 'student' && <CertificatesPage user={user} />}
        {currentTab === 'admin' && user.role === 'admin' && <AdminPage user={user} />}
      </main>
    </div>
  )
}

export default App
