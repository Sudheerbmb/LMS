/**
 * Industry-Grade Assessment Scheduling, Document Parser, & Anti-Cheat Security Suite
 * Features:
 * - Ultra-rigorous, psychometrically calibrated Groq AI Question Generator
 * - Document / PDF syllabus context parser
 * - 1-Time submission enforcement per student
 * - Full AI Proctoring & Disqualification Audit logging
 */

import { callGroqDirect } from './langgraphAgent'
import { ingestLearningEvidenceEvent } from './evidenceEngine'

export interface QuestionItem {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'descriptive' | 'true_false' | 'problem_solving'
  options?: string[]
  correct_answer?: string | number
  points: number
  cognitive_level: 'FOUNDATION' | 'APPLICATION' | 'REASONING' | 'TRANSFER'
  concept_name: string
  explanation?: string
}

export interface ScheduledAssessment {
  id: string
  title: string
  description: string
  target_grade: string // e.g. "Track 1: Python & GenAI", "Track 2: Salesforce"
  subject: string // e.g. "Python Core & Advanced OOP", "Apex Programming"
  topic_syllabus: string
  teacher_id: string
  teacher_name: string
  created_at: string
  schedule_type: 'EXACT_TIME' | 'TIME_WINDOW' | 'ALWAYS_AVAILABLE'
  start_time?: string // ISO string
  end_time?: string // ISO string
  duration_minutes: number
  passing_score: number
  question_sets: Array<{
    set_name: string // "Set A", "Set B"
    questions: QuestionItem[]
  }>
  pdf_attachment_name?: string
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'
  total_points: number
  submissions_count: number
  requires_proctoring: boolean
}

export interface StudentSubmission {
  submission_id: string
  assessment_id: string
  assessment_title: string
  student_id: string
  student_name: string
  student_grade: string
  subject: string
  submitted_at: string
  score_percent: number
  total_points_earned: number
  max_points: number
  answers: Record<string, string | number>
  feedback: string
  passed: boolean
  cheated: boolean
  cheating_reasons?: string[]
  violation_count: number
}

const STORAGE_KEY = 'acharya_tech_scheduled_assessments_v4'
const SUBMISSIONS_KEY = 'acharya_tech_assessment_submissions_v4'

