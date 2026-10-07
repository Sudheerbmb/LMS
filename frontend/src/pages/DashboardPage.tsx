import React, { useState, useEffect, useCallback } from 'react'
import type {
  DashboardSummary,
  User,
  AdminUser,
  SchoolLiveClass,
  TeacherTimetableSlot,
  Enrollment,
  Announcement,
  TimetableSlot,
  SchoolCourse
} from '../lib/api'
import {
  getDashboardSummary,
  getAdminUsers,
  approveUser,
  rejectUser,
  getSchoolLiveClasses,
  getTeacherTimetableSlots,
  createSchoolLiveClass,
  getMyEnrollments,
  getAnnouncements,
  createAnnouncement,
  generateTimetable,
  getMyTodayClasses,
  getSchoolCourses,
  recordTeacherLeave
} from '../lib/api'
import {
  BookOpen,
  Cpu,
  Radio,
  Video,
  Calendar,
  Sparkles,
  Play,
  AlertCircle,
  CheckCircle2,
  Bell,
  Send,
  X,
  ShieldCheck,
  Loader2,
  ArrowRight
} from 'lucide-react'
import { AiRecordingPlayerModal } from '../components/AiRecordingPlayerModal'

type DashboardPageProps = {
  user: User
  summary: DashboardSummary | null
  setCurrentTab: (tab: string) => void
}

// Helper to get greeting based on time
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Subtle subject color
function subjectColor(subject?: string) {
  const s = (subject || '').toLowerCase()
  if (s.includes('python') || s.includes('ai') || s.includes('genai')) return { bg: '#FFF8EE', accent: '#E8820C', text: '#C2690A' }
  if (s.includes('cloud') || s.includes('aws') || s.includes('devops')) return { bg: '#EFF6FF', accent: '#0369A1', text: '#0369A1' }
  if (s.includes('salesforce') || s.includes('servicenow')) return { bg: '#F5F0FD', accent: '#6B4FA0', text: '#6B4FA0' }
  if (s.includes('full stack') || s.includes('react') || s.includes('web')) return { bg: '#ECFDF5', accent: '#0A7955', text: '#0A7955' }
  if (s.includes('assess') || s.includes('test') || s.includes('quiz')) return { bg: '#FEF3F0', accent: '#D44B2F', text: '#D44B2F' }
  return { bg: '#F5F4F0', accent: '#454545', text: '#454545' }
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, summary, setCurrentTab }) => {
  // State
  const [statsData, setStatsData] = useState<Record<string, number>>(summary?.stats || {})
  const [liveClasses, setLiveClasses] = useState<SchoolLiveClass[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [teacherSlots, setTeacherSlots] = useState<TeacherTimetableSlot[]>([])
  const [teacherCurriculumCourses, setTeacherCurriculumCourses] = useState<SchoolCourse[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [studentTimetable, setStudentTimetable] = useState<TimetableSlot[]>([])
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [selectedRecordingUrl, setSelectedRecordingUrl] = useState<string | null>(null)
  const [selectedRecordingClass, setSelectedRecordingClass] = useState<any | null>(null)
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'student' | 'teacher'>('all')
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'teacher' | 'student'>('all')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveSlot, setLeaveSlot] = useState<TeacherTimetableSlot | null>(null)
  const [leaveReason, setLeaveReason] = useState('')
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<string>('')

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const freshSummary = await getDashboardSummary().catch(() => null)
      if (freshSummary?.stats) setStatsData(freshSummary.stats)
      const [classesRes, announceRes] = await Promise.all([
        getSchoolLiveClasses().catch(() => []),
        getAnnouncements().catch(() => [])
      ])
      setLiveClasses(classesRes || [])
      setAnnouncements(announceRes || [])
      if (user.role === 'admin') {
        const usersRes = await getAdminUsers().catch(() => [])
        setAdminUsers(usersRes || [])
      } else if (user.role === 'teacher') {
        const [slotsRes, curriculumRes] = await Promise.all([
          getTeacherTimetableSlots().catch(() => []),
          getSchoolCourses({ user_email: user.email, user_role: user.role }).catch(() => [])
        ])
        setTeacherSlots(slotsRes || [])
        setTeacherCurriculumCourses(curriculumRes || [])
      } else if (user.role === 'student') {
        const [enrolledRes, todayRes] = await Promise.all([
          getMyEnrollments().catch(() => []),
          getMyTodayClasses().catch(() => null)
        ])
        setEnrollments(enrolledRes || [])
        setStudentTimetable(todayRes?.classes || [])
      }
    } catch (err: any) {
      console.warn('Dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [user.email, user.role])

  useEffect(() => { loadDashboardData() }, [loadDashboardData])
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // Actions
  const handleRunAiScheduler = async () => {
    setActionLoading('scheduler')
    try {
      const res = await generateTimetable()
      showToast(`AI Scheduler complete! ${res.total_slots_scheduled} slots, ${res.total_sections} sections.`, 'success')
      loadDashboardData()
    } catch (err: any) { showToast(err.message || 'Scheduler error.', 'error') }
    finally { setActionLoading(null) }
  }

  const handleApproveUser = async (userId: string, role: 'student' | 'teacher') => {
    setActionLoading(`approve-${userId}`)
    try {
      await approveUser(userId, role)
      showToast(`User activated as ${role}!`, 'success')
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active', role } : u))
      setStatsData(prev => ({ ...prev, pending_users: Math.max(0, (prev.pending_users || 1) - 1), active_users: (prev.active_users || 0) + 1 }))
    } catch (err: any) { showToast(err.message || 'Could not approve.', 'error') }
    finally { setActionLoading(null) }
  }

  const handleRejectUser = async (userId: string) => {
    setActionLoading(`reject-${userId}`)
    try {
      await rejectUser(userId)
      showToast('User deactivated.', 'info')
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'inactive' } : u))
    } catch (err: any) { showToast(err.message || 'Could not deactivate.', 'error') }
    finally { setActionLoading(null) }
  }

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcementTitle.trim() || !announcementBody.trim()) return
    setActionLoading('announcement')
    try {
      const res = await createAnnouncement({ title: announcementTitle.trim(), body: announcementBody.trim(), audience_role: announcementAudience })
      showToast('Announcement broadcasted!', 'success')
      setAnnouncements(prev => [res, ...prev])
      setShowAnnouncementModal(false)
      setAnnouncementTitle('')
      setAnnouncementBody('')
    } catch (err: any) { showToast(err.message || 'Failed to post.', 'error') }
    finally { setActionLoading(null) }
  }

  const handleInstantLaunchClass = async (slot: TeacherTimetableSlot) => {
    setActionLoading(`launch-${slot.period_number}`)
    try {
      const now = new Date()
      const end = new Date(now.getTime() + 45 * 60 * 1000)
      const res = await createSchoolLiveClass({
        title: `${slot.subject_name} Live Session (${slot.grade_name || 'Course'})`,
        starts_at: now.toISOString(), ends_at: end.toISOString(),
        grade_number: slot.grade_number, section_name: '',
        subject_code: slot.subject_code, subject_name: slot.subject_name,
        period_number: slot.period_number, room_number: slot.room_or_venue, status: 'live'
      })
      showToast(`Launching ${slot.subject_name}...`, 'success')
      const zoomUrl = res.zoom_start_url || res.zoom_join_url || res.meeting_url
      if (zoomUrl && (zoomUrl.startsWith('http://') || zoomUrl.startsWith('https://'))) window.open(zoomUrl, '_blank')
      setCurrentTab('classroom')
    } catch (err: any) { showToast(err.message || 'Could not launch class.', 'error') }
    finally { setActionLoading(null) }
  }

  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveSlot || !leaveReason.trim()) return
    setActionLoading('leave')
    try {
      await recordTeacherLeave({ teacher_id: user.id, day_of_week: leaveSlot.day_of_week, reason: leaveReason.trim() })
      showToast('Leave recorded. AI notified for substitution.', 'success')
      setShowLeaveModal(false)
      setLeaveReason('')
      setLeaveSlot(null)
    } catch (err: any) { showToast(err.message || 'Failed to submit leave.', 'error') }
    finally { setActionLoading(null) }
  }

  const activeLiveClass = React.useMemo(() => {
    const live = liveClasses.find(c => c.status === 'live')
    if (!live) return null
    if (user.role !== 'student') return live
    // Check if student is actively enrolled in this live course or section
    const isEnrolled = enrollments.some(e =>
      e.status === 'active' &&
      (
        e.course_id === live.course_id ||
        (live.subject_name && e.course_title && live.subject_name.toLowerCase().includes(e.course_title.toLowerCase())) ||
        (live.title && e.course_title && live.title.toLowerCase().includes(e.course_title.toLowerCase())) ||
        (live.section_name && e.section_name && live.section_name.toLowerCase() === e.section_name.toLowerCase())
      )
    )
    return isEnrolled ? live : null
  }, [liveClasses, enrollments, user.role])

  const currentWeekday = currentTime.toLocaleDateString('en-US', { weekday: 'long' })
  const activeDisplayDay = selectedScheduleDay || currentWeekday
  const todayTeacherSlots = teacherSlots
    .filter(slot => slot.day_of_week.toLowerCase() === activeDisplayDay.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
  const isCurrentPeriod = (slot: TeacherTimetableSlot) => {
    if (activeDisplayDay.toLowerCase() !== currentWeekday.toLowerCase()) return false
    const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }
    return currentMinutes >= toMin(slot.start_time) && currentMinutes < toMin(slot.end_time)
  }

  // Today's classes for student directly derived from backend schedule endpoint
  const todayStudentSlots = studentTimetable

  const greeting = getGreeting()
  const firstName = (user.display_name || '').split(' ')[0] || 'there'
  const recordedClasses = liveClasses.filter(c => !!c.recording_url)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 100,
          background: 'white', borderRadius: 12, padding: '12px 18px',
          boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, maxWidth: 380,
          animation: 'fadeUp 0.25s ease forwards'
        }}>
          {toast.type === 'success' && <CheckCircle2 style={{ width: 16, height: 16, color: '#0A7955', flexShrink: 0 }} />}
          {toast.type === 'error'   && <AlertCircle  style={{ width: 16, height: 16, color: '#D44B2F', flexShrink: 0 }} />}
          {toast.type === 'info'    && <Sparkles     style={{ width: 16, height: 16, color: 'var(--saffron)', flexShrink: 0 }} />}
          <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {/* ── LOADING BAR ── */}
      {loading && (
        <div style={{ height: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '40%', background: 'var(--saffron)', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STUDENT DASHBOARD — Calm, Editorial, High-Density Workspace
         ══════════════════════════════════════════════════════════════════════ */}
      {user.role === 'student' && (
        <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
          {/* Calm Greeting Header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            paddingBottom: 24, borderBottom: '1px solid var(--border)', marginBottom: 28, flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--saffron)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <h1 style={{ margin: 0, fontSize: 28, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {greeting}, <span style={{ color: 'var(--saffron-d)' }}>{firstName}.</span>
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>
                {todayStudentSlots.length === 0
                  ? 'You have no classes scheduled today.'
                  : todayStudentSlots.length === 1
                  ? 'You have 1 class scheduled today.'
                  : `You have ${todayStudentSlots.length} classes scheduled today.`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {activeLiveClass ? (
                <button onClick={() => setCurrentTab('classroom')} className="btn-primary" style={{ padding: '9px 18px', fontSize: 13 }}>
                  <Radio style={{ width: 14, height: 14 }} />
                  Join Live Lecture
                </button>
              ) : (
                <button onClick={() => setCurrentTab('courses')} className="btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }}>
                  <BookOpen style={{ width: 14, height: 14 }} />
                  My Courses
                </button>
              )}
              <button onClick={() => setCurrentTab('timetable')} className="btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }}>
                <Calendar style={{ width: 14, height: 14 }} />
                Timetable
              </button>
            </div>
          </div>

          {/* Active Live Session Alert Banner if active */}
          {activeLiveClass && (
            <div style={{
              marginBottom: 24, padding: '14px 18px', borderRadius: 10,
              background: '#FEF2F2', border: '1px solid rgba(220, 38, 38, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 6, background: '#DC2626', color: 'white',
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  LIVE NOW
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeLiveClass.title}
                </span>
                <span style={{ fontSize: 12, color: '#B91C1C', opacity: 0.85 }} className="hidden sm:inline">
                  • {activeLiveClass.teacher_name || 'Faculty'}
                </span>
              </div>
              <button
                onClick={() => setCurrentTab('classroom')}
                style={{
                  padding: '6px 14px', borderRadius: 8, background: '#DC2626', color: 'white',
                  border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0
                }}
              >
                Join Classroom →
              </button>
            </div>
          )}

          {/* Two Column Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 32 }} className="dashboard-grid">
            {/* Left Main Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              
              {/* 1. Today's Schedule */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div className="section-label">Schedule</div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                      Today’s Classes
                    </h2>
                  </div>
                  <button onClick={() => setCurrentTab('timetable')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Weekly grid <ArrowRight style={{ width: 12, height: 12 }} />
                  </button>
                </div>

                {todayStudentSlots.length === 0 ? (
                  <div style={{ padding: '28px 24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <Calendar style={{ width: 22, height: 22, color: 'var(--ink-muted)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>No classes scheduled today</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>You're all caught up. Check your timetable for upcoming sessions.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {todayStudentSlots.map((slot: any, i) => {
                      const sc = subjectColor(slot.subject_name)
                      const timeString = slot.start_time ? `${slot.start_time} – ${slot.end_time || ''}` : `Period ${slot.period_number || (i + 1)}`
                      return (
                        <div
                          key={slot.id || i}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', borderRadius: 8, background: 'white',
                            border: '1px solid var(--border)', gap: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                            <div style={{ minWidth: 90, fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>
                              {timeString}
                            </div>
                            <div style={{ width: 3, height: 24, borderRadius: 2, background: sc.accent, flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {slot.subject_name || slot.grade_name || 'Class Session'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                                {slot.teacher_name ? `${slot.teacher_name} • ` : ''}{slot.room_or_venue || 'Auditorium'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: sc.bg, color: sc.text }}>
                              Period {slot.period_number || (i + 1)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 2. Continue Learning (Course Progress) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div className="section-label">Enrolled Modules</div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                      Continue Learning
                    </h2>
                  </div>
                  <button onClick={() => setCurrentTab('courses')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    View all courses <ArrowRight style={{ width: 12, height: 12 }} />
                  </button>
                </div>

                {enrollments.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <BookOpen style={{ width: 22, height: 22, color: 'var(--ink-muted)', margin: '0 auto 6px' }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 2px' }}>You aren't enrolled in any courses yet</p>
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: 0 }}>Enroll in technical tracks to start learning.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {enrollments.slice(0, 4).map((enroll: any, i) => {
                      const sc = subjectColor(enroll.course_title || '')
                      const progress = typeof enroll.progress_percent === 'number' ? enroll.progress_percent : 0
                      return (
                        <div
                          key={enroll.id || i}
                          onClick={() => setCurrentTab('courses')}
                          style={{
                            padding: '16px', borderRadius: 10, background: 'white',
                            border: '1px solid var(--border)', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            gap: 12, transition: 'border-color 0.15s ease'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--saffron)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: sc.bg, color: sc.text }}>
                                {enroll.status === 'active' ? 'Active Track' : (enroll.status || 'Enrolled')}
                              </span>
                              <ArrowRight style={{ width: 13, height: 13, color: 'var(--ink-muted)' }} />
                            </div>
                            <h4 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
                              {enroll.course_title || enroll.subject_name || 'Technical Course'}
                            </h4>
                            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-3)' }}>
                              Enrolled Track
                            </p>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>
                              <span>Curriculum Progress</span>
                              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{progress}%</span>
                            </div>
                            <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: sc.accent }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 3. Recent Recordings (Pure Typographic List — NO Stock Photos) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div className="section-label">Archive</div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                      Recent Recordings
                    </h2>
                  </div>
                  <button onClick={() => setCurrentTab('classroom')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    All recordings <ArrowRight style={{ width: 12, height: 12 }} />
                  </button>
                </div>

                {recordedClasses.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <Video style={{ width: 22, height: 22, color: 'var(--ink-muted)', margin: '0 auto 6px' }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 2px' }}>No recordings available</p>
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: 0 }}>Class recordings will be indexed here automatically.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recordedClasses.slice(0, 4).map(cls => {
                      const sc = subjectColor(cls.subject_name)
                      return (
                        <div
                          key={cls.id}
                          onClick={() => { setSelectedRecordingUrl(cls.recording_url!); setSelectedRecordingClass(cls) }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', borderRadius: 8, background: 'white',
                            border: '1px solid var(--border)', cursor: 'pointer', gap: 14,
                            transition: 'border-color 0.15s ease'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--saffron)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, background: sc.bg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              <Play style={{ width: 13, height: 13, color: sc.accent, fill: sc.accent, marginLeft: 1 }} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cls.title}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                                {cls.teacher_name || 'Faculty'} • {cls.subject_name || 'Lecture'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>45 min</span>
                            <button className="btn-ghost btn-sm" style={{ padding: '4px 10px', fontSize: 11 }}>
                              Watch
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: AI Assistant & Announcements */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Acharya AI Prompt Widget */}
              <div style={{
                background: 'white', borderRadius: 12, border: '1px solid var(--border)',
                padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, background: '#8B5CF6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Sparkles style={{ width: 13, height: 13, color: 'white' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#6D28D9', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Ask Acharya
                    </div>
                  </div>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  What would you like to learn or prepare for today?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    'Plan my week & timetable',
                    'Explain recent lecture topics',
                    'Generate practice quiz'
                  ].map((promptText) => (
                    <button
                      key={promptText}
                      onClick={() => alert(`Acharya AI: Analyzing "${promptText}" for your active coursework.`)}
                      style={{
                        padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)',
                        border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 500,
                        color: 'var(--ink-2)', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { (e.currentTarget.style.borderColor = 'var(--saffron)'); (e.currentTarget.style.color = 'var(--saffron-d)') }}
                      onMouseLeave={e => { (e.currentTarget.style.borderColor = 'var(--border)'); (e.currentTarget.style.color = 'var(--ink-2)') }}
                    >
                      <span>{promptText}</span>
                      <ArrowRight style={{ width: 11, height: 11, opacity: 0.6 }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Announcements Panel */}
              <div style={{
                background: 'white', borderRadius: 12, border: '1px solid var(--border)',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Bell style={{ width: 14, height: 14, color: 'var(--saffron)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Announcements</span>
                </div>

                {announcements.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-3)' }}>
                    No system announcements.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {announcements.slice(0, 3).map((ann) => (
                      <div key={ann.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
                          {ann.title}
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                          {ann.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TEACHER DASHBOARD — Operational Studio (No Stock Photos)
         ══════════════════════════════════════════════════════════════════════ */}
      {user.role === 'teacher' && (
        <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
          {/* Faculty Header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            paddingBottom: 24, borderBottom: '1px solid var(--border)', marginBottom: 28, flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--saffron)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                Faculty Teaching Studio
              </div>
              <h1 style={{ margin: 0, fontSize: 28, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {greeting}, <span style={{ color: 'var(--saffron-d)' }}>Professor {firstName}.</span>
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>
                {todayTeacherSlots.length > 0
                  ? `You have ${todayTeacherSlots.length} lecture period${todayTeacherSlots.length !== 1 ? 's' : ''} scheduled for today.`
                  : 'No scheduled lectures for today.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={() => setCurrentTab('classroom')} className="btn-primary" style={{ padding: '9px 18px', fontSize: 13 }}>
                <Video style={{ width: 14, height: 14 }} />
                Open Classroom
              </button>
              <button onClick={() => setShowAnnouncementModal(true)} className="btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }}>
                <Bell style={{ width: 14, height: 14 }} />
                Broadcast
              </button>
            </div>
          </div>

          {/* Teacher Operational Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 32 }} className="dashboard-grid">
            {/* Left Column: Schedule & Launch */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div className="section-label">Teaching Schedule</div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                    {activeDisplayDay}'s Classes
                  </h2>
                </div>
                <button onClick={() => setCurrentTab('timetable')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Full schedule <ArrowRight style={{ width: 12, height: 12 }} />
                </button>
              </div>

              {/* Day switcher tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                  const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]
                  const isSelected = activeDisplayDay.toLowerCase() === fullDay.toLowerCase()
                  const count = teacherSlots.filter(s => s.day_of_week.toLowerCase() === fullDay.toLowerCase()).length
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedScheduleDay(fullDay)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: isSelected ? 'var(--saffron)' : 'var(--surface-2)',
                        color: isSelected ? 'white' : 'var(--ink-3)',
                        fontSize: 12, fontWeight: isSelected ? 700 : 500,
                        transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      {d}
                      {count > 0 && (
                        <span style={{ fontSize: 10, background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--border)', borderRadius: 99, padding: '0 5px' }}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {todayTeacherSlots.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <Calendar style={{ width: 22, height: 22, color: 'var(--ink-muted)', margin: '0 auto 6px' }} />
                  <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No classes scheduled for {activeDisplayDay}.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {todayTeacherSlots.map((slot, idx) => {
                    const canLaunch = isCurrentPeriod(slot)
                    const sc = subjectColor(slot.subject_name)
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 18px', borderRadius: 8,
                          background: canLaunch ? '#FFF8EE' : 'white',
                          border: `1px solid ${canLaunch ? 'rgba(232,130,12,0.3)' : 'var(--border)'}`,
                          gap: 16
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: sc.bg, color: sc.text }}>
                              Period {slot.period_number}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{slot.start_time} – {slot.end_time}</span>
                            {canLaunch && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--saffron)', background: 'var(--saffron-bg)', padding: '2px 6px', borderRadius: 4 }}>
                                CURRENT
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
                            {slot.subject_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                            {slot.grade_name} • {slot.room_or_venue || 'Lab'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => handleInstantLaunchClass(slot)}
                            disabled={!canLaunch || actionLoading === `launch-${slot.period_number}`}
                            className="btn-primary btn-sm"
                            style={{ opacity: canLaunch ? 1 : 0.4 }}
                          >
                            {actionLoading === `launch-${slot.period_number}` ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Play style={{ width: 12, height: 12 }} />}
                            {canLaunch ? 'Launch' : 'Waiting'}
                          </button>
                          <button
                            onClick={() => { setLeaveSlot(slot); setShowLeaveModal(true) }}
                            className="btn-ghost btn-sm"
                            style={{ fontSize: 11 }}
                          >
                            Leave
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Handled Courses & Overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Metric Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Classes Today', value: todayTeacherSlots.length },
                  { label: 'Courses Handled', value: teacherCurriculumCourses.length },
                ].map((stat) => (
                  <div key={stat.label} style={{ padding: '16px', background: 'white', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Assigned Tracks */}
              <div style={{ background: 'white', borderRadius: 10, border: '1px solid var(--border)', padding: '16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Assigned Courses</div>
                {teacherCurriculumCourses.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)' }}>No courses assigned.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {teacherCurriculumCourses.slice(0, 4).map(c => (
                      <button
                        key={c.id}
                        onClick={() => setCurrentTab('courses')}
                        style={{
                          padding: '8px 10px', borderRadius: 6, background: 'var(--surface-2)',
                          border: '1px solid var(--border)', fontSize: 12, color: 'var(--ink)',
                          textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                        <ArrowRight style={{ width: 11, height: 11, color: 'var(--ink-muted)' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADMIN DASHBOARD — Operational Command Strip & Live Operations
         ══════════════════════════════════════════════════════════════════════ */}
      {user.role === 'admin' && (
        <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
          {/* Admin Header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            paddingBottom: 24, borderBottom: '1px solid var(--border)', marginBottom: 24, flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--saffron)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                <ShieldCheck style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                Institute Administration
              </div>
              <h1 style={{ margin: 0, fontSize: 28, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                Operational Overview
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-3)' }}>
                System metrics, active live classrooms, and pending user approvals.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRunAiScheduler} disabled={actionLoading === 'scheduler'} className="btn-primary" style={{ padding: '9px 18px', fontSize: 13 }}>
                {actionLoading === 'scheduler' ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Cpu style={{ width: 14, height: 14 }} />}
                Run AI Scheduler
              </button>
              <button onClick={() => setShowAnnouncementModal(true)} className="btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }}>
                <Bell style={{ width: 14, height: 14 }} />
                Broadcast
              </button>
            </div>
          </div>

          {/* Operational Metrics Strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28
          }}>
            {[
              { label: 'STUDENTS', value: statsData.students_total ?? 0, onClick: () => setUserFilter('student') },
              { label: 'FACULTY', value: statsData.teachers_total ?? 0, onClick: () => setUserFilter('teacher') },
              { label: 'COURSES', value: statsData.published_courses ?? statsData.courses_total ?? 0, onClick: () => setCurrentTab('courses') },
              { label: 'LIVE TODAY', value: liveClasses.filter(c => c.status === 'live').length, onClick: () => setCurrentTab('classroom') },
            ].map((m) => (
              <div
                key={m.label}
                onClick={m.onClick}
                style={{
                  padding: '18px 22px', borderRadius: 10, background: 'white',
                  border: '1px solid var(--border)', cursor: 'pointer',
                  transition: 'border-color 0.15s ease'
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--saffron)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.06em', marginBottom: 6 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* Admin Two Column Operational Area */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
            {/* User Approvals & Directory */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid var(--border)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>User Directory</h3>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)' }}>Approvals & role assignments</p>
                </div>

                <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 6, padding: 2 }}>
                  {(['all', 'pending', 'student', 'teacher'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setUserFilter(f)}
                      style={{
                        padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 11, fontWeight: 600,
                        background: userFilter === f ? 'white' : 'transparent',
                        color: userFilter === f ? 'var(--ink)' : 'var(--ink-3)',
                        boxShadow: userFilter === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        cursor: 'pointer', textTransform: 'capitalize'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {adminUsers.filter(u => {
                  if (userFilter === 'pending') return u.status !== 'active'
                  if (userFilter === 'student') return u.role === 'student'
                  if (userFilter === 'teacher') return u.role === 'teacher'
                  return true
                }).slice(0, 15).map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 12
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.display_name}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'capitalize' }}>
                          ({u.role})
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {u.status !== 'active' ? (
                        <>
                          <button
                            onClick={() => handleApproveUser(u.id, u.role === 'teacher' ? 'teacher' : 'student')}
                            disabled={actionLoading === `approve-${u.id}`}
                            style={{ padding: '4px 10px', borderRadius: 6, background: '#0A7955', color: 'white', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectUser(u.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--surface-2)', color: '#DC2626', border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#0A7955' }}>
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Classrooms Stream */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid var(--border)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Today's Classes</h3>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)' }}>Real-time classroom monitoring</p>
                </div>
                <button onClick={() => setCurrentTab('classroom')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Manage →
                </button>
              </div>

              {liveClasses.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
                  No active classroom sessions.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
                  {liveClasses.slice(0, 8).map(cls => (
                    <div
                      key={cls.id}
                      style={{
                        padding: '10px 12px', borderRadius: 6, background: 'var(--surface-2)',
                        border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 12
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cls.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          {cls.teacher_name || 'Faculty'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: cls.status === 'live' ? '#FEF2F2' : 'white',
                        color: cls.status === 'live' ? '#DC2626' : 'var(--ink-3)',
                        border: '1px solid var(--border)'
                      }}>
                        {cls.status === 'live' ? 'LIVE' : cls.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SHARED MODALS ──────────────────────────────────────────────────── */}

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell style={{ width: 16, height: 16, color: 'var(--saffron)' }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Broadcast Announcement</span>
              </div>
              <button onClick={() => setShowAnnouncementModal(false)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <form onSubmit={handlePostAnnouncement} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audience</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['all', 'student', 'teacher'] as const).map(a => (
                    <button key={a} type="button" onClick={() => setAnnouncementAudience(a)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: announcementAudience === a ? 'var(--saffron)' : 'var(--surface-2)', color: announcementAudience === a ? 'white' : 'var(--ink-3)', textTransform: 'capitalize' }}>
                      {a === 'all' ? 'Everyone' : a === 'student' ? 'Students' : 'Teachers'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</label>
                <input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} required
                  placeholder="Announcement title..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</label>
                <textarea value={announcementBody} onChange={e => setAnnouncementBody(e.target.value)} required rows={4}
                  placeholder="Write your announcement here..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={actionLoading === 'announcement'} className="btn-primary" style={{ flex: 1 }}>
                  {actionLoading === 'announcement' ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />}
                  Broadcast Now
                </button>
                <button type="button" onClick={() => setShowAnnouncementModal(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && leaveSlot && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Request Leave / Substitute</span>
              <button onClick={() => setShowLeaveModal(false)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 14, height: 14, color: 'var(--ink-3)' }} />
              </button>
            </div>
            <form onSubmit={handleSubmitLeaveRequest} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--saffron-bg)', border: '1px solid rgba(232,130,12,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{leaveSlot.subject_name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Period {leaveSlot.period_number} · {leaveSlot.start_time} – {leaveSlot.end_time} · {leaveSlot.day_of_week}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason for Leave</label>
                <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} required rows={3}
                  placeholder="Briefly explain your reason..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={actionLoading === 'leave'} className="btn-primary" style={{ flex: 1 }}>
                  {actionLoading === 'leave' ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : null}
                  Submit Leave Request
                </button>
                <button type="button" onClick={() => setShowLeaveModal(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recording Player */}
      {selectedRecordingUrl && selectedRecordingClass && (
        <AiRecordingPlayerModal
          recordingUrl={selectedRecordingUrl}
          classInfo={selectedRecordingClass}
          onClose={() => { setSelectedRecordingUrl(null); setSelectedRecordingClass(null) }}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .hero-responsive { grid-template-columns: 1fr !important; }
          .hero-responsive > div:last-child { display: none; }
        }
        .btn-sm { padding: 6px 12px !important; font-size: 12px !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 0.7s linear infinite; }
      `}</style>
    </div>
  )
}
