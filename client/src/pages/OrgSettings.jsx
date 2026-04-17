import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import Avatar from '../components/Avatar'
import './OrgSettings.css'

export default function OrgSettings() {
  const { slug } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!slug) return
    Promise.all([
      api(`/api/orgs/${slug}`),
      api(`/api/orgs/${slug}/members`),
    ])
      .then(([o, m]) => {
        setOrg(o)
        setMembers(m)
        setEditName(o.name)
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const isOwner = org?.owner_id === user?.id
  const isAdmin = isOwner || members.some(m => m.user_id === user?.id && (m.role === 'owner' || m.role === 'admin'))

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg('')
    try {
      const res = await api(`/api/orgs/${slug}/invite`, {
        method: 'POST',
        body: { email: inviteEmail.trim(), role: inviteRole },
      })
      setInviteMsg(res.detail)
      setInviteEmail('')
      // Refresh members
      api(`/api/orgs/${slug}/members`).then(setMembers).catch(() => {})
    } catch (e) {
      setInviteMsg(e.message)
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return
    try {
      await api(`/api/orgs/${slug}/members/${userId}`, { method: 'DELETE' })
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    } catch (e) {
      setErr(e.message)
    }
  }

  const saveName = async () => {
    if (!editName.trim() || editName === org?.name) return
    setSaving(true)
    try {
      const updated = await api(`/api/orgs/${slug}`, {
        method: 'PATCH',
        body: { name: editName.trim() },
      })
      setOrg(updated)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteOrg = async () => {
    if (!window.confirm('Permanently delete this organization? This cannot be undone.')) return
    try {
      await api(`/api/orgs/${slug}`, { method: 'DELETE' })
      navigate('/')
    } catch (e) {
      setErr(e.message)
    }
  }

  if (loading) {
    return (
      <div className="org-settings">
        <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="org-settings">
        <div className="org-error">
          <Icon name="building" size={32} />
          <h2>Organization not found</h2>
          <p>{err || 'This organization does not exist or you do not have access.'}</p>
          <button className="primary" onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="org-settings">
      <header className="org-hero">
        <button className="ghost org-back" onClick={() => navigate('/')}>
          <Icon name="arrowLeft" size={16} /> Back
        </button>
        <div className="org-hero-row">
          <div className="org-hero-icon">
            <Icon name="building" size={28} />
          </div>
          <div>
            <h1 className="org-hero-title">{org.name}</h1>
            <p className="org-hero-sub">{org.member_count} member{org.member_count !== 1 ? 's' : ''} &middot; {org.slug}</p>
          </div>
        </div>
      </header>

      {err && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          <Icon name="close" size={14} /> {err}
        </div>
      )}

      {/* Org name edit */}
      {isAdmin && (
        <section className="org-section">
          <h2 className="org-section-title">Organization name</h2>
          <div className="org-name-edit">
            <input value={editName} onChange={e => setEditName(e.target.value)} />
            <button
              className="primary"
              disabled={saving || !editName.trim() || editName === org.name}
              onClick={saveName}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>
      )}

      {/* Invite member */}
      {isAdmin && (
        <section className="org-section">
          <h2 className="org-section-title">Invite a member</h2>
          <div className="org-invite-row">
            <input
              placeholder="Email address"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              type="email"
            />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button className="primary" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? 'Inviting…' : <><Icon name="userPlus" size={14} /> Invite</>}
            </button>
          </div>
          {inviteMsg && <div className="org-invite-msg">{inviteMsg}</div>}
        </section>
      )}

      {/* Members list */}
      <section className="org-section">
        <h2 className="org-section-title">Members</h2>
        <div className="org-members">
          {members.map(m => (
            <div key={m.id} className="org-member">
              <Avatar name={m.user_name || 'U'} color={m.avatar_color} size="sm" />
              <div className="org-member-info">
                <div className="org-member-name">
                  {m.user_name || 'Unknown'}
                  {m.user_id === user?.id && <span className="badge sm">You</span>}
                </div>
                <div className="org-member-email">{m.user_email}</div>
              </div>
              <span className={'badge sm ' + (m.role === 'owner' ? 'accent' : '')}>{m.role}</span>
              {isAdmin && m.user_id !== org.owner_id && m.user_id !== user?.id && (
                <button className="ghost org-member-remove" onClick={() => removeMember(m.user_id)} title="Remove">
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      {isOwner && (
        <section className="org-section org-danger">
          <h2 className="org-section-title">Danger zone</h2>
          <p className="org-danger-text">Permanently delete this organization and remove all members.</p>
          <button className="outline danger-btn" onClick={deleteOrg}>
            <Icon name="trash" size={14} /> Delete organization
          </button>
        </section>
      )}
    </div>
  )
}
