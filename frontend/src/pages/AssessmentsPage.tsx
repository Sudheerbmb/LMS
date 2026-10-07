import React, { useState, useEffect, useRef } from 'react'
import {
  type User,
  type AdminInstituteCourse,
  type Enrollment,
  getAdminCourses,
  getMyEnrollments
} from '../lib/api'
import {
  CheckSquare,
  Plus,
  CheckCircle,
  Sparkles,
  Upload,
  Clock,
  BookOpen,
  Award,
  Users,
  Check,
  Loader2,
  Trash2,
  ArrowRight,
  Shield,
  Camera,
  Mic,
  AlertTriangle,
  Eye,
  FileCheck,
  Zap
} from 'lucide-react'
import {
  getScheduledAssessments,
  saveScheduledAssessment,
  deleteScheduledAssessment,
  getAssessmentsForStudent,
  getAssessmentsForTeacher,
  generateAIQuestionSet,
  submitStudentAssessment,
  getAllSubmissions,
  isAssessmentCompletedByStudent
} from '../lib/assessmentStore'
import type {
  ScheduledAssessment,
  QuestionItem,
  StudentSubmission
} from '../lib/assessmentStore'

type AssessmentsPageProps = {
  user: User | null
}

export const AssessmentsPage: React.FC<AssessmentsPageProps> = ({ user }) => {
  const isAdmin = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher' || isAdmin
  const isStudent = user?.role === 'student'

  const [adminCourses, setAdminCourses] = useState<AdminInstituteCourse[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [selectedCourseSlug, setSelectedCourseSlug] = useState<string>('')

  const [activeTab, setActiveTab] = useState<'assessments' | 'submissions'>('assessments')
  const [assessmentsList, setAssessmentsList] = useState<ScheduledAssessment[]>([])
  const [submissionsList, setSubmissionsList] = useState<StudentSubmission[]>([])

  // Dynamic available courses based on user role
  const availableCourses = React.useMemo(() => {
    if (isAdmin) return adminCourses
    if (user?.role === 'teacher') {
      const taught = adminCourses.filter(c =>
        c.subjects.some(s =>
          s.teacher_id === user.id ||
          (s.teacher_name && user.display_name && s.teacher_name.toLowerCase() === user.display_name.toLowerCase())
        )
      )
      return taught.length > 0 ? taught : adminCourses
    }
    if (isStudent && enrollments.length > 0) {
      const activeIds = new Set(enrollments.filter(e => e.status === 'active').map(e => e.course_id))
      const activeSlugs = new Set(enrollments.filter(e => e.status === 'active').map(e => e.course_slug || e.course?.slug || ''))
      const enrolled = adminCourses.filter(c => activeIds.has(c.id) || activeSlugs.has(c.slug))
      return enrolled.length > 0 ? enrolled : adminCourses
    }
    return adminCourses
  }, [adminCourses, enrollments, user, isAdmin, isStudent])

  const studentEnrolledCourse = availableCourses[0]?.title || 'Institute Curriculum'

  const activeCourse = React.useMemo(() => {
    return availableCourses.find(c => c.slug === selectedCourseSlug || c.id === selectedCourseSlug) || availableCourses[0] || null
  }, [availableCourses, selectedCourseSlug])

  // Subjects for the currently selected course in the modal
  const activeCourseSubjects = React.useMemo(() => {
    if (!activeCourse) return []
    if (user?.role === 'teacher') {
      const teacherSubs = activeCourse.subjects.filter(s =>
        s.teacher_id === user.id ||
        (s.teacher_name && user.display_name && s.teacher_name.toLowerCase() === user.display_name.toLowerCase())
      )
      return teacherSubs.length > 0 ? teacherSubs : activeCourse.subjects
    }
    return activeCourse.subjects
  }, [activeCourse, user])

  // Create Modal State (For Teachers)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState<'details' | 'questions'>('details')
  const [creationMode, setCreationMode] = useState<'AI' | 'MANUAL' | 'PDF'>('AI')
  const [targetGrade, setTargetGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [topicSyllabus, setTopicSyllabus] = useState('Core Architecture & Implementation')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduleType, setScheduleType] = useState<'ALWAYS_AVAILABLE' | 'TIME_WINDOW' | 'EXACT_TIME'>('ALWAYS_AVAILABLE')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [passingScore, setPassingScore] = useState(70)
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [documentContent, setDocumentContent] = useState<string>('')

  // Sync default targetGrade and subject when active course changes
  useEffect(() => {
    if (activeCourse) {
      setTargetGrade(activeCourse.title)
      if (activeCourseSubjects.length > 0 && !activeCourseSubjects.some(s => s.name === subject)) {
        setSubject(activeCourseSubjects[0].name)
      }
    }
  }, [activeCourse, activeCourseSubjects])

  // Question Items for Creation
  const [questionItems, setQuestionItems] = useState<QuestionItem[]>([])
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  // Manual Question Addition Fields
  const [manQText, setManQText] = useState('')
  const [manQType, setManQType] = useState<'multiple_choice' | 'descriptive'>('multiple_choice')
  const [manOptions, setManOptions] = useState<string[]>(['', '', '', ''])
  const [manCorrect, setManCorrect] = useState(0)
  const [manPoints, setManPoints] = useState(10)
  const [manLevel, setManLevel] = useState<'FOUNDATION' | 'APPLICATION' | 'REASONING' | 'TRANSFER'>('APPLICATION')

  // Student Examination & AI Proctoring State
  const [takingTest, setTakingTest] = useState<ScheduledAssessment | null>(null)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string | number>>({})
  const [submittingTest, setSubmittingTest] = useState(false)
  const [testResult, setTestResult] = useState<StudentSubmission | null>(null)
  const [viewingPastSubmission, setViewingPastSubmission] = useState<StudentSubmission | null>(null)

  // AI Proctoring Security Telemetry
  const [proctorActive, setProctorActive] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [violations, setViolations] = useState<string[]>([])
  const [violationCount, setViolationCount] = useState(0)
  const [showWarningModal, setShowWarningModal] = useState<string | null>(null)
  const [isDisqualified, setIsDisqualified] = useState(false)
  const [micVolumeLevel, setMicVolumeLevel] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    refreshData()
  }, [user])

  const refreshData = async () => {
    try {
      const [crs, enrs] = await Promise.all([
        getAdminCourses().catch(() => []),
        getMyEnrollments().catch(() => [])
      ])
      setAdminCourses(crs)
      setEnrollments(enrs)

      if (isAdmin) {
        setAssessmentsList(getScheduledAssessments())
      } else if (user?.role === 'teacher') {
        const mySubNames: string[] = []
        crs.forEach(c => {
          c.subjects.forEach(s => {
            if (s.teacher_id === user.id || (s.teacher_name && user.display_name && s.teacher_name.toLowerCase() === user.display_name.toLowerCase())) {
              mySubNames.push(s.name, s.code)
            }
          })
        })
        setAssessmentsList(getAssessmentsForTeacher(user.id, mySubNames))
      } else {
        const enrolledIdentifiers = enrs.length > 0
          ? enrs.map(e => e.course_name || e.course_slug || e.course?.title || e.course?.slug || '')
          : (user?.display_name ? [user.display_name] : ['all'])
        setAssessmentsList(getAssessmentsForStudent(enrolledIdentifiers))
      }
    } catch {
      setAssessmentsList(getScheduledAssessments())
    }
    setSubmissionsList(getAllSubmissions())
  }

  // ── AI Proctoring Video & Audio Hardware Setup ────────────────────────────
  const startProctoringSession = async () => {
    try {
      // 1. Request Webcam and Mic
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // 2. Setup Audio Decibel Meter
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const audioCtx = new AudioCtx()
        audioContextRef.current = audioCtx
        const analyser = audioCtx.createAnalyser()
        analyserRef.current = analyser
        analyser.fftSize = 256
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const checkVolume = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
          const avg = sum / dataArray.length
          setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)))

          // If sustained loud noise occurs
          if (avg > 90) {
            recordViolation('Loud background noise / voice assistance detected')
          }
          if (proctorActive) {
            requestAnimationFrame(checkVolume)
          }
        }
        requestAnimationFrame(checkVolume)
      } catch (audioErr) {
        console.warn('Audio analyser fallback:', audioErr)
      }

      // 3. Request Fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      }

      setProctorActive(true)
      setViolations([])
      setViolationCount(0)
      setIsDisqualified(false)
    } catch (err) {
      console.warn('Camera/Mic permission warning:', err)
      // Allow proceeding with soft proctoring fallback
      setProctorActive(true)
    }
  }

  const stopProctoringSession = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
    setProctorActive(false)
  }

  // ── Anti-Cheat Event Listeners (Tab switch, Blur, Fullscreen exit) ────────
  useEffect(() => {
    if (!proctorActive || !takingTest || testResult || isDisqualified) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('Browser tab switch / application minimized')
      }
    }

    const handleWindowBlur = () => {
      recordViolation('Focus lost / mouse exited examination window')
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && proctorActive) {
        recordViolation('Exited fullscreen examination security mode')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [proctorActive, takingTest, testResult, isDisqualified, violationCount])

  const recordViolation = (reason: string) => {
    if (isDisqualified || testResult) return

    const newCount = violationCount + 1
    const newViolations = [...violations, `${reason} (at ${new Date().toLocaleTimeString()})`]
    setViolations(newViolations)
    setViolationCount(newCount)

    if (newCount >= 3) {
      // 3 Strikes => Immediate Disqualification
      setIsDisqualified(true)
      setShowWarningModal(null)
      if (takingTest) {
        const sub = submitStudentAssessment(
          takingTest,
          user?.id || 'demo_student',
          user?.display_name || 'Student',
          studentEnrolledCourse,
          studentAnswers,
          { cheated: true, violations: newViolations, count: newCount }
        )
        setTestResult(sub)
        refreshData()
      }
      stopProctoringSession()
    } else {
      setShowWarningModal(`SECURITY ALERT (Strike ${newCount}/3): ${reason}. Please remain focused on the exam screen.`)
    }
  }

  // Handle AI Question Generation
  const handleAIGenerate = async () => {
    setIsGeneratingAI(true)
    try {
      const generated = await generateAIQuestionSet(
        targetGrade,
        subject,
        topicSyllabus,
        5,
        documentContent || undefined
      )
      setQuestionItems(generated)
    } catch (err) {
      console.error(err)
    } finally {
      setIsGeneratingAI(false)
    }
  }

  // Add Manual Question
  const handleAddManualQuestion = () => {
    if (!manQText.trim()) return
    const newQ: QuestionItem = {
      id: `q_man_${Date.now()}`,
      question_text: manQText,
      question_type: manQType,
      options: manQType === 'multiple_choice' ? manOptions.filter((o) => o.trim() !== '') : undefined,
      correct_answer: manQType === 'multiple_choice' ? manCorrect : undefined,
      points: manPoints,
      cognitive_level: manLevel,
      concept_name: topicSyllabus || subject,
      explanation: 'Teacher verified rubric evaluation.',
    }
    setQuestionItems([...questionItems, newQ])
    setManQText('')
    setManOptions(['', '', '', ''])
    setManCorrect(0)
  }

  // Handle Save / Publish Assessment
  const handlePublishAssessment = () => {
    if (!title.trim()) return

    const totalPts = questionItems.reduce((acc, q) => acc + q.points, 0)
    const newAssessment: ScheduledAssessment = {
      id: `asmt_${Date.now()}`,
      title,
      description: description || `Scheduled assessment for ${targetGrade} ${subject} covering ${topicSyllabus}.`,
      target_grade: targetGrade,
      subject,
      topic_syllabus: topicSyllabus,
      teacher_id: user?.id || 'teacher_sarah',
      teacher_name: user?.display_name || 'Dr. Sarah Connor',
      created_at: new Date().toISOString(),
      schedule_type: scheduleType,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      duration_minutes: durationMinutes,
      passing_score: passingScore,
      total_points: totalPts || 30,
      submissions_count: 0,
      status: 'PUBLISHED',
      requires_proctoring: true,
      pdf_attachment_name: pdfFileName || undefined,
      question_sets: [
        {
          set_name: 'Set A',
          questions: questionItems.length > 0 ? questionItems : [
            {
              id: 'q_default_1',
              question_text: `Fundamental analytical theorem verification for ${topicSyllabus || subject}.`,
              question_type: 'multiple_choice',
              options: ['Core Derivation (Correct)', 'Misconception A', 'Misconception B', 'Misconception C'],
              correct_answer: 0,
              points: 10,
              cognitive_level: 'FOUNDATION',
              concept_name: topicSyllabus,
            }
          ]
        }
      ]
    }

    saveScheduledAssessment(newAssessment)
    refreshData()
    setShowCreateModal(false)
    setCreateStep('details')
    setTitle('')
    setDescription('')
    setQuestionItems([])
    setDocumentContent('')
    alert(`Assessment "${newAssessment.title}" successfully scheduled and published for ${targetGrade}!`)
  }

  // Handle Student Start Test with Proctoring
  const handleStartTest = async (asmt: ScheduledAssessment) => {
    // Check if already completed
    const existing = isAssessmentCompletedByStudent(asmt.id, user?.id || 'demo_student')
    if (existing) {
      setViewingPastSubmission(existing)
      return
    }

    setTakingTest(asmt)
    setCurrentQIndex(0)
    setStudentAnswers({})
    setTestResult(null)
    setViolations([])
    setViolationCount(0)
    setIsDisqualified(false)

    // Launch Proctoring
    await startProctoringSession()
  }

  // Handle Student Submit Test
  const handleSubmitTest = () => {
    if (!takingTest) return
    setSubmittingTest(true)

    const submission = submitStudentAssessment(
      takingTest,
      user?.id || 'demo_student',
      user?.display_name || 'Student',
      studentEnrolledCourse,
      studentAnswers,
      { cheated: false, violations, count: violationCount }
    )

    setTestResult(submission)
    setSubmittingTest(false)
    stopProctoringSession()
    refreshData()
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this scheduled assessment?')) {
      deleteScheduledAssessment(id)
      refreshData()
    }
  }

  const currentQuestions = takingTest?.question_sets[0]?.questions || []
  const activeQ = currentQuestions[currentQIndex]

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-[#FFF5EE] via-[#FFF0E6] to-[#F5EEFF] p-8 rounded-3xl border border-black/[0.06] shadow-xs relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] text-xs font-bold uppercase tracking-wider shadow-xs">
            <Shield className="w-3.5 h-3.5 text-[#FF7A18]" />
            {isTeacher ? 'Teacher Examination & Security Studio' : `Secure Examination Portal • Enrolled in ${studentEnrolledCourse}`}
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#111827] tracking-tight flex items-center gap-3">
            {isTeacher ? 'Assessment Scheduling & AI Proctoring' : 'My Scheduled Tests & Security Hub'}
          </h1>
          <p className="text-[#64748B] text-xs sm:text-sm max-w-2xl font-normal leading-relaxed">
            {isTeacher
              ? 'Schedule high-precision tests for your institute courses with syllabus-grounded AI generation, code evaluation, and anti-cheat telemetry.'
              : `Access your scheduled examinations for ${studentEnrolledCourse}. One attempt per assessment with active camera and screen security.`}
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {isTeacher && (
            <button
              onClick={() => {
                setShowCreateModal(true)
                setCreateStep('details')
                setQuestionItems([])
                setDocumentContent('')
              }}
              className="px-5 py-3 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-sm flex items-center gap-2 shadow-md shadow-[#FF7A18]/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Schedule New Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {isTeacher && (
        <div className="flex items-center gap-2 border-b border-black/[0.06] pb-2">
          <button
            onClick={() => setActiveTab('assessments')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'assessments'
                ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4]'
                : 'text-[#64748B] hover:text-[#111827]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Scheduled Assessments ({assessmentsList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4]'
                : 'text-[#64748B] hover:text-[#111827]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Submissions & Security Audit ({submissionsList.length})</span>
          </button>
        </div>
      )}

      {/* ── Assessments Grid ─────────────────────────────────────────────────── */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-[#FF7A18]" />
              {isTeacher ? 'Active & Scheduled Tests Across Classes' : `Examinations for ${studentEnrolledCourse}`}
            </h3>
            <span className="text-xs text-[#64748B] font-mono">Total: {assessmentsList.length} Tests</span>
          </div>

          {assessmentsList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-black/[0.06] space-y-3 shadow-xs">
              <BookOpen className="w-12 h-12 text-[#94A3B8] mx-auto" />
              <h4 className="text-[#111827] font-bold">No Scheduled Assessments Found</h4>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                {isTeacher
                  ? 'Click "Schedule New Test" to create an AI-powered or custom test for your students.'
                  : `There are currently no scheduled tests for ${studentEnrolledCourse}. Check back shortly!`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assessmentsList.map((asmt) => {
                const totalQs = asmt.question_sets[0]?.questions.length || 0
                const pastSub = !isTeacher ? isAssessmentCompletedByStudent(asmt.id, user?.id || 'demo_student') : null
                const isCompleted = !!pastSub

                return (
                  <div
                    key={asmt.id}
                    className="p-6 rounded-3xl bg-white border border-black/[0.06] hover:border-[#FF7A18]/40 transition-all flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md relative overflow-hidden group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4]">
                          {asmt.target_grade} &bull; {asmt.subject}
                        </span>
                        {isCompleted ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
                            <FileCheck className="w-3 h-3" />
                            Completed ({pastSub?.score_percent}%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 uppercase flex items-center gap-1">
                            <Shield className="w-3 h-3 text-amber-500" />
                            Proctored
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-[#111827] group-hover:text-[#FF7A18] transition-colors">
                          {asmt.title}
                        </h4>
                        <p className="text-xs text-[#64748B] mt-1 line-clamp-2">{asmt.description}</p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] space-y-1.5 text-xs text-[#334155]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#64748B]">Topic:</span>
                          <span className="font-semibold text-[#111827]">{asmt.topic_syllabus}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#64748B]">Duration:</span>
                          <span className="font-mono font-bold text-[#FF7A18]">{asmt.duration_minutes} Mins</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#64748B]">Passing Score:</span>
                          <span className="font-mono font-bold text-emerald-600">{asmt.passing_score}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#64748B]">Questions:</span>
                          <span className="font-mono text-[#334155]">{totalQs} Items ({asmt.total_points} Pts)</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-black/[0.04] flex items-center justify-between gap-2">
                      {isTeacher ? (
                        <>
                          <div className="text-[11px] text-[#64748B]">
                            Submissions: <strong className="text-[#111827] font-mono">{asmt.submissions_count}</strong>
                          </div>
                          <button
                            onClick={() => handleDelete(asmt.id)}
                            className="p-2 rounded-xl text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : isCompleted ? (
                        <button
                          onClick={() => setViewingPastSubmission(pastSub)}
                          className="w-full py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Completed Submission ({pastSub?.score_percent}%)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartTest(asmt)}
                          className="w-full py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#FF7A18]/25 hover:scale-[1.02] cursor-pointer"
                        >
                          <Shield className="w-4 h-4" />
                          <span>Start Proctored Exam &rarr;</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Submissions & Anti-Cheat Audit Tab (For Teachers) ───────────────── */}
      {isTeacher && activeTab === 'submissions' && (
        <div className="bg-white border border-black/[0.06] rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF7A18]" />
                Live Student Test Submissions & Anti-Cheat Audit Telemetry
              </h3>
              <p className="text-xs text-[#64748B]">
                Live inspection of student submissions, cognitive state adjustments, and automated proctoring violation alerts.
              </p>
            </div>
          </div>

          {submissionsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B]">No submissions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-black/[0.06]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-black/[0.06] text-[#64748B] font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">Student & Grade</th>
                    <th className="p-3.5">Assessment Title</th>
                    <th className="p-3.5 text-center">Score</th>
                    <th className="p-3.5 text-center">Security Status</th>
                    <th className="p-3.5 text-center">Violations</th>
                    <th className="p-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {submissionsList.map((sub) => (
                    <tr key={sub.submission_id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-[#111827]">{sub.student_name}</div>
                        <div className="text-[10px] text-[#FF7A18] font-mono">{sub.student_grade}</div>
                      </td>
                      <td className="p-3.5 text-[#334155] font-medium">{sub.assessment_title}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-sm">
                        {sub.cheated ? (
                          <span className="text-rose-600 font-black">0% (DQ)</span>
                        ) : (
                          <span className="text-emerald-600">{sub.score_percent}%</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {sub.cheated ? (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[10px] flex items-center gap-1 justify-center">
                            <AlertTriangle className="w-3 h-3" />
                            FLAGGED CHEATING
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            PASSED SECURE
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {sub.cheated ? (
                          <div className="text-[10px] text-rose-700 max-w-xs truncate mx-auto" title={sub.cheating_reasons?.join('; ')}>
                            {sub.violation_count} Strikes: {sub.cheating_reasons?.[0] || 'Tab switch'}
                          </div>
                        ) : (
                          <span className="text-[#94A3B8] text-[10px]">0 Infractions</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right text-[#64748B] text-[10px] font-mono">
                        {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Teacher Create Assessment Modal ──────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] flex items-center justify-center text-[#FF7A18] font-bold">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#111827] text-base">Schedule New Class Assessment</h3>
                  <p className="text-xs text-[#64748B]">Configure target grade, subject, timing window, and question sets</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-xl p-1 cursor-pointer font-bold"
              >
                &times;
              </button>
            </div>

            {createStep === 'details' ? (
              <div className="space-y-4">
                {/* Course & Subject Selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#334155]">Select Course:</label>
                    <select
                      value={selectedCourseSlug || activeCourse?.slug || ''}
                      onChange={(e) => {
                        const slug = e.target.value
                        setSelectedCourseSlug(slug)
                        const crs = availableCourses.find(c => c.slug === slug || c.id === slug)
                        if (crs) {
                          setTargetGrade(crs.title)
                          const allowedSubs = user?.role === 'teacher'
                            ? crs.subjects.filter(s =>
                                s.teacher_id === user.id ||
                                (s.teacher_name && user.display_name && s.teacher_name.toLowerCase() === user.display_name.toLowerCase())
                              )
                            : crs.subjects
                          if (allowedSubs.length > 0) {
                            setSubject(allowedSubs[0].name)
                          }
                        }
                      }}
                      className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                    >
                      {availableCourses.map((c) => (
                        <option key={c.id} value={c.slug}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#334155]">Technical Module / Subject:</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                    >
                      {activeCourseSubjects.length === 0 ? (
                        <option value="">No subjects assigned</option>
                      ) : (
                        activeCourseSubjects.map((s) => (
                          <option key={s.id || s.code} value={s.name}>
                            {s.code}: {s.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Topic Syllabus */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#334155]">Topic / Syllabus Focus:</label>
                  <input
                    type="text"
                    value={topicSyllabus}
                    onChange={(e) => setTopicSyllabus(e.target.value)}
                    placeholder="e.g. Quadratic Equations, Photosynthesis, Fractions..."
                    className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                  />
                </div>

                {/* Title & Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#334155]">Assessment Title:</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`e.g. ${targetGrade} ${subject}: Diagnostic Benchmark`}
                    className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-2xl p-3 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                  />
                </div>

                {/* Timing Window & Scheduling Options */}
                <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] space-y-3">
                  <div className="text-xs font-bold text-[#FF7A18] uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Scheduling & Timing Options
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'ALWAYS_AVAILABLE', label: 'Always Available' },
                      { id: 'TIME_WINDOW', label: 'Time Window (e.g. 4-5 PM)' },
                      { id: 'EXACT_TIME', label: 'Exact Fixed Time' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setScheduleType(opt.id as any)}
                        className={`p-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                          scheduleType === opt.id
                            ? 'bg-[#FFF3EA] border-[#FFDEC4] text-[#FF7A18] font-bold'
                            : 'bg-white border-black/[0.08] text-[#64748B] hover:text-[#111827]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {scheduleType !== 'ALWAYS_AVAILABLE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] font-bold text-[#334155]">Start Time:</label>
                        <input
                          type="datetime-local"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#111827] mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#334155]">End Time / Deadline:</label>
                        <input
                          type="datetime-local"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#111827] mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-[#334155]">Duration (Minutes):</label>
                      <input
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#111827] mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#334155]">Passing Score (%):</label>
                      <input
                        type="number"
                        value={passingScore}
                        onChange={(e) => setPassingScore(Number(e.target.value))}
                        className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#111827] mt-1"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!title) {
                      setTitle(`${targetGrade} ${subject}: ${topicSyllabus || 'Examination Paper'}`)
                    }
                    setCreateStep('questions')
                  }}
                  className="w-full py-3 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#FF7A18]/25 cursor-pointer"
                >
                  <span>Proceed to Question Paper Design</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Question Creation Modes Selector */}
                <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                  <div className="flex gap-2">
                    {[
                      { id: 'AI', label: 'AI Auto-Generate (Groq LPU)', icon: Sparkles },
                      { id: 'PDF', label: 'Drop PDF / Document Parser', icon: Upload },
                      { id: 'MANUAL', label: 'Manual Question Builder', icon: Plus },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setCreationMode(mode.id as any)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          creationMode === mode.id
                            ? 'bg-[#FF7A18] text-white shadow-xs'
                            : 'bg-[#FAF9F6] border border-black/[0.08] text-[#64748B] hover:text-[#111827]'
                        }`}
                      >
                        <mode.icon className="w-3.5 h-3.5" />
                        <span>{mode.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCreateStep('details')}
                    className="text-xs text-[#64748B] hover:text-[#111827] font-semibold cursor-pointer"
                  >
                    &larr; Back to Details
                  </button>
                </div>

                {/* AI Generate View */}
                {creationMode === 'AI' && (
                  <div className="p-6 rounded-3xl bg-[#FAF9F6] border border-black/[0.06] text-center space-y-4">
                    <Sparkles className="w-8 h-8 text-[#FF7A18] mx-auto" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-[#111827] text-sm">
                        Synthesize Deeply Calibrated Examination Items for {targetGrade} {subject}
                      </h4>
                      <p className="text-xs text-[#64748B] max-w-md mx-auto">
                        Groq Cloud LPU will generate high-precision mathematical derivations, scientific mechanisms, and misconception distractors for "{topicSyllabus}".
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isGeneratingAI}
                      onClick={handleAIGenerate}
                      className="px-6 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs flex items-center justify-center gap-2 mx-auto disabled:opacity-50 transition-all shadow-md shadow-[#FF7A18]/25 cursor-pointer"
                    >
                      {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>{isGeneratingAI ? 'Synthesizing Rigorous Items...' : 'Generate 5 Examination Questions with AI'}</span>
                    </button>
                  </div>
                )}

                {/* PDF Drop View with Content Parsing */}
                {creationMode === 'PDF' && (
                  <div className="space-y-3">
                    <div className="p-6 rounded-3xl bg-[#FAF9F6] border-2 border-dashed border-black/[0.12] hover:border-[#FF7A18]/50 text-center space-y-3 transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-[#94A3B8] mx-auto" />
                      <div className="space-y-1">
                        <h4 className="font-bold text-[#111827] text-sm">Upload & Parse Syllabus Notes or Question Bank</h4>
                        <p className="text-xs text-[#64748B]">
                          {pdfFileName ? `Parsed File: ${pdfFileName}` : 'Select a PDF, DOCX, or text file to extract exam questions with AI'}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setPdfFileName(file.name)
                            const reader = new FileReader()
                            reader.onload = (ev) => {
                              const text = ev.target?.result as string || ''
                              setDocumentContent(text)
                            }
                            reader.readAsText(file)
                          }
                        }}
                        className="text-xs text-[#64748B] file:mr-4 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FF7A18] file:text-white hover:file:bg-[#EA6C0A] cursor-pointer"
                      />
                    </div>

                    {pdfFileName && (
                      <button
                        type="button"
                        disabled={isGeneratingAI}
                        onClick={handleAIGenerate}
                        className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                      >
                        {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        <span>Extract & Generate Questions from {pdfFileName}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Manual Builder View */}
                {creationMode === 'MANUAL' && (
                  <div className="p-5 rounded-3xl bg-[#FAF9F6] border border-black/[0.06] space-y-3">
                    <div className="text-xs font-bold text-[#111827]">Add Individual Question</div>
                    <input
                      type="text"
                      value={manQText}
                      onChange={(e) => setManQText(e.target.value)}
                      placeholder="Enter question text (e.g. Solve 2x² - 7x + 3 = 0)..."
                      className="w-full bg-white border border-black/[0.08] rounded-2xl px-3 py-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                    />

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-[#64748B]">Question Type:</label>
                        <select
                          value={manQType}
                          onChange={(e) => setManQType(e.target.value as any)}
                          className="w-full bg-white border border-black/[0.08] rounded-xl px-2.5 py-2 text-xs text-[#111827] mt-1"
                        >
                          <option value="multiple_choice">Multiple Choice (MCQ)</option>
                          <option value="descriptive">Descriptive / Problem Solving</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#64748B]">Cognitive Level:</label>
                        <select
                          value={manLevel}
                          onChange={(e) => setManLevel(e.target.value as any)}
                          className="w-full bg-white border border-black/[0.08] rounded-xl px-2.5 py-2 text-xs text-[#111827] mt-1"
                        >
                          <option value="FOUNDATION">FOUNDATION</option>
                          <option value="APPLICATION">APPLICATION</option>
                          <option value="REASONING">REASONING</option>
                          <option value="TRANSFER">TRANSFER</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#64748B]">Points:</label>
                        <input
                          type="number"
                          value={manPoints}
                          onChange={(e) => setManPoints(Number(e.target.value))}
                          className="w-full bg-white border border-black/[0.08] rounded-xl px-2.5 py-2 text-xs text-[#111827] mt-1"
                        />
                      </div>
                    </div>

                    {manQType === 'multiple_choice' && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] text-[#64748B] font-bold">Options (Select correct radio):</label>
                        {manOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="correct_radio"
                              checked={manCorrect === idx}
                              onChange={() => setManCorrect(idx)}
                              className="accent-[#FF7A18]"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const next = [...manOptions]
                                next[idx] = e.target.value
                                setManOptions(next)
                              }}
                              placeholder={`Option ${idx + 1}...`}
                              className="flex-1 bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#111827]"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddManualQuestion}
                      className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-[#111827] font-bold text-xs cursor-pointer"
                    >
                      + Add to Question Paper
                    </button>
                  </div>
                )}

                {/* Display Current Question Paper */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#64748B] font-bold">
                    <span>Configured Questions ({questionItems.length}):</span>
                    <span>Total Points: {questionItems.reduce((a, b) => a + b.points, 0)} Pts</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {questionItems.map((q, idx) => (
                      <div key={q.id} className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-[#111827]">
                            {idx + 1}. {q.question_text}
                          </div>
                          <div className="text-[10px] text-[#64748B] mt-1 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-white border border-black/[0.06] text-[#FF7A18] font-bold">{q.question_type}</span>
                            <span className="px-2 py-0.5 rounded-md bg-white border border-black/[0.06] text-[#FF7A18] font-bold">{q.cognitive_level}</span>
                            <span>{q.points} Pts</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setQuestionItems(questionItems.filter((item) => item.id !== q.id))}
                          className="text-[#94A3B8] hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-[#64748B] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishAssessment}
                    className="px-6 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-[#FF7A18]/25 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Publish Assessment to {targetGrade}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── View Completed Submission Modal ──────────────────────────────────── */}
      {viewingPastSubmission && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center font-bold">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold text-[#111827]">{viewingPastSubmission.assessment_title}</h4>
              <p className="text-xs text-[#64748B]">
                Submitted on {new Date(viewingPastSubmission.submitted_at).toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] space-y-2">
              <div className="text-3xl font-black text-emerald-600 font-mono">
                {viewingPastSubmission.score_percent}%
              </div>
              <div className="text-xs text-[#334155]">
                Earned {viewingPastSubmission.total_points_earned} of {viewingPastSubmission.max_points} Points
              </div>
              <p className="text-xs text-[#64748B] pt-2 border-t border-black/[0.04]">
                {viewingPastSubmission.feedback}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-100 text-xs text-[#64748B]">
              <strong>Single-Attempt Policy:</strong> Assessment completed. Results have been recorded in the LMS database.
            </div>

            <button
              onClick={() => setViewingPastSubmission(null)}
              className="w-full py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs cursor-pointer"
            >
              Close Summary
            </button>
          </div>
        </div>
      )}

      {/* ── Student Taking Proctored Test Modal with Live HUD ────────────────── */}
      {takingTest && (
        <div className="fixed inset-0 z-50 bg-[#FAF9F6] flex flex-col justify-between p-6 animate-in fade-in select-none">
          {/* Top Proctoring Security Bar */}
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 bg-white p-4 rounded-3xl shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] flex items-center justify-center text-[#FF7A18] font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#111827] text-base">{takingTest.title}</h3>
                <p className="text-xs text-[#64748B]">
                  Question {currentQIndex + 1} of {currentQuestions.length} &bull; Security Level: SECURE PROCTORED
                </p>
              </div>
            </div>

            {/* Live Camera Feed & Status HUD */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF9F6] border border-black/[0.06] text-xs text-[#334155]">
                <Camera className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                <span>Cam Active</span>
                <span className="text-neutral-300">|</span>
                <Mic className="w-3.5 h-3.5 text-[#FF7A18]" />
                <span>Mic: {micVolumeLevel}%</span>
              </div>

              {/* Live Picture-in-Picture Video */}
              <div className="w-24 h-16 rounded-xl bg-neutral-900 border border-[#FF7A18]/40 overflow-hidden relative shadow-md">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 left-1 px-1 rounded bg-rose-500 text-[8px] font-bold text-white uppercase tracking-wider">
                  REC
                </div>
              </div>

              <div className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                violationCount > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <Shield className="w-3.5 h-3.5" />
                <span>Strikes: {violationCount}/3</span>
              </div>
            </div>
          </div>

          {/* Center Question View */}
          <div className="max-w-3xl w-full mx-auto my-auto space-y-6">
            {testResult ? (
              <div className="p-8 rounded-3xl bg-white border border-black/[0.08] shadow-2xl text-center space-y-5">
                <div
                  className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center font-bold ${
                    testResult.cheated
                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                      : testResult.passed
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {testResult.cheated ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
                </div>

                <div className="space-y-1">
                  <h4 className="text-2xl font-bold text-[#111827]">
                    {testResult.cheated ? 'DISQUALIFIED / FLAGGED FOR CHEATING' : 'Examination Submitted Successfully!'}
                  </h4>
                  <p className="text-sm text-[#334155]">
                    Final Score: <strong className="text-emerald-600 text-xl">{testResult.score_percent}%</strong> (
                    {testResult.total_points_earned}/{testResult.max_points} Points)
                  </p>
                  <p className="text-xs text-[#64748B] max-w-lg mx-auto pt-2">{testResult.feedback}</p>
                </div>

                {testResult.cheated && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 text-left">
                    <strong>Recorded Infractions:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      {testResult.cheating_reasons?.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => {
                    setTakingTest(null)
                    stopProctoringSession()
                  }}
                  className="px-8 py-3 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs shadow-md shadow-[#FF7A18]/25 transition-all cursor-pointer"
                >
                  Return to Examination Hub
                </button>
              </div>
            ) : activeQ ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between text-xs text-[#64748B]">
                  <span className="px-3 py-1 rounded-xl bg-white text-[#FF7A18] font-bold border border-black/[0.06] shadow-2xs">
                    Concept: {activeQ.concept_name}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-white text-[#FF7A18] font-bold border border-black/[0.06] shadow-2xs">
                    {activeQ.cognitive_level} &bull; {activeQ.points} Points
                  </span>
                </div>

                <div className="p-6 rounded-3xl bg-white border border-black/[0.06] shadow-xs">
                  <p className="text-base font-semibold text-[#111827] leading-relaxed">{activeQ.question_text}</p>
                </div>

                {activeQ.question_type === 'multiple_choice' && activeQ.options ? (
                  <div className="space-y-3">
                    {activeQ.options.map((opt, optIdx) => {
                      const isSelected = studentAnswers[activeQ.id] === optIdx
                      return (
                        <button
                          key={optIdx}
                          onClick={() => setStudentAnswers((prev) => ({ ...prev, [activeQ.id]: optIdx }))}
                          className={`w-full p-4 rounded-2xl border text-left text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#FFF3EA] border-[#FF7A18] text-[#FF7A18] shadow-xs font-bold'
                              : 'bg-white border-black/[0.08] text-[#334155] hover:border-[#FF7A18]/50'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-4 h-4 text-[#FF7A18]" />}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#334155]">Your Analytical Derivation:</label>
                    <textarea
                      rows={5}
                      value={(studentAnswers[activeQ.id] as string) || ''}
                      onChange={(e) => setStudentAnswers((prev) => ({ ...prev, [activeQ.id]: e.target.value }))}
                      placeholder="Type your derivation steps, formulas, and final answer..."
                      className="w-full bg-white border border-black/[0.08] rounded-2xl p-4 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Bottom Navigation */}
          {!testResult && activeQ && (
            <div className="flex items-center justify-between pt-4 border-t border-black/[0.06] max-w-3xl w-full mx-auto">
              <button
                type="button"
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex((prev) => prev - 1)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#111827] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>

              {currentQIndex < currentQuestions.length - 1 ? (
                <button
                  type="button"
                  disabled={studentAnswers[activeQ.id] === undefined}
                  onClick={() => setCurrentQIndex((prev) => prev + 1)}
                  className="px-6 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-[#FF7A18]/25 cursor-pointer disabled:opacity-50"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submittingTest}
                  onClick={handleSubmitTest}
                  className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{submittingTest ? 'Evaluating...' : 'Submit Proctored Exam'}</span>
                </button>
              )}
            </div>
          )}

          {/* Warning Modal / Alert Overlay */}
          {showWarningModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
              <div className="p-6 rounded-3xl bg-white border border-rose-200 max-w-md w-full text-center space-y-4 shadow-2xl">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-[#111827]">Examination Security Infraction</h4>
                <p className="text-xs text-rose-700 leading-relaxed">{showWarningModal}</p>
                <button
                  onClick={() => setShowWarningModal(null)}
                  className="w-full py-2.5 rounded-2xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer"
                >
                  I Understand • Return to Examination
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default AssessmentsPage
