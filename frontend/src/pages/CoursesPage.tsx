import React, { useState, useEffect } from 'react'
import type { 
  User, 
  StudentCourse, 
  StudentCourseHierarchy, 
  LMSCourseSubject, 
  LMSClassSchedule, 
  LMSRecording, 
  LMSResource 
} from '../lib/api'
import { 
  getMyCourses, 
  getCourseDetail,
  getCourseHierarchy, 
  getSubjectClasses, 
  getSubjectRecordings, 
  getSubjectResources,
  createSubjectResource
} from '../lib/api'
import { AiRecordingPlayerModal } from '../components/AiRecordingPlayerModal'
import { 
  Search, 
  BookOpen, 
  Clock, 
  Video, 
  FileText, 
  ArrowRight, 
  ArrowLeft, 
  ExternalLink, 
  Download, 
  Play, 
  Plus, 
  X, 
  User as UserIcon, 
  Calendar, 
  FolderGit2,
  AlertCircle
} from 'lucide-react'

type CoursesPageProps = {
  user: User
  setCurrentTab?: (tab: string) => void
}

export const CoursesPage: React.FC<CoursesPageProps> = ({ user }) => {
  const isTeacher = user.role === 'teacher'
  const isAdmin = user.role === 'admin'

  // View state: 'list' (My Courses) | 'course' (Course Detail) | 'subject' (Subject Detail)
  const [currentView, setCurrentView] = useState<'list' | 'course' | 'subject'>('list')
  
  // Selected entities
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedCourseData, setSelectedCourseData] = useState<StudentCourseHierarchy | null>(null)
  const [hierarchyError, setHierarchyError] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<LMSCourseSubject | null>(null)

  // Data lists
  const [courses, setCourses] = useState<StudentCourse[]>([])
  const [loadingCourses, setLoadingCourses] = useState<boolean>(true)
  const [loadingHierarchy, setLoadingHierarchy] = useState<boolean>(false)
  const [loadingSubjectData, setLoadingSubjectData] = useState<boolean>(false)

  // Subject view specific data
  const [subjectClasses, setSubjectClasses] = useState<{ live_now?: LMSClassSchedule | null; upcoming: LMSClassSchedule[] }>({ upcoming: [] })
  const [subjectRecordings, setSubjectRecordings] = useState<LMSRecording[]>([])
  const [subjectResources, setSubjectResources] = useState<LMSResource[]>([])

  // Video playback modal
  const [activeRecording, setActiveRecording] = useState<LMSRecording | null>(null)

  // Add Resource Modal (for Teacher / Admin)
  const [showAddResourceModal, setShowAddResourceModal] = useState<boolean>(false)
  const [newResTitle, setNewResTitle] = useState('')
  const [newResDesc, setNewResDesc] = useState('')
  const [newResType, setNewResType] = useState('document')
  const [newResUrl, setNewResUrl] = useState('')
  const [newResDownloadable, setNewResDownloadable] = useState(false)
  const [isSubmittingResource, setIsSubmittingResource] = useState(false)

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Initial load
  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    setLoadingCourses(true)
    try {
      const data = await getMyCourses()
      setCourses(data || [])
    } catch (err) {
      console.error('Failed to load enrolled courses:', err)
      setCourses([])
    } finally {
      setLoadingCourses(false)
    }
  }

  // Handle open course detail
  const handleOpenCourse = async (courseId: string) => {
    setSelectedCourseId(courseId)
    setCurrentView('course')
    setLoadingHierarchy(true)
    setHierarchyError(null)
    setSelectedCourseData(null)
    try {
      const hierarchy = await getCourseDetail(courseId).catch(() => getCourseHierarchy(courseId))
      setSelectedCourseData(hierarchy)
    } catch (err: any) {
      console.error('Failed to load course details:', err)
      setHierarchyError(err.message || 'Unable to load course.')
      setSelectedCourseData(null)
    } finally {
      setLoadingHierarchy(false)
    }
  }

  // Handle open subject detail
  const handleOpenSubject = async (subject: LMSCourseSubject) => {
    setSelectedSubject(subject)
    setCurrentView('subject')
    setLoadingSubjectData(true)
    try {
      const [classesRes, recsRes, resRes] = await Promise.all([
        getSubjectClasses(subject.id).catch(() => ({ live_now: null, upcoming: [] })),
        getSubjectRecordings(subject.id).catch(() => []),
        getSubjectResources(subject.id).catch(() => [])
      ])
      setSubjectClasses(classesRes)
      setSubjectRecordings(recsRes || [])
      setSubjectResources(resRes || [])
    } catch (err) {
      console.error('Failed to load subject details:', err)
    } finally {
      setLoadingSubjectData(false)
    }
  }

  const handleBackToCourses = () => {
    setCurrentView('list')
    setSelectedCourseId(null)
    setSelectedCourseData(null)
    setSelectedSubject(null)
    setHierarchyError(null)
  }

  const handleBackToCourseDetail = () => {
    setCurrentView('course')
    setSelectedSubject(null)
  }

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubject || !newResTitle.trim()) return

    setIsSubmittingResource(true)
    try {
      const created = await createSubjectResource(selectedSubject.id, {
        title: newResTitle.trim(),
        description: newResDesc.trim() || undefined,
        resource_type: newResType,
        external_url: newResUrl.trim() || undefined,
        file_url: newResUrl.trim() || undefined,
        downloadable: newResDownloadable
      })
      setSubjectResources(prev => [...prev, created])
      setShowAddResourceModal(false)
      setNewResTitle('')
      setNewResDesc('')
      setNewResUrl('')
      setNewResDownloadable(false)
    } catch (err) {
      console.error('Failed to add resource:', err)
      alert('Failed to add resource. Please check your permissions.')
    } finally {
      setIsSubmittingResource(false)
    }
  }

  // Filtered courses
  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. VIEW: SUBJECT DETAIL PAGE (Exact product model)
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentView === 'subject' && selectedSubject) {
    const parentCourseTitle = selectedCourseData?.title || selectedSubject.course_title || 'Course'
    const teacherName = selectedSubject.teacher?.display_name || selectedSubject.teacher?.name || 'No teacher assigned'

    return (
      <div className="min-h-screen bg-[#FDFBF9] text-slate-900 pb-20">
        {/* Breadcrumb Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <button 
                onClick={handleBackToCourses}
                className="hover:text-[#FF7A00] transition-colors font-medium"
              >
                My Courses
              </button>
              <span>/</span>
              <button 
                onClick={handleBackToCourseDetail}
                className="hover:text-[#FF7A00] transition-colors font-medium truncate max-w-xs"
              >
                {parentCourseTitle}
              </button>
              <span>/</span>
              <span className="text-slate-900 font-semibold">{selectedSubject.name}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
              <div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700 tracking-wider">
                    {selectedSubject.code}
                  </span>
                  <h1 className="text-2xl font-bold text-slate-900">{selectedSubject.name}</h1>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    Teacher: {teacherName}
                  </span>
                  <span>•</span>
                  <span>Course: {parentCourseTitle}</span>
                </div>
              </div>

              <button
                onClick={handleBackToCourseDetail}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors self-start md:self-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Course
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {loadingSubjectData ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Clock className="w-6 h-6 animate-spin mr-3 text-[#FF7A00]" />
              Loading subject classes, recordings, and resources...
            </div>
          ) : (
            <div className="space-y-10">
              
              {/* ── SECTION 1: LIVE CLASS ── */}
              <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-sm font-bold tracking-wider uppercase text-slate-500 mb-4">
                  LIVE CLASS
                </h2>

                {subjectClasses.live_now ? (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <span className="flex h-3.5 w-3.5 relative mt-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white tracking-wider">
                            ● LIVE NOW
                          </span>
                          <span className="text-sm font-semibold text-emerald-900">
                            {subjectClasses.live_now.start_time} – {subjectClasses.live_now.end_time}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">
                          {selectedSubject.name}
                        </h3>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Conducted by {teacherName} • Room: {subjectClasses.live_now.room_or_venue || 'Online Classroom'}
                        </p>
                      </div>
                    </div>

                    <a
                      href={subjectClasses.live_now.zoom_join_url || subjectClasses.live_now.meeting_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-semibold rounded-lg shadow-sm transition-colors text-sm"
                    >
                      <Video className="w-4 h-4" />
                      Join Live Class
                    </a>
                  </div>
                ) : (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm flex items-center gap-3">
                    <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                    <span>No live class currently running.</span>
                  </div>
                )}
              </section>

              {/* ── SECTION 2: UPCOMING CLASSES ── */}
              <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-sm font-bold tracking-wider uppercase text-slate-500 mb-4">
                  UPCOMING CLASSES
                </h2>

                {subjectClasses.upcoming.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {subjectClasses.upcoming.map((c) => (
                      <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF7A00] shrink-0 font-bold text-xs uppercase">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-base">
                              {selectedSubject.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                              <span className="font-medium text-slate-700">{c.day_of_week || 'Upcoming'}</span>
                              <span>•</span>
                              <span>{c.start_time} – {c.end_time}</span>
                              <span>•</span>
                              <span>Venue: {c.room_or_venue || 'Online Studio'}</span>
                            </div>
                          </div>
                        </div>

                        {c.meeting_url && (
                          <a
                            href={c.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors self-start sm:self-auto"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Class Link
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-3">No upcoming classes scheduled.</p>
                )}
              </section>

              {/* ── SECTION 3: PREVIOUS RECORDINGS ── */}
              <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold tracking-wider uppercase text-slate-500">
                    PREVIOUS RECORDINGS
                  </h2>
                  <span className="text-xs text-slate-400 font-medium">
                    {subjectRecordings.length} {subjectRecordings.length === 1 ? 'recording' : 'recordings'} available
                  </span>
                </div>

                {subjectRecordings.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {subjectRecordings.map((rec) => {
                      const recDateStr = rec.recorded_at 
                        ? new Date(rec.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Previous Session'

                      return (
                        <div key={rec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                              <Video className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">
                                {rec.title || selectedSubject.name}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                <span className="font-medium text-slate-700">{recDateStr}</span>
                                <span>•</span>
                                <span>Duration: {rec.duration || '50m'}</span>
                                {rec.teacher_name && (
                                  <>
                                    <span>•</span>
                                    <span>Instructor: {rec.teacher_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setActiveRecording(rec)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Watch Recording
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg">
                    <Video className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">No recordings available yet.</p>
                  </div>
                )}
              </section>

              {/* ── SECTION 4: RESOURCES ── */}
              <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold tracking-wider uppercase text-slate-500">
                    RESOURCES
                  </h2>
                  {(isTeacher || isAdmin) && (
                    <button
                      onClick={() => setShowAddResourceModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#FF7A00] bg-orange-50 hover:bg-orange-100 rounded-md transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Resource
                    </button>
                  )}
                </div>

                {subjectResources.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subjectResources.map((res) => {
                      const isCode = res.resource_type === 'code_repo' || res.resource_type === 'github'
                      const isDoc = res.resource_type === 'document' || res.resource_type === 'notes'

                      return (
                        <div 
                          key={res.id} 
                          className="border border-slate-200 rounded-xl p-4 bg-white hover:border-[#FF7A00]/60 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                                  {isCode ? (
                                    <FolderGit2 className="w-4 h-4 text-[#FF7A00]" />
                                  ) : isDoc ? (
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <BookOpen className="w-4 h-4 text-emerald-600" />
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-bold text-slate-900 text-sm">{res.title}</h3>
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    {res.resource_type}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {res.description && (
                              <p className="text-xs text-slate-600 mt-2.5 line-clamp-2">
                                {res.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">
                              {res.downloadable ? 'Downloadable' : 'External Link'}
                            </span>

                            {res.external_url || res.file_url ? (
                              <a
                                href={res.external_url || res.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF7A00] hover:text-[#E66E00]"
                              >
                                {res.downloadable ? (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                  </>
                                ) : (
                                  <>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Open
                                  </>
                                )}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No link attached</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">No resources available yet.</p>
                  </div>
                )}
              </section>

            </div>
          )}
        </div>

        {/* ── VIDEO PLAYER MODAL WITH CHAPTERS, TOPICS & TRANSCRIPT SEEKING ── */}
        {activeRecording && (
          <AiRecordingPlayerModal
            recordingUrl={activeRecording.play_url || activeRecording.vimeo_url || ''}
            classInfo={{
              id: activeRecording.class_id || activeRecording.id,
              title: activeRecording.title || (selectedSubject ? selectedSubject.name : 'Class Recording'),
              subject_name: selectedSubject ? selectedSubject.name : activeRecording.title,
              teacher_name: activeRecording.teacher_name,
              vimeo_video_id: activeRecording.vimeo_video_id,
              duration_seconds: activeRecording.duration_seconds,
            }}
            onClose={() => setActiveRecording(null)}
          />
        )}

        {/* ── ADD RESOURCE MODAL ── */}
        {showAddResourceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h3 className="font-bold text-slate-900 text-lg">Add Subject Resource</h3>
                <button 
                  onClick={() => setShowAddResourceModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateResource} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Resource Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newResTitle}
                    onChange={e => setNewResTitle(e.target.value)}
                    placeholder="e.g. Lecture Notes, Practice Problems"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Resource Type
                  </label>
                  <select
                    value={newResType}
                    onChange={e => setNewResType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF7A00]"
                  >
                    <option value="document">Lecture Notes / Document</option>
                    <option value="code_repo">Code Repository (GitHub)</option>
                    <option value="practice">Practice Problems</option>
                    <option value="reference">Reference Material</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Resource URL / File Link
                  </label>
                  <input
                    type="url"
                    value={newResUrl}
                    onChange={e => setNewResUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={newResDesc}
                    onChange={e => setNewResDesc(e.target.value)}
                    placeholder="Brief description of the material..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="downloadable_chk"
                    checked={newResDownloadable}
                    onChange={e => setNewResDownloadable(e.target.checked)}
                    className="rounded border-slate-300 text-[#FF7A00] focus:ring-[#FF7A00]"
                  />
                  <label htmlFor="downloadable_chk" className="text-xs text-slate-700 font-medium">
                    Mark as downloadable file
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddResourceModal(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingResource}
                    className="px-5 py-2 text-sm bg-[#FF7A00] hover:bg-[#E66E00] text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingResource ? 'Saving...' : 'Add Resource'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. VIEW: COURSE DETAIL PAGE (Course + Subjects list)
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentView === 'course') {
    return (
      <div className="min-h-screen bg-[#FDFBF9] text-slate-900 pb-20">
        {/* Header with Back button */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <button
              onClick={handleBackToCourses}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#FF7A00] mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to My Courses
            </button>

            {loadingHierarchy ? (
              <div className="py-6 flex items-center text-slate-500 text-sm">
                <Clock className="w-5 h-5 animate-spin mr-2 text-[#FF7A00]" />
                Loading course details...
              </div>
            ) : hierarchyError ? (
              <div className="py-6">
                <div className="p-5 rounded-xl bg-red-50/80 border border-red-200 text-red-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm text-red-900">Unable to load course.</h3>
                      <p className="text-xs text-red-600 mt-0.5">{hierarchyError}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => selectedCourseId && handleOpenCourse(selectedCourseId)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors shrink-0"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : selectedCourseData ? (
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {selectedCourseData.name || selectedCourseData.title}
                </h1>
                {selectedCourseData.description && (
                  <p className="mt-2 text-base text-slate-600 max-w-3xl leading-relaxed">
                    {selectedCourseData.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3 text-sm text-slate-500 font-medium">
                  <span className="px-2.5 py-1 bg-orange-50 text-[#FF7A00] border border-orange-200 rounded-md font-semibold text-xs">
                    {selectedCourseData.subjects.length} Subjects
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Subjects list */}
        {!loadingHierarchy && !hierarchyError && selectedCourseData && (
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                SUBJECTS
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Click a subject to view live classes, recordings, and resources
              </span>
            </div>

            {selectedCourseData.subjects.length > 0 ? (
              <div className="space-y-4">
                {selectedCourseData.subjects.map((subj, idx) => {
                  const teacherDisplay = subj.teachers?.[0]?.name 
                    || subj.teacher?.name 
                    || subj.teacher?.display_name 
                    || 'No teacher assigned'

                  return (
                    <div
                      key={subj.id}
                      className="bg-white border border-slate-200 hover:border-[#FF7A00] rounded-xl p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 text-[#FF7A00] font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                              {subj.code}
                            </span>
                            <h3 className="font-bold text-slate-900 text-base">
                              {subj.name}
                            </h3>
                          </div>

                          <div className="mt-2 text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-medium text-slate-800 flex items-center gap-1">
                              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                              Teacher: {teacherDisplay}
                            </span>
                            <span>•</span>
                            <span>{subj.scheduled_classes_count} scheduled classes</span>
                            <span>•</span>
                            <span>{subj.recordings_count} recordings</span>
                            <span>•</span>
                            <span>{subj.resources_count} resources</span>
                          </div>

                          {subj.description && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-1">
                              {subj.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenSubject(subj)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-[#FF7A00] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start md:self-auto shrink-0"
                      >
                        Open Subject
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold">This course has no subjects assigned yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. VIEW: MY COURSES LIST (Exact Section 5 & 23 Target)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FDFBF9] text-slate-900 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            My Courses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Courses you are currently enrolled in.
          </p>

          {/* Search bar only - absolutely NO difficulty filters or roadmaps */}
          <div className="mt-6 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search courses..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] shadow-sm transition-all"
            />
          </div>
        </div>
      </div>

      {/* Courses Cards Grid */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loadingCourses ? (
          <div className="py-20 text-center text-slate-400">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF7A00]" />
            <p className="text-sm">Loading enrolled courses...</p>
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCourses.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-[#FF7A00]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {c.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {c.description || 'Master this comprehensive technical curriculum.'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    {c.subjects_count} {c.subjects_count === 1 ? 'Subject' : 'Subjects'}
                  </span>

                  <button
                    onClick={() => handleOpenCourse(c.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#FF7A00] text-slate-800 hover:text-[#FF7A00] text-xs font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    View Subjects →
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-16 text-center text-slate-500">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-800">
              {searchQuery ? 'No courses match your search.' : 'You are not enrolled in any courses yet.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs font-medium text-[#FF7A00] hover:underline"
              >
                Clear search query
              </button>
            )}
            {!searchQuery && isTeacher && (
              <p className="text-xs text-slate-500 mt-1">
                Courses will appear once subjects are assigned to you by the Institute Administrator.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
