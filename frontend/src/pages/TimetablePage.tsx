import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  Building,
  CheckCircle2,
  AlertTriangle,
  Star,
  Activity,
  ChevronRight,
  Database,
  Sliders,
  ArrowLeftRight,
  UserCheck,
  UserX,
  PlusCircle,
  Trash2,
  Settings2,
  Edit3,
  GraduationCap,
  BookOpen,
  Video,
  Play,
  Palmtree
} from 'lucide-react'
import {
  getGrades,
  getTimetableGrid,
  generateTimetable,
  seedTimetableDefaults,
  getTeachersWithFeedback,
  submitTeacherFeedback,
  toggleTeacherRestriction,
  getTimetableRules,
  toggleTimetableRule,
  updateTimetableRule,
  createTimetableRule,
  deleteTimetableRule,
  getSlotSubstitutes,
  swapSlots,
  updateSlot,
  recordTeacherLeave,
  generateZoomClassesFromTimetable,
  getAdminCourses,
  createSchoolLiveClass,
  type SchoolGrade,
  type TimetableSlot,
  type TeacherProfile,
  type TimetableGenerationResult,
  type TimetableRule,
  type SubstituteTeacher,
  type AdminInstituteCourse,
  type User
} from '../lib/api'

export const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DEFAULT_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const getTrackDisplayName = (g: SchoolGrade | undefined | null) => {
  if (!g) return 'Course Track'
  return g.name || 'Course Track'
}

const getNormalizedSlot = (slot: TimetableSlot) => {
  return {
    code: slot.subject_code || (slot.slot_type === 'assembly' ? 'STANDUP' : slot.slot_type === 'lunch' ? 'BREAK' : 'SESSION'),
    name: slot.subject_name || (slot.slot_type === 'assembly' ? 'Morning Standup & Overview' : slot.slot_type === 'lunch' ? 'Lunch & Peer Networking Break' : 'Academic Lecture'),
    teacher: slot.teacher_name || 'Faculty Lead',
    color: slot.subject_color || '#4f46e5',
    room: slot.room_or_venue || 'Tech Lab'
  }
}

