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
  CheckSquare,
  FileText,
  Award,
  Users,
  UserCheck,
  Radio,
  Video,
  Calendar,
  Sparkles,
  Plus,
  Play,
  AlertCircle,
  CheckCircle2,
  Bell,
  Send,
  Clock,
  X,
  ChevronRight,
  GraduationCap,
  ShieldCheck,
  Check,
  Loader2
} from 'lucide-react'
import { AiRecordingPlayerModal } from '../components/AiRecordingPlayerModal'

type DashboardPageProps = {
  user: User
  summary: DashboardSummary | null
  setCurrentTab: (tab: string) => void
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, summary, setCurrentTab }) => {
  // Live Data States
  const [statsData, setStatsData] = useState<Record<string, number>>(summary?.stats || {})
  const [liveClasses, setLiveClasses] = useState<SchoolLiveClass[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [teacherSlots, setTeacherSlots] = useState<TeacherTimetableSlot[]>([])
  const [teacherCurriculumCourses, setTeacherCurriculumCourses] = useState<SchoolCourse[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [studentTimetable, setStudentTimetable] = useState<TimetableSlot[]>([])
  const [currentTime, setCurrentTime] = useState(() => new Date())

  // UI & Loading States
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [selectedRecordingUrl, setSelectedRecordingUrl] = useState<string | null>(null)
  const [selectedRecordingClass, setSelectedRecordingClass] = useState<any | null>(null)
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'student' | 'teacher'>('all')

  // Announcement Modal State
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'teacher' | 'student'>('all')

  // Leave Modal State (Teacher)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveSlot, setLeaveSlot] = useState<TeacherTimetableSlot | null>(null)
  const [leaveReason, setLeaveReason] = useState('')

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Load live data based on role
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      // 1. Fetch fresh summary stats
      const freshSummary = await getDashboardSummary().catch(() => null)
      if (freshSummary?.stats) {
        setStatsData(freshSummary.stats)
      }

      // 2. Announcements & Live classes (relevant to everyone)
      const [classesRes, announceRes] = await Promise.all([
        getSchoolLiveClasses().catch(() => []),
        getAnnouncements().catch(() => [])
      ])
      setLiveClasses(classesRes || [])
      setAnnouncements(announceRes || [])

      // 3. Role-specific data
      if (user.role === 'admin') {
        const usersRes = await getAdminUsers().catch(() => [])
        setAdminUsers(usersRes || [])
      } else if (user.role === 'teacher') {
        const [slotsRes, curriculumRes] = await Promise.all([
          getTeacherTimetableSlots().catch(() => []),
          getSchoolCourses({
            user_email: user.email,
            user_role: user.role
          }).catch(() => [])
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
      console.warn('Dashboard data fetch note:', err)
    } finally {
      setLoading(false)
    }
  }, [user.email, user.role])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // ── ADMIN WORKING FUNCTIONS ──────────────────────────────────────────────────
  const handleRunAiScheduler = async () => {
    setActionLoading('scheduler')
    try {
      const res = await generateTimetable()
      showToast(
        `AI Scheduler finished! ${res.total_slots_scheduled} slots scheduled with zero conflicts across ${res.total_sections} sections.`,
        'success'
      )
      loadDashboardData()
    } catch (err: any) {
      showToast(err.message || 'Timetable generation encountered an issue.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveUser = async (userId: string, role: 'student' | 'teacher') => {
    setActionLoading(`approve-${userId}`)
    try {
      await approveUser(userId, role)
      showToast(`User successfully activated as ${role}!`, 'success')
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active', role } : u))
      setStatsData(prev => ({
        ...prev,
        pending_users: Math.max(0, (prev.pending_users || 1) - 1),
        active_users: (prev.active_users || 0) + 1
      }))
    } catch (err: any) {
      showToast(err.message || 'Could not approve user.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectUser = async (userId: string) => {
    setActionLoading(`reject-${userId}`)
    try {
      await rejectUser(userId)
      showToast('User account deactivated.', 'info')
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'inactive' } : u))
    } catch (err: any) {
      showToast(err.message || 'Could not deactivate user.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── ANNOUNCEMENT BROADCAST WORKING FUNCTION ─────────────────────────────────
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcementTitle.trim() || !announcementBody.trim()) return

    setActionLoading('announcement')
    try {
      const res = await createAnnouncement({
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        audience_role: announcementAudience
      })
      showToast('Institute announcement broadcasted successfully!', 'success')
      setAnnouncements(prev => [res, ...prev])
      setShowAnnouncementModal(false)
      setAnnouncementTitle('')
      setAnnouncementBody('')
    } catch (err: any) {
      showToast(err.message || 'Failed to post announcement.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── TEACHER WORKING FUNCTIONS ────────────────────────────────────────────────
  const handleInstantLaunchClass = async (slot: TeacherTimetableSlot) => {
    setActionLoading(`launch-${slot.period_number}`)
    try {
      const now = new Date()
      const end = new Date(now.getTime() + 45 * 60 * 1000)
      const res = await createSchoolLiveClass({
        title: `${slot.subject_name} Live Session (${slot.grade_name || 'Course'} • Batch ${slot.section_name})`,
        starts_at: now.toISOString(),
        ends_at: end.toISOString(),
        grade_number: slot.grade_number,
        section_name: slot.section_name,
        subject_code: slot.subject_code,
        subject_name: slot.subject_name,
        period_number: slot.period_number,
        room_number: slot.room_or_venue,
        status: 'live'
      })
      showToast(`Launching Live Session for ${slot.subject_name} (Batch ${slot.section_name})...`, 'success')
      const zoomUrl = res.zoom_start_url || res.zoom_join_url || res.meeting_url
      if (zoomUrl && (zoomUrl.startsWith('http://') || zoomUrl.startsWith('https://'))) {
        window.open(zoomUrl, '_blank')
      }
      setCurrentTab('classroom')
    } catch (err: any) {
      showToast(err.message || 'Could not launch class session.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveSlot || !leaveReason.trim()) return

    setActionLoading('leave')
    try {
      await recordTeacherLeave({
        teacher_id: user.id,
        day_of_week: leaveSlot.day_of_week,
        reason: leaveReason.trim()
      })
      showToast('Leave recorded. Timetable AI notified for automatic substitution.', 'success')
      setShowLeaveModal(false)
      setLeaveReason('')
      setLeaveSlot(null)
    } catch (err: any) {
      showToast(err.message || 'Failed to submit leave request.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const [selectedScheduleDay, setSelectedScheduleDay] = useState<string>('')

  const activeLiveClass = liveClasses.find(c => c.status === 'live')
  const currentWeekday = currentTime.toLocaleDateString('en-US', { weekday: 'long' })
  const activeDisplayDay = selectedScheduleDay || currentWeekday

  const todayTeacherSlots = teacherSlots
    .filter(slot => slot.day_of_week.toLowerCase() === activeDisplayDay.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
  const isCurrentPeriod = (slot: TeacherTimetableSlot) => {
    if (activeDisplayDay.toLowerCase() !== currentWeekday.toLowerCase()) return false
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number)
      return hours * 60 + minutes
    }
    return currentMinutes >= toMinutes(slot.start_time) && currentMinutes < toMinutes(slot.end_time)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* ── TOAST NOTIFICATION ───────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200 max-w-md bg-white ${
          toast.type === 'success'
            ? 'border-emerald-200 text-emerald-800 shadow-emerald-500/10'
            : toast.type === 'error'
            ? 'border-rose-200 text-rose-800 shadow-rose-500/10'
            : 'border-amber-200 text-amber-800 shadow-amber-500/10'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
        </div>
      )}

      {/* ── LIVE DATA REFRESHING BAR ────────────────────────────────────────── */}
      {loading && (
        <div className="h-1 w-full bg-slate-100 overflow-hidden rounded-full">
          <div className="h-full bg-amber-500 w-1/3 animate-pulse" />
        </div>
      )}

      {/* ── ROLE-SPECIFIC HERO BANNER ────────────────────────────────────────── */}
      {user.role === 'admin' && (
        <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white border border-amber-200/80 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white text-amber-800 border border-amber-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  Institutional Command Center
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Platform Active
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome, Administrator {user.display_name}
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm max-w-2xl leading-relaxed font-normal">
                Manage academy operations, trigger autonomous timetable scheduling, oversee faculty assignments, and broadcast institutional announcements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={handleRunAiScheduler}
                disabled={actionLoading === 'scheduler'}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading === 'scheduler' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Cpu className="w-4 h-4" />
                )}
                <span>Run AI Auto-Scheduler</span>
              </button>

              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
              >
                <Bell className="w-4 h-4 text-amber-600" />
                <span>Broadcast Notice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {user.role === 'teacher' && (
        <div className="bg-gradient-to-r from-orange-50/90 via-amber-50/40 to-white border border-orange-200/80 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white text-orange-800 border border-orange-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                  <GraduationCap className="w-3.5 h-3.5 text-orange-600" />
                  Faculty Instructor Desk
                </span>
                <span className="text-xs text-slate-500">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome back, {user.display_name}
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm max-w-2xl leading-relaxed font-normal">
                Review your assigned technical batch schedule for today, initiate live Zoom classroom video streams with cloud recording, and manage your students.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={() => setCurrentTab('classroom')}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Go to Classroom</span>
              </button>

              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
              >
                <Bell className="w-4 h-4 text-amber-600" />
                <span>Announce to Students</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {user.role === 'student' && (
        <div className="bg-gradient-to-r from-amber-50/90 via-yellow-50/40 to-white border border-amber-200/80 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-200/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white text-amber-800 border border-amber-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Candidate Training Portal
                </span>
                <span className="text-xs text-slate-500">Professional Course Program</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Hello, {user.display_name}
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm max-w-2xl leading-relaxed font-normal">
                Track your course milestones, attend live Zoom interactive lectures, download faculty learning resources, and review past class recordings.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={() => setCurrentTab('classroom')}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>Join Live Class</span>
              </button>

              <button
                onClick={() => setCurrentTab('courses')}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span>Explore Catalog</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE NOW HERO BANNER (Visible if any class is currently live) ─── */}
      {activeLiveClass && (
        <div className="bg-gradient-to-r from-rose-50 via-red-50/50 to-white border border-rose-200 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                  CLASS LIVE NOW
                </span>
                <span className="text-xs text-slate-500">
                  {activeLiveClass.grade_name || 'Course'} • Batch {activeLiveClass.section_name} &bull; Period {activeLiveClass.period_number || 1}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                {activeLiveClass.title}
              </h3>
              <p className="text-xs text-slate-600">
                Instructor: <span className="text-amber-700 font-semibold">{activeLiveClass.teacher_name || 'Faculty Member'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCurrentTab('classroom')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Join Live Session</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STATS CARDS GRID (Role Tailored Pastel Cards) ──────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {user.role === 'admin' && (
          <>
            <div
              onClick={() => setUserFilter('student')}
              className="bg-[#F4F1FD] border border-[#E5DEFF] hover:border-[#D1C4FE] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#6E56CF]">Enrolled Students</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#6E56CF] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{statsData.students_total ?? 0}</p>
              <p className="text-[11px] text-[#6E56CF] mt-2 font-semibold flex items-center gap-1">
                Filter students &rarr;
              </p>
            </div>

            <div
              onClick={() => setUserFilter('teacher')}
              className="bg-[#EAF5FF] border border-[#D0EAFF] hover:border-[#B5DEFF] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#0284C7]">Certified Faculty</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#0284C7] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{statsData.teachers_total ?? 0}</p>
              <p className="text-[11px] text-[#0284C7] mt-2 font-semibold flex items-center gap-1">
                Filter teachers &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('timetable')}
              className="bg-[#ECFDF5] border border-[#C6F6D5] hover:border-[#9AE6B4] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#059669]">Scheduled Slots</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#059669] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{statsData.timetable_slots_total ?? 36}</p>
              <p className="text-[11px] text-[#059669] mt-2 font-semibold flex items-center gap-1">
                View Timetable &rarr;
              </p>
            </div>

            <div
              onClick={() => setUserFilter('pending')}
              className={`rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group ${
                (statsData.pending_users ?? 0) > 0 ? 'bg-[#FFF7ED] border border-[#FED7AA]' : 'bg-slate-50 border border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#EA580C]">Pending Approvals</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#EA580C] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{statsData.pending_users ?? 0}</p>
              <p className="text-[11px] text-[#EA580C] mt-2 font-semibold flex items-center gap-1">
                Review accounts &rarr;
              </p>
            </div>
          </>
        )}

        {user.role === 'teacher' && (
          <>
            <div
              onClick={() => setCurrentTab('timetable')}
              className="bg-[#EAF5FF] border border-[#D0EAFF] hover:border-[#B5DEFF] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#0284C7]">My Daily Periods</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#0284C7] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{todayTeacherSlots.length}</p>
              <p className="text-[11px] text-[#0284C7] mt-2 font-semibold flex items-center gap-1">
                Manage schedule &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('classroom')}
              className="bg-[#FFF1F0] border border-[#FFD0CE] hover:border-[#FFAAA6] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#E11D48]">Live Lectures Today</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#E11D48] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{liveClasses.length}</p>
              <p className="text-[11px] text-[#E11D48] mt-2 font-semibold flex items-center gap-1">
                Open Classroom &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('courses')}
              className="bg-[#F4F1FD] border border-[#E5DEFF] hover:border-[#D1C4FE] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#6E56CF]">Curriculum Courses</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#6E56CF] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{teacherCurriculumCourses.length}</p>
              <p className="text-[11px] text-[#6E56CF] mt-2 font-semibold flex items-center gap-1">
                Edit curriculum &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('assignments')}
              className="bg-[#FFF7ED] border border-[#FFEDD5] hover:border-[#FED7AA] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#EA580C]">Student Submissions</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#EA580C] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{statsData.submissions ?? 0}</p>
              <p className="text-[11px] text-[#EA580C] mt-2 font-semibold flex items-center gap-1">
                Grade submissions &rarr;
              </p>
            </div>
          </>
        )}

        {user.role === 'student' && (
          <>
            <div
              onClick={() => setCurrentTab('courses')}
              className="bg-[#F4F1FD] border border-[#E5DEFF] hover:border-[#D1C4FE] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#6E56CF]">Enrolled Courses</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#6E56CF] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{enrollments.length}</p>
              <p className="text-[11px] text-[#6E56CF] mt-2 font-semibold flex items-center gap-1">
                Resume course &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('classroom')}
              className="bg-[#FFF1F0] border border-[#FFD0CE] hover:border-[#FFAAA6] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#E11D48]">Live Lectures</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#E11D48] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Radio className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{liveClasses.length}</p>
              <p className="text-[11px] text-[#E11D48] mt-2 font-semibold flex items-center gap-1">
                Join session &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('assessments')}
              className="bg-[#ECFDF5] border border-[#C6F6D5] hover:border-[#9AE6B4] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#059669]">Quizzes & Tests</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#059669] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckSquare className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{statsData.assessments ?? 0}</p>
              <p className="text-[11px] text-[#059669] mt-2 font-semibold flex items-center gap-1">
                Take quiz &rarr;
              </p>
            </div>

            <div
              onClick={() => setCurrentTab('timetable')}
              className="bg-[#FFFBEB] border border-[#FDE68A] hover:border-[#FCD34D] rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-xs group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#D97706]">Class Timetable</span>
                <div className="w-9 h-9 rounded-xl bg-white text-[#D97706] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900">{studentTimetable.length > 0 ? studentTimetable.length : 36}</p>
              <p className="text-[11px] text-[#D97706] mt-2 font-semibold flex items-center gap-1">
                Weekly schedule &rarr;
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── TEACHER INTERACTIVE TIMETABLE SCHEDULE BOARD ──────────────────── */}
      {user.role === 'teacher' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                Your Teaching Schedule ({activeDisplayDay}'s Assigned Periods)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                One-click live classroom launching with synchronized whiteboard and automatic Cloudinary recording.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentTab('timetable')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Full Timetable Grid</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7-Day Quick Switcher Bar */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
              const isToday = day.toLowerCase() === currentWeekday.toLowerCase()
              const isSelected = activeDisplayDay.toLowerCase() === day.toLowerCase()
              const daySlotCount = teacherSlots.filter(s => s.day_of_week.toLowerCase() === day.toLowerCase()).length
              return (
                <button
                  key={day}
                  onClick={() => setSelectedScheduleDay(day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <span>{day.slice(0, 3)}</span>
                  {isToday && (
                    <span className={`text-[9px] px-1 rounded font-extrabold uppercase ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                      Today
                    </span>
                  )}
                  {daySlotCount > 0 && (
                    <span className={`text-[10px] px-1.5 rounded-full ${isSelected ? 'bg-white/30 text-white font-black' : 'bg-slate-200 text-slate-700'}`}>
                      {daySlotCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {todayTeacherSlots.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-slate-100 space-y-3">
              <Sparkles className="w-8 h-8 text-amber-500 mx-auto opacity-70" />
              <p className="text-sm font-semibold text-slate-700">
                {activeDisplayDay === 'Sunday' || activeDisplayDay === 'Saturday'
                  ? `${activeDisplayDay} Weekend • Scheduled Institute Off-Day & Self-Paced Coding Sandbox`
                  : `No timetable periods assigned to your profile for ${activeDisplayDay}.`}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {activeDisplayDay === 'Sunday' || activeDisplayDay === 'Saturday'
                  ? 'Faculty lectures resume on Monday. You can preview Monday\'s technical schedule below or configure slots in the Timetable hub.'
                  : 'Ask the administrator to run the AI Auto-Scheduler or switch to the Timetable tab to configure your periods.'}
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                {(activeDisplayDay === 'Sunday' || activeDisplayDay === 'Saturday') && (
                  <button
                    onClick={() => setSelectedScheduleDay('Monday')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Preview Monday's Schedule &rarr;
                  </button>
                )}
                <button
                  onClick={() => setCurrentTab('timetable')}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  Open Timetable Hub
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todayTeacherSlots.map((slot, idx) => {
                const canLaunch = isCurrentPeriod(slot)
                return (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-800 border border-orange-200 text-[11px] font-bold">
                          Period {slot.period_number}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {slot.start_time} - {slot.end_time}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-base text-slate-900 group-hover:text-amber-700 transition-colors">
                          {slot.subject_name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {slot.grade_name || 'Course'} • Batch {slot.section_name} &bull; {slot.subject_code}
                        </p>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span className="text-slate-400">Venue:</span>
                        <span className="font-semibold text-slate-800">{slot.room_or_venue || 'Technical Lab Hall'}</span>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center gap-2">
                      <button
                        onClick={() => handleInstantLaunchClass(slot)}
                        disabled={!canLaunch || actionLoading === `launch-${slot.period_number}`}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          canLaunch
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs active:scale-95'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        }`}
                      >
                        {actionLoading === `launch-${slot.period_number}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{canLaunch ? 'Launch Class' : 'Not Active'}</span>
                      </button>

                      <button
                        onClick={() => { setLeaveSlot(slot); setShowLeaveModal(true); }}
                        className="px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        title="Request substitute teacher or report leave"
                      >
                        Sub / Leave
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN LIVE SESSIONS & USER APPROVAL DESK ───────────────────────── */}
      {user.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* USER MANAGEMENT & APPROVAL DESK */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  User Directory & Role Approvals
                </h2>
                <p className="text-xs text-slate-500">
                  {adminUsers.length} total accounts registered across academy
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-[11px] font-semibold">
                {(['all', 'pending', 'student', 'teacher'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setUserFilter(tab)}
                    className={`px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                      userFilter === tab ? 'bg-amber-500 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-100">
              {adminUsers
                .filter(u => {
                  if (userFilter === 'pending') return u.status !== 'active'
                  if (userFilter === 'student') return u.role === 'student'
                  if (userFilter === 'teacher') return u.role === 'teacher'
                  return true
                })
                .slice(0, 15)
                .map(u => (
                  <div
                    key={u.id}
                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-200">
                        {u.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-800 truncate">{u.display_name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                            u.role === 'admin'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : u.role === 'teacher'
                              ? 'bg-orange-50 text-orange-800 border border-orange-200'
                              : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {u.status !== 'active' ? (
                        <>
                          <button
                            onClick={() => handleApproveUser(u.id, u.role === 'teacher' ? 'teacher' : 'student')}
                            disabled={actionLoading === `approve-${u.id}`}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {actionLoading === `approve-${u.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleRejectUser(u.id)}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* RECENT LIVE CLASSES & RECORDINGS */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Video className="w-5 h-5 text-amber-600" />
                  Live Classroom Sessions & Cloud Recordings
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time status across all grade levels
                </p>
              </div>
              <button
                onClick={() => setCurrentTab('classroom')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Classroom View</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {liveClasses.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <Video className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-semibold">No live sessions recorded yet today.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-100">
                {liveClasses.slice(0, 10).map(cls => (
                  <div
                    key={cls.id}
                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-xl transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {cls.grade_name || 'Course'} • Batch {cls.section_name}
                        </span>
                        {cls.status === 'live' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                            ● LIVE NOW
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">Ended</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate">{cls.title}</h4>
                      <p className="text-[11px] text-slate-500">
                        Instructor: {cls.teacher_name || 'Assigned Faculty'} &bull; Period {cls.period_number || 1}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {cls.recording_url ? (
                        <button
                          onClick={() => { setSelectedRecordingUrl(cls.recording_url!); setSelectedRecordingClass(cls); }}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Video className="w-3.5 h-3.5 text-amber-700" />
                          <span>Watch</span>
                        </button>
                      ) : cls.status === 'live' ? (
                        <button
                          onClick={() => setCurrentTab('classroom')}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Join</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STUDENT RECORDED LECTURES & REPLAYS ────────────────────────────── */}
      {user.role === 'student' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Video className="w-5 h-5 text-amber-600" />
                Recorded Class Lectures & Cloud Replays
              </h2>
              <p className="text-xs text-slate-500">
                Watch past classes taught by your faculty with synchronized video and audio playback.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('classroom')}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View in Classroom</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {liveClasses.filter(c => !!c.recording_url).length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <Video className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No lecture recordings available yet.</p>
              <p className="text-[11px] text-slate-400">When teachers record their live classes, recordings will show up here for you to watch anytime.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveClasses.filter(c => !!c.recording_url).map(cls => (
                <div
                  key={cls.id}
                  className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all group hover:-translate-y-0.5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-800 border border-orange-200 text-[11px] font-bold">
                        {cls.grade_name || 'Course'} • Batch {cls.section_name}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Watch
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-1">
                        {cls.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cls.subject_name || 'Subject Lecture'} &bull; Period {cls.period_number || 1}
                      </p>
                    </div>

                    <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-slate-400">Instructor:</span>
                      <span className="font-semibold text-slate-800">{cls.teacher_name || 'Faculty Member'}</span>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => { setSelectedRecordingUrl(cls.recording_url!); setSelectedRecordingClass(cls); }}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Watch Recording</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STUDENT ACTIVE COURSES & GRADE TIMETABLE ────────────────────────── */}
      {user.role === 'student' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MY ENROLLED SUBJECTS */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                  My Enrolled Courses & Subjects
                </h2>
                <p className="text-xs text-slate-500">Track your progress and continue course material</p>
              </div>
              <button
                onClick={() => setCurrentTab('courses')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Browse All</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {enrollments.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">You are not enrolled in any course tracks yet.</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Course enrollments are assigned directly by the institute administrator. Once your enrollment is activated by the admin, your respective subjects and syllabus materials will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {enrollments.map(en => (
                  <div
                    key={en.id}
                    className="p-3.5 bg-slate-50/70 border border-slate-200 hover:border-amber-300 rounded-2xl flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="min-w-0 space-y-1 text-left">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors truncate">
                        {en.course?.title || (en.course as any)?.slug?.replace(/-/g, ' ') || 'Institute Course'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Status: <span className="capitalize text-emerald-700 font-bold">{en.status}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => setCurrentTab('courses')}
                      className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <span>Study</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CLASS TIMETABLE PREVIEW */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  Today's Classroom Timetable
                </h2>
                <p className="text-xs text-slate-500">Periods and venue schedule for your track</p>
              </div>
              <button
                onClick={() => setCurrentTab('timetable')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Full Timetable</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
              const todayName = dayNames[currentTime.getDay()]
              const todaySlots = studentTimetable.filter(s => s.day_of_week === todayName)
              const slotsToRender = (todaySlots.length > 0 ? todaySlots : studentTimetable)
                .filter(s => s.period_number > 0 || (s.subject_name && !s.subject_name.toLowerCase().includes('assembly')))
                .sort((a, b) => a.period_number - b.period_number)

              if (slotsToRender.length === 0) {
                return (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">No active classes scheduled today. Check full weekly grid.</p>
                    <button
                      onClick={() => setCurrentTab('timetable')}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      View Timetable Grid
                    </button>
                  </div>
                )
              }

              return (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {slotsToRender.slice(0, 6).map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-200">
                          P{slot.period_number}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{slot.subject_name || slot.subject_code || 'Technical Masterclass'}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {slot.room_or_venue || 'Cloud Sandbox'} &bull; {slot.day_of_week}
                            {slot.teacher_name && <span className="text-amber-700"> &bull; {slot.teacher_name}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-slate-700 font-semibold shrink-0">
                        {slot.start_time} - {slot.end_time}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── SCHOOL ANNOUNCEMENTS FEED (For All Roles) ────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600" />
              Institute Announcements & Bulletins
            </h2>
            <p className="text-xs text-slate-500">Official updates from faculty and administrators</p>
          </div>

          {(user.role === 'admin' || user.role === 'teacher') && (
            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>Post Announcement</span>
            </button>
          )}
        </div>

        {announcements.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">No active announcements posted.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {announcements.slice(0, 6).map(an => (
              <div
                key={an.id}
                className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-3 hover:border-slate-300 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                      Official Notice
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(an.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{an.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {an.content || (an as any).body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL: CLOUDINARY CLASS RECORDING PLAYER WITH AI DOUBT SOLVER ───── */}
      {selectedRecordingUrl && (
        <AiRecordingPlayerModal
          recordingUrl={selectedRecordingUrl}
          classInfo={selectedRecordingClass}
          onClose={() => {
            setSelectedRecordingUrl(null)
            setSelectedRecordingClass(null)
          }}
        />
      )}

      {/* ── MODAL: BROADCAST INSTITUTIONAL ANNOUNCEMENT ──────────────────────── */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600" />
                Broadcast Institutional Notice
              </h3>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mid-Term Examination Schedule & Practical Labs"
                  value={announcementTitle}
                  onChange={e => setAnnouncementTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Audience
                </label>
                <select
                  value={announcementAudience}
                  onChange={e => setAnnouncementAudience(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                >
                  <option value="all">Everyone (All Students & Faculty)</option>
                  <option value="student">Students Only</option>
                  <option value="teacher">Faculty Teachers Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notice Details / Body Content
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type the announcement details and guidelines..."
                  value={announcementBody}
                  onChange={e => setAnnouncementBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'announcement'}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading === 'announcement' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Publish Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: TEACHER LEAVE & SUBSTITUTION REQUEST ─────────────────────── */}
      {showLeaveModal && leaveSlot && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                Report Leave & Request Substitution
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1 text-xs">
              <p className="text-slate-900 font-bold">{leaveSlot.subject_name}</p>
              <p className="text-slate-500">
                Period {leaveSlot.period_number} &bull; {leaveSlot.grade_name || 'Course'} • Batch {leaveSlot.section_name} ({leaveSlot.day_of_week})
              </p>
            </div>

            <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Absence
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g., Medical appointment, family emergency, academic conference..."
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'leave'}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading === 'leave' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Submit Leave Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
