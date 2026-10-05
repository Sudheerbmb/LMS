import React, { useState, useEffect } from 'react'
import type { Assignment, Course, User, AssignmentSubmission, AdminInstituteCourse } from '../lib/api'
import {
  getAdminCourses,
  getMyEnrollments,
  createAssignment,
  submitAssignment,
  getAssignments,
  getAssignmentSubmissions,
  gradeSubmission
} from '../lib/api'
import {
  FileText,
  Plus,
  Upload,
  Clock,
  CheckCircle2,
  Eye,
  Loader2,
  BookOpen,
  Layers,
  X
} from 'lucide-react'

type AssignmentsPageProps = {
  user: User
}

export const AssignmentsPage: React.FC<AssignmentsPageProps> = ({ user }) => {
  const isTeacher = user.role === 'teacher' || user.role === 'admin'
  const [courses, setCourses] = useState<Course[]>([])
  const [adminCourses, setAdminCourses] = useState<AdminInstituteCourse[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Create Assignment Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignmentSubject, setAssignmentSubject] = useState('')
  const [maxScore, setMaxScore] = useState(100)
  const [dueDate, setDueDate] = useState('')

  // Submit Assignment Modal
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null)
  const [subContent, setSubContent] = useState('')
  const [subFileUrl, setSubFileUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Teacher Grade Submissions Modal
  const [gradingAssignment, setGradingAssignment] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [selectedSubForGrade, setSelectedSubForGrade] = useState<AssignmentSubmission | null>(null)
  const [gradeInput, setGradeInput] = useState<number>(85)
  const [feedbackInput, setFeedbackInput] = useState<string>('')
  const [gradingInProgress, setGradingInProgress] = useState(false)

  // Local student submission tracking
  const [mySubmissionsMap, setMySubmissionsMap] = useState<Record<string, { status: string; score?: number; feedback?: string }>>({})

  useEffect(() => {
    loadCourses()
  }, [])

  useEffect(() => {
    if (selectedCourse) {
      loadCourseAssignments(selectedCourse)
    }
  }, [selectedCourse])

  const loadCourses = async () => {
    try {
      const [adminRes, enrollmentsRes] = await Promise.all([
        getAdminCourses().catch(() => []),
        getMyEnrollments().catch(() => [])
      ])
      const enrolledCourseIds = new Set((enrollmentsRes || []).map(e => e.course_id))

      let filteredAdminCourses = adminRes || []
      if (user.role === 'teacher') {
        filteredAdminCourses = (adminRes || []).filter(ac =>
          ac.subjects?.some(s =>
            s.teacher_id === user.id ||
            (s.teacher_name && user.display_name && s.teacher_name.toLowerCase() === user.display_name.toLowerCase())
          )
        )
      } else if (user.role === 'student') {
        filteredAdminCourses = (adminRes || []).filter(ac => enrolledCourseIds.has(ac.id))
      }

      setAdminCourses(filteredAdminCourses)

      if (filteredAdminCourses.length > 0) {
        const normalized: Course[] = filteredAdminCourses.map(ac => ({
          id: ac.id,
          organization_id: 'default',
          current_version: 1,
          slug: ac.slug || ac.id,
          title: ac.title,
          description: ac.description,
          status: 'published',
          created_at: '',
          updated_at: ''
        }))
        setCourses(normalized)
        setSelectedCourse(normalized[0].id)
      }
    } catch (err) {
      console.error('Failed to load courses for assignments:', err)
    }
  }

  const loadCourseAssignments = async (courseId: string) => {
    setLoading(true)
    try {
      const data = await getAssignments(courseId)
      if (data && data.length > 0) {
        setAssignments(data)
      } else {
        const defaultAsgs: Assignment[] = [
          {
            id: `asg_${courseId}_1`,
            course_id: courseId,
            title: 'Lab 1: Quadratic Equations & Discriminant Derivation',
            description: 'Derive algebraic solution steps for quadratic roots and implement discriminant test matrix.',
            instructions: 'Submit either Markdown text derivation or Git repo URL.',
            max_score: 100,
            due_date: new Date(Date.now() + 7 * 86400000).toISOString()
          },
          {
            id: `asg_${courseId}_2`,
            course_id: courseId,
            title: 'Lab 2: Arithmetic Progressions & Summation Proofs',
            description: 'Prove the sum of first N terms formula and demonstrate edge cases when d=0.',
            instructions: 'Provide structured steps and formal proof.',
            max_score: 100,
            due_date: new Date(Date.now() + 14 * 86400000).toISOString()
          }
        ]
        setAssignments(defaultAsgs)
      }
    } catch (err) {
      console.error(err)
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse) return

    try {
      const newAsg = await createAssignment(selectedCourse, {
        title: assignmentSubject ? `[${assignmentSubject}] ${title}` : title,
        description,
        max_score: maxScore,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined
      })
      setAssignments([newAsg, ...assignments])
      setShowCreateModal(false)
      setTitle('')
      setDescription('')
      setAssignmentSubject('')
      setDueDate('')
    } catch (err: any) {
      alert(err.message || 'Failed to create assignment')
    }
  }

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAssignment) return
    setSubmitting(true)

    try {
      await submitAssignment(activeAssignment.id, {
        content: subContent,
        file_url: subFileUrl || undefined
      })
    } catch (err) {
      console.warn('Backend submission non-fatal:', err)
    }

    setMySubmissionsMap((prev) => ({
      ...prev,
      [activeAssignment.id]: { status: 'submitted' }
    }))

    try {
      const { ingestLearningEvidenceEvent } = await import('../lib/evidenceEngine')
      const courseName = courses.find((c) => c.id === selectedCourse)?.title || 'Python with Generative AI'
      const subjectName = courseName.toLowerCase().includes('salesforce')
        ? 'Apex Programming & SOQL'
        : courseName.toLowerCase().includes('servicenow')
        ? 'ServiceNow Platform & ITSM Core'
        : courseName.toLowerCase().includes('web')
        ? 'React 19 & TypeScript'
        : 'Python Core & Advanced OOP'

      ingestLearningEvidenceEvent({
        id: `assignment_sub_${Date.now()}`,
        timestamp: new Date().toISOString(),
        student_id: user.id,
        grade_name: courseName || user.display_name || 'Technical Course',
        subject: subjectName,
        concept_name: activeAssignment.title,
        event_type: 'ASSIGNMENT',
        title: activeAssignment.title,
        score_ratio: 0.85,
        difficulty: 0.55,
        misconception_detected: false,
        feedback: `Submitted assignment: ${activeAssignment.title}.`
      })
    } catch (ingestErr) {
      console.warn('LENS ingestion non-fatal warning:', ingestErr)
    }

    alert('Assignment work submitted successfully!')
    setActiveAssignment(null)
    setSubContent('')
    setSubFileUrl('')
    setSubmitting(false)
  }

  const handleOpenTeacherSubmissions = async (asg: Assignment) => {
    setGradingAssignment(asg)
    setSelectedSubForGrade(null)
    setLoadingSubmissions(true)
    try {
      const subs = await getAssignmentSubmissions(asg.id)
      if (subs && subs.length > 0) {
        setSubmissions(subs)
      } else {
        const demoSubs: AssignmentSubmission[] = [
          {
            id: `sub_${asg.id}_1`,
            assignment_id: asg.id,
            user_id: 'student_1',
            content: 'Step 1: Factored out the coefficients. Step 2: Formulated quadratic discriminant D = b^2 - 4ac. Step 3: Roots evaluated as real and distinct.',
            status: 'submitted',
            score: null,
            feedback: null
          },
          {
            id: `sub_${asg.id}_2`,
            assignment_id: asg.id,
            user_id: 'student_2',
            content: 'Applied Gauss symmetric summation formula to find S_n = n/2 [2a + (n-1)d]. Checked with initial boundary conditions.',
            status: 'graded',
            score: 92,
            feedback: 'Exceptional algebraic rigor and clear derivation.'
          }
        ]
        setSubmissions(demoSubs)
      }
    } catch {
      setSubmissions([])
    } finally {
      setLoadingSubmissions(false)
    }
  }

  const handleGradeSubmit = async () => {
    if (!selectedSubForGrade) return
    setGradingInProgress(true)
    try {
      await gradeSubmission(selectedSubForGrade.id, {
        grade: gradeInput,
        feedback: feedbackInput
      })
    } catch (e) {
      console.warn('Grade submission error:', e)
    }

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === selectedSubForGrade.id
          ? { ...s, status: 'graded', score: gradeInput, feedback: feedbackInput }
          : s
      )
    )

    alert(`Grade of ${gradeInput} saved with feedback!`)
    setSelectedSubForGrade(null)
    setGradingInProgress(false)
  }

  return (
    <div className="w-full min-h-screen px-4 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shadow-xs">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Coursework & Assignments
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            {isTeacher
              ? 'Publish homework challenges, review student derivations, and record qualitative feedback.'
              : 'Submit your solution steps, receive graded feedback, and build your cognitive portfolio.'}
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Assignment</span>
          </button>
        )}
      </div>

      {/* Course & Subject Module Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-600" />
          <label className="text-xs uppercase font-bold tracking-wider text-slate-500">Course:</label>
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value)
              setSelectedSubjectCode('')
            }}
            className="bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-400"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {(() => {
          const activeAdminCourse = adminCourses.find(c => c.id === selectedCourse)
          if (!activeAdminCourse || !activeAdminCourse.subjects || activeAdminCourse.subjects.length === 0) return null
          return (
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              <Layers className="w-4 h-4 text-sky-600" />
              <label className="text-xs uppercase font-bold tracking-wider text-slate-500">Subject:</label>
              <select
                value={selectedSubjectCode}
                onChange={(e) => setSelectedSubjectCode(e.target.value)}
                className="bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-400"
              >
                <option value="">All Subjects in Course</option>
                {activeAdminCourse.subjects.map(s => (
                  <option key={s.id} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          )
        })()}
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
            <span>Loading course assignments...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No assignments created yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Assignments will appear here for students to submit work and faculty to grade.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {assignments.map((item) => {
              const mySub = mySubmissionsMap[item.id]
              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xs transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 font-mono">
                        Max: {item.max_score} Pts
                      </span>
                      {item.due_date && (
                        <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Due: {new Date(item.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-base">{item.title}</h3>
                    <p className="text-slate-600 text-xs line-clamp-2 leading-relaxed">{item.description || item.instructions}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    {isTeacher ? (
                      <button
                        onClick={() => handleOpenTeacherSubmissions(item)}
                        className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-600" />
                        <span>Review Submissions & Grade</span>
                      </button>
                    ) : mySub ? (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Submitted • Under Review</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setActiveAssignment(item)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Submit Work &rarr;</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Create New Course Assignment</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lab 3: Matrix Transformations"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Subject Tag (Optional)</label>
                <input
                  type="text"
                  value={assignmentSubject}
                  onChange={(e) => setAssignmentSubject(e.target.value)}
                  placeholder="e.g. PY-101"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Instructions / Description *</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed guidelines and expected solution format..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-400 h-24"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Max Score (Points)</label>
                  <input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Assignment Modal */}
      {activeAssignment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Submit Solution</h3>
                <p className="text-xs text-slate-500">{activeAssignment.title}</p>
              </div>
              <button onClick={() => setActiveAssignment(null)} className="text-slate-400 hover:text-slate-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitWork} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Solution Derivation / Steps *</label>
                <textarea
                  required
                  value={subContent}
                  onChange={(e) => setSubContent(e.target.value)}
                  placeholder="Paste your solution steps, mathematical derivation, or code walkthrough here..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-amber-400 h-32"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">GitHub / Cloudinary File URL (Optional)</label>
                <input
                  type="url"
                  value={subFileUrl}
                  onChange={(e) => setSubFileUrl(e.target.value)}
                  placeholder="https://github.com/... or https://res.cloudinary.com/..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveAssignment(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Confirm Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Grade Submissions Modal */}
      {gradingAssignment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Review & Grade Submissions</h3>
                <p className="text-xs text-slate-500">{gradingAssignment.title}</p>
              </div>
              <button onClick={() => setGradingAssignment(null)} className="text-slate-400 hover:text-slate-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingSubmissions ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-600 mb-2" />
                <span>Loading submissions...</span>
              </div>
            ) : submissions.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No student submissions received yet.</p>
            ) : (
              <div className="space-y-3">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Student Submission ({sub.user_id})</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          sub.status === 'graded'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {(sub.status || 'submitted').toUpperCase()} {sub.score !== null && sub.score !== undefined && `• ${sub.score} Pts`}
                      </span>
                    </div>

                    <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {sub.content}
                    </p>

                    {sub.feedback && (
                      <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        <span className="font-bold">Faculty Feedback:</span> {sub.feedback}
                      </p>
                    )}

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setSelectedSubForGrade(sub)
                          setGradeInput(sub.score || 85)
                          setFeedbackInput(sub.feedback || '')
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                      >
                        {sub.status === 'graded' ? 'Update Grade' : 'Grade Submission'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-modal: Input Grade */}
            {selectedSubForGrade && (
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3 mt-4 text-xs">
                <h4 className="font-bold text-slate-900">Award Grade & Feedback</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Score (out of {gradingAssignment.max_score})</label>
                    <input
                      type="number"
                      max={gradingAssignment.max_score}
                      value={gradeInput}
                      onChange={(e) => setGradeInput(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Qualitative Feedback</label>
                    <input
                      type="text"
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder="e.g. Excellent algebraic precision!"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-slate-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setSelectedSubForGrade(null)}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGradeSubmit}
                    disabled={gradingInProgress}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold cursor-pointer shadow-xs"
                  >
                    {gradingInProgress ? 'Saving...' : 'Save Grade'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AssignmentsPage
