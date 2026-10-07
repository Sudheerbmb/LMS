import React, { useState, useEffect, useRef } from 'react'
import Player from '@vimeo/player'
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
  Copy,
  Play,
  Search,
  List
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
  vimeo_video_id?: string
  vimeo_url?: string
  recording_url?: string
  status?: string
  error_message?: string
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

interface TranscriptSegment {
  timestamp: string
  seconds: number
  end_timestamp?: string
  speaker?: string
  text: string
}

interface TopicChapter {
  title: string
  timestamp: string
  seconds: number
}

export const AiRecordingPlayerModal: React.FC<AiRecordingPlayerModalProps> = ({
  recordingUrl,
  classInfo,
  onClose,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const vimeoPlayerRef = useRef<Player | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const [currentTime, setCurrentTime] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  // Extract Vimeo Video ID & URL
  const isVimeo = !!(recordingUrl && (recordingUrl.includes('vimeo.com') || recordingUrl.includes('player.vimeo.com'))) || !!classInfo?.vimeo_video_id
  let vimeoId = classInfo?.vimeo_video_id || ''
  let vimeoEmbedUrl = ''

  if (recordingUrl) {
    if (recordingUrl.includes('player.vimeo.com/video/')) {
      const match = recordingUrl.match(/player\.vimeo\.com\/video\/(\d+)/)
      if (match) vimeoId = match[1]
      vimeoEmbedUrl = recordingUrl
    } else if (recordingUrl.includes('vimeo.com')) {
      const match = recordingUrl.match(/(?:vimeo\.com\/(?:video\/|manage\/videos\/)?|player\.vimeo\.com\/video\/)(\d+)(?:\/([a-zA-Z0-9]+))?/)
      if (match) {
        vimeoId = match[1]
        const vimeoHash = match[2] ? `&h=${match[2]}` : ''
        vimeoEmbedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0${vimeoHash}`
      }
    }
  }

  if (!vimeoEmbedUrl && vimeoId) {
    vimeoEmbedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`
  }

  const isZoom = !isVimeo && !!(recordingUrl && (recordingUrl.includes('zoom.us') || recordingUrl.includes('zoomgov.com')))
  const isDirectVideo = !isVimeo && !!(recordingUrl && (
    recordingUrl.includes('.mp4') ||
    recordingUrl.includes('.webm') ||
    recordingUrl.includes('cloudinary.com') ||
    recordingUrl.startsWith('blob:')
  ))

  const [activeTab, setActiveTab] = useState<'topics' | 'transcript' | 'doubt' | 'summary'>('topics')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputQuery, setInputQuery] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [summaryData, setSummaryData] = useState<ClassAiSummaryData | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [transcriptText, setTranscriptText] = useState<string | null>(null)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [topics, setTopics] = useState<TopicChapter[]>([])
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [hasCopiedTranscript, setHasCopiedTranscript] = useState(false)
  const [transcriptSearch, setTranscriptSearch] = useState('')

  const classTitle = classInfo?.title || 'Classroom Lecture Recording'
  const classSubject = classInfo?.subject || classInfo?.subject_name || 'Academic Class'
  const classGrade = classInfo?.grade_number || classInfo?.grade || ''
  const classId = classInfo?.id || 'demo_class_id'
  const backendStreamUrl = classInfo?.id ? `${getApiBaseUrl()}/api/v1/classroom/classes/${classId}/video-stream` : ''

  // Initialize Vimeo Player SDK instance
  useEffect(() => {
    if (iframeRef.current && isVimeo) {
      try {
        const player = new Player(iframeRef.current)
        vimeoPlayerRef.current = player

        player.on('play', () => setIsPlaying(true))
        player.on('pause', () => setIsPlaying(false))
        player.on('timeupdate', (data: { seconds: number; percent: number; duration: number }) => {
          setCurrentTime(data.seconds)
        })

        return () => {
          player.destroy().catch(() => {})
        }
      } catch (err) {
        console.warn('Vimeo Player init warning:', err)
      }
    }
  }, [vimeoEmbedUrl, isVimeo])

  useEffect(() => {
    const greeting: ChatMessage = {
      id: 'msg-init',
      sender: 'ai',
      text: `Hello! I am your AI Lecture Assistant for "${classTitle}". Click any topic or transcript timestamp to jump to that moment in the video.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedFollowups: [
        'Summarize key topics',
        'What are the core takeaways?',
        'Give me a practice question'
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
      if (data?.key_topics && topics.length === 0) {
        const genTopics: TopicChapter[] = data.key_topics.map((t: string, idx: number) => ({
          title: t,
          timestamp: `0${idx * 4}:00`,
          seconds: idx * 240
        }))
        setTopics(genTopics)
      }
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
        const raw = data.transcript_text || data.raw_text || null
        setTranscriptText(raw)

        if (Array.isArray(data.segments_json) && data.segments_json.length > 0) {
          const parsed = data.segments_json.map((s: any) => ({
            timestamp: s.timestamp || (s.start !== undefined ? formatSeconds(s.start) : '00:00'),
            seconds: typeof s.seconds === 'number' ? s.seconds : (typeof s.start === 'number' ? Math.floor(s.start) : 0),
            speaker: s.speaker || 'Teacher',
            text: s.text || ''
          }))
          setSegments(parsed)
        } else if (raw) {
          const parsed = parseRawTranscript(raw)
          setSegments(parsed)
        }

        if (data.summary_json?.topics && Array.isArray(data.summary_json.topics)) {
          setTopics(data.summary_json.topics)
        } else if (data.summary_json?.chapters && Array.isArray(data.summary_json.chapters)) {
          setTopics(data.summary_json.chapters)
        }
      }
    } catch (err) {
      console.warn('Could not load transcript:', err)
    } finally {
      setIsLoadingTranscript(false)
    }
  }

  const formatSeconds = (totalSecs: number): string => {
    const mins = Math.floor(totalSecs / 60)
    const secs = Math.floor(totalSecs % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const parseRawTranscript = (text: string): TranscriptSegment[] => {
    const lines = text.split('\n')
    const result: TranscriptSegment[] = []
    const tsRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/

    for (const line of lines) {
      const match = line.match(tsRegex)
      if (match) {
        const ts = match[1]
        const parts = ts.split(':')
        let sec = 0
        if (parts.length === 3) sec = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
        else if (parts.length === 2) sec = parseInt(parts[0]) * 60 + parseInt(parts[1])

        const cleanLine = line.replace(tsRegex, '').trim()
        let speaker = 'Teacher'
        let content = cleanLine
        if (cleanLine.includes(':')) {
          const sp = cleanLine.split(':', 1)
          if (sp[0].length < 30) {
            speaker = sp[0].trim()
            content = cleanLine.substring(sp[0].length + 1).trim()
          }
        }
        result.push({
          timestamp: ts,
          seconds: sec,
          speaker,
          text: content
        })
      }
    }

    return result
  }

  // CORE SEEK FUNCTION: Uses Vimeo Player API for instant seek without page reload
  const handleSeek = async (seconds: number) => {
    if (vimeoPlayerRef.current) {
      try {
        await vimeoPlayerRef.current.setCurrentTime(seconds)
        await vimeoPlayerRef.current.play()
        setCurrentTime(seconds)
      } catch (err) {
        console.warn('Vimeo seek error:', err)
      }
    } else if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.play()
      setCurrentTime(seconds)
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

      // Auto-seek if AI returns a seek action
      if (res.actions && res.actions.length > 0) {
        const seekAction = res.actions.find(a => a.type === 'SEEK_VIDEO' && typeof a.timestamp === 'number')
        if (seekAction && typeof seekAction.timestamp === 'number') {
          handleSeek(seekAction.timestamp)
        }
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: "I couldn't process that question right now. You can click on any topic or transcript timestamp to jump to that lecture section.",
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

  const filteredSegments = transcriptSearch.trim()
    ? segments.filter(s => s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || (s.speaker && s.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())))
    : segments

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* TOP MODAL HEADER */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-[#FF7A00] border border-amber-200 flex items-center justify-center shrink-0">
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
                {vimeoId && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#1AB7EA]/10 text-[#0088cc] border border-[#1AB7EA]/30">
                    Vimeo: {vimeoId}
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
                <ExternalLink className="w-3.5 h-3.5 text-[#FF7A00]" />
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
          
          {/* LEFT COLUMN: REAL VIMEO PLAYER & EMBED (7/12) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-950 overflow-y-auto">
            <div className="relative aspect-video w-full bg-black flex items-center justify-center group overflow-hidden">
              {isVimeo && vimeoEmbedUrl ? (
                <iframe
                  ref={iframeRef}
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
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
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
                      This lecture recording is processing or hosted on Zoom Cloud. Click below to stream directly on Zoom Cloud or use the transcript on the right.
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
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
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

              {/* QUICK TOPIC TIMELINE BAR */}
              {topics.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Lecture Chapters (Click to Seek)
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {topics.map((top, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSeek(top.seconds)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-[#FF7A00] hover:text-white text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                        title={`Seek to ${top.timestamp}`}
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span className="font-mono text-amber-400">{top.timestamp}</span>
                        <span>{top.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: TOPICS / TRANSCRIPT / AI COPILOT / SUMMARY (5/12) */}
          <div className="lg:col-span-5 flex flex-col bg-white overflow-hidden">
            
            {/* TABS HEADER */}
            <div className="flex items-center gap-1.5 p-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
              <button
                onClick={() => setActiveTab('topics')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'topics'
                    ? 'bg-[#FF7A00] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Chapters</span>
              </button>

              <button
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'transcript'
                    ? 'bg-[#FF7A00] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Transcript</span>
              </button>

              <button
                onClick={() => setActiveTab('doubt')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'doubt'
                    ? 'bg-[#FF7A00] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Doubt</span>
              </button>

              <button
                onClick={() => setActiveTab('summary')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-[#FF7A00] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Summary</span>
              </button>
            </div>

            {/* TAB CONTENT 1: TOPICS & CHAPTERS */}
            {activeTab === 'topics' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 text-xs">Video Topics & Chapters</span>
                  <span className="text-[11px] text-slate-500">{topics.length} sections</span>
                </div>

                {topics.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium">No chapters detected yet for this lecture.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topics.map((t, idx) => {
                      const isActive = currentTime >= t.seconds && (idx === topics.length - 1 || currentTime < topics[idx + 1].seconds)
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSeek(t.seconds)}
                          className={`p-3 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer group ${
                            isActive
                              ? 'bg-amber-50/90 border-[#FF7A00] shadow-sm'
                              : 'border-slate-100 bg-slate-50/70 hover:bg-amber-50/60 hover:border-amber-200'
                          }`}
                        >
                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1 shrink-0 transition-colors shadow-xs ${
                              isActive
                                ? 'bg-[#FF7A00] text-white border border-[#FF7A00]'
                                : 'bg-white border border-slate-200 group-hover:border-[#FF7A00] group-hover:bg-[#FF7A00] group-hover:text-white text-slate-700'
                            }`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{t.timestamp}</span>
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className={`text-xs font-bold transition-colors line-clamp-1 ${isActive ? 'text-[#FF7A00]' : 'text-slate-900 group-hover:text-[#FF7A00]'}`}>
                                {t.title}
                              </h4>
                              {isActive && isPlaying && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FF7A00] text-white animate-pulse">
                                  Playing
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Click to play from {t.timestamp}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: TRANSCRIPT WITH CLICKABLE TIMESTAMPS */}
            {activeTab === 'transcript' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      placeholder="Search speech..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  {transcriptText && (
                    <button
                      onClick={handleCopyTranscript}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{hasCopiedTranscript ? 'Copied!' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoadingTranscript ? (
                    <div className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#FF7A00] mb-2" />
                      <p className="text-xs font-medium">Loading lecture transcript...</p>
                    </div>
                  ) : filteredSegments.length > 0 ? (
                    <div className="space-y-3">
                      {filteredSegments.map((seg, idx) => {
                        const isActive = currentTime >= seg.seconds && (idx === filteredSegments.length - 1 || currentTime < filteredSegments[idx + 1].seconds)
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-2xl border transition-colors flex items-start gap-3 ${
                              isActive
                                ? 'bg-amber-50/90 border-[#FF7A00] shadow-xs'
                                : 'bg-slate-50/80 border-slate-100 hover:border-amber-200 hover:bg-amber-50/40'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSeek(seg.seconds)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-xs ${
                                isActive
                                  ? 'bg-[#FF7A00] text-white border border-[#FF7A00]'
                                  : 'bg-white hover:bg-[#FF7A00] hover:text-white border border-slate-200 hover:border-[#FF7A00] text-slate-700'
                              }`}
                              title={`Jump to ${seg.timestamp}`}
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>{seg.timestamp}</span>
                            </button>
                            <div className="flex-1 min-w-0 text-xs leading-relaxed">
                              <span className="font-bold text-slate-800 mr-1.5">{seg.speaker || 'Teacher'}:</span>
                              <span className={isActive ? 'text-slate-900 font-medium' : 'text-slate-700'}>{seg.text}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : transcriptText ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {transcriptText}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <AlignLeft className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-medium">No spoken audio transcript available yet.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Zoom cloud transcripts take 5-15 minutes after the lecture concludes.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: AI DOUBT SOLVER CHAT */}
            {activeTab === 'doubt' && (
              <div className="flex-1 flex flex-col min-h-0">
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
                            ? 'bg-[#FF7A00] text-white font-medium rounded-br-xs shadow-xs'
                            : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-xs shadow-xs'
                        }`}
                      >
                        {msg.sender === 'ai' && (
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-amber-800">
                            <Sparkles className="w-3 h-3 text-[#FF7A00]" />
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
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF7A00]" />
                      <span>Thinking with lecture context...</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* QUICK PROMPT CHIPS */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex gap-1.5 overflow-x-auto shrink-0">
                  {[
                    'What is this video about?',
                    'Explain core topics covered',
                    'Give me a key takeaway check'
                  ].map((prompt, idx) => (
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
                    className="p-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#EA6C0A] text-white font-bold text-xs disabled:opacity-40 transition cursor-pointer shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT 4: SUMMARY */}
            {activeTab === 'summary' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {isLoadingSummary ? (
                  <div className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#FF7A00] mb-2" />
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

          </div>
        </div>
      </div>
    </div>
  )
}
export default AiRecordingPlayerModal
