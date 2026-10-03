import React, { useState, useEffect } from 'react'
import type {
  AdminInstituteUser,
  AdminInstituteCourse,
  User,
  ZoomIntegrationStatus,
} from '../lib/api'
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getAdminCourses,
  createAdminCourse,
  addAdminCourseSubject,
  deleteAdminCourseSubject,
  enrollStudentInCourse,
  unenrollStudentFromCourse,
  getZoomStatus,
  seedTechCourses,
} from '../lib/api'
import {
  Users,
  UserPlus,
  BookOpen,
  GraduationCap,
  Plus,
  Trash2,
  Edit3,
  Search,
  CheckCircle2,
  Video,
  Mail,
  Phone,
  Layers,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'

type AdminPageProps = {
  user: User
}

export const AdminPage: React.FC<AdminPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'courses' | 'zoom'>('students')
  const [users, setUsers] = useState<AdminInstituteUser[]>([])
  const [courses, setCourses] = useState<AdminInstituteCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [zoomStatus, setZoomStatus] = useState<ZoomIntegrationStatus | null>(null)
  const [loadingZoom, setLoadingZoom] = useState(false)

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('ALL')

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [userModalRole, setUserModalRole] = useState<'student' | 'teacher'>('student')
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminInstituteUser | null>(null)

  const [showAddCourseModal, setShowAddCourseModal] = useState(false)
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false)
  const [targetCourseForSubject, setTargetCourseForSubject] = useState<AdminInstituteCourse | null>(null)

  // Form States for Add/Edit User
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formSelectedCourses, setFormSelectedCourses] = useState<string[]>([])
  const [submittingUser, setSubmittingUser] = useState(false)
  const [formError, setFormError] = useState('')

  // Form States for Add Course
  const [courseTitle, setCourseTitle] = useState('')
  const [courseSlug, setCourseSlug] = useState('')
  const [courseDesc, setCourseDesc] = useState('')
  const [courseLevel, setCourseLevel] = useState('beginner')
  const [coursePrice, setCoursePrice] = useState(0)
  const [courseSubjects, setCourseSubjects] = useState<
    Array<{ code: string; name: string; description: string; teacher_id: string; color: string }>
  >([
    { code: 'MOD-101', name: 'Core Foundations', description: 'Fundamentals & setup', teacher_id: '', color: '#3b82f6' },
  ])
  const [submittingCourse, setSubmittingCourse] = useState(false)

  // Form States for Add Subject to Existing Course
  const [subCode, setSubCode] = useState('')
  const [subName, setSubName] = useState('')
  const [subDesc, setSubDesc] = useState('')
  const [subTeacherId, setSubTeacherId] = useState('')
  const [subColor, setSubColor] = useState('#3b82f6')
  const [submittingSubject, setSubmittingSubject] = useState(false)

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      const [uList, cList] = await Promise.all([
        getAdminUsers().catch(() => []),
        getAdminCourses().catch(() => []),
      ])
      setUsers(uList || [])
      setCourses(cList || [])
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadZoomData = async () => {
    try {
      setLoadingZoom(true)
      const status = await getZoomStatus()
      setZoomStatus(status)
    } catch (err) {
      console.error('Failed to load Zoom status:', err)
    } finally {
      setLoadingZoom(false)
    }
  }

  // ── Handlers: User Management ──────────────────────────────────────────────
  const openAddUser = (role: 'student' | 'teacher') => {
    setUserModalRole(role)
    setFormName('')
    setFormEmail('')
    setFormPhone('')
    setFormPassword(role === 'student' ? 'Student123!' : 'Teacher123!')
    setFormSelectedCourses([])
    setFormError('')
    setShowAddUserModal(true)
  }

  const openEditUser = (u: AdminInstituteUser) => {
    setEditingUser(u)
    setFormName(u.display_name)
    setFormEmail(u.email)
    setFormPhone(u.phone_number || '')
    setFormPassword('')
    setFormSelectedCourses(u.enrolled_courses?.map((c) => c.id) || [])
    setFormError('')
    setShowEditUserModal(true)
  }

  const handleSaveNewUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSubmittingUser(true)
    try {
      await createAdminUser({
        email: formEmail.trim().toLowerCase(),
        display_name: formName.trim(),
        phone_number: formPhone.trim() || undefined,
        password: formPassword,
        role: userModalRole,
        course_ids: userModalRole === 'student' ? formSelectedCourses : [],
      })
      setShowAddUserModal(false)
      await loadAllData()
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user.')
    } finally {
      setSubmittingUser(false)
    }
  }

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setFormError('')
    setSubmittingUser(true)
    try {
      await updateAdminUser(editingUser.id, {
        display_name: formName.trim(),
        phone_number: formPhone.trim() || undefined,
        password: formPassword.trim() ? formPassword.trim() : undefined,
        course_ids: editingUser.role === 'student' ? formSelectedCourses : undefined,
      })
      setShowEditUserModal(false)
      setEditingUser(null)
      await loadAllData()
    } catch (err: any) {
      setFormError(err.message || 'Failed to update user.')
    } finally {
      setSubmittingUser(false)
    }
  }

  const handleDeleteUser = async (u: AdminInstituteUser) => {
    if (!window.confirm(`Are you sure you want to remove ${u.display_name} (${u.email})?`)) return
    try {
      await deleteAdminUser(u.id)
      setUsers((prev) => prev.filter((item) => item.id !== u.id))
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`)
    }
  }

  const handleQuickUnenroll = async (userId: string, courseId: string) => {
    try {
      await unenrollStudentFromCourse(userId, courseId)
      await loadAllData()
    } catch (err: any) {
      alert(`Error un-enrolling: ${err.message}`)
    }
  }

  const handleQuickEnroll = async (userId: string, courseId: string) => {
    try {
      await enrollStudentInCourse(userId, courseId)
      await loadAllData()
    } catch (err: any) {
      alert(`Error enrolling: ${err.message}`)
    }
  }

  // ── Handlers: Course & Subject Management ──────────────────────────────────
  const handleAddSubjectRow = () => {
    setCourseSubjects((prev) => [
      ...prev,
      { code: `MOD-${(prev.length + 1) * 100 + 1}`, name: '', description: '', teacher_id: '', color: '#10b981' },
    ])
  }

  const handleRemoveSubjectRow = (index: number) => {
    setCourseSubjects((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingCourse(true)
    try {
      await createAdminCourse({
        title: courseTitle.trim(),
        slug: courseSlug.trim() || undefined,
        description: courseDesc.trim() || undefined,
        level: courseLevel,
        price: Number(coursePrice) || 0,
        subjects: courseSubjects
          .filter((s) => s.code.trim() && s.name.trim())
          .map((s) => ({
            code: s.code.trim().toUpperCase(),
            name: s.name.trim(),
            description: s.description.trim() || undefined,
            teacher_id: s.teacher_id || null,
            color: s.color,
          })),
      })
      setShowAddCourseModal(false)
      setCourseTitle('')
      setCourseSlug('')
      setCourseDesc('')
      setCourseSubjects([
        { code: 'MOD-101', name: 'Core Foundations', description: '', teacher_id: '', color: '#3b82f6' },
      ])
      await loadAllData()
    } catch (err: any) {
      alert(`Error creating course: ${err.message}`)
    } finally {
      setSubmittingCourse(false)
    }
  }

  const handleAddSubjectToExistingCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetCourseForSubject) return
    setSubmittingSubject(true)
    try {
      await addAdminCourseSubject(targetCourseForSubject.id, {
        code: subCode.trim().toUpperCase(),
        name: subName.trim(),
        description: subDesc.trim() || undefined,
        teacher_id: subTeacherId || null,
        color: subColor,
      })
      setShowAddSubjectModal(false)
      setTargetCourseForSubject(null)
      setSubCode('')
      setSubName('')
      setSubDesc('')
      setSubTeacherId('')
      await loadAllData()
    } catch (err: any) {
      alert(`Error adding subject: ${err.message}`)
    } finally {
      setSubmittingSubject(false)
    }
  }

  const handleDeleteSubject = async (courseId: string, subjectId: string, subjectName: string) => {
    if (!window.confirm(`Delete module "${subjectName}" from this course?`)) return
    try {
      await deleteAdminCourseSubject(courseId, subjectId)
      await loadAllData()
    } catch (err: any) {
      alert(`Error deleting subject: ${err.message}`)
    }
  }

  const handleSeedTechTracks = async () => {
    try {
      setLoading(true)
      await seedTechCourses()
      await loadAllData()
    } catch (err: any) {
      alert(`Seeding failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Filtered Lists ─────────────────────────────────────────────────────────
  const teachersList = users.filter((u) => u.role === 'teacher')
  const studentsList = users.filter((u) => u.role === 'student')

  const filteredStudents = studentsList.filter((s) => {
    const matchesSearch =
      s.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone_number && s.phone_number.includes(searchQuery))
    const matchesCourse =
      courseFilter === 'ALL' ||
      s.enrolled_courses?.some((c) => c.id === courseFilter || c.slug === courseFilter)
    return matchesSearch && matchesCourse
  })

  const filteredTeachers = teachersList.filter((t) => {
    return (
      t.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.phone_number && t.phone_number.includes(searchQuery))
    )
  })

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* ── Top Header Banner ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-6 md:p-8 rounded-3xl border border-amber-500/30 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <GraduationCap className="w-3.5 h-3.5" />
            Training Institute Control Center
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Acharya Institute Administration
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-2xl">
            Configure multi-subject courses, manage student batch enrollments, assign specialized faculty, and control Zoom video classroom streams.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <button
            onClick={() => openAddUser('student')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Enroll Student</span>
          </button>
          <button
            onClick={() => openAddUser('teacher')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Add Faculty</span>
          </button>
          <button
            onClick={() => setShowAddCourseModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-2 hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Course Track</span>
          </button>
          <button
            onClick={handleSeedTechTracks}
            title="Seed Standard Tech Courses (Python GenAI, Salesforce, ServiceNow, etc.)"
            className="px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Seed Standard Tech Tracks</span>
          </button>
          <button
            onClick={loadAllData}
            title="Refresh Directory"
            className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'students'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Students & Enrollments ({studentsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('teachers')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'teachers'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Faculty & Instructors ({teachersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Course & Subject Modules ({courses.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('zoom')
            loadZoomData()
          }}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'zoom'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Video className="w-4 h-4 text-blue-400" />
          <span>Zoom Live Infrastructure</span>
        </button>
      </div>

      {/* ── Tab 1: Students & Enrollments ─────────────────────────────────── */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search students by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs text-slate-400 font-semibold shrink-0">Filter Course:</label>
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Courses ({courses.length})</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Student Profile</th>
                    <th className="p-4">Contact Info</th>
                    <th className="p-4">Enrolled Course Tracks</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center border border-amber-500/30 shrink-0">
                              {s.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-200">{s.display_name}</p>
                              <p className="text-[11px] text-slate-500">ID: {s.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span>{s.email}</span>
                          </div>
                          {s.phone_number ? (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{s.phone_number}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">No phone added</span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {s.enrolled_courses && s.enrolled_courses.length > 0 ? (
                              s.enrolled_courses.map((ec) => (
                                <span
                                  key={ec.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium text-[11px]"
                                >
                                  {ec.title}
                                  <button
                                    onClick={() => handleQuickUnenroll(s.id, ec.id)}
                                    title="Unenroll from this course"
                                    className="hover:text-red-400 transition-colors"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">No active enrollments</span>
                            )}

                            {/* Enroll into other courses */}
                            {courses.filter((c) => !s.enrolled_courses?.some((ec) => ec.id === c.id)).length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleQuickEnroll(s.id, e.target.value)
                                    e.target.value = ''
                                  }
                                }}
                                defaultValue=""
                                className="bg-slate-950 border border-slate-700/60 rounded-md px-2 py-0.5 text-[10px] text-amber-400 focus:outline-none"
                              >
                                <option value="" disabled>
                                  + Enroll in Course
                                </option>
                                {courses
                                  .filter((c) => !s.enrolled_courses?.some((ec) => ec.id === c.id))
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.title}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              s.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {s.status}
                          </span>
                        </td>

                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => openEditUser(s)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
                            title="Edit Student & Reset Password"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(s)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-red-400 transition-colors"
                            title="Delete Student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Faculty & Instructors ──────────────────────────────────── */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          {/* Search */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search faculty by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Faculty Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Faculty Member</th>
                    <th className="p-4">Contact Details</th>
                    <th className="p-4">Assigned Subjects & Modules</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No faculty members found.
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-300 font-bold flex items-center justify-center border border-orange-500/30 shrink-0">
                              {t.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-200">{t.display_name}</p>
                              <p className="text-[11px] text-slate-500">Instructor ID: {t.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span>{t.email}</span>
                          </div>
                          {t.phone_number ? (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>{t.phone_number}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">No phone added</span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {t.assigned_subjects && t.assigned_subjects.length > 0 ? (
                              t.assigned_subjects.map((sub) => (
                                <span
                                  key={sub.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-[11px]"
                                >
                                  <span className="font-bold">{sub.code}:</span> {sub.name}
                                  <span className="text-[9px] text-slate-400">({sub.course_title})</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">No subjects assigned yet</span>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              t.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {t.status}
                          </span>
                        </td>

                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => openEditUser(t)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
                            title="Edit Faculty & Password"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(t)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-red-400 transition-colors"
                            title="Delete Faculty"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Courses & Subject Architecture ─────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {courses.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl text-slate-500 space-y-4">
                <BookOpen className="w-10 h-10 mx-auto text-slate-600" />
                <div>
                  <h3 className="text-white font-bold text-base">No Technical Courses Initialized</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Seed standard courses (Python with GenAI, Salesforce, ServiceNow, Full Stack, DevOps) with one click.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleSeedTechTracks}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>Seed All 5 Technical Tracks</span>
                  </button>
                  <button
                    onClick={() => setShowAddCourseModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    Create Custom Track
                  </button>
                </div>
              </div>
            ) : (
              courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5"
                >
                  {/* Course Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-lg font-extrabold text-white">{course.title}</h2>
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase">
                          {course.level}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold">
                          slug: /{course.slug}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{course.description || 'No description provided.'}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-200">{course.enrolled_count} Students</p>
                        <p className="text-[10px] text-slate-500">Active Enrollments</p>
                      </div>

                      <button
                        onClick={() => {
                          setTargetCourseForSubject(course)
                          setSubCode(`SUB-${(course.subjects.length + 1) * 100 + 1}`)
                          setSubName('')
                          setSubDesc('')
                          setSubTeacherId('')
                          setShowAddSubjectModal(true)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Subject / Class</span>
                      </button>
                    </div>
                  </div>

                  {/* Subject Modules Grid */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Subject Classes & Instructor Assignments ({course.subjects.length})
                    </p>

                    {course.subjects.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No subject modules added yet to this course.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {course.subjects.map((subj) => (
                          <div
                            key={subj.id}
                            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 relative group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase"
                                  style={{
                                    backgroundColor: `${subj.color}20`,
                                    borderColor: `${subj.color}40`,
                                    borderWidth: '1px',
                                    color: subj.color,
                                  }}
                                >
                                  {subj.code}
                                </span>

                                <button
                                  onClick={() => handleDeleteSubject(course.id, subj.id, subj.name)}
                                  title="Delete subject"
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <h4 className="text-xs font-bold text-slate-200">{subj.name}</h4>
                              {subj.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-2">{subj.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-900 text-[11px]">
                              <span className="text-slate-500 font-medium">Faculty:</span>
                              <span className="text-amber-300 font-semibold truncate">
                                {subj.teacher_name || 'Unassigned'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Tab 4: Zoom Live Infrastructure ───────────────────────────────── */}
      {activeTab === 'zoom' && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-blue-400" />
                  Zoom Cloud Meeting & Webhook Telemetry
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time status of Server-to-Server OAuth, cloud recording synchronization, and streaming proxies.
                </p>
              </div>

              <button
                onClick={loadZoomData}
                disabled={loadingZoom}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingZoom ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">OAuth Credentials</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-sm font-bold text-white">
                  {zoomStatus?.configured ? 'Configured & Active' : 'Active (Render Secrets)'}
                </p>
                <p className="text-[11px] text-slate-500">Account ID, Client ID, Client Secret</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Webhook CRC Validation</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-white">SHA256 Challenge Response Ready</p>
                <p className="text-[11px] text-slate-500">Endpoint: /api/v1/integrations/zoom/webhook</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">HD Streaming Proxy</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-white">Inline Video Stream Active</p>
                <p className="text-[11px] text-slate-500">Direct MP4 Playback + AI Notes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Student / Faculty ──────────────────────────────────── */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                {userModalRole === 'student' ? <GraduationCap className="w-5 h-5 text-amber-400" /> : <Users className="w-5 h-5 text-amber-400" />}
                {userModalRole === 'student' ? 'Enroll New Student' : 'Add New Faculty Member'}
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveNewUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. priya@institute.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Multi-course selection for students */}
              {userModalRole === 'student' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Enroll in Course Track(s)</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {courses.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={formSelectedCourses.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormSelectedCourses((prev) => [...prev, c.id])
                            } else {
                              setFormSelectedCourses((prev) => prev.filter((id) => id !== c.id))
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500"
                        />
                        <span>{c.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submittingUser ? 'Saving...' : userModalRole === 'student' ? 'Enroll Student' : 'Add Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit User / Reset Password ─────────────────────────────── */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                Edit Profile — {editingUser.display_name}
              </h3>
              <button onClick={() => setShowEditUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reset Password (leave blank to keep current)</label>
                <input
                  type="text"
                  placeholder="New password..."
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Course enrollments sync for students */}
              {editingUser.role === 'student' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-2">Enrolled Courses</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {courses.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={formSelectedCourses.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormSelectedCourses((prev) => [...prev, c.id])
                            } else {
                              setFormSelectedCourses((prev) => prev.filter((id) => id !== c.id))
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500"
                        />
                        <span>{c.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submittingUser ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Create New Course Track with Dynamic Subjects ─────────── */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                Create Training Course Track & Subject Modules
              </h3>
              <button onClick={() => setShowAddCourseModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Full Stack Python Development"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">URL Slug (optional)</label>
                  <input
                    type="text"
                    placeholder="full-stack-python"
                    value={courseSlug}
                    onChange={(e) => setCourseSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Course Description</label>
                <textarea
                  rows={2}
                  placeholder="Overview of this training track, technologies covered, and outcomes..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Skill Level</label>
                  <select
                    value={courseLevel}
                    onChange={(e) => setCourseLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Price (USD / INR, 0 for free)</label>
                  <input
                    type="number"
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Dynamic Subjects Builder */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    Subjects / Modules inside this course
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSubjectRow}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Subject</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {courseSubjects.map((sub, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 relative"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            required
                            placeholder="Code (e.g. PY-101)"
                            value={sub.code}
                            onChange={(e) => {
                              const v = e.target.value
                              setCourseSubjects((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, code: v } : item))
                              )
                            }}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-[11px]"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            required
                            placeholder="Subject Name (e.g. Python Core)"
                            value={sub.name}
                            onChange={(e) => {
                              const v = e.target.value
                              setCourseSubjects((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, name: v } : item))
                              )
                            }}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px]"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <select
                            value={sub.teacher_id}
                            onChange={(e) => {
                              const v = e.target.value
                              setCourseSubjects((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, teacher_id: v } : item))
                              )
                            }}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-[11px]"
                          >
                            <option value="">Assign Faculty...</option>
                            {teachersList.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.display_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-1 text-right">
                          {courseSubjects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSubjectRow(idx)}
                              className="text-slate-500 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCourse}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submittingCourse ? 'Creating Course Track...' : 'Create Course & Subjects'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Subject to Existing Course ─────────────────────────── */}
      {showAddSubjectModal && targetCourseForSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Add Subject to {targetCourseForSubject.title}
              </h3>
              <button onClick={() => setShowAddSubjectModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubjectToExistingCourse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subject / Class Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HTML-101"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HTML5, Semantic Elements & CSS Layouts"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Modules Covered</label>
                <textarea
                  rows={2}
                  placeholder="Details on topics, lectures, practical labs..."
                  value={subDesc}
                  onChange={(e) => setSubDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assign Faculty / Instructor</label>
                <select
                  value={subTeacherId}
                  onChange={(e) => setSubTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Unassigned</option>
                  {teachersList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Badge Color Theme</label>
                <div className="flex items-center gap-2">
                  {['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSubColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        subColor === color ? 'scale-125 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSubject}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submittingSubject ? 'Adding...' : 'Add Subject Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPage
