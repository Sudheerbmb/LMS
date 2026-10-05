import React, { useState, useEffect } from 'react'
import type { CodingExercise, Course, User } from '../lib/api'
import { getCourses, getCodingExercises, createCodingExercise, submitCodingSolution } from '../lib/api'
import { Play, Plus, Terminal, CheckCircle2, AlertCircle, X, Sparkles, BookOpen } from 'lucide-react'

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
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* EDITORIAL HERO */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 340px',
        minHeight: 280,
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{
          padding: '40px 48px',
          background: 'var(--canvas-warm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--saffron)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Sparkles style={{ width: 14, height: 14 }} />
            Developer Sandbox • Computational Lab
          </div>
          <h1 style={{
            margin: 0,
            marginBottom: 12,
            fontSize: 36,
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 400,
            lineHeight: 1.15,
            color: 'var(--ink)',
            letterSpacing: '-0.02em'
          }}>
            Algorithms & kernels,<br />
            <em style={{ fontStyle: 'italic', color: 'var(--saffron)' }}>executed live.</em>
          </h1>
          <p style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--ink-3)',
            lineHeight: 1.6,
            maxWidth: 520
          }}>
            Solve algorithms, test code snippets, and receive automated test results with instant runtime verification.
          </p>
        </div>

        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <img
            src="/assets/coding.jpg"
            alt="Computational Lab"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(247,245,240,0.3) 0%, transparent 40%)'
          }} />
        </div>
      </div>

      {/* FILTER & ACTIONS BAR */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 48px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'white',
          padding: '8px 16px',
          borderRadius: 14,
          border: '1px solid var(--border)'
        }}>
          <BookOpen style={{ width: 15, height: 15, color: 'var(--saffron)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)' }}>
            Course
          </span>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink)',
              cursor: 'pointer',
              outline: 'none',
              padding: '4px 6px'
            }}
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 12,
              background: 'var(--ink)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            New Problem
          </button>
        )}
      </div>

      {/* LAB INTERFACE */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 48px 64px',
        display: 'grid',
        gridTemplateColumns: '320px minmax(0, 1fr)',
        gap: 24
      }}>
        {/* EXERCISE ROSTER */}
        <div style={{
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          height: 'fit-content'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Exercises
            </h3>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--canvas-warm)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
              {exercises.length} Total
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', padding: '16px 0', textAlign: 'center' }}>
                No challenges available for this track.
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
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: isActive ? 'var(--saffron-bg)' : 'transparent',
                      border: isActive ? '1px solid var(--saffron)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? 'var(--ink)' : 'var(--ink-1)' }}>
                      {ex.title}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: isActive ? 'var(--saffron)' : 'var(--ink-3)', marginTop: 4, textTransform: 'uppercase' }}>
                      {ex.language}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* WORKBENCH & TERMINAL */}
        <div>
          {selectedEx ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Problem Statement Card */}
              <div style={{
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '24px 28px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--saffron)',
                    background: 'var(--saffron-bg)',
                    padding: '2px 8px',
                    borderRadius: 6
                  }}>
                    {selectedEx.language}
                  </span>
                </div>
                <h2 style={{
                  margin: '0 0 12px',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  {selectedEx.title}
                </h2>
                <div style={{
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  lineHeight: 1.6,
                  background: 'var(--canvas-warm)',
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--border)'
                }}>
                  {selectedEx.prompt}
                </div>
              </div>

              {/* Code Editor */}
              <div style={{
                background: '#0d1117',
                borderRadius: 16,
                border: '1px solid #30363d',
                overflow: 'hidden',
                boxShadow: '0 12px 32px -8px rgba(0,0,0,0.3)'
              }}>
                <div style={{
                  padding: '12px 20px',
                  background: '#161b22',
                  borderBottom: '1px solid #30363d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e', marginLeft: 8 }}>
                      solution.{selectedEx.language === 'python' ? 'py' : 'txt'}
                    </span>
                  </div>

                  <button
                    onClick={handleRunCode}
                    disabled={evaluating}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--saffron)',
                      color: '#0d1117',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Play style={{ width: 13, height: 13, fill: 'currentColor' }} />
                    {evaluating ? 'Executing...' : 'Run Kernel'}
                  </button>
                </div>

                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{
                    width: '100%',
                    height: 280,
                    background: '#0d1117',
                    color: '#e6edf3',
                    border: 'none',
                    padding: 20,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
                    lineHeight: 1.6,
                    resize: 'none',
                    outline: 'none'
                  }}
                  spellCheck={false}
                />
              </div>

              {/* Terminal Output */}
              {output && (
                <div style={{
                  background: '#090d13',
                  borderRadius: 14,
                  border: '1px solid #30363d',
                  padding: 18,
                  fontFamily: 'monospace'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #21262d',
                    paddingBottom: 10,
                    marginBottom: 12
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Terminal style={{ width: 14, height: 14, color: 'var(--saffron)' }} />
                      Runtime Console
                    </span>
                    {passed !== null && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: passed ? 'rgba(46, 160, 67, 0.2)' : 'rgba(248, 81, 73, 0.2)',
                        color: passed ? '#3fb950' : '#f85149'
                      }}>
                        {passed ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : <AlertCircle style={{ width: 12, height: 12 }} />}
                        {passed ? 'PASSED TEST SUITE' : 'FAILED CHECKS'}
                      </span>
                    )}
                  </div>
                  <pre style={{ margin: 0, fontSize: 12, color: '#e6edf3', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {output}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 64,
              textAlign: 'center',
              color: 'var(--ink-3)',
              fontSize: 13
            }}>
              Select a coding exercise from the index to begin execution.
            </div>
          )}
        </div>
      </div>

      {/* CREATE EXERCISE MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'white',
            borderRadius: 18,
            maxWidth: 520,
            width: '100%',
            padding: 32,
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)', fontFamily: "'Fraunces', Georgia, serif" }}>
                Formulate Coding Exercise
              </h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleCreateExercise} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Problem Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Invert Binary Tree in Linear Time"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-med)', fontSize: 13, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Prompt & Constraints *
                </label>
                <textarea
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe inputs, outputs, time complexity bounds, and sample cases..."
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-med)', fontSize: 13, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Starter Code Template
                </label>
                <textarea
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                  placeholder="def solve(nums: list[int]) -> int:&#10;    pass"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-med)', fontSize: 12, outline: 'none', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
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
