import React, { useState, useEffect } from 'react'
import type { Course, Certificate, User } from '../lib/api'
import { getCourses, issueCertificate, verifyCertificate } from '../lib/api'
import { Award, Search, ShieldCheck, CheckCircle2, Download, Sparkles } from 'lucide-react'

type CertificatesPageProps = {
  user: User
}

export const CertificatesPage: React.FC<CertificatesPageProps> = ({ user }) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [myCertificate, setMyCertificate] = useState<Certificate | null>(null)
  const [issuing, setIssuing] = useState(false)

  // Verification lookup
  const [verifyNum, setVerifyNum] = useState('')
  const [verifiedCert, setVerifiedCert] = useState<Certificate | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    try {
      const res = await getCourses()
      setCourses(res.items || [])
      if (res.items.length > 0) setSelectedCourseId(res.items[0].id)
    } catch (err) {
      console.error(err)
    }
  }

  const handleIssueCertificate = async () => {
    if (!selectedCourseId) return
    setIssuing(true)
    try {
      const cert = await issueCertificate(selectedCourseId)
      setMyCertificate(cert)
    } catch (err: any) {
      alert(err.message || 'Could not issue certificate')
    } finally {
      setIssuing(false)
    }
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
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="w-full min-h-screen px-4 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shadow-xs">
              <Award className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Certificates & Credentials
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            Issue verifiable course completion certificates and validate student credentials.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issue Certificate Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Claim Course Certificate</h3>
              <p className="text-xs text-slate-500">Claim your official credential upon course completion</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Select Completed Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:border-amber-400"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleIssueCertificate}
              disabled={issuing}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl shadow-xs transition-all text-xs cursor-pointer"
            >
              {issuing ? 'Generating Certificate...' : 'Generate Official Certificate'}
            </button>
          </div>

          {/* Render Certificate Card if Issued */}
          {myCertificate && (
            <div className="mt-6 p-6 bg-amber-50/40 border-2 border-amber-300 rounded-2xl shadow-xs space-y-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">Official Certificate of Completion</span>
                  <h4 className="text-lg font-bold text-slate-900 mt-1">{user.display_name}</h4>
                </div>
                <Award className="w-8 h-8 text-amber-600" />
              </div>

              <div className="pt-2 border-t border-amber-200/80 space-y-1 text-xs">
                <p className="text-slate-600">Certificate No: <span className="font-mono font-bold text-slate-900">{myCertificate.certificate_number}</span></p>
                <p className="text-slate-600">Issued On: {new Date(myCertificate.issued_at).toLocaleDateString()}</p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => alert(`Certificate verified: ${myCertificate.certificate_number}`)}
                  className="bg-white text-slate-800 hover:text-slate-950 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" /> Export PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Certificate Verification Lookup */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Public Verification Desk</h3>
              <p className="text-xs text-slate-500">Verify authenticity of any certificate number</p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Enter Certificate Number</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={verifyNum}
                  onChange={(e) => setVerifyNum(e.target.value)}
                  placeholder="e.g. CERT-2026-XXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pr-10 text-xs text-slate-900 focus:outline-none focus:border-amber-400 font-mono"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold py-2.5 rounded-xl border border-slate-200 transition-colors text-xs cursor-pointer shadow-xs"
            >
              {verifying ? 'Checking Verification Database...' : 'Verify Credential'}
            </button>
          </form>

          {verifyError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-center font-medium">
              {verifyError}
            </div>
          )}

          {verifiedCert && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Certificate Verified & Authentic
              </div>
              <p className="text-slate-700">Certificate Number: <span className="font-mono font-bold text-slate-900">{verifiedCert.certificate_number}</span></p>
              <p className="text-slate-700">Issued Date: {new Date(verifiedCert.issued_at).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CertificatesPage
