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
  Share2,
  FileText,
  GitBranch,
  ExternalLink,
  Code,
  Trash2,
  X,
  FolderOpen
} from 'lucide-react'

type CoursesPageProps = {
  user: User
}

export interface SharedResource {
  id: string
  course_id: string
  subject_code: string
  title: string
  type: 'slides' | 'github' | 'lab_manual' | 'code_snippet' | 'pdf' | 'notes'
  url_or_content: string
  shared_by: string
  shared_at: string
}

// Default Fallback Tracks when backend database is newly initialized
const DEFAULT_TECH_TRACKS: AdminInstituteCourse[] = [
  {
    id: 'track-python-genai',
    title: 'Python with Generative AI (GenAI)',
    slug: 'python-genai',
    level: 'Advanced',
    price: 0,
    is_free: true,
    status: 'published',
    description: 'Master advanced Python, LangChain, OpenAI & Gemini APIs, RAG architecture, Vector DBs, and autonomous multi-agent building with FastAPI.',
    enrolled_count: 38,
    subjects: [
      {
        id: 'sub-py-101',
        code: 'PY-101',
        name: 'Python Core & Advanced Object-Oriented Programming',
        color: '#3b82f6',
        description: 'Advanced data structures, functional paradigms, OOP, decorators, generators, and async programming.',
        teacher_name: 'Dr. Sarah Connor'
      },
      {
        id: 'sub-gen-201',
        code: 'GEN-201',
        name: 'Prompt Engineering, LLMs & LangChain Framework',
        color: '#8b5cf6',
        description: 'Tokenization, system prompts, Few-shot prompting, LangChain chains, tools, and structured outputs.',
        teacher_name: 'Prof. Alan Turing'
      },
      {
        id: 'sub-rag-301',
        code: 'RAG-301',
        name: 'Retrieval-Augmented Generation (RAG) & Vector DBs',
        color: '#10b981',
        description: 'Document parsing, text chunking, embedding models, Pinecone/ChromaDB indexing, and hybrid search.',
        teacher_name: 'Prof. Alan Turing'
      },
      {
        id: 'sub-ai-401',
        code: 'AI-401',
        name: 'Autonomous Agents, Multi-Agent Systems & FastAPI Deployment',
        color: '#f59e0b',
        description: 'ReAct framework, LangGraph stateful agents, memory persistence, REST APIs, and Docker cloud deployment.',
        teacher_name: 'Dr. Sarah Connor'
      }
    ]
  },
  {
    id: 'track-salesforce-dev',
    title: 'Salesforce Administration & Developer Track',
    slug: 'salesforce-developer',
    level: 'Intermediate',
    price: 0,
    is_free: true,
    status: 'published',
    description: 'Complete Salesforce certification curriculum covering Admin Essentials, Flow Builder, Apex OOP, SOQL, and Lightning Web Components (LWC).',
    enrolled_count: 29,
    subjects: [
      {
        id: 'sub-sf-adm',
        code: 'SF-ADM',
        name: 'Salesforce Administrator Essentials & Security',
        color: '#0284c7',
        description: 'Org configuration, custom objects, relationships, validation rules, Flow Builder, and role hierarchy.',
        teacher_name: 'Marc Benioff'
      },
      {
        id: 'sub-sf-dev',
        code: 'SF-DEV',
        name: 'Apex Programming, Triggers & SOQL Queries',
        color: '#0ea5e9',
        description: 'Apex syntax, governor limits, trigger frameworks, asynchronous Apex, and test classes.',
        teacher_name: 'Marc Benioff'
      },
      {
        id: 'sub-sf-lwc',
        code: 'SF-LWC',
        name: 'Lightning Web Components (LWC) & Event Architecture',
        color: '#38bdf8',
        description: 'Modern ES6+ JavaScript for Salesforce, reactive properties, wire adapters, Lightning Data Service, and LMS events.',
        teacher_name: 'Marc Benioff'
      }
    ]
  },
  {
    id: 'track-servicenow',
    title: 'ServiceNow System Administrator & Developer',
    slug: 'servicenow-sysadmin',
    level: 'Intermediate',
    price: 0,
    is_free: true,
    status: 'published',
    description: 'ServiceNow Platform Administration, Incident/Problem/Change Management, Business Rules, Flow Designer, and Service Portal Widget creation.',
    enrolled_count: 24,
    subjects: [
      {
        id: 'sub-sn-fnd',
        code: 'SN-FND',
        name: 'ServiceNow Platform Administration & ITSM Core',
        color: '#14b8a6',
        description: 'User administration, CMDB, SLA management, Knowledge Base, and Service Catalog configuration.',
        teacher_name: 'Fred Luddy'
      },
      {
        id: 'sub-sn-dev',
        code: 'SN-DEV',
        name: 'Flow Designer, Client Scripts & Business Rules',
        color: '#06b6d4',
        description: 'Server-side Business Rules, Script Includes, Client Scripts, UI Policies, and Automated Test Framework (ATF).',
        teacher_name: 'Fred Luddy'
      }
    ]
  },
  {
    id: 'track-fullstack-web',
    title: 'Full Stack Web Development (MERN & TypeScript)',
    slug: 'fullstack-web',
    level: 'Beginner',
    price: 0,
    is_free: true,
    status: 'published',
    description: 'Modern full stack software engineering with React, Next.js, Node.js, Express, PostgreSQL, Prisma, and REST/GraphQL APIs.',
    enrolled_count: 45,
    subjects: [
      {
        id: 'sub-fs-rea',
        code: 'FS-REA',
        name: 'React, TypeScript & Modern State Management',
        color: '#6366f1',
        description: 'Component lifecycles, custom hooks, TailwindCSS, Zustand/Redux, and client-side performance optimization.',
        teacher_name: 'Dan Abramov'
      },
      {
        id: 'sub-fs-nod',
        code: 'FS-NOD',
        name: 'Node.js, Express, PostgreSQL & Microservices',
        color: '#4f46e5',
        description: 'RESTful API architecture, JWT authentication, SQL migrations with Prisma ORM, and WebSocket real-time streams.',
        teacher_name: 'Dan Abramov'
      }
    ]
  },
  {
    id: 'track-cloud-devops',
    title: 'Cloud & DevOps Engineering',
    slug: 'cloud-devops',
    level: 'Advanced',
    price: 0,
    is_free: true,
    status: 'published',
    description: 'Enterprise container orchestration, Infrastructure as Code (Terraform), CI/CD pipelines, Docker, Kubernetes, and AWS/Azure cloud architecture.',
    enrolled_count: 31,
    subjects: [
      {
        id: 'sub-do-con',
        code: 'DO-CON',
        name: 'Linux Automation, Docker & Kubernetes Clusters',
        color: '#ec4899',
        description: 'Multi-stage Docker builds, Pods, Deployments, Services, Ingress controllers, and Helm charts.',
        teacher_name: 'Linus Torvalds'
      },
      {
        id: 'sub-do-cicd',
        code: 'DO-CICD',
        name: 'CI/CD Pipelines (GitHub Actions) & AWS Cloud Architecture',
        color: '#f43f5e',
        description: 'Automated test runners, Terraform provisioning, IAM policies, and cloud monitoring.',
        teacher_name: 'Linus Torvalds'
      }
    ]
  }
]

