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
  getAdminCourses,
  getMyEnrollments,
  createSchoolLiveClass,
  getSchoolLiveClasses,
  type SchoolGrade,
  type SchoolLiveClass,
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
  if (!g) return 'Course'
  return g.name || 'Course'
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
  const [liveClasses, setLiveClasses] = useState<SchoolLiveClass[]>([])
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

  // Teacher & Student Schedule View Mode (Default to daily agenda for teachers)
  const [scheduleViewMode, setScheduleViewMode] = useState<'daily' | 'grid'>(isTeacher ? 'daily' : 'grid')
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<string>(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const today = dayNames[new Date().getDay()]
    return today === 'Sunday' || today === 'Saturday' ? 'Monday' : today
  })
  
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

  useEffect(() => {
    const pollTimer = setInterval(async () => {
      try {
        const live = await getSchoolLiveClasses().catch(() => [])
        if (live) setLiveClasses(live)
      } catch (e) {
        // silent background sync
      }
    }, 10000)
    return () => clearInterval(pollTimer)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [gradesData, teachersData, coursesData, liveClassesData, myEnrollmentsData] = await Promise.all([
        getGrades().catch(() => []),
        getTeachersWithFeedback().catch(() => []),
        getAdminCourses().catch(() => []),
        getSchoolLiveClasses().catch(() => []),
        getMyEnrollments().catch(() => []),
      ])
      setGrades(gradesData || [])
      setTeachers(teachersData || [])
      setAdminCourses(coursesData || [])
      setLiveClasses(liveClassesData || [])

      if (isAdmin) {
        const rulesData = await getTimetableRules().catch(() => [])
        setRules(rulesData || [])
      }

      // If user is a teacher, locate their teacher profile and load their personalized grid
      if (isTeacher) {
        const profile = (teachersData || []).find(
          t => t.user_id === currentUser?.id || (currentUser?.email && t.email?.toLowerCase() === currentUser?.email?.toLowerCase())
        )
        setMyTeacherProfile(profile || null)

        // Backend getTimetableGrid automatically identifies authenticated teacher and returns their assigned slots
        const teacherSlots = await getTimetableGrid(profile ? { teacher_id: profile.id } : undefined)
        setSlots(teacherSlots || [])
      } else if (isStudent) {
        // Student: fetch grid directly scoped to student's enrolled courses from backend
        const studentSlots = await getTimetableGrid()
        setSlots(studentSlots || [])

        // Filter grades to student's enrolled courses
        const enrolledIds = new Set((myEnrollmentsData || []).map(e => e.course_id))
        const enrolledCourses = (coursesData || []).filter((c: any) => enrolledIds.has(c.id))
        const enrolledTitles = enrolledCourses.map((c: any) => c.title.toLowerCase())
        const enrolledSlugs = enrolledCourses.map((c: any) => (c.slug || '').toLowerCase())
        const studentGrades = (gradesData || []).filter(g =>
          enrolledTitles.some((t: string) => g.name.toLowerCase().includes(t)) ||
          enrolledSlugs.some((s: string) => g.name.toLowerCase().includes(s))
        )

        if (studentGrades.length > 0) {
          setGrades(studentGrades)
          setSelectedGradeId(studentGrades[0].id)
          if (studentGrades[0].sections && studentGrades[0].sections.length > 0) {
            setSelectedSectionId(studentGrades[0].sections[0].id)
          }
        } else {
          setGrades([])
          setSelectedGradeId('')
          setSelectedSectionId('')
        }
      } else {
        // Admin: Load master class section grid
        if (gradesData && gradesData.length > 0) {
          setSelectedGradeId(gradesData[0].id)
          if (gradesData[0].sections && gradesData[0].sections.length > 0) {
            setSelectedSectionId(gradesData[0].sections[0].id)
            await loadGrid(gradesData[0].sections[0].id)
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

  const getActiveLiveClassForSlot = (slot: TimetableSlot) => {
    const sCode = (slot.subject_code || '').toLowerCase().trim()
    const sName = (slot.subject_name || '').toLowerCase().trim()
    return liveClasses.find(c => {
      if (c.status !== 'live') return false
      const cCode = (c.subject_code || '').toLowerCase().trim()
      const cName = (c.subject_name || '').toLowerCase().trim()
      const matchSub = (sCode && cCode === sCode) || (sName && cName.includes(sName)) || (sName && sName.includes(cName))
      const matchSec = !slot.section_name || !c.section_name || slot.section_name === c.section_name
      return matchSub && matchSec
    })
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
      const activeLive = getActiveLiveClassForSlot(slot)
      if (isStudent) {
        if (activeLive) {
          const zoomUrl = activeLive.zoom_join_url || activeLive.meeting_url
          if (zoomUrl && (zoomUrl.startsWith('http://') || zoomUrl.startsWith('https://'))) {
            window.open(zoomUrl, '_blank')
          } else {
            setStatusMessage(`Joined live session for ${activeLive.subject_name || slot.subject_name}!`)
          }
        } else {
          alert(`Faculty Lead has not started the live broadcast for "${slot.subject_name}" yet. The link will become accessible once broadcasting begins.`)
        }
        return
      }

      setLaunchingLiveClass(true)
      const now = new Date()
      const end = new Date(now.getTime() + 45 * 60 * 1000)
      const norm = getNormalizedSlot(slot)
      const res = await createSchoolLiveClass({
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
      setStatusMessage(`Live Session for ${norm.name} active! Provisioned Zoom link opened.`)
      setActiveSlotModal(null)
      setShowSlotViewerModal(false)

      const zoomUrl = isTeacher ? (res.zoom_start_url || res.zoom_join_url || res.meeting_url) : (res.zoom_join_url || res.meeting_url)
      if (zoomUrl && (zoomUrl.startsWith('http://') || zoomUrl.startsWith('https://'))) {
        window.open(zoomUrl, '_blank')
      }

      const updated = await getSchoolLiveClasses().catch(() => [])
      setLiveClasses(updated || [])
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
        description: newRuleDesc || 'Custom institute timetable scheduling policy',
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
      case 0: return { label: 'Daily Standup & Sprint Overview', time: '08:45 - 09:00', isBreak: true, bg: 'bg-indigo-950/40 border-indigo-800/40 text-indigo-400' }
      case 1: return { label: 'Technical Masterclass 1', time: '09:00 - 10:15', isBreak: false }
      case 2: return { label: 'Technical Masterclass 2', time: '10:15 - 11:30', isBreak: false }
      case 3: return { label: 'Morning Coffee & Collab Break', time: '11:30 - 11:45', isBreak: true, bg: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400' }
      case 4: return { label: 'Hands-On Lab & Live Coding Sprint 1', time: '11:45 - 13:00', isBreak: false }
      case 5: return { label: 'Lunch & Peer Networking Hour', time: '13:00 - 14:00', isBreak: true, bg: 'bg-amber-950/40 border-amber-800/40 text-amber-400' }
      case 6: return { label: 'System Architecture & Frameworks', time: '14:00 - 15:15', isBreak: false }
      case 7: return { label: 'Hands-On Lab & Live Coding Sprint 2', time: '15:15 - 16:30', isBreak: false }
      case 8: return { label: 'Code Review, Doubt Clearing & Git Sync', time: '16:30 - 17:30', isBreak: true, bg: 'bg-purple-950/40 border-purple-800/40 text-purple-400' }
      default: return { label: `Training Session ${pNum}`, time: '', isBreak: false }
    }
  }

  const totalRestrictions = teachers.reduce((acc, t) => acc + (t.active_restrictions?.length || 0), 0)
  const activeLabCapacity = rules.find(r => r.rule_type === 'lab_capacity')?.parameters?.max_sections || 3

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300" style={{ background: '#FAF9F6' }}>
      {/* Header Banner - Role Customized */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-[#FFF5EE] via-[#FFF0E6] to-[#F5EEFF] p-6 md:p-8 rounded-3xl border border-[#FFDEC4]/80 shadow-xs relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/80 border border-[#FFDEC4] text-[#FF7A18] text-xs font-bold uppercase tracking-wider shadow-xs">
            {isAdmin && <Sparkles className="w-3.5 h-3.5" />}
            {isTeacher && <GraduationCap className="w-3.5 h-3.5" />}
            {isStudent && <BookOpen className="w-3.5 h-3.5" />}
            {isAdmin ? 'Institute AI Timetable Engine' : isTeacher ? 'Faculty Teaching Schedule' : 'Batch Class Schedule'}
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-[#111827] tracking-tight flex items-center gap-3">
            {isAdmin && 'Batch Schedule & Timetable Engine'}
            {isTeacher && (myTeacherProfile ? `${myTeacherProfile.display_name} - Faculty Schedule` : 'Faculty Teaching Schedule')}
            {isStudent && `${currentGrade?.name || 'Course'} - Weekly Batch Schedule`}
          </h1>

          <p className="text-[#64748B] text-xs sm:text-sm max-w-2xl font-medium leading-relaxed">
            {isAdmin && 'Automated timetable generator for institute courses with Zoom scheduling integration.'}
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-black/[0.08] bg-white hover:bg-neutral-50 text-[#334155] text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <UserX className="w-4 h-4 text-[#FF7A18]" />
              <span>Log Faculty Leave</span>
            </button>

            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-black/[0.08] bg-white hover:bg-neutral-50 text-[#334155] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Database className={`w-4 h-4 text-[#64748B] ${seeding ? 'animate-spin text-[#FF7A18]' : ''}`} />
              <span>{seeding ? 'Seeding...' : 'Reset Defaults'}</span>
            </button>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white text-xs font-bold transition-all shadow-md shadow-[#FF7A18]/25 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'LangGraph Processing...' : 'Run AI Agent'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Status Toast */}
      {statusMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-[#FF7A18] hover:underline text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Admin KPI Stats Grid */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
              <span>Courses & Batches</span>
              <Building className="w-4 h-4 text-[#FF7A18]" />
            </div>
            <div className="text-2xl font-black text-[#111827]">{grades.length || 0} Courses &bull; {grades.reduce((acc, g) => acc + (g.sections?.length || 0), 0) || 'Active'} Batches</div>
            <div className="text-xs text-[#94A3B8]">Curriculum-aligned database courses</div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
              <span>Concurrent Lab Limit</span>
              <Activity className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <div className="text-2xl font-black text-[#111827]">{activeLabCapacity} Cohorts Max</div>
            <div className="text-xs text-[#94A3B8]">Configurable in Policy Rules tab</div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
              <span>Active Policy Rules</span>
              <Sliders className="w-4 h-4 text-[#8B5CF6]" />
            </div>
            <div className="text-2xl font-black text-[#111827]">{rules.filter(r => r.is_enabled).length} Enabled</div>
            <div className="text-xs text-[#94A3B8]">{rules.length} total defined in Neon DB</div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs space-y-1">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium">
              <span>Active Constraints</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600">{totalRestrictions} Exclusions</div>
            <div className="text-xs text-[#94A3B8]">Auto-bypassed during scheduling</div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs (Admin gets all tabs; Teachers/Students get their relevant views) */}
      <div className="flex border-b border-black/[0.06] gap-6">
        <button
          onClick={() => setActiveTab('grid')}
          className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
            activeTab === 'grid' ? 'text-[#FF7A18]' : 'text-[#64748B] hover:text-[#111827]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{isAdmin ? 'Master Timetable Grid' : isTeacher ? 'My Teaching Timetable' : 'Batch Weekly Grid'}</span>
          {activeTab === 'grid' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF7A18] rounded-full" />
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'rules' ? 'text-[#FF7A18]' : 'text-[#64748B] hover:text-[#111827]'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Institute Policy Rules Engine</span>
            <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-[10px] text-[#64748B] font-mono font-bold">
              {rules.length}
            </span>
            {activeTab === 'rules' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF7A18] rounded-full" />
            )}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('teachers')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'teachers' ? 'text-[#FF7A18]' : 'text-[#64748B] hover:text-[#111827]'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Faculty Directory & Reviews</span>
            <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-[10px] text-[#64748B] font-mono font-bold">
              {teachers.length}
            </span>
            {activeTab === 'teachers' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF7A18] rounded-full" />
            )}
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit' ? 'text-[#FF7A18]' : 'text-[#64748B] hover:text-[#111827]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Agent Resolutions Log</span>
            {lastGenResult?.autonomous_decisions && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                {lastGenResult.autonomous_decisions.length}
              </span>
            )}
            {activeTab === 'audit' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF7A18] rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* TAB 1: Master Timetable Grid */}
      {activeTab === 'grid' && (
        <div className="space-y-6">
          {/* Controls: Only Admin and Students can select Grade/Section; Teachers see their personal schedule */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
            {isTeacher ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] flex items-center justify-center text-[#FF7A18] font-black text-sm">
                  {myTeacherProfile?.employee_id || 'T'}
                </div>
                <div>
                  <div className="text-sm font-bold text-[#111827]">
                    {myTeacherProfile?.display_name || currentUser?.display_name} &bull; Teaching Load
                  </div>
                  <div className="text-xs text-[#64748B]">
                    Showing your allocated lectures across all classes (Monday to Friday)
                  </div>
                </div>
              </div>
            ) : isStudent ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] flex items-center justify-center text-[#FF7A18] font-bold">
                  <BookOpen className="w-5 h-5 text-[#FF7A18]" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#111827]">
                    {currentGrade?.name || 'Class'} &bull; Section {currentSection?.name || 'A'} ({currentSection?.room_number || 'Room 101'})
                  </div>
                  <div className="text-xs text-[#64748B]">
                    Your Official Class Weekly Timetable &bull; Click any subject period to rate your instructor
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                    Course
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
                    className="bg-white border border-black/[0.08] rounded-xl px-3.5 py-2 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18] font-bold shadow-xs cursor-pointer"
                  >
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {getTrackDisplayName(g)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                    Cohort / Batch
                  </label>
                  <div className="flex gap-2">
                    {currentGrade?.sections.map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => setSelectedSectionId(sec.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          selectedSectionId === sec.id
                            ? 'bg-[#FF7A18] text-white shadow-md shadow-[#FF7A18]/25 font-bold'
                            : 'bg-neutral-100 text-[#475569] hover:bg-neutral-200'
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
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                    swapMode
                      ? 'bg-[#FF7A18] text-white border-[#FF7A18] shadow-md shadow-[#FF7A18]/25'
                      : 'bg-white text-[#334155] border-black/[0.08] hover:bg-neutral-50 shadow-xs'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{swapMode ? 'Exit Swap Mode' : 'Quick Swap Mode'}</span>
                </button>

                <div className="text-right pl-3 border-l border-neutral-200">
                  <div className="text-[10px] font-bold uppercase text-[#94A3B8]">Course & Batch</div>
                  <div className="text-xs font-bold text-[#111827]">
                    {getTrackDisplayName(currentGrade)} &bull; Batch {currentSection?.name || 'A'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {swapMode && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
              <span>
                <strong>Swap Mode Active:</strong> Click any slot to select it, then click another slot to swap them instantly!
              </span>
              {selectedSlotForSwap && (
                <span className="font-mono bg-amber-200/60 px-2 py-0.5 rounded font-bold">
                  Selected: {selectedSlotForSwap.day_of_week} Period {selectedSlotForSwap.period_number}
                </span>
              )}
            </div>
          )}

          {/* View Mode & Holiday Management Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-black/[0.06] shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mr-1">View Mode:</span>
              <button
                onClick={() => setScheduleViewMode('daily')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scheduleViewMode === 'daily'
                    ? 'bg-[#FF7A18] text-white shadow-md shadow-[#FF7A18]/25 font-bold'
                    : 'bg-neutral-100 text-[#475569] hover:text-[#111827]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Daily Masterclasses Agenda</span>
              </button>

              <button
                onClick={() => setScheduleViewMode('grid')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scheduleViewMode === 'grid'
                    ? 'bg-[#FF7A18] text-white shadow-md shadow-[#FF7A18]/25 font-bold'
                    : 'bg-neutral-100 text-[#475569] hover:text-[#111827]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Full Weekly Grid</span>
              </button>
            </div>

            {scheduleViewMode === 'grid' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mr-1">Days:</span>
                <button
                  onClick={() => setVisibleDaysCount(7)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    visibleDaysCount === 7 ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4]' : 'bg-neutral-100 text-[#64748B]'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setVisibleDaysCount(6)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    visibleDaysCount === 6 ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4]' : 'bg-neutral-100 text-[#64748B]'
                  }`}
                >
                  6 Days
                </button>
                <button
                  onClick={() => setVisibleDaysCount(5)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    visibleDaysCount === 5 ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4]' : 'bg-neutral-100 text-[#64748B]'
                  }`}
                >
                  5 Days
                </button>
              </div>
            )}

            {isAdmin && (
              <button
                onClick={() => setShowHolidayModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] text-xs font-bold hover:bg-[#FFE8D6] transition-all ml-auto cursor-pointer"
              >
                <Palmtree className="w-3.5 h-3.5 text-[#FF7A18]" />
                <span>Holidays ({Object.keys(holidays).length})</span>
              </button>
            )}
          </div>

          {/* ── DAILY MASTERCLASSES & AGENDA VIEW ── */}
          {scheduleViewMode === 'daily' && (
            <div className="space-y-6">
              {/* Day Selector Pill Bar */}
              <div className="flex flex-wrap items-center gap-2 p-2 bg-white rounded-3xl border border-black/[0.06] shadow-xs">
                {ALL_WEEKDAYS.map((day) => {
                  const daySlots = slots.filter((s) => s.day_of_week.toLowerCase() === day.toLowerCase())
                  const isSelected = selectedScheduleDay.toLowerCase() === day.toLowerCase()
                  const isToday = day.toLowerCase() === new Date().toLocaleString('en-US', { weekday: 'long' }).toLowerCase()
                  const isHoliday = !!holidays[day]

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedScheduleDay(day)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF7A18] text-white shadow-md shadow-[#FF7A18]/25 font-bold scale-102'
                          : 'bg-neutral-100 text-[#475569] hover:text-[#111827] hover:bg-neutral-200'
                      }`}
                    >
                      <span>{day}</span>
                      {isToday && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${isSelected ? 'bg-white text-[#FF7A18]' : 'bg-amber-100 text-amber-800'}`}>
                          Today
                        </span>
                      )}
                      {isHoliday ? (
                        <span className="text-[10px] text-amber-500">🌴</span>
                      ) : daySlots.length > 0 ? (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200 text-[#475569]'}`}>
                          {daySlots.length}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {/* Workload & Telemetry Summary Cards for Selected Day */}
              {(() => {
                const daySlots = slots.filter((s) => s.day_of_week.toLowerCase() === selectedScheduleDay.toLowerCase())
                const teachingSlots = daySlots.filter((s) => s.subject_name || s.subject_code)
                const uniqueBatches = Array.from(new Set(daySlots.map((s) => s.section_name).filter(Boolean)))
                const uniqueSubjects = Array.from(new Set(daySlots.map((s) => s.subject_name).filter(Boolean)))

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
                      <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Scheduled Sessions</div>
                      <div className="text-2xl font-black text-[#FF7A18] mt-1">{teachingSlots.length} Masterclasses</div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">{selectedScheduleDay} Agenda</div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
                      <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Teaching Duration</div>
                      <div className="text-2xl font-black text-emerald-600 mt-1">{(teachingSlots.length * 1.25).toFixed(1)} Hours</div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">Live Masterclass & Lab</div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
                      <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Active Cohorts</div>
                      <div className="text-2xl font-black text-[#111827] mt-1">{uniqueBatches.length || (isTeacher ? 2 : 1)} Batches</div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">Parallel Courses</div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
                      <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Subjects Covered</div>
                      <div className="text-2xl font-black text-[#8B5CF6] mt-1">{uniqueSubjects.length || (teachingSlots.length ? 1 : 0)} Modules</div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">Assigned Syllabus Focus</div>
                    </div>
                  </div>
                )
              })()}

              {/* Day Masterclasses Chronological List */}
              {loading ? (
                <div className="h-64 flex items-center justify-center text-[#64748B] gap-3 bg-white rounded-3xl border border-black/[0.06]">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#FF7A18]" />
                  <span>Loading {selectedScheduleDay}'s schedule...</span>
                </div>
              ) : (() => {
                const daySlots = slots
                  .filter((s) => s.day_of_week.toLowerCase() === selectedScheduleDay.toLowerCase())
                  .sort((a, b) => a.period_number - b.period_number)

                const isHoliday = !!holidays[selectedScheduleDay]

                if (isHoliday) {
                  return (
                    <div className="p-12 text-center bg-white rounded-3xl border border-black/[0.06] space-y-3 shadow-xs">
                      <Palmtree className="w-12 h-12 text-amber-500 mx-auto" />
                      <h3 className="text-lg font-bold text-[#111827]">{selectedScheduleDay} • Scheduled Institute Holiday</h3>
                      <p className="text-xs text-[#64748B] max-w-md mx-auto">{holidays[selectedScheduleDay]}</p>
                      <button
                        onClick={() => setSelectedScheduleDay('Monday')}
                        className="px-4 py-2 rounded-xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs transition-all mt-2 cursor-pointer shadow-sm"
                      >
                        View Monday's Masterclasses &rarr;
                      </button>
                    </div>
                  )
                }

                if (daySlots.length === 0) {
                  return (
                    <div className="p-12 text-center bg-white rounded-3xl border border-black/[0.06] space-y-3 shadow-xs">
                      <Calendar className="w-12 h-12 text-[#94A3B8] mx-auto" />
                      <h3 className="text-base font-bold text-[#111827]">No Sessions Scheduled for {selectedScheduleDay}</h3>
                      <p className="text-xs text-[#64748B] max-w-md mx-auto">
                        {isTeacher
                          ? 'You have no assigned teaching periods on this day according to institute policy.'
                          : 'No batch lectures scheduled on this day. Check the full weekly grid.'}
                      </p>
                      <button
                        onClick={() => setSelectedScheduleDay('Monday')}
                        className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#111827] font-bold text-xs transition-all mt-2 cursor-pointer"
                      >
                        Check Monday Schedule
                      </button>
                    </div>
                  )
                }

                return (
                  <div className="space-y-3">
                    {daySlots.map((slot) => {
                      const meta = getPeriodMeta(slot.period_number)
                      const isBreak = meta.isBreak

                      if (isBreak) {
                        return (
                          <div
                            key={slot.id || `break_${slot.period_number}`}
                            className="p-4 rounded-2xl border border-[#FFDEC4] bg-[#FFF9EE] text-[#D97706] flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-black">{slot.start_time} - {slot.end_time}</span>
                              <span className="font-bold text-xs uppercase tracking-wider">{meta.label}</span>
                            </div>
                            <span className="text-[11px] font-semibold opacity-80">Institute Wide Break</span>
                          </div>
                        )
                      }

                      const norm = getNormalizedSlot(slot)
                      const activeLive = getActiveLiveClassForSlot(slot)
                      const isSlotLive = Boolean(activeLive)

                      return (
                        <div
                          key={slot.id}
                          className={`p-5 rounded-3xl bg-white border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:shadow-md ${
                            isSlotLive ? 'border-rose-400 bg-rose-50/40 shadow-xs' : 'border-black/[0.06] hover:border-[#FF7A18]/40'
                          }`}
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-1 rounded-lg bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] text-xs font-extrabold font-mono">
                                Period {slot.period_number} &bull; {slot.start_time} - {slot.end_time}
                              </span>
                              <span
                                className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                style={{ backgroundColor: `${norm.color}15`, color: norm.color }}
                              >
                                {norm.code}
                              </span>
                              <span className="text-[11px] font-bold text-[#64748B] bg-neutral-100 px-2.5 py-0.5 rounded-md">
                                {slot.slot_type === 'lab' ? 'Hands-On Lab' : 'Live Masterclass'}
                              </span>
                              {isSlotLive && (
                                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-black uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                  LIVE BROADCAST
                                </span>
                              )}
                            </div>

                            <div>
                              <h3 className="text-base font-bold text-[#111827] group-hover:text-[#FF7A18] transition-colors">
                                {norm.name}
                              </h3>
                              <p className="text-xs text-[#64748B] mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>{isTeacher ? `${getTrackDisplayName(currentGrade)} • Batch ${slot.section_name || 'A'}` : `Faculty: ${norm.teacher}`}</span>
                                <span>&bull;</span>
                                <span className="text-[#94A3B8]">Venue: {norm.room}</span>
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {(isTeacher || isAdmin) && (
                              <button
                                onClick={() => handleLaunchLiveSession(slot)}
                                disabled={launchingLiveClass}
                                className={`px-4 py-2.5 rounded-2xl text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer ${
                                  isSlotLive
                                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25 animate-pulse'
                                    : 'bg-[#FF7A18] hover:bg-[#EA6C0A] shadow-[#FF7A18]/25'
                                }`}
                              >
                                <Video className="w-4 h-4" />
                                <span>{launchingLiveClass ? 'Connecting...' : isSlotLive ? 'Resume Live Class' : 'Launch Zoom'}</span>
                              </button>
                            )}

                            {isStudent && (
                              <button
                                onClick={() => handleLaunchLiveSession(slot)}
                                disabled={launchingLiveClass}
                                className={`px-4 py-2.5 rounded-2xl text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer ${
                                  isSlotLive
                                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25 animate-pulse'
                                    : 'bg-[#10B981] hover:bg-[#059669] shadow-emerald-500/20'
                                }`}
                              >
                                <Play className="w-4 h-4 fill-current" />
                                <span>{isSlotLive ? '🔴 Join Live Session' : 'Join Live Class'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setSelectedSlotForView(slot)
                                setEditingSubjectCode(slot.subject_code || '')
                                setEditingSubjectName(slot.subject_name || '')
                                setEditingTeacherId(slot.teacher_id || '')
                                setEditingSlotType(slot.slot_type || 'lecture')
                                setShowSlotViewerModal(true)
                              }}
                              className="p-2.5 rounded-xl bg-[#FAF9F6] hover:bg-[#FFF3EA] text-[#64748B] hover:text-[#FF7A18] border border-black/[0.08] text-xs font-bold transition-all"
                              title="View Session Details & Feedback"
                            >
                              <Edit3 className="w-4 h-4 text-[#FF7A18]" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── TIMETABLE WEEKLY MATRIX VIEW ── */}
          {scheduleViewMode === 'grid' && (
            loading ? (
              <div className="h-96 flex items-center justify-center text-[#64748B] gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-[#FF7A18]" />
                Loading Schedule Grid...
              </div>
            ) : slots.length === 0 ? (
              <div className="h-80 rounded-3xl border border-dashed border-black/[0.08] flex flex-col items-center justify-center text-[#64748B] space-y-3 bg-[#FAF9F6]">
                <Calendar className="w-10 h-10 text-[#94A3B8]" />
                <p className="text-sm font-medium">No timetable generated yet.</p>
                {isAdmin && (
                  <button
                    onClick={handleGenerate}
                    className="px-4 py-2 rounded-xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Run AI Agent Generator
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-black/[0.06] shadow-sm bg-white">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-[#FAF9F6] border-b border-black/[0.06] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      <th className="p-4 w-44 border-r border-black/[0.06]">Time & Period</th>
                      {ALL_WEEKDAYS.slice(0, visibleDaysCount).map((day) => {
                        const isHoliday = !!holidays[day]
                        return (
                          <th key={day} className="p-4 border-r border-black/[0.06] last:border-r-0 min-w-[170px]">
                            <div className="flex items-center justify-between">
                              <span className={isHoliday ? 'text-[#FF7A18]' : 'text-[#111827]'}>{day}</span>
                              {isHoliday && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] flex items-center gap-1">
                                  <Palmtree className="w-3 h-3" /> Holiday
                                </span>
                              )}
                            </div>
                            {isHoliday && (
                              <div className="text-[10px] text-[#FF7A18]/80 font-normal lowercase first-letter:uppercase truncate mt-0.5">
                                {holidays[day]}
                              </div>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] text-sm">
                    {periodNumbers.map((pNum) => {
                      const meta = getPeriodMeta(pNum)

                      if (meta.isBreak) {
                        return (
                          <tr key={pNum} className="bg-[#FFF9EE] text-[#D97706]">
                            <td className="p-4 font-mono text-xs border-r border-[#FFDEC4] font-bold">
                              <div>{meta.time}</div>
                              <div className="text-[11px] opacity-80">{meta.label}</div>
                            </td>
                            <td colSpan={visibleDaysCount} className="p-3 text-center text-xs font-bold tracking-wider uppercase">
                              {meta.label} &bull; All Batches (09:00 AM &ndash; 06:00 PM Schedule)
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={pNum} className="hover:bg-neutral-50/60 transition-colors">
                          <td className="p-4 border-r border-black/[0.06] font-mono text-xs text-[#64748B] bg-[#FAFAF8]">
                            <div className="font-bold text-[#111827]">{meta.label}</div>
                            <div className="text-[#94A3B8]">{meta.time}</div>
                          </td>
                          {ALL_WEEKDAYS.slice(0, visibleDaysCount).map((day) => {
                            const isDayHoliday = !!holidays[day]
                            const slot = slots.find(
                              (s) => s.day_of_week === day && s.period_number === pNum
                            )

                            if (isDayHoliday || (slot?.slot_type as string) === 'holiday') {
                              return (
                                <td key={day} className="p-3 border-r border-black/[0.06] last:border-r-0 align-top">
                                  <div className="p-3 rounded-2xl border border-[#FFDEC4] bg-[#FFF9EE] text-[#D97706] h-full flex flex-col justify-center items-center text-center space-y-1 min-h-[90px]">
                                    <Palmtree className="w-4 h-4 text-amber-500" />
                                    <div className="text-[11px] font-bold text-[#D97706]">Holiday / Off-Day</div>
                                    <div className="text-[10px] text-[#B45309] line-clamp-1">{holidays[day] || 'Scheduled Off'}</div>
                                  </div>
                                </td>
                              )
                            }

                            if (!slot) {
                              return (
                                <td key={day} className="p-3 border-r border-black/[0.06] last:border-r-0 text-[#CBD5E1] text-xs text-center">
                                  -
                                </td>
                              )
                            }

                            const norm = getNormalizedSlot(slot)
                            const isSelectedForSwap = selectedSlotForSwap?.id === slot.id
                            const activeLive = getActiveLiveClassForSlot(slot)
                            const isSlotLive = Boolean(activeLive)

                            return (
                              <td
                                key={day}
                                onClick={() => handleSlotClick(slot)}
                                className="p-3 border-r border-black/[0.06] last:border-r-0 align-top cursor-pointer group"
                                title="Click for details, live class launching, or slot adjustment"
                              >
                                <div
                                  className={`p-3.5 rounded-2xl border transition-all h-full flex flex-col justify-between relative min-h-[90px] ${
                                    isSelectedForSwap
                                      ? 'ring-2 ring-[#FF7A18] bg-[#FFF3EA] border-[#FF7A18] scale-[1.02]'
                                      : isSlotLive
                                      ? 'bg-rose-50 border-rose-300 shadow-sm'
                                      : 'bg-white border-black/[0.08] text-[#111827] group-hover:border-[#FF7A18] group-hover:shadow-sm'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span
                                        className="font-bold text-xs px-2 py-0.5 rounded-md"
                                        style={{
                                          backgroundColor: `${norm.color || '#f59e0b'}15`,
                                          color: norm.color || '#f59e0b'
                                        }}
                                      >
                                        {norm.code}
                                      </span>
                                      {isSlotLive ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                          LIVE
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-[#64748B] font-bold uppercase tracking-wider">
                                          {slot.slot_type === 'lab' ? 'LAB' : 'LECTURE'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs font-bold text-[#111827] line-clamp-1">
                                      {norm.name}
                                    </div>
                                  </div>

                                  <div className="mt-2 pt-2 border-t border-black/[0.04] text-[11px] space-y-0.5 text-[#64748B]">
                                    <div className="truncate font-semibold text-[#334155] flex items-center justify-between">
                                      <span className="truncate">
                                        {isTeacher
                                          ? `${getTrackDisplayName(currentGrade)} • Batch ${slot.section_name || 'A'}`
                                          : norm.teacher}
                                      </span>
                                      {isAdmin && (
                                        <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#FF7A18] shrink-0 ml-1" />
                                      )}
                                      {isTeacher && (
                                        <Video className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#FF7A18] shrink-0 ml-1" />
                                      )}
                                      {isStudent && (
                                        <Star className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#FF7A18] shrink-0 ml-1" />
                                      )}
                                    </div>
                                    <div className="text-[10px] text-[#94A3B8] truncate">
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
            )
          )}
        </div>
      )}

      {/* TAB 2: Dynamic Policy Rules Engine (ADMIN ONLY) */}
      {isAdmin && activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#FF7A18]" />
                <span>Live Policy Rules & Scheduling Constraints</span>
              </h2>
              <p className="text-xs text-[#64748B]">
                Modify, enable, or add institute rules dynamically without touching any code. LangGraph reads these rules live from Neon DB.
              </p>
            </div>
            <button
              onClick={() => setShowAddRuleModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] text-xs font-bold hover:bg-[#FFE8D6] transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#FF7A18]" />
              <span>Add Custom Policy Rule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((r) => (
              <div
                key={r.id}
                className={`p-5 rounded-3xl border transition-all space-y-4 ${
                  r.is_enabled
                    ? 'bg-white border-black/[0.06] shadow-xs'
                    : 'bg-neutral-50/80 border-black/[0.04] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] uppercase tracking-wider font-bold">
                        {r.category}
                      </span>
                      <h3 className="font-bold text-[#111827] text-sm">{r.name}</h3>
                    </div>
                    <p className="text-xs text-[#64748B]">{r.description}</p>
                  </div>

                  <button
                    onClick={() => handleToggleRule(r.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      r.is_enabled ? 'bg-[#FF7A18]' : 'bg-neutral-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        r.is_enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] space-y-2 text-xs">
                  <div className="font-bold text-[#334155]">Live Parameters (Neon DB):</div>
                  {r.rule_type === 'lab_capacity' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#64748B]">Max Cohorts in Cloud Sandbox Simultaneously:</span>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map((cap) => (
                          <button
                            key={cap}
                            onClick={() => handleUpdateRuleParam(r.id, 'max_sections', cap)}
                            className={`px-3 py-1 rounded-xl font-bold text-xs cursor-pointer ${
                              r.parameters?.max_sections === cap
                                ? 'bg-[#FF7A18] text-white'
                                : 'bg-white border border-black/[0.08] text-[#334155] hover:bg-neutral-100'
                            }`}
                          >
                            {cap} Cohorts
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'max_daily_teacher_periods' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#64748B]">Max Faculty Mentorship Daily Load:</span>
                      <div className="flex items-center gap-2">
                        {[3, 4, 5, 6].map((p) => (
                          <button
                            key={p}
                            onClick={() => handleUpdateRuleParam(r.id, 'max_periods', p)}
                            className={`px-3 py-1 rounded-xl font-bold text-xs cursor-pointer ${
                              r.parameters?.max_periods === p
                                ? 'bg-[#FF7A18] text-white'
                                : 'bg-white border border-black/[0.08] text-[#334155] hover:bg-neutral-100'
                            }`}
                          >
                            {p} Sessions
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'consecutive_lecture_limit' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#64748B]">Max Back-to-Back Theory Modules:</span>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3].map((m) => (
                          <button
                            key={m}
                            onClick={() => handleUpdateRuleParam(r.id, 'max_consecutive', m)}
                            className={`px-3 py-1 rounded-xl font-bold text-xs cursor-pointer ${
                              r.parameters?.max_consecutive === m
                                ? 'bg-[#FF7A18] text-white'
                                : 'bg-white border border-black/[0.08] text-[#334155] hover:bg-neutral-100'
                            }`}
                          >
                            {m} Modules
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'rating_complaint_blacklist' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#64748B]">Candidate Satisfaction Floor:</span>
                      <div className="flex items-center gap-2">
                        {[2.0, 2.5, 3.0].map((th) => (
                          <button
                            key={th}
                            onClick={() => handleUpdateRuleParam(r.id, 'threshold_rating', th)}
                            className={`px-2.5 py-1 rounded-xl font-bold text-xs cursor-pointer ${
                              r.parameters?.threshold_rating === th
                                ? 'bg-[#FF7A18] text-white'
                                : 'bg-white border border-black/[0.08] text-[#334155] hover:bg-neutral-100'
                            }`}
                          >
                            &le; {th} Stars
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.rule_type === 'doubt_clearing_interval' && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#64748B]">End-of-Day Code Review Mandate:</span>
                      <span className="font-bold text-emerald-600">Enforced Daily (16:30 - 17:30)</span>
                    </div>
                  )}

                  {r.rule_type === 'weekend_sprint_schedule' && (
                    <div className="space-y-1">
                      <span className="text-[#64748B]">Bootcamp Weekend Schedule Overrides:</span>
                      <div className="font-mono text-[11px] text-[#FF7A18]">
                        {JSON.stringify(r.parameters?.overrides || {})}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleDeleteRule(r.id)}
                    className="text-[11px] text-[#94A3B8] hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Rule</span>
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
              <h2 className="text-lg font-bold text-[#111827]">Faculty Directory & Performance Reviews</h2>
              <p className="text-xs text-[#64748B]">
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
                  className={`p-5 rounded-3xl border transition-all ${
                    hasComplaints
                      ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                      : 'bg-white border-black/[0.06] shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-[#111827]">{t.display_name}</div>
                      <div className="text-xs text-[#64748B] font-mono">ID: {t.employee_id} &bull; {t.qualification}</div>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFF3EA] text-xs font-bold text-[#FF7A18]">
                      <Star className="w-3.5 h-3.5 fill-[#FF7A18] text-[#FF7A18]" />
                      <span>{t.rating_avg.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {techSkills.map((sk) => (
                      <span key={sk} className="text-[11px] px-2.5 py-0.5 rounded-lg bg-neutral-100 text-[#334155] font-medium">
                        {sk}
                      </span>
                    ))}
                  </div>

                  {t.reviews && t.reviews.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-black/[0.04] space-y-2">
                      <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Reviews for {t.display_name}
                      </div>
                      {t.reviews.map((review) => (
                        <div key={review.id} className="p-3 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#111827]">{review.subject} &bull; {review.section}</span>
                            <span className="shrink-0 text-[#FF7A18] font-bold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" /> {review.rating}/5
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] mt-1">{review.comments}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {t.active_restrictions && t.active_restrictions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-rose-100 space-y-2">
                      <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        Active Agent Blacklist Restriction
                      </div>
                      {t.active_restrictions.map((r) => (
                        <div key={r.id} className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                          <div className="font-semibold">{r.section} &bull; {r.subject}</div>
                          <div className="text-[11px] text-rose-700/90 mt-0.5">{r.reason}</div>
                          {isAdmin && (
                            <div className="mt-2 flex justify-end">
                              <button
                                onClick={() => handleToggleRestriction(r.id)}
                                className="text-[11px] text-rose-700 hover:text-rose-900 underline font-semibold cursor-pointer"
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
            <h2 className="text-lg font-bold text-[#111827]">LangGraph Autonomous Conflict Resolver Decisions</h2>
            <p className="text-xs text-[#64748B]">
              Traceability logs detailing how the agent handled teacher collisions, bypassed restricted teachers, and enforced ground limits.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-black/[0.06] shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
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
                  className="p-4 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] text-xs text-[#334155] font-mono flex items-start gap-3"
                >
                  <ChevronRight className="w-4 h-4 text-[#FF7A18] shrink-0 mt-0.5" />
                  <span>{dec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Period Management & Instant Substitute Finder Drawer (ADMIN ONLY) */}
      {isAdmin && activeSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div>
                <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#FF7A18]" />
                  Period Management & Substitution Desk
                </h3>
                <p className="text-xs text-[#64748B]">
                  {activeSlotModal.day_of_week} &bull; Period {activeSlotModal.period_number} ({activeSlotModal.start_time} - {activeSlotModal.end_time})
                </p>
              </div>
              <button
                onClick={() => setActiveSlotModal(null)}
                className="text-[#94A3B8] hover:text-[#111827] text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {/* Subject & Track Module */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Subject Module</label>
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
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] font-semibold focus:outline-none focus:border-[#FF7A18]"
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
                  <div className="text-[11px] text-[#FF7A18] font-bold mt-1.5">
                    Selected Module: {editingSubjectName}
                  </div>
                )}
              </div>

              {/* Assigned Faculty Teacher */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Assigned Faculty Instructor</label>
                <select
                  value={editingTeacherId}
                  onChange={(e) => setEditingTeacherId(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
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
                  <label className="block text-[11px] font-bold text-[#334155] mb-1">Room / Venue</label>
                  <input
                    type="text"
                    value={editingRoom}
                    onChange={(e) => setEditingRoom(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl px-3 py-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                    placeholder="Tech Lab 101 / Virtual Zoom"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#334155] mb-1">Slot Type</label>
                  <select
                    value={editingSlotType}
                    onChange={(e) => setEditingSlotType(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl px-3 py-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                  >
                    <option value="lecture">Technical Lecture</option>
                    <option value="lab">Hands-On Lab Sandbox</option>
                    <option value="holiday">Holiday / Off-Period</option>
                    <option value="assessment">Capstone / Assessment</option>
                  </select>
                </div>
              </div>

              {/* 1-Click Launch Live Class */}
              <div className="p-4 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-[#FF7A18]" />
                    Live Video Classroom Stream
                  </div>
                  <div className="text-[11px] text-[#64748B]">Launch live Zoom or WebRTC broadcast for this session.</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchLiveSession(activeSlotModal)}
                  disabled={launchingLiveClass}
                  className="px-4 py-2 rounded-xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white text-xs font-bold transition-all shadow-md shadow-[#FF7A18]/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{launchingLiveClass ? 'Launching...' : 'Launch Class'}</span>
                </button>
              </div>

              {/* Substitutes Section */}
              <div className="space-y-2 pt-2 border-t border-black/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#334155] uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    Available Subject Qualified Substitutes
                  </div>
                  {loadingSubstitutes && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF7A18]" />}
                </div>

                {substitutes.length === 0 && !loadingSubstitutes ? (
                  <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] text-center text-xs text-[#64748B]">
                    No alternate teachers found with matching subject qualifications.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {substitutes.map((sub) => (
                      <div
                        key={sub.teacher_id}
                        className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                          sub.is_free
                            ? 'bg-white border-black/[0.06] hover:border-emerald-500/50'
                            : 'bg-neutral-50 border-black/[0.04] opacity-60'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#111827]">{sub.display_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-[#64748B] font-mono">
                              {sub.employee_id}
                            </span>
                            <span className="text-[10px] flex items-center gap-0.5 text-[#FF7A18] font-bold">
                              <Star className="w-3 h-3 fill-current" /> {sub.rating_avg}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            Load today: {sub.current_day_load}/{sub.max_daily_periods} periods
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAssignSubstitute(sub.teacher_id)}
                          disabled={!sub.is_free}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            sub.is_free
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
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

            <div className="flex justify-end gap-3 pt-3 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={() => setActiveSlotModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveSlotEdits}
                className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white text-xs font-bold transition-all shadow-md shadow-[#FF7A18]/25 cursor-pointer"
              >
                Save Slot Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Viewer & Live Launcher Modal (FACULTY & STUDENT) */}
      {showSlotViewerModal && selectedSlotForView && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div>
                <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#FF7A18]" />
                  {selectedSlotForView.day_of_week} &bull; Period {selectedSlotForView.period_number}
                </h3>
                <p className="text-xs text-[#64748B]">
                  {selectedSlotForView.start_time} - {selectedSlotForView.end_time} &bull; {selectedSlotForView.room_or_venue || 'Technical Lab Hall'}
                </p>
              </div>
              <button
                onClick={() => setShowSlotViewerModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {(() => {
              const norm = selectedSlotForView ? getNormalizedSlot(selectedSlotForView) : null
              if (!norm) return null
              const activeLive = selectedSlotForView ? getActiveLiveClassForSlot(selectedSlotForView) : null
              const isLive = Boolean(activeLive)

              return (
                <div className="space-y-4">
                  {/* Live Status Header */}
                  {isLive ? (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs animate-pulse">
                      <div className="flex items-center gap-2 text-rose-700 font-extrabold uppercase tracking-wider">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        🔴 LIVE BROADCAST ACTIVE
                      </div>
                      <span className="text-[11px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-lg">
                        Zoom Connected
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[#64748B] font-semibold">
                        <span className="w-2 h-2 rounded-full bg-neutral-400" />
                        Scheduled Timetable Period
                      </div>
                      <span className="text-[11px] text-[#94A3B8]">Offline / Awaiting Broadcast</span>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg" style={{ backgroundColor: `${norm.color || '#FF7A18'}15`, color: norm.color || '#FF7A18' }}>
                        {norm.code}
                      </span>
                      <span className="text-xs font-bold text-[#111827]">{norm.name}</span>
                    </div>
                    <div className="text-xs text-[#64748B] flex items-center justify-between">
                      <span>Faculty: <strong className="text-[#111827]">{norm.teacher}</strong></span>
                      <span>Venue: <strong className="text-[#111827]">{norm.room}</strong></span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(isTeacher || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => handleLaunchLiveSession(selectedSlotForView)}
                        disabled={launchingLiveClass}
                        className={`w-full py-3 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                          isLive
                            ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/30 animate-pulse'
                            : 'bg-[#FF7A18] hover:bg-[#EA6C0A] shadow-[#FF7A18]/25'
                        }`}
                      >
                        {isLive ? <Video className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                        <span>
                          {launchingLiveClass
                            ? 'Connecting Stream...'
                            : isLive
                            ? 'Resume / Join Live Video Broadcast'
                            : 'Launch Live Video Broadcast (Zoom Session)'}
                        </span>
                      </button>
                    )}

                    {isStudent && (
                      <button
                        type="button"
                        onClick={() => handleLaunchLiveSession(selectedSlotForView)}
                        disabled={launchingLiveClass}
                        className={`w-full py-3 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                          isLive
                            ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/30 animate-pulse cursor-pointer'
                            : 'bg-neutral-100 text-[#64748B] border border-black/[0.06] hover:bg-neutral-200 cursor-pointer'
                        }`}
                      >
                        {isLive ? <Play className="w-4 h-4 fill-current" /> : <Video className="w-4 h-4 text-neutral-400" />}
                        <span>
                          {isLive
                            ? '🔴 Join Live Video Classroom'
                            : 'Live Broadcast Offline (Starts When Faculty Launches)'}
                        </span>
                      </button>
                    )}

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
                        className="w-full py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-[#111827] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5 text-[#FF7A18]" />
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div>
                <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                  <Palmtree className="w-4 h-4 text-[#FF7A18]" />
                  Institute Holiday & Off-Day Manager
                </h3>
                <p className="text-xs text-[#64748B]">
                  Set institute-wide holidays, weekend off-days, hackathons, and custom breaks.
                </p>
              </div>
              <button
                onClick={() => setShowHolidayModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">Select Day</label>
                  <select
                    value={holidayTargetDay}
                    onChange={(e) => setHolidayTargetDay(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                  >
                    {ALL_WEEKDAYS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">Holiday Reason / Tag</label>
                  <input
                    type="text"
                    value={holidayReasonInput}
                    onChange={(e) => setHolidayReasonInput(e.target.value)}
                    placeholder="e.g. Sunday Weekend Off, Hackathon"
                    className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleDayHoliday(holidayTargetDay, holidayReasonInput)
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs transition-all shadow-md shadow-[#FF7A18]/25 cursor-pointer"
                >
                  {holidays[holidayTargetDay] ? 'Update / Clear Holiday' : 'Mark as Holiday'}
                </button>
              </div>

              {/* List of active holidays */}
              <div className="space-y-2 pt-2 border-t border-black/[0.06]">
                <div className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                  Active Institute Holidays ({Object.keys(holidays).length})
                </div>

                {Object.keys(holidays).length === 0 ? (
                  <div className="p-3.5 text-center text-xs text-[#64748B] bg-[#FAF9F6] rounded-2xl">
                    No holidays configured. All 7 days are active.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {Object.entries(holidays).map(([day, reason]) => (
                      <div
                        key={day}
                        className="p-3 rounded-2xl bg-[#FFF9EE] border border-[#FFDEC4] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                            <Palmtree className="w-3.5 h-3.5 text-[#FF7A18]" />
                            {day}
                          </div>
                          <div className="text-[11px] text-[#B45309] font-medium">{reason}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleDayHoliday(day)}
                          className="px-3 py-1 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                className="px-5 py-2.5 rounded-2xl bg-neutral-100 text-[#111827] text-xs font-bold hover:bg-neutral-200 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Policy Rule Modal (ADMIN ONLY) */}
      {isAdmin && showAddRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#FF7A18]" />
                Create New Scheduling Policy Rule
              </h3>
              <button
                onClick={() => setShowAddRuleModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Rule Name</label>
                <input
                  required
                  type="text"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g. Wednesday Delayed Morning Start"
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Rule Type</label>
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                >
                  <option value="ground_capacity">Ground Concurrent Capacity Limit</option>
                  <option value="max_daily_teacher_periods">Teacher Daily Workload Cap</option>
                  <option value="custom_day_schedule">Special Day Schedule (Delayed Start)</option>
                  <option value="lab_capacity">Lab Concurrent Section Limit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Parameter Value (e.g. 3 classes, or "Wednesday")
                </label>
                <input
                  required
                  type="text"
                  value={newRuleParamVal}
                  onChange={(e) => setNewRuleParamVal(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  placeholder="Explain why this rule exists..."
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white text-xs font-bold transition-all shadow-md shadow-[#FF7A18]/25 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                <UserX className="w-4 h-4 text-[#FF7A18]" />
                Simulate Faculty Leave & Absence
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Select Absent Teacher</label>
                <select
                  value={leaveTeacherId}
                  onChange={(e) => setLeaveTeacherId(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Day of Week</label>
                <select
                  value={leaveDay}
                  onChange={(e) => setLeaveDay(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                >
                  {ALL_WEEKDAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Reason</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white text-xs font-bold transition-all shadow-md shadow-[#FF7A18]/25 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                {isStudent ? 'Rate Your Instructor' : 'Submit Teacher Review / Complaint'}
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Instructor</label>
                <select
                  value={feedbackTeacherId}
                  onChange={(e) => setFeedbackTeacherId(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.employee_id}) &bull; Rating: {t.rating_avg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Your Rating (1 to 5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        feedbackRating >= star
                          ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4]'
                          : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {star}
                    </button>
                  ))}
                </div>
                {feedbackRating <= 2 && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    Rating &le; 2 automatically triggers an AI blacklist restriction for this class.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">Feedback Comments / Feedback</label>
                <textarea
                  required
                  rows={3}
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  placeholder="Share your feedback on pace, concept clarity, or class engagement..."
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white text-xs font-bold transition-all shadow-md shadow-[#FF7A18]/25 disabled:opacity-50 cursor-pointer"
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
