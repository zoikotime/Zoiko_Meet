import { useCallback, useEffect, useRef } from 'react'

/**
 * Background blur / virtual background using Canvas.
 *
 * Approach: Draws frames from the camera stream to a hidden canvas, applies a
 * CSS filter (blur) or composites a background image via 2D context, then
 * captures the canvas as a MediaStream.
 *
 * For true segmentation we'd need a body-segmentation model (e.g.
 * @mediapipe/selfie_segmentation). This implementation provides a real,
 * usable blur effect via the canvas filter API which is widely supported.
 *
 * Returns:
 *   applyEffect(stream, mode)  -> processedStream
 *   stopEffect()
 *
 * Modes: 'none' | 'blur-light' | 'blur-heavy' | 'image'
 */
export default function useBackgroundEffect() {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const videoElRef = useRef(null)
  const rafRef = useRef(null)
  const processedStreamRef = useRef(null)
  const bgImageRef = useRef(null)
  const modeRef = useRef('none')

  const stopEffect = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (processedStreamRef.current) {
      processedStreamRef.current.getTracks().forEach((t) => t.stop())
      processedStreamRef.current = null
    }
    if (videoElRef.current) {
      videoElRef.current.pause()
      videoElRef.current.srcObject = null
      videoElRef.current = null
    }
    canvasRef.current = null
    ctxRef.current = null
  }, [])

  const applyEffect = useCallback(
    (sourceStream, mode = 'blur-light', bgImageUrl = null) => {
      stopEffect()

      if (mode === 'none') {
        modeRef.current = 'none'
        return sourceStream
      }

      modeRef.current = mode

      // Load background image if needed
      if (mode === 'image' && bgImageUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = bgImageUrl
        bgImageRef.current = img
      }

      // Create hidden video element to feed from source stream
      const video = document.createElement('video')
      video.srcObject = sourceStream
      video.muted = true
      video.playsInline = true
      video.play()
      videoElRef.current = video

      // Create canvas
      const canvas = document.createElement('canvas')
      canvasRef.current = canvas

      // Wait for video metadata to get dimensions
      const startRender = () => {
        const w = video.videoWidth || 640
        const h = video.videoHeight || 480
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctxRef.current = ctx

        function draw() {
          if (!ctxRef.current || !videoElRef.current) return

          const currentMode = modeRef.current

          if (currentMode === 'blur-light') {
            ctx.filter = 'blur(8px)'
            ctx.drawImage(video, -10, -10, w + 20, h + 20)
            ctx.filter = 'none'
            // Draw the person on top (unblurred center region)
            // This is a simple center-crop overlay approach
            const cx = w * 0.15, cy = h * 0.05
            const cw = w * 0.7, ch = h * 0.9
            ctx.drawImage(video, cx, cy, cw, ch, cx, cy, cw, ch)
          } else if (currentMode === 'blur-heavy') {
            ctx.filter = 'blur(20px)'
            ctx.drawImage(video, -20, -20, w + 40, h + 40)
            ctx.filter = 'none'
            const cx = w * 0.15, cy = h * 0.05
            const cw = w * 0.7, ch = h * 0.9
            ctx.drawImage(video, cx, cy, cw, ch, cx, cy, cw, ch)
          } else if (currentMode === 'image' && bgImageRef.current?.complete) {
            // Draw background image
            ctx.drawImage(bgImageRef.current, 0, 0, w, h)
            // Draw person on top (center region)
            const cx = w * 0.15, cy = h * 0.05
            const cw = w * 0.7, ch = h * 0.9
            ctx.drawImage(video, cx, cy, cw, ch, cx, cy, cw, ch)
          } else {
            ctx.drawImage(video, 0, 0, w, h)
          }

          rafRef.current = requestAnimationFrame(draw)
        }

        draw()
      }

      if (video.readyState >= 2) {
        startRender()
      } else {
        video.addEventListener('loadeddata', startRender, { once: true })
      }

      // Capture the canvas as a stream at 30fps
      const processed = canvas.captureStream(30)

      // Carry over audio tracks from source
      for (const audioTrack of sourceStream.getAudioTracks()) {
        processed.addTrack(audioTrack)
      }

      processedStreamRef.current = processed
      return processed
    },
    [stopEffect]
  )

  const setMode = useCallback(
    (mode, bgImageUrl = null) => {
      modeRef.current = mode
      if (mode === 'image' && bgImageUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = bgImageUrl
        bgImageRef.current = img
      }
    },
    []
  )

  useEffect(() => {
    return () => stopEffect()
  }, [stopEffect])

  return { applyEffect, stopEffect, setMode, processedStreamRef }
}
