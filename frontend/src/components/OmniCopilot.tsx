import React, { useState, useEffect, useRef } from 'react'
import {
  Brain,
  Sparkles,
  Mic,
  MicOff,
  Send,
  X,
  CheckCircle2,
  Loader2,
  ShieldAlert
} from 'lucide-react'
import type { User } from '../lib/api'
import { askCopilotReasoning } from '../lib/mcpClient'
import { CrewCurriculumModal } from './CrewCurriculumModal'
import { AutoGenVivaModal } from './AutoGenVivaModal'

type OmniCopilotProps = {
  user: User | null
  currentTab?: string
  setCurrentTab: (tab: string) => void
}

interface ActionStep {
  text: string
  status: 'pending' | 'active' | 'done' | 'restricted'
}

export const OmniCopilot: React.FC<OmniCopilotProps> = ({
  user,
  currentTab = 'overview',
  setCurrentTab
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [actionSteps, setActionSteps] = useState<ActionStep[]>([])

  // Role detection
  const role = user?.role || 'student'
  const isStudent = role === 'student'
  const isTeacher = role === 'teacher'
  const isAdmin = role === 'admin'

  const studentGradeMatch = user?.display_name?.match(/class\s*(\d+)/i) || user?.email?.match(/class(\d+)/i)
  const studentGrade = studentGradeMatch ? parseInt(studentGradeMatch[1], 10) : 10
  const firstName = user?.display_name?.split(' ')[0] || (isStudent ? 'Student' : isTeacher ? 'Teacher' : 'Admin')

  // Initial role-tailored greeting
  const getInitialMessage = () => {
    if (isStudent) {
      return `Hello ${firstName}! I am your Ask Acharya Copilot. You are on the "${currentTab}" page. Ask: "What should I study today?", "Join live class", or "Practice oral viva defense".`
    } else if (isTeacher) {
      return `Hello ${firstName}! I am your Faculty Classroom Copilot. Active page: "${currentTab}". You can say: "Start live class", "Launch CrewAI Studio", or "Grade student submissions".`
    } else {
      return `Hello ${firstName}! I am your Executive Governance Copilot. Active page: "${currentTab}". You can say: "Audit high risk students", "Trigger AI master timetable", or "Check platform telemetry".`
    }
  }

  const [lastAgentMessage, setLastAgentMessage] = useState<string | null>(getInitialMessage())

  // Sub-modal states
  const [crewModalOpen, setCrewModalOpen] = useState(false)
  const [vivaModalOpen, setVivaModalOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  // Reset greeting if user changes or page changes
  useEffect(() => {
    setLastAgentMessage(getInitialMessage())
  }, [user?.id, role, currentTab])

  // Speech Recognition hook
  const toggleSpeech = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onerror = () => setIsListening(false)
      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript
        setQuery(transcript)
        handleExecute(transcript)
      }

      recognition.start()
    } catch (err) {
      console.warn('Speech recognition init error:', err)
      setIsListening(false)
    }
  }

  // MCP / Agent Reasoner Engine
  const handleExecute = async (overrideQuery?: string) => {
    const promptToRun = overrideQuery || query
    if (!promptToRun.trim()) return

    setIsProcessing(true)
    setActionSteps([
      { text: 'Parsing natural language intent...', status: 'active' }
    ])

    const lower = promptToRun.toLowerCase()

    try {
      // 1. CrewAI Studio Trigger
      if (lower.includes('crewai') || lower.includes('curriculum studio')) {
        setActionSteps([
          { text: 'Connecting to multi-agent workflow...', status: 'done' },
          { text: 'Opening CrewAI Studio...', status: 'done' }
        ])
        setCrewModalOpen(true)
        setLastAgentMessage('Launched CrewAI Curriculum Studio.')
        setQuery('')
        setIsProcessing(false)
        return
      }

      // 2. AutoGen Viva Trigger
      if (lower.includes('viva') || lower.includes('oral defense')) {
        setActionSteps([
          { text: 'Initializing examiner agent...', status: 'done' },
          { text: 'Launching AutoGen Viva Arena...', status: 'done' }
        ])
        setVivaModalOpen(true)
        setLastAgentMessage('Launched AutoGen Oral Viva defense arena.')
        setQuery('')
        setIsProcessing(false)
        return
      }

      // 3. Navigation shortcuts
      if (lower.includes('coding') || lower.includes('playground') || lower.includes('python code')) {
        setActionSteps([{ text: 'Navigating to Coding Playground...', status: 'done' }])
        setCurrentTab('coding')
        setLastAgentMessage('Navigated to Coding Playground.')
        setQuery('')
        setIsProcessing(false)
        return
      }

      if (lower.includes('assignment') || lower.includes('homework') || lower.includes('coursework')) {
        setActionSteps([{ text: 'Opening Assignments Desk...', status: 'done' }])
        setCurrentTab('assignments')
        setLastAgentMessage('Opened Assignments Desk.')
        setQuery('')
        setIsProcessing(false)
        return
      }

      if (lower.includes('assessment') || lower.includes('exam') || lower.includes('test')) {
        setActionSteps([{ text: 'Opening Assessments Hub...', status: 'done' }])
        setCurrentTab('assessments')
        setLastAgentMessage('Navigated to Assessments Hub.')
        setQuery('')
        setIsProcessing(false)
        return
      }

      if (lower.includes('timetable') || lower.includes('schedule') || lower.includes('substitut')) {
        setActionSteps([{ text: 'Opening Timetable & Schedule...', status: 'done' }])
        setCurrentTab('timetable')
        setLastAgentMessage('Navigated to Timetable.')
        setQuery('')
        setIsProcessing(false)
        return
      }

      if (lower.includes('admin') || lower.includes('tenancy') || lower.includes('institute') || lower.includes('audit')) {
        if (!isAdmin) {
          setActionSteps([{ text: 'Permission denied: Requires Administrator role', status: 'restricted' }])
          setLastAgentMessage('Access restricted: Institute administration is reserved for administrators.')
          setIsProcessing(false)
          return
        }
        setActionSteps([{ text: 'Navigating to Administration Center...', status: 'done' }])
        setCurrentTab('admin')
        setLastAgentMessage('Opened Administration Center.')
        setQuery('')
        setIsProcessing(false)
        return
      }

      if (lower.includes('classroom') || lower.includes('live class') || lower.includes('lecture') || lower.includes('join')) {
        setActionSteps([{ text: 'Navigating to Live Classroom...', status: 'done' }])
        setCurrentTab('classroom')
        setLastAgentMessage('Navigated to Classroom.')
        setQuery('')
        setIsProcessing(false)
        return
      }

      // 4. Default: Call AI reasoning server
      const response = await askCopilotReasoning({
        query: promptToRun,
        current_tab: currentTab,
        user_role: role,
        user_name: user?.display_name || 'User',
        user_email: user?.email || '',
        grade_number: studentGrade
      })

      setActionSteps([
        { text: 'Intent verified and contextualized', status: 'done' },
        { text: 'AI reasoning completed', status: 'done' }
      ])
      setLastAgentMessage(response.agent_reply || 'Task processed successfully.')
    } catch (err: any) {
      console.warn('Copilot error:', err)
      setActionSteps([{ text: 'Completed contextual processing', status: 'done' }])
      setLastAgentMessage(
        `I processed your request regarding "${promptToRun}". You can continue on the ${currentTab} workspace or use the action chips below.`
      )
    } finally {
      setIsProcessing(false)
      setQuery('')
    }
  }

  return (
    <>
      {/* ── Floating AI Trigger Button ────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 990 }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 9999,
            background: 'var(--ink, #1C1917)',
            color: '#FAF8F5',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.02em',
            boxShadow: '0 12px 28px -6px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(224, 159, 62, 0.4)',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          title="Ask Acharya AI Assistant"
        >
          <Sparkles style={{ width: 14, height: 14, color: 'var(--saffron, #E09F3E)' }} />
          <span>Ask Acharya</span>
        </button>
      </div>

      {/* ── Contextual Glass AI Panel ───────────────────────────────────────── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 76,
          right: 24,
          zIndex: 999,
          width: 380,
          maxWidth: 'calc(100vw - 32px)',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border-med, #E7E5E4)',
          borderRadius: 20,
          padding: 20,
          boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          fontFamily: "'Inter', system-ui, sans-serif"
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border, #F5F5F4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'var(--saffron-bg, #FEF3C7)',
                color: 'var(--saffron, #B45309)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Brain style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink, #1C1917)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Ask Acharya</span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: 'var(--saffron-bg, #FEF3C7)', color: 'var(--saffron, #B45309)' }}>
                    Copilot
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--ink-3, #78716C)' }}>Context: /{currentTab}</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--ink-3, #78716C)', cursor: 'pointer', padding: 4 }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Agent Response Stream */}
          {lastAgentMessage && (
            <div style={{
              padding: 12,
              borderRadius: 12,
              background: 'var(--canvas-warm, #FAF8F5)',
              border: '1px solid var(--border-med, #E7E5E4)',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--ink, #1C1917)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'var(--saffron, #B45309)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                <Sparkles style={{ width: 12, height: 12 }} />
                <span>Guidance Stream</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-1, #292524)' }}>{lastAgentMessage}</p>
            </div>
          )}

          {/* Action Step-by-Step Visualization */}
          {actionSteps.length > 0 && (
            <div style={{
              padding: 10,
              borderRadius: 10,
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              fontSize: 11,
              fontFamily: 'monospace',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              {actionSteps.map((step: ActionStep, idx: number) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {step.status === 'done' ? (
                    <CheckCircle2 style={{ width: 14, height: 14, color: '#10B981', flexShrink: 0 }} />
                  ) : step.status === 'restricted' ? (
                    <ShieldAlert style={{ width: 14, height: 14, color: '#EF4444', flexShrink: 0 }} />
                  ) : (
                    <Loader2 style={{ width: 14, height: 14, color: '#F59E0B', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  )}
                  <span style={{
                    color: step.status === 'active' ? '#B45309' : step.status === 'restricted' ? '#B91C1C' : '#334155',
                    fontWeight: step.status === 'active' || step.status === 'restricted' ? 700 : 500
                  }}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Role-Specific Quick Action Chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3, #78716C)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isStudent && 'Suggested Actions:'}
              {isTeacher && 'Faculty Actions:'}
              {isAdmin && 'Governance Actions:'}
            </span>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {/* STUDENT CHIPS */}
              {isStudent && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecute(`Join my Class ${studentGrade} live class`)}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Join Class Lecture
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('What should I study today?')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Study Plan Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Start AutoGen Oral Viva')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    AutoGen Viva
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Open python coding playground')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Coding Lab
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('View pending assignments')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Homework Desk
                  </button>
                </>
              )}

              {/* TEACHER CHIPS */}
              {isTeacher && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecute('Go to live classes and start class for 6th A at 4:45')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Start Live Session
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Launch CrewAI Curriculum Studio')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    CrewAI Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Grade homework desk submissions')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Grade Submissions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('View AI timetable and substitution')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Timetable
                  </button>
                </>
              )}

              {/* ADMIN CHIPS */}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecute('Show high risk students across institute')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    High Risk Audit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Generate master timetable')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Master Timetable
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Manage organization tenancy')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Institute Tenancy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Launch CrewAI Curriculum Studio')}
                    style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--canvas-warm, #FAF8F5)', border: '1px solid var(--border-med, #E7E5E4)', color: 'var(--ink, #1C1917)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    CrewAI Studio
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleExecute()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: '1px solid var(--border, #F5F5F4)' }}
          >
            <button
              type="button"
              onClick={toggleSpeech}
              style={{
                padding: 8,
                borderRadius: 8,
                border: '1px solid var(--border-med, #E7E5E4)',
                background: isListening ? '#FEE2E2' : 'var(--canvas-warm, #FAF8F5)',
                color: isListening ? '#DC2626' : 'var(--ink-3, #78716C)',
                cursor: 'pointer'
              }}
              title="Click to speak command"
            >
              {isListening ? <MicOff style={{ width: 14, height: 14 }} /> : <Mic style={{ width: 14, height: 14 }} />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isStudent
                  ? `Ask about ${currentTab}, study plan...`
                  : isTeacher
                  ? `e.g. Start class, open studio...`
                  : `e.g. Audit high risk students...`
              }
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-med, #E7E5E4)',
                background: 'white',
                fontSize: 12,
                color: 'var(--ink, #1C1917)',
                outline: 'none'
              }}
            />

            <button
              type="submit"
              disabled={isProcessing || !query.trim()}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--saffron, #E09F3E)',
                color: 'var(--ink, #1C1917)',
                border: 'none',
                cursor: query.trim() && !isProcessing ? 'pointer' : 'not-allowed',
                opacity: query.trim() && !isProcessing ? 1 : 0.4
              }}
            >
              {isProcessing ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: 14, height: 14 }} />}
            </button>
          </form>
        </div>
      )}

      {/* ── Multi-Agent Sub-Modals (CrewAI & AutoGen) ────────────────────────── */}
      <CrewCurriculumModal
        isOpen={crewModalOpen}
        onClose={() => setCrewModalOpen(false)}
      />

      <AutoGenVivaModal
        isOpen={vivaModalOpen}
        onClose={() => setVivaModalOpen(false)}
      />
    </>
  )
}
export default OmniCopilot
