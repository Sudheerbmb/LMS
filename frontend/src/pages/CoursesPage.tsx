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
  FolderOpen,
  Calendar,
  Milestone,
  Flag
} from 'lucide-react'

type CoursesPageProps = {
  user: User
}

export interface DayTopic {
  day_number: number
  title: string
  description?: string
  completed?: boolean
}

export interface WeekendMilestone {
  id: string
  week_label: string
  title: string
  deliverable: string
  status: 'scheduled' | 'in_progress' | 'completed'
  due_date: string
  days: DayTopic[]
  resources: SharedResource[]
}

export interface SharedResource {
  id: string
  course_id: string
  subject_code?: string
  milestone_id?: string
  title: string
  type: 'slides' | 'github' | 'lab_manual' | 'code_snippet' | 'pdf' | 'notes'
  url_or_content: string
  shared_by: string
  shared_at: string
}

const DEFAULT_ROADMAPS: Record<string, WeekendMilestone[]> = {
  'track-python-genai': [
    {
      id: 'ms-py-1',
      week_label: 'Week 1 - 2',
      title: 'Python 3.12 Core & Advanced OOP Concurrency',
      deliverable: 'Build High-Performance Async Task Processing Engine',
      status: 'completed',
      due_date: 'Weekend 2',
      days: [
        { day_number: 1, title: 'Day 1: Type Hinting, Pydantic V2 & Data Validation', description: 'Advanced schema validation and serialization', completed: true },
        { day_number: 2, title: 'Day 2: AsyncIO, Event Loops & Concurrent Coroutines', description: 'High-speed async network requests and tasks', completed: true },
        { day_number: 3, title: 'Day 3: Custom Metaclasses, Decorators & Generators', description: 'Metaprogramming patterns in production Python', completed: true },
        { day_number: 4, title: 'Day 4: Memory Profiling & Performance Tuning', description: 'Optimizing memory footprint and garbage collection', completed: true },
      ],
      resources: [
        { id: 'res-py-1', course_id: 'track-python-genai', milestone_id: 'ms-py-1', title: 'Python 3.12 AsyncIO Architecture Guide (PDF)', type: 'pdf', url_or_content: 'https://docs.python.org/3/library/asyncio.html', shared_by: 'Dr. Sarah Connor', shared_at: '2026-10-01' },
        { id: 'res-py-2', course_id: 'track-python-genai', milestone_id: 'ms-py-1', title: 'Concurrent Engine Starter Template (GitHub)', type: 'github', url_or_content: 'https://github.com/python/cpython', shared_by: 'Dr. Sarah Connor', shared_at: '2026-10-02' }
      ]
    },
    {
      id: 'ms-py-2',
      week_label: 'Week 3 - 4',
      title: 'Prompt Engineering, LLMs & LangChain 0.3',
      deliverable: 'Autonomous Tool-Calling LLM Service with Streaming',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: [
        { day_number: 5, title: 'Day 5: Tokenization, System Prompts & Few-Shot Prompting', description: 'Mastering temperature, top_p, and JSON mode', completed: true },
        { day_number: 6, title: 'Day 6: OpenAI & Gemini Function Calling & Tool Binding', description: 'Invoking external python tools and database query functions', completed: true },
        { day_number: 7, title: 'Day 7: LangChain LCEL (Expression Language) Pipelines', description: 'Composing deterministic chains, fallbacks, and runnables', completed: false },
        { day_number: 8, title: 'Day 8: Conversation History & Memory Retention Strategies', description: 'Zep, Redis, and sliding window chat buffers', completed: false },
      ],
      resources: [
        { id: 'res-py-3', course_id: 'track-python-genai', milestone_id: 'ms-py-2', title: 'LangChain LCEL Cheat Sheet & Patterns', type: 'code_snippet', url_or_content: 'https://python.langchain.com/docs/concepts/lcel/', shared_by: 'Prof. Alan Turing', shared_at: '2026-10-03' }
      ]
    },
    {
      id: 'ms-py-3',
      week_label: 'Week 5 - 6',
      title: 'Enterprise RAG Architecture & Vector DBs',
      deliverable: 'Production Multi-Document RAG Search with ChromaDB/Pinecone',
      status: 'scheduled',
      due_date: 'Weekend 6',
      days: [
        { day_number: 9, title: 'Day 9: Recursive Document Chunking & Text Splitting', description: 'Semantic chunking for complex PDFs, code, and markdown', completed: false },
        { day_number: 10, title: 'Day 10: Sentence Transformers & Embedding Generation', description: 'Dense embeddings vs Sparse BM25 indexing', completed: false },
        { day_number: 11, title: 'Day 11: Vector DB Queries & Hybrid Search with ChromaDB', description: 'Metadata filtering, cosine similarity, and MMR rerank', completed: false },
        { day_number: 12, title: 'Day 12: Cross-Encoder Re-Ranking & Evaluation Metrics', description: 'Ragas evaluation framework and context recall testing', completed: false },
      ],
      resources: [
        { id: 'res-py-4', course_id: 'track-python-genai', milestone_id: 'ms-py-3', title: 'ChromaDB Vector Indexing Lab Exercise', type: 'lab_manual', url_or_content: 'https://docs.trychroma.com/', shared_by: 'Prof. Alan Turing', shared_at: '2026-10-03' }
      ]
    },
    {
      id: 'ms-py-4',
      week_label: 'Week 7 - 8',
      title: 'Multi-Agent Workflows with LangGraph',
      deliverable: 'Multi-Agent Supervisor System with Human-in-the-Loop',
      status: 'scheduled',
      due_date: 'Weekend 8',
      days: [
        { day_number: 13, title: 'Day 13: State Graphs, Nodes, Edges & Reducers', description: 'Constructing stateful computational agent graphs', completed: false },
        { day_number: 14, title: 'Day 14: Multi-Agent Collaboration & Supervisor Routing', description: 'Orchestrating specialized researcher, coder, and critic agents', completed: false },
        { day_number: 15, title: 'Day 15: Human-in-the-Loop Interrupts & State Checkpoints', description: 'Approving sensitive operations with persistent thread storage', completed: false },
      ],
      resources: [
        { id: 'res-py-5', course_id: 'track-python-genai', milestone_id: 'ms-py-4', title: 'LangGraph Supervisor Architecture Repo (GitHub)', type: 'github', url_or_content: 'https://github.com/langchain-ai/langgraph', shared_by: 'Prof. Alan Turing', shared_at: '2026-10-03' }
      ]
    },
    {
      id: 'ms-py-5',
      week_label: 'Week 9 - 10',
      title: 'FastAPI Production Deployment & Capstone',
      deliverable: 'Final Capstone Project & Certified Developer Portfolio',
      status: 'scheduled',
      due_date: 'Weekend 10',
      days: [
        { day_number: 16, title: 'Day 16: Async FastAPI Endpoints & Streaming SSE', description: 'Building low-latency agent streaming APIs with JWT auth', completed: false },
        { day_number: 17, title: 'Day 17: Docker Containerization & Cloud Deployment', description: 'Multi-stage Docker builds and cloud deployment', completed: false },
        { day_number: 18, title: 'Day 18: Final Capstone Demo & Certificate Evaluation', description: 'Live project defense and industry review', completed: false },
      ],
      resources: []
    }
  ],
  'track-salesforce-dev': [
    {
      id: 'ms-sf-1',
      week_label: 'Week 1 - 3',
      title: 'Salesforce Admin Essentials, Security & Flow Builder',
      deliverable: 'Configured Enterprise Org with Complex Flow Automation',
      status: 'completed',
      due_date: 'Weekend 3',
      days: [
        { day_number: 1, title: 'Day 1: Custom Objects, Master-Detail & Schema Builder', completed: true },
        { day_number: 2, title: 'Day 2: Profiles, Permission Sets & Record-Level Security', completed: true },
        { day_number: 3, title: 'Day 3: Screen Flows, Record-Triggered Flows & Invocables', completed: true }
      ],
      resources: []
    },
    {
      id: 'ms-sf-2',
      week_label: 'Week 4 - 7',
      title: 'Apex OOP, Triggers & SOQL Database Operations',
      deliverable: 'One-Trigger-Per-Object Architecture with 90%+ Test Coverage',
      status: 'in_progress',
      due_date: 'Weekend 7',
      days: [
        { day_number: 4, title: 'Day 4: Apex Syntax, Collections & Governor Limits', completed: true },
        { day_number: 5, title: 'Day 5: Trigger Handler Frameworks & Context Variables', completed: false },
        { day_number: 6, title: 'Day 6: SOQL/SOSL Queries, Aggregates & Database Methods', completed: false }
      ],
      resources: []
    },
    {
      id: 'ms-sf-3',
      week_label: 'Week 8 - 10',
      title: 'Lightning Web Components (LWC) & Event Architecture',
      deliverable: 'Custom Interactive LWC Application Deployed to Lightning App Builder',
      status: 'scheduled',
      due_date: 'Weekend 10',
      days: [
        { day_number: 7, title: 'Day 7: Modern JavaScript ES6+, Shadow DOM & Component Lifecycle', completed: false },
        { day_number: 8, title: 'Day 8: Wire Service, Apex Integration & LMS Pub/Sub', completed: false },
        { day_number: 9, title: 'Day 9: Lightning Data Service & Modal Components', completed: false }
      ],
      resources: []
    }
  ],
  'track-servicenow': [
    {
      id: 'ms-sn-1',
      week_label: 'Week 1 - 4',
      title: 'ServiceNow Platform Administration & ITSM Core',
      deliverable: 'Complete ITSM Service Desk Configuration with SLA Engine',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: [
        { day_number: 1, title: 'Day 1: Users, Roles, Groups & CMDB Architecture', completed: true },
        { day_number: 2, title: 'Day 2: Incident, Problem & Change Management Lifecycles', completed: true },
        { day_number: 3, title: 'Day 3: UI Policies, Data Policies & Dictionary Overrides', completed: false }
      ],
      resources: []
    },
    {
      id: 'ms-sn-2',
      week_label: 'Week 5 - 8',
      title: 'Flow Designer Automation & Business Rules',
      deliverable: 'Automated Service Catalog Workflow with Custom Spokes',
      status: 'scheduled',
      due_date: 'Weekend 8',
      days: [
        { day_number: 4, title: 'Day 4: Server-Side Scripting with GlideRecord & GlideSystem', completed: false },
        { day_number: 5, title: 'Day 5: Client Scripts, GlideAjax & UI Actions', completed: false },
        { day_number: 6, title: 'Day 6: Flow Designer Subflows & Integration Hub', completed: false }
      ],
      resources: []
    }
  ],
  'track-fullstack-web': [
    {
      id: 'ms-fs-1',
      week_label: 'Week 1 - 4',
      title: 'React 19, Modern TypeScript & State Management',
      deliverable: 'Full-Featured Responsive Web Application with TailwindCSS',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: [
        { day_number: 1, title: 'Day 1: TypeScript Interfaces, Generics & React Hooks', completed: true },
        { day_number: 2, title: 'Day 2: TailwindCSS Layouts, Glassmorphism & Animations', completed: true },
        { day_number: 3, title: 'Day 3: Global State Management with Zustand & React Query', completed: false }
      ],
      resources: []
    },
    {
      id: 'ms-fs-2',
      week_label: 'Week 5 - 8',
      title: 'Node.js, FastAPI & PostgreSQL Microservices',
      deliverable: 'Scalable REST API Backend with JWT & WebSocket Support',
      status: 'scheduled',
      due_date: 'Weekend 8',
      days: [
        { day_number: 4, title: 'Day 4: API Architecture, Middleware & Error Handling', completed: false },
        { day_number: 5, title: 'Day 5: SQLAlchemy / Prisma ORM & Database Migrations', completed: false },
        { day_number: 6, title: 'Day 6: Real-time WebSockets & Background Job Queues', completed: false }
      ],
      resources: []
    }
  ],
  'track-cloud-devops': [
    {
      id: 'ms-do-1',
      week_label: 'Week 1 - 4',
      title: 'Linux Automation, Docker & Multi-Stage Containers',
      deliverable: 'Hardened Containerized Microservice Suite',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: [
        { day_number: 1, title: 'Day 1: Linux Administration, Bash Scripting & SSH Keys', completed: true },
        { day_number: 2, title: 'Day 2: Dockerfile Optimization & Multi-Stage Builds', completed: true },
        { day_number: 3, title: 'Day 3: Docker Compose Networking & Volume Persistence', completed: false }
      ],
      resources: []
    },
    {
      id: 'ms-do-2',
      week_label: 'Week 5 - 8',
      title: 'Kubernetes Cluster Orchestration & Helm Charts',
      deliverable: 'Production Kubernetes Cluster with Ingress & Auto-Scaling',
      status: 'scheduled',
      due_date: 'Weekend 8',
      days: [
        { day_number: 4, title: 'Day 4: Pods, Deployments, ReplicaSets & Services', completed: false },
        { day_number: 5, title: 'Day 5: Ingress Nginx, TLS Certificates & ConfigMaps', completed: false },
        { day_number: 6, title: 'Day 6: Helm Packaging & CI/CD with GitHub Actions', completed: false }
      ],
      resources: []
    }
  ]
}

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
      { id: 'sub-py-101', code: 'PY-101', name: 'Python Core & Advanced Object-Oriented Programming', color: '#3b82f6', description: 'Advanced data structures, functional paradigms, OOP, decorators, generators, and async programming.', teacher_name: 'Dr. Sarah Connor' },
      { id: 'sub-gen-201', code: 'GEN-201', name: 'Prompt Engineering, LLMs & LangChain Framework', color: '#8b5cf6', description: 'Tokenization, system prompts, Few-shot prompting, LangChain chains, tools, and structured outputs.', teacher_name: 'Prof. Alan Turing' },
      { id: 'sub-rag-301', code: 'RAG-301', name: 'Retrieval-Augmented Generation (RAG) & Vector DBs', color: '#10b981', description: 'Document parsing, text chunking, embedding models, Pinecone/ChromaDB indexing, and hybrid search.', teacher_name: 'Prof. Alan Turing' },
      { id: 'sub-ai-401', code: 'AI-401', name: 'Autonomous Agents, Multi-Agent Systems & FastAPI Deployment', color: '#f59e0b', description: 'ReAct framework, LangGraph stateful agents, memory persistence, REST APIs, and Docker cloud deployment.', teacher_name: 'Dr. Sarah Connor' }
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
      { id: 'sub-sf-adm', code: 'SF-ADM', name: 'Salesforce Administrator Essentials & Security', color: '#0284c7', description: 'Org configuration, custom objects, relationships, validation rules, Flow Builder, and role hierarchy.', teacher_name: 'Marc Benioff' },
      { id: 'sub-sf-dev', code: 'SF-DEV', name: 'Apex Programming, Triggers & SOQL Queries', color: '#0ea5e9', description: 'Apex syntax, governor limits, trigger frameworks, asynchronous Apex, and test classes.', teacher_name: 'Marc Benioff' },
      { id: 'sub-sf-lwc', code: 'SF-LWC', name: 'Lightning Web Components (LWC) & Event Architecture', color: '#38bdf8', description: 'Modern ES6+ JavaScript for Salesforce, reactive properties, wire adapters, Lightning Data Service, and LMS events.', teacher_name: 'Marc Benioff' }
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
      { id: 'sub-sn-fnd', code: 'SN-FND', name: 'ServiceNow Platform Administration & ITSM Core', color: '#14b8a6', description: 'User administration, CMDB, SLA management, Knowledge Base, and Service Catalog configuration.', teacher_name: 'Fred Luddy' },
      { id: 'sub-sn-dev', code: 'SN-DEV', name: 'Flow Designer, Client Scripts & Business Rules', color: '#06b6d4', description: 'Server-side Business Rules, Script Includes, Client Scripts, UI Policies, and Automated Test Framework (ATF).', teacher_name: 'Fred Luddy' }
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
      { id: 'sub-fs-rea', code: 'FS-REA', name: 'React, TypeScript & Modern State Management', color: '#6366f1', description: 'Component lifecycles, custom hooks, TailwindCSS, Zustand/Redux, and client-side performance optimization.', teacher_name: 'Dan Abramov' },
      { id: 'sub-fs-nod', code: 'FS-NOD', name: 'Node.js, Express, PostgreSQL & Microservices', color: '#4f46e5', description: 'RESTful API architecture, JWT authentication, SQL migrations with Prisma ORM, and WebSocket real-time streams.', teacher_name: 'Dan Abramov' }
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
      { id: 'sub-do-con', code: 'DO-CON', name: 'Linux Automation, Docker & Kubernetes Clusters', color: '#ec4899', description: 'Multi-stage Docker builds, Pods, Deployments, Services, Ingress controllers, and Helm charts.', teacher_name: 'Linus Torvalds' },
      { id: 'sub-do-cicd', code: 'DO-CICD', name: 'CI/CD Pipelines (GitHub Actions) & AWS Cloud Architecture', color: '#f43f5e', description: 'Automated test runners, Terraform provisioning, IAM policies, and cloud monitoring.', teacher_name: 'Linus Torvalds' }
    ]
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
  const [viewMode, setViewMode] = useState<'roadmap' | 'modules'>('roadmap')

  // Roadmaps Master State
  const [roadmaps, setRoadmaps] = useState<Record<string, WeekendMilestone[]>>(() => {
    try {
      const saved = localStorage.getItem('acharya_course_roadmaps')
      return saved ? JSON.parse(saved) : DEFAULT_ROADMAPS
    } catch {
      return DEFAULT_ROADMAPS
    }
  })

  // Modal: Add Milestone (Teacher / Admin)
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false)
  const [milestoneWeekLabel, setMilestoneWeekLabel] = useState('Week 11 - 12')
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDeliverable, setMilestoneDeliverable] = useState('')
  const [milestoneDueDate, setMilestoneDueDate] = useState('Weekend 12')

  // Modal: Add Day Topic (Teacher / Admin)
  const [targetMilestoneId, setTargetMilestoneId] = useState<string | null>(null)
  const [showAddDayModal, setShowAddDayModal] = useState(false)
  const [newDayNumber, setNewDayNumber] = useState(1)
  const [newDayTitle, setNewDayTitle] = useState('')
  const [newDayDesc, setNewDayDesc] = useState('')

  // Modal: Share Resource (Teacher / Admin)
  const [showShareModal, setShowShareModal] = useState(false)
  const [resourceMilestoneId, setResourceMilestoneId] = useState<string | undefined>(undefined)
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceType, setResourceType] = useState<SharedResource['type']>('pdf')
  const [resourceUrl, setResourceUrl] = useState('')

  const isTeacher = user.role === 'teacher'
  const isAdmin = user.role === 'admin'
  const isStudent = user.role === 'student'
  const canControl = isTeacher || isAdmin

  useEffect(() => {
    loadCourseData()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('acharya_course_roadmaps', JSON.stringify(roadmaps))
    } catch (e) {
      console.warn('Storage error:', e)
    }
  }, [roadmaps])

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

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses[0] || DEFAULT_TECH_TRACKS[0]
  const currentRoadmap = roadmaps[activeCourse.id] || DEFAULT_ROADMAPS[activeCourse.id] || DEFAULT_ROADMAPS['track-python-genai'] || []

  // Add Milestone Handler
  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault()
    if (!milestoneTitle.trim() || !milestoneDeliverable.trim()) return

    const newMs: WeekendMilestone = {
      id: `ms-${Date.now()}`,
      week_label: milestoneWeekLabel.trim(),
      title: milestoneTitle.trim(),
      deliverable: milestoneDeliverable.trim(),
      status: 'scheduled',
      due_date: milestoneDueDate.trim(),
      days: [],
      resources: []
    }

    setRoadmaps(prev => ({
      ...prev,
      [activeCourse.id]: [...(prev[activeCourse.id] || []), newMs]
    }))

    showToast(`Added Milestone: "${milestoneTitle}" to track roadmap!`)
    setShowAddMilestoneModal(false)
    setMilestoneTitle('')
    setMilestoneDeliverable('')
  }

  // Toggle Milestone Status (Scheduled -> In Progress -> Completed)
  const handleToggleMilestoneStatus = (msId: string) => {
    setRoadmaps(prev => {
      const list = prev[activeCourse.id] || []
      const updated = list.map(m => {
        if (m.id !== msId) return m
        const nextStatus: WeekendMilestone['status'] = 
          m.status === 'scheduled' ? 'in_progress' : m.status === 'in_progress' ? 'completed' : 'scheduled'
        return { ...m, status: nextStatus }
      })
      return { ...prev, [activeCourse.id]: updated }
    })
    showToast('Milestone status updated!')
  }

  // Delete Milestone
  const handleDeleteMilestone = (msId: string) => {
    setRoadmaps(prev => ({
      ...prev,
      [activeCourse.id]: (prev[activeCourse.id] || []).filter(m => m.id !== msId)
    }))
    showToast('Milestone removed from roadmap.')
  }

  // Add Day Topic Handler
  const handleAddDayTopic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetMilestoneId || !newDayTitle.trim()) return

    const newDay: DayTopic = {
      day_number: newDayNumber,
      title: newDayTitle.trim(),
      description: newDayDesc.trim(),
      completed: false
    }

    setRoadmaps(prev => {
      const list = prev[activeCourse.id] || []
      const updated = list.map(m => {
        if (m.id !== targetMilestoneId) return m
        return { ...m, days: [...m.days, newDay] }
      })
      return { ...prev, [activeCourse.id]: updated }
    })

    showToast(`Added Day ${newDayNumber} topic to milestone!`)
    setShowAddDayModal(false)
    setNewDayTitle('')
    setNewDayDesc('')
  }

  // Toggle Day Completed
  const handleToggleDayComplete = (msId: string, dayNum: number) => {
    setRoadmaps(prev => {
      const list = prev[activeCourse.id] || []
      const updated = list.map(m => {
        if (m.id !== msId) return m
        return {
          ...m,
          days: m.days.map(d => d.day_number === dayNum ? { ...d, completed: !d.completed } : d)
        }
      })
      return { ...prev, [activeCourse.id]: updated }
    })
  }

  // Share Resource to Milestone / Course
  const handleShareResource = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resourceTitle.trim() || !resourceUrl.trim()) return

    const newRes: SharedResource = {
      id: `res-${Date.now()}`,
      course_id: activeCourse.id,
      milestone_id: resourceMilestoneId,
      title: resourceTitle.trim(),
      type: resourceType,
      url_or_content: resourceUrl.trim(),
      shared_by: user.display_name || 'Faculty Member',
      shared_at: new Date().toISOString().split('T')[0]
    }

    setRoadmaps(prev => {
      const list = prev[activeCourse.id] || []
      const updated = list.map(m => {
        if (resourceMilestoneId && m.id === resourceMilestoneId) {
          return { ...m, resources: [newRes, ...(m.resources || [])] }
        }
        return m
      })
      return { ...prev, [activeCourse.id]: updated }
    })

    showToast(`Published resource: "${resourceTitle}" to roadmap!`)
    setShowShareModal(false)
    setResourceTitle('')
    setResourceUrl('')
  }

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
    const matchesLevel = selectedLevel === 'all' || c.level.toLowerCase() === selectedLevel.toLowerCase()
    return matchesSearch && matchesLevel
  })

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
            <Milestone className="w-3.5 h-3.5" />
            {canControl ? 'Curriculum & Roadmap Control Center' : 'Learning Roadmap & Milestones'}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {canControl ? 'Courses Handled & Dynamic Track Roadmaps' : 'Course Learning Roadmaps & Milestones'}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-2xl leading-relaxed">
            {canControl
              ? 'Manage day-wise curriculum topics, define weekend milestone deliverables, attach repository & slide resources, and update progress for enrolled batches.'
              : 'Follow your day-by-day learning journey, complete weekend milestone capstones, access faculty shared resources, and earn certified course credentials.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          {canControl && (
            <button
              onClick={() => setShowAddMilestoneModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Add Roadmap Milestone</span>
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
            placeholder="Search tracks, milestones, subjects..."
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
          {/* Left: Course Track Cards List (4/12) */}
          <div className="lg:col-span-4 space-y-3">
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
                      <span>{currentRoadmap.length} Milestones</span>
                      <span>{c.enrolled_count || 38} Candidates</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: Active Course Interactive Roadmap (8/12) */}
          {activeCourse && (
            <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                      {activeCourse.level}
                    </span>
                    <span className="text-xs text-slate-500">Track: /{activeCourse.slug}</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white">{activeCourse.title}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                    <button
                      onClick={() => setViewMode('roadmap')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === 'roadmap' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Day-Wise Roadmap
                    </button>
                    <button
                      onClick={() => setViewMode('modules')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        viewMode === 'modules' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Subject Syllabi
                    </button>
                  </div>

                  {isStudent && !isEnrolled(activeCourse.id) && (
                    <button
                      onClick={() => handleEnroll(activeCourse.id)}
                      disabled={enrollingId === activeCourse.id}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-950" />
                      <span>{enrollingId === activeCourse.id ? 'Enrolling...' : 'Enroll'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ── ROADMAP VIEW (Day-wise & Weekend Milestones) ─────────────── */}
              {viewMode === 'roadmap' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <Flag className="w-4 h-4 text-amber-400" />
                      <span>Curriculum Phases & Weekend Milestones ({currentRoadmap.length})</span>
                    </div>

                    {canControl && (
                      <button
                        onClick={() => setShowAddMilestoneModal(true)}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Phase / Milestone</span>
                      </button>
                    )}
                  </div>

                  {/* Timeline Roadmap Cards */}
                  <div className="space-y-5 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-gradient-to-b before:from-amber-500 before:via-slate-800 before:to-slate-800">
                    {currentRoadmap.map((ms, msIdx) => {
                      const isCompleted = ms.status === 'completed'
                      const isInProgress = ms.status === 'in_progress'

                      return (
                        <div key={ms.id} className="relative pl-10 space-y-3 group">
                          {/* Node Icon */}
                          <div
                            onClick={() => canControl && handleToggleMilestoneStatus(ms.id)}
                            className={`absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border cursor-pointer transition-all shadow-md ${
                              isCompleted
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : isInProgress
                                ? 'bg-slate-950 text-amber-400 border-amber-400 animate-pulse ring-2 ring-amber-500/40'
                                : 'bg-slate-950 text-slate-500 border-slate-700'
                            }`}
                            title={canControl ? 'Click to toggle milestone status' : ''}
                          >
                            {isCompleted ? <Check className="w-4 h-4 text-slate-950" /> : msIdx + 1}
                          </div>

                          {/* Milestone Box */}
                          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/30 transition-all space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    {ms.week_label}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                      isCompleted
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : isInProgress
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {ms.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <h3 className="font-bold text-sm text-white mt-1">{ms.title}</h3>
                              </div>

                              <div className="flex items-center gap-2">
                                {canControl && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setTargetMilestoneId(ms.id)
                                        setNewDayNumber((ms.days?.length || 0) + 1)
                                        setShowAddDayModal(true)
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                      title="Add Day Topic"
                                    >
                                      <Plus className="w-3 h-3 text-amber-400" />
                                      <span>Add Day</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setResourceMilestoneId(ms.id)
                                        setShowShareModal(true)
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                      title="Attach Resource to this phase"
                                    >
                                      <Share2 className="w-3 h-3 text-amber-400" />
                                      <span>Share</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMilestone(ms.id)}
                                      className="p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                      title="Delete Milestone"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Weekend Milestone Deliverable Banner */}
                            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <Flag className="w-4 h-4 text-amber-400 shrink-0" />
                                <div>
                                  <p className="text-[10px] uppercase font-black text-amber-400 tracking-wider">
                                    Weekend Milestone Capstone Deliverable:
                                  </p>
                                  <p className="text-xs font-bold text-slate-200">{ms.deliverable}</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800 shrink-0">
                                Target: {ms.due_date}
                              </span>
                            </div>

                            {/* Day-wise Schedule Breakdown */}
                            {ms.days && ms.days.length > 0 && (
                              <div className="space-y-2 pt-1">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                  Day-Wise Curriculum Breakdown:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {ms.days.map((day) => (
                                    <div
                                      key={day.day_number}
                                      onClick={() => canControl && handleToggleDayComplete(ms.id, day.day_number)}
                                      className={`p-2.5 rounded-xl border flex items-start gap-2 text-xs transition-all ${
                                        day.completed
                                          ? 'bg-slate-950/60 border-emerald-500/30 text-slate-300'
                                          : 'bg-slate-950/90 border-slate-800/80 text-slate-300'
                                      } ${canControl ? 'cursor-pointer hover:border-amber-500/40' : ''}`}
                                    >
                                      <div
                                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center text-[9px] shrink-0 ${
                                          day.completed ? 'bg-emerald-500 text-slate-950 font-black' : 'border border-slate-700 bg-slate-900'
                                        }`}
                                      >
                                        {day.completed && <Check className="w-3 h-3 text-slate-950" />}
                                      </div>
                                      <div>
                                        <p className="font-semibold leading-tight text-white">{day.title}</p>
                                        {day.description && (
                                          <p className="text-[10px] text-slate-400 mt-0.5">{day.description}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Attached Resources for this Milestone */}
                            {ms.resources && ms.resources.length > 0 && (
                              <div className="pt-2 border-t border-slate-900 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                                  Phase Learning Materials & Code Repositories:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {ms.resources.map((res) => (
                                    <div
                                      key={res.id}
                                      className="p-2 rounded-xl bg-slate-900/90 border border-amber-500/20 flex items-center justify-between gap-2 hover:border-amber-500/40 transition-all"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {res.type === 'github' ? (
                                          <GitBranch className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                        ) : res.type === 'code_snippet' ? (
                                          <Code className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                        ) : (
                                          <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        )}
                                        <div className="truncate">
                                          <p className="text-[11px] font-bold text-slate-200 truncate">{res.title}</p>
                                          <p className="text-[9px] text-slate-500">{res.shared_by}</p>
                                        </div>
                                      </div>

                                      <a
                                        href={res.url_or_content}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition-colors shrink-0"
                                        title="Open / Download Resource"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── MODULES VIEW (Subject Syllabi Breakdown) ────────────────── */}
              {viewMode === 'modules' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Subject Modules & Faculty Assignments ({activeCourse.subjects.length})
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ADD ROADMAP MILESTONE (Teacher / Admin) ──────────────────── */}
      {showAddMilestoneModal && (
        <div className="fixed inset-0 z-50 bg-[#06080F]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Add Curriculum Milestone to Roadmap
              </h3>
              <button onClick={() => setShowAddMilestoneModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Week Duration</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Week 7 - 8"
                    value={milestoneWeekLabel}
                    onChange={(e) => setMilestoneWeekLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Target Due Date</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Weekend 8"
                    value={milestoneDueDate}
                    onChange={(e) => setMilestoneDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Milestone Phase Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Multi-Agent Systems & LangGraph Workflows"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Weekend Capstone Deliverable</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Build Autonomous Researcher Agent with Human Approval"
                  value={milestoneDeliverable}
                  onChange={(e) => setMilestoneDeliverable(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMilestoneModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Publish Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD DAY TOPIC (Teacher / Admin) ───────────────────────────── */}
      {showAddDayModal && (
        <div className="fixed inset-0 z-50 bg-[#06080F]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Add Day-Wise Topic to Milestone
              </h3>
              <button onClick={() => setShowAddDayModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDayTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Day Number</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newDayNumber}
                  onChange={(e) => setNewDayNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Topic Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Day 12: Reranking with Cross-Encoders"
                  value={newDayTitle}
                  onChange={(e) => setNewDayTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description / Focus Outcome</label>
                <input
                  type="text"
                  placeholder="e.g., Precision scoring and evaluating context recall"
                  value={newDayDesc}
                  onChange={(e) => setNewDayDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDayModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Save Day Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SHARE RESOURCE TO MILESTONE ─────────────────────────────── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-[#06080F]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-amber-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-amber-400" />
                Publish Learning Resource to Roadmap
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleShareResource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Resource Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Week 4 LangChain & Agent Architecture Slides (PDF)"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Resource Type</label>
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
                  <label className="block text-xs font-bold text-slate-300 mb-1">Published By</label>
                  <input
                    type="text"
                    disabled
                    value={user.display_name || 'Faculty Member'}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Resource URL / Link</label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/... or https://drive.google.com/..."
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20"
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
