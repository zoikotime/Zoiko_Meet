import { useEffect, useState } from 'react'
import Icon from './Icon'
import './DesktopStatus.css'

const PLATFORM_LABEL = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
}

export default function DesktopStatus() {
  const [version, setVersion] = useState(null)
  const [status, setStatus] = useState('idle')
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.zoiko?.isElectron) return
    let mounted = true
    window.zoiko.getVersion().then((v) => { if (mounted) setVersion(v) }).catch(() => {})
    const off = window.zoiko.onUpdaterStatus(({ status: s, payload }) => {
      setStatus(s)
      setInfo(payload || null)
      if (s !== 'checking') setBusy(false)
    })
    return () => { mounted = false; if (off) off() }
  }, [])

  if (typeof window === 'undefined' || !window.zoiko?.isElectron) return null

  const platform = PLATFORM_LABEL[window.zoiko.platform] || window.zoiko.platform || ''

  const handleCheck = async () => {
    if (busy) return
    setBusy(true)
    setStatus('checking')
    try {
      const r = await window.zoiko.checkForUpdate()
      if (!r?.ok) {
        setStatus('error')
        setInfo({ message: r?.reason === 'dev' ? 'Updates disabled in dev' : r?.reason || 'Check failed' })
        setBusy(false)
      }
    } catch (e) {
      setStatus('error')
      setInfo({ message: String(e?.message || e) })
      setBusy(false)
    }
  }

  const handleRestart = () => window.zoiko.quitAndInstall()

  const statusLine = (() => {
    switch (status) {
      case 'checking':    return { dot: 'pulse', text: 'Checking for updates…' }
      case 'available':   return { dot: 'info',  text: `Downloading ${info?.version || ''}`.trim() }
      case 'progress':    return { dot: 'info',  text: `Downloading… ${info?.percent || 0}%` }
      case 'downloaded':  return { dot: 'ready', text: `v${info?.version || ''} ready — restart to install` }
      case 'not-available': return { dot: 'ok', text: 'You’re up to date' }
      case 'error':       return { dot: 'err', text: info?.message || 'Update check failed' }
      default:            return null
    }
  })()

  return (
    <div className="desktop-status" role="group" aria-label="Desktop app">
      <div className="ds-head">
        <span className="ds-badge">
          <Icon name="sparkle" size={12} />
          Desktop
        </span>
        {version && <span className="ds-version">v{version}</span>}
        {platform && <span className="ds-sep">·</span>}
        {platform && <span className="ds-platform">{platform}</span>}
      </div>

      {statusLine && (
        <div className={`ds-status ds-${statusLine.dot}`}>
          <span className="ds-dot" />
          <span className="ds-status-text">{statusLine.text}</span>
        </div>
      )}

      <div className="ds-actions">
        {status === 'downloaded' ? (
          <button className="ds-btn ds-btn-primary" onClick={handleRestart}>
            <Icon name="bolt" size={13} />
            Restart to update
          </button>
        ) : (
          <button
            className="ds-btn"
            onClick={handleCheck}
            disabled={busy || status === 'checking' || status === 'progress' || status === 'available'}
          >
            <Icon name="cloudDownload" size={13} />
            {busy || status === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>
    </div>
  )
}
