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
  Sparkles,
  Play
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
  'python-genai': [
    {
      id: 'ms-py-1',
      week_label: 'Week 1 - 2',
      title: 'Python 3.12 Advanced OOP, Concurrency & Data Modeling',
      deliverable: 'High-Throughput Async Webhook Ingestion Engine with Pydantic V2',
      status: 'completed',
      due_date: 'Weekend 2',
      days: [
        { day_number: 1, subject_code: 'PY-101', title: 'Day 1: Type Hinting, Pydantic V2 & Data Validation Schemas', description: 'Advanced generic type checking, custom validators, and serialization pipelines.', lab_task: 'Implement strict API request/response models with nested schema validation.', completed: true },
        { day_number: 2, subject_code: 'PY-101', title: 'Day 2: AsyncIO, Event Loops & Concurrent Coroutines', description: 'Mastering async/await, TaskGroups, Semaphores, and high-concurrency event loops.', lab_task: 'Build an async worker pulling and processing 1,000 mock events in parallel.', completed: true },
        { day_number: 3, subject_code: 'PY-101', title: 'Day 3: Metaclasses, Class Decorators & Context Managers', description: 'Deep dive into Python runtime internals, dunder methods, and resource management.', lab_task: 'Write a custom timing & retry decorator with exponential backoff.', completed: true },
        { day_number: 4, subject_code: 'PY-101', title: 'Day 4: Performance Profiling & Memory Optimization', description: 'Using cProfile, tracemalloc, and __slots__ for memory footprint reduction.', lab_task: 'Benchmark and optimize a 100k-record JSON transformation script.', completed: true },
      ],
      resources: [
        { id: 'res-py-1', course_id: 'python-genai', milestone_id: 'ms-py-1', title: 'Python 3.12 Concurrency & AsyncIO Deep Dive (PDF)', type: 'pdf', url_or_content: 'https://docs.python.org/3/library/asyncio.html', shared_by: 'Dr. Sarah Connor', shared_at: '2026-10-01' },
        { id: 'res-py-2', course_id: 'python-genai', milestone_id: 'ms-py-1', title: 'Async Worker Starter Architecture (GitHub)', type: 'github', url_or_content: 'https://github.com/python/cpython', shared_by: 'Dr. Sarah Connor', shared_at: '2026-10-02' }
      ]
    },
    {
      id: 'ms-py-2',
      week_label: 'Week 3 - 4',
      title: 'Prompt Engineering, LLMs & LangChain 0.3 Framework',
      deliverable: 'Autonomous Tool-Calling LLM Agent Service with Real-Time Streaming',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: [
        { day_number: 5, subject_code: 'GEN-201', title: 'Day 5: Tokenization, Temperature, System Prompts & Structured Output', description: 'Controlling LLM generation, JSON mode, few-shot prompting, and chain-of-thought reasoning.', lab_task: 'Create deterministic data extraction prompts using OpenAI & Gemini APIs.', completed: true },
        { day_number: 6, subject_code: 'GEN-201', title: 'Day 6: OpenAI & Gemini Function Calling & Tool Binding', description: 'Binding Python functions to LLMs for automated database lookups and calculation tools.', lab_task: 'Build a weather and stock ticker tool bound to Gemini 1.5 Pro.', completed: true },
        { day_number: 7, subject_code: 'GEN-201', title: 'Day 7: LangChain LCEL (Expression Language) Pipelines', description: 'Composing deterministic chains with RunnablePassthrough, RunnableParallel, and fallbacks.', lab_task: 'Assemble a multi-step document translation and summary LCEL chain.', completed: false },
        { day_number: 8, subject_code: 'GEN-201', title: 'Day 8: Conversation History & Context Window Management', description: 'Implementing sliding window memory, Redis chat histories, and summary buffers.', lab_task: 'Build a persistent stateful customer service chatbot with session isolation.', completed: false },
      ],
      resources: [
        { id: 'res-py-3', course_id: 'python-genai', milestone_id: 'ms-py-2', title: 'LangChain LCEL & Function Calling Cheat Sheet', type: 'code_snippet', url_or_content: 'https://python.langchain.com/docs/concepts/lcel/', shared_by: 'Prof. Alan Turing', shared_at: '2026-10-03' }
      ]
    },
    {
      id: 'ms-py-3',
      week_label: 'Week 5 - 6',
      title: 'Enterprise RAG Architecture & Vector Databases',
      deliverable: 'Production Multi-Document RAG Search with ChromaDB & Re-ranking',
      status: 'scheduled',
      due_date: 'Weekend 6',
      days: [
        { day_number: 9, subject_code: 'RAG-301', title: 'Day 9: Document Ingestion, Recursive Chunking & Token Splitting', description: 'Parsing PDFs, Markdown, and tabular data with semantic boundary preservation.', lab_task: 'Ingest 50-page enterprise technical manual and create chunks.', completed: false },
        { day_number: 10, subject_code: 'RAG-301', title: 'Day 10: Sentence Transformers & Embedding Generation', description: 'Comparing OpenAI text-embedding-3-small, BGE, and dense vs sparse vectors.', lab_task: 'Generate embeddings and evaluate cosine similarity across search queries.', completed: false },
        { day_number: 11, subject_code: 'RAG-301', title: 'Day 11: Vector DB Queries & Hybrid Search with ChromaDB', description: 'Indexing embeddings with HNSW, metadata filtering, and BM25 hybrid ranking.', lab_task: 'Implement ChromaDB vector collection with metadata filtering on departments.', completed: false },
        { day_number: 12, subject_code: 'RAG-301', title: 'Day 12: Cross-Encoder Re-Ranking & RAG Evaluation Metrics', description: 'Using Cohere/Flashrank rerankers and Ragas evaluation for hallucinations.', lab_task: 'Evaluate RAG retrieval accuracy and context relevancy scores.', completed: false },
      ],
      resources: [
        { id: 'res-py-4', course_id: 'python-genai', milestone_id: 'ms-py-3', title: 'ChromaDB Hybrid Search Lab Manual', type: 'lab_manual', url_or_content: 'https://docs.trychroma.com/', shared_by: 'Prof. Alan Turing', shared_at: '2026-10-03' }
      ]
    },
    {
      id: 'ms-py-4',
      week_label: 'Week 7 - 8',
      title: 'Autonomous Multi-Agent Systems with LangGraph',
      deliverable: 'Multi-Agent Supervisor System with Human-in-the-Loop Approval',
      status: 'scheduled',
      due_date: 'Weekend 8',
      days: [
        { day_number: 13, subject_code: 'AI-401', title: 'Day 13: LangGraph State Graphs, Nodes, Edges & Reducers', description: 'Constructing stateful computational agent graphs with checkpoint persistence.', lab_task: 'Build a two-node cyclical writer/reviewer agent graph.', completed: false },
        { day_number: 14, subject_code: 'AI-401', title: 'Day 14: Supervisor Architecture & Multi-Agent Delegation', description: 'Orchestrating specialized researcher, coder, and validation agents.', lab_task: 'Create a supervisor agent delegating tasks based on user intent.', completed: false },
        { day_number: 15, subject_code: 'AI-401', title: 'Day 15: Human-in-the-Loop Interrupts & Tool Confirmation', description: 'Safely pausing execution graph before sensitive DB write operations.', lab_task: 'Implement interactive approval interrupt for SQL modification queries.', completed: false },
      ],
      resources: [
        { id: 'res-py-5', course_id: 'python-genai', milestone_id: 'ms-py-4', title: 'LangGraph Supervisor Architecture Starter Repo', type: 'github', url_or_content: 'https://github.com/langchain-ai/langgraph', shared_by: 'Prof. Alan Turing', shared_at: '2026-10-03' }
      ]
    },
    {
      id: 'ms-py-5',
      week_label: 'Week 9 - 10',
      title: 'FastAPI Production Deployment & Capstone Defense',
      deliverable: 'Containerized Enterprise GenAI Microservice with JWT & Streaming',
      status: 'scheduled',
      due_date: 'Weekend 10',
      days: [
        { day_number: 16, subject_code: 'AI-401', title: 'Day 16: Async FastAPI Endpoints & Server-Sent Events (SSE)', description: 'Streaming tokens in real-time to frontends with token usage metering.', lab_task: 'Build /chat/stream SSE endpoint with bearer token authentication.', completed: false },
        { day_number: 17, subject_code: 'AI-401', title: 'Day 17: Multi-Stage Docker Builds & Cloud Deployment', description: 'Optimizing container image size, env vars, and healthcheck endpoints.', lab_task: 'Write production Dockerfile and deploy to cloud container runner.', completed: false },
        { day_number: 18, subject_code: 'AI-401', title: 'Day 18: Final Capstone Project Defense & Certification', description: 'End-to-end presentation and code review of autonomous AI agent platform.', lab_task: 'Complete technical live demo and receive verified credential.', completed: false },
      ],
      resources: []
    }
  ],
  'salesforce-developer': [
    {
      id: 'ms-sf-1',
      week_label: 'Week 1 - 3',
      title: 'Salesforce Admin Core, Security Model & Flow Builder',
      deliverable: 'Enterprise CRM Architecture with Complex Multi-Object Flow Automation',
      status: 'completed',
      due_date: 'Weekend 3',
      days: [
        { day_number: 1, subject_code: 'SF-ADM', title: 'Day 1: Custom Objects, Junction Objects & Schema Architecture', description: 'Mastering master-detail vs lookup relationships, roll-up summaries, and schema design.', lab_task: 'Design and deploy a complete recruitment CRM data model with 5 custom objects.', completed: true },
        { day_number: 2, subject_code: 'SF-ADM', title: 'Day 2: Profiles, Permission Sets, OWD & Record-Level Security', description: 'Implementing Organization-Wide Defaults, Role Hierarchy, and Criteria-Based Sharing Rules.', lab_task: 'Configure multi-tier sales visibility where managers view sub-team deals.', completed: true },
        { day_number: 3, subject_code: 'SF-ADM', title: 'Day 3: Screen Flows, Record-Triggered Flows & Custom Invocables', description: 'Building modern low-code automated flows with before-save and after-save optimization.', lab_task: 'Build automated onboarding flow creating child tasks upon candidate qualification.', completed: true },
      ],
      resources: [
        { id: 'res-sf-1', course_id: 'salesforce-developer', milestone_id: 'ms-sf-1', title: 'Salesforce Flow Builder Best Practices Guide', type: 'pdf', url_or_content: 'https://developer.salesforce.com/docs', shared_by: 'Marc Benioff', shared_at: '2026-10-01' }
      ]
    },
    {
      id: 'ms-sf-2',
      week_label: 'Week 4 - 7',
      title: 'Apex OOP, Trigger Frameworks & SOQL Optimization',
      deliverable: 'One-Trigger-Per-Object Framework with 95%+ Test Coverage & Mocking',
      status: 'in_progress',
      due_date: 'Weekend 7',
      days: [
        { day_number: 4, subject_code: 'SF-DEV', title: 'Day 4: Apex Core, Collections, Maps & Governor Limit Management', description: 'Writing bulkified code that avoids SOQL inside loops and 101 query exceptions.', lab_task: 'Process list of 200 account records with efficient Map indexing.', completed: true },
        { day_number: 5, subject_code: 'SF-DEV', title: 'Day 5: Enterprise Trigger Handler Pattern & Context Enums', description: 'Separating business logic from trigger dispatchers with recursion guards.', lab_task: 'Implement OpportunityTriggerHandler with static Set recursion protection.', completed: false },
        { day_number: 6, subject_code: 'SF-DEV', title: 'Day 6: SOQL/SOSL Queries, Aggregate Queries & Database Methods', description: 'Writing dynamic SOQL, binding variables, and partial-success Database.insert operations.', lab_task: 'Create SOQL query calculating quarterly revenue totals grouped by region.', completed: false },
        { day_number: 7, subject_code: 'SF-DEV', title: 'Day 7: Asynchronous Apex: Queueable, Batch & Scheduled Jobs', description: 'Processing millions of records asynchronously with State and error chaining.', lab_task: 'Build Batch Apex job archiving stale leads older than 90 days.', completed: false },
      ],
      resources: [
        { id: 'res-sf-2', course_id: 'salesforce-developer', milestone_id: 'ms-sf-2', title: 'Apex Trigger Handler Pattern Starter Template', type: 'code_snippet', url_or_content: 'https://github.com/developerforce', shared_by: 'Marc Benioff', shared_at: '2026-10-02' }
      ]
    },
    {
      id: 'ms-sf-3',
      week_label: 'Week 8 - 10',
      title: 'Lightning Web Components (LWC) & Event Architecture',
      deliverable: 'Custom Interactive LWC Application with Wire Adapters & LDS',
      status: 'scheduled',
      due_date: 'Weekend 10',
      days: [
        { day_number: 8, subject_code: 'SF-LWC', title: 'Day 8: Modern ES6+ JavaScript, Shadow DOM & LWC Lifecycle Hooks', description: 'Mastering constructor, connectedCallback, renderedCallback, and reactive @api/@track.', lab_task: 'Build responsive product search card component with custom CSS variables.', completed: false },
        { day_number: 9, subject_code: 'SF-LWC', title: 'Day 9: Wire Service, Apex Method Integration & Lightning Data Service', description: 'Fetching cached server data with @wire and invoking imperative Apex on button click.', lab_task: 'Build interactive candidate review grid that saves notes directly via LDS.', completed: false },
        { day_number: 10, subject_code: 'SF-LWC', title: 'Day 10: Lightning Message Service (LMS) & Event Pub/Sub', description: 'Cross-component communication between decoupled LWCs, Aura, and Visualforce.', lab_task: 'Create global notification broadcast channel across dashboard widgets.', completed: false },
      ],
      resources: []
    }
  ],
  'servicenow-sysadmin': [
    {
      id: 'ms-sn-1',
      week_label: 'Week 1 - 4',
      title: 'ServiceNow Platform Core, CMDB & ITSM Workflows',
      deliverable: 'Configured Enterprise ITSM Suite with Custom SLA Matrix & Service Catalog',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: [
        { day_number: 1, subject_code: 'SN-FND', title: 'Day 1: Platform Navigation, Users, Groups, Roles & CMDB Architecture', description: 'Configuring configuration items (CIs), relationships, and discovery foundations.', lab_task: 'Build hardware asset hierarchy with mapped dependency relationships in CMDB.', completed: true },
        { day_number: 2, subject_code: 'SN-FND', title: 'Day 2: Incident, Problem & Change Management Lifecycles', description: 'Implementing ITIL v4 processes, state model transitions, and resolution codes.', lab_task: 'Configure Emergency Change Advisory Board approval routing rules.', completed: true },
        { day_number: 3, subject_code: 'SN-FND', title: 'Day 3: UI Policies, Data Policies, UI Actions & Dictionary Overrides', description: 'Enforcing client-side form behavior and mandatory field rules dynamically.', lab_task: 'Create dynamic form hiding VIP fields unless caller has Executive role.', completed: false },
      ],
      resources: [
        { id: 'res-sn-1', course_id: 'servicenow-sysadmin', milestone_id: 'ms-sn-1', title: 'ServiceNow CSA Quick Reference Manual', type: 'pdf', url_or_content: 'https://developer.servicenow.com', shared_by: 'Fred Luddy', shared_at: '2026-10-01' }
      ]
    },
    {
      id: 'ms-sn-2',
      week_label: 'Week 5 - 8',
      title: 'Server Scripting, GlideRecord & Flow Designer Automation',
      deliverable: 'Automated Multi-Stage Service Catalog Workflow with Custom Script Includes',
      status: 'scheduled',
      due_date: 'Weekend 8',
      days: [
        { day_number: 4, subject_code: 'SN-DEV', title: 'Day 4: Server-Side JavaScript: GlideRecord & GlideSystem (gs)', description: 'Querying and modifying records server-side with efficient encoded queries.', lab_task: 'Write Business Rule auto-assigning high-priority tickets to on-call squads.', completed: false },
        { day_number: 5, subject_code: 'SN-DEV', title: 'Day 5: Client Scripts, GlideAjax & Asynchronous Server Calls', description: 'Building responsive forms using GlideAjax to query server data without freezing UI.', lab_task: 'Implement onLoad Client Script fetching user department via GlideAjax.', completed: false },
        { day_number: 6, subject_code: 'SN-DEV', title: 'Day 6: Flow Designer Subflows, Integration Hub & REST Spokes', description: 'Creating automated no-code/low-code trigger flows and webhook actions.', lab_task: 'Build Flow Designer catalog workflow requesting manager approval via Slack/Teams.', completed: false },
      ],
      resources: []
    }
  ],
  'fullstack-web': [
    {
      id: 'ms-fs-1',
      week_label: 'Week 1 - 4',
      title: 'React 19, Modern TypeScript & State Management',
      deliverable: 'Production Responsive Web Platform with Custom Hooks & Tailwind UI',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: [
        { day_number: 1, subject_code: 'FS-REA', title: 'Day 1: TypeScript Deep Dive: Generics, Utility Types & Type Guards', description: 'Structuring scalable frontend codebases with robust type safety.', lab_task: 'Write generic API client wrapper with strictly typed query parameters.', completed: true },
        { day_number: 2, subject_code: 'FS-REA', title: 'Day 2: React 19 Component Architecture, Custom Hooks & TailwindCSS', description: 'Composing reusable UI atoms, compound components, and sleek glassmorphic themes.', lab_task: 'Build responsive data table component with sorting, filtering, and pagination.', completed: true },
        { day_number: 3, subject_code: 'FS-REA', title: 'Day 3: Global State Management with Zustand & React Query (TanStack)', description: 'Server-state caching, optimistic updates, and client-side stores.', lab_task: 'Implement shopping cart & notification store with instant optimistic updates.', completed: false },
      ],
      resources: [
        { id: 'res-fs-1', course_id: 'fullstack-web', milestone_id: 'ms-fs-1', title: 'React 19 & TypeScript Architecture Starter', type: 'github', url_or_content: 'https://github.com/facebook/react', shared_by: 'Dan Abramov', shared_at: '2026-10-01' }
      ]
    },
    {
      id: 'ms-fs-2',
      week_label: 'Week 5 - 8',
      title: 'Node.js, FastAPI & PostgreSQL Microservices',
      deliverable: 'Scalable REST API Backend with JWT Auth, Prisma/SQLAlchemy & WebSockets',
      status: 'scheduled',
      due_date: 'Weekend 8',
      days: [
        { day_number: 4, subject_code: 'FS-NOD', title: 'Day 4: RESTful API Architecture, Middleware & Request Validation', description: 'Designing clean routing controllers, error handlers, and CORS headers.', lab_task: 'Build modular auth controller with password hashing and refresh tokens.', completed: false },
        { day_number: 5, subject_code: 'FS-NOD', title: 'Day 5: PostgreSQL Database Modeling, Migrations & Indexing', description: 'Relational data modeling, foreign keys, cascade rules, and query optimization.', lab_task: 'Write database migrations for e-commerce orders and items schema.', completed: false },
        { day_number: 6, subject_code: 'FS-NOD', title: 'Day 6: Real-Time WebSockets & Background Job Workers', description: 'Bi-directional real-time communication and asynchronous task queues.', lab_task: 'Implement live notification stream pushing status updates to React clients.', completed: false },
      ],
      resources: []
    }
  ],
  'cloud-devops': [
    {
      id: 'ms-do-1',
      week_label: 'Week 1 - 4',
      title: 'Linux Automation, Docker Containerization & Microservices',
      deliverable: 'Hardened Containerized Microservice Suite with Multi-Stage Builds',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: [
        { day_number: 1, subject_code: 'DO-CON', title: 'Day 1: Linux Administration, Bash Automation & SSH Security', description: 'Systemd service management, file permissions, networking tools, and shell scripts.', lab_task: 'Write automated bash script setting up server firewall and user access keys.', completed: true },
        { day_number: 2, subject_code: 'DO-CON', title: 'Day 2: Dockerfile Optimization & Multi-Stage Production Builds', description: 'Minimizing image size, layer caching, non-root users, and vulnerability scanning.', lab_task: 'Create 25MB production Alpine Docker container for FastAPI backend.', completed: true },
        { day_number: 3, subject_code: 'DO-CON', title: 'Day 3: Docker Compose Multi-Container Orchestration & Volumes', description: 'Connecting app, PostgreSQL database, and Redis cache with healthchecks.', lab_task: 'Assemble complete 3-tier local development environment via docker-compose.', completed: false },
      ],
      resources: [
        { id: 'res-do-1', course_id: 'cloud-devops', milestone_id: 'ms-do-1', title: 'Docker Multi-Stage Best Practices Guide', type: 'pdf', url_or_content: 'https://docs.docker.com', shared_by: 'Linus Torvalds', shared_at: '2026-10-01' }
      ]
    },
    {
      id: 'ms-do-2',
      week_label: 'Week 5 - 8',
      title: 'Kubernetes Orchestration, Helm & CI/CD Pipelines',
      deliverable: 'Production Kubernetes Cluster with Ingress TLS, HPA & GitHub Actions',
      status: 'scheduled',
      due_date: 'Weekend 8',
      days: [
        { day_number: 4, subject_code: 'DO-CICD', title: 'Day 4: Kubernetes Pods, Deployments, Services & ConfigMaps', description: 'Declarative YAML manifests, rolling updates, readiness/liveness probes.', lab_task: 'Deploy high-availability 3-replica web app with zero-downtime rolling update.', completed: false },
        { day_number: 5, subject_code: 'DO-CICD', title: 'Day 5: Ingress Nginx, Let’s Encrypt TLS & Horizontal Pod Autoscaling (HPA)', description: 'Routing traffic by host and path, automated SSL renewal, and CPU autoscaling.', lab_task: 'Configure Ingress controller and stress-test auto-scaling from 2 to 10 pods.', completed: false },
        { day_number: 6, subject_code: 'DO-CICD', title: 'Day 6: Automated CI/CD Pipelines with GitHub Actions & AWS ECR/EKS', description: 'End-to-end continuous integration running tests, building containers, and deploying.', lab_task: 'Build automated GitHub Actions pipeline that deploys on push to main branch.', completed: false },
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
    title: 'Full Stack Web Development (React & FastAPI)',
    slug: 'fullstack-web',
    level: 'Beginner',
    price: 0,
    is_free: true,
    status: 'published',
    description: 'Modern full stack software engineering with React 19, TypeScript, TailwindCSS, Node.js, FastAPI, PostgreSQL, and REST/WebSocket APIs.',
    enrolled_count: 45,
    subjects: [
      { id: 'sub-fs-rea', code: 'FS-REA', name: 'React 19, TypeScript & Modern UI Architecture', color: '#6366f1', description: 'Component lifecycles, custom hooks, TailwindCSS, state stores, and client-side performance optimization.', teacher_name: 'Dan Abramov' },
      { id: 'sub-fs-nod', code: 'FS-NOD', name: 'Node.js, FastAPI, PostgreSQL & Microservices', color: '#4f46e5', description: 'RESTful API architecture, JWT authentication, SQL migrations with SQLAlchemy ORM, and WebSocket real-time streams.', teacher_name: 'Dan Abramov' }
    ]
  },
  {
    id: 'track-cloud-devops',
    title: 'Cloud & DevOps Engineering (AWS & Kubernetes)',
    slug: 'cloud-devops',
    level: 'Advanced',
    price: 0,
    is_free: true,
    status: 'published',
    description: 'Enterprise container orchestration, Infrastructure as Code (Terraform), CI/CD pipelines, Docker, Kubernetes, and AWS cloud architecture.',
    enrolled_count: 31,
    subjects: [
      { id: 'sub-do-con', code: 'DO-CON', name: 'Linux Automation, Docker & Kubernetes Clusters', color: '#ec4899', description: 'Multi-stage Docker builds, Pods, Deployments, Services, Ingress controllers, and Helm charts.', teacher_name: 'Linus Torvalds' },
      { id: 'sub-do-cicd', code: 'DO-CICD', name: 'CI/CD Pipelines (GitHub Actions) & AWS Cloud Architecture', color: '#f43f5e', description: 'Automated test runners, Terraform provisioning, IAM policies, and cloud monitoring.', teacher_name: 'Linus Torvalds' }
    ]
  }
]

// Helper to resolve canonical roadmap key
function getRoadmapTrackKey(course: AdminInstituteCourse): string {
  const str = `${course.slug || ''} ${course.title || ''} ${course.id || ''}`.toLowerCase()
  if (str.includes('python') || str.includes('genai') || str.includes('ai')) return 'python-genai'
  if (str.includes('salesforce') || str.includes('sf-')) return 'salesforce-developer'
  if (str.includes('servicenow') || str.includes('csa') || str.includes('sn-')) return 'servicenow-sysadmin'
  if (str.includes('full') || str.includes('web') || str.includes('react') || str.includes('frontend')) return 'fullstack-web'
  if (str.includes('devops') || str.includes('cloud') || str.includes('aws') || str.includes('docker')) return 'cloud-devops'
  return course.slug || course.id
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ user, setCurrentTab }) => {
  const [courses, setCourses] = useState<AdminInstituteCourse[]>(DEFAULT_TECH_TRACKS)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all')
  const [activeCourseId, setActiveCourseId] = useState<string>(DEFAULT_TECH_TRACKS[0].id)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'roadmap' | 'subjects' | 'resources'>('roadmap')

  // Roadmaps Master State
  const [roadmaps, setRoadmaps] = useState<Record<string, WeekendMilestone[]>>(() => {
    try {
      const saved = localStorage.getItem('acharya_tech_roadmaps_v2')
      return saved ? JSON.parse(saved) : DEFAULT_ROADMAPS
    } catch {
      return DEFAULT_ROADMAPS
    }
  })

  // Completed Days Tracker State
  const [completedDayKeys, setCompletedDayKeys] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('acharya_completed_days')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Modal: Add Milestone (Teacher / Admin)
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false)
  const [milestoneWeekLabel, setMilestoneWeekLabel] = useState('Week 9 - 10')
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDeliverable, setMilestoneDeliverable] = useState('')
  const [milestoneDueDate, setMilestoneDueDate] = useState('Weekend 10')

  // Modal: Add Day Topic (Teacher / Admin)
  const [targetMilestoneId, setTargetMilestoneId] = useState<string | null>(null)
  const [showAddDayModal, setShowAddDayModal] = useState(false)
  const [newDayNumber, setNewDayNumber] = useState(1)
  const [newDayTitle, setNewDayTitle] = useState('')
  const [newDaySubjectCode, setNewDaySubjectCode] = useState('')
  const [newDayDesc, setNewDayDesc] = useState('')
  const [newDayLabTask, setNewDayLabTask] = useState('')

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
      localStorage.setItem('acharya_tech_roadmaps_v2', JSON.stringify(roadmaps))
    } catch (e) {
      console.warn('Storage error:', e)
    }
  }, [roadmaps])

  useEffect(() => {
    try {
      localStorage.setItem('acharya_completed_days', JSON.stringify(completedDayKeys))
    } catch (e) {
      console.warn('Storage error:', e)
    }
  }, [completedDayKeys])

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

  const showNotification = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleEnroll = async (courseId: string) => {
    try {
      setEnrollingId(courseId)
      await enrollInCourse(courseId)
      const fresh = await getMyEnrollments().catch(() => [])
      setEnrollments(fresh)
      showNotification('Successfully enrolled in training track!')
    } catch (err: any) {
      showNotification(err.message || 'Enrollment processed.')
    } finally {
      setEnrollingId(null)
    }
  }

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses[0] || DEFAULT_TECH_TRACKS[0]
  const trackKey = getRoadmapTrackKey(activeCourse)

  // Retrieve current active roadmap or synthesize full default
  const activeMilestones: WeekendMilestone[] = roadmaps[trackKey] || DEFAULT_ROADMAPS[trackKey] || [
    {
      id: `ms-${activeCourse.id}-1`,
      week_label: 'Week 1 - 4',
      title: `${activeCourse.title} — Foundation & Applied Engineering`,
      deliverable: 'Comprehensive Hands-On Lab Deliverable & Architecture Implementation',
      status: 'in_progress',
      due_date: 'Weekend 4',
      days: activeCourse.subjects.map((sub, idx) => ({
        day_number: idx + 1,
        subject_code: sub.code,
        title: `Day ${idx + 1}: ${sub.name} Foundations & Architecture`,
        description: sub.description || 'Core concepts, practical configuration, and implementation patterns.',
        lab_task: `Complete hands-on exercise and repository deployment for ${sub.name}.`,
        completed: false
      })),
      resources: []
    }
  ]

  // Calculate Overall Course Day Statistics
  const allDaysList = activeMilestones.flatMap(m => m.days)
  const totalDaysCount = allDaysList.length
  const completedDaysCount = allDaysList.filter(d => {
    const key = `${trackKey}_d${d.day_number}`
    return completedDayKeys[key] ?? d.completed ?? false
  }).length
  const progressPercent = totalDaysCount > 0 ? Math.round((completedDaysCount / totalDaysCount) * 100) : 0

  const toggleDayCompletion = (dayNum: number) => {
    const key = `${trackKey}_d${dayNum}`
    const current = completedDayKeys[key] ?? allDaysList.find(d => d.day_number === dayNum)?.completed ?? false
    setCompletedDayKeys(prev => ({
      ...prev,
      [key]: !current
    }))
    showNotification(`Day ${dayNum} marked as ${!current ? 'Completed' : 'Pending'}`)
  }

  // Add Milestone Handler
  const handleAddMilestone = () => {
    if (!milestoneTitle.trim()) return
    const newMs: WeekendMilestone = {
      id: `ms-${Date.now()}`,
      week_label: milestoneWeekLabel.trim() || 'Phase Next',
      title: milestoneTitle.trim(),
      deliverable: milestoneDeliverable.trim() || 'Production Technical Deliverable',
      status: 'scheduled',
      due_date: milestoneDueDate.trim() || 'Scheduled',
      days: [],
      resources: []
    }
    setRoadmaps(prev => ({
      ...prev,
      [trackKey]: [...(prev[trackKey] || activeMilestones), newMs]
    }))
    setShowAddMilestoneModal(false)
    setMilestoneTitle('')
    setMilestoneDeliverable('')
    showNotification('New milestone added successfully!')
  }

  // Add Day Topic Handler
  const handleAddDayTopic = () => {
    if (!newDayTitle.trim() || !targetMilestoneId) return
    const newDay: DayTopic = {
      day_number: newDayNumber || (totalDaysCount + 1),
      subject_code: newDaySubjectCode || activeCourse.subjects[0]?.code,
      title: newDayTitle.trim(),
      description: newDayDesc.trim() || undefined,
      lab_task: newDayLabTask.trim() || undefined,
      completed: false
    }

    setRoadmaps(prev => {
      const currentList = prev[trackKey] || activeMilestones
      const updated = currentList.map(ms => {
        if (ms.id === targetMilestoneId) {
          return { ...ms, days: [...ms.days, newDay] }
        }
        return ms
      })
      return { ...prev, [trackKey]: updated }
    })

    setShowAddDayModal(false)
    setNewDayTitle('')
    setNewDayDesc('')
    setNewDayLabTask('')
    showNotification(`Day ${newDay.day_number} topic added to syllabus!`)
  }

  // Share Resource Handler
  const handleAddResource = () => {
    if (!resourceTitle.trim() || !resourceUrl.trim()) return
    const newRes: SharedResource = {
      id: `res-${Date.now()}`,
      course_id: activeCourse.id,
      milestone_id: resourceMilestoneId,
      title: resourceTitle.trim(),
      type: resourceType,
      url_or_content: resourceUrl.trim(),
      shared_by: user.display_name,
      shared_at: new Date().toISOString().split('T')[0]
    }

    setRoadmaps(prev => {
      const currentList = prev[trackKey] || activeMilestones
      const updated = currentList.map(ms => {
        if (!resourceMilestoneId || ms.id === resourceMilestoneId) {
          return { ...ms, resources: [...(ms.resources || []), newRes] }
        }
        return ms
      })
      return { ...prev, [trackKey]: updated }
    })

    setShowShareModal(false)
    setResourceTitle('')
    setResourceUrl('')
    showNotification('Resource shared with batch candidates!')
  }

  // Delete Day Topic
  const handleDeleteDay = (milestoneId: string, dayNum: number) => {
    setRoadmaps(prev => {
      const currentList = prev[trackKey] || activeMilestones
      const updated = currentList.map(ms => {
        if (ms.id === milestoneId) {
          return { ...ms, days: ms.days.filter(d => d.day_number !== dayNum) }
        }
        return ms
      })
      return { ...prev, [trackKey]: updated }
    })
    showNotification(`Day ${dayNum} removed.`)
  }

  // Filter Courses
  const filteredCourses = courses.filter((c) => {
    const searchLower = search.toLowerCase()
    const matchSearch =
      (c.title || '').toLowerCase().includes(searchLower) ||
      (c.description || '').toLowerCase().includes(searchLower) ||
      (c.subjects || []).some(s => (s.name || '').toLowerCase().includes(searchLower) || (s.code || '').toLowerCase().includes(searchLower))
    const matchLevel =
      selectedLevel === 'all' ||
      (c.level || '').toLowerCase() === selectedLevel.toLowerCase()
    return matchSearch && matchLevel
  })

  // All Shared Resources for Active Course
  const allCourseResources: SharedResource[] = activeMilestones.flatMap(m => m.resources || [])

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* ── Toast Notification ────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl bg-amber-950/95 border border-amber-500/40 text-amber-200 shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Hero Banner Header ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0B0F19] via-[#161E31] to-[#0B0F19] border border-amber-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Technical Track Curriculum & Roadmap Center
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                <Check className="w-3 h-3 text-cyan-400" />
                {courses.length} Certified Technical Tracks
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {isTeacher ? 'Courses Handled & Technical Syllabi' : 'Professional Technology Tracks & Roadmaps'}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Explore day-wise technical curriculums, manage concurrent subject modules, access code repositories and slide decks, and track your milestone deliverables.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canControl && (
              <>
                <button
                  onClick={() => setShowAddMilestoneModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Milestone Phase</span>
                </button>

                <button
                  onClick={() => {
                    setResourceMilestoneId(activeMilestones[0]?.id)
                    setShowShareModal(true)
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>Share Resources</span>
                </button>
              </>
            )}

            <button
              onClick={loadCourseData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
              title="Refresh course data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search tracks, subjects (e.g. LangChain, Apex, Docker)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 ${
                selectedLevel === lvl
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {lvl === 'all' ? 'All Levels' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Layout: Tracks List (Left) + Detailed Showcase (Right) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Course Tracks Selector (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Technology Tracks ({filteredCourses.length})
            </h3>
            <span className="text-[11px] text-amber-400 font-semibold">Select to View Roadmap</span>
          </div>

          <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredCourses.map((c) => {
              const isActive = c.id === activeCourseId
              const isEnrolled = enrollments.some(e => e.course_id === c.id)

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveCourseId(c.id)
                    setSelectedSubjectFilter('all')
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isActive
                      ? 'bg-slate-900 border-amber-500/50 shadow-xl shadow-amber-500/5 ring-1 ring-amber-500/30'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500" />
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {c.level}
                      </span>
                      {isEnrolled && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Enrolled
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-black text-slate-100 group-hover:text-amber-300 transition-colors">
                      {c.title}
                    </h4>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {c.description}
                    </p>

                    {/* Concurrent Subject Chips */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                      {c.subjects.map(s => (
                        <span
                          key={s.id}
                          className="px-2 py-0.5 rounded text-[9px] font-bold"
                          style={{
                            backgroundColor: `${s.color || '#3b82f6'}15`,
                            color: s.color || '#3b82f6',
                            border: `1px solid ${s.color || '#3b82f6'}30`
                          }}
                        >
                          {s.code}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>{c.subjects.length} Concurrent Subjects</span>
                      <span>{c.enrolled_count || 0} Candidates</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Active Course Dynamic Stage (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Course Spotlight Card */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {activeCourse.level}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Track: /{activeCourse.slug}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {activeCourse.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  {activeCourse.description}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                {isStudent && (
                  enrollments.some(e => e.course_id === activeCourse.id) ? (
                    <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Active Candidate
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEnroll(activeCourse.id)}
                      disabled={enrollingId === activeCourse.id}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>{enrollingId === activeCourse.id ? 'Enrolling...' : 'Enroll in Track'}</span>
                    </button>
                  )
                )}

                {setCurrentTab && (
                  <button
                    onClick={() => setCurrentTab('classroom')}
                    className="px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Live Classrooms</span>
                  </button>
                )}
              </div>
            </div>

            {/* Progress Metrics Bar */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-400">Syllabus Completion</span>
                  <span className="text-amber-400">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="text-center sm:text-left">
                <span className="text-xs text-slate-400 font-medium">Days Completed: </span>
                <span className="text-xs font-bold text-white">{completedDaysCount} / {totalDaysCount} Days</span>
              </div>

              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setViewMode('roadmap')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'roadmap'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Day-Wise Roadmap
                </button>
                <button
                  onClick={() => setViewMode('subjects')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'subjects'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Parallel Subjects
                </button>
                <button
                  onClick={() => setViewMode('resources')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'resources'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Resources ({allCourseResources.length})
                </button>
              </div>
            </div>
          </div>

          {/* ── SHOWCASE VIEW 1: DAY-WISE TECHNICAL ROADMAP ────────────────── */}
          {viewMode === 'roadmap' && (
            <div className="space-y-6">
              {/* Subject quick filter buttons */}
              {activeCourse.subjects.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">Filter Subject:</span>
                  <button
                    onClick={() => setSelectedSubjectFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                      selectedSubjectFilter === 'all'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    All Subjects ({activeCourse.subjects.length})
                  </button>
                  {activeCourse.subjects.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubjectFilter(sub.code)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                        selectedSubjectFilter === sub.code
                          ? 'bg-slate-800 text-white border'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                      style={{
                        borderColor: selectedSubjectFilter === sub.code ? sub.color : undefined,
                        color: selectedSubjectFilter === sub.code ? sub.color : undefined
                      }}
                    >
                      {sub.code}: {sub.name.slice(0, 20)}...
                    </button>
                  ))}
                </div>
              )}

              {/* Milestones and Days Container */}
              <div className="space-y-6">
                {activeMilestones.map((milestone, mIdx) => {
                  const filteredDays = selectedSubjectFilter === 'all'
                    ? milestone.days
                    : milestone.days.filter(d => d.subject_code === selectedSubjectFilter || !d.subject_code)

                  if (selectedSubjectFilter !== 'all' && filteredDays.length === 0) return null

                  return (
                    <div
                      key={milestone.id}
                      className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-all space-y-4"
                    >
                      {/* Milestone Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-extrabold text-xs flex items-center justify-center border border-amber-500/30">
                              {mIdx + 1}
                            </span>
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-950 text-amber-400 border border-amber-500/20">
                              {milestone.week_label}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              milestone.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : milestone.status === 'in_progress'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {milestone.status.replace('_', ' ')}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-white">
                            {milestone.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                            Deliverable: <strong className="text-slate-200">{milestone.deliverable}</strong>
                          </span>

                          {canControl && (
                            <button
                              onClick={() => {
                                setTargetMilestoneId(milestone.id)
                                setNewDayNumber(totalDaysCount + 1)
                                setShowAddDayModal(true)
                              }}
                              className="p-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/30 transition-all"
                              title="Add Day Topic to this milestone"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Day Topics Timeline Grid */}
                      <div className="space-y-3 pt-1">
                        {filteredDays.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">No day topics configured for this filter.</p>
                        ) : (
                          filteredDays.map((day) => {
                            const isChecked = completedDayKeys[`${trackKey}_d${day.day_number}`] ?? day.completed ?? false
                            const subjectMeta = activeCourse.subjects.find(s => s.code === day.subject_code)

                            return (
                              <div
                                key={day.day_number}
                                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                                  isChecked
                                    ? 'bg-slate-950/90 border-emerald-500/30 shadow-sm'
                                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-start gap-3 flex-1">
                                  {/* Checkbox */}
                                  <button
                                    onClick={() => toggleDayCompletion(day.day_number)}
                                    className={`w-6 h-6 rounded-lg shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                      isChecked
                                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                        : 'bg-slate-900 border border-slate-700 hover:border-amber-400 text-transparent'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </button>

                                  <div className="space-y-1 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-black text-white">
                                        Day {day.day_number}
                                      </span>

                                      {day.subject_code && (
                                        <span
                                          className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase"
                                          style={{
                                            backgroundColor: `${subjectMeta?.color || '#3b82f6'}20`,
                                            color: subjectMeta?.color || '#3b82f6',
                                            border: `1px solid ${subjectMeta?.color || '#3b82f6'}40`
                                          }}
                                        >
                                          {day.subject_code}
                                        </span>
                                      )}

                                      {isChecked && (
                                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" /> Completed
                                        </span>
                                      )}
                                    </div>

                                    <h4 className="text-sm font-bold text-slate-200">
                                      {day.title}
                                    </h4>

                                    {day.description && (
                                      <p className="text-xs text-slate-400 leading-relaxed">
                                        {day.description}
                                      </p>
                                    )}

                                    {day.lab_task && (
                                      <div className="mt-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-amber-300 flex items-start gap-2">
                                        <Code className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                        <span><strong>Hands-On Lab:</strong> {day.lab_task}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {canControl && (
                                  <button
                                    onClick={() => handleDeleteDay(milestone.id, day.day_number)}
                                    className="text-slate-600 hover:text-red-400 transition-colors p-1"
                                    title="Delete Day"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* Milestone Attached Resources */}
                      {milestone.resources && milestone.resources.length > 0 && (
                        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Phase Resources:</span>
                          {milestone.resources.map(res => (
                            <a
                              key={res.id}
                              href={res.url_or_content}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-all"
                            >
                              {res.type === 'github' ? <GitBranch className="w-3 h-3 text-cyan-400" /> : <FileText className="w-3 h-3 text-amber-400" />}
                              <span>{res.title}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SHOWCASE VIEW 2: PARALLEL RUNNING SUBJECTS & MODULES ─────── */}
          {viewMode === 'subjects' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Concurrently Executed Technical Modules ({activeCourse.subjects.length})
                </h3>
                <p className="text-xs text-slate-400">
                  This training track incorporates parallel subjects taught concurrently by certified domain experts throughout the cohort.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCourse.subjects.map((subj, idx) => (
                  <div
                    key={subj.id || idx}
                    className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase"
                          style={{
                            backgroundColor: `${subj.color || '#3b82f6'}20`,
                            color: subj.color || '#3b82f6',
                            border: `1px solid ${subj.color || '#3b82f6'}40`
                          }}
                        >
                          {subj.code}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Module {idx + 1}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-white">
                        {subj.name}
                      </h4>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {subj.description || 'Comprehensive technical syllabus module covering hands-on labs, real-world case studies, and code assessments.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-[10px]">
                          {(subj.teacher_name || 'F').charAt(0)}
                        </div>
                        <span className="text-slate-300 font-semibold">{subj.teacher_name || 'Faculty Specialist'}</span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedSubjectFilter(subj.code)
                          setViewMode('roadmap')
                        }}
                        className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                      >
                        View Syllabus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SHOWCASE VIEW 3: SHARED TECHNICAL RESOURCES ─────────────── */}
          {viewMode === 'resources' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Technical Repositories, Slide Decks & Lab Manuals
                  </h3>
                  <p className="text-xs text-slate-400">
                    Official learning assets, starter boilerplates, and reference documentation for {activeCourse.title}.
                  </p>
                </div>

                {canControl && (
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Resource</span>
                  </button>
                )}
              </div>

              {allCourseResources.length === 0 ? (
                <div className="p-8 text-center rounded-3xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs italic">
                  No resources uploaded yet for this course track.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allCourseResources.map((res) => (
                    <a
                      key={res.id}
                      href={res.url_or_content}
                      target="_blank"
                      rel="noreferrer"
                      className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900 transition-all flex items-start gap-3 group"
                    >
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-amber-500/30 shrink-0">
                        {res.type === 'github' ? (
                          <GitBranch className="w-5 h-5 text-cyan-400" />
                        ) : res.type === 'pdf' || res.type === 'slides' ? (
                          <FileText className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Code className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {res.type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500">{res.shared_at}</span>
                        </div>
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                          {res.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          By {res.shared_by}
                        </p>
                      </div>

                      <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0 mt-1" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: ADD MILESTONE PHASE ────────────────────────────────────── */}
      {showAddMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Add Milestone Phase to {activeCourse.title}
              </h3>
              <button onClick={() => setShowAddMilestoneModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Week Range Label</label>
                <input
                  type="text"
                  placeholder="e.g. Week 11 - 12"
                  value={milestoneWeekLabel}
                  onChange={e => setMilestoneWeekLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Milestone Focus Title</label>
                <input
                  type="text"
                  placeholder="e.g. Multi-Agent Workflows with LangGraph"
                  value={milestoneTitle}
                  onChange={e => setMilestoneTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Weekend Deliverable / Lab Target</label>
                <input
                  type="text"
                  placeholder="e.g. Autonomous Supervisor System Deployment"
                  value={milestoneDeliverable}
                  onChange={e => setMilestoneDeliverable(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Milestone Target Due</label>
                <input
                  type="text"
                  placeholder="e.g. Weekend 10"
                  value={milestoneDueDate}
                  onChange={e => setMilestoneDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAddMilestoneModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMilestone}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black"
              >
                Save Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD DAY TOPIC ──────────────────────────────────────────── */}
      {showAddDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Code className="w-4 h-4 text-amber-400" />
                Add Daily Syllabus Topic
              </h3>
              <button onClick={() => setShowAddDayModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Day Number</label>
                  <input
                    type="number"
                    value={newDayNumber}
                    onChange={e => setNewDayNumber(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Subject Module</label>
                  <select
                    value={newDaySubjectCode}
                    onChange={e => setNewDaySubjectCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Default Module</option>
                    {activeCourse.subjects.map(s => (
                      <option key={s.id} value={s.code}>{s.code} - {s.name.slice(0, 18)}...</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Topic Title</label>
                <input
                  type="text"
                  placeholder="e.g. AsyncIO Coroutines & Event Loops"
                  value={newDayTitle}
                  onChange={e => setNewDayTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Core concepts covered during instruction..."
                  value={newDayDesc}
                  onChange={e => setNewDayDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Hands-on Lab Exercise</label>
                <input
                  type="text"
                  placeholder="e.g. Build async worker processing 1,000 tasks"
                  value={newDayLabTask}
                  onChange={e => setNewDayLabTask(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAddDayModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDayTopic}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black"
              >
                Add Topic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SHARE RESOURCE ─────────────────────────────────────────── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" />
                Share Learning Material
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Resource Title</label>
                <input
                  type="text"
                  placeholder="e.g. LangChain LCEL Cheatsheet (PDF)"
                  value={resourceTitle}
                  onChange={e => setResourceTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Type</label>
                  <select
                    value={resourceType}
                    onChange={e => setResourceType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="github">GitHub Repo</option>
                    <option value="lab_manual">Lab Manual</option>
                    <option value="slides">Presentation Slides</option>
                    <option value="code_snippet">Code Snippet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Target Phase</label>
                  <select
                    value={resourceMilestoneId || ''}
                    onChange={e => setResourceMilestoneId(e.target.value || undefined)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">General Course</option>
                    {activeMilestones.map(m => (
                      <option key={m.id} value={m.id}>{m.week_label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">URL / Resource Link</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={resourceUrl}
                  onChange={e => setResourceUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddResource}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black"
              >
                Share Resource
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
