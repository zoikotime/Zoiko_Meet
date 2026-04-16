import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import './Meet.css'

export default function MeetLobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [meeting, setMeeting] = useState(null)
  const [err, setErr] = useState('')
  const [audioOn, setAudioOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [starting, setStarting] = useState(true)
  const [copyMsg, setCopyMsg] = useState('')

  useEffect(() => {
    api(`/api/meetings/${code}`)
      .then(setMeeting)
      .catch((e) => setErr(e.message || 'Meeting not found'))
  }, [code])

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setStarting(false)
      } catch (e) {
        if (!cancelled) {
          setErr('Could not access camera/microphone. Check browser permissions.')
          setStarting(false)
        }
      }
    }
    start()
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  const toggleAudio = () => {
    if (!streamRef.current) return
    const next = !audioOn
    streamRef.current.getAudioTracks().forEach((t) => (t.enabled = next))
    setAudioOn(next)
  }
  const toggleVideo = () => {
    if (!streamRef.current) return
    const next = !videoOn
    streamRef.current.getVideoTracks().forEach((t) => (t.enabled = next))
    setVideoOn(next)
  }

  const join = () => {
    // Preserve user preferences through navigation
    sessionStorage.setItem(
      `zoiko_meet_prefs_${code}`,
      JSON.stringify({ audio: audioOn, video: videoOn })
    )
    navigate(`/meet/${code}/room`)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meet/${code}`)
      setCopyMsg('Copied!')
      setTimeout(() => setCopyMsg(''), 1500)
    } catch {
      setCopyMsg('Copy failed')
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-preview">
        <div className="lobby-preview-inner">
          {starting ? (
            <div className="spinner" />
          ) : videoOn && streamRef.current ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : (
            <div className="lobby-preview-placeholder">
              Camera is off
              <div style={{ marginTop: 8, fontSize: 18 }}>📷</div>
            </div>
          )}
          <div className="lobby-preview-controls">
            <button
              className={'round-btn' + (audioOn ? '' : ' off')}
              onClick={toggleAudio}
              title={audioOn ? 'Mute mic' : 'Unmute'}
            >
              {audioOn ? '🎙️' : '🔇'}
            </button>
            <button
              className={'round-btn' + (videoOn ? '' : ' off')}
              onClick={toggleVideo}
              title={videoOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {videoOn ? '📹' : '📷'}
            </button>
          </div>
        </div>
      </div>
      <div className="lobby-panel">
        <div className="lobby-card">
          <h1 className="lobby-title">
            {meeting?.title || 'Ready to join?'}
          </h1>
          <div className="lobby-code">Meeting code: {code}</div>
          {err && <div className="auth-error">{err}</div>}
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Joining as <strong style={{ color: 'var(--text)' }}>{user?.name}</strong>
          </p>
          <div className="lobby-share">
            <span>🔗</span>
            <code>{`${window.location.origin}/meet/${code}`}</code>
            <button className="ghost" onClick={copyLink} style={{ padding: '4px 10px' }}>
              {copyMsg || 'Copy'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={join} disabled={!meeting || !!err}>
              Join now
            </button>
            <button onClick={() => navigate('/')}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
