import { callGroqDirect } from './langgraphAgent'

export interface SubjectQuestion {
  id: string
  subject: string
  concept_id: string
  concept_name: string
  prompt: string
  options: string[]
  correct_index: number
  difficulty: number
  cognitive_level: 'FOUNDATION' | 'APPLICATION' | 'REASONING' | 'TRANSFER'
  explanation: string
  misconception_tag: string
}

export async function fetchSubjectBenchmarkQuestions(
  gradeName: string,
  subject: string,
  numQuestions: number = 8
): Promise<SubjectQuestion[]> {
  const prompt = `You are a certified psychometric assessment designer.
Generate an authentic, high-quality ${numQuestions}-question benchmark test for **${gradeName} ${subject}**.

Return ONLY a JSON object with key "questions" containing ${numQuestions} questions formatted as follows:
{
  "questions": [
    {
      "id": "q1",
      "subject": "${subject}",
      "concept_id": "c_1",
      "concept_name": "Specific Concept Name",
      "prompt": "Detailed age-appropriate question prompt",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "difficulty": 0.45,
      "cognitive_level": "APPLICATION",
      "explanation": "Clear step-by-step mathematical or conceptual explanation.",
      "misconception_tag": "specific_misconception_signal"
    }
  ]
}

Strict Rules:
- All questions must be strictly appropriate for ${gradeName} standard curriculum in ${subject}.
- Vary cognitive levels (FOUNDATION, APPLICATION, REASONING, TRANSFER).
- Include distinct concept names so each concept can be evaluated individually.`

  try {
    const raw = await callGroqDirect(
      [
        { role: 'system', content: 'You are an educational psychometrics engine. Output valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      { jsonMode: true, temperature: 0.2 }
    )

    const parsed = JSON.parse(raw)
    if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed.questions.map((q: any, i: number) => ({
        id: q.id || `q_${subject.toLowerCase().replace(/\s+/g, '_')}_${i + 1}`,
        subject: subject,
        concept_id: q.concept_id || `c_${i + 1}`,
        concept_name: q.concept_name || `${subject} Core Concept ${i + 1}`,
        prompt: q.prompt,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['A', 'B', 'C', 'D'],
        correct_index: typeof q.correct_index === 'number' ? q.correct_index : 0,
        difficulty: typeof q.difficulty === 'number' ? q.difficulty : 0.5,
        cognitive_level: q.cognitive_level || 'APPLICATION',
        explanation: q.explanation || 'Correct step-by-step derivation.',
        misconception_tag: q.misconception_tag || 'concept_misconception',
      }))
    }
  } catch (err) {
    console.warn(`Groq live question generation fallback for ${subject}:`, err)
  }

  // High-fidelity fallback bank for technical training institute modules
  return [
    {
      id: `${subject}_fallback_1`,
      subject,
      concept_id: `${subject}_c1`,
      concept_name: `${subject} Architecture & Core Principles`,
      prompt: `In ${gradeName} (${subject}), which architectural pattern best ensures high availability, maintainability, and clean separation of concerns?`,
      options: [
        `Layered service and repository architecture with explicit contracts in ${subject}`,
        'Placing all database queries, UI logic, and business rules inside a single global script',
        'Suppressing all exceptions and error logging',
        'Hardcoding credentials and configurations directly in source files',
      ],
      correct_index: 0,
      difficulty: 0.35,
      cognitive_level: 'FOUNDATION',
      explanation: 'Layered architecture segregates business rules, data access, and transport layers cleanly.',
      misconception_tag: 'monolithic_coupling_misconception',
    },
    {
      id: `${subject}_fallback_2`,
      subject,
      concept_id: `${subject}_c2`,
      concept_name: `${subject} Production Diagnostics & Resilience`,
      prompt: `When debugging an unexpected latency bottleneck or throughput degradation in ${subject}, what is the recommended practice?`,
      options: [
        'Profile trace spans, inspect slow database queries, and analyze asynchronous event loop lag',
        'Restart the server repeatedly without reading error logs',
        'Disable all database indexing to speed up queries',
        'Remove request validation middleware',
      ],
      correct_index: 0,
      difficulty: 0.55,
      cognitive_level: 'APPLICATION',
      explanation: 'APM profiling and query execution plan analysis identify root performance bottlenecks systematically.',
      misconception_tag: 'blind_debugging_omission',
    },
  ]
}
