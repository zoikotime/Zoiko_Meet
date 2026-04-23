import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, getApiBase, getWsBase, uploadFile } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCall } from '../context/CallContext'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import './Chat.css'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏']

// Categorized emoji set for the full picker
const EMOJI_CATEGORIES = [
  {
    key: 'smileys', icon: '😀', label: 'Smileys & People',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','🫠','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😶‍🌫️','😏','😒','🙄','😬','😮‍💨','🤥','🫨','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','😵‍💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾']
  },
  {
    key: 'gestures', icon: '👍', label: 'Gestures & Body',
    emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','💋','👶','🧒','👦','👧','🧑','👱','👨','👩','🧓','👴','👵']
  },
  {
    key: 'hearts', icon: '❤️', label: 'Hearts & Emotions',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💖','💗','💓','💞','💕','💘','💝','💟','♥️','💌','💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️‍🗨️','🗨️','🗯️','💭','💤']
  },
  {
    key: 'animals', icon: '🐶', label: 'Animals & Nature',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔','🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️','🍀','🎍','🎋','🍃','🍂','🍁','🍄','🐚','🪨','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌎','🌍','🌏','🪐','💫','⭐','🌟','✨','⚡','☄️','💥','🔥','🌪️','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','💧','💦','☔','☂️','🌊','🌫️']
  },
  {
    key: 'food', icon: '🍔', label: 'Food & Drink',
    emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥣','🥡','🥢','🧂']
  },
  {
    key: 'activities', icon: '⚽', label: 'Activities & Travel',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🚴','🚵','🎖️','🏅','🥇','🥈','🥉','🏆','🎗️','🎫','🎟️','🎪','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩','🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦯','🦽','🦼','🛴','🚲','🛵','🏍️','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','⛽','🚧','🚦','🚥','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','🕋','⛩️']
  },
  {
    key: 'objects', icon: '💡', label: 'Objects',
    emojis: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳️','🩸','💊','🩹','🩼','🩺','🩻','🚪','🛗','🪞','🪟','🛏️','🛋️','🪑','🚽','🪠','🚿','🛁','🪤','🪒','🧴','🧷','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽','🧯','🛒','🚬','⚰️','🪦','⚱️']
  },
  {
    key: 'symbols', icon: '✅', label: 'Symbols',
    emojis: ['✅','❌','❎','✔️','☑️','✖️','➕','➖','➗','🟰','♾️','‼️','⁉️','❓','❔','❕','❗','〰️','©️','®️','™️','#️⃣','*️⃣','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔠','🔡','🔢','🔣','🔤','🅰️','🆎','🅱️','🆑','🆒','🆓','ℹ️','🆔','Ⓜ️','🆕','🆖','🅾️','🆗','🅿️','🆘','🆙','🆚','🈁','🈂️','🈷️','🈶','🈯','🉐','🈹','🈚','🈲','🉑','🈸','🈴','🈳','㊗️','㊙️','🈺','🈵','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔳','🔲','⬛','⬜','🟥','🟧','🟨','🟩','🟦','🟪','🟫','▪️','▫️','◾','◽','◼️','◻️','🚫','⭕','🛑','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❓','❕','❔']
  },
  {
    key: 'flags', icon: '🏁', label: 'Flags',
    emojis: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇮🇳','🇯🇵','🇰🇷','🇨🇳','🇩🇪','🇫🇷','🇮🇹','🇪🇸','🇵🇹','🇳🇱','🇧🇪','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇮🇪','🇵🇱','🇨🇭','🇦🇹','🇬🇷','🇹🇷','🇷🇺','🇺🇦','🇧🇷','🇲🇽','🇦🇷','🇨🇱','🇨🇴','🇵🇪','🇿🇦','🇪🇬','🇳🇬','🇰🇪','🇦🇪','🇸🇦','🇮🇱','🇸🇬','🇲🇾','🇮🇩','🇹🇭','🇵🇭','🇻🇳','🇳🇿','🇵🇰','🇧🇩','🇱🇰','🇳🇵']
  },
]

