import Icon from './Icon'
import Avatar from './Avatar'
import { useCall } from '../context/CallContext'
import './CallOverlay.css'

export default function CallOverlay() {
  const { incoming, outgoing, acceptIncoming, declineIncoming, cancelOutgoing } = useCall()

  if (incoming) {
    const kindLabel = incoming.kind === 'audio' ? 'audio call' : 'video call'
    return (
      <div className="call-overlay">
        <div className="call-card incoming">
          <div className="call-ringing-label">Incoming {kindLabel}</div>
          <div className="call-avatar-wrap">
            <span className="call-ring-pulse" />
            <Avatar name={incoming.caller.name} color={incoming.caller.avatar_color} size="xl" />
          </div>
          <div className="call-name">{incoming.caller.name}</div>
          <div className="call-actions">
            <button className="call-btn decline" onClick={declineIncoming} title="Decline" aria-label="Decline">
              <Icon name="phoneOff" size={22} />
            </button>
            <button className="call-btn accept" onClick={acceptIncoming} title="Accept" aria-label="Accept">
              <Icon name={incoming.kind === 'audio' ? 'phone' : 'video'} size={22} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (outgoing) {
    const kindLabel = outgoing.kind === 'audio' ? 'audio call' : 'video call'
    return (
      <div className="call-overlay">
        <div className="call-card outgoing">
          <div className="call-ringing-label">
            {outgoing.declined ? 'Call declined' : `Calling… · ${kindLabel}`}
          </div>
          <div className="call-avatar-wrap">
            {!outgoing.declined && <span className="call-ring-pulse" />}
            <Avatar name={outgoing.callee.name} color={outgoing.callee.avatar_color} size="xl" />
          </div>
          <div className="call-name">{outgoing.callee.name}</div>
          <div className="call-actions">
            <button className="call-btn decline" onClick={cancelOutgoing} title={outgoing.declined ? 'Close' : 'Cancel'}>
              <Icon name="phoneOff" size={22} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