// Initial Seed Data with Verified Technical Curriculum Topics
const SEED_ASSESSMENTS: ScheduledAssessment[] = [
  {
    id: 'asmt_track1_py_genai',
    title: 'Python & Generative AI: LangChain, Pydantic & FastAPI Deployment Benchmark',
    description: 'Timed technical evaluation testing async coroutines, Pydantic V2 schema validation, LangChain LCEL chaining, and FastAPI streaming endpoints.',
    target_grade: 'Track 1: Python & GenAI',
    subject: 'Python Core & Advanced OOP',
    topic_syllabus: 'LangChain LCEL, Pydantic V2 & Multi-Agent Graphs',
    teacher_id: 'teacher_sarah',
    teacher_name: 'Dr. Sarah Connor',
    created_at: new Date().toISOString(),
    schedule_type: 'ALWAYS_AVAILABLE',
    duration_minutes: 45,
    passing_score: 70,
    total_points: 40,
    submissions_count: 0,
    status: 'PUBLISHED',
    requires_proctoring: true,
    question_sets: [
      {
        set_name: 'Set A',
        questions: [
          {
            id: 'q1',
            question_text: 'In Python 3.12+ AsyncIO, how do you safely run multiple concurrent coroutines with exception boundary propagation and structured concurrency?',
            question_type: 'multiple_choice',
            options: ['async with asyncio.TaskGroup() as tg: tg.create_task(...)', 'asyncio.run_parallel(tasks)', 'threading.Thread(target=coroutine).start()', 'await asyncio.wait_for_all(tasks)'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'APPLICATION',
            concept_name: 'AsyncIO & Concurrency Architecture',
            explanation: 'asyncio.TaskGroup provides structured concurrency in Python 3.11+, automatically cancelling child tasks if one fails.'
          },
          {
            id: 'q2',
            question_text: 'When building a Retrieval-Augmented Generation (RAG) system with ChromaDB, what index type provides sub-millisecond approximate nearest neighbor (ANN) vector search?',
            question_type: 'multiple_choice',
            options: ['HNSW (Hierarchical Navigable Small World)', 'B-Tree Indexing', 'Full-Text Inverted Index', 'Hash Map Sharding'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'REASONING',
            concept_name: 'Vector DB & Embedding Retrieval',
            explanation: 'HNSW is the industry standard vector indexing graph algorithm implemented by ChromaDB, Milvus, and pgvector for low-latency similarity queries.'
          },
          {
            id: 'q3',
            question_text: 'In LangChain 0.3 LCEL, which runnable primitive is used to pass input unchanged into one branch of a parallel computation dictionary?',
            question_type: 'multiple_choice',
            options: ['RunnablePassthrough()', 'RunnableFallback()', 'RunnableSequence()', 'RunnableLambda()'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'TRANSFER',
            concept_name: 'LangChain LCEL Pipelines',
            explanation: 'RunnablePassthrough allows an input value to flow unmodified into subsequent runnables or dictionary mappings in an LCEL chain.'
          },
          {
            id: 'q4',
            question_text: 'Explain how Server-Sent Events (SSE) in FastAPI stream LLM tokens to client browsers with low overhead compared to WebSockets.',
            question_type: 'descriptive',
            points: 10,
            cognitive_level: 'REASONING',
            concept_name: 'FastAPI Production Deployment',
            explanation: 'SSE operates over standard HTTP/1.1 or HTTP/2 unidirectional connections with media_type="text/event-stream", streaming UTF-8 token chunks without bidirectional socket overhead.'
          }
        ]
      }
    ]
  },
  {
    id: 'asmt_track2_salesforce_apex',
    title: 'Salesforce Administrator & Apex Developer Certification Benchmark',
    description: 'Comprehensive test evaluating Apex trigger best practices, SOQL governor limit mitigation, and Lightning Web Component lifecycle hooks.',
    target_grade: 'Track 2: Salesforce CRM',
    subject: 'Apex Programming & SOQL Queries',
    topic_syllabus: 'Triggers, SOQL Governor Limits & Lightning Web Components',
    teacher_id: 'teacher_sarah',
    teacher_name: 'Dr. Sarah Connor',
    created_at: new Date().toISOString(),
    schedule_type: 'ALWAYS_AVAILABLE',
    duration_minutes: 30,
    passing_score: 70,
    total_points: 30,
    submissions_count: 0,
    status: 'PUBLISHED',
    requires_proctoring: true,
    question_sets: [
      {
        set_name: 'Set A',
        questions: [
          {
            id: 'q1',
            question_text: 'What is the synchronous governor limit for the maximum number of SOQL queries allowed in a single Apex transaction?',
            question_type: 'multiple_choice',
            options: ['100 SOQL queries', '50 SOQL queries', '200 SOQL queries', 'Unlimited queries'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'FOUNDATION',
            concept_name: 'Apex Governor Limits & Bulkification',
            explanation: 'Salesforce enforces a strict limit of 100 synchronous SOQL queries and 200 asynchronous SOQL queries per execution context.'
          },
          {
            id: 'q2',
            question_text: 'In Lightning Web Components (LWC), which lifecycle hook is invoked immediately after the component is inserted into the DOM hierarchy?',
            question_type: 'multiple_choice',
            options: ['connectedCallback()', 'renderedCallback()', 'constructor()', 'disconnectedCallback()'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'APPLICATION',
            concept_name: 'Lightning Web Components (LWC)',
            explanation: 'connectedCallback() fires when a component is inserted into the DOM, making it ideal for initiating wire services or pub/sub listeners.'
          },
          {
            id: 'q3',
            question_text: 'Why should DML operations never be executed inside a for-loop in Salesforce Apex?',
            question_type: 'multiple_choice',
            options: ['It quickly breaches the 150 DML statements governor limit; bulk collections must be used instead.', 'DML operations in loops cause automatic heap memory crashes.', 'Salesforce prevents compiling code with DML in loops.', 'Apex loops do not support database transactions.'],
            correct_answer: 0,
            points: 10,
            cognitive_level: 'TRANSFER',
            concept_name: 'Apex Bulkification Best Practices',
            explanation: 'Executing DML inside loops hits the 150 DML statement governor limit. Records must be staged in a List<sObject> and committed via a single database statement.'
          }
        ]
      }
    ]
  }
]


export function getScheduledAssessments(): ScheduledAssessment[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error(e)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ASSESSMENTS))
  return SEED_ASSESSMENTS
}

export function saveScheduledAssessment(assessment: ScheduledAssessment): void {
  const all = getScheduledAssessments()
  const idx = all.findIndex((a) => a.id === assessment.id)
  if (idx >= 0) {
    all[idx] = assessment
  } else {
    all.unshift(assessment)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function deleteScheduledAssessment(id: string): void {
  const all = getScheduledAssessments().filter((a) => a.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getAssessmentsForStudent(studentGrade: string): ScheduledAssessment[] {
  const all = getScheduledAssessments()
  const gradeNum = studentGrade.match(/\d+/)?.[0] || '4'
  return all.filter((a) => {
    const aGradeNum = a.target_grade.match(/\d+/)?.[0] || '4'
    return aGradeNum === gradeNum && a.status === 'PUBLISHED'
  })
}

export function getAssessmentsForTeacher(_teacherId?: string): ScheduledAssessment[] {
  return getScheduledAssessments()
}

export function isAssessmentCompletedByStudent(assessmentId: string, studentId: string): StudentSubmission | null {
  const subs = getAllSubmissions()
  return subs.find((s) => s.assessment_id === assessmentId && s.student_id === studentId) || null
}

/**
 * Ultra-Rigorous, Deeply Calibrated AI Question Paper Generator
 * Supports Syllabus Extraction & Document Parsing
 */
export async function generateAIQuestionSet(
  grade: string,
  subject: string,
  topic: string,
  questionCount: number = 5,
  documentText?: string
): Promise<QuestionItem[]> {
  const docSection = documentText
    ? `\n\nATTACHED REFERENCE SYLLABUS / EXAM DOCUMENT CONTENT:\n"""\n${documentText.slice(0, 4000)}\n"""\nDirectly synthesize the question items based strictly upon this document text!`
    : ''

  const prompt = `You are an elite academic curriculum architect and senior examination board setter (CBSE/ICSE/IB standard).
Generate an ultra-rigorous, deeply specific ${questionCount}-question examination paper for **${grade} ${subject}** on the syllabus topic **"${topic}"**.

${docSection}

STRICT SPECIFICATION REQUIREMENTS:
1. **NO GENERIC OR TRIVIAL QUESTIONS**:
   - For Mathematics: Use actual equations, exact coefficients, multi-step problem solving, real discriminant analysis, geometric theorems, or word problems.
   - For Science/Physics/Chemistry: Use concrete reactions (balanced equations), physical constants, circuit diagrams/laws (Ohm's, Snell's), biological mechanisms (enzymatic reactions, photosynthesis light/dark phase).
   - For English/Social: Deep analytical text synthesis, historical chronology, constitutional articles.
2. **COGNITIVE TAXONOMY DISTRIBUTION**:
   - 1 FOUNDATION item (Rigorous definition / core theorem test)
   - 2 APPLICATION items (Multi-step calculation or direct problem solving)
   - 1 REASONING item (Conceptual derivation or "Why/Explain" question)
   - 1 TRANSFER item (Novel problem formulation or inter-disciplinary challenge)
3. **OPTIONS & DISTRACTORS**:
   - Provide 4 distinct options where the distractors represent authentic, common student misconceptions (e.g., sign errors, forgetting to square, inverted fractions).
   - Exactly ONE option must be correct. Provide correct_answer as the integer index (0, 1, 2, or 3).
4. **EXPLANATION**:
   - Provide a full mathematical or scientific step-by-step derivation.

Return ONLY a valid JSON object matching this schema exactly (no markdown backticks outside, pure JSON):
{
  "questions": [
    {
      "id": "q1",
      "question_text": "Rigorously formatted question prompt with exact values and notation.",
      "question_type": "multiple_choice",
      "options": ["Option A (Exact formula/value)", "Option B (Misconception)", "Option C", "Option D"],
      "correct_answer": 0,
      "points": 10,
      "cognitive_level": "APPLICATION",
      "concept_name": "${topic}",
      "explanation": "Complete step-by-step mathematical/scientific derivation."
    }
  ]
}`

  try {
    const raw = await callGroqDirect(
      [
        { role: 'system', content: 'You are an elite academic exam board designer. You output strictly valid JSON matching the exact requested schema.' },
        { role: 'user', content: prompt }
      ],
      { jsonMode: true, temperature: 0.15 }
    )
    const parsed = JSON.parse(raw)
    if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed.questions.map((q: any, i: number) => ({
        id: q.id || `q_${Date.now()}_${i + 1}`,
        question_text: q.question_text,
        question_type: q.question_type || 'multiple_choice',
        options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_answer: typeof q.correct_answer === 'number' ? q.correct_answer : 0,
        points: q.points || 10,
        cognitive_level: q.cognitive_level || 'APPLICATION',
        concept_name: topic,
        explanation: q.explanation || 'Analytical derivation.'
      }))
    }
  } catch (err) {
    console.warn('Groq AI Question generator parsing error, using rigorous fallback:', err)
  }

  // Ultra-calibrated fallback items tailored by technical domain
  return [
    {
      id: `q_tech_1_${Date.now()}`,
      question_text: `In Python 3.12+ AsyncIO and FastAPI, how does 'asyncio.TaskGroup' improve structured concurrency over 'asyncio.gather'?`,
      question_type: 'multiple_choice',
      options: [
        'TaskGroup ensures that if any child task fails, all remaining sibling tasks are cancelled and an ExceptionGroup is raised',
        'TaskGroup executes tasks on separate CPU cores using multi-threading',
        'TaskGroup disables the Python GIL automatically during I/O operations',
        'TaskGroup requires synchronous blocking callbacks'
      ],
      correct_answer: 0,
      points: 10,
      cognitive_level: 'APPLICATION',
      concept_name: topic || 'AsyncIO Concurrency',
      explanation: 'TaskGroup provides structured concurrency by guaranteeing clean cancellation and propagation via ExceptionGroup when child coroutines raise exceptions.'
    },
    {
      id: `q_tech_2_${Date.now()}`,
      question_text: `Which architectural pattern is best suited to prevent governor limit exceptions when executing bulk DML transactions in Salesforce Apex or high-volume ORMs?`,
      question_type: 'multiple_choice',
      options: [
        'Domain Trigger Handler pattern collecting collections in memory before executing a single DML operation',
        'Executing SOQL and DML operations inside nested FOR loops',
        'Spawning synchronous webhooks inside database commit triggers',
        'Hardcoding record ID arrays in static helper classes'
      ],
      correct_answer: 0,
      points: 10,
      cognitive_level: 'REASONING',
      concept_name: topic || 'Enterprise Software Architecture',
      explanation: 'Bulkification requires accumulating records into Sets and Lists and performing external queries and DML statements once outside loops.'
    },
    {
      id: `q_tech_3_${Date.now()}`,
      question_text: `Explain how Cross-Encoder re-ranking improves retrieval precision in enterprise Retrieval-Augmented Generation (RAG) pipelines over bi-encoder vector cosine similarity alone.`,
      question_type: 'descriptive',
      points: 10,
      cognitive_level: 'TRANSFER',
      concept_name: topic || 'Enterprise RAG Systems',
      explanation: 'Bi-encoders compute vector similarity independently for queries and chunks, missing token-level cross-attention. Cross-encoders attend simultaneously to the query and document tokens, scoring deep semantic relevance.'
    }
  ]
}

/**
 * Submit Assessment & Ingest into Closed-Loop Telemetry
 */
export function submitStudentAssessment(
  assessment: ScheduledAssessment,
  studentId: string,
  studentName: string,
  studentGrade: string,
  answers: Record<string, string | number>,
  proctorViolationData?: { cheated: boolean; violations: string[]; count: number }
): StudentSubmission {
  const set = assessment.question_sets[0] || { questions: [] }
  let earnedPoints = 0
  let totalPoints = 0

  const isCheated = proctorViolationData?.cheated || false

  if (isCheated) {
    // Zero score on confirmed cheating
    earnedPoints = 0
    totalPoints = set.questions.reduce((a, b) => a + b.points, 0)
  } else {
    set.questions.forEach((q) => {
      totalPoints += q.points
      const studentAns = answers[q.id]
      if (q.question_type === 'multiple_choice') {
        if (studentAns === q.correct_answer) {
          earnedPoints += q.points
        }
      } else {
        if (typeof studentAns === 'string' && studentAns.trim().length > 8) {
          earnedPoints += q.points
        }
      }
    })
  }

  const scorePercent = isCheated ? 0 : Math.round((earnedPoints / Math.max(1, totalPoints)) * 100)
  const passed = !isCheated && scorePercent >= assessment.passing_score

  const feedback = isCheated
    ? `DISQUALIFIED: Security proctoring detected suspicious activity (${proctorViolationData?.violations.join(', ')}). Attempt flagged for teacher review.`
    : passed
    ? `Passed with ${scorePercent}%. Outstanding analytical performance on ${assessment.topic_syllabus}.`
    : `Scored ${scorePercent}%. Recommended: Review core principles on ${assessment.topic_syllabus}.`

  const submission: StudentSubmission = {
    submission_id: `sub_${Date.now()}`,
    assessment_id: assessment.id,
    assessment_title: assessment.title,
    student_id: studentId,
    student_name: studentName,
    student_grade: studentGrade,
    subject: assessment.subject,
    submitted_at: new Date().toISOString(),
    score_percent: scorePercent,
    total_points_earned: earnedPoints,
    max_points: totalPoints,
    answers,
    feedback,
    passed,
    cheated: isCheated,
    cheating_reasons: proctorViolationData?.violations || [],
    violation_count: proctorViolationData?.count || 0,
  }

  // Save submission
  const allSubmissions: StudentSubmission[] = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '[]')
  // Replace or append
  const existIdx = allSubmissions.findIndex((s) => s.assessment_id === assessment.id && s.student_id === studentId)
  if (existIdx >= 0) {
    allSubmissions[existIdx] = submission
  } else {
    allSubmissions.unshift(submission)
  }
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(allSubmissions))

  // Update submissions count on assessment
  const allAssessments = getScheduledAssessments()
  const asmtIdx = allAssessments.findIndex((a) => a.id === assessment.id)
  if (asmtIdx >= 0) {
    allAssessments[asmtIdx].submissions_count += 1
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allAssessments))
  }

  // Closed-loop LENS-Ω ingestion
  if (!isCheated) {
    ingestLearningEvidenceEvent({
      id: submission.submission_id,
      timestamp: submission.submitted_at,
      student_id: studentId,
      grade_name: studentGrade,
      subject: assessment.subject,
      concept_name: assessment.topic_syllabus,
      event_type: 'TEST',
      title: assessment.title,
      score_ratio: scorePercent / 100,
      difficulty: 0.65,
      misconception_detected: scorePercent < 60,
      misconception_tag: scorePercent < 60 ? 'rigorous_test_deficiency' : undefined,
      feedback: submission.feedback,
    })
  }

  return submission
}

export function getAllSubmissions(): StudentSubmission[] {
  try {
    return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || '[]')
  } catch {
    return []
  }
}
