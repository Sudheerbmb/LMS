import React, { useState, useEffect } from 'react'
import type { Course, Certificate, User } from '../lib/api'
import { getCourses, issueCertificate, verifyCertificate } from '../lib/api'
import { Award, Search, ShieldCheck, CheckCircle2, Download, Sparkles, Star } from 'lucide-react'

type CertificatesPageProps = {
  user: User
}

export const CertificatesPage: React.FC<CertificatesPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [myCertificate, setMyCertificate] = useState<Certificate | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [verifyNum, setVerifyNum] = useState('')
  const [verifiedCert, setVerifiedCert] = useState<Certificate | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  useEffect(() => { loadCourses() }, [])

  const loadCourses = async () => {
    try {
      const res = await getCourses()
      setCourses(res.items || [])
      if (res.items.length > 0) setSelectedCourseId(res.items[0].id)
    } catch (err) { console.error(err) }
  }

  const handleIssueCertificate = async () => {
    if (!selectedCourseId) return
    setIssuing(true)
    try {
      const cert = await issueCertificate(selectedCourseId)
      setMyCertificate(cert)
    } catch (err: any) {
      alert(err.message || 'Could not issue certificate')
    } finally { setIssuing(false) }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyNum.trim()) return
    setVerifying(true)
    setVerifyError('')
    setVerifiedCert(null)
    try {
      const cert = await verifyCertificate(verifyNum.trim())
      setVerifiedCert(cert)
    } catch (err: any) {
      setVerifyError(err.message || 'Invalid or non-existent certificate number.')
    } finally { setVerifying(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* HERO — Achievement gallery */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 320px',
        minHeight: 320, borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ padding: '48px 48px 40px', background: 'var(--canvas-warm)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--saffron)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
            Achievement Gallery
          </div>
          <h1 style={{ margin: 0, marginBottom: 12, fontSize: 38, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, lineHeight: 1.1, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Your credentials,<br />
            <em style={{ fontStyle: 'italic', color: 'var(--saffron)' }}>earned.</em>
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.65, maxWidth: 420 }}>
            Claim verifiable certificates for your completed courses. Each credential is blockchain-backed and publicly verifiable.
          </p>
        </div>
        <div style={{ position: 'relative', overflow: 'hidden', minHeight: 280 }}>
          <img src="/assets/achievement.jpg" alt="Achievement" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(247,245,240,0.3) 0%, transparent 40%)' }} />
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 48px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

          {/* ISSUE CERTIFICATE */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--saffron-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles style={{ width: 18, height: 18, color: 'var(--saffron)' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Claim Certificate
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>Issue your official credential</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Course
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-med)', background: 'white', fontSize: 13, color: 'var(--ink)', outline: 'none', fontFamily: 'inherit' }}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                  {courses.length === 0 && <option value="">No courses available</option>}
                </select>
              </div>

              <button
                onClick={handleIssueCertificate}
                disabled={issuing || !selectedCourseId}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', justifyContent: 'center', opacity: !selectedCourseId ? 0.5 : 1 }}
              >
                <Award style={{ width: 16, height: 16 }} />
                {issuing ? 'Generating...' : 'Generate Certificate'}
              </button>
            </div>

            {/* Certificate preview */}
            {myCertificate && (
              <div style={{
                marginTop: 24,
                background: 'linear-gradient(135deg, #FFFBF0 0%, #FFF8E8 100%)',
                border: '2px solid rgba(232, 130, 12, 0.3)',
                borderRadius: 16, padding: '24px',
                position: 'relative', overflow: 'hidden'
              }}>
                {/* Decorative pattern */}
                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(232,130,12,0.07)' }} />
                <div style={{ position: 'absolute', bottom: -30, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(232,130,12,0.05)' }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--saffron-d)', marginBottom: 6 }}>
                        Certificate of Completion
                      </div>
                      <h3 style={{ margin: 0, fontSize: 20, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400, color: 'var(--ink)', lineHeight: 1.2 }}>
                        {user.display_name}
                      </h3>
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--saffron)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(232,130,12,0.3)', flexShrink: 0 }}>
                      <Award style={{ width: 20, height: 20, color: 'white' }} />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(232,130,12,0.2)', paddingTop: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Certificate No:</span>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink)' }}>
                          {myCertificate.certificate_number}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Issued:</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
                          {new Date(myCertificate.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => alert(`Certificate verified: ${myCertificate.certificate_number}`)}
                      className="btn-ghost"
                      style={{ marginTop: 14, fontSize: 12, padding: '7px 14px' }}
                    >
                      <Download style={{ width: 13, height: 13 }} />
                      Export PDF
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* VERIFICATION */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--sky-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck style={{ width: 18, height: 18, color: 'var(--sky)' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Verify Credential
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>Public certificate lookup</p>
              </div>
            </div>

            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Certificate Number
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    value={verifyNum}
                    onChange={(e) => setVerifyNum(e.target.value)}
                    placeholder="e.g. CERT-2026-XXXX"
                    style={{
                      width: '100%', padding: '10px 36px 10px 12px', borderRadius: 10,
                      border: '1px solid var(--border-med)', background: 'white',
                      fontSize: 13, color: 'var(--ink)', outline: 'none',
                      fontFamily: "'JetBrains Mono', monospace", boxSizing: 'border-box'
                    }}
                  />
                  <Search style={{ width: 14, height: 14, color: 'var(--ink-muted)', position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              <button type="submit" disabled={verifying} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
                <ShieldCheck style={{ width: 15, height: 15 }} />
                {verifying ? 'Verifying...' : 'Verify Certificate'}
              </button>
            </form>

            {verifyError && (
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--coral-bg)', border: '1px solid rgba(212,75,47,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--coral)', fontWeight: 500 }}>
                {verifyError}
              </div>
            )}

            {verifiedCert && (
              <div style={{ marginTop: 16, padding: '16px', background: 'var(--mint-bg)', border: '1px solid rgba(10,121,85,0.2)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--mint)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--mint)' }}>Certificate Verified ✓</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    Number: <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{verifiedCert.certificate_number}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    Issued: <span style={{ fontWeight: 600 }}>{new Date(verifiedCert.issued_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Achievement visual */}
            <div style={{ marginTop: 32, padding: '20px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                {[1,2,3].map(i => <Star key={i} style={{ width: 16, height: 16, color: 'var(--saffron)', fill: 'var(--saffron)' }} />)}
              </div>
              <p style={{ margin: 0, fontSize: 13, fontFamily: "'Fraunces', Georgia, serif", color: 'var(--ink-2)', lineHeight: 1.5, fontStyle: 'italic' }}>
                "Every certificate represents a commitment kept — to yourself."
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ink-muted)' }}>Acharya Learning</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CertificatesPage
