import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, getWsBase } from '../api/client'
import { useAuth } from '../context/AuthContext'
import useMediaDevices from '../hooks/useMediaDevices'
import Icon from '../components/Icon'
import './Meet.css'

export default function MeetLobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const wsRef = useRef(null)
  const [meeting, setMeeting] = useState(null)
  const [err, setErr] = useState('')
  const [audioOn, setAudioOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [starting, setStarting] = useState(true)
  const [hasStream, setHasStream] = useState(false)
  const [copied, setCopied] = useState(false)
  const [waitingStatus, setWaitingStatus] = useState(null)
  const [showDevices, setShowDevices] = useState(false)
  const [meetingPwd, setMeetingPwd] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)

  const { devices, audioDeviceId, setAudioDeviceId, videoDeviceId, setVideoDeviceId, refresh: refreshDevices } = useMediaDevices()

  useEffect(() => {
    api(`/api/meetings/${code}`)
      .then((m) => {
        setMeeting(m)
        if (m.password_protected && m.host_id !== user?.id) setNeedsPassword(true)
      })
      .catch((e) => setErr(e.message || 'Meeting not found'))
  }, [code, user?.id])

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setHasStream(true)
        setStarting(false)
        refreshDevices()
      } catch {
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
  }, [refreshDevices])

  useEffect(() => {
    return () => {
      if (wsRef.current) { try { wsRef.current.close() } catch {}; wsRef.current = null }
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

  const switchAudio = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true },
      })
      const newTrack = newStream.getAudioTracks()[0]
      const old = streamRef.current?.getAudioTracks()[0]
      if (old) { streamRef.current.removeTrack(old); old.stop() }
      streamRef.current.addTrack(newTrack)
      newTrack.enabled = audioOn
      setAudioDeviceId(deviceId)
    } catch {}
  }

  const switchVideo = async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      const newTrack = newStream.getVideoTracks()[0]
      const old = streamRef.current?.getVideoTracks()[0]
      if (old) { streamRef.current.removeTrack(old); old.stop() }
      streamRef.current.addTrack(newTrack)
      newTrack.enabled = videoOn
      if (videoRef.current) videoRef.current.srcObject = streamRef.current
      setVideoDeviceId(deviceId)
    } catch {}
  }

  const join = async () => {
    try {
      const joinBody = { code }
      if (needsPassword) joinBody.password = meetingPwd
      const participant = await api(`/api/meetings/${code}/join`, {
        method: 'POST',
        body: joinBody,
      })

      sessionStorage.setItem(
        `zoiko_meet_prefs_${code}`,
        JSON.stringify({ audio: audioOn, video: videoOn })
      )
      // Stash the password so MeetRoom can pass it to the WS connection
      if (needsPassword && meetingPwd) {
        sessionStorage.setItem(`zoiko_meet_pwd_${code}`, meetingPwd)
      }

      if (participant.status === 'pending') {
        setWaitingStatus('pending')

        const token = localStorage.getItem('zoiko_token')
        let wsUrl = `${getWsBase()}/ws/meetings/${code}?token=${encodeURIComponent(token)}`
        if (needsPassword && meetingPwd) wsUrl += `&pwd=${encodeURIComponent(meetingPwd)}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onmessage = (e) => {
          let data
          try { data = JSON.parse(e.data) } catch { return }

          if (data.type === 'admitted' || data.type === 'welcome') {
            setWaitingStatus('admitted')
            try { ws.close() } catch {}
            wsRef.current = null
            navigate(`/meet/${code}/room`)
          } else if (data.type === 'denied') {
            setWaitingStatus('denied')
            setErr('The host has denied your request to join.')
            try { ws.close() } catch {}
            wsRef.current = null
          }
        }

        const keepalive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          } else { clearInterval(keepalive) }
        }, 3000)
      } else {
        navigate(`/meet/${code}/room`)
      }
    } catch (e) {
      setErr(e.message || 'Could not join meeting')
    }
  }

  const cancelWaiting = () => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: 'leave' })); wsRef.current.close() } catch {}
      wsRef.current = null
    }
    setWaitingStatus(null)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meet/${code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { setCopied(false) }
  }

  // ── Waiting room screen ──────────────────────────────────────────────
  if (waitingStatus === 'pending') {
    return (
      <div className="lobby">
        <div className="lobby-bg" />
        <div className="lobby-waiting">
          <div className="lobby-waiting-card">
            <div className="lobby-waiting-spinner"><div className="spinner" /></div>
            <h2 className="lobby-waiting-title">Waiting for the host to let you in</h2>
            <p className="lobby-waiting-sub">You'll join automatically once the host admits you.</p>
            <div className="lobby-waiting-info">
              <Icon name="shield" size={14} />
              <span>Meeting code: <span className="mono">{code}</span></span>
            </div>
            <button className="outline lg" onClick={cancelWaiting}>Cancel</button>
          </div>
        </div>
      </div>
    )
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
            ) : videoOn && hasStream ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="lobby-preview-placeholder">
                <Icon name="cameraOff" size={40} />
                <span>Camera is off</span>
              </div>
            )}
            {!starting && <div className="lobby-preview-name">{user?.name}</div>}
            <div className="lobby-preview-controls">
              <button className={'round-btn' + (audioOn ? '' : ' off')} onClick={toggleAudio} title={audioOn ? 'Mute mic' : 'Unmute'}>
                <Icon name={audioOn ? 'mic' : 'micOff'} size={20} />
              </button>
              <button className={'round-btn' + (videoOn ? '' : ' off')} onClick={toggleVideo} title={videoOn ? 'Turn camera off' : 'Turn camera on'}>
                <Icon name={videoOn ? 'camera' : 'cameraOff'} size={20} />
              </button>
              <button className={'round-btn' + (showDevices ? ' active' : '')} onClick={() => setShowDevices(!showDevices)} title="Switch device">
                <Icon name="settings" size={18} />
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
            <p className="lobby-greet">Joining as <strong>{user?.name}</strong></p>

            {meeting?.scheduled_at && (
              <div className="lobby-schedule-info">
                <Icon name="calendar" size={14} />
                <span>
                  Scheduled for{' '}
                  {new Date(meeting.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  {meeting.timezone_name ? ` (${meeting.timezone_name})` : ''}
                </span>
              </div>
            )}

            {meeting?.waiting_room_enabled && meeting?.host_id !== user?.id && (
              <div className="lobby-waiting-notice">
                <Icon name="clock" size={14} />
                <span>This meeting has a waiting room — the host will let you in.</span>
              </div>
            )}

            {needsPassword && (
              <div className="lobby-password-field">
                <Icon name="lock" size={14} />
                <input
                  type="password"
                  placeholder="Enter meeting password"
                  value={meetingPwd}
                  onChange={(e) => setMeetingPwd(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            {/* Device picker */}
            {showDevices && (
              <div className="lobby-devices">
                <div className="lobby-device-row">
                  <Icon name="mic" size={14} />
                  <select value={audioDeviceId} onChange={(e) => switchAudio(e.target.value)}>
                    {devices.audio.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</option>
                    ))}
                  </select>
                </div>
                <div className="lobby-device-row">
                  <Icon name="camera" size={14} />
                  <select value={videoDeviceId} onChange={(e) => switchVideo(e.target.value)}>
                    {devices.video.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {err && (
              <div className="auth-error">
                <Icon name="close" size={14} /> {err}
              </div>
            )}

            <div className="lobby-share">
              <Icon name="link" size={16} />
              <code>{`${window.location.origin}/meet/${code}`}</code>
              <button className="ghost lobby-share-copy" onClick={copyLink} title="Copy link">
                {copied ? <><Icon name="check" size={14} /> Copied</> : <><Icon name="copy" size={14} /> Copy</>}
              </button>
            </div>

            <div className="lobby-actions">
              <button className="primary lg lobby-join" onClick={join} disabled={!meeting || !!err || (needsPassword && !meetingPwd)}>
                <Icon name="video" size={16} /> Join now
              </button>
              <button className="outline lg" onClick={() => navigate('/')}>Cancel</button>
            </div>

            <div className="lobby-tips">
              <div className="lobby-tip">
                <Icon name="shield" size={14} />
                <span>Peer-to-peer video — your streams go directly between devices.</span>
              </div>
              <div className="lobby-tip">
                <Icon name="waveform" size={14} />
                <span>HD video with noise suppression and adaptive quality.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
