import React, { useState, useEffect } from 'react'
import type { Organization, OrgMember, User } from '../lib/api'
import { getOrganizations, createOrganization, getOrgMembers, inviteOrgMember } from '../lib/api'
import { Building2, Plus, Users, Mail, Shield, UserCheck } from 'lucide-react'

type OrganizationsPageProps = {
  user: User
}

export const OrganizationsPage: React.FC<OrganizationsPageProps> = ({ user }) => {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])

  // Create Org Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')

  useEffect(() => {
    loadOrgs()
  }, [])

  const loadOrgs = async () => {
    try {
      const list = await getOrganizations()
      setOrgs(list)
      if (list.length > 0) {
        setSelectedOrg(list[0])
        loadMembers(list[0].id)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadMembers = async (orgId: string) => {
    try {
      const mems = await getOrgMembers(orgId)
      setMembers(mems)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const created = await createOrganization({ name, slug: slug.toLowerCase() })
      setOrgs([...orgs, created])
      setSelectedOrg(created)
      setShowCreateModal(false)
      setName('')
      setSlug('')
    } catch (err: any) {
      alert(err.message || 'Failed to create organization')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrg) return
    try {
      await inviteOrgMember(selectedOrg.id, inviteEmail, inviteRole)
      alert(`Invitation sent to ${inviteEmail}`)
      setShowInviteModal(false)
      setInviteEmail('')
    } catch (err: any) {
      alert(err.message || 'Failed to send invite')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#111827] font-sans pb-16">
      {/* Editorial Header Banner */}
      <div className="border-b border-black/[0.06] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF3EA] text-[#FF7A18] text-xs font-semibold uppercase tracking-wider mb-3 border border-[#FFDEC4]">
              <Shield className="w-3.5 h-3.5" />
              Multi-Tenant Architecture
            </div>
            <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight font-serif">
              Organization Control Center
            </h1>
            <p className="text-[#64748B] text-sm mt-1 max-w-xl">
              Manage multi-tenant academic institutions, team workspaces, member credentials, and role permissions.
            </p>
          </div>

          {user.role === 'admin' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold px-5 py-3 rounded-2xl shadow-sm hover:shadow transition-all text-sm self-start md:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Organization
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Organizations List */}
          <div className="bg-white border border-black/[0.06] rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF3EA] text-[#FF7A18] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-[#111827] text-base">Organizations</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FAF9F6] text-[#64748B] border border-black/[0.06]">
                {orgs.length} Active
              </span>
            </div>

            <div className="space-y-2.5">
              {orgs.map((org) => {
                const isSelected = selectedOrg?.id === org.id
                return (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrg(org)
                      loadMembers(org.id)
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFF3EA] border-[#FFDEC4] text-[#111827] shadow-xs'
                        : 'bg-[#FAF9F6] border-black/[0.06] text-[#64748B] hover:bg-white hover:border-[#FF7A18]/30 hover:text-[#111827]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-[#111827]">{org.name}</p>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#FF7A18]" />
                      )}
                    </div>
                    <p className="text-xs text-[#94A3B8] font-mono mt-1">slug: {org.slug}</p>
                  </button>
                )
              })}
              {orgs.length === 0 && (
                <div className="py-8 text-center text-xs text-[#94A3B8]">
                  No organizations configured yet.
                </div>
              )}
            </div>
          </div>

          {/* Selected Org Detail & Members */}
          <div className="lg:col-span-2 bg-white border border-black/[0.06] rounded-3xl p-6 shadow-xs space-y-6">
            {selectedOrg ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-black/[0.06] gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-[#FF7A18] uppercase tracking-wider bg-[#FFF3EA] px-2.5 py-0.5 rounded-full border border-[#FFDEC4]">
                      Active Workspace
                    </span>
                    <h3 className="text-2xl font-extrabold text-[#111827] mt-2 font-serif">{selectedOrg.name}</h3>
                    <p className="text-xs text-[#64748B] font-mono mt-0.5">Workspace Tenant Identifier: {selectedOrg.slug}</p>
                  </div>

                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="inline-flex items-center gap-2 bg-[#FAF9F6] hover:bg-[#FFF3EA] text-[#111827] hover:text-[#FF7A18] text-xs font-bold px-4 py-2.5 rounded-xl border border-black/[0.08] hover:border-[#FF7A18]/30 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Mail className="w-4 h-4 text-[#FF7A18]" />
                    <span>Invite Member</span>
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-[#111827] text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#FF7A18]" />
                      <span>Organization Members</span>
                    </h4>
                    <span className="text-xs text-[#64748B] font-medium">
                      {members.length} {members.length === 1 ? 'member' : 'members'} enrolled
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {members.length === 0 ? (
                      <div className="p-8 text-center bg-[#FAF9F6] rounded-2xl border border-black/[0.06]">
                        <UserCheck className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                        <p className="text-xs text-[#64748B] font-medium">No members registered under this tenant yet.</p>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">Click "Invite Member" above to onboard colleagues.</p>
                      </div>
                    ) : (
                      members.map((m) => (
                        <div
                          key={m.id}
                          className="p-4 bg-[#FAF9F6] border border-black/[0.06] rounded-2xl flex items-center justify-between hover:bg-white hover:border-[#FF7A18]/30 transition-all"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-9 h-9 rounded-full bg-[#FFF3EA] text-[#FF7A18] border border-[#FFDEC4] flex items-center justify-center font-bold text-xs">
                              {m.user?.display_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#111827]">{m.user?.display_name || 'Member'}</p>
                              <p className="text-[11px] text-[#64748B]">{m.user?.email}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF7A18] bg-[#FFF3EA] px-3 py-1 rounded-full border border-[#FFDEC4]">
                            {m.role}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-[#94A3B8]">
                Select an organization from the left panel to manage workspace members and settings.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Org Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF3EA] text-[#FF7A18] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#111827]">Create Organization</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-2xl font-bold p-1 leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="text-xs text-[#111827] font-semibold">Organization Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
                  }}
                  placeholder="e.g. Acme Academy"
                  className="w-full mt-1.5 bg-[#FAF9F6] border border-black/[0.08] rounded-xl p-3 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="text-xs text-[#111827] font-semibold">Tenant Slug (Unique identifier)</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full mt-1.5 bg-[#FAF9F6] border border-black/[0.08] rounded-xl p-3 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#FF7A18] font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-[#64748B] hover:text-[#111827] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  Save Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF3EA] text-[#FF7A18] flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#111827]">Invite Member</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[#94A3B8] hover:text-[#111827] text-2xl font-bold p-1 leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs text-[#111827] font-semibold">User Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@organization.com"
                  className="w-full mt-1.5 bg-[#FAF9F6] border border-black/[0.08] rounded-xl p-3 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#FF7A18]"
                />
              </div>

              <div>
                <label className="text-xs text-[#111827] font-semibold">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full mt-1.5 bg-[#FAF9F6] text-[#111827] border border-black/[0.08] rounded-xl p-3 text-xs focus:outline-none focus:border-[#FF7A18]"
                >
                  <option value="member">Member (Learner)</option>
                  <option value="instructor">Instructor (Faculty)</option>
                  <option value="admin">Tenant Admin (Institute)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2.5 rounded-xl text-[#64748B] hover:text-[#111827] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#FF7A18] hover:bg-[#EA6C0A] text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
