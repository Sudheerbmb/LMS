import React, { useState, useEffect } from 'react'
import type {
  AdminInstituteUser,
  AdminInstituteCourse,
  User,
  ZoomIntegrationStatus,
  Notification as LMSNotification,
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
  getNotifications,
  deleteNotification,
  flushAllNotifications,
  updateAdminCourseSubject,
  syncCoursesToTimetable,
  purgeLegacyData,
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
  Bell,
} from 'lucide-react'

type AdminPageProps = {
  user: User
}

export const AdminPage: React.FC<AdminPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'courses' | 'zoom' | 'notifications'>('students')
  const [users, setUsers] = useState<AdminInstituteUser[]>([])
  const [courses, setCourses] = useState<AdminInstituteCourse[]>([])
  const [notifications, setNotifications] = useState<LMSNotification[]>([])
  const [flushingNotifs, setFlushingNotifs] = useState(false)
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
  const [formSelectedSubjects, setFormSelectedSubjects] = useState<string[]>([])
  const [submittingUser, setSubmittingUser] = useState(false)
  const [formError, setFormError] = useState('')

  // Form States for Add Course
  const [courseTitle, setCourseTitle] = useState('')
  const [courseSlug, setCourseSlug] = useState('')
  const [courseDesc, setCourseDesc] = useState('')
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
      const [uList, cList, nList] = await Promise.all([
        getAdminUsers().catch(() => []),
        getAdminCourses().catch(() => []),
        getNotifications().catch(() => []),
      ])
      setUsers(uList || [])
      setCourses(cList || [])
      setNotifications(nList || [])
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteNotification = async (id: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id))
      await deleteNotification(id)
    } catch (err) {
      console.error('Failed to delete notification:', err)
      const fresh = await getNotifications().catch(() => [])
      setNotifications(fresh || [])
    }
  }

  const handleFlushAllNotifications = async () => {
    if (!window.confirm('Are you sure you want to flush all system notifications?')) return
    try {
      setFlushingNotifs(true)
      setNotifications([])
      await flushAllNotifications()
      const fresh = await getNotifications().catch(() => [])
      setNotifications(fresh || [])
    } catch (err) {
      console.error('Failed to flush notifications:', err)
      const fresh = await getNotifications().catch(() => [])
      setNotifications(fresh || [])
    } finally {
      setFlushingNotifs(false)
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
    setFormSelectedSubjects([])
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
    setFormSelectedSubjects(u.assigned_subjects?.map((s) => s.id) || [])
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
        subject_ids: userModalRole === 'teacher' ? formSelectedSubjects : [],
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
        subject_ids: editingUser.role === 'teacher' ? formSelectedSubjects : undefined,
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

  const handleAssignTeacherToSubject = async (courseId: string, subjectId: string, teacherId: string) => {
    try {
      await updateAdminCourseSubject(courseId, subjectId, { teacher_id: teacherId || null })
      await loadAllData()
    } catch (err: any) {
      alert(`Failed to assign instructor: ${err.message}`)
    }
  }

  const handleSyncCoursesAndTimetable = async () => {
    try {
      setLoading(true)
      const res = await syncCoursesToTimetable()
      alert(`Synced! ${res.courses_synced} courses and ${res.subjects_synced} subjects synchronized with master timetable.`)
      await loadAllData()
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePurgeLegacyData = async () => {
    if (!window.confirm('Reset and purge legacy demo accounts and obsolete data from the database? This action cannot be undone.')) return
    try {
      setLoading(true)
      const res = await purgeLegacyData()
      alert(res.message || 'Legacy data successfully purged!')
      await loadAllData()
    } catch (err: any) {
      alert(`Purge failed: ${err.message}`)
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-[#FFF5EE] via-[#FFF0E6] to-[#F5EEFF] p-6 md:p-8 rounded-3xl border border-black/[0.06] shadow-xs relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] text-xs font-bold uppercase tracking-wider shadow-xs">
            <GraduationCap className="w-3.5 h-3.5 text-[#FF7A18]" />
            Training Institute Control Center
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-[#111827] tracking-tight flex items-center gap-3">
            Acharya Institute Administration
          </h1>
          <p className="text-[#64748B] text-xs md:text-sm max-w-2xl font-normal leading-relaxed">
            Configure multi-subject courses, manage student course enrollments, assign specialized faculty, and control Zoom video classroom streams.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <button
            onClick={() => openAddUser('student')}
            className="px-4 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-[#FF7A18]/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Enroll Student</span>
          </button>
          <button
            onClick={() => openAddUser('teacher')}
            className="px-4 py-2.5 rounded-2xl bg-white border border-black/[0.08] text-[#111827] text-xs font-bold flex items-center gap-2 hover:bg-neutral-50 transition-all cursor-pointer shadow-xs"
          >
            <Users className="w-3.5 h-3.5 text-[#FF7A18]" />
            <span>Add Faculty</span>
          </button>
          <button
            onClick={() => setShowAddCourseModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-white border border-black/[0.08] text-[#111827] text-xs font-bold flex items-center gap-2 hover:bg-neutral-50 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#FF7A18]" />
            <span>+ New Course</span>
          </button>
          <button
            onClick={handleSeedTechTracks}
            title="Seed Standard Courses (Python GenAI, Salesforce, ServiceNow, etc.)"
            className="px-4 py-2.5 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] hover:bg-[#FFE8D6] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A18]" />
            <span>Seed Standard Courses</span>
          </button>
          <button
            onClick={handlePurgeLegacyData}
            title="Reset and purge legacy demo accounts and old data"
            className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Legacy Data</span>
          </button>
          <button
            onClick={loadAllData}
            title="Refresh Directory"
            className="p-2.5 rounded-2xl bg-white border border-black/[0.08] text-[#64748B] hover:text-[#111827] transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'students'
              ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] shadow-xs'
              : 'text-[#64748B] hover:text-[#111827]'
            }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Students & Enrollments ({studentsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('teachers')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'teachers'
              ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] shadow-xs'
              : 'text-[#64748B] hover:text-[#111827]'
            }`}
        >
          <Users className="w-4 h-4" />
          <span>Faculty & Instructors ({teachersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'courses'
              ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] shadow-xs'
              : 'text-[#64748B] hover:text-[#111827]'
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
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'zoom'
              ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] shadow-xs'
              : 'text-[#64748B] hover:text-[#111827]'
            }`}
        >
          <Video className="w-4 h-4 text-[#FF7A18]" />
          <span>Zoom Live Infrastructure</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'notifications'
              ? 'bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] shadow-xs'
              : 'text-[#64748B] hover:text-[#111827]'
            }`}
        >
          <Bell className="w-4 h-4 text-[#FF7A18]" />
          <span>System Notifications ({notifications.length})</span>
        </button>
      </div>

      {/* ── Tab 1: Students & Enrollments ─────────────────────────────────── */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search students by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/[0.08] rounded-2xl text-xs text-[#111827] placeholder-[#94A3B8] focus:outline-none focus:border-[#FF7A18] shadow-xs"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs text-[#64748B] font-bold shrink-0">Filter Course:</label>
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="bg-white border border-black/[0.08] rounded-2xl px-3.5 py-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#FF7A18] shadow-xs font-medium"
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
          <div className="bg-white border border-black/[0.06] rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F6] text-[#64748B] font-bold border-b border-black/[0.06] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-4">Student Profile</th>
                    <th className="p-4">Contact Info</th>
                    <th className="p-4">Enrolled Courses</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#64748B]">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#FFF3EA] text-[#FF7A18] font-bold flex items-center justify-center border border-[#FFDEC4] shrink-0">
                              {s.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-[#111827]">{s.display_name}</p>
                              <p className="text-[11px] text-[#94A3B8]">ID: {s.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 space-y-1">
                          <div className="flex items-center gap-1.5 text-[#334155]">
                            <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
                            <span>{s.email}</span>
                          </div>
                          {s.phone_number ? (
                            <div className="flex items-center gap-1.5 text-[#64748B]">
                              <Phone className="w-3.5 h-3.5 text-[#94A3B8]" />
                              <span>{s.phone_number}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#94A3B8] italic">No phone added</span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {s.enrolled_courses && s.enrolled_courses.length > 0 ? (
                              s.enrolled_courses.map((ec) => (
                                <span
                                  key={ec.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] font-bold text-[11px]"
                                >
                                  {ec.title}
                                  <button
                                    onClick={() => handleQuickUnenroll(s.id, ec.id)}
                                    title="Unenroll from this course"
                                    className="hover:text-red-600 transition-colors cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-[#94A3B8] italic text-[11px]">No active enrollments</span>
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
                                className="bg-[#FAF9F6] border border-black/[0.08] rounded-xl px-2.5 py-1 text-[11px] text-[#FF7A18] font-bold focus:outline-none cursor-pointer"
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
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {s.status}
                          </span>
                        </td>

                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => openEditUser(s)}
                            className="p-2 rounded-xl bg-neutral-100 text-[#334155] hover:text-[#FF7A18] hover:bg-neutral-200 transition-colors cursor-pointer"
                            title="Edit Student & Reset Password"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(s)}
                            className="p-2 rounded-xl bg-neutral-100 text-[#334155] hover:text-red-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search faculty by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/[0.08] rounded-2xl text-xs text-[#111827] placeholder-[#94A3B8] focus:outline-none focus:border-[#FF7A18] shadow-xs"
              />
            </div>
          </div>

          {/* Faculty Table */}
          <div className="bg-white border border-black/[0.06] rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F6] text-[#64748B] font-bold border-b border-black/[0.06] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-4">Faculty Member</th>
                    <th className="p-4">Contact Details</th>
                    <th className="p-4">Assigned Subjects & Modules</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#64748B]">
                        No faculty members found.
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((t) => (
                      <tr key={t.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#FFF3EA] text-[#FF7A18] font-bold flex items-center justify-center border border-[#FFDEC4] shrink-0">
                              {t.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-[#111827]">{t.display_name}</p>
                              <p className="text-[11px] text-[#94A3B8]">Instructor ID: {t.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 space-y-1">
                          <div className="flex items-center gap-1.5 text-[#334155]">
                            <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
                            <span>{t.email}</span>
                          </div>
                          {t.phone_number ? (
                            <div className="flex items-center gap-1.5 text-[#64748B]">
                              <Phone className="w-3.5 h-3.5 text-[#94A3B8]" />
                              <span>{t.phone_number}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#94A3B8] italic">No phone added</span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {t.assigned_subjects && t.assigned_subjects.length > 0 ? (
                              t.assigned_subjects.map((sub) => (
                                <span
                                  key={sub.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FAF9F6] border border-black/[0.08] text-[#111827] font-medium text-[11px]"
                                >
                                  <span className="font-bold text-[#FF7A18]">{sub.code}:</span> {sub.name}
                                  <span className="text-[9px] text-[#94A3B8]">({sub.course_title})</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-[#94A3B8] italic text-[11px]">No subjects assigned yet</span>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${t.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {t.status}
                          </span>
                        </td>

                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => openEditUser(t)}
                            className="p-2 rounded-xl bg-neutral-100 text-[#334155] hover:text-[#FF7A18] hover:bg-neutral-200 transition-colors cursor-pointer"
                            title="Edit Faculty & Password"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(t)}
                            className="p-2 rounded-xl bg-neutral-100 text-[#334155] hover:text-red-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
          {/* Top Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 bg-white border border-black/[0.06] rounded-3xl shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Course Tracks & Modular Hierarchy</h3>
              <p className="text-xs text-[#64748B]">All subjects automatically link to teacher timetable grids and student dashboards.</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleSyncCoursesAndTimetable}
                disabled={loading}
                className="px-3.5 py-2 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] hover:bg-[#FFE8D6] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                title="Synchronize course subjects into timetable slots"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync with Timetable</span>
              </button>
              <button
                onClick={handleSeedTechTracks}
                disabled={loading}
                className="px-3.5 py-2 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-[#111827] border border-black/[0.06] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FF7A18]" />
                <span>Re-seed 5 Tracks</span>
              </button>
              <button
                onClick={() => setShowAddCourseModal(true)}
                className="px-4 py-2 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#FF7A18]/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Track</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {courses.length === 0 ? (
              <div className="p-12 text-center bg-white border border-black/[0.06] rounded-3xl text-[#64748B] space-y-4 shadow-xs">
                <BookOpen className="w-10 h-10 mx-auto text-[#94A3B8]" />
                <div>
                  <h3 className="text-[#111827] font-bold text-base">No Technical Courses Initialized</h3>
                  <p className="text-xs text-[#64748B] mt-1">
                    Seed standard courses (Python with GenAI, Salesforce, ServiceNow, Full Stack, DevOps) with one click.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleSeedTechTracks}
                    className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] text-white font-bold text-xs shadow-md shadow-[#FF7A18]/25 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Seed All 5 Technical Tracks</span>
                  </button>
                  <button
                    onClick={() => setShowAddCourseModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-neutral-100 border border-black/[0.06] text-[#111827] font-bold text-xs hover:bg-neutral-200 transition-all cursor-pointer"
                  >
                    Create Custom Track
                  </button>
                </div>
              </div>
            ) : (
              courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-white border border-black/[0.06] rounded-3xl p-6 shadow-xs space-y-5"
                >
                  {/* Course Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-lg font-bold text-[#111827]">{course.title}</h2>
                        <span className="px-2.5 py-0.5 rounded-md bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] text-[10px] font-bold uppercase">
                          {course.level}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-neutral-100 text-[#64748B] text-[10px] font-semibold">
                          slug: /{course.slug}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B]">{course.description || 'No description provided.'}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#111827]">{course.enrolled_count} Students</p>
                        <p className="text-[10px] text-[#94A3B8]">Active Enrollments</p>
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
                        className="px-3.5 py-2 rounded-2xl bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] hover:bg-[#FFE8D6] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Subject / Class</span>
                      </button>
                    </div>
                  </div>

                  {/* Subject Modules Grid */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Subject Classes & Instructor Assignments ({course.subjects.length})
                    </p>

                    {course.subjects.length === 0 ? (
                      <p className="text-xs text-[#94A3B8] italic">No subject modules added yet to this course.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {course.subjects.map((subj) => (
                          <div
                            key={subj.id}
                            className="p-4 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] hover:border-[#FF7A18]/40 transition-all flex flex-col justify-between gap-3 relative group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase"
                                  style={{
                                    backgroundColor: `${subj.color}15`,
                                    borderColor: `${subj.color}30`,
                                    borderWidth: '1px',
                                    color: subj.color,
                                  }}
                                >
                                  {subj.code}
                                </span>

                                <button
                                  onClick={() => handleDeleteSubject(course.id, subj.id, subj.name)}
                                  title="Delete subject"
                                  className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-red-600 transition-opacity p-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <h4 className="text-xs font-bold text-[#111827]">{subj.name}</h4>
                              {subj.description && (
                                <p className="text-[11px] text-[#64748B] line-clamp-2">{subj.description}</p>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.04] text-[11px]">
                              <span className="text-[#64748B] font-medium shrink-0">Faculty:</span>
                              <select
                                value={subj.teacher_id || ''}
                                onChange={(e) => handleAssignTeacherToSubject(course.id, subj.id, e.target.value)}
                                className="bg-white border border-black/[0.08] rounded-xl px-2.5 py-1 text-[11px] text-[#111827] font-semibold focus:outline-none focus:border-[#FF7A18] max-w-[170px] truncate"
                              >
                                <option value="">Unassigned</option>
                                {teachersList.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.display_name}
                                  </option>
                                ))}
                              </select>
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
          <div className="bg-white border border-black/[0.06] rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                  <Video className="w-5 h-5 text-[#FF7A18]" />
                  Zoom Cloud Meeting & Webhook Telemetry
                </h3>
                <p className="text-xs text-[#64748B]">
                  Real-time status of Server-to-Server OAuth, cloud recording synchronization, and streaming proxies.
                </p>
              </div>

              <button
                onClick={loadZoomData}
                disabled={loadingZoom}
                className="px-4 py-2 rounded-2xl bg-neutral-100 border border-black/[0.06] text-[#111827] hover:bg-neutral-200 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingZoom ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-[#FAF9F6] border border-black/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B]">OAuth Credentials</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-sm font-bold text-[#111827]">
                  {zoomStatus?.configured ? 'Configured & Active' : 'Active (Render Secrets)'}
                </p>
                <p className="text-[11px] text-[#94A3B8]">Account ID, Client ID, Client Secret</p>
              </div>

              <div className="p-5 rounded-3xl bg-[#FAF9F6] border border-black/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B]">Webhook CRC Validation</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-[#111827]">SHA256 Challenge Response Ready</p>
                <p className="text-[11px] text-[#94A3B8]">Endpoint: /api/v1/integrations/zoom/webhook</p>
              </div>

              <div className="p-5 rounded-3xl bg-[#FAF9F6] border border-black/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B]">HD Streaming Proxy</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-[#111827]">Inline Video Stream Active</p>
                <p className="text-[11px] text-[#94A3B8]">Direct MP4 Playback + AI Notes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: System Notifications Manager ─────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white border border-black/[0.06] rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#FF7A18]" />
                  System Notifications & Broadcast Alerts
                </h3>
                <p className="text-xs text-[#64748B]">
                  Manage active candidate announcements, timetable alerts, and prune obsolete notifications.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {notifications.length > 0 && (
                  <button
                    onClick={handleFlushAllNotifications}
                    disabled={flushingNotifs}
                    className="px-4 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="Flush out all notifications"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{flushingNotifs ? 'Flushing...' : 'Flush Out All Notifications'}</span>
                  </button>
                )}

                <button
                  onClick={loadAllData}
                  className="p-2.5 rounded-2xl bg-neutral-100 border border-black/[0.06] text-[#64748B] hover:text-[#111827] transition-all cursor-pointer"
                  title="Refresh Notifications"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-16 rounded-3xl bg-[#FAF9F6] border border-black/[0.04]">
                <Bell className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
                <h4 className="text-sm font-bold text-[#111827]">No Active Notifications</h4>
                <p className="text-xs text-[#64748B] mt-1">All broadcast and system alerts have been cleared.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded-2xl bg-[#FAF9F6] border border-black/[0.04] flex items-start justify-between gap-4 hover:border-[#FF7A18]/30 transition-all"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                        style={{
                          background: n.read_at ? 'rgba(0,0,0,0.2)' : '#FF7A18',
                          boxShadow: n.read_at ? 'none' : '0 0 8px #FF7A18',
                        }}
                      />
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#111827]">{n.title}</span>
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4]">
                            {n.notification_type || 'Alert'}
                          </span>
                          {n.read_at && (
                            <span className="text-[10px] text-[#94A3B8]">Read</span>
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] leading-relaxed break-words">{n.body}</p>
                        {n.created_at && (
                          <span className="text-[10px] text-[#94A3B8] block font-mono">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteNotification(n.id)}
                      className="p-2 rounded-xl text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0 cursor-pointer"
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Add Student / Faculty ──────────────────────────────────── */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                {userModalRole === 'student' ? <GraduationCap className="w-5 h-5 text-[#FF7A18]" /> : <Users className="w-5 h-5 text-[#FF7A18]" />}
                {userModalRole === 'student' ? 'Enroll New Student' : 'Add New Faculty Member'}
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-[#94A3B8] hover:text-[#111827] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveNewUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#334155] font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. priya@institute.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18] font-mono"
                />
              </div>

              {/* Subject assignment for teachers OR Course enrollment for students */}
              {userModalRole === 'teacher' ? (
                <div>
                  <label className="block text-[#334155] font-bold mb-2">
                    Assign Subject Modules Across Tracks (Multi-Select)
                  </label>
                  <p className="text-[10px] text-[#64748B] mb-2">
                    Select specific subject modules this faculty member will handle across technical courses.
                  </p>
                  <div className="space-y-3 max-h-48 overflow-y-auto p-3 bg-[#FAF9F6] rounded-2xl border border-black/[0.06]">
                    {courses.map((c) => (
                      <div key={c.id} className="space-y-1.5 pb-2 border-b border-black/[0.04] last:border-0 last:pb-0">
                        <span className="text-[10px] font-extrabold uppercase text-[#FF7A18] tracking-wider">
                          {c.title}
                        </span>
                        <div className="grid grid-cols-1 gap-1.5 pl-2">
                          {c.subjects.map((s) => (
                            <label key={s.id} className="flex items-center gap-2 text-[#334155] hover:text-[#111827] cursor-pointer text-[11px]">
                              <input
                                type="checkbox"
                                checked={formSelectedSubjects.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormSelectedSubjects((prev) => [...prev, s.id])
                                  } else {
                                    setFormSelectedSubjects((prev) => prev.filter((id) => id !== s.id))
                                  }
                                }}
                                className="rounded border-neutral-300 text-[#FF7A18] focus:ring-0"
                              />
                              <span className="font-mono text-[#FF7A18] font-bold px-1.5 py-0.2 rounded bg-white border border-black/[0.08]">
                                {s.code}
                              </span>
                              <span className="truncate">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[#334155] font-bold mb-2">Enroll in Course Track(s)</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto p-3 bg-[#FAF9F6] rounded-2xl border border-black/[0.06]">
                    {courses.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-[#334155] hover:text-[#111827] cursor-pointer text-[11px]">
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
                          className="rounded border-neutral-300 text-[#FF7A18]"
                        />
                        <span>{c.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-[#FF7A18]/25"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#FF7A18]" />
                Edit Profile — {editingUser.display_name}
              </h3>
              <button onClick={() => setShowEditUserModal(false)} className="text-[#94A3B8] hover:text-[#111827] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#334155] font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Reset Password (leave blank to keep current)</label>
                <input
                  type="text"
                  placeholder="New password..."
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18] font-mono"
                />
              </div>

              {/* Subject assignments for teachers OR Course enrollments for students */}
              {editingUser.role === 'teacher' ? (
                <div>
                  <label className="block text-[#334155] font-bold mb-2">
                    Assigned Subject Modules (Multi-Select)
                  </label>
                  <p className="text-[10px] text-[#64748B] mb-2">
                    Manage subjects taught by this instructor across one or multiple courses.
                  </p>
                  <div className="space-y-3 max-h-48 overflow-y-auto p-3 bg-[#FAF9F6] rounded-2xl border border-black/[0.06]">
                    {courses.map((c) => (
                      <div key={c.id} className="space-y-1.5 pb-2 border-b border-black/[0.04] last:border-0 last:pb-0">
                        <span className="text-[10px] font-extrabold uppercase text-[#FF7A18] tracking-wider">
                          {c.title}
                        </span>
                        <div className="grid grid-cols-1 gap-1.5 pl-2">
                          {c.subjects.map((s) => (
                            <label key={s.id} className="flex items-center gap-2 text-[#334155] hover:text-[#111827] cursor-pointer text-[11px]">
                              <input
                                type="checkbox"
                                checked={formSelectedSubjects.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormSelectedSubjects((prev) => [...prev, s.id])
                                  } else {
                                    setFormSelectedSubjects((prev) => prev.filter((id) => id !== s.id))
                                  }
                                }}
                                className="rounded border-neutral-300 text-[#FF7A18] focus:ring-0"
                              />
                              <span className="font-mono text-[#FF7A18] font-bold px-1.5 py-0.2 rounded bg-white border border-black/[0.08]">
                                {s.code}
                              </span>
                              <span className="truncate">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[#334155] font-bold mb-2">Enrolled Courses</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto p-3 bg-[#FAF9F6] rounded-2xl border border-black/[0.06]">
                    {courses.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-[#334155] hover:text-[#111827] cursor-pointer text-[11px]">
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
                          className="rounded border-neutral-300 text-[#FF7A18]"
                        />
                        <span>{c.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-[#FF7A18]/25"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#FF7A18]" />
                Create Training Course Track & Subject Modules
              </h3>
              <button onClick={() => setShowAddCourseModal(false)} className="text-[#94A3B8] hover:text-[#111827] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#334155] font-bold mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Full Stack Python Development"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                  />
                </div>

                <div>
                  <label className="block text-[#334155] font-bold mb-1">URL Slug (optional)</label>
                  <input
                    type="text"
                    placeholder="full-stack-python"
                    value={courseSlug}
                    onChange={(e) => setCourseSlug(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Course Description</label>
                <textarea
                  rows={2}
                  placeholder="Overview of this training track, technologies covered, and outcomes..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>

                <div>
                  <label className="block text-[#334155] font-bold mb-1">Price (USD / INR, 0 for free)</label>
                  <input
                    type="number"
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                  />
                </div>
              </div>

              {/* Dynamic Subjects Builder */}
              <div className="space-y-3 pt-3 border-t border-black/[0.06]">
                <div className="flex items-center justify-between">
                  <label className="text-[#334155] font-bold uppercase tracking-wider text-[11px]">
                    Subjects / Modules inside this course
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSubjectRow}
                    className="px-3 py-1.5 rounded-xl bg-[#FFF3EA] border border-[#FFDEC4] text-[#FF7A18] hover:bg-[#FFE8D6] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Subject</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {courseSubjects.map((sub, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-[#FAF9F6] rounded-2xl border border-black/[0.06] space-y-2 relative"
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
                            className="w-full px-2.5 py-2 bg-white border border-black/[0.08] rounded-xl text-[#111827] font-mono text-[11px]"
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
                            className="w-full px-2.5 py-2 bg-white border border-black/[0.08] rounded-xl text-[#111827] text-[11px]"
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
                            className="w-full px-2.5 py-2 bg-white border border-black/[0.08] rounded-xl text-[#334155] text-[11px]"
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
                              className="text-[#94A3B8] hover:text-red-600 p-1 cursor-pointer"
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCourse}
                  className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-[#FF7A18]/25"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#FF7A18]" />
                Add Subject to {targetCourseForSubject.title}
              </h3>
              <button onClick={() => setShowAddSubjectModal(false)} className="text-[#94A3B8] hover:text-[#111827] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubjectToExistingCourse} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#334155] font-bold mb-1">Subject / Class Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HTML-101"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18] font-mono"
                />
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HTML5, Semantic Elements & CSS Layouts"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Description / Modules Covered</label>
                <textarea
                  rows={2}
                  placeholder="Details on topics, lectures, practical labs..."
                  value={subDesc}
                  onChange={(e) => setSubDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="block text-[#334155] font-bold mb-1">Assign Faculty / Instructor</label>
                <select
                  value={subTeacherId}
                  onChange={(e) => setSubTeacherId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl text-[#111827] focus:outline-none focus:border-[#FF7A18]"
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
                <label className="block text-[#334155] font-bold mb-1">Badge Color Theme</label>
                <div className="flex items-center gap-2">
                  {['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSubColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${subColor === color ? 'scale-125 border-[#111827]' : 'border-transparent'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSubject}
                  className="px-5 py-2.5 rounded-2xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-[#FF7A18]/25"
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