const INITIAL_SHARED_RESOURCES: SharedResource[] = [
  {
    id: 'res-1',
    course_id: 'track-python-genai',
    subject_code: 'PY-101',
    title: 'Python 3.12 OOP & Async Concurrency Cheat Sheet',
    type: 'pdf',
    url_or_content: 'https://docs.python.org/3/library/asyncio.html',
    shared_by: 'Dr. Sarah Connor',
    shared_at: '2026-10-02'
  },
  {
    id: 'res-2',
    course_id: 'track-python-genai',
    subject_code: 'GEN-201',
    title: 'LangGraph Multi-Agent Architecture Template (GitHub)',
    type: 'github',
    url_or_content: 'https://github.com/langchain-ai/langgraph',
    shared_by: 'Prof. Alan Turing',
    shared_at: '2026-10-03'
  },
  {
    id: 'res-3',
    course_id: 'track-salesforce-dev',
    subject_code: 'SF-LWC',
    title: 'Lightning Web Components (LWC) Component Boilerplates',
    type: 'code_snippet',
    url_or_content: 'https://developer.salesforce.com/docs/component-library/overview/components',
    shared_by: 'Marc Benioff',
    shared_at: '2026-10-01'
  }
]

export const CoursesPage: React.FC<CoursesPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<AdminInstituteCourse[]>(DEFAULT_TECH_TRACKS)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')
  const [activeCourseId, setActiveCourseId] = useState<string>(DEFAULT_TECH_TRACKS[0].id)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Shared Resources State
  const [sharedResources, setSharedResources] = useState<SharedResource[]>(() => {
    try {
      const saved = localStorage.getItem('acharya_shared_resources')
      return saved ? JSON.parse(saved) : INITIAL_SHARED_RESOURCES
    } catch {
      return INITIAL_SHARED_RESOURCES
    }
  })

  // Share Resource Modal State (Faculty / Teacher)
  const [showShareModal, setShowShareModal] = useState(false)
  const [targetSubjectCode, setTargetSubjectCode] = useState('')
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceType, setResourceType] = useState<SharedResource['type']>('pdf')
  const [resourceUrl, setResourceUrl] = useState('')

  const isTeacher = user.role === 'teacher'
  const isStudent = user.role === 'student'

  useEffect(() => {
    loadCourseData()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('acharya_shared_resources', JSON.stringify(sharedResources))
    } catch (e) {
      console.warn('Storage error:', e)
    }
  }, [sharedResources])

  const loadCourseData = async () => {
    try {
      setLoading(true)
      const [cList, eList] = await Promise.all([
        getAdminCourses().catch(() => []),
        getMyEnrollments().catch(() => []),
      ])
      if (cList && cList.length > 0) {
        setCourses(cList)
        if (!activeCourseId || !cList.some(c => c.id === activeCourseId)) {
          setActiveCourseId(cList[0].id)
        }
      } else {
        setCourses(DEFAULT_TECH_TRACKS)
      }
      setEnrollments(eList || [])
    } catch (err) {
      console.warn('Using default technical tracks:', err)
      setCourses(DEFAULT_TECH_TRACKS)
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
      showToast(err.message || 'Enrollment successful')
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

  const handleShareResourceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resourceTitle.trim() || !resourceUrl.trim() || !targetSubjectCode) return

    const newRes: SharedResource = {
      id: `res-${Date.now()}`,
      course_id: activeCourse?.id || 'track-python-genai',
      subject_code: targetSubjectCode,
      title: resourceTitle.trim(),
      type: resourceType,
      url_or_content: resourceUrl.trim(),
      shared_by: user.display_name || 'Faculty Instructor',
      shared_at: new Date().toISOString().split('T')[0]
    }

    setSharedResources(prev => [newRes, ...prev])
    showToast(`Shared "${resourceTitle}" with enrolled students!`)
    setShowShareModal(false)
    setResourceTitle('')
    setResourceUrl('')
  }

  const handleDeleteResource = (resourceId: string) => {
    setSharedResources(prev => prev.filter(r => r.id !== resourceId))
    showToast('Resource removed.')
  }

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase())) ||
      c.subjects.some(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
    const matchesLevel = selectedLevel === 'all' || c.level.toLowerCase() === selectedLevel.toLowerCase()
    return matchesSearch && matchesLevel
  })

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses[0] || DEFAULT_TECH_TRACKS[0]

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-bold shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-6 md:p-8 rounded-3xl border border-amber-500/30 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            {isTeacher ? 'Faculty Curriculum & Resource Center' : 'Technical Training Curriculum & Modules'}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {isTeacher ? 'Courses Handled & Technical Modules' : 'Professional Technology Tracks'}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-2xl">
            {isTeacher 
              ? 'Manage your assigned technical training tracks, view subject syllabi, and share lecture slides, lab manuals & code repositories with students.'
              : 'Explore industry-aligned curriculums in Python with Generative AI, Salesforce, ServiceNow, Full Stack Web, and Cloud DevOps.'}
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {isTeacher && (
            <button
              onClick={() => {
                if (activeCourse.subjects.length > 0) {
                  setTargetSubjectCode(activeCourse.subjects[0].code)
                }
                setShowShareModal(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-slate-950" />
              <span>Share Resources</span>
            </button>
          )}

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
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Enrolled
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-white">{c.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2">{c.description}</p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                      <span>{c.subjects.length} Subject Modules</span>
                      <span>{c.enrolled_count || 30} Enrolled Candidates</span>
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
                  {isStudent && (
                    isEnrolled(activeCourse.id) ? (
                      <span className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
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
                  {isTeacher && (
                    <button
                      onClick={() => {
                        if (activeCourse.subjects.length > 0) {
                          setTargetSubjectCode(activeCourse.subjects[0].code)
                        }
                        setShowShareModal(true)
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Material</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed">{activeCourse.description}</p>

              {/* Subject Modules List & Attached Shared Resources */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Subject Modules & Shared Learning Resources ({activeCourse.subjects.length})
                </h4>

                <div className="space-y-4">
                  {activeCourse.subjects.map((sub, idx) => {
                    const moduleResources = sharedResources.filter(
                      r => r.subject_code === sub.code || r.course_id === activeCourse.id
                    )

                    return (
                      <div
                        key={sub.id || idx}
                        className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="px-2.5 py-0.5 rounded text-[11px] font-mono font-extrabold uppercase"
                              style={{
                                backgroundColor: `${sub.color || '#f59e0b'}20`,
                                borderColor: `${sub.color || '#f59e0b'}40`,
                                borderWidth: '1px',
                                color: sub.color || '#f59e0b',
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

                        {/* Shared Resources section for this module */}
                        {moduleResources.length > 0 && (
                          <div className="pt-2 border-t border-slate-900 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                              Shared Class Materials & Lab Repositories:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {moduleResources.map((res) => (
                                <div
                                  key={res.id}
                                  className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/20 flex items-center justify-between gap-2 hover:border-amber-500/40 transition-all"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {res.type === 'github' ? (
                                      <GitBranch className="w-4 h-4 text-slate-300 shrink-0" />
                                    ) : res.type === 'code_snippet' ? (
                                      <Code className="w-4 h-4 text-cyan-400 shrink-0" />
                                    ) : (
                                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                                    )}
                                    <div className="truncate">
                                      <p className="text-[11px] font-bold text-slate-200 truncate">{res.title}</p>
                                      <p className="text-[9px] text-slate-500">{res.shared_by} &bull; {res.shared_at}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <a
                                      href={res.url_or_content}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition-colors"
                                      title="Open / Download Resource"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    {isTeacher && (
                                      <button
                                        onClick={() => handleDeleteResource(res.id)}
                                        className="p-1 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                        title="Remove resource"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Lab & Project Highlights */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <h5 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Hands-On Labs & Capstone Projects
                </h5>
                <p className="text-[11px] text-slate-400">
                  Every subject includes weekly coding exercises, live Zoom interactive workshops, automated grading assessments, and verified skill certification upon track completion.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: TEACHER SHARE RESOURCE TO STUDENTS ─────────────────────── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-[#06080F]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-amber-400" />
                Share Learning Resource with Students
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleShareResourceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Target Subject / Module
                </label>
                <select
                  value={targetSubjectCode}
                  onChange={(e) => setTargetSubjectCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {activeCourse.subjects.map((s) => (
                    <option key={s.code} value={s.code}>
                      [{s.code}] {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Resource Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Week 3 LangGraph Multi-Agent Architecture Guide"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Resource Type
                  </label>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="pdf">PDF Document / Slides</option>
                    <option value="github">GitHub Repository</option>
                    <option value="lab_manual">Lab Manual / Exercise</option>
                    <option value="code_snippet">Code Snippet / Gist</option>
                    <option value="notes">Lecture Notes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Shared By
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user.display_name || 'Faculty Member'}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Link / Document URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/... or https://drive.google.com/..."
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  Publish Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CoursesPage
