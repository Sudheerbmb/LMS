import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  BookOpen,
  User as UserIcon,
  Video,
  ExternalLink,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  LayoutGrid,
  ListFilter,
  CalendarDays,
  RotateCcw
} from 'lucide-react'
import {
  getTimetableGrid,
  createTimetableSlot,
  updateSlot,
  deleteTimetableSlot,
  resetTimetableSchedule,
  getAdminCourses,
  getAdminUsers,
  type TimetableSlot,
  type TimetableSlotCreatePayload,
  type AdminInstituteCourse,
  type AdminInstituteUser,
  type User,
  type SchoolGrade
} from '../lib/api'

export const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DEFAULT_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const getTrackDisplayName = (g: SchoolGrade | undefined | null) => {
  if (!g) return 'Course'
  return g.name || 'Course'
}

const COLOR_PRESETS = [
  { label: 'Orange', value: '#FF7A00' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Emerald', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Rose', value: '#EF4444' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Slate', value: '#64748B' },
]

const SLOT_TYPES = [
  { label: 'Lecture', value: 'lecture' },
  { label: 'Hands-on Lab', value: 'lab' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Mentorship / Standup', value: 'standup' },
  { label: 'Code Review', value: 'review' },
  { label: 'Masterclass', value: 'masterclass' },
]

// Convert "HH:MM" to minutes from midnight
function timeToMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// Check if two time intervals overlap
function isTimeOverlapping(s1: string, e1: string, s2: string, e2: string): boolean {
  const start1 = timeToMinutes(s1)
  const end1 = timeToMinutes(e1)
  const start2 = timeToMinutes(s2)
  const end2 = timeToMinutes(e2)
  return Math.max(start1, start2) < Math.min(end1, end2)
}

export const TimetablePage: React.FC<{ user: User | null }> = ({ user: currentUser }) => {
  const role = currentUser?.role || 'student'
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'

  // Single normalized dataset state
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [courses, setCourses] = useState<AdminInstituteCourse[]>([])
  const [teachers, setTeachers] = useState<AdminInstituteUser[]>([])

  // UI & network state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusToast, setStatusToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filters state
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all')
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all')
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all')

  // View mode & active day selection
  const [viewMode, setViewMode] = useState<'grid' | 'daily'>('grid')
  const currentWeekday = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[new Date().getDay()] || 'Monday'
  }, [])
  const [activeAgendaDay, setActiveAgendaDay] = useState<string>(currentWeekday)

  // CRUD Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [slotToEdit, setSlotToEdit] = useState<TimetableSlot | null>(null)
  const [slotToDelete, setSlotToDelete] = useState<TimetableSlot | null>(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    course_id: '',
    subject_name: '',
    subject_code: '',
    subject_color: '#FF7A00',
    teacher_id: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:30',
    period_number: 1,
    slot_type: 'lecture',
    room_or_venue: 'Online Classroom / Zoom',
    meeting_url: '',
  })

  // Auto-dismiss status toast
  useEffect(() => {
    if (statusToast) {
      const timer = setTimeout(() => setStatusToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [statusToast])

  // Single fetch routine for metadata & slots
  const loadTimetableData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [coursesRes, usersRes] = await Promise.all([
        getAdminCourses().catch(() => []),
        getAdminUsers().catch(() => []),
      ])

      const fetchedCourses = coursesRes || []
      setCourses(fetchedCourses)

      const fetchedFaculty = (usersRes || []).filter(
        (u: AdminInstituteUser) => u.role === 'teacher' || u.role === 'admin'
      )
      setTeachers(fetchedFaculty)

      // Fetch slots according to role and active filters
      let params: { course_id?: string; teacher_id?: string; day_of_week?: string } | undefined = undefined
      if (isAdmin) {
        params = {}
        if (selectedCourseFilter !== 'all') params.course_id = selectedCourseFilter
        if (selectedTeacherFilter !== 'all') params.teacher_id = selectedTeacherFilter
        if (selectedDayFilter !== 'all') params.day_of_week = selectedDayFilter
      }

      const slotsRes = await getTimetableGrid(params)
      setSlots(slotsRes || [])
    } catch (err: any) {
      console.error('Failed to load timetable state:', err)
      setError(err.message || 'Unable to load timetable. Please verify connection and retry.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, selectedCourseFilter, selectedTeacherFilter, selectedDayFilter])

  useEffect(() => {
    loadTimetableData()
  }, [loadTimetableData])

  // Derived metrics from normalized state
  const metrics = useMemo(() => {
    const scheduledClasses = slots.length
    const databaseCourses = courses.length
    const facultyMentors = teachers.length
    const activeToday = slots.filter(
      (s) => s.day_of_week.toLowerCase() === currentWeekday.toLowerCase()
    ).length

    return { scheduledClasses, databaseCourses, facultyMentors, activeToday }
  }, [slots, courses, teachers, currentWeekday])

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map: Record<string, TimetableSlot[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    }

    slots.forEach((s) => {
      const day = s.day_of_week ? s.day_of_week.charAt(0).toUpperCase() + s.day_of_week.slice(1).toLowerCase() : 'Monday'
      if (map[day]) {
        map[day].push(s)
      } else {
        map['Monday'].push(s)
      }
    })

    // Sort chronologically by start_time
    Object.keys(map).forEach((day) => {
      map[day].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })

    return map
  }, [slots])

  // Populate form fields based on selected course
  const handleCourseSelection = (courseId: string) => {
    const c = courses.find((item) => item.id === courseId)
    if (!c) {
      setFormData((prev) => ({ ...prev, course_id: courseId }))
      return
    }

    const firstSubject = c.subjects?.[0]
    setFormData((prev) => ({
      ...prev,
      course_id: courseId,
      subject_name: firstSubject ? firstSubject.name : c.title,
      subject_code: firstSubject ? firstSubject.code : c.slug.slice(0, 8).toUpperCase(),
      subject_color: firstSubject?.color || '#FF7A00',
      teacher_id: firstSubject?.teacher_id || prev.teacher_id || (teachers[0]?.id || ''),
    }))
  }

  // Open Create Modal
  const openCreateModal = () => {
    setModalError(null)
    const initialCourse = courses[0]
    const initialSubject = initialCourse?.subjects?.[0]

    setFormData({
      course_id: initialCourse?.id || '',
      subject_name: initialSubject ? initialSubject.name : (initialCourse?.title || ''),
      subject_code: initialSubject ? initialSubject.code : (initialCourse?.slug.slice(0, 8).toUpperCase() || 'CLS-101'),
      subject_color: initialSubject?.color || '#FF7A00',
      teacher_id: initialSubject?.teacher_id || (teachers[0]?.id || ''),
      day_of_week: activeAgendaDay || 'Monday',
      start_time: '09:00',
      end_time: '10:30',
      period_number: 1,
      slot_type: 'lecture',
      room_or_venue: 'Online Classroom / Zoom',
      meeting_url: '',
    })
    setShowAddModal(true)
  }

  // Open Edit Modal
  const openEditModal = (slot: TimetableSlot) => {
    setModalError(null)
    setSlotToEdit(slot)
    setFormData({
      course_id: slot.course_id || '',
      subject_name: slot.subject_name || slot.course_title || '',
      subject_code: slot.subject_code || '',
      subject_color: slot.subject_color || '#FF7A00',
      teacher_id: slot.teacher_id || '',
      day_of_week: slot.day_of_week || 'Monday',
      start_time: slot.start_time || '09:00',
      end_time: slot.end_time || '10:30',
      period_number: slot.period_number || 1,
      slot_type: slot.slot_type || 'lecture',
      room_or_venue: slot.room_or_venue || 'Online Classroom / Zoom',
      meeting_url: slot.meeting_url || '',
    })
    setShowEditModal(true)
  }

  // Conflict and validation check
  const validateForm = (isEditing: boolean, editId?: string): boolean => {
    if (!formData.course_id) {
      setModalError('Please select a course.')
      return false
    }
    if (!formData.subject_name.trim()) {
      setModalError('Subject or class title is required.')
      return false
    }
    if (!formData.start_time || !formData.end_time) {
      setModalError('Both start time and end time are required.')
      return false
    }
    if (timeToMinutes(formData.end_time) <= timeToMinutes(formData.start_time)) {
      setModalError('End time must be after start time.')
      return false
    }

    // Check teacher scheduling conflicts
    if (formData.teacher_id) {
      const teacherConflict = slots.find((s) => {
        if (isEditing && s.id === editId) return false
        return (
          s.day_of_week.toLowerCase() === formData.day_of_week.toLowerCase() &&
          s.teacher_id === formData.teacher_id &&
          isTimeOverlapping(s.start_time, s.end_time, formData.start_time, formData.end_time)
        )
      })

      if (teacherConflict) {
        const t = teachers.find((u) => u.id === formData.teacher_id)
        setModalError(
          `Conflict: ${t?.display_name || 'This faculty member'} already has a scheduled class (${teacherConflict.subject_name || teacherConflict.course_title}) on ${formData.day_of_week} between ${teacherConflict.start_time} - ${teacherConflict.end_time}.`
        )
        return false
      }
    }

    // Check room conflicts (if not generic online venue)
    const venue = formData.room_or_venue.trim().toLowerCase()
    if (venue && !venue.includes('online') && !venue.includes('zoom')) {
      const roomConflict = slots.find((s) => {
        if (isEditing && s.id === editId) return false
        return (
          s.day_of_week.toLowerCase() === formData.day_of_week.toLowerCase() &&
          (s.room_or_venue || '').trim().toLowerCase() === venue &&
          isTimeOverlapping(s.start_time, s.end_time, formData.start_time, formData.end_time)
        )
      })

      if (roomConflict) {
        setModalError(
          `Conflict: "${formData.room_or_venue}" is already booked on ${formData.day_of_week} from ${roomConflict.start_time} - ${roomConflict.end_time}.`
        )
        return false
      }
    }

    setModalError(null)
    return true
  }

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm(false)) return

    setSubmitting(true)
    try {
      const payload: TimetableSlotCreatePayload = {
        course_id: formData.course_id,
        subject_name: formData.subject_name.trim(),
        subject_code: formData.subject_code.trim() || undefined,
        subject_color: formData.subject_color,
        teacher_id: formData.teacher_id || undefined,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        period_number: Number(formData.period_number) || 1,
        slot_type: formData.slot_type,
        room_or_venue: formData.room_or_venue || 'Online Classroom / Zoom',
        meeting_url: formData.meeting_url?.trim() || undefined,
      }

      await createTimetableSlot(payload)
      setStatusToast({ type: 'success', text: `Class scheduled on ${payload.day_of_week} successfully.` })
      setShowAddModal(false)
      await loadTimetableData()
    } catch (err: any) {
      console.error('Failed to create timetable slot:', err)
      setModalError(err.message || 'Failed to create slot.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Update Submit
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slotToEdit || !validateForm(true, slotToEdit.id)) return

    setSubmitting(true)
    try {
      await updateSlot(slotToEdit.id, {
        course_id: formData.course_id || undefined,
        subject_name: formData.subject_name.trim(),
        subject_code: formData.subject_code.trim() || undefined,
        subject_color: formData.subject_color,
        teacher_id: formData.teacher_id || undefined,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        period_number: Number(formData.period_number) || 1,
        slot_type: formData.slot_type,
        room_or_venue: formData.room_or_venue,
        meeting_url: formData.meeting_url?.trim() || undefined,
      })

      setStatusToast({ type: 'success', text: 'Timetable slot updated successfully.' })
      setShowEditModal(false)
      setSlotToEdit(null)
      await loadTimetableData()
    } catch (err: any) {
      console.error('Failed to update timetable slot:', err)
      setModalError(err.message || 'Failed to update slot.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!slotToDelete) return

    setSubmitting(true)
    try {
      await deleteTimetableSlot(slotToDelete.id)
      setStatusToast({ type: 'success', text: 'Timetable slot removed.' })
      setSlotToDelete(null)
      await loadTimetableData()
    } catch (err: any) {
      console.error('Failed to delete timetable slot:', err)
      setStatusToast({ type: 'error', text: err.message || 'Failed to delete slot.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Reset Schedule (Admin Only)
  const handleResetSchedule = async () => {
    setSubmitting(true)
    try {
      const res = await resetTimetableSchedule()
      setStatusToast({ type: 'success', text: res.message || 'Timetable schedule cleared.' })
      setShowResetModal(false)
      await loadTimetableData()
    } catch (err: any) {
      console.error('Failed to reset schedule:', err)
      setStatusToast({ type: 'error', text: err.message || 'Failed to reset timetable schedule.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setSelectedCourseFilter('all')
    setSelectedTeacherFilter('all')
    setSelectedDayFilter('all')
  }

  const hasActiveFilters = selectedCourseFilter !== 'all' || selectedTeacherFilter !== 'all' || selectedDayFilter !== 'all'

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] p-4 md:p-8 space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF7A00] mb-1 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'Master Scheduling' : isTeacher ? 'Faculty Schedule' : 'Student Timetable'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] tracking-tight font-serif">
            {isAdmin ? 'Timetable' : isTeacher ? 'My Teaching Schedule' : 'My Class Timetable'}
          </h1>
          <p className="text-xs md:text-sm text-[#64748B] mt-0.5">
            {isAdmin
              ? 'Create, edit, and organize scheduled institute classes.'
              : isTeacher
              ? 'Your assigned lectures, workshops, and classroom sessions.'
              : 'Your scheduled classes for actively enrolled technical courses.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTimetableData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] text-xs md:text-sm font-medium transition-all shadow-xs disabled:opacity-50"
            title="Refresh Timetable"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#64748B] ${loading ? 'animate-spin text-[#FF7A00]' : ''}`} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowResetModal(true)}
              disabled={loading || submitting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs md:text-sm font-medium transition-all shadow-xs disabled:opacity-50"
              title="Reset Timetable Schedule"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
              <span>Reset Schedule</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#E07A00] text-white text-xs md:text-sm font-semibold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Class</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Status Toast ────────────────────────────────────────────────────── */}
      {statusToast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs md:text-sm shadow-sm transition-all ${
            statusToast.type === 'success'
              ? 'bg-[#EAFBF4] border-[#A7F3D0] text-[#0A7955]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#16A37A] flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
            )}
            <span>{statusToast.text}</span>
          </div>
          <button onClick={() => setStatusToast(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Metrics Strip (Derived directly from normalized state) ──────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-xs">
          <div className="text-2xl font-extrabold text-[#0F172A]">{metrics.scheduledClasses}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Scheduled Classes</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-xs">
          <div className="text-2xl font-extrabold text-[#0F172A]">{metrics.databaseCourses}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Database Courses</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-xs">
          <div className="text-2xl font-extrabold text-[#0F172A]">{metrics.facultyMentors}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Faculty Mentors</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-xs">
          <div className="text-2xl font-extrabold text-[#FF7A00]">{metrics.activeToday}</div>
          <div className="text-xs text-[#64748B] mt-0.5">Active Today ({currentWeekday})</div>
        </div>
      </div>

      {/* ── Filter & View Mode Controls ─────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* View Mode Toggle */}
        <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-[#E2E8F0] self-start">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-[#FF7A00] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Weekly Grid</span>
          </button>
          <button
            onClick={() => setViewMode('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'daily'
                ? 'bg-white text-[#FF7A00] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Daily Agenda</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <>
              {/* Course Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Course:</span>
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="bg-white border border-[#CBD5E1] text-[#0F172A] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#FF7A00]"
                >
                  <option value="all">All Courses ({courses.length})</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Faculty Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Teacher:</span>
                <select
                  value={selectedTeacherFilter}
                  onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                  className="bg-white border border-[#CBD5E1] text-[#0F172A] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#FF7A00]"
                >
                  <option value="all">All Teachers ({teachers.length})</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Day Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#64748B] font-medium hidden sm:inline">Day:</span>
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
              className="bg-white border border-[#CBD5E1] text-[#0F172A] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#FF7A00]"
            >
              <option value="all">All Weekdays</option>
              {ALL_WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#FF7A00] hover:underline font-semibold px-2 py-1"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Main Schedule Content ────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-16 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-7 h-7 text-[#FF7A00] animate-spin" />
          <p className="text-xs md:text-sm text-[#64748B]">Loading timetable...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 flex flex-col items-center justify-center space-y-3 text-center">
          <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
          <h3 className="text-base font-bold text-[#0F172A]">Unable to load timetable</h3>
          <p className="text-xs md:text-sm text-[#64748B] max-w-md">{error}</p>
          <button
            onClick={loadTimetableData}
            className="px-4 py-2 rounded-xl bg-[#FF7A00] text-white text-xs font-semibold hover:bg-[#E07A00] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-16 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FFF4E3] border border-[#FFDEC4] flex items-center justify-center text-[#FF7A00]">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#0F172A]">
              {hasActiveFilters ? 'No classes match these filters' : 'No classes scheduled'}
            </h3>
            <p className="text-xs md:text-sm text-[#64748B] max-w-sm">
              {hasActiveFilters
                ? 'Try adjusting or clearing your filters to see scheduled sessions.'
                : isAdmin
                ? 'Schedule your first class to see it here.'
                : 'You have no scheduled classes at this time.'}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-semibold transition-colors"
            >
              Clear Filters
            </button>
          ) : (
            isAdmin && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#E07A00] text-white text-xs font-semibold transition-colors"
              >
                Schedule Class
              </button>
            )
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── WEEKLY GRID VIEW (Light Enterprise Calendar) ─────────────────── */
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3.5 min-w-[900px] lg:min-w-0">
            {ALL_WEEKDAYS.map((day) => {
              const daySlots = slotsByDay[day] || []
              const isToday = currentWeekday.toLowerCase() === day.toLowerCase()

              return (
                <div
                  key={day}
                  className={`flex flex-col rounded-xl border bg-white transition-all ${
                    isToday ? 'border-[#FFDEC4] shadow-xs' : 'border-[#E2E8F0]'
                  }`}
                >
                  {/* Column Header */}
                  <div
                    className={`p-3 border-b flex items-center justify-between rounded-t-xl ${
                      isToday ? 'bg-[#FFF9EE] border-[#FFDEC4]' : 'bg-[#FAFAF8] border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold ${isToday ? 'text-[#FF7A00]' : 'text-[#0F172A]'}`}>
                        {day}
                      </span>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF7A00] text-white">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-[#64748B] px-1.5 py-0.5 bg-white border border-[#E2E8F0] rounded">
                      {daySlots.length}
                    </span>
                  </div>

                  {/* Day Slots List */}
                  <div className="p-2.5 flex-1 space-y-2.5 min-h-[160px] bg-white rounded-b-xl">
                    {daySlots.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-4 text-center">
                        <span className="text-xs text-[#94A3B8] italic">No classes</span>
                      </div>
                    ) : (
                      daySlots.map((slot) => {
                        const accent = slot.subject_color || '#FF7A00'

                        return (
                          <div
                            key={slot.id}
                            className="group relative rounded-lg border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white p-2.5 transition-all shadow-xs space-y-2"
                            style={{ borderLeftWidth: '3px', borderLeftColor: accent }}
                          >
                            {/* Subject Code & Period */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700">
                                {slot.subject_code || 'CLS'}
                              </span>
                              <span className="text-[10px] text-[#64748B] font-medium capitalize">
                                {slot.slot_type || 'Lecture'}
                              </span>
                            </div>

                            {/* Class / Subject Title */}
                            <div>
                              <h4 className="text-xs font-bold text-[#0F172A] line-clamp-2 leading-snug">
                                {slot.subject_name || slot.course_title || 'Technical Class'}
                              </h4>
                              {slot.course_title && slot.course_title !== slot.subject_name && (
                                <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                                  {slot.course_title}
                                </p>
                              )}
                            </div>

                            {/* Time & Venue */}
                            <div className="space-y-1 text-[11px] text-[#64748B] pt-1.5 border-t border-[#F1F5F9]">
                              <div className="flex items-center gap-1.5 font-medium text-[#0F172A]">
                                <Clock className="w-3 h-3 text-[#FF7A00] flex-shrink-0" />
                                <span>
                                  {slot.start_time} – {slot.end_time}
                                </span>
                              </div>

                              {slot.teacher_name && (
                                <div className="flex items-center gap-1.5 line-clamp-1">
                                  <UserIcon className="w-3 h-3 text-[#94A3B8] flex-shrink-0" />
                                  <span>{slot.teacher_name}</span>
                                </div>
                              )}

                              {slot.room_or_venue && (
                                <div className="flex items-center gap-1.5 line-clamp-1">
                                  <MapPin className="w-3 h-3 text-[#94A3B8] flex-shrink-0" />
                                  <span>{slot.room_or_venue}</span>
                                </div>
                              )}
                            </div>

                            {/* Meeting URL */}
                            {slot.meeting_url && (
                              <a
                                href={slot.meeting_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 w-full justify-center px-2 py-1 rounded bg-[#FFF4E3] hover:bg-[#FFE8CC] text-[#FF7A00] text-[11px] font-semibold transition-colors border border-[#FFDEC4]"
                              >
                                <Video className="w-3 h-3 text-[#FF7A00]" />
                                <span>Join Meeting</span>
                                <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-70" />
                              </a>
                            )}

                            {/* Admin Controls */}
                            {isAdmin && (
                              <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-[#F1F5F9]">
                                <button
                                  onClick={() => openEditModal(slot)}
                                  className="p-1 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors"
                                  title="Edit Class"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setSlotToDelete(slot)}
                                  className="p-1 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-rose-50 transition-colors"
                                  title="Delete Class"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ── DAILY AGENDA VIEW ────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Day Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {ALL_WEEKDAYS.map((day) => {
              const count = (slotsByDay[day] || []).length
              const isSelected = activeAgendaDay === day

              return (
                <button
                  key={day}
                  onClick={() => setActiveAgendaDay(day)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap border ${
                    isSelected
                      ? 'bg-[#FF7A00] border-[#FF7A00] text-white shadow-xs'
                      : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                  }`}
                >
                  <span>{day}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748B]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Agenda List */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF7A00]" />
                <h3 className="text-base font-bold text-[#0F172A]">{activeAgendaDay} Schedule</h3>
              </div>
              {isAdmin && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF7A00] hover:bg-[#E07A00] text-white text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class</span>
                </button>
              )}
            </div>

            {slotsByDay[activeAgendaDay]?.length === 0 ? (
              <div className="py-12 text-center text-[#94A3B8] italic text-xs md:text-sm">
                No classes scheduled for {activeAgendaDay}.
              </div>
            ) : (
              <div className="space-y-3">
                {slotsByDay[activeAgendaDay]?.map((slot) => {
                  const accent = slot.subject_color || '#FF7A00'

                  return (
                    <div
                      key={slot.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#CBD5E1] transition-all shadow-xs"
                      style={{ borderLeftWidth: '4px', borderLeftColor: accent }}
                    >
                      <div className="flex items-start md:items-center gap-4">
                        <div className="flex flex-col items-center justify-center px-3 py-2 rounded-lg bg-[#FAFAF8] border border-[#E2E8F0] min-w-[96px] text-center">
                          <span className="text-xs font-bold text-[#0F172A]">{slot.start_time}</span>
                          <span className="text-[10px] text-[#94A3B8]">to</span>
                          <span className="text-xs font-bold text-[#0F172A]">{slot.end_time}</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700">
                              {slot.subject_code || 'CLS'}
                            </span>
                            <span className="text-xs text-[#64748B] font-medium capitalize">
                              {slot.slot_type || 'Lecture'}
                            </span>
                          </div>

                          <h4 className="text-sm md:text-base font-bold text-[#0F172A]">
                            {slot.subject_name || slot.course_title || 'Technical Class'}
                          </h4>

                          <div className="flex flex-wrap items-center gap-3.5 text-xs text-[#64748B]">
                            {slot.course_title && (
                              <span className="flex items-center gap-1.5 text-[#0F172A] font-medium">
                                <BookOpen className="w-3.5 h-3.5 text-[#FF7A00]" />
                                <span>{slot.course_title}</span>
                              </span>
                            )}
                            {slot.teacher_name && (
                              <span className="flex items-center gap-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-[#94A3B8]" />
                                <span>{slot.teacher_name}</span>
                              </span>
                            )}
                            {slot.room_or_venue && (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-[#94A3B8]" />
                                <span>{slot.room_or_venue}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        {slot.meeting_url && (
                          <a
                            href={slot.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFF4E3] hover:bg-[#FFE8CC] text-[#FF7A00] text-xs font-semibold transition-colors border border-[#FFDEC4]"
                          >
                            <Video className="w-3.5 h-3.5 text-[#FF7A00]" />
                            <span>Join Class</span>
                          </a>
                        )}

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(slot)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors"
                              title="Edit Class"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSlotToDelete(slot)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-rose-50 transition-colors"
                              title="Delete Class"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE / SCHEDULE CLASS MODAL ───────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FFF4E3] border border-[#FFDEC4] flex items-center justify-center text-[#FF7A00]">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Schedule Class</h3>
                  <p className="text-xs text-[#64748B]">Assign real database courses and faculty members</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Target Course */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Target Course *</label>
                <select
                  value={formData.course_id}
                  onChange={(e) => handleCourseSelection(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                  required
                >
                  <option value="" disabled>Select course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Title & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Subject / Module Title *</label>
                  <input
                    type="text"
                    value={formData.subject_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_name: e.target.value }))}
                    placeholder="e.g. Prompt Engineering & LLM Orchestration"
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Subject Code</label>
                  <input
                    type="text"
                    value={formData.subject_code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_code: e.target.value }))}
                    placeholder="e.g. GEN-201"
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00] font-mono"
                  />
                </div>
              </div>

              {/* Color Tag */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Color Tag</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, subject_color: p.value }))}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        formData.subject_color === p.value ? 'scale-110 border-slate-900 ring-2 ring-[#FF7A00]/40' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: p.value }}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>

              {/* Faculty Mentor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Assigned Faculty Mentor</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, teacher_id: e.target.value }))}
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Day & Slot Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Day of Week *</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData((prev) => ({ ...prev, day_of_week: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                  >
                    {ALL_WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Slot Type</label>
                  <select
                    value={formData.slot_type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slot_type: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                  >
                    {SLOT_TYPES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Start Time *</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#FF7A00]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">End Time *</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#FF7A00]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Period #</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.period_number}
                    onChange={(e) => setFormData((prev) => ({ ...prev, period_number: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
              </div>

              {/* Room / Venue */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Room / Venue</label>
                <input
                  type="text"
                  value={formData.room_or_venue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, room_or_venue: e.target.value }))}
                  placeholder="e.g. Room A-204 or Online Classroom"
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>

              {/* Meeting Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Meeting Link (Zoom / Meet / Teams)</label>
                <input
                  type="url"
                  value={formData.meeting_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, meeting_url: e.target.value }))}
                  placeholder="https://zoom.us/j/..."
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#E07A00] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Save & Schedule Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT CLASS MODAL ────────────────────────────────────────────────── */}
      {showEditModal && slotToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FFF4E3] border border-[#FFDEC4] flex items-center justify-center text-[#FF7A00]">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Edit Scheduled Class</h3>
                  <p className="text-xs text-[#64748B]">Update timings, faculty, or room assignment</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSlotToEdit(null)
                }}
                className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              {/* Course */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Course</label>
                <select
                  value={formData.course_id}
                  onChange={(e) => handleCourseSelection(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                >
                  <option value="">Unlinked Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Title & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Subject / Module Title *</label>
                  <input
                    type="text"
                    value={formData.subject_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_name: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Subject Code</label>
                  <input
                    type="text"
                    value={formData.subject_code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_code: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00] font-mono"
                  />
                </div>
              </div>

              {/* Color Tag */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Color Tag</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, subject_color: p.value }))}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        formData.subject_color === p.value ? 'scale-110 border-slate-900 ring-2 ring-[#FF7A00]/40' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: p.value }}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>

              {/* Faculty Mentor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Assigned Faculty Mentor</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, teacher_id: e.target.value }))}
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Day & Slot Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Day of Week *</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData((prev) => ({ ...prev, day_of_week: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                  >
                    {ALL_WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Slot Type</label>
                  <select
                    value={formData.slot_type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slot_type: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                  >
                    {SLOT_TYPES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Start Time *</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#FF7A00]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">End Time *</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#FF7A00]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0F172A]">Period #</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.period_number}
                    onChange={(e) => setFormData((prev) => ({ ...prev, period_number: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
              </div>

              {/* Room / Venue */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Room / Venue</label>
                <input
                  type="text"
                  value={formData.room_or_venue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, room_or_venue: e.target.value }))}
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>

              {/* Meeting Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#0F172A]">Meeting Link (Zoom / Meet / Teams)</label>
                <input
                  type="url"
                  value={formData.meeting_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, meeting_url: e.target.value }))}
                  placeholder="https://zoom.us/j/..."
                  className="w-full bg-white border border-[#CBD5E1] text-[#0F172A] text-xs md:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF7A00]"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSlotToEdit(null)
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#E07A00] text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ───────────────────────────────────────── */}
      {slotToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-[#EF4444] flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Delete Scheduled Class</h3>
                <p className="text-xs text-[#64748B]">Remove this class from the schedule?</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs space-y-1">
              <div className="font-semibold text-[#0F172A]">
                {slotToDelete.subject_name || slotToDelete.course_title || 'Scheduled Class'}
              </div>
              <div className="text-[#64748B]">
                {slotToDelete.day_of_week} • {slotToDelete.start_time} – {slotToDelete.end_time}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSlotToDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-lg bg-[#EF4444] hover:bg-rose-600 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete Class'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET TIMETABLE CONFIRMATION MODAL ──────────────────────────────── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#EF4444] flex-shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#0F172A]">Reset Timetable Schedule</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  This will clear all scheduled timetable class slots and orphan live sessions. Courses, subjects, faculty mentors, and student enrollments will remain completely intact.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E2E8F0] text-xs space-y-1 text-[#64748B]">
              <p className="font-semibold text-[#0F172A]">What happens next?</p>
              <ul className="list-disc list-inside space-y-0.5 pt-0.5 text-[11px]">
                <li>All obsolete slots and past schedule entries are removed.</li>
                <li>The timetable will reset to a clean state.</li>
                <li>You can immediately schedule fresh classes using live courses & teachers.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A] text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetSchedule}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-rose-600 text-white text-xs font-semibold transition-colors shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Resetting Schedule...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TimetablePage
