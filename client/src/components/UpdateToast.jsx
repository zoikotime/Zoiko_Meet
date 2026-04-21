import { useEffect, useState } from 'react'
import Icon from './Icon'
import './UpdateToast.css'

export default function UpdateToast() {
  const [state, setState] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.zoiko?.isElectron) return
    const off = window.zoiko.onUpdaterStatus(({ status, payload }) => {
      setState({ status, payload })
    })
    return off
  }, [])

  if (!state) return null
  const { status, payload } = state

  // Only surface meaningful states — stay quiet for 'checking' / 'not-available'
  if (status === 'available') {
    return (
      <div className="upd-toast">
        <div className="upd-toast-icon"><Icon name="sparkle" size={16} /></div>
        <div className="upd-toast-body">
          <div className="upd-toast-title">Update available</div>
          <div className="upd-toast-sub">Downloading Zoiko connect {payload?.version}…</div>
        </div>
      </div>
    )
  }
  if (status === 'progress') {
    return (
      <div className="upd-toast">
        <div className="upd-toast-icon"><Icon name="bolt" size={16} /></div>
        <div className="upd-toast-body">
          <div className="upd-toast-title">Downloading update</div>
          <div className="upd-toast-progress">
            <div className="upd-toast-progress-bar" style={{ width: `${payload?.percent || 0}%` }} />
          </div>
        </div>
      </div>
    )
  }
  if (status === 'downloaded') {
    return (
      <div className="upd-toast">
        <div className="upd-toast-icon"><Icon name="check" size={16} /></div>
        <div className="upd-toast-body">
          <div className="upd-toast-title">Update ready</div>
          <div className="upd-toast-sub">Zoiko connect {payload?.version} will install on restart.</div>
        </div>
        <button className="primary sm" onClick={() => window.zoiko?.quitAndInstall()}>
          Restart
        </button>
      </div>
    )
  }
  return null
}
