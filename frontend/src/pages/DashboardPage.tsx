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
  getTimetableGrid,
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
  Check,
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
        const [enrolledRes, gridRes] = await Promise.all([
          getMyEnrollments().catch(() => []),
          getTimetableGrid().catch(() => [])
        ])
        setEnrollments(enrolledRes || [])
        setStudentTimetable(gridRes || [])
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
        title: `${slot.subject_name} Live Session (${slot.grade_name || 'Course'} • Batch ${slot.section_name})`,
        starts_at: now.toISOString(), ends_at: end.toISOString(),
        grade_number: slot.grade_number, section_name: slot.section_name,
        subject_code: slot.subject_code, subject_name: slot.subject_name,
        period_number: slot.period_number, room_number: slot.room_or_venue, status: 'live'
      })
      showToast(`Launching ${slot.subject_name} (Batch ${slot.section_name})...`, 'success')
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

  const activeLiveClass = liveClasses.find(c => c.status === 'live')
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

  // Compute "today's schedule" for student
  const todayStudentSlots = studentTimetable
    .filter((s: any) => (s.day_of_week || '').toLowerCase() === currentWeekday.toLowerCase())
    .sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''))

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
          STUDENT DASHBOARD — Editorial composition
         ══════════════════════════════════════════════════════════════════════ */}
      {user.role === 'student' && (
        <>
          {/* HERO — Split panel: editorial text + cinematic image */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 420px',
            minHeight: 400, borderBottom: '1px solid var(--border)'
          }} className="hero-responsive">
            {/* Left: editorial copy */}
            <div style={{
              padding: '56px 56px 48px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              background: 'var(--canvas-warm)'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--saffron)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <h1 style={{ margin: 0, marginBottom: 12, fontSize: 42, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, lineHeight: 1.1, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {greeting},<br />
                <em style={{ fontStyle: 'italic', color: 'var(--saffron)' }}>{firstName}.</em>
              </h1>
              <p style={{ margin: 0, marginBottom: 32, fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.65, maxWidth: 440, fontWeight: 400 }}>
                {enrollments.length > 0
                  ? `You're enrolled in ${enrollments.length} course${enrollments.length !== 1 ? 's' : ''}. Keep building your momentum.`
                  : 'Your learning journey begins here. Explore courses, join live classes, and grow every day.'}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setCurrentTab('classroom')} className="btn-primary" style={{ padding: '11px 24px', fontSize: 14 }}>
                  <Radio style={{ width: 15, height: 15 }} />
                  Join Live Class
                </button>
                <button onClick={() => setCurrentTab('courses')} className="btn-ghost" style={{ padding: '11px 22px', fontSize: 14 }}>
                  <BookOpen style={{ width: 15, height: 15 }} />
                  Browse Courses
                </button>
              </div>

              {/* Live class alert */}
              {activeLiveClass && (
                <div style={{
                  marginTop: 24, padding: '12px 16px', borderRadius: 10,
                  background: '#FEF2F2', border: '1px solid rgba(185,28,28,0.15)',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <Radio style={{ width: 14, height: 14, color: '#B91C1C' }} />
                  <span style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>
                    Class live now: <strong>{activeLiveClass.title}</strong>
                  </span>
                  <button onClick={() => setCurrentTab('classroom')} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#B91C1C', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Join →
                  </button>
                </div>
              )}
            </div>

            {/* Right: cinematic image */}
            <div className="hero-image-panel" style={{ minHeight: 360 }}>
              <img src="/assets/hero-learning.jpg" alt="Learning journey" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(247,245,240,0.3) 0%, transparent 40%)' }} />
            </div>
          </div>

          {/* MAIN CONTENT GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 0 }}>
            {/* LEFT COLUMN */}
            <div style={{ padding: '40px 40px 40px 48px', borderRight: '1px solid var(--border)' }}>

              {/* TODAY'S SCHEDULE — Timeline */}
              <div style={{ marginBottom: 48 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <div className="section-label">Today's Schedule</div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {currentWeekday}, {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </h2>
                  </div>
                  <button onClick={() => setCurrentTab('timetable')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Full timetable <ArrowRight style={{ width: 13, height: 13 }} />
                  </button>
                </div>

                {todayStudentSlots.length === 0 && liveClasses.filter(c => c.status !== 'ended').length === 0 ? (
                  <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <Calendar style={{ width: 28, height: 28, color: 'var(--ink-muted)', margin: '0 auto 10px' }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 6px' }}>No classes scheduled today</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>Check the full timetable for your weekly schedule.</p>
                  </div>
                ) : (
                  <div>
                    {/* Live classes first */}
                    {liveClasses.filter(c => c.status === 'live').map((cls) => {
                      return (
                        <div key={cls.id} className="timeline-item active" style={{ marginBottom: 2 }}>
                          <div className="timeline-time" style={{ color: '#B91C1C' }}>LIVE</div>
                          <div className="timeline-body">
                            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid rgba(185,28,28,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', marginBottom: 2 }}>{cls.subject_name || 'Live Session'}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{cls.teacher_name || 'Faculty'} · Batch {cls.section_name}</div>
                              </div>
                              <button onClick={() => setCurrentTab('classroom')} className="btn-primary btn-sm" style={{ background: '#B91C1C', padding: '6px 14px', fontSize: 11 }}>
                                <Play style={{ width: 11, height: 11 }} /> Join
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {/* Timetable slots */}
                    {todayStudentSlots.slice(0, 6).map((slot: any, i) => {
                      const sc = subjectColor(slot.subject_name)
                      return (
                        <div key={i} className="timeline-item" style={{ marginBottom: 2 }}>
                          <div className="timeline-time">{slot.start_time || '--'}</div>
                          <div className="timeline-body">
                            <div style={{ padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 1 }}>{slot.subject_name || 'Class'}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{slot.teacher_name || 'Faculty'} · {slot.room_or_venue || 'Room'}</div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: sc.bg, color: sc.text }}>
                                P{slot.period_number || (i + 1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {todayStudentSlots.length === 0 && (
                      <div className="timeline-item">
                        <div className="timeline-time">—</div>
                        <div className="timeline-body">
                          <div style={{ padding: '10px 12px', borderRadius: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>No timetable slots for today. Check your full schedule.</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RECORDINGS — Learning Library */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div className="section-label">Recent Recordings</div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Your Learning Library
                    </h2>
                  </div>
                  <button onClick={() => setCurrentTab('classroom')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    All recordings <ArrowRight style={{ width: 13, height: 13 }} />
                  </button>
                </div>

                {recordedClasses.length === 0 ? (
                  <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <Video style={{ width: 28, height: 28, color: 'var(--ink-muted)', margin: '0 auto 10px' }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 6px' }}>No recordings yet</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>Recordings appear here after live classes end.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {recordedClasses.slice(0, 4).map(cls => {
                      const sc = subjectColor(cls.subject_name)
                      return (
                        <div key={cls.id} className="media-card" style={{ cursor: 'pointer' }}
                          onClick={() => { setSelectedRecordingUrl(cls.recording_url!); setSelectedRecordingClass(cls) }}>
                          <div className="media-thumbnail" style={{ aspectRatio: '16/9', background: sc.bg }}>
                            <img src="/assets/classroom.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                            <div style={{
                              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.92)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: 'var(--shadow-md)'
                              }}>
                                <Play style={{ width: 16, height: 16, color: 'var(--saffron)', fill: 'var(--saffron)', marginLeft: 2 }} />
                              </div>
                            </div>
                            <div style={{ position: 'absolute', top: 8, left: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.9)', color: sc.text }}>
                                {cls.subject_name || 'Lecture'}
                              </span>
                            </div>
                          </div>
                          <div style={{ padding: '12px 14px 14px' }}>
                            <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cls.title}
                            </h4>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)' }}>
                              {cls.teacher_name || 'Faculty'} · Batch {cls.section_name}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ padding: '40px 32px 40px 32px' }}>
              {/* AI ASSISTANT */}
              <div className="ai-panel" style={{ padding: '20px', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div className="ai-orb">
                    <Sparkles style={{ width: 16, height: 16, color: 'white' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--saffron-d)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Acharya AI</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Your learning assistant</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 16px', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "What should I learn next?"
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Plan my week', 'Quiz me', 'Explain this concept'].map(action => (
                    <button key={action} style={{
                      padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(232,130,12,0.2)',
                      background: 'white', fontSize: 12, fontWeight: 500, color: 'var(--ink-2)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease'
                    }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--saffron)'; (e.target as HTMLElement).style.color = 'var(--saffron)' }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'rgba(232,130,12,0.2)'; (e.target as HTMLElement).style.color = 'var(--ink-2)' }}
                    >
                      {action} →
                    </button>
                  ))}
                </div>
              </div>

              {/* MY COURSES */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div className="section-label">Enrolled</div>
                  <button onClick={() => setCurrentTab('courses')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer' }}>View all</button>
                </div>
                {enrollments.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <BookOpen style={{ width: 22, height: 22, color: 'var(--ink-muted)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>No enrollments yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {enrollments.slice(0, 4).map((enroll: any, i) => {
                      const sc = subjectColor(enroll.course_title || '')
                      return (
                        <button key={i} onClick={() => setCurrentTab('courses')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 10,
                            background: 'white', border: '1px solid var(--border)',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--saffron)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BookOpen style={{ width: 14, height: 14, color: sc.accent }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {enroll.course_title || enroll.subject_name || 'Course'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                              {enroll.status === 'enrolled' ? 'Active' : enroll.status || 'Enrolled'}
                            </div>
                          </div>
                          <ArrowRight style={{ width: 13, height: 13, color: 'var(--ink-muted)', flexShrink: 0 }} />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ANNOUNCEMENTS */}
              {announcements.length > 0 && (
                <div>
                  <div className="section-label" style={{ marginBottom: 10 }}>Announcements</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {announcements.slice(0, 3).map(ann => (
                      <div key={ann.id} style={{
                        padding: '10px 12px', borderRadius: 10,
                        background: 'var(--surface-2)', border: '1px solid var(--border)'
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{ann.title}</div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {ann.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TEACHER DASHBOARD — Teaching Studio
         ══════════════════════════════════════════════════════════════════════ */}
      {user.role === 'teacher' && (
        <>
          {/* HERO */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 380px',
            minHeight: 340, borderBottom: '1px solid var(--border)'
          }}>
            <div style={{ padding: '48px 48px 40px', background: 'var(--canvas-warm)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--saffron)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                Teaching Studio
              </div>
              <h1 style={{ margin: 0, marginBottom: 10, fontSize: 38, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, lineHeight: 1.1, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {greeting},<br />
                <em style={{ fontStyle: 'italic', color: 'var(--saffron)' }}>Professor {firstName}.</em>
              </h1>
              <p style={{ margin: 0, marginBottom: 28, fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.65, maxWidth: 420 }}>
                {todayTeacherSlots.length > 0
                  ? `You have ${todayTeacherSlots.length} class${todayTeacherSlots.length !== 1 ? 'es' : ''} scheduled today.`
                  : 'No classes scheduled for today. Rest well, or prepare your materials.'}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setCurrentTab('classroom')} className="btn-primary" style={{ padding: '11px 22px', fontSize: 14 }}>
                  <Video style={{ width: 15, height: 15 }} /> Open Classroom
                </button>
                <button onClick={() => setShowAnnouncementModal(true)} className="btn-ghost" style={{ padding: '11px 20px', fontSize: 14 }}>
                  <Bell style={{ width: 15, height: 15 }} /> Announce
                </button>
              </div>
            </div>
            <div className="hero-image-panel">
              <img src="/assets/teacher.jpg" alt="Teaching" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(247,245,240,0.3) 0%, transparent 40%)' }} />
            </div>
          </div>

          {/* TEACHER MAIN GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0 }}>
            {/* LEFT */}
            <div style={{ padding: '36px 40px', borderRight: '1px solid var(--border)' }}>
              {/* TODAY'S SCHEDULE */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div className="section-label">Your Schedule</div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {activeDisplayDay}'s Classes
                    </h2>
                  </div>
                  <button onClick={() => setCurrentTab('timetable')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Full timetable <ArrowRight style={{ width: 13, height: 13 }} />
                  </button>
                </div>

                {/* Day switcher — minimal pills */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                    const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]
                    const isSelected = activeDisplayDay.toLowerCase() === fullDay.toLowerCase()
                    const count = teacherSlots.filter(s => s.day_of_week.toLowerCase() === fullDay.toLowerCase()).length
                    return (
                      <button key={d} onClick={() => setSelectedScheduleDay(fullDay)}
                        style={{
                          padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: isSelected ? 'var(--saffron)' : 'var(--surface-2)',
                          color: isSelected ? 'white' : 'var(--ink-3)',
                          fontSize: 12, fontWeight: isSelected ? 700 : 500,
                          transition: 'all 0.15s ease',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                        {d}
                        {count > 0 && <span style={{ fontSize: 10, background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--border)', borderRadius: 99, padding: '0 5px' }}>{count}</span>}
                      </button>
                    )
                  })}
                </div>

                {todayTeacherSlots.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <Calendar style={{ width: 24, height: 24, color: 'var(--ink-muted)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No classes scheduled for {activeDisplayDay}.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {todayTeacherSlots.map((slot, idx) => {
                      const canLaunch = isCurrentPeriod(slot)
                      const sc = subjectColor(slot.subject_name)
                      return (
                        <div key={idx} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto',
                          gap: 16, padding: '16px 18px', borderRadius: 12,
                          background: canLaunch ? '#FFF8EE' : 'white',
                          border: `1px solid ${canLaunch ? 'rgba(232,130,12,0.25)' : 'var(--border)'}`,
                          alignItems: 'center', transition: 'all 0.2s ease'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: sc.bg, color: sc.text }}>
                                P{slot.period_number}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{slot.start_time} – {slot.end_time}</span>
                              {canLaunch && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--saffron)', background: 'var(--saffron-bg)', padding: '2px 8px', borderRadius: 6 }}>
                                  NOW
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{slot.subject_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{slot.grade_name} · Batch {slot.section_name} · {slot.room_or_venue || 'Lab'}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button
                              onClick={() => handleInstantLaunchClass(slot)}
                              disabled={!canLaunch || actionLoading === `launch-${slot.period_number}`}
                              className="btn-primary btn-sm"
                              style={{ opacity: canLaunch ? 1 : 0.4 }}
                            >
                              {actionLoading === `launch-${slot.period_number}` ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Play style={{ width: 12, height: 12 }} />}
                              {canLaunch ? 'Launch' : 'Waiting'}
                            </button>
                            <button onClick={() => { setLeaveSlot(slot); setShowLeaveModal(true) }} className="btn-ghost btn-sm" style={{ fontSize: 11 }}>
                              Leave
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* RECENT RECORDINGS */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div className="section-label">Recordings</div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Class Recordings
                    </h2>
                  </div>
                  <button onClick={() => setCurrentTab('classroom')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    All sessions <ArrowRight style={{ width: 13, height: 13 }} />
                  </button>
                </div>
                {recordedClasses.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <Video style={{ width: 24, height: 24, color: 'var(--ink-muted)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>No recordings yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recordedClasses.slice(0, 5).map(cls => (
                      <div key={cls.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderRadius: 10, background: 'white', border: '1px solid var(--border)',
                        cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                        onClick={() => { setSelectedRecordingUrl(cls.recording_url!); setSelectedRecordingClass(cls) }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--saffron)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--saffron-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Play style={{ width: 14, height: 14, color: 'var(--saffron)', fill: 'var(--saffron)', marginLeft: 1 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{cls.subject_name} · Batch {cls.section_name}</div>
                        </div>
                        <ArrowRight style={{ width: 13, height: 13, color: 'var(--ink-muted)', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT */}
            <div style={{ padding: '36px 24px' }}>
              {/* Quick stats — compact inline */}
              <div className="section-label" style={{ marginBottom: 12 }}>Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
                {[
                  { label: 'Sessions Today', value: todayTeacherSlots.length, icon: Calendar, color: 'var(--sky)', bg: 'var(--sky-bg)' },
                  { label: 'Courses', value: teacherCurriculumCourses.length, icon: BookOpen, color: 'var(--lavender)', bg: 'var(--lavender-bg)' },
                  { label: 'Live Now', value: liveClasses.filter(c => c.status === 'live').length, icon: Radio, color: 'var(--coral)', bg: 'var(--coral-bg)' },
                  { label: 'Recordings', value: recordedClasses.length, icon: Video, color: 'var(--sage)', bg: 'var(--sage-bg)' },
                ].map(stat => (
                  <div key={stat.label} style={{ padding: '14px 12px', background: stat.bg, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: stat.color, marginTop: 4, opacity: 0.8 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Courses */}
              <div className="section-label" style={{ marginBottom: 10 }}>My Courses</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                {teacherCurriculumCourses.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', padding: '12px 0' }}>No assigned courses yet.</p>
                ) : teacherCurriculumCourses.slice(0, 4).map(c => {
                  const sc = subjectColor(c.title)
                  return (
                    <button key={c.id} onClick={() => setCurrentTab('courses')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        borderRadius: 10, background: 'white', border: '1px solid var(--border)',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--saffron)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen style={{ width: 13, height: 13, color: sc.accent }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Announcements */}
              {announcements.length > 0 && (
                <>
                  <div className="section-label" style={{ marginBottom: 10 }}>Recent Announcements</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {announcements.slice(0, 2).map(ann => (
                      <div key={ann.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{ann.title}</div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.content}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADMIN DASHBOARD — Command Center
         ══════════════════════════════════════════════════════════════════════ */}
      {user.role === 'admin' && (
        <>
          {/* ADMIN HERO — Clean, information-forward */}
          <div style={{ padding: '40px 48px 36px', borderBottom: '1px solid var(--border)', background: 'var(--canvas-warm)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--saffron)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                <ShieldCheck style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                Institute Command Center
              </div>
              <h1 style={{ margin: 0, marginBottom: 8, fontSize: 32, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, lineHeight: 1.15, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {greeting}, {firstName}.
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-3)', maxWidth: 560 }}>
                Manage your institute. Approve users, schedule timetables, monitor live classes, and broadcast announcements.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={handleRunAiScheduler} disabled={actionLoading === 'scheduler'} className="btn-primary">
                {actionLoading === 'scheduler' ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Cpu style={{ width: 14, height: 14 }} />}
                Run AI Scheduler
              </button>
              <button onClick={() => setShowAnnouncementModal(true)} className="btn-ghost">
                <Bell style={{ width: 14, height: 14 }} /> Broadcast
              </button>
            </div>
          </div>

          {/* ADMIN METRICS ROW — compact, non-card style */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {[
              { label: 'Students', value: statsData.students_total ?? 0, color: 'var(--lavender)', onClick: () => setUserFilter('student') },
              { label: 'Faculty', value: statsData.teachers_total ?? 0, color: 'var(--sky)', onClick: () => setUserFilter('teacher') },
              { label: 'Timetable Slots', value: statsData.timetable_slots_total ?? 36, color: 'var(--sage)', onClick: () => setCurrentTab('timetable') },
              { label: 'Pending Approvals', value: statsData.pending_users ?? 0, color: 'var(--coral)', onClick: () => setUserFilter('pending') },
            ].map((m, i) => (
              <div key={m.label}
                onClick={m.onClick}
                style={{
                  padding: '24px 28px', borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', transition: 'background 0.15s ease', background: 'var(--surface)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
              >
                <div style={{ fontSize: 36, fontWeight: 800, color: m.color, lineHeight: 1, marginBottom: 4 }}>{m.value}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* ADMIN MAIN CONTENT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {/* USER MANAGEMENT */}
            <div style={{ padding: '32px 40px', borderRight: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div className="section-label">People</div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    User Directory
                  </h2>
                </div>
                {/* Filter */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
                  {(['all', 'pending', 'student', 'teacher'] as const).map(f => (
                    <button key={f} onClick={() => setUserFilter(f)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                        background: userFilter === f ? 'var(--saffron)' : 'transparent',
                        color: userFilter === f ? 'white' : 'var(--ink-3)',
                        cursor: 'pointer', textTransform: 'capitalize'
                      }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {adminUsers.filter(u => {
                  if (userFilter === 'pending') return u.status !== 'active'
                  if (userFilter === 'student') return u.role === 'student'
                  if (userFilter === 'teacher') return u.role === 'teacher'
                  return true
                }).slice(0, 20).map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: u.role === 'teacher' ? 'var(--sky-bg)' : 'var(--lavender-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: u.role === 'teacher' ? 'var(--sky)' : 'var(--lavender)'
                    }}>
                      {u.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, textTransform: 'capitalize',
                          background: u.role === 'teacher' ? 'var(--sky-bg)' : 'var(--lavender-bg)',
                          color: u.role === 'teacher' ? 'var(--sky)' : 'var(--lavender)'
                        }}>{u.role}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {u.status !== 'active' ? (
                        <>
                          <button onClick={() => handleApproveUser(u.id, u.role === 'teacher' ? 'teacher' : 'student')}
                            disabled={actionLoading === `approve-${u.id}`}
                            style={{ padding: '4px 10px', borderRadius: 6, background: '#0A7955', color: 'white', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                            {actionLoading === `approve-${u.id}` ? <Loader2 style={{ width: 10, height: 10 }} /> : <Check style={{ width: 10, height: 10 }} />} OK
                          </button>
                          <button onClick={() => handleRejectUser(u.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--coral-bg)', color: 'var(--coral)', border: '1px solid rgba(212,75,47,0.2)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            Reject
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--mint)', background: 'var(--mint-bg)', padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <CheckCircle2 style={{ width: 10, height: 10 }} /> Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {adminUsers.filter(u => {
                  if (userFilter === 'pending') return u.status !== 'active'
                  if (userFilter === 'student') return u.role === 'student'
                  if (userFilter === 'teacher') return u.role === 'teacher'
                  return true
                }).length === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
                    No users in this category.
                  </div>
                )}
              </div>
            </div>

            {/* LIVE SESSIONS */}
            <div style={{ padding: '32px 40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div className="section-label">Classrooms</div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Live Sessions
                  </h2>
                </div>
                <button onClick={() => setCurrentTab('classroom')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  All sessions <ArrowRight style={{ width: 13, height: 13 }} />
                </button>
              </div>

              {liveClasses.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <Video style={{ width: 24, height: 24, color: 'var(--ink-muted)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No live sessions today.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                  {liveClasses.slice(0, 10).map(cls => (
                    <div key={cls.id} style={{
                      padding: '12px 14px', borderRadius: 10, background: 'white',
                      border: `1px solid ${cls.status === 'live' ? 'rgba(185,28,28,0.2)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          {cls.status === 'live' && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: '#B91C1C', background: '#FEF2F2', border: '1px solid rgba(185,28,28,0.2)', borderRadius: 99, padding: '2px 7px', textTransform: 'uppercase', animation: 'pulse-dot 1.5s infinite' }}>
                              ● Live
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{cls.grade_name} · Batch {cls.section_name}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{cls.teacher_name || 'Faculty'}</div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {cls.recording_url ? (
                          <button onClick={() => { setSelectedRecordingUrl(cls.recording_url!); setSelectedRecordingClass(cls) }}
                            className="btn-ghost btn-sm">
                            <Video style={{ width: 11, height: 11 }} /> Watch
                          </button>
                        ) : cls.status === 'live' ? (
                          <button onClick={() => setCurrentTab('classroom')} className="btn-primary btn-sm">
                            <Play style={{ width: 11, height: 11 }} /> Join
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Announcements */}
              {announcements.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <div className="section-label" style={{ marginBottom: 12 }}>Announcements</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {announcements.slice(0, 3).map(ann => (
                      <div key={ann.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{ann.title}</div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
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
