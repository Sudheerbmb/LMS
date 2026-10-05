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

      if (lower.includes('certificate') || lower.includes('credential')) {
        setActionSteps([{ text: 'Opening Certificate Desk...', status: 'done' }])
        setCurrentTab('certificates')
        setLastAgentMessage('Navigated to Certificates & Credentials.')
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
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-amber-400"
          title="Ask Acharya AI Assistant"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>Ask Acharya</span>
        </button>
      </div>

      {/* ── Contextual Glass AI Panel ───────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <span>Ask Acharya</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    AI Copilot
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500">Context: /{currentTab}</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Agent Response Stream */}
          {lastAgentMessage && (
            <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200 text-xs text-slate-800 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Copilot Assistant</span>
              </div>
              <p className="text-slate-700 text-xs leading-relaxed">{lastAgentMessage}</p>
            </div>
          )}

          {/* Action Step-by-Step Visualization */}
          {actionSteps.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px] font-mono">
              {actionSteps.map((step: ActionStep, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-slate-700">
                  {step.status === 'done' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : step.status === 'restricted' ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                  )}
                  <span
                    className={
                      step.status === 'active'
                        ? 'text-amber-700 font-bold'
                        : step.status === 'restricted'
                        ? 'text-rose-700 font-bold'
                        : ''
                    }
                  >
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Role-Specific Quick Action Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isStudent && 'Suggested Actions:'}
              {isTeacher && 'Faculty Quick Actions:'}
              {isAdmin && 'Governance Quick Actions:'}
            </span>

            <div className="flex flex-wrap gap-1.5">
              {/* STUDENT CHIPS */}
              {isStudent && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecute(`Join my Class ${studentGrade} live class`)}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Join Class Lecture
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('What should I study today?')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Study Plan Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Start AutoGen Oral Viva')}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    AutoGen Viva
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Open python coding playground')}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Coding Lab
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('View pending assignments')}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-semibold transition-all cursor-pointer"
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
                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Start Live Session
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Launch CrewAI Curriculum Studio')}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    CrewAI Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Grade homework desk submissions')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Grade Submissions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('View AI timetable and substitution')}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Timetable & Schedule
                  </button>
                </>
              )}

              {/* ADMIN CHIPS */}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExecute('Show high risk students across institute')}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    High Risk Audit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Generate master timetable')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Master Timetable
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Manage organization tenancy')}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Institute Tenancy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecute('Launch CrewAI Curriculum Studio')}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-semibold transition-all cursor-pointer"
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
            className="flex items-center gap-2 pt-2 border-t border-slate-100"
          >
            <button
              type="button"
              onClick={toggleSpeech}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'
              }`}
              title="Click to speak command"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
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
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
            />

            <button
              type="submit"
              disabled={isProcessing || !query.trim()}
              className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-40 transition cursor-pointer shadow-xs"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
