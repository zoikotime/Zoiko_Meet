const PATHS = {
  home: (
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />
  ),
  chat: (
    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 4V6a1 1 0 0 1 1-1Z" />
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3v-4Z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </>
  ),
  micOff: (
    <>
      <path d="M9 9v2a3 3 0 0 0 5.12 2.12M15 13V6a3 3 0 0 0-5.66-1.4" />
      <path d="M5 11a7 7 0 0 0 11.27 5.54M19 11a7 7 0 0 1-1.38 4.18" />
      <path d="M12 18v3M8 21h8M3 3l18 18" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3v-4Z" />
    </>
  ),
  cameraOff: (
    <>
      <path d="M16 16H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l2-2h4m3 4h1a2 2 0 0 1 2 2v6" />
      <path d="m21 7-5 3v4l5 3" />
      <path d="M3 3l18 18" />
    </>
  ),
  screen: (
    <>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4M9 11l3-3 3 3M12 8v5" />
    </>
  ),
  hand: (
    <path d="M7 11V5a2 2 0 0 1 4 0v6M11 11V4a2 2 0 0 1 4 0v7M15 11V6a2 2 0 0 1 4 0v10a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-1l-2-3a2 2 0 0 1 3-2l2 2" />
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M16 3.1A4 4 0 0 1 16 11M22 21a7 7 0 0 0-4.5-6.5" />
    </>
  ),
  hangup: (
    <path d="M3 11a14 14 0 0 1 18 0v2a2 2 0 0 1-1.3 1.9l-2.4.8a2 2 0 0 1-2.3-.9l-1-2a12 12 0 0 0-5 0l-1 2a2 2 0 0 1-2.3.9l-2.4-.8A2 2 0 0 1 3 13v-2Z" />
  ),
  send: (
    <path d="M4 4 22 12 4 20l3-8-3-8Zm3 8h10" />
  ),
  plus: (
    <path d="M12 5v14M5 12h14" />
  ),
  close: (
    <path d="M6 6l12 12M18 6 6 18" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h12M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
    </>
  ),
  arrowLeft: (
    <path d="M19 12H5M12 5l-7 7 7 7" />
  ),
  link: (
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  check: (
    <path d="m5 12 5 5L20 7" />
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
  sparkle: (
    <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" />
  ),
  shield: (
    <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  spotlight: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  bolt: (
    <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  blur: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5v-.5M12 19.5V19M5 12h-.5M19.5 12H19M7.05 7.05l-.35-.35M17.3 17.3l-.35-.35M7.05 16.95l-.35.35M17.3 6.7l-.35.35" />
      <circle cx="12" cy="12" r="7" opacity="0.3" />
    </>
  ),
  noise: (
    <path d="M2 12h2l2-4 2 8 2-6 2 4 2-2 2 6 2-8 2 4h2" />
  ),
  switchCamera: (
    <>
      <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2 3h6a2 2 0 0 1 2 2v1" />
      <path d="M18 22l3-3-3-3" />
      <path d="M21 19H14" />
      <circle cx="10" cy="13" r="2" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 9v12" />
    </>
  ),
  speakerView: (
    <>
      <rect x="2" y="3" width="20" height="12" rx="2" />
      <rect x="2" y="17" width="5" height="4" rx="1" />
      <rect x="9.5" y="17" width="5" height="4" rx="1" />
      <rect x="17" y="17" width="5" height="4" rx="1" />
    </>
  ),
  gridView: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  waveform: (
    <>
      <path d="M2 12h2M6 8v8M10 5v14M14 8v8M18 6v12M22 12h0" />
    </>
  ),
  chevronDown: (
    <path d="M6 9l6 6 6-6" />
  ),
  emoji: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
  attach: (
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  reply: (
    <path d="M9 17H4v-5M21 7a9 9 0 0 0-9-3 9 9 0 0 0-5.5 3.5L4 12" />
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </>
  ),
  whiteboard: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M7 8l3 5 4-3 3 4" />
    </>
  ),
  pen: (
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
  ),
  eraser: (
    <>
      <path d="M7 21h10" />
      <path d="M5.5 12.5 16 2l6 6-10.5 10.5a2 2 0 0 1-1.4.6H6.4a2 2 0 0 1-1.4-.6l-2-2a2 2 0 0 1 0-2.8l2.5-1.2Z" />
    </>
  ),
  square: (
    <rect x="4" y="4" width="16" height="16" rx="1" />
  ),
  circle: (
    <circle cx="12" cy="12" r="9" />
  ),
  minus: (
    <path d="M5 12h14" />
  ),
  type: (
    <>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6M12 4v16" />
    </>
  ),
  undo: (
    <>
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 0 1 15.4-5.4L21 10" />
    </>
  ),
  redo: (
    <>
      <path d="M21 7v6h-6" />
      <path d="M21 13a9 9 0 0 0-15.4-5.4L3 10" />
    </>
  ),
  pointer: (
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3Z" />
  ),
  palette: (
    <>
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12" r="0.5" fill="currentColor" />
      <path d="M12 2a10 10 0 0 0-1 19.8 1.4 1.4 0 0 0 1.6-1.4c0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 10 10 10 0 0 0 12 2Z" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </>
  ),
  present: (
    <>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M12 18v4M8 22h8" />
      <path d="M8 10l4-4 4 4" />
      <path d="M12 6v8" />
    </>
  ),
  record: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </>
  ),
  recordStop: (
    <>
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </>
  ),
  cloudDownload: (
    <>
      <path d="M4 14.9A5 5 0 0 1 7 5a8 8 0 0 1 14 4h1a3 3 0 0 1 0 6h-2" />
      <path d="M12 13v8M8 17l4 4 4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  bellDot: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <circle cx="18" cy="4" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </>
  ),
  trendUp: (
    <>
      <path d="M22 7l-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  userPlus: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3H10l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </>
  ),
  calendarPlus: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M12 14v4M10 16h4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </>
  ),
  robot: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="3" />
      <path d="M12 2v6M9 13h.01M15 13h.01M10 17h4" />
      <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  zap: (
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z" />
  ),
  activity: (
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  ),
  userCog: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21a7 7 0 0 1 11-5.7" />
      <circle cx="19" cy="18" r="2" />
      <path d="M19 14v1M19 21v1M22.5 16.5l-.9.5M15.6 20l-.9.5M22.5 19.5l-.9-.5M15.6 16l-.9-.5" />
    </>
  ),
}

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.8, style, ...rest }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      {...rest}
    >
      {d}
    </svg>
  )
}
