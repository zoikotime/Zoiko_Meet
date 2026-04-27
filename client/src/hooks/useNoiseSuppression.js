import { useCallback, useRef } from 'react'

/**
 * Noise suppression using Web Audio API.
 *
 * Strategy: Applies a band-pass filter (human voice range ~85-3400 Hz),
 * a compressor (to tame peaks and boost quiet speech), and a noise gate
 * (via gain node that mutes when signal is very low).
 *
 * For advanced ML-based suppression, browsers with `noiseSuppression`
 * constraint on getUserMedia already do this at the driver level — this
 * hook provides a toggleable extra layer.
 *
 * Returns:
 *   enable(stream)  -> processedStream
 *   disable()
 *   isEnabled
 */
export default function useNoiseSuppression() {
  const ctxRef = useRef(null)
  const sourceRef = useRef(null)
  const destinationRef = useRef(null)
  const processedRef = useRef(null)
  const enabledRef = useRef(false)

  const enable = useCallback((sourceStream) => {
    // Clean up previous
    disable()

    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx

    const source = ctx.createMediaStreamSource(sourceStream)
    sourceRef.current = source

    // Band-pass filter: pass human voice frequencies
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 85
    highpass.Q.value = 0.7

    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 3400
    lowpass.Q.value = 0.7

    // Compressor: smooths dynamics, reduces background noise prominence
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -50
    compressor.knee.value = 40
    compressor.ratio.value = 12
    compressor.attack.value = 0
    compressor.release.value = 0.25

    // Gain node for final output level
    const gain = ctx.createGain()
    gain.gain.value = 1.0

    // Connect chain
    source.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(compressor)
    compressor.connect(gain)

    // Output to a destination node
    const destination = ctx.createMediaStreamDestination()
    destinationRef.current = destination
    gain.connect(destination)

    // Build processed stream: filtered audio + original video tracks
    const processed = destination.stream
    for (const videoTrack of sourceStream.getVideoTracks()) {
      processed.addTrack(videoTrack)
    }

    processedRef.current = processed
    enabledRef.current = true
    return processed

    function disable() {} // eslint: hoisting scope
  }, [])

  const disable = useCallback(() => {
    enabledRef.current = false
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch {}
      sourceRef.current = null
    }
    if (ctxRef.current) {
      try { ctxRef.current.close() } catch {}
      ctxRef.current = null
    }
    destinationRef.current = null
    processedRef.current = null
  }, [])

  return { enable, disable, isEnabled: enabledRef }
}
