import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Send,
  FileText,
  CheckCircle2,
  X,
  ExternalLink,
  Video,
  Clock,
  User,
  BookOpen,
  RefreshCw,
  AlignLeft,
  Copy
} from 'lucide-react'
import { askClassAiDoubt, getClassAiSummary, getClassTranscript, getApiBaseUrl } from '../lib/api'
import type { ClassAiSummaryData, AgentAction } from '../lib/api'

export interface ClassInfo {
  id?: string
  title?: string
  subject?: string
  subject_name?: string
  grade?: string | number
  grade_number?: number
  teacher_name?: string
  scheduled_start?: string
  starts_at?: string
  [key: string]: any
}

interface AiRecordingPlayerModalProps {
  recordingUrl: string
  classInfo?: ClassInfo | null
  onClose: () => void
}

interface ChatMessage {
  id: string
  sender: 'ai' | 'user'
  text: string
  timestamp: string
  actions?: AgentAction[]
  suggestedFollowups?: string[]
}

export const AiRecordingPlayerModal: React.FC<AiRecordingPlayerModalProps> = ({
  recordingUrl,
  classInfo,
  onClose,
}) => {
  const isVimeo = !!(recordingUrl && (recordingUrl.includes('vimeo.com') || recordingUrl.includes('player.vimeo.com')))
  let vimeoEmbedUrl = ''
  if (isVimeo && recordingUrl) {
    if (recordingUrl.includes('player.vimeo.com/video/')) {
      vimeoEmbedUrl = recordingUrl.includes('autoplay=')
        ? recordingUrl
        : `${recordingUrl}${recordingUrl.includes('?') ? '&' : '?'}autoplay=1&title=0&byline=0`
    } else {
      const vimeoMatch = recordingUrl.match(/(?:vimeo\.com\/(?:video\/|manage\/videos\/)?|player\.vimeo\.com\/video\/)(\d+)(?:\/([a-zA-Z0-9]+))?/)
      const vimeoId = vimeoMatch ? vimeoMatch[1] : ''
      const vimeoHash = vimeoMatch && vimeoMatch[2] ? vimeoMatch[2] : ''
      if (vimeoId) {
        vimeoEmbedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0${vimeoHash ? `&h=${vimeoHash}` : ''}`
      } else {
        vimeoEmbedUrl = recordingUrl
      }
    }
  }

  const isZoom = !!(recordingUrl && (recordingUrl.includes('zoom.us') || recordingUrl.includes('zoomgov.com')))
  const isDirectVideo = !!(recordingUrl && (
    recordingUrl.includes('.mp4') ||
    recordingUrl.includes('.webm') ||
    recordingUrl.includes('cloudinary.com') ||
    recordingUrl.startsWith('blob:')
  ))
  const [activeTab, setActiveTab] = useState<'doubt' | 'summary' | 'transcript'>('doubt')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputQuery, setInputQuery] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [summaryData, setSummaryData] = useState<ClassAiSummaryData | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [transcriptText, setTranscriptText] = useState<string | null>(null)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [hasCopiedTranscript, setHasCopiedTranscript] = useState(false)
  const quickPrompts = [
    'What is this video about?',
    'What key topics were covered in this recording?',
    'Where are AI agents discussed in the video?',
    'Give me a quick knowledge check'
  ]
  
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const classTitle = classInfo?.title || 'Classroom Lecture Recording'
  const classSubject = classInfo?.subject || classInfo?.subject_name || 'Academic Class'
  const classGrade = classInfo?.grade_number || classInfo?.grade || ''
  const classId = classInfo?.id || 'demo_class_id'
  const backendStreamUrl = classInfo?.id ? `${getApiBaseUrl()}/api/v1/classroom/classes/${classId}/video-stream` : ''

  useEffect(() => {
    const greeting: ChatMessage = {
      id: 'msg-init',
      sender: 'ai',
      text: `Hello! I am your AI Lecture Assistant for "${classTitle}". I can answer questions directly based on what was spoken in this class, explain concepts, and test your understanding.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedFollowups: [
        'Summarize this class',
        'What are the key takeaways?',
        'Give me a quick quiz'
      ]
    }
    setMessages([greeting])
    fetchSummary()
    fetchTranscript()
  }, [recordingUrl, classInfo?.id])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAsking])

  const fetchSummary = async () => {
    if (!classInfo?.id) return
    setIsLoadingSummary(true)
    try {
      const data = await getClassAiSummary(classInfo.id)
      setSummaryData(data)
    } catch (err) {
      console.warn('Could not load AI summary:', err)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const fetchTranscript = async () => {
    if (!classInfo?.id) return
    setIsLoadingTranscript(true)
    try {
      const data = await getClassTranscript(classInfo.id)
      if (data) {
        setTranscriptText(data.transcript_text || data.raw_text || null)
      }
    } catch (err) {
      console.warn('Could not load transcript:', err)
    } finally {
      setIsLoadingTranscript(false)
    }
  }

  const handleAskDoubt = async (queryText?: string) => {
    const textToAsk = queryText || inputQuery
    if (!textToAsk.trim() || isAsking) return

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToAsk.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputQuery('')
    setIsAsking(true)

    try {
      const res = await askClassAiDoubt(classInfo?.id || 'demo', textToAsk)
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: res.actions,
        suggestedFollowups: res.suggested_followups
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: "I couldn't process that question right now. You can try asking another question about the video topics.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsAsking(false)
    }
  }

  const handleCopyTranscript = () => {
    if (!transcriptText) return
    navigator.clipboard.writeText(transcriptText)
    setHasCopiedTranscript(true)
    setTimeout(() => setHasCopiedTranscript(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* TOP MODAL HEADER */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {classSubject}
                </span>
                {classGrade && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                    Grade {classGrade}
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">{classTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {recordingUrl && (
              <a
                href={recordingUrl}
                target="_blank"
                rel="noreferrer"
                title="Open video in new tab"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
                <span>{isVimeo ? 'Open Vimeo' : isZoom ? 'Open Zoom' : 'Open Video'}</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Close recording viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN BODY: 2 COLUMNS ON DESKTOP */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
          
          {/* LEFT COLUMN: VIDEO PLAYER (7/12) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-950 overflow-y-auto">
            <div className="relative aspect-video w-full bg-black flex items-center justify-center group overflow-hidden">
              {isVimeo && vimeoEmbedUrl ? (
                <iframe
                  src={vimeoEmbedUrl}
                  title="Vimeo Recording Player"
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                />
              ) : isDirectVideo ? (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                  src={recordingUrl}
                >
                  Your browser does not support HTML5 video playback.
                </video>
              ) : isZoom ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-[#FFF3EA] border border-[#FFDEC4] flex items-center justify-center shadow-lg">
                    <Video className="w-8 h-8 text-[#FF7A18]" />
                  </div>
                  <div className="max-w-md space-y-1.5">
                    <h3 className="text-base font-bold text-white">Zoom Cloud Recording</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      This lecture recording is securely hosted on Zoom Cloud. You can open and stream it in a new tab or use our interactive AI Doubt Solver & Lecture Notes on the right.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <a
                      href={recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF7A18] to-[#FF9138] hover:from-[#EA6C0A] hover:to-[#FF7A18] text-white font-bold text-xs shadow-md shadow-[#FF7A18]/25 flex items-center gap-2 transition hover:scale-[1.02] cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Watch on Zoom Cloud →</span>
                    </a>
                  </div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                  src={backendStreamUrl || recordingUrl}
                  onError={(e) => {
                    const target = e.currentTarget
                    if (recordingUrl && target.src !== recordingUrl) {
                      target.src = recordingUrl
                    }
                  }}
                >
                  Your browser does not support HTML5 video playback.
                </video>
              )}
            </div>

            {/* VIDEO METADATA & QUICK INFO */}
            <div className="p-4 sm:p-5 space-y-3 bg-slate-900 text-slate-300">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800">
                <div className="flex items-center gap-4">
                  {classInfo?.teacher_name && (
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      Teacher: <strong className="text-white">{classInfo.teacher_name}</strong>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Subject: <strong className="text-white">{classSubject}</strong>
                  </span>
                </div>
                {(classInfo?.scheduled_start || classInfo?.starts_at) && (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {new Date(classInfo?.scheduled_start || classInfo?.starts_at!).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* TRANSCRIPT PREVIEW BANNER */}
              {transcriptText && (
                <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-3 text-xs text-slate-300 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AlignLeft className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-emerald-300 text-[11px] uppercase tracking-wider">
                        Transcribed Audio
                      </span>
                      <button
                        onClick={() => setActiveTab('transcript')}
                        className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
                      >
                        Read transcript
                      </button>
                    </div>
                    <p className="text-slate-300 italic text-[11px] truncate mt-0.5">
                      "{transcriptText}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: AI COPILOT / SUMMARY / TRANSCRIPT (5/12) */}
          <div className="lg:col-span-5 flex flex-col bg-white overflow-hidden">
            
            {/* TABS HEADER */}
            <div className="flex items-center gap-1.5 p-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
              <button
                onClick={() => setActiveTab('doubt')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'doubt'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Doubt Solver</span>
              </button>

              <button
                onClick={() => setActiveTab('summary')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Summary</span>
              </button>

              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'transcript'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Transcript</span>
              </button>
            </div>

            {/* TAB CONTENT: AI DOUBT SOLVER CHAT */}
            {activeTab === 'doubt' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* MESSAGES SCROLL */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-amber-500 text-slate-950 font-medium rounded-br-xs'
                            : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-xs shadow-xs'
                        }`}
                      >
                        {msg.sender === 'ai' && (
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-amber-800">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>Ask Acharya AI</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  ))}
                  {isAsking && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 p-3 bg-slate-50 rounded-2xl border border-slate-200 w-fit">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                      <span>Thinking with lecture context...</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* QUICK PROMPT CHIPS */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex gap-1.5 overflow-x-auto shrink-0">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAskDoubt(prompt)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium whitespace-nowrap shadow-xs cursor-pointer transition"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* INPUT BAR */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAskDoubt()
                  }}
                  className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask anything from this class..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !inputQuery.trim()}
                    className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-40 transition cursor-pointer shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: SUMMARY */}
            {activeTab === 'summary' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {isLoadingSummary ? (
                  <div className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
                    <span>Analyzing recording contents...</span>
                  </div>
                ) : summaryData ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm mb-1">Overview</h3>
                      <p className="text-slate-600 leading-relaxed">{summaryData.overview}</p>
                    </div>

                    {summaryData.exam_takeaways && summaryData.exam_takeaways.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-900 text-xs">Exam Takeaways</h4>
                        <ul className="space-y-1.5 pl-2">
                          {summaryData.exam_takeaways.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-12">Summary not generated yet for this recording.</p>
                )}
              </div>
            )}

            {/* TAB CONTENT: TRANSCRIPT */}
            {activeTab === 'transcript' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900">Spoken Lecture Audio Transcript</span>
                  {transcriptText && (
                    <button
                      onClick={handleCopyTranscript}
                      className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{hasCopiedTranscript ? 'Copied!' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {isLoadingTranscript ? (
                  <div className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
                    <span>Loading speech transcript...</span>
                  </div>
                ) : transcriptText ? (
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    {transcriptText}
                  </p>
                ) : (
                  <p className="text-slate-500 text-center py-12">No spoken transcript available for this lecture.</p>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
export default AiRecordingPlayerModal
