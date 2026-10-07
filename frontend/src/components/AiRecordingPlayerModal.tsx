import React, { useState, useEffect, useRef } from 'react'
import Player from '@vimeo/player'
import {
  Sparkles,
  Send,
  FileText,
  CheckCircle2,
  X,
  Video,
  Clock,
  User,
  BookOpen,
  RefreshCw,
  AlignLeft,
  Copy,
  Play,
  Search,
  List,
  Loader2
} from 'lucide-react'
import {
  askClassAiDoubt,
  getClassAiSummary,
  getClassTranscript,
  getClassRecordings,
  syncClassWithZoom
} from '../lib/api'
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
  speaker: string
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
  onClose
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const vimeoPlayerRef = useRef<Player | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const [currentTime, setCurrentTime] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  // Resolve initial Vimeo URL from props
  const resolveVimeoEmbed = (url?: string, vidId?: string): { vId: string; embedUrl: string } => {
    let vId = vidId || ''
    let embedUrl = ''

    if (url) {
      if (url.includes('player.vimeo.com/video/')) {
        const match = url.match(/player\.vimeo\.com\/video\/(\d+)/)
        if (match) vId = match[1]
        embedUrl = url
      } else if (url.includes('vimeo.com')) {
        const match = url.match(/(?:vimeo\.com\/(?:video\/|manage\/videos\/)?|player\.vimeo\.com\/video\/)(\d+)(?:\/([a-zA-Z0-9]+))?/)
        if (match) {
          vId = match[1]
          const vimeoHash = match[2] ? `&h=${match[2]}` : ''
          embedUrl = `https://player.vimeo.com/video/${vId}?autoplay=1&title=0&byline=0&portrait=0${vimeoHash}`
        }
      }
    }

    if (!embedUrl && vId) {
      embedUrl = `https://player.vimeo.com/video/${vId}?autoplay=1&title=0&byline=0&portrait=0`
    }

    return { vId, embedUrl }
  }

  const initial = resolveVimeoEmbed(recordingUrl || classInfo?.recording_url || classInfo?.vimeo_url, classInfo?.vimeo_video_id)
  const [vimeoVideoId, setVimeoVideoId] = useState<string>(initial.vId)
  const [currentVimeoUrl, setCurrentVimeoUrl] = useState<string>(initial.embedUrl)
  const [isSyncingVimeo, setIsSyncingVimeo] = useState<boolean>(false)

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

  // On mount: Check if Vimeo video was created on backend or needs sync
  useEffect(() => {
    if (classInfo?.id) {
      getClassRecordings(classInfo.id).then((recs) => {
        if (Array.isArray(recs) && recs.length > 0) {
          const vimeoRec = recs.find(r => r.vimeo_url || r.play_url?.includes('vimeo') || r.vimeo_video_id)
          if (vimeoRec) {
            const res = resolveVimeoEmbed(vimeoRec.vimeo_url || vimeoRec.play_url, vimeoRec.vimeo_video_id)
            if (res.embedUrl) {
              setVimeoVideoId(res.vId)
              setCurrentVimeoUrl(res.embedUrl)
            }
          }
        }
      }).catch(() => {})
    }
  }, [classInfo?.id])

  // Initialize Vimeo Player SDK instance
  useEffect(() => {
    if (iframeRef.current && currentVimeoUrl) {
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
  }, [currentVimeoUrl])

  useEffect(() => {
    const greeting: ChatMessage = {
      id: 'msg-init',
      sender: 'ai',
      text: `Hello! I am your AI Lecture Assistant for "${classTitle}". Click any topic or transcript timestamp to jump to that moment in the Vimeo video.`,
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

  const handleTriggerVimeoSync = async () => {
    if (!classInfo?.id || isSyncingVimeo) return
    setIsSyncingVimeo(true)
    try {
      await syncClassWithZoom(classInfo.id)
      const recs = await getClassRecordings(classInfo.id)
      if (Array.isArray(recs) && recs.length > 0) {
        const vimeoRec = recs.find(r => r.vimeo_url || r.play_url?.includes('vimeo') || r.vimeo_video_id)
        if (vimeoRec) {
          const res = resolveVimeoEmbed(vimeoRec.vimeo_url || vimeoRec.play_url, vimeoRec.vimeo_video_id)
          if (res.embedUrl) {
            setVimeoVideoId(res.vId)
            setCurrentVimeoUrl(res.embedUrl)
          }
        }
      }
      await fetchTranscript()
    } catch (err) {
      console.warn('Vimeo sync check error:', err)
    } finally {
      setIsSyncingVimeo(false)
    }
  }

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

        // Only use real topics extracted from transcript (NO fake generator)
        if (Array.isArray(data.summary_json?.topics) && data.summary_json.topics.length > 0) {
          setTopics(data.summary_json.topics)
        } else if (Array.isArray(data.summary_json?.chapters) && data.summary_json.chapters.length > 0) {
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
      if (res.actions && Array.isArray(res.actions)) {
        for (const act of res.actions) {
          const actionObj = act as any
          if (actionObj.type === 'seek_video' && typeof actionObj.payload?.seconds === 'number') {
            handleSeek(actionObj.payload.seconds)
          }
        }
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: 'I am having trouble answering right now. Please try asking again in a moment.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsAsking(false)
    }
  }

  const copyTranscriptToClipboard = () => {
    if (!transcriptText && segments.length === 0) return
    const content = transcriptText || segments.map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n')
    navigator.clipboard.writeText(content).then(() => {
      setHasCopiedTranscript(true)
      setTimeout(() => setHasCopiedTranscript(false), 2000)
    })
  }

  const filteredSegments = segments.filter((s) =>
    transcriptSearch.trim() === '' ||
    s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
    s.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  {classSubject}
                </span>
                {vimeoVideoId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <span>Vimeo Player</span>
                  </span>
                )}
              </div>
              <h2 className="font-extrabold text-slate-900 text-base sm:text-lg line-clamp-1 mt-0.5">
                {classTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerVimeoSync}
              disabled={isSyncingVimeo}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              title="Sync recording to Vimeo & refresh transcript"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingVimeo ? 'animate-spin text-[#FF7A00]' : ''}`} />
              <span>{isSyncingVimeo ? 'Syncing...' : 'Sync Vimeo'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
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
              {currentVimeoUrl ? (
                <iframe
                  ref={iframeRef}
                  src={currentVimeoUrl}
                  title="Vimeo Recording Player"
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-lg">
                    {isSyncingVimeo ? (
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                    ) : (
                      <Video className="w-8 h-8 text-blue-400" />
                    )}
                  </div>
                  <div className="max-w-md space-y-1.5">
                    <h3 className="text-base font-bold text-white">Vimeo Cloud Sync</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {isSyncingVimeo
                        ? 'Uploading & syncing Zoom recording to your Vimeo account...'
                        : 'Recording is currently processing and syncing to Vimeo Cloud. Click below to check status.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleTriggerVimeoSync}
                      disabled={isSyncingVimeo}
                      className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 flex items-center gap-2 transition hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingVimeo ? 'animate-spin' : ''}`} />
                      <span>{isSyncingVimeo ? 'Checking Vimeo Status...' : 'Sync / Load Vimeo Player →'}</span>
                    </button>
                  </div>
                </div>
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
                    <p className="text-xs font-medium">No chapters detected in transcript yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Real chapters will appear here once the spoken transcript has been processed.</p>
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
                  <button
                    onClick={copyTranscriptToClipboard}
                    className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                    title="Copy full transcript"
                  >
                    {hasCopiedTranscript ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoadingTranscript ? (
                    <div className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                      <p className="text-xs">Fetching transcript segments...</p>
                    </div>
                  ) : filteredSegments.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <AlignLeft className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-medium">
                        {transcriptSearch ? 'No matching speech found.' : 'Speech transcript is not available yet.'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Transcripts are generated automatically after Zoom processes the audio recording.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredSegments.map((seg, idx) => {
                        const isCurrent = currentTime >= seg.seconds && (idx === filteredSegments.length - 1 || currentTime < filteredSegments[idx + 1].seconds)
                        return (
                          <div
                            key={idx}
                            onClick={() => handleSeek(seg.seconds)}
                            className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-amber-50/90 border-[#FF7A00] shadow-xs'
                                : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100/80 hover:border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-mono text-[10px] font-bold text-amber-600 hover:underline flex items-center gap-1">
                                <Play className="w-2.5 h-2.5 fill-current" />
                                {seg.timestamp}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {seg.speaker}
                              </span>
                            </div>
                            <p className="text-slate-800 leading-relaxed">
                              {seg.text}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: AI DOUBT SOLVER */}
            {activeTab === 'doubt' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {m.sender === 'ai' && (
                        <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          m.sender === 'user'
                            ? 'bg-[#FF7A00] text-white rounded-br-none shadow-xs'
                            : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60'
                        }`}
                      >
                        <p>{m.text}</p>

                        {/* Suggested Followups */}
                        {m.suggestedFollowups && m.suggestedFollowups.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 space-y-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                              Suggested:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {m.suggestedFollowups.map((f, fi) => (
                                <button
                                  key={fi}
                                  onClick={() => handleAskDoubt(f)}
                                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-50 text-[10px] text-slate-700 font-medium border border-slate-200 transition-colors text-left"
                                >
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isAsking && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      </div>
                      <div className="bg-slate-100 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-200/60">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAskDoubt()
                  }}
                  className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask AI a doubt about this lecture..."
                    disabled={isAsking}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={!inputQuery.trim() || isAsking}
                    className="p-2 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] text-white disabled:opacity-40 transition-colors shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT 4: SUMMARY & NOTES */}
            {activeTab === 'summary' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingSummary ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <p className="text-xs">Generating lecture summary...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Lecture Overview
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        {summaryData?.overview || `Comprehensive class recording for ${classTitle}.`}
                      </p>
                    </div>

                    {summaryData?.whiteboard_notes && summaryData.whiteboard_notes.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Key Board Notes
                        </h4>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                          {summaryData.whiteboard_notes.map((note, ni) => (
                            <div key={ni} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                              <span>{note}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {summaryData?.exam_takeaways && summaryData.exam_takeaways.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Exam Takeaways
                        </h4>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                          {summaryData.exam_takeaways.map((takeaway, ti) => (
                            <div key={ti} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                              <span>{takeaway}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
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
