"""
Professional Training Institute Technical Curriculum & Detailed Module Syllabus.
Covers Python with GenAI, Salesforce, ServiceNow, Full Stack Web Development, and Cloud & DevOps Engineering.
"""
from typing import Dict, List, Any, Optional

TECH_CURRICULUM = [
    {
        "track_id": "PYTHON_GENAI",
        "title": "Python with Generative AI (GenAI)",
        "slug": "python-genai",
        "category": "Artificial Intelligence & Software Engineering",
        "level": "Intermediate to Advanced",
        "color": "#3b82f6",
        "academic_year": "2026-2027",
        "periods_per_week": 6,
        "description": "Master advanced Python, LangChain, OpenAI & Gemini APIs, RAG architecture, Vector DBs, and autonomous agent building.",
        "subjects": [
            {
                "code": "PY-101",
                "name": "Python Core & Advanced Object-Oriented Programming",
                "color": "#3b82f6",
                "duration_weeks": 3,
                "description": "Advanced data structures, functional paradigms, OOP, decorators, generators, and async programming."
            },
            {
                "code": "GEN-201",
                "name": "Prompt Engineering, LLMs & LangChain Framework",
                "color": "#8b5cf6",
                "duration_weeks": 4,
                "description": "Tokenization, temperature, system prompts, Few-shot prompting, LangChain chains, tools, and structured outputs."
            },
            {
                "code": "RAG-301",
                "name": "Retrieval-Augmented Generation (RAG) & Vector DBs",
                "color": "#10b981",
                "duration_weeks": 3,
                "description": "Document parsing, text chunking, embedding models, Pinecone/ChromaDB indexing, hybrid search, and re-ranking."
            },
            {
                "code": "AI-401",
                "name": "Autonomous Agents, Multi-Agent Systems & FastAPI Deployment",
                "color": "#f59e0b",
                "duration_weeks": 4,
                "description": "ReAct framework, LangGraph stateful agents, memory persistence, FastAPI REST APIs, and Docker cloud deployment."
            }
        ],
        "chapters": [
            {
                "num": 1,
                "title": "Python 3.12 Deep Dive & Async Concurrency",
                "duration_weeks": 2,
                "topics": ["Type Hinting & Pydantic V2", "AsyncIO & Event Loops", "Custom Metaclasses", "High-Performance Generators"],
                "outcomes": "Build production-grade concurrent asynchronous Python backend services."
            },
            {
                "num": 2,
                "title": "LLM Foundations & API Integrations",
                "duration_weeks": 2,
                "topics": ["OpenAI & Gemini API SDKs", "Function Calling & Tools", "Streaming Responses", "Cost & Rate-limit Management"],
                "outcomes": "Connect LLMs to external systems and stream real-time responses."
            },
            {
                "num": 3,
                "title": "LangChain 0.3 & Semantic Orchestration",
                "duration_weeks": 3,
                "topics": ["LCEL (LangChain Expression Language)", "Prompt Templates", "Output Parsers", "Memory & Conversation History"],
                "outcomes": "Architect scalable AI pipeline graphs using modern LangChain expressions."
            },
            {
                "num": 4,
                "title": "Enterprise RAG Architecture & Vector Search",
                "duration_weeks": 3,
                "topics": ["Recursive Character Splitters", "Sentence Transformers & Embeddings", "ChromaDB & Pinecone Operations", "Cross-Encoder Re-Ranking"],
                "outcomes": "Construct knowledge retrieval systems querying large PDF, doc, and web knowledge bases."
            },
            {
                "num": 5,
                "title": "Multi-Agent Workflows with LangGraph",
                "duration_weeks": 3,
                "topics": ["State Graphs & Nodes", "Human-in-the-Loop Approval", "Agent Self-Correction Loops", "Tool Calling Routing"],
                "outcomes": "Create autonomous problem-solving multi-agent teams."
            }
        ]
    },
    {
        "track_id": "SALESFORCE_DEV",
        "title": "Salesforce Administration & Developer Track",
        "slug": "salesforce-developer",
        "category": "Enterprise CRM & Cloud Development",
        "level": "Intermediate",
        "color": "#0284c7",
        "academic_year": "2026-2027",
        "periods_per_week": 6,
        "description": "Complete Salesforce certification curriculum covering Admin Essentials, Flow Builder, Apex OOP, SOQL, and Lightning Web Components (LWC).",
        "subjects": [
            {
                "code": "SF-ADM",
                "name": "Salesforce Administrator Essentials & Security",
                "color": "#0284c7",
                "duration_weeks": 3,
                "description": "Standard/Custom Objects, Profiles, Roles, Permission Sets, Sharing Rules, and Flow Builder automations."
            },
            {
                "code": "SF-APEX",
                "name": "Apex Programming, Triggers & SOQL",
                "color": "#0ea5e9",
                "duration_weeks": 4,
                "description": "Apex classes, trigger frameworks, SOQL/SOSL queries, governor limits, and unit test classes."
            },
            {
                "code": "SF-LWC",
                "name": "Lightning Web Components (LWC) & Modern UI",
                "color": "#06b6d4",
                "duration_weeks": 4,
                "description": "Shadow DOM, component lifecycle, reactive properties, wire service, and Lightning Design System."
            },
            {
                "code": "SF-INT",
                "name": "Salesforce REST/SOAP APIs & Enterprise Integrations",
                "color": "#6366f1",
                "duration_weeks": 3,
                "description": "Named credentials, Connected Apps, OAuth 2.0 flows, and external REST webhook integrations."
            }
        ],
        "chapters": [
            {
                "num": 1,
                "title": "Salesforce Data Model & Security Architecture",
                "duration_weeks": 2,
                "topics": ["Lookup vs Master-Detail", "Organization-Wide Defaults (OWD)", "Field-Level Security", "Record Types"],
                "outcomes": "Design compliant, secure enterprise CRM object models."
            },
            {
                "num": 2,
                "title": "Process Automation with Salesforce Flow",
                "duration_weeks": 2,
                "topics": ["Record-Triggered Flows", "Screen Flows", "Scheduled & Autolaunched Flows", "Error Handling & Fault Paths"],
                "outcomes": "Automate complex business logic declaratively without writing code."
            },
            {
                "num": 3,
                "title": "Apex Development & Governor Limits",
                "duration_weeks": 3,
                "topics": ["Apex Syntax & Collections", "Trigger Handler Patterns", "SOQL Optimization", "Batch & Queueable Apex"],
                "outcomes": "Write bulkified, governor-limit safe Apex code and trigger frameworks."
            },
            {
                "num": 4,
                "title": "Lightning Web Components (LWC) Engineering",
                "duration_weeks": 3,
                "topics": ["LWC Architecture & Wire Adapters", "Component Events & PubSub", "Lightning Data Service (LDS)", "SLDS Styling"],
                "outcomes": "Build ultra-responsive custom Salesforce UI applications."
            },
            {
                "num": 5,
                "title": "CI/CD & Salesforce DevOps with SFDX",
                "duration_weeks": 2,
                "topics": ["Scratch Orgs & Packages", "Salesforce CLI (sf)", "GitHub Actions Deployment", "Metadata vs Source API"],
                "outcomes": "Deploy changes seamlessly across sandbox and production orgs."
            }
        ]
    },
    {
        "track_id": "SERVICENOW_DEV",
        "title": "ServiceNow Administration & Development (CSA / CAD)",
        "slug": "servicenow-csa-cad",
        "category": "Enterprise ITSM & Workflow Automation",
        "level": "Intermediate",
        "color": "#10b981",
        "academic_year": "2026-2027",
        "periods_per_week": 5,
        "description": "Certified System Administrator (CSA) and Application Developer (CAD) preparation covering ITSM, GlideRecord, Script Includes, and Service Portal.",
        "subjects": [
            {
                "code": "SN-CSA",
                "name": "ServiceNow Certified System Administrator Core",
                "color": "#10b981",
                "duration_weeks": 3,
                "description": "User administration, CMDB, table inheritance, dictionary overrides, UI policies, and data policies."
            },
            {
                "code": "SN-ITSM",
                "name": "ITSM Processes (Incident, Problem, Change & Knowledge)",
                "color": "#059669",
                "duration_weeks": 3,
                "description": "ITIL foundation, incident routing, change advisory board workflows, and SLA definitions."
            },
            {
                "code": "SN-SCRIPT",
                "name": "GlideScripting (Client Scripts, Business Rules & Script Includes)",
                "color": "#14b8a6",
                "duration_weeks": 4,
                "description": "GlideRecord, GlideAggregate, GlideSystem, GlideAjax asynchronous calls, and Script Includes."
            },
            {
                "code": "SN-PORTAL",
                "name": "Service Portal & Flow Designer Automation",
                "color": "#0d9488",
                "duration_weeks": 4,
                "description": "Widget development, AngularJS client controllers, Flow Designer actions, and integration spokes."
            }
        ],
        "chapters": [
            {
                "num": 1,
                "title": "Now Platform Fundamentals & CMDB",
                "duration_weeks": 2,
                "topics": ["Lists, Forms & Views", "User, Group & Role Management", "Configuration Items (CIs) & CMDB", "Import Sets & Transform Maps"],
                "outcomes": "Administer ServiceNow platform settings, users, and configuration databases."
            },
            {
                "num": 2,
                "title": "ITSM Lifecycle & SLA Management",
                "duration_weeks": 2,
                "topics": ["Incident Management Lifecycle", "Standard/Normal Change Requests", "Problem Root Cause Analysis", "Service Level Agreements (SLAs)"],
                "outcomes": "Configure industry-standard IT service management workflows."
            },
            {
                "num": 3,
                "title": "Server-Side Scripting with GlideRecord",
                "duration_weeks": 3,
                "topics": ["Business Rules (Before/After/Async)", "Script Includes & Class Extensions", "Scheduled Script Executions", "GlideAggregate Reporting"],
                "outcomes": "Write robust server-side JavaScript to automate data integrity."
            },
            {
                "num": 4,
                "title": "Client-Side Scripting & GlideAjax",
                "duration_weeks": 3,
                "topics": ["Client Scripts (onLoad, onChange, onSubmit)", "UI Policies & UI Actions", "GlideAjax Server Communication", "g_form & g_user APIs"],
                "outcomes": "Build interactive, validated form experiences for agents."
            },
            {
                "num": 5,
                "title": "Flow Designer & REST Integration Spokes",
                "duration_weeks": 3,
                "topics": ["Triggers, Actions & Subflows", "REST API Explorer", "Inbound Email Actions", "Mid Server Communication"],
                "outcomes": "Connect ServiceNow with third-party enterprise clouds and webhooks."
            }
        ]
    },
    {
        "track_id": "FULLSTACK_WEB",
        "title": "Full Stack Web Engineering (React, Node & Python FastAPI)",
        "slug": "full-stack-web",
        "category": "Web Engineering & Cloud Architecture",
        "level": "Beginner to Intermediate",
        "color": "#f59e0b",
        "academic_year": "2026-2027",
        "periods_per_week": 6,
        "description": "Build end-to-end full stack web platforms using modern HTML5, Tailwind CSS, React 19, FastAPI REST backends, and PostgreSQL databases.",
        "subjects": [
            {
                "code": "WEB-101",
                "name": "HTML5, Semantic UI & Tailwind CSS Layouts",
                "color": "#f59e0b",
                "duration_weeks": 2,
                "description": "Semantic HTML, Flexbox, Grid systems, responsive design, and Tailwind utility styling."
            },
            {
                "code": "JS-201",
                "name": "Modern JavaScript ES6+ & React 19 Ecosystem",
                "color": "#3b82f6",
                "duration_weeks": 4,
                "description": "State management, React hooks, component hierarchy, React Router, Vite, and API integration."
            },
            {
                "code": "BE-301",
                "name": "FastAPI, PostgreSQL ORM & Authentication",
                "color": "#8b5cf6",
                "duration_weeks": 4,
                "description": "REST architecture, SQLAlchemy 2.0 ORM, Alembic migrations, JWT auth, and role-based access control."
            }
        ],
        "chapters": [
            {
                "num": 1,
                "title": "Modern Frontend Architecture with React & Tailwind",
                "duration_weeks": 3,
                "topics": ["React 19 Components", "Custom Hooks & Context", "Tailwind CSS Design Systems", "Responsive Mobile-First UI"],
                "outcomes": "Create clean, responsive single-page web applications."
            },
            {
                "num": 2,
                "title": "FastAPI RESTful Backend Design",
                "duration_weeks": 3,
                "topics": ["Pydantic Schemas & Validation", "Dependency Injection", "Async Database Sessions", "JWT & OAuth2 Security"],
                "outcomes": "Construct secure, high-performance REST APIs."
            },
            {
                "num": 3,
                "title": "PostgreSQL Modeling & Database Optimizations",
                "duration_weeks": 3,
                "topics": ["Relational Schemas", "Indexing & Query Optimization", "Foreign Key Cascades", "Alembic Migrations"],
                "outcomes": "Design resilient database structures that scale."
            },
            {
                "num": 4,
                "title": "Full-Stack Project Deployment & Docker",
                "duration_weeks": 3,
                "topics": ["Docker & Multi-Stage Builds", "CORS & Environment Variables", "Vercel & Render Deployment", "CI/CD Pipeline"],
                "outcomes": "Deploy full-stack web applications to live production environments."
            }
        ]
    },
    {
        "track_id": "DEVOPS_CLOUD",
        "title": "Cloud Computing & DevOps Engineering (AWS & Kubernetes)",
        "slug": "cloud-devops-aws",
        "category": "Cloud Infrastructure & SRE",
        "level": "Intermediate to Advanced",
        "color": "#ea580c",
        "academic_year": "2026-2027",
        "periods_per_week": 5,
        "description": "Hands-on DevOps engineering covering Linux administration, Docker containerization, Kubernetes cluster management, CI/CD, and AWS.",
        "subjects": [
            {
                "code": "DO-101",
                "name": "Linux Administration, Shell Scripting & Networking",
                "color": "#eab308",
                "duration_weeks": 3,
                "description": "Bash scripting, user permissions, systemd services, SSH, firewalls, and network inspection."
            },
            {
                "code": "DO-201",
                "name": "Docker Containerization & Kubernetes Orchestration",
                "color": "#0284c7",
                "duration_weeks": 4,
                "description": "Dockerfiles, compose, multi-stage builds, pods, deployments, services, ingress, and Helm charts."
            },
            {
                "code": "DO-301",
                "name": "AWS Cloud Architecture & CI/CD with GitHub Actions",
                "color": "#ea580c",
                "duration_weeks": 4,
                "description": "EC2, S3, RDS, IAM roles, GitHub Actions pipelines, and Terraform Infrastructure as Code."
            }
        ],
        "chapters": [
            {
                "num": 1,
                "title": "Linux Server Administration & Automation",
                "duration_weeks": 2,
                "topics": ["Bash Scripting & Cron Jobs", "Process Monitoring & Logs", "SSH Key Management", "Network Diagnostics (curl, netstat)"],
                "outcomes": "Automate routine server tasks with Bash scripts."
            },
            {
                "num": 2,
                "title": "Docker Containers & Image Optimization",
                "duration_weeks": 3,
                "topics": ["Dockerfile Best Practices", "Multi-Stage Lightweight Builds", "Docker Compose Multi-Container Stacks", "Container Security"],
                "outcomes": "Package applications into containerized microservices."
            },
            {
                "num": 3,
                "title": "Kubernetes Cluster Management",
                "duration_weeks": 3,
                "topics": ["Pods, ReplicaSets & Deployments", "ClusterIP, NodePort & Ingress", "ConfigMaps & Secrets", "Helm Package Manager"],
                "outcomes": "Orchestrate production container workloads with zero downtime."
            },
            {
                "num": 4,
                "title": "AWS Cloud Services & Terraform (IaC)",
                "duration_weeks": 3,
                "topics": ["AWS VPC, EC2 & S3", "IAM Least Privilege Access", "Terraform Declarative Provisioning", "State Locking with DynamoDB"],
                "outcomes": "Provision resilient cloud infrastructure automatically with Terraform."
            },
            {
                "num": 5,
                "title": "Continuous Integration & Deployment (CI/CD)",
                "duration_weeks": 3,
                "topics": ["GitHub Actions Workflows", "Automated Linting & Test Suites", "Docker Image Publishing", "Automated Kubernetes Rollouts"],
                "outcomes": "Build automated deployment pipelines from Git commit to production."
            }
        ]
    }
]

# Helper lookup
CHAPTERS_DB = {
    c["track_id"]: c["chapters"] for c in TECH_CURRICULUM
}

def get_chapters_for_subject(code: str, grade: int = 1) -> List[Dict[str, Any]]:
    """Returns syllabus chapters for technical course tracks."""
    code_upper = (code or "").upper()
    for track in TECH_CURRICULUM:
        if track["track_id"] == code_upper or track["slug"] == code.lower():
            return track["chapters"]
        for subj in track["subjects"]:
            if subj["code"] == code_upper:
                return track["chapters"]
    # Default to Python GenAI chapters
    return TECH_CURRICULUM[0]["chapters"]

get_chapters_for_subject_and_grade = get_chapters_for_subject
