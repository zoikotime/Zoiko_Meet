import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getWsBase } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import './Meet.css'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * MeetRoom — WebRTC mesh.
 * Each peer creates an RTCPeerConnection to every other peer. Whoever has the
 * smaller peer_id is the "offerer" to avoid glare.
 */
export default function MeetRoom() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [self, setSelf] = useState(null) // { peer_id, user_id, name, color }
  const [peers, setPeers] = useState({}) // peer_id -> { peer_id, user_id, name, color, stream, audio, video, screen, hand }
  const [audioOn, setAudioOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [screenOn, setScreenOn] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [sidebar, setSidebar] = useState(null) // 'chat' | 'people' | null
  const [chatMessages, setChatMessages] = useState([])
  const [chatDraft, setChatDraft] = useState('')
  const [reactions, setReactions] = useState([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [err, setErr] = useState('')

  const wsRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const pcsRef = useRef({}) // peer_id -> RTCPeerConnection
  const pendingIceRef = useRef({}) // peer_id -> [candidate]
  const selfVideoRef = useRef(null)
  const chatEndRef = useRef(null)

  const updatePeer = useCallback((peerId, patch) => {
    setPeers((prev) => {
      const existing = prev[peerId] || { peer_id: peerId }
      return { ...prev, [peerId]: { ...existing, ...patch } }
    })
  }, [])

  const removePeer = useCallback((peerId) => {
    const pc = pcsRef.current[peerId]
    if (pc) {
      try { pc.close() } catch {}
      delete pcsRef.current[peerId]
    }
    delete pendingIceRef.current[peerId]
    setPeers((prev) => {
      const next = { ...prev }
      delete next[peerId]
      return next
    })
  }, [])

  const sendSignal = useCallback((payload) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
    }
  }, [])

  const broadcastMediaState = useCallback(
    (state) => {
      sendSignal({
        type: 'media-state',
        audio: state.audio,
        video: state.video,
        screen: state.screen,
      })
    },
    [sendSignal]
  )

  const createPeerConnection = useCallback(
    (remotePeerId, remoteInfo) => {
      if (pcsRef.current[remotePeerId]) return pcsRef.current[remotePeerId]
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      // Add all local tracks
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current)
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({
            type: 'ice-candidate',
            target: remotePeerId,
            payload: e.candidate.toJSON(),
          })
        }
      }

      pc.ontrack = (e) => {
        const [stream] = e.streams
        updatePeer(remotePeerId, {
          ...(remoteInfo || {}),
          peer_id: remotePeerId,
          stream,
        })
      }

      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          // Leave cleanup to peer-left signal
        }
      }

      pcsRef.current[remotePeerId] = pc
      return pc
    },
    [sendSignal, updatePeer]
  )

  const negotiate = useCallback(
    async (remotePeerId, remoteInfo) => {
      const pc = createPeerConnection(remotePeerId, remoteInfo)
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendSignal({ type: 'offer', target: remotePeerId, payload: offer })
      } catch (e) {
        console.error('negotiate failed', e)
      }
    },
    [createPeerConnection, sendSignal]
  )

  const handleOffer = useCallback(
    async (fromPeerId, fromName, payload) => {
      const pc = createPeerConnection(fromPeerId, { name: fromName })
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload))
        // Flush pending ICE
        const pending = pendingIceRef.current[fromPeerId] || []
        for (const c of pending) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
        }
        pendingIceRef.current[fromPeerId] = []
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sendSignal({ type: 'answer', target: fromPeerId, payload: answer })
      } catch (e) {
        console.error('handleOffer failed', e)
      }
    },
    [createPeerConnection, sendSignal]
  )

  const handleAnswer = useCallback(async (fromPeerId, payload) => {
    const pc = pcsRef.current[fromPeerId]
    if (!pc) return
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload))
      const pending = pendingIceRef.current[fromPeerId] || []
      for (const c of pending) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
      }
      pendingIceRef.current[fromPeerId] = []
    } catch (e) {
      console.error('handleAnswer failed', e)
    }
  }, [])

  const handleIce = useCallback(async (fromPeerId, candidate) => {
    const pc = pcsRef.current[fromPeerId]
    if (!pc || !pc.remoteDescription) {
      pendingIceRef.current[fromPeerId] = [
        ...(pendingIceRef.current[fromPeerId] || []),
        candidate,
      ]
      return
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (e) {
      console.error('addIceCandidate failed', e)
    }
  }, [])

  // Initialize local media and WebSocket
  useEffect(() => {
    let cancelled = false
    async function setup() {
      try {
        const prefs = JSON.parse(
          sessionStorage.getItem(`zoiko_meet_prefs_${code}`) || '{}'
        )
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (prefs.audio === false) {
          stream.getAudioTracks().forEach((t) => (t.enabled = false))
          setAudioOn(false)
        }
        if (prefs.video === false) {
          stream.getVideoTracks().forEach((t) => (t.enabled = false))
          setVideoOn(false)
        }
        localStreamRef.current = stream
        if (selfVideoRef.current) selfVideoRef.current.srcObject = stream

        const token = localStorage.getItem('zoiko_token')
        const ws = new WebSocket(
          `${getWsBase()}/ws/meetings/${code}?token=${encodeURIComponent(token)}`
        )
        wsRef.current = ws

        ws.onmessage = async (e) => {
          let data
          try { data = JSON.parse(e.data) } catch { return }

          if (data.type === 'welcome') {
            setSelf(data.self)
            // Existing peers: whoever has smaller peer_id is offerer
            for (const p of data.peers) {
              updatePeer(p.peer_id, p)
              if (data.self.peer_id < p.peer_id) {
                await negotiate(p.peer_id, p)
              }
            }
            broadcastMediaState({
              audio: prefs.audio !== false,
              video: prefs.video !== false,
              screen: false,
            })
          } else if (data.type === 'peer-joined') {
            updatePeer(data.peer.peer_id, data.peer)
            // Newcomer will initiate only if their id is smaller; otherwise existing waits
            // Actually — we (existing) may be the one with smaller id; let's check:
            setSelf((current) => {
              if (current && current.peer_id < data.peer.peer_id) {
                negotiate(data.peer.peer_id, data.peer)
              }
              return current
            })
          } else if (data.type === 'peer-left') {
            removePeer(data.peer_id)
          } else if (data.type === 'offer') {
            await handleOffer(data.from, data.from_user, data.payload)
          } else if (data.type === 'answer') {
            await handleAnswer(data.from, data.payload)
          } else if (data.type === 'ice-candidate') {
            await handleIce(data.from, data.payload)
          } else if (data.type === 'media-state') {
            updatePeer(data.peer_id, {
              audio: data.audio,
              video: data.video,
              screen: data.screen,
            })
          } else if (data.type === 'chat') {
            setChatMessages((prev) => [...prev, data])
          } else if (data.type === 'reaction') {
            const id = Math.random().toString(36).slice(2)
            setReactions((prev) => [
              ...prev,
              { id, emoji: data.emoji, left: 10 + Math.random() * 80 },
            ])
            setTimeout(
              () => setReactions((prev) => prev.filter((r) => r.id !== id)),
              2400
            )
          } else if (data.type === 'raise-hand') {
            updatePeer(data.peer_id, { hand: data.raised })
          }
        }

        ws.onclose = (ev) => {
          if (ev.code === 4401) setErr('Session expired, please sign in again.')
          else if (ev.code === 4404) setErr('Meeting has ended.')
        }
      } catch (e) {
        setErr(e.message || 'Could not start meeting')
      }
    }
    setup()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { wsRef.current?.close() } catch {}
      for (const pc of Object.values(pcsRef.current)) {
        try { pc.close() } catch {}
      }
      pcsRef.current = {}
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const toggleAudio = () => {
    if (!localStreamRef.current) return
    const next = !audioOn
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = next))
    setAudioOn(next)
    broadcastMediaState({ audio: next, video: videoOn, screen: screenOn })
  }

  const toggleVideo = () => {
    if (!localStreamRef.current) return
    const next = !videoOn
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = next))
    setVideoOn(next)
    broadcastMediaState({ audio: audioOn, video: next, screen: screenOn })
  }

  const replaceVideoTrack = async (newTrack) => {
    for (const pc of Object.values(pcsRef.current)) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video')
      if (sender) {
        try { await sender.replaceTrack(newTrack) } catch {}
      }
    }
  }

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })
      screenStreamRef.current = stream
      const screenTrack = stream.getVideoTracks()[0]
      await replaceVideoTrack(screenTrack)
      if (selfVideoRef.current) selfVideoRef.current.srcObject = stream
      screenTrack.onended = stopScreenShare
      setScreenOn(true)
      broadcastMediaState({ audio: audioOn, video: videoOn, screen: true })
    } catch (e) {
      // user cancelled
    }
  }

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
    }
    const camTrack = localStreamRef.current?.getVideoTracks()[0]
    if (camTrack) await replaceVideoTrack(camTrack)
    if (selfVideoRef.current) selfVideoRef.current.srcObject = localStreamRef.current
    setScreenOn(false)
    broadcastMediaState({ audio: audioOn, video: videoOn, screen: false })
  }

  const leave = () => {
    try { wsRef.current?.close() } catch {}
    navigate('/')
  }

  const sendReaction = (emoji) => {
    sendSignal({ type: 'reaction', emoji })
    const id = Math.random().toString(36).slice(2)
    setReactions((prev) => [
      ...prev,
      { id, emoji, left: 10 + Math.random() * 80 },
    ])
    setTimeout(
      () => setReactions((prev) => prev.filter((r) => r.id !== id)),
      2400
    )
    setShowEmoji(false)
  }

  const toggleHand = () => {
    const next = !handRaised
    setHandRaised(next)
    sendSignal({ type: 'raise-hand', raised: next })
  }

  const sendChat = () => {
    const body = chatDraft.trim()
    if (!body) return
    sendSignal({ type: 'chat', body })
    setChatDraft('')
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meet/${code}`)
    } catch {}
  }

  const peerList = useMemo(() => Object.values(peers), [peers])
  const tileCount = peerList.length + 1 // +1 for self
  const hasScreenShare = screenOn || peerList.some((p) => p.screen)

  if (err) {
    return (
      <div className="room" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>{err}</h2>
          <button className="primary" onClick={() => navigate('/')}>Back home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="room">
      <div className="room-topbar">
        <div className="room-topbar-brand">
          <span className="room-topbar-brand-mark">Z</span>
          <span>Zoiko Meet</span>
        </div>
        <div className="room-title" />
        <div className="room-meta">
          <span className="badge live">Live</span>
          <span className="room-code">{code}</span>
          <button className="ghost room-copy" onClick={copyInvite} title="Copy invite link">
            <Icon name="copy" size={14} /> Copy
          </button>
        </div>
      </div>

      <div className="room-main">
        <div className={`room-stage tiles-${Math.min(tileCount, 12)}`}>
          <div className={'tile self' + (screenOn ? ' screen' : '')}>
            {videoOn || screenOn ? (
              <video ref={selfVideoRef} autoPlay playsInline muted />
            ) : (
              <div className="tile-placeholder">
                <Avatar name={user.name} color={user.avatar_color} size="lg" />
              </div>
            )}
            {handRaised && (
              <div className="tile-hand" title="Hand raised">
                <Icon name="hand" size={16} />
              </div>
            )}
            <div className="tile-name">
              <span>{user.name} (you){screenOn ? ' · sharing' : ''}</span>
            </div>
            {!audioOn && (
              <div className="tile-muted" title="Muted">
                <Icon name="micOff" size={14} />
              </div>
            )}
          </div>

          {peerList.map((p) => (
            <PeerTile key={p.peer_id} peer={p} />
          ))}
        </div>

        {sidebar && (
          <div className="room-sidebar">
            <div className="room-sidebar-tabs">
              <button
                className={'room-sidebar-tab' + (sidebar === 'chat' ? ' active' : '')}
                onClick={() => setSidebar('chat')}
              >
                <Icon name="chat" size={14} /> Chat
              </button>
              <button
                className={'room-sidebar-tab' + (sidebar === 'people' ? ' active' : '')}
                onClick={() => setSidebar('people')}
              >
                <Icon name="users" size={14} /> People · {tileCount}
              </button>
              <button
                className="room-sidebar-tab"
                onClick={() => setSidebar(null)}
                title="Close"
                style={{ flex: '0 0 auto', width: 36 }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="room-sidebar-body">
              {sidebar === 'chat' && (
                <div className="room-chat-messages">
                  {chatMessages.length === 0 && (
                    <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                      No messages yet. Say hi!
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className="room-chat-msg">
                      <div>
                        <span className="room-chat-msg-name" style={{ color: m.color }}>
                          {m.name}
                        </span>
                        <span className="room-chat-msg-time">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="room-chat-msg-body">{m.body}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
              {sidebar === 'people' && (
                <div className="room-participants">
                  <div className="room-participant">
                    <Avatar name={user.name} color={user.avatar_color} size="sm" />
                    <div className="room-participant-name">{user.name} (you)</div>
                    <div className="room-participant-badge">
                      {!audioOn && <span className="room-participant-badge muted" title="Muted"><Icon name="micOff" size={14} /></span>}
                      {!videoOn && <span className="room-participant-badge muted" title="Camera off"><Icon name="cameraOff" size={14} /></span>}
                      {handRaised && <span className="room-participant-badge hand" title="Hand raised"><Icon name="hand" size={14} /></span>}
                    </div>
                  </div>
                  {peerList.map((p) => (
                    <div className="room-participant" key={p.peer_id}>
                      <Avatar name={p.name} color={p.color} size="sm" />
                      <div className="room-participant-name">{p.name}</div>
                      <div className="room-participant-badge">
                        {p.audio === false && <span className="room-participant-badge muted" title="Muted"><Icon name="micOff" size={14} /></span>}
                        {p.video === false && <span className="room-participant-badge muted" title="Camera off"><Icon name="cameraOff" size={14} /></span>}
                        {p.hand && <span className="room-participant-badge hand" title="Hand raised"><Icon name="hand" size={14} /></span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {sidebar === 'chat' && (
              <div className="room-chat-composer">
                <input
                  placeholder="Send a message to everyone"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); sendChat() }
                  }}
                />
                <button
                  className="primary chat-send"
                  onClick={sendChat}
                  disabled={!chatDraft.trim()}
                  aria-label="Send"
                >
                  <Icon name="send" size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="room-controls">
        <div className="room-controls-group">
          <button
            className={'round-btn lg' + (audioOn ? '' : ' off')}
            onClick={toggleAudio}
            title={audioOn ? 'Mute' : 'Unmute'}
            aria-label={audioOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            <Icon name={audioOn ? 'mic' : 'micOff'} size={22} />
          </button>
          <button
            className={'round-btn lg' + (videoOn ? '' : ' off')}
            onClick={toggleVideo}
            title={videoOn ? 'Camera off' : 'Camera on'}
            aria-label={videoOn ? 'Turn camera off' : 'Turn camera on'}
          >
            <Icon name={videoOn ? 'camera' : 'cameraOff'} size={22} />
          </button>
          <button
            className={'round-btn lg' + (screenOn ? ' active' : '')}
            onClick={screenOn ? stopScreenShare : startScreenShare}
            title={screenOn ? 'Stop sharing' : 'Share screen'}
            aria-label={screenOn ? 'Stop screen share' : 'Start screen share'}
          >
            <Icon name="screen" size={22} />
          </button>
          <button
            className={'round-btn lg' + (handRaised ? ' active' : '')}
            onClick={toggleHand}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
            aria-label="Raise hand"
          >
            <Icon name="hand" size={22} />
          </button>
          <button
            className="round-btn lg"
            onClick={() => setShowEmoji((v) => !v)}
            title="Send reaction"
            aria-label="Send reaction"
          >
            <Icon name="smile" size={22} />
          </button>
          {showEmoji && (
            <div className="emoji-picker">
              {['👍', '❤️', '😂', '🎉', '👏', '🙏', '🔥', '😮'].map((e) => (
                <button key={e} onClick={() => sendReaction(e)}>{e}</button>
              ))}
            </div>
          )}
        </div>

        <div className="room-controls-group">
          <button
            className={'round-btn lg' + (sidebar === 'chat' ? ' active' : '')}
            onClick={() => setSidebar((s) => (s === 'chat' ? null : 'chat'))}
            title="Open chat"
            aria-label="Toggle chat"
          >
            <Icon name="chat" size={22} />
          </button>
          <button
            className={'round-btn lg' + (sidebar === 'people' ? ' active' : '')}
            onClick={() => setSidebar((s) => (s === 'people' ? null : 'people'))}
            title="Participants"
            aria-label="Toggle participants"
          >
            <Icon name="users" size={22} />
          </button>
        </div>

        <div className="room-controls-group">
          <button
            className="round-btn lg leave"
            onClick={leave}
            title="Leave meeting"
            aria-label="Leave meeting"
          >
            <Icon name="hangup" size={22} />
          </button>
        </div>
      </div>

      <div className="reaction-overlay">
        {reactions.map((r) => (
          <div key={r.id} className="reaction-bubble" style={{ left: `${r.left}%` }}>
            {r.emoji}
          </div>
        ))}
      </div>
    </div>
  )
}

function PeerTile({ peer }) {
  const videoRef = useRef(null)
  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream
    }
  }, [peer.stream])
  const videoOff = peer.video === false
  const audioOff = peer.audio === false
  return (
    <div className={'tile' + (peer.screen ? ' screen' : '')}>
      {!videoOff && peer.stream ? (
        <video ref={videoRef} autoPlay playsInline />
      ) : (
        <div className="tile-placeholder">
          <Avatar name={peer.name || '?'} color={peer.color || '#7c8cff'} size="lg" />
        </div>
      )}
      {peer.hand && (
        <div className="tile-hand" title="Hand raised">
          <Icon name="hand" size={16} />
        </div>
      )}
      <div className="tile-name">
        <span>{peer.name || '...'}{peer.screen ? ' · sharing' : ''}</span>
      </div>
      {audioOff && (
        <div className="tile-muted" title="Muted">
          <Icon name="micOff" size={14} />
        </div>
      )}
    </div>
  )
}