function formatTime(iso) {
  try {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function dayLabel(iso) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    if (d.toDateString() === now.toDateString()) return 'Today'
    if (d.toDateString() === yest.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  } catch {
    return ''
  }
}

function channelDisplay(channel, currentUserId) {
  if (channel.is_direct) {
    const other = channel.members.find((m) => m.id !== currentUserId)
    return { name: other?.name || channel.name, color: other?.avatar_color || '#5b8def' }
  }
  return { name: channel.name, color: '#7c8cff' }
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageType(type) {
  return type && type.startsWith('image/')
}

function groupMessages(messages) {
  const groups = []
  let currentDay = null
  let currentCluster = null
  for (const m of messages) {
    const day = new Date(m.created_at).toDateString()
    if (day !== currentDay) {
      currentDay = day
      groups.push({ type: 'divider', id: `d-${day}`, date: m.created_at })
      currentCluster = null
    }
    const lastCluster = currentCluster
    const sameAuthor = lastCluster && lastCluster.sender_id === m.sender_id
    const closeInTime =
      lastCluster &&
      new Date(m.created_at) - new Date(lastCluster.messages[lastCluster.messages.length - 1].created_at) < 3 * 60 * 1000
    if (sameAuthor && closeInTime) {
      lastCluster.messages.push(m)
    } else {
      const cluster = {
        type: 'cluster',
        id: `c-${m.id}`,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        sender_color: m.sender_color,
        messages: [m],
      }
      groups.push(cluster)
      currentCluster = cluster
    }
  }
  return groups
}

export default function Chat() {
  const { channelId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { startCall } = useCall()

  const [channels, setChannels] = useState([])
  const [messages, setMessages] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [draft, setDraft] = useState('')
  const [typingUsers, setTypingUsers] = useState({})
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [emojiPicker, setEmojiPicker] = useState(null) // message id
  const [readReceipts, setReadReceipts] = useState({}) // { oderId: lastReadMsgId }
  const [uploading, setUploading] = useState(false)
  const [showComposerEmoji, setShowComposerEmoji] = useState(false)
  const [emojiTab, setEmojiTab] = useState('smileys')
  const [isRecording, setIsRecording] = useState(false)
  const [recTime, setRecTime] = useState(0)
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)
  const composerRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recTimerRef = useRef(null)
  const recStreamRef = useRef(null)
  const cancelRecRef = useRef(false)

  const loadChannels = useCallback(async () => {
    const list = await api('/api/channels')
    setChannels(list)
    return list
  }, [])

  useEffect(() => {
    loadChannels().catch(() => {})
  }, [loadChannels])

  useEffect(() => {
    if (!channelId) {
      setActiveChannel(null)
      setMessages([])
      return
    }
    const ch = channels.find((c) => String(c.id) === String(channelId))
    if (ch) setActiveChannel(ch)
  }, [channelId, channels])

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    api(`/api/channels/${channelId}/messages`)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs)
      })
      .catch(() => {})
    // Load read receipts
    api(`/api/channels/${channelId}/read-receipts`)
      .then((receipts) => {
        if (!cancelled) {
          const map = {}
          for (const r of receipts) map[r.user_id] = r.last_read_message_id
          setReadReceipts(map)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [channelId])

  // WebSocket connection
  useEffect(() => {
    if (!channelId) return
    if (wsRef.current) {
      try { wsRef.current.close() } catch {}
    }
    const token = localStorage.getItem('zoiko_token')
    const ws = new WebSocket(`${getWsBase()}/ws/channels/${channelId}?token=${encodeURIComponent(token)}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'message') {
          setMessages((prev) =>
            prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
          )
          setChannels((prev) =>
            prev.map((c) =>
              c.id === data.message.channel_id
                ? { ...c, last_message_preview: data.message.body.slice(0, 120), last_message_at: data.message.created_at }
                : c
            )
          )
        } else if (data.type === 'typing') {
          setTypingUsers((prev) => ({ ...prev, [data.user_id]: { name: data.name, at: Date.now() } }))
        } else if (data.type === 'reaction') {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== data.message_id) return m
              let reactions = [...(m.reactions || [])]
              if (data.action === 'added') {
                reactions.push({ emoji: data.emoji, user_id: data.user_id, user_name: data.user_name })
              } else {
                reactions = reactions.filter(
                  (r) => !(r.emoji === data.emoji && r.user_id === data.user_id)
                )
              }
              return { ...m, reactions }
            })
          )
        } else if (data.type === 'message_deleted') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.message_id ? { ...m, deleted_at: new Date().toISOString() } : m
            )
          )
        } else if (data.type === 'read_receipt') {
          setReadReceipts((prev) => ({ ...prev, [data.user_id]: data.last_read_message_id }))
        }
      } catch {}
    }
    return () => {
      try { ws.close() } catch {}
    }
  }, [channelId])

  // Mark as read when messages change
  useEffect(() => {
    if (!messages.length || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg && lastMsg.sender_id !== user?.id) {
      wsRef.current.send(JSON.stringify({ type: 'read', last_read_message_id: lastMsg.id }))
    }
  }, [messages, user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now()
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          if (now - next[k].at > 3500) delete next[k]
        }
        return next
      })
    }, 1500)
    return () => clearInterval(t)
  }, [])

  // Auto-grow composer
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [draft])

  const sendMessage = () => {
    const body = draft.trim()
    if (!body || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const payload = { type: 'message', body }
    if (replyTo) payload.reply_to_id = replyTo.id
    wsRef.current.send(JSON.stringify(payload))
    setDraft('')
    setReplyTo(null)
  }

  const onComposerKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    } else if (e.key === 'Escape' && replyTo) {
      setReplyTo(null)
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }))
    }
  }

  const toggleReaction = (messageId, emoji) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'reaction', message_id: messageId, emoji }))
    setEmojiPicker(null)
  }

  const deleteMessage = (messageId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'delete', message_id: messageId }))
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !channelId) return
    setUploading(true)
    try {
      const msg = await uploadFile(`/api/channels/${channelId}/upload`, file)
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    } catch (err) {
      alert(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const insertEmoji = (emoji) => {
    const el = composerRef.current
    if (!el) { setDraft((d) => d + emoji); return }
    const start = el.selectionStart ?? draft.length
    const end = el.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      try { el.setSelectionRange(pos, pos) } catch {}
    })
  }

  const uploadVoiceBlob = async (blob) => {
    if (!channelId) return
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = new File([blob], `voice-${stamp}.webm`, { type: 'audio/webm' })
    setUploading(true)
    try {
      const msg = await uploadFile(`/api/channels/${channelId}/upload`, file)
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    } catch (err) {
      alert(err.message || 'Voice upload failed')
    } finally {
      setUploading(false)
    }
  }

  const startVoiceRecording = async () => {
    if (isRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recStreamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '')
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recordedChunksRef.current = []
      cancelRecRef.current = false
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const chunks = recordedChunksRef.current
        recordedChunksRef.current = []
        recStreamRef.current?.getTracks().forEach((t) => t.stop())
        recStreamRef.current = null
        if (!cancelRecRef.current && chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
          uploadVoiceBlob(blob)
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecTime(0)
      recTimerRef.current = setInterval(() => setRecTime((t) => t + 1), 1000)
    } catch {
      alert('Microphone permission denied or unavailable.')
    }
  }

  const stopVoiceRecording = (cancel = false) => {
    cancelRecRef.current = cancel
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== 'inactive') { try { rec.stop() } catch {} }
    mediaRecorderRef.current = null
    setIsRecording(false)
    setRecTime(0)
  }

  useEffect(() => () => stopVoiceRecording(true), [])
  useEffect(() => { setShowComposerEmoji(false); stopVoiceRecording(true) }, [channelId])

  const formatRecTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const typingText = useMemo(() => {
    const names = Object.values(typingUsers).map((t) => t.name)
    if (!names.length) return ''
    if (names.length === 1) return `${names[0]} is typing…`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
    return 'Several people are typing…'
  }, [typingUsers])

  const filteredChannels = useMemo(() => {
    if (!search.trim()) return channels
    const q = search.trim().toLowerCase()
    return channels.filter((c) => {
      const display = channelDisplay(c, user.id)
      return (
        display.name.toLowerCase().includes(q) ||
        (c.last_message_preview || '').toLowerCase().includes(q)
      )
    })
  }, [channels, search, user.id])

  const grouped = useMemo(() => groupMessages(messages), [messages])

  // Compute which users have read up to which point
  const readByPerMessage = useMemo(() => {
    const map = {}
    if (!activeChannel) return map
    for (const [uid, lastReadId] of Object.entries(readReceipts)) {
      const userId = Number(uid)
      if (userId === user?.id) continue
      const member = activeChannel.members?.find((m) => m.id === userId)
      if (!member) continue
      if (!map[lastReadId]) map[lastReadId] = []
      map[lastReadId].push(member.name)
    }
    return map
  }, [readReceipts, activeChannel, user?.id])

  return (
    <div className="chat">
      <aside className="chat-list">
        <div className="chat-list-header">
          <div className="chat-list-title">Chat</div>
          <button className="primary sm chat-new-btn" onClick={() => setShowNew(true)} aria-label="New conversation">
            <Icon name="plus" size={14} /> New
          </button>
        </div>

        <div className="chat-search">
          <Icon name="search" size={14} className="chat-search-icon" />
          <input placeholder="Search conversations…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="chat-list-items">
          {channels.length === 0 && (
            <div className="chat-list-empty">
              <div className="chat-list-empty-icon"><Icon name="chat" size={28} /></div>
              <div className="chat-list-empty-title">No conversations yet</div>
              <div className="chat-list-empty-sub">Click <strong>+ New</strong> to start one.</div>
            </div>
          )}
          {filteredChannels.map((c) => {
            const display = channelDisplay(c, user.id)
            const active = String(c.id) === String(channelId)
            return (
              <button key={c.id} className={'chat-list-item' + (active ? ' active' : '')} onClick={() => navigate(`/chat/${c.id}`)}>
                <div className="chat-list-item-avatar">
                  <Avatar name={display.name} color={display.color} />
                  {c.is_direct && <span className="presence-dot" />}
                </div>
                <div className="chat-list-item-main">
                  <div className="chat-list-item-top">
                    <span className="chat-list-item-name">{display.name}</span>
                    <div className="chat-list-item-meta">
                      {c.unread_count > 0 && <span className="chat-unread-badge">{c.unread_count}</span>}
                      {c.last_message_at && <span className="chat-list-item-time">{formatTime(c.last_message_at)}</span>}
                    </div>
                  </div>
                  <div className="chat-list-item-preview">
                    {c.last_message_preview || (c.is_direct ? 'Start a conversation' : 'No messages yet')}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="chat-thread">
        {!activeChannel ? (
          <div className="chat-thread-empty">
            <div className="chat-thread-empty-card">
              <div className="chat-thread-empty-icon"><Icon name="chat" size={32} /></div>
              <h2>Start a conversation</h2>
              <p>Select someone from the list or create a new channel to begin chatting.</p>
              <button className="primary" onClick={() => setShowNew(true)}>
                <Icon name="plus" size={14} /> New conversation
              </button>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const display = channelDisplay(activeChannel, user.id)
              const otherMember = activeChannel.is_direct
                ? activeChannel.members.find((m) => m.id !== user.id)
                : null
              return (
                <header className="chat-thread-header">
                  <div className="chat-thread-header-avatar">
                    <Avatar name={display.name} color={display.color} />
                    {activeChannel.is_direct && <span className="presence-dot" />}
                  </div>
                  <div className="chat-thread-header-main">
                    <div className="chat-thread-header-name">{display.name}</div>
                    <div className="chat-thread-header-sub">
                      {activeChannel.is_direct ? (
                        <><span className="dot-online" /> Active now</>
                      ) : (
                        <><Icon name="users" size={12} /> {activeChannel.members.length} members</>
                      )}
                    </div>
                  </div>
                  {otherMember && (
                    <div className="chat-thread-header-actions">
                      <button
                        type="button"
                        className="chat-call-btn"
                        title="Audio call"
                        aria-label="Start audio call"
                        onClick={() => startCall(otherMember, 'audio')}
                      >
                        <Icon name="phone" size={18} />
                      </button>
                      <button
                        type="button"
                        className="chat-call-btn"
                        title="Video call"
                        aria-label="Start video call"
                        onClick={() => startCall(otherMember, 'video')}
                      >
                        <Icon name="video" size={18} />
                      </button>
                    </div>
                  )}
                </header>
              )
            })()}

            <div className="chat-messages" onClick={() => setEmojiPicker(null)}>
              {grouped.map((g) =>
                g.type === 'divider' ? (
                  <div key={g.id} className="chat-day-divider"><span>{dayLabel(g.date)}</span></div>
                ) : (
                  <div key={g.id} className={'chat-cluster' + (g.sender_id === user.id ? ' mine' : '')}>
                    <Avatar name={g.sender_name} color={g.sender_color} size="sm" />
                    <div className="chat-cluster-body">
                      <div className="chat-cluster-meta">
                        <span className="chat-cluster-name">{g.sender_name}</span>
                        <span className="chat-cluster-time">{formatTime(g.messages[0].created_at)}</span>
                      </div>
                      <div className="chat-cluster-msgs">
                        {g.messages.map((m) => (
                          <MessageBubble
                            key={m.id}
                            msg={m}
                            isMine={m.sender_id === user.id}
                            isChannelCreator={activeChannel.members?.find(mem => mem.id === user.id) && activeChannel.created_by === user?.id}
                            onReply={() => { setReplyTo(m); composerRef.current?.focus() }}
                            onReact={(emoji) => toggleReaction(m.id, emoji)}
                            onDelete={() => deleteMessage(m.id)}
                            emojiPickerOpen={emojiPicker === m.id}
                            onToggleEmojiPicker={(e) => { e.stopPropagation(); setEmojiPicker(emojiPicker === m.id ? null : m.id) }}
                            readBy={readByPerMessage[m.id]}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={'chat-typing' + (typingText ? ' active' : '')}>
              {typingText && (
                <>
                  <span className="typing-dots"><span /><span /><span /></span>
                  <span>{typingText}</span>
                </>
              )}
            </div>

            {replyTo && (
              <div className="chat-reply-bar">
                <Icon name="reply" size={14} />
                <span className="chat-reply-bar-text">
                  Replying to <strong>{replyTo.sender_name}</strong>: {replyTo.body?.slice(0, 80)}
                </span>
                <button className="ghost chat-reply-bar-close" onClick={() => setReplyTo(null)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}

            <div className="chat-composer">
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.json,.md,.webm,.mp3,.wav,.m4a,.ogg"
                onChange={handleFileUpload}
              />
              <button
                className="ghost chat-composer-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || isRecording}
                title="Attach file"
              >
                {uploading ? <div className="spinner-sm" /> : <Icon name="attach" size={18} />}
              </button>
              <button
                className="ghost chat-composer-btn"
                onClick={() => setShowComposerEmoji((v) => !v)}
                disabled={isRecording}
                title="Emoji"
                aria-label="Emoji"
              >
                <Icon name="smile" size={18} />
              </button>
              <textarea
                ref={composerRef}
                placeholder="Type a message. Enter to send, Shift+Enter for new line."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKey}
                rows={1}
                disabled={isRecording}
              />
              <button
                className={'chat-voice-btn' + (isRecording ? ' recording' : '')}
                onClick={isRecording ? () => stopVoiceRecording(false) : startVoiceRecording}
                title={isRecording ? 'Send voice note' : 'Record voice note'}
                aria-label={isRecording ? 'Send voice note' : 'Record voice note'}
              >
                <Icon name={isRecording ? 'send' : 'mic'} size={18} />
              </button>
              <button className="primary chat-send" onClick={sendMessage} disabled={!draft.trim() || isRecording} aria-label="Send">
                <Icon name="send" size={16} />
              </button>

              {isRecording && (
                <div className="voice-recording-bar">
                  <span className="rec-pulse" />
                  <span className="rec-time">{formatRecTime(recTime)}</span>
                  <span className="rec-bars" aria-hidden="true">
                    {Array.from({ length: 28 }).map((_, i) => <span key={i} />)}
                  </span>
                  <button className="rec-cancel" onClick={() => stopVoiceRecording(true)}>Cancel</button>
                  <button className="rec-send" onClick={() => stopVoiceRecording(false)}>Send</button>
                </div>
              )}

              {showComposerEmoji && (
                <ComposerEmojiPicker
                  activeTab={emojiTab}
                  onTabChange={setEmojiTab}
                  onPick={(e) => insertEmoji(e)}
                  onClose={() => setShowComposerEmoji(false)}
                />
              )}
            </div>
          </>
        )}
      </section>

      {showNew && (
        <NewChannelModal
          onClose={() => setShowNew(false)}
          onCreated={async (ch) => {
            setShowNew(false)
            await loadChannels()
            navigate(`/chat/${ch.id}`)
          }}
        />
      )}
    </div>
  )
}

// ── Message Bubble ──────────────────────────────────────────────────────

function MessageBubble({ msg, isMine, isChannelCreator, onReply, onReact, onDelete, emojiPickerOpen, onToggleEmojiPicker, readBy }) {
  const reactionGroups = useMemo(() => {
    const groups = {}
    for (const r of (msg.reactions || [])) {
      if (!groups[r.emoji]) groups[r.emoji] = []
      groups[r.emoji].push(r)
    }
    return groups
  }, [msg.reactions])

  if (msg.deleted_at) {
    return (
      <div className="chat-bubble deleted">
        <Icon name="trash" size={13} />
        <em>This message was deleted</em>
      </div>
    )
  }

  const hasFile = !!msg.file_url
  const isImage = hasFile && isImageType(msg.file_type)
  const isAudio = hasFile && ((msg.file_type || '').startsWith('audio/') || /\.(webm|mp3|wav|ogg|m4a)$/i.test(msg.file_name || ''))

  return (
    <div className="chat-bubble-wrap">
      {msg.reply_to_id && msg.reply_preview && (
        <div className="chat-reply-ref">
          <Icon name="reply" size={12} />
          <span>{msg.reply_preview}</span>
        </div>
      )}

      <div className={'chat-bubble' + (hasFile && !msg.body?.trim() ? ' file-only' : '')}>
        {hasFile && isImage && (
          <a href={`${getApiBase()}${msg.file_url}`} target="_blank" rel="noopener noreferrer" className="chat-file-image">
            <img src={`${getApiBase()}${msg.file_url}`} alt={msg.file_name} />
          </a>
        )}
        {hasFile && isAudio && (
          <div className="chat-voice-note">
            <Icon name="mic" size={16} />
            <audio controls preload="metadata" src={`${getApiBase()}${msg.file_url}`} />
          </div>
        )}
        {hasFile && !isImage && !isAudio && (
          <a href={`${getApiBase()}${msg.file_url}`} target="_blank" rel="noopener noreferrer" className="chat-file-attach">
            <Icon name="file" size={18} />
            <div className="chat-file-info">
              <span className="chat-file-name">{msg.file_name}</span>
              <span className="chat-file-size">{formatFileSize(msg.file_size)}</span>
            </div>
            <Icon name="download" size={16} className="chat-file-dl" />
          </a>
        )}
        {(!hasFile || (msg.body && msg.body !== msg.file_name)) && <span>{msg.body}</span>}

        {/* Hover actions */}
        <div className="chat-bubble-actions">
          <button title="React" onClick={onToggleEmojiPicker}><Icon name="emoji" size={14} /></button>
          <button title="Reply" onClick={onReply}><Icon name="reply" size={14} /></button>
          {(isMine || isChannelCreator) && (
            <button title="Delete" onClick={onDelete}><Icon name="trash" size={14} /></button>
          )}
        </div>
      </div>

      {/* Emoji picker */}
      {emojiPickerOpen && (
        <div className="chat-emoji-picker" onClick={(e) => e.stopPropagation()}>
          {QUICK_EMOJIS.map((em) => (
            <button key={em} className="chat-emoji-btn" onClick={() => onReact(em)}>{em}</button>
          ))}
        </div>
      )}

      {/* Reactions display */}
      {Object.keys(reactionGroups).length > 0 && (
        <div className="chat-reactions">
          {Object.entries(reactionGroups).map(([emoji, users]) => (
            <button
              key={emoji}
              className="chat-reaction-chip"
              onClick={() => onReact(emoji)}
              title={users.map((u) => u.user_name).join(', ')}
            >
              <span>{emoji}</span>
              <span className="chat-reaction-count">{users.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Read receipts */}
      {readBy && readBy.length > 0 && (
        <div className="chat-read-by" title={readBy.join(', ')}>
          <Icon name="check" size={11} />
          <span>Read by {readBy.length <= 2 ? readBy.join(', ') : `${readBy.length} people`}</span>
        </div>
      )}
    </div>
  )
}

// ── Composer emoji picker (full) ───────────────────────────────────────
function ComposerEmojiPicker({ activeTab, onTabChange, onPick, onClose }) {
  const rootRef = useRef(null)
  useEffect(() => {
    const onDown = (e) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const active = EMOJI_CATEGORIES.find((c) => c.key === activeTab) || EMOJI_CATEGORIES[0]
  return (
    <div ref={rootRef} className="composer-emoji-popover" role="dialog" aria-label="Emoji picker">
      <div className="emoji-tabs">
        {EMOJI_CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={'emoji-tab' + (c.key === active.key ? ' active' : '')}
            onClick={() => onTabChange(c.key)}
            title={c.label}
            aria-label={c.label}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="emoji-grid">
        <div className="emoji-grid-title">{active.label}</div>
        {active.emojis.map((em, i) => (
          <button key={`${active.key}-${i}`} className="emoji-item" onClick={() => onPick(em)}>
            {em}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── New Channel Modal ───────────────────────────────────────────────────

function NewChannelModal({ onClose, onCreated }) {
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`/api/users${query ? `?q=${encodeURIComponent(query)}` : ''}`).then(setUsers).catch(() => {})
  }, [query])

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const create = async () => {
    const ids = Array.from(selected)
    if (!ids.length) {
      setErr('Pick at least one person.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const isDirect = ids.length === 1
      const selectedUsers = users.filter((u) => ids.includes(u.id))
      const fallbackName = selectedUsers.map((u) => u.name).join(', ')
      const ch = await api('/api/channels', {
        method: 'POST',
        body: {
          name: name.trim() || fallbackName || 'New channel',
          member_ids: ids,
          is_direct: isDirect,
        },
      })
      onCreated(ch)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="new-channel-modal" onClick={onClose}>
      <div className="new-channel-card" onClick={(e) => e.stopPropagation()}>
        <div className="new-channel-head">
          <h3>Start a conversation</h3>
          <button className="ghost new-channel-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        {err && (
          <div className="auth-error">
            <Icon name="close" size={14} /> {err}
          </div>
        )}
        <div className="chat-search">
          <Icon name="search" size={14} className="chat-search-icon" />
          <input placeholder="Search people by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="new-channel-users">
          {users.length === 0 && (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No users found.</div>
          )}
          {users.map((u) => (
            <button key={u.id} className={'new-channel-user' + (selected.has(u.id) ? ' selected' : '')} onClick={() => toggle(u.id)}>
              <Avatar name={u.name} color={u.avatar_color} size="sm" />
              <div className="new-channel-user-name">
                {u.name}
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
              </div>
              {selected.has(u.id) && (
                <span className="new-channel-user-check"><Icon name="check" size={14} /></span>
              )}
            </button>
          ))}
        </div>
        {selected.size > 1 && (
          <input placeholder="Group name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <div className="new-channel-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={create} disabled={busy || selected.size === 0}>
            {busy ? 'Creating…' : `Create${selected.size ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
