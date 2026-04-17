import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
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
  const [copied, setCopied] = useState(false)

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
    sessionStorage.setItem(
      `zoiko_meet_prefs_${code}`,
      JSON.stringify({ audio: audioOn, video: videoOn })
    )
    navigate(`/meet/${code}/room`)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meet/${code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-bg" />
      <div className="lobby-shell">
        <div className="lobby-preview">
          <div className="lobby-preview-frame">
            {starting ? (
              <div className="lobby-loading">
                <div className="spinner" />
                <span>Starting camera…</span>
              </div>
            ) : videoOn && streamRef.current ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="lobby-preview-placeholder">
                <Icon name="cameraOff" size={40} />
                <span>Camera is off</span>
              </div>
            )}
            {!starting && (
              <div className="lobby-preview-name">{user?.name}</div>
            )}
            <div className="lobby-preview-controls">
              <button
                className={'round-btn' + (audioOn ? '' : ' off')}
                onClick={toggleAudio}
                title={audioOn ? 'Mute mic' : 'Unmute'}
                aria-label={audioOn ? 'Mute microphone' : 'Unmute microphone'}
              >
                <Icon name={audioOn ? 'mic' : 'micOff'} size={20} />
              </button>
              <button
                className={'round-btn' + (videoOn ? '' : ' off')}
                onClick={toggleVideo}
                title={videoOn ? 'Turn camera off' : 'Turn camera on'}
                aria-label={videoOn ? 'Turn camera off' : 'Turn camera on'}
              >
                <Icon name={videoOn ? 'camera' : 'cameraOff'} size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="lobby-panel">
          <div className="lobby-card">
            <div className="lobby-code-badge">
              <span className="lobby-code-dot" />
              Meeting code · <span className="mono">{code}</span>
            </div>
            <h1 className="lobby-title">{meeting?.title || 'Ready to join?'}</h1>
            <p className="lobby-greet">
              Joining as <strong>{user?.name}</strong>
            </p>

            {err && (
              <div className="auth-error">
                <Icon name="close" size={14} /> {err}
              </div>
            )}

            <div className="lobby-share">
              <Icon name="link" size={16} />
              <code>{`${window.location.origin}/meet/${code}`}</code>
              <button className="ghost lobby-share-copy" onClick={copyLink} title="Copy link">
                {copied ? (
                  <><Icon name="check" size={14} /> Copied</>
                ) : (
                  <><Icon name="copy" size={14} /> Copy</>
                )}
              </button>
            </div>

            <div className="lobby-actions">
              <button className="primary lg lobby-join" onClick={join} disabled={!meeting || !!err}>
                <Icon name="video" size={16} /> Join now
              </button>
              <button className="outline lg" onClick={() => navigate('/')}>
                Cancel
              </button>
            </div>

            <div className="lobby-tips">
              <div className="lobby-tip">
                <Icon name="shield" size={14} />
                <span>Peer-to-peer video — your streams go directly between devices.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
