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
  Layers, 
  Plus, 
  RefreshCw, 
  Share2, 
  FileText, 
  ExternalLink, 
  X, 
  Sparkles, 
  Code2, 
  ShieldCheck,
  ArrowRight
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
  const [resourceType] = useState<SharedResource['type']>('github')
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

  const filteredStudentCourses = (studentEnrolledCourses.length > 0 ? studentEnrolledCourses : courses).filter((c) => {
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

  // Featured Course for Discovery
  const featuredCourse = isTeacher ? null : filteredStudentCourses[0] || courses[0] || null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── EDITORIAL DISCOVERY HEADER ── */}
      <div style={{
        padding: '36px 48px 24px',
        maxWidth: 1280,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20
      }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--saffron)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Sparkles style={{ width: 14, height: 14 }} />
            <span>Curriculum Architecture • Knowledge Graph</span>
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 32,
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 400,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15
          }}>
            {isTeacher ? 'Assigned teaching tracks' : 'Explore curriculum & roadmaps'}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-2)', maxWidth: 580, lineHeight: 1.5 }}>
            {isTeacher
              ? 'Subjects and technical modules allocated to your faculty profile. Manage lab tasks, syllabus milestones, and resources.'
              : 'Structured day-wise chapters, hands-on lab milestones, and verified skill achievements.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <button
              onClick={() => setCurrentTab?.('admin')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                background: 'var(--ink)',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              <ShieldCheck style={{ width: 15, height: 15 }} />
              <span>Arrange Curriculum</span>
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                background: 'var(--saffron)',
                color: 'var(--ink)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none'
              }}
            >
              <Share2 style={{ width: 15, height: 15 }} />
              <span>Share Resource</span>
            </button>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'white',
              border: '1px solid var(--border-med)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600
            }}
            title="Refresh Data"
          >
            <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH & LEVEL FILTERS ── */}
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '0 48px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'white',
          padding: '8px 16px',
          borderRadius: 12,
          border: '1px solid var(--border-med)',
          width: 360,
          maxWidth: '100%'
        }}>
          <Search style={{ width: 15, height: 15, color: 'var(--ink-3)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isTeacher ? "Search assigned subjects (e.g. PY-101, Apex)..." : "Search curriculum, subjects & tags..."}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--ink)',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((lvl) => {
            const isSelected = selectedLevel === lvl
            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--saffron)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--saffron-bg)' : 'white',
                  color: isSelected ? 'var(--saffron-d)' : 'var(--ink-2)',
                  transition: 'all 0.15s ease'
                }}
              >
                {lvl === 'ALL' ? 'All Levels' : lvl.toLowerCase()}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── FEATURED COURSE EDITORIAL CARD (Students & Admin) ── */}
      {!isTeacher && featuredCourse && !searchQuery && selectedLevel === 'ALL' && (
        <div style={{ maxWidth: 1280, margin: '0 auto 32px', padding: '0 48px' }}>
          <div style={{
            background: 'white',
            border: '1px solid var(--border-med)',
            borderRadius: 20,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)',
            boxShadow: '0 12px 36px -8px rgba(0, 0, 0, 0.06)'
          }}>
            {/* Left Content */}
            <div style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--saffron-d)',
                    background: 'var(--saffron-bg)',
                    padding: '3px 8px',
                    borderRadius: 6
                  }}>
                    Featured Track
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'var(--ink-3)',
                    background: 'var(--canvas-warm)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border)'
                  }}>
                    {featuredCourse.level}
                  </span>
                </div>

                <h2 style={{
                  margin: '0 0 10px',
                  fontSize: 26,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {featuredCourse.title}
                </h2>

                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 540 }}>
                  {featuredCourse.description}
                </p>

                {/* Subjects Pill Row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 18 }}>
                  {featuredCourse.subjects.map((s) => (
                    <span
                      key={s.id}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'var(--canvas-warm)',
                        border: '1px solid var(--border-med)',
                        color: 'var(--ink-1)'
                      }}
                    >
                      {s.code} • {s.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Progress & Action Bar */}
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 120, height: 6, borderRadius: 3, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ width: '68%', height: '100%', background: 'var(--saffron)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>68% Mastered</span>
                </div>

                <button
                  onClick={() => {
                    setActiveRoadmapCourse(featuredCourse)
                    setActiveSubjectFilter(null)
                    setRoadmapTab('syllabus')
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    borderRadius: 10,
                    background: 'var(--ink)',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                  }}
                >
                  <span>Continue Roadmap</span>
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>

            {/* Right Editorial Image */}
            <div style={{ position: 'relative', overflow: 'hidden', minHeight: 280 }}>
              <img
                src="/assets/classroom.jpg"
                alt={featuredCourse.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, rgba(255,255,255,0.4) 0%, transparent 40%)'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── COURSE LISTINGS / ROSTER ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px 64px' }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
            {isTeacher ? `My Teaching Modules (${filteredTeacherSubjects.length})` : `Your Enrolled Courses (${filteredStudentCourses.length})`}
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            <RefreshCw style={{ width: 20, height: 20, animation: 'spin 1s linear infinite', margin: '0 auto 8px', color: 'var(--saffron)' }} />
            <span>Loading courses and subjects...</span>
          </div>
        ) : isTeacher ? (
          /* ════ TEACHER VIEW: SUBJECTS LEDGER ════ */
          filteredTeacherSubjects.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
              <Layers style={{ width: 36, height: 36, color: 'var(--ink-3)', margin: '0 auto 12px', opacity: 0.6 }} />
              <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>No subjects assigned yet</h4>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)' }}>The administrator has not linked technical subjects to this instructor profile.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                    style={{
                      background: 'white',
                      border: '1px solid var(--border-med)',
                      borderRadius: 16,
                      padding: '20px 24px',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: 20
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: `${ts.color || '#3b82f6'}15`,
                          color: ts.color || '#2563eb',
                          border: `1px solid ${ts.color || '#3b82f6'}30`
                        }}>
                          {ts.code}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>
                          Track: {ts.course_title}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                        {ts.name}
                      </h4>

                      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 700 }}>
                        {ts.description || 'Master syllabus with practical code assignments and technical lab tasks.'}
                      </p>

                      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--ink-3)' }}>
                        <span>• {subTopics.length} Chapters / Days</span>
                        <span>• {subResources.length} Shared Resources</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        onClick={() => {
                          setActiveRoadmapCourse(ts.full_course_ref)
                          setActiveSubjectFilter(ts.code)
                          setRoadmapTab('syllabus')
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 10,
                          background: 'var(--canvas-warm)',
                          border: '1px solid var(--border-med)',
                          color: 'var(--ink)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Syllabus & Labs
                      </button>

                      <button
                        onClick={() => {
                          setResourceCourseId(ts.course_slug || ts.course_id)
                          setResourceSubjectCode(ts.code)
                          setShowShareModal(true)
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 10,
                          background: 'var(--saffron)',
                          color: 'var(--ink)',
                          fontSize: 12,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Share Resource
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* ════ STUDENT / ADMIN VIEW: COMPACT ROWS ════ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(isAdmin ? filteredAdminCourses : filteredStudentCourses).map((course) => {
              return (
                <div
                  key={course.id}
                  style={{
                    background: 'white',
                    border: '1px solid var(--border-med)',
                    borderRadius: 16,
                    padding: '22px 26px',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 24,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: 'var(--saffron-d)',
                        background: 'var(--saffron-bg)',
                        padding: '2px 8px',
                        borderRadius: 6
                      }}>
                        {course.level}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-3)' }}>
                        /{course.slug}
                      </span>
                    </div>

                    <h4 style={{
                      margin: '0 0 6px',
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--ink)',
                      fontFamily: "'Plus Jakarta Sans', sans-serif"
                    }}>
                      {course.title}
                    </h4>

                    <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 740 }}>
                      {course.description}
                    </p>

                    {/* Subjects overview */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {course.subjects.map((s) => (
                        <span
                          key={s.id}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'var(--canvas-warm)',
                            border: '1px solid var(--border)',
                            color: 'var(--ink-2)'
                          }}
                        >
                          {s.code} • {s.name} ({s.teacher_name || 'Faculty'})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setActiveRoadmapCourse(course)
                        setActiveSubjectFilter(null)
                        setRoadmapTab('syllabus')
                      }}
                      style={{
                        padding: '9px 18px',
                        borderRadius: 10,
                        background: 'var(--canvas-warm)',
                        border: '1px solid var(--border-med)',
                        color: 'var(--ink)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Sparkles style={{ width: 13, height: 13, color: 'var(--saffron)' }} />
                      <span>Roadmap & Labs</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => setCurrentTab?.('admin')}
                        style={{
                          padding: '9px 14px',
                          borderRadius: 10,
                          background: 'white',
                          border: '1px solid var(--border-med)',
                          color: 'var(--ink-2)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Arrange
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── ROADMAP & SYLLABUS DETAIL MODAL ── */}
      {activeRoadmapCourse && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'white',
            borderRadius: 20,
            maxWidth: 860,
            width: '100%',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.22)',
            border: '1px solid var(--border)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 32px',
              background: 'var(--canvas-warm)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--saffron-d)',
                    background: 'var(--saffron-bg)',
                    padding: '2px 8px',
                    borderRadius: 6
                  }}>
                    {activeRoadmapCourse.level}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-3)' }}>
                    /{activeRoadmapCourse.slug}
                  </span>
                  {activeSubjectFilter && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--ink)',
                      background: 'white',
                      padding: '2px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border-med)'
                    }}>
                      Filtered: {activeSubjectFilter}
                    </span>
                  )}
                </div>

                <h3 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Fraunces', Georgia, serif" }}>
                  {activeRoadmapCourse.title}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                  {activeRoadmapCourse.description}
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveRoadmapCourse(null)
                  setActiveSubjectFilter(null)
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div style={{
              padding: '12px 32px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setRoadmapTab('syllabus')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: roadmapTab === 'syllabus' ? '1px solid var(--saffron)' : '1px solid transparent',
                    background: roadmapTab === 'syllabus' ? 'var(--saffron-bg)' : 'transparent',
                    color: roadmapTab === 'syllabus' ? 'var(--saffron-d)' : 'var(--ink-3)'
                  }}
                >
                  Day-by-Day Syllabus & Labs
                </button>

                <button
                  onClick={() => setRoadmapTab('resources')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: roadmapTab === 'resources' ? '1px solid var(--saffron)' : '1px solid transparent',
                    background: roadmapTab === 'resources' ? 'var(--saffron-bg)' : 'transparent',
                    color: roadmapTab === 'resources' ? 'var(--saffron-d)' : 'var(--ink-3)'
                  }}
                >
                  Shared Resources ({(localResources[activeRoadmapCourse.slug || activeRoadmapCourse.id] || []).length})
                </button>
              </div>

              {isTeacher && roadmapTab === 'syllabus' && (
                <button
                  onClick={() => {
                    setTopicSubjectCode(activeSubjectFilter || activeRoadmapCourse.subjects[0]?.code || '')
                    setShowAddTopicModal(true)
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: 'var(--ink)',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Plus style={{ width: 13, height: 13 }} />
                  <span>Add Day Topic</span>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
              {roadmapTab === 'syllabus' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(() => {
                    const allTopics = localSyllabus[activeRoadmapCourse.slug || activeRoadmapCourse.id] || []
                    const filteredTopics = activeSubjectFilter
                      ? allTopics.filter((t) => !t.subject_code || t.subject_code === activeSubjectFilter)
                      : allTopics

                    if (filteredTopics.length === 0) {
                      return (
                        <p style={{ textAlign: 'center', padding: '36px 0', fontSize: 13, color: 'var(--ink-3)' }}>
                          No day-wise syllabus topics published yet for this selection.
                        </p>
                      )
                    }

                    return filteredTopics.map((day) => (
                      <div
                        key={day.day_number}
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          background: 'var(--canvas-warm)',
                          border: '1px solid var(--border)',
                          display: 'grid',
                          gridTemplateColumns: '48px minmax(0, 1fr)',
                          gap: 14,
                          alignItems: 'flex-start'
                        }}
                      >
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: 'white',
                          border: '1px solid var(--border-med)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                          color: 'var(--saffron-d)'
                        }}>
                          D{day.day_number}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{day.title}</span>
                            {day.subject_code && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'white', border: '1px solid var(--border-med)', fontFamily: 'monospace' }}>
                                {day.subject_code}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                            {day.description}
                          </p>
                          {day.lab_task && (
                            <div style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              background: 'var(--success-bg)',
                              border: '1px solid rgba(22, 163, 122, 0.25)',
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--success)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              <Code2 style={{ width: 13, height: 13 }} />
                              <span>Lab Milestone: {day.lab_task}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                /* Resources Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const resList = localResources[activeRoadmapCourse.slug || activeRoadmapCourse.id] || []
                    if (resList.length === 0) {
                      return (
                        <p style={{ textAlign: 'center', padding: '36px 0', fontSize: 13, color: 'var(--ink-3)' }}>
                          No shared documentation or GitHub repos uploaded yet.
                        </p>
                      )
                    }

                    return resList.map((res) => (
                      <div
                        key={res.id}
                        style={{
                          padding: 14,
                          borderRadius: 10,
                          background: 'white',
                          border: '1px solid var(--border-med)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 14
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <FileText style={{ width: 18, height: 18, color: 'var(--saffron)' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{res.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                              Shared by {res.shared_by} • {res.shared_at}
                            </div>
                          </div>
                        </div>

                        <a
                          href={res.url_or_content}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            background: 'var(--canvas-warm)',
                            border: '1px solid var(--border-med)',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--ink)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>Open</span>
                          <ExternalLink style={{ width: 12, height: 12 }} />
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

      {/* ── SHARE RESOURCE MODAL ── */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'white',
            borderRadius: 18,
            maxWidth: 500,
            width: '100%',
            padding: 28,
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Fraunces', Georgia, serif" }}>
                Share Subject Resource
              </h3>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSaveResource} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder="e.g. AsyncIO Coroutine Cheat Sheet"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-med)', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>
                  URL or Resource Link *
                </label>
                <input
                  type="url"
                  required
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-med)', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                >
                  Publish Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD DAY TOPIC MODAL ── */}
      {showAddTopicModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'white',
            borderRadius: 18,
            maxWidth: 500,
            width: '100%',
            padding: 28,
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Fraunces', Georgia, serif" }}>
                Add Roadmap Chapter
              </h3>
              <button onClick={() => setShowAddTopicModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleAddTopic} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>
                  Chapter Title *
                </label>
                <input
                  type="text"
                  required
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="e.g. LangGraph Multi-Agent Workflows"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-med)', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>
                  Description *
                </label>
                <textarea
                  required
                  value={topicDescription}
                  onChange={(e) => setTopicDescription(e.target.value)}
                  placeholder="Key theoretical concepts and learning outcomes..."
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-med)', fontSize: 12, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>
                  Lab Milestone Task
                </label>
                <input
                  type="text"
                  value={topicLabTask}
                  onChange={(e) => setTopicLabTask(e.target.value)}
                  placeholder="e.g. Construct cyclical multi-agent graph in Python"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-med)', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddTopicModal(false)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                >
                  Append Chapter
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
