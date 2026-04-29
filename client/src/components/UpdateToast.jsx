import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import './UpdateToast.css'

const AUTO_DISMISS_MS = 4500

export default function UpdateToast() {
  const [state, setState] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.zoiko?.isElectron) return
    const off = window.zoiko.onUpdaterStatus(({ status, payload }) => {
      setDismissed(false)
      setState({ status, payload })
    })
    return off
  }, [])

  useEffect(() => {
    if (!state) return
    clearTimeout(timerRef.current)
    const { status } = state
    if (status === 'not-available' || status === 'error') {
      timerRef.current = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS)
    }
    return () => clearTimeout(timerRef.current)
  }, [state])

  if (!state || dismissed) return null
  const { status, payload } = state

  const close = () => setDismissed(true)

  let iconName = 'sparkle'
  let tone = ''
  let title = ''
  let sub = null
  let progress = null
  let action = null

  if (status === 'checking') {
    iconName = 'cloudDownload'
    title = 'Checking for updates'
    sub = 'Looking for a newer version of Zoiko sema…'
  } else if (status === 'available') {
    iconName = 'sparkle'
    tone = 'info'
    title = 'Update available'
    sub = `Downloading Zoiko sema ${payload?.version || ''}`.trim() + '…'
  } else if (status === 'progress') {
    iconName = 'bolt'
    tone = 'info'
    title = 'Downloading update'
    sub = payload?.percent != null ? `${payload.percent}% complete` : null
    progress = payload?.percent || 0
  } else if (status === 'downloaded') {
    iconName = 'check'
    tone = 'ready'
    title = 'Update ready'
    sub = `Zoiko sema ${payload?.version || ''} will install on restart.`
    action = (
      <button className="primary sm" onClick={() => window.zoiko?.quitAndInstall()}>
        Restart
      </button>
    )
  } else if (status === 'not-available') {
    iconName = 'check'
    tone = 'ok'
    title = 'You’re up to date'
    sub = 'Running the latest version of Zoiko sema.'
  } else if (status === 'error') {
    iconName = 'shield'
    tone = 'err'
    title = 'Update check failed'
    sub = payload?.message || 'Please try again later.'
  } else {
    return null
  }

  return (
    <div className={`upd-toast ${tone ? 'upd-' + tone : ''}`} role="status" aria-live="polite">
      <div className="upd-toast-icon"><Icon name={iconName} size={16} /></div>
      <div className="upd-toast-body">
        <div className="upd-toast-title">{title}</div>
        {sub && <div className="upd-toast-sub">{sub}</div>}
        {progress != null && (
          <div className="upd-toast-progress">
            <div className="upd-toast-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      {action}
      <button className="upd-toast-close" onClick={close} aria-label="Dismiss">
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}
