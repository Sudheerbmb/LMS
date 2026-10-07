import React, { useState, useEffect, useMemo } from 'react'
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
  Filter,
  Layers,
  GraduationCap,
  CalendarDays,
  LayoutGrid,
  ListFilter
} from 'lucide-react'
import {
  getTimetableGrid,
  createTimetableSlot,
  updateSlot,
  deleteTimetableSlot,
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
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Teal', value: '#14b8a6' },
]

const SLOT_TYPES = [
  { label: 'Lecture', value: 'lecture' },
  { label: 'Hands-on Lab', value: 'lab' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Mentorship / Standup', value: 'standup' },
  { label: 'Code Review', value: 'review' },
  { label: 'Masterclass', value: 'masterclass' },
]

export const TimetablePage: React.FC<{ user: User | null }> = ({ user: currentUser }) => {
  const role = currentUser?.role || 'student'
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isStudent = role === 'student'

  // Data state
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [courses, setCourses] = useState<AdminInstituteCourse[]>([])
  const [teachers, setTeachers] = useState<AdminInstituteUser[]>([])
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filters
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all')
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all')
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all')

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'daily'>('grid')
  const [activeDay, setActiveDay] = useState<string>(() => {
    const todayIndex = new Date().getDay()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[todayIndex] || 'Monday'
  })

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [slotToEdit, setSlotToEdit] = useState<TimetableSlot | null>(null)
  const [slotToDelete, setSlotToDelete] = useState<TimetableSlot | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Add / Edit Form State
  const [formData, setFormData] = useState({
    course_id: '',
    subject_name: '',
    subject_code: '',
    subject_color: '#3b82f6',
    teacher_id: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:30',
    period_number: 1,
    slot_type: 'lecture',
    room_or_venue: 'Online Classroom / Zoom',
    meeting_url: '',
  })

  // Auto-dismiss status alerts
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  // Load database courses & teachers
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [coursesRes, usersRes] = await Promise.all([
          getAdminCourses().catch(() => []),
          getAdminUsers().catch(() => []),
        ])
        setCourses(coursesRes || [])
        const faculty = (usersRes || []).filter((u: AdminInstituteUser) => u.role === 'teacher' || u.role === 'admin')
        setTeachers(faculty)
      } catch (err) {
        console.error('Failed to load courses or faculty metadata', err)
      }
    }
    loadMetadata()
  }, [])

  // Load slots dynamically
  const loadSlots = async () => {
    setLoading(true)
    try {
      let params: { course_id?: string; teacher_id?: string; day_of_week?: string } | undefined = undefined

      if (isAdmin) {
        params = {}
        if (selectedCourseFilter !== 'all') params.course_id = selectedCourseFilter
        if (selectedTeacherFilter !== 'all') params.teacher_id = selectedTeacherFilter
        if (selectedDayFilter !== 'all') params.day_of_week = selectedDayFilter
      }

      const res = await getTimetableGrid(params)
      setSlots(res || [])
    } catch (err: any) {
      console.error('Error fetching timetable slots', err)
      setStatusMessage({ type: 'error', text: err.message || 'Could not load timetable slots' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSlots()
  }, [selectedCourseFilter, selectedTeacherFilter, selectedDayFilter, currentUser?.id])

  // Handle Course selection change in form to populate default subject info
  const handleCourseSelect = (courseId: string) => {
    const selectedCourse = courses.find((c) => c.id === courseId)
    if (!selectedCourse) {
      setFormData((prev) => ({ ...prev, course_id: courseId }))
      return
    }

    const firstSubject = selectedCourse.subjects?.[0]
    setFormData((prev) => ({
      ...prev,
      course_id: courseId,
      subject_name: firstSubject ? firstSubject.name : selectedCourse.title,
      subject_code: firstSubject ? firstSubject.code : selectedCourse.slug.slice(0, 8).toUpperCase(),
      subject_color: firstSubject?.color || '#3b82f6',
      teacher_id: firstSubject?.teacher_id || prev.teacher_id || '',
    }))
  }

  // Open Create Modal
  const openCreateModal = () => {
    const initialCourse = courses[0]
    const initialSubject = initialCourse?.subjects?.[0]

    setFormData({
      course_id: initialCourse?.id || '',
      subject_name: initialSubject ? initialSubject.name : (initialCourse?.title || ''),
      subject_code: initialSubject ? initialSubject.code : (initialCourse?.slug.slice(0, 8).toUpperCase() || 'CLS-101'),
      subject_color: initialSubject?.color || '#3b82f6',
      teacher_id: initialSubject?.teacher_id || (teachers[0]?.id || ''),
      day_of_week: activeDay || 'Monday',
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
    setSlotToEdit(slot)
    setFormData({
      course_id: slot.course_id || '',
      subject_name: slot.subject_name || slot.course_title || '',
      subject_code: slot.subject_code || '',
      subject_color: slot.subject_color || '#3b82f6',
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

  // Submit Create Slot
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.course_id) {
      setStatusMessage({ type: 'error', text: 'Please select an available course' })
      return
    }
    if (!formData.subject_name.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a subject / class title' })
      return
    }

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
      setStatusMessage({ type: 'success', text: `Successfully scheduled "${payload.subject_name}" on ${payload.day_of_week}` })
      setShowAddModal(false)
      loadSlots()
    } catch (err: any) {
      console.error('Failed to create timetable slot', err)
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create slot' })
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Update Slot
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slotToEdit) return

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

      setStatusMessage({ type: 'success', text: 'Timetable slot updated successfully' })
      setShowEditModal(false)
      setSlotToEdit(null)
      loadSlots()
    } catch (err: any) {
      console.error('Failed to update timetable slot', err)
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update slot' })
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Slot
  const handleDeleteConfirm = async () => {
    if (!slotToDelete) return
    setSubmitting(true)
    try {
      await deleteTimetableSlot(slotToDelete.id)
      setStatusMessage({ type: 'success', text: 'Timetable slot removed successfully' })
      setSlotToDelete(null)
      loadSlots()
    } catch (err: any) {
      console.error('Failed to delete timetable slot', err)
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete slot' })
    } finally {
      setSubmitting(false)
    }
  }

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
      const d = s.day_of_week ? s.day_of_week.charAt(0).toUpperCase() + s.day_of_week.slice(1).toLowerCase() : 'Monday'
      if (map[d]) {
        map[d].push(s)
      } else {
        map['Monday'].push(s)
      }
    })
    // Sort each day chronologically by start_time
    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
    return map
  }, [slots])

  // Count stats
  const totalClasses = slots.length
  const uniqueCourses = new Set(slots.map((s) => s.course_id).filter(Boolean)).size
  const uniqueTeachers = new Set(slots.map((s) => s.teacher_id).filter(Boolean)).size

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-slate-800 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
              <CalendarDays className="w-3.5 h-3.5" />
              {isAdmin ? 'Institute Master Schedule' : isTeacher ? 'Assigned Faculty Schedule' : 'Enrolled Course Timetable'}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              {isAdmin ? 'Timetable & Class Schedules' : isTeacher ? 'My Teaching Schedule' : 'My Class Timetable'}
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              {isAdmin
                ? 'Create, edit, and organize scheduled classes synced directly with database courses and faculty.'
                : isTeacher
                ? 'View your live coding sessions, scheduled lectures, and classroom meetings.'
                : 'All scheduled sessions and live classes for your enrolled technical courses.'}
            </p>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadSlots}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-sm font-medium transition-all duration-200 border border-slate-700 shadow-sm disabled:opacity-50"
              title="Refresh Timetable"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh</span>
            </button>

            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Class</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{totalClasses}</div>
              <div className="text-xs text-slate-400">Scheduled Classes</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{courses.length}</div>
              <div className="text-xs text-slate-400">Database Courses</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{teachers.length}</div>
              <div className="text-xs text-slate-400">Faculty Mentors</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{uniqueCourses}</div>
              <div className="text-xs text-slate-400">Active in Schedule</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm transition-all border shadow-lg ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-200'
              : 'bg-rose-950/80 border-rose-700/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Control Bar: View Toggle & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
        {/* View Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Weekly Grid</span>
          </button>
          <button
            onClick={() => setViewMode('daily')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
              viewMode === 'daily'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Daily Agenda</span>
          </button>
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <>
              {/* Course Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Course:</span>
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs md:text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Teacher:</span>
                <select
                  value={selectedTeacherFilter}
                  onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs md:text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Teachers</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Day of Week Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Day:</span>
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs md:text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Weekdays</option>
              {ALL_WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading dynamic timetable schedule...</p>
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Calendar className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No Classes Scheduled Yet</h3>
            <p className="text-slate-400 text-sm max-w-md">
              {isAdmin
                ? 'Start scheduling classes by clicking "+ Schedule Class" above. They will sync immediately across teachers and enrolled students.'
                : isTeacher
                ? 'No classes have been assigned to your schedule at this time.'
                : 'You have no scheduled classes for your enrolled courses yet.'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule First Class</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* WEEKLY GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {ALL_WEEKDAYS.map((day) => {
            const daySlots = slotsByDay[day] || []
            const isToday = activeDay.toLowerCase() === day.toLowerCase()

            return (
              <div
                key={day}
                className={`flex flex-col rounded-2xl border transition-all duration-200 ${
                  isToday
                    ? 'bg-slate-900/90 border-indigo-500/50 shadow-lg shadow-indigo-950/30'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3.5 border-b flex items-center justify-between rounded-t-2xl ${
                    isToday
                      ? 'bg-gradient-to-r from-indigo-950/80 to-slate-900 border-indigo-500/30 text-indigo-200'
                      : 'border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>{day}</span>
                    {isToday && (
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" title="Today" />
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800/80 border border-slate-700 text-slate-400">
                    {daySlots.length}
                  </span>
                </div>

                {/* Day Slots List */}
                <div className="p-2.5 flex-1 space-y-2.5 min-h-[160px]">
                  {daySlots.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-4 text-center">
                      <span className="text-xs text-slate-600 italic">No classes</span>
                    </div>
                  ) : (
                    daySlots.map((slot) => {
                      const color = slot.subject_color || '#3b82f6'

                      return (
                        <div
                          key={slot.id}
                          className="group relative rounded-xl border border-slate-800/80 hover:border-slate-700 bg-slate-950/70 p-3 hover:shadow-lg transition-all duration-200 space-y-2.5"
                          style={{ borderLeftWidth: '4px', borderLeftColor: color }}
                        >
                          {/* Subject Code & Period */}
                          <div className="flex items-start justify-between gap-1">
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase text-white shadow-sm"
                              style={{ backgroundColor: color }}
                            >
                              {slot.subject_code || 'CLS'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              P{slot.period_number || 1} • {slot.slot_type}
                            </span>
                          </div>

                          {/* Subject / Course Title */}
                          <div>
                            <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                              {slot.subject_name || slot.course_title || 'Technical Class'}
                            </h4>
                            {slot.course_title && slot.course_title !== slot.subject_name && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                {slot.course_title}
                              </p>
                            )}
                          </div>

                          {/* Time & Teacher details */}
                          <div className="space-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                              <Clock className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                              <span>
                                {slot.start_time} - {slot.end_time}
                              </span>
                            </div>

                            {slot.teacher_name && (
                              <div className="flex items-center gap-1.5 line-clamp-1">
                                <UserIcon className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                <span>{slot.teacher_name}</span>
                              </div>
                            )}

                            {slot.room_or_venue && (
                              <div className="flex items-center gap-1.5 text-slate-400 line-clamp-1">
                                <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                <span>{slot.room_or_venue}</span>
                              </div>
                            )}
                          </div>

                          {/* Meeting Link or Join */}
                          {slot.meeting_url && (
                            <a
                              href={slot.meeting_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1.5 w-full justify-center px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium transition-colors"
                            >
                              <Video className="w-3 h-3 text-indigo-400" />
                              <span>Join Online Class</span>
                              <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-70" />
                            </a>
                          )}

                          {/* Admin CRUD Actions */}
                          {isAdmin && (
                            <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800/80">
                              <button
                                onClick={() => openEditModal(slot)}
                                className="p-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                                title="Edit Class"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setSlotToDelete(slot)}
                                className="p-1 rounded-lg bg-slate-800/80 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
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
      ) : (
        /* DAILY AGENDA VIEW */
        <div className="space-y-4">
          {/* Day Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {ALL_WEEKDAYS.map((day) => {
              const count = (slotsByDay[day] || []).length
              const isSelected = activeDay === day

              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap border ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>{day}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Timeline of classes for Active Day */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <span>{activeDay} Schedule</span>
              </h3>
              {isAdmin && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Class to {activeDay}</span>
                </button>
              )}
            </div>

            {slotsByDay[activeDay]?.length === 0 ? (
              <div className="py-12 text-center text-slate-500 italic text-sm">
                No classes scheduled for {activeDay}.
              </div>
            ) : (
              <div className="space-y-3">
                {slotsByDay[activeDay]?.map((slot) => {
                  const color = slot.subject_color || '#3b82f6'

                  return (
                    <div
                      key={slot.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition-all shadow-sm"
                      style={{ borderLeftWidth: '5px', borderLeftColor: color }}
                    >
                      <div className="flex items-start md:items-center gap-4">
                        <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-900 border border-slate-800 min-w-[90px] text-center">
                          <span className="text-xs text-slate-400 font-medium">{slot.start_time}</span>
                          <span className="text-[10px] text-slate-600">to</span>
                          <span className="text-xs text-slate-400 font-medium">{slot.end_time}</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase text-white shadow-sm"
                              style={{ backgroundColor: color }}
                            >
                              {slot.subject_code || 'CLS'}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              Period {slot.period_number || 1} • {slot.slot_type}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-white">
                            {slot.subject_name || slot.course_title || 'Technical Class'}
                          </h4>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                            {slot.course_title && (
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{slot.course_title}</span>
                              </span>
                            )}
                            {slot.teacher_name && (
                              <span className="flex items-center gap-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                                <span>{slot.teacher_name}</span>
                              </span>
                            )}
                            {slot.room_or_venue && (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
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
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors"
                          >
                            <Video className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Join Class</span>
                          </a>
                        )}

                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEditModal(slot)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                              title="Edit Class"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSlotToDelete(slot)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
                              title="Delete Class"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Schedule Class</h3>
                  <p className="text-xs text-slate-400">Sync with database courses and faculty mentors</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Dynamic Course Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Target Course *</label>
                <select
                  value={formData.course_id}
                  onChange={(e) => handleCourseSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="" disabled>Select an available course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Title & Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Subject / Module Title *</label>
                  <input
                    type="text"
                    value={formData.subject_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_name: e.target.value }))}
                    placeholder="e.g. Prompt Engineering & LLM Orchestration"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Subject Code</label>
                  <input
                    type="text"
                    value={formData.subject_code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_code: e.target.value }))}
                    placeholder="e.g. GEN-201"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Color Theme Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Color Tag</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, subject_color: p.value }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        formData.subject_color === p.value ? 'scale-110 border-white ring-2 ring-indigo-500/50' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: p.value }}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>

              {/* Faculty Mentor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Assigned Faculty Mentor</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, teacher_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Day & Period */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Day of Week *</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData((prev) => ({ ...prev, day_of_week: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    {ALL_WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Slot Type</label>
                  <select
                    value={formData.slot_type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slot_type: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    {SLOT_TYPES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Period #</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.period_number}
                    onChange={(e) => setFormData((prev) => ({ ...prev, period_number: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Room / Venue */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Room or Venue</label>
                <input
                  type="text"
                  value={formData.room_or_venue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, room_or_venue: e.target.value }))}
                  placeholder="e.g. Lab 201 / Online Classroom"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Online Meeting URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Meeting Link (Zoom / Meet / Teams)</label>
                <input
                  type="url"
                  value={formData.meeting_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, meeting_url: e.target.value }))}
                  placeholder="https://zoom.us/j/..."
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Scheduled Class</h3>
                  <p className="text-xs text-slate-400">Update timing, faculty, or course assignments</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSlotToEdit(null)
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              {/* Dynamic Course Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Course</label>
                <select
                  value={formData.course_id}
                  onChange={(e) => handleCourseSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Subject / Module Title *</label>
                  <input
                    type="text"
                    value={formData.subject_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_name: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Subject Code</label>
                  <input
                    type="text"
                    value={formData.subject_code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_code: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Color Theme Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Color Tag</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, subject_color: p.value }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        formData.subject_color === p.value ? 'scale-110 border-white ring-2 ring-indigo-500/50' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: p.value }}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>

              {/* Faculty Mentor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Assigned Faculty Mentor</label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, teacher_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Day & Period */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Day of Week *</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData((prev) => ({ ...prev, day_of_week: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    {ALL_WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Slot Type</label>
                  <select
                    value={formData.slot_type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slot_type: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    {SLOT_TYPES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Period #</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.period_number}
                    onChange={(e) => setFormData((prev) => ({ ...prev, period_number: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Room / Venue */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Room or Venue</label>
                <input
                  type="text"
                  value={formData.room_or_venue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, room_or_venue: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Online Meeting URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Meeting Link (Zoom / Meet / Teams)</label>
                <input
                  type="url"
                  value={formData.meeting_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, meeting_url: e.target.value }))}
                  placeholder="https://zoom.us/j/..."
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSlotToEdit(null)
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Scheduled Class</h3>
                <p className="text-xs text-slate-400">This action will remove the slot from all schedules.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1 text-xs">
              <div className="text-white font-semibold">
                {slotToDelete.subject_name || slotToDelete.course_title || 'Scheduled Class'}
              </div>
              <div className="text-slate-400">
                {slotToDelete.day_of_week} • {slotToDelete.start_time} - {slotToDelete.end_time}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSlotToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-md shadow-rose-600/30 disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TimetablePage
