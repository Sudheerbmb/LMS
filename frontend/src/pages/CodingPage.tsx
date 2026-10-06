import React, { useState, useEffect } from 'react'
import type { CodingExercise, Course, User } from '../lib/api'
import { getCourses, getCodingExercises, createCodingExercise, submitCodingSolution } from '../lib/api'
import { Play, Plus, Terminal, CheckCircle2, AlertCircle, X, Code2, BookOpen } from 'lucide-react'

type CodingPageProps = {
  user: User
}

export const CodingPage: React.FC<CodingPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [exercises, setExercises] = useState<CodingExercise[]>([])
  const [selectedEx, setSelectedEx] = useState<CodingExercise | null>(null)
  const [code, setCode] = useState('')

  // Execution Result State
  const [output, setOutput] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [passed, setPassed] = useState<boolean | null>(null)

  // Create Exercise Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [starterCode, setStarterCode] = useState('')
  const language = 'python'

  useEffect(() => {
    loadCourses()
  }, [])

  useEffect(() => {
    if (selectedCourseId) loadExercises(selectedCourseId)
  }, [selectedCourseId])

  const loadCourses = async () => {
    try {
      const res = await getCourses()
      setCourses(res.items || [])
      if (res.items && res.items.length > 0) setSelectedCourseId(res.items[0].id)
    } catch (err) {
      console.error(err)
    }
  }

  const loadExercises = async (cId: string) => {
    try {
      const list = await getCodingExercises(cId)
      setExercises(list || [])
      if (list && list.length > 0) {
        setSelectedEx(list[0])
        setCode(list[0].starter_code || '# Write code here')
      } else {
        setSelectedEx(null)
        setCode('')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourseId) return
    try {
      const created = await createCodingExercise(selectedCourseId, {
        title,
        prompt,
        starter_code: starterCode,
        language
      })
      setExercises([...exercises, created])
      setSelectedEx(created)
      setCode(created.starter_code)
      setShowCreateModal(false)
      setTitle('')
      setPrompt('')
      setStarterCode('')
    } catch (err: any) {
      alert(err.message || 'Failed to create exercise')
    }
  }

  const handleRunCode = async () => {
    if (!selectedEx) return
    setEvaluating(true)
    setOutput(null)
    setPassed(null)
    try {
      const res = await submitCodingSolution(selectedEx.id, { code })
      const resData = (res.result || {}) as Record<string, any>
      const outText = resData.output || (res as any).output || `Status: ${res.status}`
      setOutput(outText)
      setPassed(res.status === 'passed' || resData.passed === true)
    } catch (err: any) {
      setOutput(err.message || 'SyntaxError / Execution exception')
      setPassed(false)
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111827] font-sans pb-16">
      {/* Clean Light Editorial Header Banner (No background image) */}
      <div className="border-b border-black/[0.06] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF3EA] text-[#FF7A18] text-xs font-semibold uppercase tracking-wider mb-3 border border-[#FFDEC4]">
              <Code2 className="w-3.5 h-3.5" />
              Computational Sandbox • Python Execution Engine
            </div>
            <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight font-serif">
              Coding Playground
            </h1>
            <p className="text-[#64748B] text-sm mt-1 max-w-xl">
              Solve algorithm challenges, execute test cases, and receive automated real-time verification.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 bg-[#FAF9F6] border border-black/[0.08] px-3.5 py-2 rounded-2xl">
              <BookOpen className="w-4 h-4 text-[#FF7A18]" />
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Course</span>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#111827] focus:outline-none cursor-pointer"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {user.role !== 'student' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold px-4 py-2.5 rounded-2xl shadow-xs transition-all text-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Problem</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Exercise Roster */}
          <div className="lg:col-span-4 bg-white border border-black/[0.06] rounded-3xl p-6 shadow-xs space-y-4 h-fit">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="font-bold text-[#111827] text-sm uppercase tracking-wider">
                Exercises
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF9F6] text-[#64748B] border border-black/[0.06]">
                {exercises.length} Total
              </span>
            </div>

            <div className="space-y-2">
              {exercises.length === 0 ? (
                <p className="text-xs text-[#94A3B8] py-8 text-center">
                  No challenges available for this course track yet.
                </p>
              ) : (
                exercises.map((ex) => {
                  const isActive = selectedEx?.id === ex.id
                  return (
                    <button
                      key={ex.id}
                      onClick={() => {
                        setSelectedEx(ex)
                        setCode(ex.starter_code || '')
                        setOutput(null)
                        setPassed(null)
                      }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#FFF3EA] border-[#FFDEC4] text-[#111827] shadow-xs'
                          : 'bg-[#FAF9F6] border-black/[0.06] text-[#64748B] hover:bg-white hover:border-[#FF7A18]/30 hover:text-[#111827]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-[#111827]">
                          {ex.title}
                        </div>
                        {isActive && <span className="w-2 h-2 rounded-full bg-[#FF7A18]" />}
                      </div>
                      <div className="text-[11px] font-mono text-[#FF7A18] mt-1 uppercase font-semibold">
                        {ex.language}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Code Workbench & Console */}
          <div className="lg:col-span-8 space-y-6">
            {selectedEx ? (
              <>
                {/* Problem Description Card */}
                <div className="bg-white border border-black/[0.06] rounded-3xl p-6 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF7A18] bg-[#FFF3EA] px-2.5 py-0.5 rounded-full border border-[#FFDEC4]">
                      {selectedEx.language}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[#111827]">
                    {selectedEx.title}
                  </h2>
                  <div className="text-xs text-[#334155] leading-relaxed bg-[#FAF9F6] p-4 rounded-2xl border border-black/[0.06]">
                    {selectedEx.prompt}
                  </div>
                </div>

                {/* Clean Light Code Editor */}
                <div className="bg-white border border-black/[0.08] rounded-3xl overflow-hidden shadow-xs">
                  <div className="px-5 py-3.5 bg-[#FAF9F6] border-b border-black/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs text-[#64748B]">
                      <span className="font-bold text-[#111827]">solution.{selectedEx.language === 'python' ? 'py' : 'txt'}</span>
                      <span className="text-[#94A3B8]">({selectedEx.language})</span>
                    </div>

                    <button
                      onClick={handleRunCode}
                      disabled={evaluating}
                      className="inline-flex items-center gap-2 bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{evaluating ? 'Executing...' : 'Run Code'}</span>
                    </button>
                  </div>

                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    rows={12}
                    className="w-full bg-white text-[#111827] p-5 font-mono text-xs leading-relaxed border-none resize-none focus:outline-none placeholder:text-[#94A3B8]"
                    spellCheck={false}
                    placeholder="# Write your Python solution here..."
                  />
                </div>

                {/* Clean Light Console Output */}
                {output && (
                  <div className="bg-white border border-black/[0.08] rounded-3xl p-5 space-y-3 shadow-xs font-mono">
                    <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                      <span className="text-xs font-bold text-[#111827] flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-[#FF7A18]" />
                        Runtime Console
                      </span>
                      {passed !== null && (
                        <span
                          className={`text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border ${
                            passed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          {passed ? 'PASSED ALL CHECKS' : 'FAILED CHECKS'}
                        </span>
                      )}
                    </div>
                    <pre className="text-xs text-[#334155] leading-relaxed whitespace-pre-wrap bg-[#FAF9F6] p-4 rounded-2xl border border-black/[0.06] overflow-x-auto">
                      {output}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-black/[0.06] rounded-3xl p-16 text-center text-xs text-[#94A3B8] shadow-xs">
                Select a problem from the left exercise roster to start coding.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Exercise Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="text-base font-bold text-[#111827] font-serif">
                Create Coding Exercise
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-2xl font-bold p-1 leading-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExercise} className="space-y-4 text-xs">
              <div>
                <label className="text-[#111827] font-bold block mb-1.5">
                  Problem Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Binary Search in Rotated Array"
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-xl p-3 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="text-[#111827] font-bold block mb-1.5">
                  Prompt & Constraints *
                </label>
                <textarea
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe problem specifications, inputs, outputs, and sample test cases..."
                  rows={4}
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-xl p-3 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="text-[#111827] font-bold block mb-1.5">
                  Starter Code Template
                </label>
                <textarea
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                  placeholder="def solve(nums: list[int]) -> int:&#10;    pass"
                  rows={4}
                  className="w-full bg-[#FAF9F6] border border-black/[0.08] rounded-xl p-3 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#FF7A18] font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
                >
                  Publish Exercise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CodingPage