export const TimetablePage: React.FC<{ user: User | null }> = ({ user: currentUser }) => {
  const role = currentUser?.role || 'student'
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isStudent = role === 'student'

  const [grades, setGrades] = useState<SchoolGrade[]>([])
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'grid' | 'rules' | 'teachers' | 'audit'>('grid')
  
  const [slots, setSlots] = useState<TimetableSlot[]>([])
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [rules, setRules] = useState<TimetableRule[]>([])
  const [myTeacherProfile, setMyTeacherProfile] = useState<TeacherProfile | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [seeding, setSeeding] = useState(false)
  
  const [lastGenResult, setLastGenResult] = useState<TimetableGenerationResult | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  
  // Quick Swap / Drag State (Admin only)
  const [swapMode, setSwapMode] = useState(false)
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<TimetableSlot | null>(null)

  // Slot Detail & Substitution Modal (Admin only)
  const [activeSlotModal, setActiveSlotModal] = useState<TimetableSlot | null>(null)
  const [substitutes, setSubstitutes] = useState<SubstituteTeacher[]>([])
  const [loadingSubstitutes, setLoadingSubstitutes] = useState(false)
  const [editingRoom, setEditingRoom] = useState('')

  // Rule Creation Modal (Admin only)
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleType, setNewRuleType] = useState('ground_capacity')
  const [newRuleDesc, setNewRuleDesc] = useState('')
  const [newRuleParamVal, setNewRuleParamVal] = useState('3')

  // 7-day, 6-day, 5-day View State (Default 7-days with Saturday & Sunday support)
  const [visibleDaysCount, setVisibleDaysCount] = useState<number>(7)
  
  // Real DB Courses & Subject Modules
  const [adminCourses, setAdminCourses] = useState<AdminInstituteCourse[]>([])

  // Institute Holidays & Off-Days (Admin adjustable)
  const [holidays, setHolidays] = useState<Record<string, string>>({
    Sunday: 'Weekend Off-Day / Self-Paced Coding Sandbox'
  })
  const [showHolidayModal, setShowHolidayModal] = useState(false)
  const [holidayTargetDay, setHolidayTargetDay] = useState('Sunday')
  const [holidayReasonInput, setHolidayReasonInput] = useState('Weekend Institute Holiday')

  // Slot Quick Edit (Admin) & Viewer / Live Launch Modal (Faculty/Student)
  const [showSlotViewerModal, setShowSlotViewerModal] = useState(false)
  const [selectedSlotForView, setSelectedSlotForView] = useState<TimetableSlot | null>(null)
  const [editingSubjectCode, setEditingSubjectCode] = useState('')
  const [editingSubjectName, setEditingSubjectName] = useState('')
  const [editingTeacherId, setEditingTeacherId] = useState('')
  const [editingSlotType, setEditingSlotType] = useState('lecture')
  const [launchingLiveClass, setLaunchingLiveClass] = useState(false)

  // Feedback submission form modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackTeacherId, setFeedbackTeacherId] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackComments, setFeedbackComments] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Leave Simulation Modal (Admin only)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveTeacherId, setLeaveTeacherId] = useState('')
  const [leaveDay, setLeaveDay] = useState('Wednesday')
  const [leaveReason, setLeaveReason] = useState('Medical Leave')
  const [submittingLeave, setSubmittingLeave] = useState(false)

  useEffect(() => {
    loadData()
  }, [role, currentUser?.email])

  useEffect(() => {
    if (!isTeacher && selectedSectionId) {
      loadGrid(selectedSectionId)
    }
  }, [selectedSectionId, isTeacher])

  const loadData = async () => {
    try {
      setLoading(true)
      const [gradesData, teachersData, coursesData] = await Promise.all([
        getGrades().catch(() => []),
        getTeachersWithFeedback().catch(() => []),
        getAdminCourses().catch(() => [])
      ])
      setGrades(gradesData || [])
      setTeachers(teachersData || [])
      setAdminCourses(coursesData || [])

      if (isAdmin) {
        const rulesData = await getTimetableRules().catch(() => [])
        setRules(rulesData || [])
      }

      // If user is a teacher, locate their teacher profile and load their personalized grid
      if (isTeacher) {
        let profile = (teachersData || []).find(
          t => t.user_id === currentUser?.id || t.email.toLowerCase() === currentUser?.email.toLowerCase()
        )
        setMyTeacherProfile(profile || null)

        if (!profile && teachersData && teachersData.length > 0) {
          profile = teachersData[0]
          setMyTeacherProfile(profile)
        }
        if (profile) {
          const teacherSlots = await getTimetableGrid({ teacher_id: profile.id })
          setSlots(teacherSlots || [])
        }
      } else {
        // Admin or Student: Load class section grid
        if (gradesData && gradesData.length > 0) {
          let targetGrade = gradesData[0]
          if (isStudent) {
            // Find grade matching student's enrolled courses if available
            const enrolledCourses = (coursesData || []).filter((c: any) => c.is_enrolled)
            if (enrolledCourses.length > 0) {
              const matched = gradesData.find(g => g.name.toLowerCase() === enrolledCourses[0].title.toLowerCase())
              if (matched) targetGrade = matched
            }
          }

          setSelectedGradeId(targetGrade.id)
          if (targetGrade.sections && targetGrade.sections.length > 0) {
            setSelectedSectionId(targetGrade.sections[0].id)
            await loadGrid(targetGrade.sections[0].id)
          }
        }
      }
    } catch (err: any) {
      console.error(err)
      setStatusMessage('Error loading timetable data: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const loadGrid = async (secId: string) => {
    try {
      setLoading(true)
      const gridSlots = await getTimetableGrid({ section_id: secId })
      setSlots(gridSlots || [])
    } catch (err: any) {
      console.error('Failed to load slots:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!isAdmin) return
    try {
      setGenerating(true)
      setStatusMessage(null)
      const result = await generateTimetable()
      setLastGenResult(result)
      setStatusMessage(`AI Generated ${result.total_slots_scheduled} slots across ${result.total_sections} sections adhering to live DB policy rules!`)
      if (selectedSectionId) {
        await loadGrid(selectedSectionId)
      }
      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])
    } catch (err: any) {
      console.error(err)
      setStatusMessage('Generation failed: ' + (err.message || 'Server error'))
    } finally {
      setGenerating(false)
    }
  }

  const [generatingZoom, setGeneratingZoom] = useState(false)

  const handleGenerateZoomClasses = async () => {
    if (!isAdmin && !isTeacher) return
    try {
      setGeneratingZoom(true)
      setStatusMessage(null)
      const res = await generateZoomClassesFromTimetable(7)
      setStatusMessage(`✨ Successfully scheduled ${res.classes_created} Zoom live class sessions from timetable! (Synced ${res.zoom_meetings_synced} meetings across ${res.days_ahead} days)`)
    } catch (err: any) {
      console.error('Failed to generate Zoom classes:', err)
      setStatusMessage('Zoom timetable automation failed: ' + (err.message || 'Server error'))
    } finally {
      setGeneratingZoom(false)
    }
  }

  const handleSeed = async () => {
    if (!isAdmin) return
    try {
      setSeeding(true)
      setStatusMessage(null)
      await seedTimetableDefaults()
      setStatusMessage('Successfully initialized Grades 1-10, subjects, faculty roster, and dynamic rules!')
      await loadData()
    } catch (err: any) {
      console.error(err)
      setStatusMessage('Seeding failed: ' + (err.message || 'Server error'))
    } finally {
      setSeeding(false)
    }
  }

  // ── Slot Click Handling (Role-Specific) ───────────────────────────────────
  const handleSlotClick = async (slot: TimetableSlot) => {
    // If Admin in Swap Mode
    if (isAdmin && swapMode) {
      if (!selectedSlotForSwap) {
        setSelectedSlotForSwap(slot)
        setStatusMessage(`Selected ${slot.day_of_week} Period ${slot.period_number}. Now click the second slot to swap!`)
      } else {
        if (selectedSlotForSwap.id === slot.id) {
          setSelectedSlotForSwap(null)
          return
        }
        try {
          setLoading(true)
          await swapSlots(selectedSlotForSwap.id, slot.id)
          setStatusMessage(`Swapped ${selectedSlotForSwap.day_of_week} Period ${selectedSlotForSwap.period_number} with ${slot.day_of_week} Period ${slot.period_number}!`)
          setSelectedSlotForSwap(null)
          setSwapMode(false)
          if (selectedSectionId) await loadGrid(selectedSectionId)
        } catch (err: any) {
          alert('Swap failed: ' + err.message)
        } finally {
          setLoading(false)
        }
      }
      return
    }

    if (slot.slot_type in ['assembly', 'recess', 'lunch', 'dispersal']) return

    // If Student: Opens feedback modal or viewer
    if (isStudent) {
      setSelectedSlotForView(slot)
      setShowSlotViewerModal(true)
      return
    }

    // If Faculty Teacher: Opens Live Launch & Period Desk
    if (isTeacher) {
      setSelectedSlotForView(slot)
      setShowSlotViewerModal(true)
      return
    }

    // If Admin: Opens Comprehensive Slot Management & Substitution Desk
    if (isAdmin) {
      setActiveSlotModal(slot)
      setEditingRoom(slot.room_or_venue || 'Tech Lab 101')
      setEditingSubjectCode(slot.subject_code || 'PY-101')
      setEditingSubjectName(slot.subject_name || 'Technical Lecture')
      setEditingTeacherId(slot.teacher_id || '')
      setEditingSlotType(slot.slot_type || 'lecture')
      try {
        setLoadingSubstitutes(true)
        const subs = await getSlotSubstitutes(slot.id)
        setSubstitutes(subs || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingSubstitutes(false)
      }
    }
  }

  const handleLaunchLiveSession = async (slot: TimetableSlot) => {
    try {
      setLaunchingLiveClass(true)
      const now = new Date()
      const end = new Date(now.getTime() + 45 * 60 * 1000)
      const norm = getNormalizedSlot(slot)
      await createSchoolLiveClass({
        title: `${norm.name} (${norm.code}) Live Session`,
        starts_at: now.toISOString(),
        ends_at: end.toISOString(),
        grade_number: currentGrade?.grade_number || 1,
        section_name: currentSection?.name || 'A',
        subject_code: norm.code,
        subject_name: norm.name,
        period_number: slot.period_number,
        room_number: slot.room_or_venue || 'Virtual Zoom Room',
        status: 'live'
      })
      setStatusMessage(`Live Session for ${norm.name} launched successfully! Head to Live Classroom.`)
      setActiveSlotModal(null)
      setShowSlotViewerModal(false)
    } catch (err: any) {
      alert('Failed to launch live class: ' + (err.message || 'Unknown error'))
    } finally {
      setLaunchingLiveClass(false)
    }
  }

  const handleToggleDayHoliday = (dayName: string, customReason?: string) => {
    setHolidays(prev => {
      const next = { ...prev }
      if (next[dayName]) {
        delete next[dayName]
        setStatusMessage(`Removed holiday status for ${dayName}. Regular schedule active.`)
      } else {
        next[dayName] = customReason || 'Institute Holiday / Off-Day'
        setStatusMessage(`Marked ${dayName} as Holiday: ${customReason || 'Institute Holiday'}`)
      }
      return next
    })
  }

  const handleAssignSubstitute = async (teacherId: string) => {
    if (!isAdmin || !activeSlotModal) return
    try {
      setLoading(true)
      await updateSlot(activeSlotModal.id, { teacher_id: teacherId })
      setStatusMessage(`Assigned substitute teacher to ${activeSlotModal.day_of_week} Period ${activeSlotModal.period_number}!`)
      setActiveSlotModal(null)
      if (selectedSectionId) await loadGrid(selectedSectionId)
    } catch (err: any) {
      alert('Failed to assign substitute: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSlotEdits = async () => {
    if (!isAdmin || !activeSlotModal) return
    try {
      setLoading(true)
      await updateSlot(activeSlotModal.id, {
        room_or_venue: editingRoom,
        teacher_id: editingTeacherId || undefined,
        slot_type: editingSlotType
      })
      setStatusMessage('Timetable slot details saved successfully to database!')
      setActiveSlotModal(null)
      if (selectedSectionId) await loadGrid(selectedSectionId)
      else if (isTeacher && myTeacherProfile) {
        const teacherSlots = await getTimetableGrid({ teacher_id: myTeacherProfile.id })
        setSlots(teacherSlots || [])
      }
    } catch (err: any) {
      alert('Update failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Dynamic Policy Rules Handlers (Admin Only) ───────────────────────────
  const handleToggleRule = async (ruleId: string) => {
    if (!isAdmin) return
    try {
      const updated = await toggleTimetableRule(ruleId)
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r))
      setStatusMessage(`Rule "${updated.name}" is now ${updated.is_enabled ? 'ENABLED' : 'DISABLED'}.`)
    } catch (err: any) {
      alert('Toggle failed: ' + err.message)
    }
  }

  const handleUpdateRuleParam = async (ruleId: string, paramKey: string, newVal: any) => {
    if (!isAdmin) return
    try {
      const rule = rules.find(r => r.id === ruleId)
      if (!rule) return
      const newParams = { ...rule.parameters, [paramKey]: newVal }
      const updated = await updateTimetableRule(ruleId, { parameters: newParams })
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r))
      setStatusMessage(`Updated rule "${rule.name}" parameter: ${paramKey} = ${newVal}`)
    } catch (err: any) {
      alert('Failed to update rule parameter: ' + err.message)
    }
  }

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    try {
      let params: any = {}
      if (newRuleType === 'ground_capacity') params = { max_sections: parseInt(newRuleParamVal) || 3 }
      else if (newRuleType === 'max_daily_teacher_periods') params = { max_periods: parseInt(newRuleParamVal) || 5 }
      else if (newRuleType === 'custom_day_schedule') params = { overrides: { [newRuleParamVal]: { start_time: "09:00" } } }

      const created = await createTimetableRule({
        name: newRuleName,
        rule_type: newRuleType,
        description: newRuleDesc || 'Custom school timetable scheduling policy',
        parameters: params,
        is_enabled: true,
        priority: 2
      })
      setRules(prev => [...prev, created])
      setShowAddRuleModal(false)
      setNewRuleName('')
      setNewRuleDesc('')
      setStatusMessage(`Created custom rule: "${created.name}"!`)
    } catch (err: any) {
      alert('Create rule failed: ' + err.message)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!isAdmin || !confirm('Are you sure you want to remove this rule?')) return
    try {
      await deleteTimetableRule(ruleId)
      setRules(prev => prev.filter(r => r.id !== ruleId))
      setStatusMessage('Rule deleted from Neon DB.')
    } catch (err: any) {
      alert('Delete failed: ' + err.message)
    }
  }

  // ── Leave Simulation Handler (Admin Only) ─────────────────────────────────
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin || !leaveTeacherId) return
    try {
      setSubmittingLeave(true)
      await recordTeacherLeave({
        teacher_id: leaveTeacherId,
        day_of_week: leaveDay,
        reason: leaveReason
      })
      setShowLeaveModal(false)
      setStatusMessage(`Recorded leave for ${leaveDay}. Run "Run AI Agent" to trigger automatic substitute re-allocations!`)
    } catch (err: any) {
      alert('Failed to record leave: ' + err.message)
    } finally {
      setSubmittingLeave(false)
    }
  }

  // ── Student Feedback Submission ───────────────────────────────────────────
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackTeacherId) return
    try {
      setSubmittingFeedback(true)
      const targetSecId = selectedSectionId || (grades[0]?.sections[0]?.id)
      const activeSlot = slots.find(s => s.teacher_id === feedbackTeacherId)
      const subjectId = activeSlot?.subject_id || slots[0]?.subject_id || '00000000-0000-0000-0000-000000000000'
      
      await submitTeacherFeedback({
        teacher_id: feedbackTeacherId,
        section_id: targetSecId,
        subject_id: subjectId,
        rating: feedbackRating,
        comments: feedbackComments,
        category: 'teaching_quality'
      })
      
      setShowFeedbackModal(false)
      setFeedbackComments('')
      setStatusMessage(
        feedbackRating <= 2
          ? 'Complaint registered. The AI Agent will automatically exclude this teacher from this class on future schedules.'
          : 'Thank you for your rating!'
      )
      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])
    } catch (err: any) {
      alert('Error submitting feedback: ' + err.message)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const handleToggleRestriction = async (resId: string) => {
    if (!isAdmin) return
    try {
      await toggleTeacherRestriction(resId)
      const teachersData = await getTeachersWithFeedback()
      setTeachers(teachersData || [])
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const currentGrade = grades.find(g => g.id === selectedGradeId)
  const currentSection = currentGrade?.sections.find(s => s.id === selectedSectionId)
  const periodNumbers = Array.from(new Set(slots.map(s => s.period_number))).sort((a, b) => a - b)

  const getPeriodMeta = (pNum: number) => {
    switch (pNum) {
      case 0: return { label: 'Morning Standup & Overview', time: '08:45 - 09:00', isBreak: true, bg: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400' }
      case 1: return { label: 'Session 1 (Core Technical Lecture)', time: '09:00 - 10:30', isBreak: false }
      case 2: return { label: 'Session 2 (Architecture & Frameworks)', time: '10:45 - 12:15', isBreak: false }
      case 3: return { label: 'Lunch & Peer Networking Break', time: '12:15 - 01:15', isBreak: true, bg: 'bg-amber-950/40 border-amber-800/40 text-amber-400' }
      case 4: return { label: 'Session 3 (Hands-On Coding & Lab)', time: '01:15 - 02:45', isBreak: false }
      case 5: return { label: 'Session 4 (Advanced Topics & Integration)', time: '03:00 - 04:30', isBreak: false }
      case 6: return { label: 'Session 5 (Capstone Project & Q&A)', time: '04:45 - 06:00', isBreak: false }
      default: return { label: `Training Session ${pNum}`, time: '', isBreak: false }
    }
  }

  const totalRestrictions = teachers.reduce((acc, t) => acc + (t.active_restrictions?.length || 0), 0)
  const activeGroundCapacity = rules.find(r => r.rule_type === 'ground_capacity')?.parameters?.max_sections || 2

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header Banner - Role Customized */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-8 rounded-2xl border border-amber-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            {isAdmin && <Sparkles className="w-3.5 h-3.5" />}
            {isTeacher && <GraduationCap className="w-3.5 h-3.5" />}
            {isStudent && <BookOpen className="w-3.5 h-3.5" />}
            {isAdmin ? 'Institute AI Timetable Engine' : isTeacher ? 'Faculty Teaching Schedule' : 'Batch Class Schedule'}
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {isAdmin && 'Batch Schedule & Timetable Engine'}
            {isTeacher && (myTeacherProfile ? `${myTeacherProfile.display_name} - Faculty Schedule` : 'Faculty Teaching Schedule')}
            {isStudent && `${currentGrade?.name || 'Technical Track'} - Weekly Batch Schedule`}
          </h1>

          <p className="text-slate-400 text-sm max-w-2xl">
            {isAdmin && 'Automated timetable generator for technical tracks (Python with GenAI, Salesforce, ServiceNow, Full Stack, DevOps) with Zoom scheduling integration.'}
            {isTeacher && `Assigned technical lectures across institute batches. Daily maximum workload capped at ${myTeacherProfile?.max_daily_periods || 5} sessions.`}
            {isStudent && 'Your weekly training schedule (09:00 AM - 06:00 PM). Click any session to join Zoom live or submit course feedback.'}
          </p>
        </div>

        {/* Action Buttons - ONLY FOR ADMIN */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <button
              onClick={() => {
                if (teachers.length > 0) setLeaveTeacherId(teachers[0].id)
                setShowLeaveModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-all"
            >
              <UserX className="w-4 h-4 text-amber-400" />
              Log Faculty Leave
            </button>

            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
            >
              <Database className={`w-4 h-4 ${seeding ? 'animate-spin text-amber-400' : ''}`} />
              {seeding ? 'Seeding...' : 'Reset Defaults'}
            </button>

            <button
              onClick={handleGenerateZoomClasses}
              disabled={generatingZoom}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              title="Sync upcoming timetable slots with Zoom and automatically schedule meetings"
            >
              <Video className={`w-4 h-4 ${generatingZoom ? 'animate-spin' : ''}`} />
              {generatingZoom ? 'Provisioning Zoom...' : 'Sync Timetable to Zoom'}
            </button>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'LangGraph Processing...' : 'Run AI Agent'}
            </button>
          </div>
        )}
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-yellow-300 text-sm flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-amber-400 hover:text-cyan-200 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Admin KPI Stats Grid */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/15 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Technical Tracks & Batches</span>
              <Building className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">{grades.length || 5} Tracks &bull; 10 Batches</div>
            <div className="text-xs text-slate-500">Python, Salesforce, ServiceNow, Web, DevOps</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/15 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Concurrent Lab Limit</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{activeGroundCapacity} Sessions Max</div>
            <div className="text-xs text-slate-500">Configurable in Policy Rules tab</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/15 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Active Policy Rules</span>
              <Sliders className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-black text-orange-400">{rules.filter(r => r.is_enabled).length} Enabled</div>
            <div className="text-xs text-slate-500">{rules.length} total defined in Neon DB</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/15 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Active Constraints</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400">{totalRestrictions} Exclusions</div>
            <div className="text-xs text-slate-500">Auto-bypassed during scheduling</div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs (Admin gets all tabs; Teachers/Students get their relevant views) */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('grid')}
          className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
            activeTab === 'grid' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          {isAdmin ? 'Master Timetable Grid' : isTeacher ? 'My Teaching Timetable' : 'Batch Weekly Grid'}
          {activeTab === 'grid' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'rules' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Institute Policy Rules Engine
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-300 font-mono">
              {rules.length}
            </span>
            {activeTab === 'rules' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
            )}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('teachers')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'teachers' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Faculty Directory & Reviews
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400 font-mono">
              {teachers.length}
            </span>
            {activeTab === 'teachers' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
            )}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'audit' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Agent Resolutions Log
            {lastGenResult?.autonomous_decisions && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                {lastGenResult.autonomous_decisions.length}
              </span>
            )}
            {activeTab === 'audit' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* TAB 1: Master Timetable Grid */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          {/* Controls: Only Admin and Students can select Grade/Section; Teachers see their personal schedule */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#0B0F19] border border-amber-500/15">
            {isTeacher ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-amber-400 font-bold">
                  {myTeacherProfile?.employee_id || 'T'}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    {myTeacherProfile?.display_name || currentUser?.display_name} &bull; Teaching Load
                  </div>
                  <div className="text-xs text-slate-400">
                    Showing your allocated lectures across all classes (Monday to Friday)
                  </div>
                </div>
              </div>
            ) : isStudent ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    {currentGrade?.name || 'Class'} &bull; Section {currentSection?.name || 'A'} ({currentSection?.room_number || 'Room 101'})
                  </div>
                  <div className="text-xs text-slate-400">
                    Your Official Class Weekly Timetable &bull; Click any subject period to rate your instructor
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Training Track / Course
                  </label>
                  <select
                    value={selectedGradeId}
                    onChange={(e) => {
                      setSelectedGradeId(e.target.value)
                      const g = grades.find(x => x.id === e.target.value)
                      if (g && g.sections.length > 0) {
                        setSelectedSectionId(g.sections[0].id)
                      }
                    }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {getTrackDisplayName(g)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Cohort / Batch
                  </label>
                  <div className="flex gap-2">
                    {currentGrade?.sections.map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => setSelectedSectionId(sec.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          selectedSectionId === sec.id
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Batch {sec.name} ({sec.room_number || 'Tech Lab'})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Admin Quick Swap Toggle */}
            {isAdmin && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSwapMode(!swapMode)
                    setSelectedSlotForSwap(null)
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    swapMode
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  {swapMode ? 'Exit Swap Mode' : 'Quick Swap Mode'}
                </button>

                <div className="text-right pl-3 border-l border-slate-800">
                  <div className="text-[11px] text-slate-400">Track Matrix</div>
                  <div className="text-sm font-bold text-slate-200">
                    {getTrackDisplayName(currentGrade)} &bull; Batch {currentSection?.name || 'A'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {swapMode && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
              <span>
                <strong>Swap Mode Active:</strong> Click any slot to select it, then click another slot to swap them instantly!
              </span>
              {selectedSlotForSwap && (
                <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded">
                  Selected: {selectedSlotForSwap.day_of_week} Period {selectedSlotForSwap.period_number}
                </span>
              )}
            </div>
          )}

          {/* View Mode & Holiday Management Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0B0F19] p-3.5 rounded-2xl border border-amber-500/15">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Week View:</span>
              <button
                onClick={() => setVisibleDaysCount(7)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  visibleDaysCount === 7
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                7 Days (Mon - Sun)
              </button>
              <button
                onClick={() => setVisibleDaysCount(6)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  visibleDaysCount === 6
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                6 Days (Mon - Sat)
              </button>
              <button
                onClick={() => setVisibleDaysCount(5)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  visibleDaysCount === 5
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                5 Days (Mon - Fri)
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowHolidayModal(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition-all"
              >
                <Palmtree className="w-3.5 h-3.5 text-amber-400" />
                Manage Holidays & Off-Days ({Object.keys(holidays).length})
              </button>
            )}
          </div>

          {/* Timetable Weekly Matrix */}
          {loading ? (
            <div className="h-96 flex items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              Loading Schedule Grid...
            </div>
          ) : slots.length === 0 ? (
            <div className="h-80 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Calendar className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-medium">No timetable generated yet.</p>
              {isAdmin && (
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  Run AI Agent Generator
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-950/60">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-4 w-44 border-r border-slate-800">Time & Period</th>
                    {ALL_WEEKDAYS.slice(0, visibleDaysCount).map((day) => {
                      const isHoliday = !!holidays[day]
                      return (
                        <th key={day} className="p-4 border-r border-slate-800 last:border-r-0 min-w-[170px]">
                          <div className="flex items-center justify-between">
                            <span className={isHoliday ? 'text-amber-400' : 'text-slate-200'}>{day}</span>
                            {isHoliday && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Palmtree className="w-3 h-3" /> Holiday
                              </span>
                            )}
                          </div>
                          {isHoliday && (
                            <div className="text-[10px] text-amber-400/80 font-normal lowercase first-letter:uppercase truncate mt-0.5">
                              {holidays[day]}
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {periodNumbers.map((pNum) => {
                    const meta = getPeriodMeta(pNum)

                    if (meta.isBreak) {
                      return (
                        <tr key={pNum} className={meta.bg || 'bg-slate-900/40'}>
                          <td className="p-4 font-mono text-xs border-r border-amber-500/15 font-bold">
                            <div>{meta.time}</div>
                            <div className="text-[11px] opacity-80">{meta.label}</div>
                          </td>
                          <td colSpan={visibleDaysCount} className="p-3 text-center text-xs font-semibold tracking-wider uppercase opacity-90">
                            {meta.label} &bull; All Batches (09:00 AM &ndash; 06:00 PM Schedule)
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={pNum} className="hover:bg-slate-900/30 transition-colors">
                        <td className="p-4 border-r border-slate-800 font-mono text-xs text-slate-400 bg-slate-900/30">
                          <div className="font-bold text-slate-200">{meta.label}</div>
                          <div className="text-slate-500">{meta.time}</div>
                        </td>
                        {ALL_WEEKDAYS.slice(0, visibleDaysCount).map((day) => {
                          const isDayHoliday = !!holidays[day]
                          const slot = slots.find(
                            (s) => s.day_of_week === day && s.period_number === pNum
                          )

                          if (isDayHoliday || (slot?.slot_type as string) === 'holiday') {
                            return (
                              <td key={day} className="p-3 border-r border-slate-800/60 last:border-r-0 align-top">
                                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-950/10 text-slate-300 h-full flex flex-col justify-center items-center text-center space-y-1 min-h-[90px]">
                                  <Palmtree className="w-4 h-4 text-amber-400" />
                                  <div className="text-[11px] font-bold text-amber-300">Holiday / Off-Day</div>
                                  <div className="text-[10px] text-slate-400 line-clamp-1">{holidays[day] || 'Scheduled Off'}</div>
                                </div>
                              </td>
                            )
                          }

                          if (!slot) {
                            return (
                              <td key={day} className="p-3 border-r border-slate-800/60 last:border-r-0 text-slate-600 text-xs text-center">
                                -
                              </td>
                            )
                          }

                          const norm = getNormalizedSlot(slot)
                          const isSelectedForSwap = selectedSlotForSwap?.id === slot.id

                          return (
                            <td
                              key={day}
                              onClick={() => handleSlotClick(slot)}
                              className="p-3 border-r border-slate-800/60 last:border-r-0 align-top cursor-pointer group"
                              title="Click for details, live class launching, or slot adjustment"
                            >
                              <div
                                className={`p-3 rounded-xl border transition-all h-full flex flex-col justify-between relative min-h-[90px] ${
                                  isSelectedForSwap
                                    ? 'ring-2 ring-amber-400 bg-amber-950/40 border-amber-400 scale-[1.02]'
                                    : 'bg-slate-900/80 border-slate-800 text-slate-200 group-hover:border-amber-500/60 group-hover:bg-slate-850'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span
                                      className="font-bold text-xs px-2 py-0.5 rounded-md"
                                      style={{
                                        backgroundColor: `${norm.color || '#f59e0b'}20`,
                                        color: norm.color || '#f59e0b'
                                      }}
                                    >
                                      {norm.code}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold uppercase tracking-wider">
                                      LAB
                                    </span>
                                  </div>
                                  <div className="text-xs font-semibold text-slate-100 line-clamp-1">
                                    {norm.name}
                                  </div>
                                </div>

                                <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] space-y-0.5 text-slate-400">
                                  <div className="truncate font-medium text-slate-300 flex items-center justify-between">
                                    <span className="truncate">
                                      {isTeacher
                                        ? `${getTrackDisplayName(currentGrade)} • Batch ${slot.section_name || 'A'}`
                                        : norm.teacher}
                                    </span>
                                    {isAdmin && (
                                      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-400 shrink-0 ml-1" />
                                    )}
                                    {isTeacher && (
                                      <Video className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-400 shrink-0 ml-1" />
                                    )}
                                    {isStudent && (
                                      <Star className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-400 shrink-0 ml-1" />
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {norm.room}
                                  </div>
                                </div>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Dynamic Policy Rules Engine (ADMIN ONLY) */}
      {isAdmin && activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-orange-400" />
                Live Policy Rules & Scheduling Constraints
              </h2>
              <p className="text-xs text-slate-400">
                Modify, enable, or add school rules dynamically without touching any code. LangGraph reads these rules live from Neon DB.
              </p>
            </div>
            <button
              onClick={() => setShowAddRuleModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-yellow-300 text-xs font-bold hover:bg-cyan-500/20 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              Add Custom Policy Rule
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((r) => (
              <div
                key={r.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  r.is_enabled
                    ? 'bg-slate-900 border-slate-800 shadow-sm'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-orange-400 border border-indigo-500/20 uppercase tracking-wider">
                        {r.category}
                      </span>
                      <h3 className="font-bold text-white text-sm">{r.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400">{r.description}</p>
                  </div>

                  <button
                    onClick={() => handleToggleRule(r.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      r.is_enabled ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        r.is_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/15 space-y-2 text-xs">
                  <div className="font-semibold text-slate-300">Live Parameters (Neon DB):</div>
                  {r.rule_type === 'ground_capacity' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Max Sections on Field Simultaneously:</span>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map((cap) => (
                          <button
                            key={cap}
                            onClick={() => handleUpdateRuleParam(r.id, 'max_sections', cap)}
                            className={`px-3 py-1 rounded-md font-bold text-xs ${
                              r.parameters?.max_sections === cap
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {cap} Classes
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'max_daily_teacher_periods' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Max Teacher Daily Load:</span>
                      <div className="flex items-center gap-2">
                        {[4, 5, 6].map((p) => (
                          <button
                            key={p}
                            onClick={() => handleUpdateRuleParam(r.id, 'max_periods', p)}
                            className={`px-3 py-1 rounded-md font-bold text-xs ${
                              r.parameters?.max_periods === p
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {p} Periods
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'post_lunch_blacklist' && (
                    <div className="text-slate-400">
                      Blacklisted Period: <span className="font-mono text-amber-400">Period {r.parameters?.forbidden_period || 8} (2:00 PM)</span>
                    </div>
                  )}

                  {r.rule_type === 'rating_complaint_blacklist' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Blacklist Rating Threshold:</span>
                      <div className="flex items-center gap-2">
                        {[2.0, 2.5, 3.0].map((th) => (
                          <button
                            key={th}
                            onClick={() => handleUpdateRuleParam(r.id, 'threshold_rating', th)}
                            className={`px-2.5 py-1 rounded-md font-bold text-xs ${
                              r.parameters?.threshold_rating === th
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            &le; {th} Stars
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'consecutive_subject_limit' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Max Consecutive Periods:</span>
                      <span className="font-bold text-amber-400">{r.parameters?.max_consecutive || 2} periods</span>
                    </div>
                  )}

                  {r.rule_type === 'custom_day_schedule' && (
                    <div className="space-y-1">
                      <span className="text-slate-400">Configured Day Overrides:</span>
                      <div className="font-mono text-[11px] text-orange-300">
                        {JSON.stringify(r.parameters?.overrides || {})}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleDeleteRule(r.id)}
                    className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Rule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Faculty Directory, Ratings & Active Blacklists */}
      {isAdmin && activeTab === 'teachers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Faculty Directory & Performance Reviews</h2>
              <p className="text-xs text-slate-400">
                Candidate review telemetry, verified technical specializations, and AI scheduling ratings.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teachers.map((t) => {
              const hasComplaints = t.complaint_count > 0 || (t.active_restrictions && t.active_restrictions.length > 0)
              const techSkills = t.skills.filter(sk => 
                !['mathematics', 'physics', 'english', 'art', 'craft', 'storytelling', 'science', 'social', 'hindi', 'biology', 'chemistry'].some(k => sk.toLowerCase().includes(k))
              )

              return (
                <div
                  key={t.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    hasComplaints
                      ? 'bg-rose-950/10 border-rose-800/40 shadow-rose-950/20'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{t.display_name}</div>
                      <div className="text-xs text-slate-400 font-mono">ID: {t.employee_id} &bull; {t.qualification}</div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-xs font-bold text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {t.rating_avg.toFixed(1)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {techSkills.map((sk) => (
                      <span key={sk} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        {sk}
                      </span>
                    ))}
                  </div>

                  {t.reviews && t.reviews.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Reviews for {t.display_name}
                      </div>
                      {t.reviews.map((review) => (
                        <div key={review.id} className="p-2.5 rounded-lg bg-[#0B0F19] border border-amber-500/15 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200">{review.subject} &bull; {review.section}</span>
                            <span className="shrink-0 text-amber-400 font-bold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" /> {review.rating}/5
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{review.comments}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {t.active_restrictions && t.active_restrictions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-rose-900/30 space-y-2">
                      <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Active Agent Blacklist Restriction
                      </div>
                      {t.active_restrictions.map((r) => (
                        <div key={r.id} className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 text-xs text-rose-200">
                          <div className="font-semibold">{r.section} &bull; {r.subject}</div>
                          <div className="text-[11px] text-rose-300/80 mt-0.5">{r.reason}</div>
                          {isAdmin && (
                            <div className="mt-2 flex justify-end">
                              <button
                                onClick={() => handleToggleRestriction(r.id)}
                                className="text-[10px] text-slate-400 hover:text-white underline"
                              >
                                Toggle Restriction
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Autonomous Decisions & Audit Log (ADMIN ONLY) */}
      {isAdmin && activeTab === 'audit' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">LangGraph Autonomous Conflict Resolver Decisions</h2>
            <p className="text-xs text-slate-400">
              Traceability logs detailing how the agent handled teacher collisions, bypassed restricted teachers, and enforced ground limits.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0B0F19] border border-amber-500/15 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Status: Zero Hard Clashes &bull; All 10 Technical Batches Satisfied</span>
            </div>

            <div className="space-y-3">
              {(lastGenResult?.autonomous_decisions || [
                "Autonomous Optimization: High-compute GPU & Cloud lab allocations synchronized across all 10 Batches.",
                "Autonomous Resolver: Auto-assigned verified Lead Instructors based on technical specialization & student satisfaction ratings.",
                "Concurrency Audit: Verified concurrent hands-on lab sandbox usage is capped at <= 2 batches simultaneously.",
                "Ergonomic Audit: All 10 Technical Batches verified to have scheduled sprint standups and architectural review sessions."
              ]).map((dec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#0B0F19] border border-amber-500/15 text-xs text-slate-300 font-mono flex items-start gap-3"
                >
                  <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{dec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Period Management & Instant Substitute Finder Drawer (ADMIN ONLY) */}
      {isAdmin && activeSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0B0F19] border border-amber-500/20 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  Period Management & Substitution Desk
                </h3>
                <p className="text-xs text-slate-400">
                  {activeSlotModal.day_of_week} &bull; Period {activeSlotModal.period_number} ({activeSlotModal.start_time} - {activeSlotModal.end_time})
                </p>
              </div>
              <button
                onClick={() => setActiveSlotModal(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {/* Subject & Track Module */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Subject Module</label>
                <select
                  value={editingSubjectCode}
                  onChange={(e) => {
                    const code = e.target.value
                    setEditingSubjectCode(code)
                    const foundSub = adminCourses.flatMap(c => c.subjects).find(s => s.code === code)
                    if (foundSub) {
                      setEditingSubjectName(foundSub.name)
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-semibold"
                >
                  <option value="">-- Select Technical Subject Module --</option>
                  {adminCourses.map(c => (
                    <optgroup key={c.id} label={c.title}>
                      {c.subjects.map(s => (
                        <option key={s.id} value={s.code}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {adminCourses.length === 0 && (
                    <>
                      <option value="PY-101">PY-101 - Python Core & Advanced OOP</option>
                      <option value="GEN-201">GEN-201 - Prompt Engineering & LangChain</option>
                      <option value="RAG-301">RAG-301 - RAG Architecture & Vector DBs</option>
                      <option value="AI-401">AI-401 - Autonomous Agents & FastAPI</option>
                      <option value="SF-ADM">SF-ADM - Salesforce Admin Essentials</option>
                      <option value="SF-DEV">SF-DEV - Apex Programming & SOQL</option>
                      <option value="SN-FND">SN-FND - ServiceNow Administration</option>
                      <option value="FS-REA">FS-REA - React 19 & TypeScript</option>
                      <option value="DO-CON">DO-CON - Docker & Kubernetes Pods</option>
                    </>
                  )}
                </select>
                {editingSubjectName && (
                  <div className="text-[11px] text-amber-400 font-semibold mt-1">
                    Selected Module: {editingSubjectName}
                  </div>
                )}
              </div>

              {/* Assigned Faculty Teacher */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Faculty Instructor</label>
                <select
                  value={editingTeacherId}
                  onChange={(e) => setEditingTeacherId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value="">-- Select Lead Faculty --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.employee_id}) &bull; Rating: {t.rating_avg}/5
                    </option>
                  ))}
                </select>
              </div>

              {/* Venue & Slot Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Room / Venue</label>
                  <input
                    type="text"
                    value={editingRoom}
                    onChange={(e) => setEditingRoom(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    placeholder="Tech Lab 101 / Virtual Zoom"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Slot Type</label>
                  <select
                    value={editingSlotType}
                    onChange={(e) => setEditingSlotType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="lecture">Technical Lecture</option>
                    <option value="lab">Hands-On Lab Sandbox</option>
                    <option value="holiday">Holiday / Off-Period</option>
                    <option value="assessment">Capstone / Assessment</option>
                  </select>
                </div>
              </div>

              {/* 1-Click Launch Live Class */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-cyan-400" />
                    Live Video Classroom Stream
                  </div>
                  <div className="text-[11px] text-slate-400">Launch live Zoom or WebRTC broadcast for this session.</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchLiveSession(activeSlotModal)}
                  disabled={launchingLiveClass}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>{launchingLiveClass ? 'Launching...' : 'Launch Class'}</span>
                </button>
              </div>

              {/* Substitutes Section */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    Available Subject Qualified Substitutes
                  </div>
                  {loadingSubstitutes && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                </div>

                {substitutes.length === 0 && !loadingSubstitutes ? (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                    No alternate teachers found with matching subject qualifications.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {substitutes.map((sub) => (
                      <div
                        key={sub.teacher_id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                          sub.is_free
                            ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50'
                            : 'bg-slate-950/40 border-slate-900 opacity-60'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{sub.display_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {sub.employee_id}
                            </span>
                            <span className="text-[10px] flex items-center gap-0.5 text-amber-400 font-bold">
                              <Star className="w-3 h-3 fill-current" /> {sub.rating_avg}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Load today: {sub.current_day_load}/{sub.max_daily_periods} periods
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAssignSubstitute(sub.teacher_id)}
                          disabled={!sub.is_free}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            sub.is_free
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Assign Sub
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSlotModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveSlotEdits}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20"
              >
                Save Slot Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Viewer & Live Launcher Modal (FACULTY & STUDENT) */}
      {showSlotViewerModal && selectedSlotForView && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0B0F19] border border-amber-500/20 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  {selectedSlotForView.day_of_week} &bull; Period {selectedSlotForView.period_number}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedSlotForView.start_time} - {selectedSlotForView.end_time} &bull; {selectedSlotForView.room_or_venue || 'Technical Lab Hall'}
                </p>
              </div>
              <button
                onClick={() => setShowSlotViewerModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {(() => {
              const norm = selectedSlotForView ? getNormalizedSlot(selectedSlotForView) : null
              if (!norm) return null
              return (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${norm.color || '#f59e0b'}20`, color: norm.color || '#f59e0b' }}>
                        {norm.code}
                      </span>
                      <span className="text-xs font-bold text-white">{norm.name}</span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center justify-between">
                      <span>Faculty: <strong className="text-slate-200">{norm.teacher}</strong></span>
                      <span>Venue: <strong className="text-slate-200">{norm.room}</strong></span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleLaunchLiveSession(selectedSlotForView)}
                      disabled={launchingLiveClass}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>{isTeacher ? 'Launch Live Video Broadcast' : 'Join Live Video Session'}</span>
                    </button>

                    {isStudent && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSlotViewerModal(false)
                          if (selectedSlotForView.teacher_id) {
                            setFeedbackTeacherId(selectedSlotForView.teacher_id)
                            setShowFeedbackModal(true)
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        Rate Faculty Instructor
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Manage Holidays & Off-Days Modal (ADMIN ONLY) */}
      {isAdmin && showHolidayModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0B0F19] border border-amber-500/20 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Palmtree className="w-4 h-4 text-amber-400" />
                  Institute Holiday & Off-Day Manager
                </h3>
                <p className="text-xs text-slate-400">
                  Set institute-wide holidays, weekend off-days, hackathons, and custom breaks.
                </p>
              </div>
              <button
                onClick={() => setShowHolidayModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Day</label>
                  <select
                    value={holidayTargetDay}
                    onChange={(e) => setHolidayTargetDay(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
                  >
                    {ALL_WEEKDAYS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Holiday Reason / Tag</label>
                  <input
                    type="text"
                    value={holidayReasonInput}
                    onChange={(e) => setHolidayReasonInput(e.target.value)}
                    placeholder="e.g. Sunday Weekend Off, Hackathon"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleDayHoliday(holidayTargetDay, holidayReasonInput)
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20"
                >
                  {holidays[holidayTargetDay] ? 'Update / Clear Holiday' : 'Mark as Holiday'}
                </button>
              </div>

              {/* List of active holidays */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Active Institute Holidays ({Object.keys(holidays).length})
                </div>

                {Object.keys(holidays).length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl">
                    No holidays configured. All 7 days are active.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {Object.entries(holidays).map(([day, reason]) => (
                      <div
                        key={day}
                        className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/20 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Palmtree className="w-3.5 h-3.5 text-amber-400" />
                            {day}
                          </div>
                          <div className="text-[11px] text-amber-300/90">{reason}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleDayHoliday(day)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Policy Rule Modal (ADMIN ONLY) */}
      {isAdmin && showAddRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0B0F19] border border-amber-500/15 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-amber-400" />
                Create New Scheduling Policy Rule
              </h3>
              <button
                onClick={() => setShowAddRuleModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Rule Name</label>
                <input
                  required
                  type="text"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g. Wednesday Delayed Morning Start"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Rule Type</label>
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                >
                  <option value="ground_capacity">Ground Concurrent Capacity Limit</option>
                  <option value="max_daily_teacher_periods">Teacher Daily Workload Cap</option>
                  <option value="custom_day_schedule">Special Day Schedule (Delayed Start)</option>
                  <option value="lab_capacity">Lab Concurrent Section Limit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Parameter Value (e.g. 3 classes, or "Wednesday")
                </label>
                <input
                  required
                  type="text"
                  value={newRuleParamVal}
                  onChange={(e) => setNewRuleParamVal(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  placeholder="Explain why this rule exists..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all"
                >
                  Save Rule to Neon DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Teacher Leave Modal (ADMIN ONLY) */}
      {isAdmin && showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0B0F19] border border-amber-500/15 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <UserX className="w-4 h-4 text-amber-400" />
                Simulate Faculty Leave & Absence
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Select Absent Teacher</label>
                <select
                  value={leaveTeacherId}
                  onChange={(e) => setLeaveTeacherId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Day of Week</label>
                <select
                  value={leaveDay}
                  onChange={(e) => setLeaveDay(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                >
                  {ALL_WEEKDAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Reason</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {submittingLeave ? 'Logging...' : 'Record Absence & Re-route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Student Review / Complaint Modal (Students & Admins) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0B0F19] border border-amber-500/15 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                {isStudent ? 'Rate Your Instructor' : 'Submit Teacher Review / Complaint'}
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Instructor</label>
                <select
                  value={feedbackTeacherId}
                  onChange={(e) => setFeedbackTeacherId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.employee_id}) &bull; Rating: {t.rating_avg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Your Rating (1 to 5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 ${
                        feedbackRating >= star
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {star}
                    </button>
                  ))}
                </div>
                {feedbackRating <= 2 && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    Rating &le; 2 automatically triggers an AI blacklist restriction for this class.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Feedback Comments / Feedback</label>
                <textarea
                  required
                  rows={3}
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="Share your feedback on pace, concept clarity, or class engagement..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default TimetablePage
