import React, { useState, useEffect } from 'react'
import type { 
  User, 
  AdminInstituteCourse,
  Enrollment
} from '../lib/api'
import { 
  getAdminCourses, 
  getMyEnrollments, 
  enrollInCourse,
} from '../lib/api'
import { 
  BookOpen, 
  Search, 
  GraduationCap, 
  Layers, 
  CheckCircle2, 
  Terminal,
  Check,
  Plus,
  RefreshCw,
} from 'lucide-react'

type CoursesPageProps = {
  user: User
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<AdminInstituteCourse[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadCourseData()
  }, [])

  const loadCourseData = async () => {
    try {
      setLoading(true)
      const [cList, eList] = await Promise.all([
        getAdminCourses().catch(() => []),
        getMyEnrollments().catch(() => []),
      ])
      setCourses(cList || [])
      setEnrollments(eList || [])
      if (cList && cList.length > 0 && !activeCourseId) {
        setActiveCourseId(cList[0].id)
      }
    } catch (err) {
      console.error('Failed to load courses:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async (courseId: string) => {
    try {
      setEnrollingId(courseId)
      await enrollInCourse(courseId)
      const updated = await getMyEnrollments().catch(() => [])
      setEnrollments(updated)
      showToast('Successfully enrolled in training track!')
    } catch (err: any) {
      showToast(err.message || 'Enrollment failed')
    } finally {
      setEnrollingId(null)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const isEnrolled = (courseId: string) => {
    return enrollments.some(e => e.course_id === courseId || (e.course && e.course.id === courseId))
  }

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase())) ||
      c.subjects.some(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
    const matchesLevel = selectedLevel === 'all' || c.level.toLowerCase() === selectedLevel.toLowerCase()
    return matchesSearch && matchesLevel
  })

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses[0]

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-bold shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-6 md:p-8 rounded-3xl border border-amber-500/30 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            Technical Training Curriculum & Modules
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Professional Technology Tracks
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-2xl">
            Explore industry-aligned curriculums in Python with Generative AI, Salesforce, ServiceNow, Full Stack Web, and Cloud DevOps.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <span className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            <span>{courses.length} Certified Tracks</span>
          </span>
          <button
            onClick={loadCourseData}
            title="Refresh Courses"
            className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search tracks, subjects (e.g. Python, LWC, ITSM)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                selectedLevel === lvl
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {lvl === 'all' ? 'All Levels' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* ── Courses Master & Detail View ──────────────────────────────────── */}
      {filteredCourses.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl text-slate-500 space-y-3">
          <BookOpen className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm">No course tracks found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Course Track Cards List (5/12) */}
          <div className="lg:col-span-5 space-y-3">
            {filteredCourses.map((c) => {
              const enrolled = isEnrolled(c.id)
              const isActive = activeCourse?.id === c.id

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveCourseId(c.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/50 shadow-xl'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                        {c.level}
                      </span>
                      {enrolled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Enrolled
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-white">{c.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2">{c.description}</p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                      <span>{c.subjects.length} Subject Modules</span>
                      <span>{c.enrolled_count} Students Enrolled</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: Active Course Deep Dive (7/12) */}
          {activeCourse && (
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                      {activeCourse.level}
                    </span>
                    <span className="text-xs text-slate-500">Track ID: /{activeCourse.slug}</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white">{activeCourse.title}</h2>
                </div>

                <div className="shrink-0">
                  {user.role === 'student' && (
                    isEnrolled(activeCourse.id) ? (
                      <span className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Enrolled in Track</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleEnroll(activeCourse.id)}
                        disabled={enrollingId === activeCourse.id}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-slate-950" />
                        <span>{enrollingId === activeCourse.id ? 'Enrolling...' : 'Enroll in Track'}</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed">{activeCourse.description}</p>

              {/* Subject Modules List */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Subject Classes & Modules Included ({activeCourse.subjects.length})
                </h4>

                <div className="space-y-3">
                  {activeCourse.subjects.map((sub, idx) => (
                    <div
                      key={sub.id || idx}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="px-2.5 py-0.5 rounded text-[11px] font-mono font-extrabold uppercase"
                            style={{
                              backgroundColor: `${sub.color}20`,
                              borderColor: `${sub.color}40`,
                              borderWidth: '1px',
                              color: sub.color,
                            }}
                          >
                            {sub.code}
                          </span>
                          <h5 className="font-bold text-xs text-white">{sub.name}</h5>
                        </div>

                        <span className="text-[11px] text-slate-400 font-medium">
                          Instructor: <strong className="text-amber-300">{sub.teacher_name || 'Assigned Faculty'}</strong>
                        </span>
                      </div>

                      {sub.description && (
                        <p className="text-[11px] text-slate-400 pl-1">{sub.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lab & Project Highlights */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <h5 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Hands-On Labs & Capstone Deliverables
                </h5>
                <p className="text-[11px] text-slate-400">
                  Every subject includes weekly coding exercises, live Zoom interactive workshops, automated grading assessments, and verified certificate upon course completion.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CoursesPage
