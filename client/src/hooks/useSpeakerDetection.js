import { useCallback, useEffect, useRef } from 'react'

/**
 * Active speaker detection via AudioContext analyser.
 * Calls `onSpeaking(peerId, isSpeaking)` when a peer crosses the threshold.
 *
 * Usage:
 *   const { attachStream, detachStream } = useSpeakerDetection(onSpeaking)
 *   attachStream('self', localStream)       // local
 *   attachStream(peerId, remoteStream)      // remote
 */
export default function useSpeakerDetection(onSpeaking, threshold = 0.015) {
  const ctxRef = useRef(null)
  const trackedRef = useRef({}) // peerId -> { source, analyser, rafId, speaking }

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return ctxRef.current
  }, [])

  const attachStream = useCallback(
    (peerId, stream) => {
      if (!stream) return
      // Detach previous if exists
      const prev = trackedRef.current[peerId]
      if (prev) {
        cancelAnimationFrame(prev.rafId)
        try { prev.source.disconnect() } catch {}
      }

      const ctx = getCtx()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      // Don't connect to destination — we don't want to hear ourselves doubled

      const dataArray = new Float32Array(analyser.fftSize)
      let speaking = false
      let silenceFrames = 0

      function poll() {
        analyser.getFloatTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / dataArray.length)
        const nowSpeaking = rms > threshold

        if (nowSpeaking) {
          silenceFrames = 0
          if (!speaking) {
            speaking = true
            onSpeaking(peerId, true)
          }
        } else {
          silenceFrames++
          // Debounce: require ~20 frames of silence (~330ms at 60fps)
          if (speaking && silenceFrames > 20) {
            speaking = false
            onSpeaking(peerId, false)
          }
        }

        trackedRef.current[peerId].rafId = requestAnimationFrame(poll)
      }

      trackedRef.current[peerId] = { source, analyser, rafId: requestAnimationFrame(poll), speaking }
    },
    [getCtx, onSpeaking, threshold]
  )

  const detachStream = useCallback((peerId) => {
    const entry = trackedRef.current[peerId]
    if (entry) {
      cancelAnimationFrame(entry.rafId)
      try { entry.source.disconnect() } catch {}
      delete trackedRef.current[peerId]
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const peerId of Object.keys(trackedRef.current)) {
        const entry = trackedRef.current[peerId]
        cancelAnimationFrame(entry.rafId)
        try { entry.source.disconnect() } catch {}
      }
      trackedRef.current = {}
      if (ctxRef.current) {
        try { ctxRef.current.close() } catch {}
        ctxRef.current = null
      }
    }
  }, [])

  return { attachStream, detachStream }
}
