import React, { useState, useEffect } from 'react'
import type { 
  User, 
  AdminInstituteCourse,
  Enrollment
} from '../lib/api'
import { 
  getAdminCourses, 
  getMyEnrollments,
} from '../lib/api'
import { 
  Search, 
  BookOpen, 
  Layers, 
  Plus, 
  RefreshCw, 
  Share2, 
  FileText, 
  ExternalLink, 
  X, 
  Sparkles, 
  Video, 
  Clock, 
  Users, 
  Code2, 
  Calendar,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react'

type CoursesPageProps = {
  user: User
  setCurrentTab?: (tab: string) => void
}

export interface DayTopic {
  day_number: number
  title: string
  subject_code?: string
  description?: string
  lab_task?: string
  completed?: boolean
}

export interface SharedResource {
  id: string
  course_id: string
  subject_code?: string
  title: string
  type: 'slides' | 'github' | 'lab_manual' | 'code_snippet' | 'pdf' | 'notes'
  url_or_content: string
  shared_by: string
  shared_at: string
}

const DEFAULT_SYLLABUS: Record<string, DayTopic[]> = {
  'python-genai': [
    { day_number: 1, subject_code: 'PY-101', title: 'Day 1: Type Hinting, Pydantic V2 & Data Validation Schemas', description: 'Advanced generic type checking, custom validators, and serialization pipelines.', lab_task: 'Implement strict API request/response models with nested schema validation.', completed: true },
    { day_number: 2, subject_code: 'PY-101', title: 'Day 2: AsyncIO, Event Loops & Concurrent Coroutines', description: 'Mastering async/await, TaskGroups, Semaphores, and high-concurrency event loops.', lab_task: 'Build an async worker pulling and processing 1,000 mock events in parallel.', completed: true },
    { day_number: 3, subject_code: 'PY-101', title: 'Day 3: Metaclasses, Class Decorators & Context Managers', description: 'Deep dive into Python runtime internals, dunder methods, and resource management.', lab_task: 'Write a custom timing & retry decorator with exponential backoff.', completed: true },
    { day_number: 4, subject_code: 'GEN-201', title: 'Day 4: Prompt Engineering, Structured JSON & System Prompts', description: 'Controlling LLM generation, JSON mode, few-shot prompting, and chain-of-thought reasoning.', lab_task: 'Create deterministic data extraction prompts using OpenAI & Gemini APIs.', completed: true },
    { day_number: 5, subject_code: 'GEN-201', title: 'Day 5: OpenAI & Gemini Function Calling & Tool Binding', description: 'Binding Python functions to LLMs for automated database lookups and calculation tools.', lab_task: 'Build a weather and stock ticker tool bound to Gemini 1.5 Pro.', completed: false },
    { day_number: 6, subject_code: 'RAG-301', title: 'Day 6: Document Ingestion, Recursive Chunking & Token Splitting', description: 'Parsing PDFs, Markdown, and tabular data with semantic boundary preservation.', lab_task: 'Ingest 50-page enterprise technical manual and create chunks.', completed: false },
    { day_number: 7, subject_code: 'RAG-301', title: 'Day 7: Vector DB Queries & Hybrid Search with ChromaDB', description: 'Indexing embeddings with HNSW, metadata filtering, and BM25 hybrid ranking.', lab_task: 'Implement ChromaDB vector collection with metadata filtering on departments.', completed: false },
    { day_number: 8, subject_code: 'AI-401', title: 'Day 8: LangGraph State Graphs, Nodes, Edges & Reducers', description: 'Constructing stateful computational agent graphs with checkpoint persistence.', lab_task: 'Build a two-node cyclical writer/reviewer agent graph.', completed: false },
  ],
  'salesforce-developer': [
    { day_number: 1, subject_code: 'SF-ADM', title: 'Day 1: Salesforce Architecture, Multi-Tenancy & Data Model', description: 'Standard vs Custom Objects, Schema Builder, Junction objects, and Master-Detail relationships.', lab_task: 'Build a custom Course & Enrollment relational schema in Salesforce Developer Org.', completed: true },
    { day_number: 2, subject_code: 'SF-ADM', title: 'Day 2: Profiles, Permission Sets, OWD & Sharing Rules', description: 'Role hierarchies, criteria-based sharing, record access debugging, and audit trails.', lab_task: 'Configure strict role-based access for Institute Advisors and Students.', completed: true },
    { day_number: 3, subject_code: 'SF-APEX', title: 'Day 3: Apex OOP Fundamentals, Collections & SOQL Queries', description: 'Lists, Sets, Maps, governor limits, SOQL relationship queries, and SOSL full-text searches.', lab_task: 'Write bulkified SOQL queries fetching accounts with active enrollments.', completed: false },
    { day_number: 4, subject_code: 'SF-APEX', title: 'Day 4: Apex Triggers & Trigger Handler Framework', description: 'Trigger context variables, preventing recursion, and domain logic segregation.', lab_task: 'Implement an Account duplicate validation trigger with custom exceptions.', completed: false },
    { day_number: 5, subject_code: 'SF-LWC', title: 'Day 5: Lightning Web Components (LWC) Architecture & Wire Adapters', description: 'Shadow DOM, reactivity, @api, @track, @wire service, and Lightning Data Service (LDS).', lab_task: 'Create an interactive student search LWC table with real-time filtering.', completed: false },
  ],
  'servicenow-csa-cad': [
    { day_number: 1, subject_code: 'SN-CSA', title: 'Day 1: ServiceNow Architecture, Lists, Forms & UI Policies', description: 'Tables, fields, sys_id, dictionary overrides, UI policies, and client-side data enforcement.', lab_task: 'Configure incident intake forms with dynamic mandatory field rules.', completed: true },
    { day_number: 2, subject_code: 'SN-CSA', title: 'Day 2: User Administration, Roles, Groups & ACL Security Rules', description: 'Security debugging, context rules, high-security plugins, and role inheritance.', lab_task: 'Implement row-level and field-level read/write ACLs for ServiceNow CAD engineers.', completed: true },
    { day_number: 3, subject_code: 'SN-SCRIPT', title: 'Day 3: Server Scripting, GlideRecord & Business Rules', description: 'Async vs Before vs After business rules, GlideRecord queries, and scratchpads.', lab_task: 'Write an After business rule auto-creating change tasks upon incident resolution.', completed: false },
    { day_number: 4, subject_code: 'SN-SCRIPT', title: 'Day 4: Script Includes, GlideAjax & Client Scripts', description: 'Class-based reusable Script Includes, asynchronous GlideAjax, and client controllers.', lab_task: 'Build a GlideAjax endpoint validating VIP customer status on incident creation.', completed: false },
  ],
  'full-stack-web': [
    { day_number: 1, subject_code: 'WEB-101', title: 'Day 1: Modern HTML5 Semantics & Tailwind CSS Design Systems', description: 'Semantic tags, responsive grid systems, flexbox layouts, and Tailwind design tokens.', lab_task: 'Build a fully responsive dark-mode portal dashboard layout.', completed: true },
    { day_number: 2, subject_code: 'JS-201', title: 'Day 2: React 19 State Architecture, Hooks & Context API', description: 'Component lifecycles, custom hooks, memoization, and global state management.', lab_task: 'Implement an end-to-end multi-step reactive wizard with optimistic updates.', completed: true },
    { day_number: 3, subject_code: 'BE-301', title: 'Day 3: FastAPI REST APIs, SQLAlchemy Async ORM & PostgreSQL', description: 'Async endpoints, Pydantic schemas, dependency injection, and Alembic migrations.', lab_task: 'Create authenticated REST endpoints for student enrollments and reviews.', completed: false },
  ],
  'cloud-devops-aws': [
    { day_number: 1, subject_code: 'DO-101', title: 'Day 1: Linux Administration, Bash Automation & Networking', description: 'File systems, permissions, systemd daemon management, SSH keys, and firewall routing.', lab_task: 'Write automated bash backup and server health check script.', completed: true },
    { day_number: 2, subject_code: 'DO-201', title: 'Day 2: Docker Multi-Stage Builds & Container Optimization', description: 'Layer caching, minimal base images (Alpine/Distroless), and Docker Compose networks.', lab_task: 'Containerize a React + FastAPI + Postgres stack into production-ready images.', completed: false },
    { day_number: 3, subject_code: 'DO-301', title: 'Day 3: AWS Architecture, EC2, RDS, S3 & GitHub Actions CI/CD', description: 'VPC subnets, IAM policies, automated test/lint/deploy pipelines to cloud containers.', lab_task: 'Deploy automated CI/CD pipeline triggered on master branch push.', completed: false },
  ]
}

const DEFAULT_RESOURCES: Record<string, SharedResource[]> = {
  'python-genai': [
    { id: 'res-py-1', course_id: 'python-genai', subject_code: 'PY-101', title: 'Python 3.12 Concurrency & AsyncIO Deep Dive (PDF)', type: 'pdf', url_or_content: 'https://docs.python.org/3/library/asyncio.html', shared_by: 'Dr. Sarah Connor', shared_at: '2026-10-01' },
    { id: 'res-py-2', course_id: 'python-genai', subject_code: 'GEN-201', title: 'LangChain LCEL & Multi-Agent Starter Code (GitHub)', type: 'github', url_or_content: 'https://github.com/langchain-ai/langchain', shared_by: 'Dr. Sarah Connor', shared_at: '2026-10-02' },
  ],
  'salesforce-developer': [
    { id: 'res-sf-1', course_id: 'salesforce-developer', subject_code: 'SF-APEX', title: 'Apex Enterprise Patterns & Trigger Architecture', type: 'slides', url_or_content: 'https://developer.salesforce.com/docs', shared_by: 'Prof. Alan Turing', shared_at: '2026-10-01' }
  ],
  'servicenow-csa-cad': [
    { id: 'res-sn-1', course_id: 'servicenow-csa-cad', subject_code: 'SN-SCRIPT', title: 'GlideRecord & Script Includes Best Practices Manual', type: 'lab_manual', url_or_content: 'https://developer.servicenow.com/', shared_by: 'Dr. Sarah Connor', shared_at: '2026-10-02' }
  ],
  'full-stack-web': [
    { id: 'res-web-1', course_id: 'full-stack-web', subject_code: 'JS-201', title: 'React 19 & Tailwind CSS Enterprise Boilerplate', type: 'github', url_or_content: 'https://github.com/facebook/react', shared_by: 'Prof. Alan Turing', shared_at: '2026-10-03' }
  ],
  'cloud-devops-aws': [
    { id: 'res-do-1', course_id: 'cloud-devops-aws', subject_code: 'DO-201', title: 'Kubernetes & Docker Multi-Stage Deployment Playbook', type: 'pdf', url_or_content: 'https://kubernetes.io/docs/', shared_by: 'System Admin', shared_at: '2026-10-01' }
  ]
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ user, setCurrentTab }) => {
  const isTeacher = user.role === 'teacher'
  const isAdmin = user.role === 'admin'
  const isStudent = user.role === 'student'

  const [courses, setCourses] = useState<AdminInstituteCourse[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL')

  // Roadmap & Syllabus Detail Modal State
  const [activeRoadmapCourse, setActiveRoadmapCourse] = useState<AdminInstituteCourse | null>(null)
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string | null>(null)
  const [roadmapTab, setRoadmapTab] = useState<'syllabus' | 'resources'>('syllabus')
  const [localSyllabus, setLocalSyllabus] = useState<Record<string, DayTopic[]>>(() => {
    const saved = localStorage.getItem('acharya_tech_syllabus_store')
    return saved ? JSON.parse(saved) : DEFAULT_SYLLABUS
  })
  const [localResources, setLocalResources] = useState<Record<string, SharedResource[]>>(() => {
    const saved = localStorage.getItem('acharya_tech_resources_store')
    return saved ? JSON.parse(saved) : DEFAULT_RESOURCES
  })

  // Share Resource Modal
  const [showShareModal, setShowShareModal] = useState(false)
  const [resourceCourseId, setResourceCourseId] = useState('')
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceType, setResourceType] = useState<SharedResource['type']>('github')
  const [resourceUrl, setResourceUrl] = useState('')
  const [resourceSubjectCode, setResourceSubjectCode] = useState('')

  // Add Day Topic Modal
  const [showAddTopicModal, setShowAddTopicModal] = useState(false)
  const [topicTitle, setTopicTitle] = useState('')
  const [topicSubjectCode, setTopicSubjectCode] = useState('')
  const [topicDescription, setTopicDescription] = useState('')
  const [topicLabTask, setTopicLabTask] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [coursesData, enrollmentsData] = await Promise.all([
        getAdminCourses().catch(() => []),
        getMyEnrollments().catch(() => []),
      ])
      setCourses(coursesData || [])
      setEnrollments(enrollmentsData || [])
    } catch (err) {
      console.error('Failed to load courses data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resourceCourseId || !resourceTitle || !resourceUrl) return

    const newRes: SharedResource = {
      id: `res_${Date.now()}`,
      course_id: resourceCourseId,
      subject_code: resourceSubjectCode || undefined,
      title: resourceTitle,
      type: resourceType,
      url_or_content: resourceUrl,
      shared_by: user.display_name,
      shared_at: new Date().toISOString().split('T')[0],
    }

    const updated = {
      ...localResources,
      [resourceCourseId]: [newRes, ...(localResources[resourceCourseId] || [])],
    }
    setLocalResources(updated)
    localStorage.setItem('acharya_tech_resources_store', JSON.stringify(updated))

    setShowShareModal(false)
    setResourceTitle('')
    setResourceUrl('')
    alert('Resource shared successfully with students!')
  }

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeRoadmapCourse || !topicTitle) return

    const key = activeRoadmapCourse.slug || activeRoadmapCourse.id
    const currentList = localSyllabus[key] || []
    const nextDayNum = currentList.length + 1

    const newTopic: DayTopic = {
      day_number: nextDayNum,
      title: `Day ${nextDayNum}: ${topicTitle}`,
      subject_code: topicSubjectCode || (activeRoadmapCourse.subjects[0]?.code ?? 'CORE'),
      description: topicDescription,
      lab_task: topicLabTask,
      completed: false,
    }

    const updated = {
      ...localSyllabus,
      [key]: [...currentList, newTopic],
    }
    setLocalSyllabus(updated)
    localStorage.setItem('acharya_tech_syllabus_store', JSON.stringify(updated))

    setShowAddTopicModal(false)
    setTopicTitle('')
    setTopicDescription('')
    setTopicLabTask('')
  }

  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id))

  // 1. TEACHER: Extract ONLY the subjects dealt by this teacher across all courses
  const teacherDealtSubjects = courses.flatMap((course) =>
    course.subjects
      .filter(
        (sub) =>
          sub.teacher_id === user.id ||
          (sub.teacher_name && user.display_name && sub.teacher_name.toLowerCase() === user.display_name.toLowerCase())
      )
      .map((sub) => ({
        ...sub,
        course_id: course.id,
        course_title: course.title,
        course_slug: course.slug,
        course_level: course.level,
        course_description: course.description,
        full_course_ref: course,
      }))
  )

  const filteredTeacherSubjects = teacherDealtSubjects.filter((ts) => {
    const matchesSearch =
      ts.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ts.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ts.course_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ts.description || '').toLowerCase().includes(searchQuery.toLowerCase())

    const matchesLevel =
      selectedLevel === 'ALL' || ts.course_level.toLowerCase() === selectedLevel.toLowerCase()

    return matchesSearch && matchesLevel
  })

  // 2. STUDENT: Show ONLY courses where student is enrolled by Admin
  const studentEnrolledCourses = courses.filter((c) => enrolledCourseIds.has(c.id))

  const filteredStudentCourses = studentEnrolledCourses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subjects.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesLevel =
      selectedLevel === 'ALL' || c.level.toLowerCase() === selectedLevel.toLowerCase()

    return matchesSearch && matchesLevel
  })

  // 3. ADMIN: Show all courses and subjects with arrangement tools
  const filteredAdminCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subjects.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesLevel =
      selectedLevel === 'ALL' || c.level.toLowerCase() === selectedLevel.toLowerCase()

    return matchesSearch && matchesLevel
  })

  // Page Header Text
  const pageTitle = isTeacher
    ? 'My Assigned Subjects & Teaching Curriculum'
    : isStudent
    ? 'My Enrolled Technical Courses & Subjects'
    : 'Institute Course Catalog & Subject Architecture'

  const pageSubtitle = isTeacher
    ? 'Subjects and technical classes assigned to you by the institute administrator. View day-wise syllabus, practical labs, and share resources with your enrolled batches.'
    : isStudent
    ? 'Technical curriculum and subjects assigned to your enrollment by the administrator. Track day-wise chapters, hands-on lab sprints, and study materials.'
    : 'Master technical curriculum directory. Arrange courses with respective subjects, assign faculty mentors, and manage candidate enrollments.'

  return (
    <div className="w-full min-h-screen px-4 lg:px-8 py-6 space-y-6">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-amber-500/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {isTeacher ? <Layers className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">{pageTitle}</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
            {pageSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => setCurrentTab?.('admin')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Arrange Courses & Assign Teachers</span>
            </button>
          )}

          {isTeacher && teacherDealtSubjects.length > 0 && (
            <button
              onClick={() => {
                const firstSub = teacherDealtSubjects[0]
                setResourceCourseId(firstSub.course_slug || firstSub.course_id)
                setResourceSubjectCode(firstSub.code)
                setShowShareModal(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Subject Resource</span>
            </button>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Refresh Curriculum"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0B0F19] p-3 rounded-2xl border border-amber-500/15">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isTeacher
                ? "Search assigned subjects (e.g. PY-101, Apex, React)..."
                : "Search courses & modules..."
            }
            className="w-full bg-[#111726] text-white text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedLevel === lvl
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {lvl === 'ALL' ? 'All Levels' : lvl.charAt(0) + lvl.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Loading Technical Curriculum...</p>
        </div>
      ) : isTeacher ? (
        /* ═════════════════════════════════════════════════════════════════════════
           1. TEACHER VIEW: STRICTLY ONLY SUBJECTS DEALT BY THIS TEACHER
           ═════════════════════════════════════════════════════════════════════════ */
        filteredTeacherSubjects.length === 0 ? (
          <div className="bg-[#0B0F19] border border-amber-500/15 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-xl">
            <Layers className="w-12 h-12 text-amber-500/40 mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-white mb-1">No Subjects Assigned Yet</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You currently have no teaching subjects allocated to your faculty profile. The institute administrator arranges courses with respective subjects and assigns teachers. Please contact the administrator.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>My Dealt Subject Classes ({filteredTeacherSubjects.length})</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeacherSubjects.map((ts) => {
                const subTopics = (localSyllabus[ts.course_slug] || []).filter(
                  (top) => !top.subject_code || top.subject_code === ts.code
                )
                const subResources = (localResources[ts.course_slug] || []).filter(
                  (res) => !res.subject_code || res.subject_code === ts.code
                )

                return (
                  <div
                    key={ts.id}
                    className="bg-[#0B0F19] rounded-2xl border border-amber-500/15 hover:border-amber-500/35 transition-all p-5 flex flex-col justify-between shadow-xl group hover:-translate-y-1 duration-200"
                  >
                    <div className="space-y-3">
                      {/* Badge Header: Subject Code & Course Track */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border"
                          style={{
                            backgroundColor: `${ts.color || '#3b82f6'}20`,
                            borderColor: `${ts.color || '#3b82f6'}50`,
                            color: ts.color || '#3b82f6',
                          }}
                        >
                          {ts.code}
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800/90 text-amber-300 border border-slate-700/60 truncate max-w-[180px]">
                          {ts.course_title}
                        </span>
                      </div>

                      {/* Subject Name */}
                      <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors leading-snug">
                        {ts.name}
                      </h3>

                      {/* Subject Description */}
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {ts.description || 'Comprehensive modular curriculum covering hands-on coding, live architecture labs, and doubt resolution.'}
                      </p>

                      {/* Subject Quick Meta */}
                      <div className="p-3 bg-[#111726] rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Faculty Instructor:</span>
                          <span className="font-bold text-amber-400">{user.display_name}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Day Topics & Labs:</span>
                          <span className="font-semibold text-slate-200">{subTopics.length} Chapters</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Shared Resources:</span>
                          <span className="font-semibold text-slate-200">{subResources.length} Uploaded</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveRoadmapCourse(ts.full_course_ref)
                            setActiveSubjectFilter(ts.code)
                            setRoadmapTab('syllabus')
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Syllabus & Labs</span>
                        </button>

                        <button
                          onClick={() => {
                            setResourceCourseId(ts.course_slug || ts.course_id)
                            setResourceSubjectCode(ts.code)
                            setShowShareModal(true)
                          }}
                          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 hover:text-amber-300 transition-all cursor-pointer"
                          title="Share Resource for this subject"
                        >
                          <Share2 className="w-4 h-4 text-amber-400" />
                        </button>

                        <button
                          onClick={() => setCurrentTab?.('classroom')}
                          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 hover:text-white transition-all cursor-pointer"
                          title="Launch Classroom Session"
                        >
                          <Video className="w-4 h-4 text-amber-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : isStudent ? (
        /* ═════════════════════════════════════════════════════════════════════════
           2. STUDENT VIEW: SHOW ONLY COURSES ENROLLED BY ADMIN
           ═════════════════════════════════════════════════════════════════════════ */
        filteredStudentCourses.length === 0 ? (
          <div className="bg-[#0B0F19] border border-amber-500/15 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-xl">
            <BookOpen className="w-12 h-12 text-amber-500/40 mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-white mb-1">No Course Enrolled Yet</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Students are enrolled in courses directly by the institute administrator only. Once the administrator assigns your course, all respective subject classes, syllabus roadmaps, and classroom schedules will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudentCourses.map((course) => {
              const levelColor =
                course.level === 'beginner'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : course.level === 'intermediate'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'

              return (
                <div
                  key={course.id}
                  className="bg-[#0B0F19] rounded-2xl border border-amber-500/15 hover:border-amber-500/35 transition-all p-5 flex flex-col justify-between shadow-xl group hover:-translate-y-1 duration-200"
                >
                  <div>
                    {/* Card Header: Level & Enrolled Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${levelColor}`}>
                        {course.level}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Enrolled by Admin</span>
                      </span>
                    </div>

                    {/* Course Title & Description */}
                    <h3 className="text-base font-extrabold text-white mb-2 group-hover:text-amber-300 transition-colors leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {course.description || 'Comprehensive industry-aligned curriculum covering core fundamentals and advanced production architecture.'}
                    </p>

                    {/* Assigned Subjects in this Course */}
                    <div className="space-y-1.5 mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        <span>Assigned Subjects in this Track ({course.subjects.length})</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {course.subjects.map((sub) => (
                          <span
                            key={sub.id}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#111726] text-slate-300 border border-slate-800 flex items-center gap-1"
                            title={`${sub.code}: ${sub.name} (Faculty: ${sub.teacher_name || 'Assigned Mentor'})`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sub.color || '#F59E0B' }} />
                            <span className="font-bold text-amber-400">{sub.code}</span>
                            <span className="text-slate-400 truncate max-w-[120px]">{sub.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        {course.subjects.length} Subject Classes
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {course.subjects.length * 15} Training Hours
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveRoadmapCourse(course)
                          setActiveSubjectFilter(null)
                          setRoadmapTab('syllabus')
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Syllabus & Roadmap</span>
                      </button>

                      <button
                        onClick={() => setCurrentTab?.('classroom')}
                        className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 hover:text-white transition-all cursor-pointer"
                        title="Launch Classroom Session"
                      >
                        <Video className="w-4 h-4 text-amber-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* ═════════════════════════════════════════════════════════════════════════
           3. ADMIN VIEW: FULL COURSE & SUBJECT DIRECTORY WITH ARRANGE ACCESS
           ═════════════════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAdminCourses.map((course) => {
            const levelColor =
              course.level === 'beginner'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : course.level === 'intermediate'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'

            return (
              <div
                key={course.id}
                className="bg-[#0B0F19] rounded-2xl border border-amber-500/15 hover:border-amber-500/35 transition-all p-5 flex flex-col justify-between shadow-xl group hover:-translate-y-1 duration-200"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${levelColor}`}>
                      {course.level}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {course.enrolled_count} Enrolled
                    </span>
                  </div>

                  {/* Course Title & Description */}
                  <h3 className="text-base font-extrabold text-white mb-2 group-hover:text-amber-300 transition-colors leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {course.description || 'Comprehensive industry-aligned curriculum covering core fundamentals and advanced production architecture.'}
                  </p>

                  {/* Parallel Subjects with Assigned Faculty */}
                  <div className="space-y-2 mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>Subjects & Assigned Faculty ({course.subjects.length})</span>
                    </p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {course.subjects.map((sub) => (
                        <div
                          key={sub.id}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] bg-[#111726] border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color || '#F59E0B' }} />
                            <span className="font-mono font-bold text-amber-300 shrink-0">{sub.code}</span>
                            <span className="text-slate-300 truncate">{sub.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                            {sub.teacher_name || 'Unassigned'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-4 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveRoadmapCourse(course)
                        setActiveSubjectFilter(null)
                        setRoadmapTab('syllabus')
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Syllabus & Roadmap</span>
                    </button>

                    <button
                      onClick={() => setCurrentTab?.('admin')}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                      title="Edit in Admin Panel"
                    >
                      <span>Arrange</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Curriculum & Roadmap Modal ── */}
      {activeRoadmapCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-[#06080F] border-b border-amber-500/15 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {activeRoadmapCourse.level}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">Track: /{activeRoadmapCourse.slug}</span>
                  {activeSubjectFilter && (
                    <span className="text-xs text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Subject: {activeSubjectFilter}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">{activeRoadmapCourse.title}</h2>
                <p className="text-xs text-slate-400 mt-1">{activeRoadmapCourse.description}</p>
              </div>

              <button
                onClick={() => {
                  setActiveRoadmapCourse(null)
                  setActiveSubjectFilter(null)
                }}
                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center justify-between px-6 py-3 bg-[#0B0F19] border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRoadmapTab('syllabus')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    roadmapTab === 'syllabus'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Day-by-Day Syllabus & Labs</span>
                </button>

                <button
                  onClick={() => setRoadmapTab('resources')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    roadmapTab === 'resources'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Shared Resources ({(localResources[activeRoadmapCourse.slug || activeRoadmapCourse.id] || []).length})</span>
                </button>
              </div>

              {isTeacher && roadmapTab === 'syllabus' && (
                <button
                  onClick={() => {
                    setTopicSubjectCode(activeSubjectFilter || activeRoadmapCourse.subjects[0]?.code || '')
                    setShowAddTopicModal(true)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Day Topic</span>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {roadmapTab === 'syllabus' ? (
                <div className="space-y-3">
                  {(() => {
                    const allTopics = localSyllabus[activeRoadmapCourse.slug || activeRoadmapCourse.id] || []
                    const filteredTopics = activeSubjectFilter
                      ? allTopics.filter((t) => !t.subject_code || t.subject_code === activeSubjectFilter)
                      : allTopics

                    if (filteredTopics.length === 0) {
                      return (
                        <div className="text-center py-12 text-slate-400">
                          <p className="text-xs">No day-wise roadmap topics added yet for this subject.</p>
                        </div>
                      )
                    }

                    return filteredTopics.map((day) => (
                      <div
                        key={day.day_number}
                        className="p-4 rounded-xl bg-[#111726] border border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-xs shrink-0">
                            D{day.day_number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-extrabold text-white">{day.title}</span>
                              {day.subject_code && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700 font-mono">
                                  {day.subject_code}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{day.description}</p>
                            {day.lab_task && (
                              <div className="mt-2 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                                <Code2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Lab Task: {day.lab_task}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {day.completed && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 self-start">
                            ✓ Completed
                          </span>
                        )}
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const allRes = localResources[activeRoadmapCourse.slug || activeRoadmapCourse.id] || []
                    const filteredRes = activeSubjectFilter
                      ? allRes.filter((r) => !r.subject_code || r.subject_code === activeSubjectFilter)
                      : allRes

                    if (filteredRes.length === 0) {
                      return (
                        <div className="text-center py-12 text-slate-400">
                          <p className="text-xs">No shared resources uploaded yet for this subject.</p>
                        </div>
                      )
                    }

                    return filteredRes.map((res) => (
                      <div
                        key={res.id}
                        className="p-4 rounded-xl bg-[#111726] border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{res.title}</p>
                            <p className="text-[10px] text-slate-400">
                              Shared by <span className="text-amber-400">{res.shared_by}</span> • {res.shared_at}
                              {res.subject_code && (
                                <span className="ml-2 font-mono text-amber-300 font-bold px-1 rounded bg-slate-900 border border-slate-800">
                                  {res.subject_code}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <a
                          href={res.url_or_content}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1 transition-all shrink-0"
                        >
                          <span>Open Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Share Resource Modal ── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" />
                Share Subject Resource
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveResource} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Target Course Track</label>
                <select
                  value={resourceCourseId}
                  onChange={(e) => setResourceCourseId(e.target.value)}
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.slug || c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Subject Code</label>
                <input
                  type="text"
                  value={resourceSubjectCode}
                  onChange={(e) => setResourceSubjectCode(e.target.value)}
                  placeholder="e.g. PY-101"
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Resource Title *</label>
                <input
                  type="text"
                  required
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder="e.g. LangChain LCEL & Function Calling Cheat Sheet"
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Resource Type</label>
                <select
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value as any)}
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="github">GitHub Repository / Code Link</option>
                  <option value="pdf">PDF Document / Lab Manual</option>
                  <option value="slides">Presentation Slides</option>
                  <option value="code_snippet">Code Snippet / Gist</option>
                  <option value="notes">Lecture Notes</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">URL / Link *</label>
                <input
                  type="url"
                  required
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://github.com/... or https://docs..."
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all cursor-pointer"
                >
                  Share With Students
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Day Topic Modal ── */}
      {showAddTopicModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Add Syllabus Day Topic
              </h3>
              <button onClick={() => setShowAddTopicModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTopic} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Topic Title *</label>
                <input
                  type="text"
                  required
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="e.g. AsyncIO Coroutines & TaskGroups"
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Subject Code</label>
                <input
                  type="text"
                  value={topicSubjectCode}
                  onChange={(e) => setTopicSubjectCode(e.target.value)}
                  placeholder="e.g. PY-101"
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Description</label>
                <textarea
                  value={topicDescription}
                  onChange={(e) => setTopicDescription(e.target.value)}
                  placeholder="Summary of concepts covered..."
                  rows={2}
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Hands-on Lab Task</label>
                <input
                  type="text"
                  value={topicLabTask}
                  onChange={(e) => setTopicLabTask(e.target.value)}
                  placeholder="e.g. Build an async rate-limited HTTP client"
                  className="w-full bg-[#111726] border border-slate-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all cursor-pointer"
                >
                  Save Day Topic
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
