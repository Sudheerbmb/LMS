import React, { useState, useEffect } from 'react'
import type { CodingExercise, Course, User } from '../lib/api'
import { getCourses, getCodingExercises, createCodingExercise, submitCodingSolution } from '../lib/api'
import { Code2, Play, Plus, Terminal, CheckCircle2, AlertCircle, X } from 'lucide-react'

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
    <div className="w-full min-h-screen px-4 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shadow-xs">
              <Code2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Coding Playground & Sandbox
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            Solve algorithms, test code snippets, and receive automated test results.
          </p>
        </div>

        {user.role !== 'student' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all text-xs sm:text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Problem</span>
          </button>
        )}
      </div>

      {/* Course Filter */}
      <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <label className="text-xs uppercase font-bold tracking-wider text-slate-500">Select Course:</label>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-400"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Problems Menu */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
            <span>Exercises</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">{exercises.length} Total</span>
          </h3>

          <div className="space-y-2">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  setSelectedEx(ex)
                  setCode(ex.starter_code || '')
                  setOutput(null)
                  setPassed(null)
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedEx?.id === ex.id
                    ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <p className="font-bold text-xs sm:text-sm">{ex.title}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5 font-mono">{ex.language}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Code Editor & Execution Panel */}
        <div className="lg:col-span-2 space-y-5">
          {selectedEx ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                  {selectedEx.language}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">{selectedEx.title}</h3>
                <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                  {selectedEx.prompt}
                </p>
              </div>

              {/* Code Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600 font-mono font-bold">Solution Editor</label>
                  <button
                    onClick={handleRunCode}
                    disabled={evaluating}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl shadow-xs text-xs transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> {evaluating ? 'Running...' : 'Run Code'}
                  </button>
                </div>

                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-[#111726] border border-slate-800 text-emerald-300 rounded-xl p-4 text-xs font-mono focus:outline-none focus:border-amber-400 h-64 resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* Terminal Output */}
              {output && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-amber-400" /> Terminal Output
                    </span>
                    {passed !== null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {passed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {passed ? 'PASSED' : 'FAILED'}
                      </span>
                    )}
                  </div>
                  <pre className="text-xs text-slate-200 whitespace-pre-wrap">{output}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs shadow-xs">
              Select an exercise from the list to start coding.
            </div>
          )}
        </div>
      </div>

      {/* Create Exercise Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Create Coding Exercise</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateExercise} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Reverse Binary Tree"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Prompt Instructions</label>
                <textarea
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Problem description and expected input/output..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-amber-400 h-20"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Starter Code Boilerplate</label>
                <textarea
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                  placeholder="def solution(n): pass"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-900 focus:outline-none focus:border-amber-400 h-24"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  Save Exercise
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
