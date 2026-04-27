import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'

const COLORS = ['#ef4f6b', '#fbbf24', '#34d399', '#7c8cff', '#ffffff']

/**
 * Transparent annotation overlay that sits on top of a shared screen tile.
 * Supports freehand drawing, arrows, and highlighting.
 * All coordinates are normalised to 0–100 so they sync across different screen sizes.
 */
export default function AnnotationOverlay({ onAnnotate, remoteAnnotations, onClear, onClose }) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const [tool, setTool] = useState('pen')    // 'pen' | 'highlight' | 'arrow' | 'pointer'
  const [color, setColor] = useState('#ef4f6b')
  const [isDrawing, setIsDrawing] = useState(false)
  const [annotations, setAnnotations] = useState([])
  const currentRef = useRef(null)
  const startRef = useRef(null)
  const [pointerPos, setPointerPos] = useState(null) // for laser pointer

  const toPixel = useCallback((pos) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: (pos.x / 100) * rect.width, y: (pos.y / 100) * rect.height }
  }, [])

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return { x: ((cx - rect.left) / rect.width) * 100, y: ((cy - rect.top) / rect.height) * 100 }
  }, [])

  const drawAnnotation = useCallback((ann) => {
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.save()

    if (ann.tool === 'pen') {
      ctx.strokeStyle = ann.color
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = 1
      ctx.beginPath()
      const p0 = toPixel(ann.points[0])
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < ann.points.length; i++) {
        const p = toPixel(ann.points[i])
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    } else if (ann.tool === 'highlight') {
      ctx.strokeStyle = ann.color
      ctx.lineWidth = 18
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      const p0 = toPixel(ann.points[0])
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < ann.points.length; i++) {
        const p = toPixel(ann.points[i])
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    } else if (ann.tool === 'arrow') {
      const p0 = toPixel(ann.points[0])
      const p1 = toPixel(ann.points[1])
      ctx.strokeStyle = ann.color
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.stroke()
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x)
      const hl = 16
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p1.x - hl * Math.cos(angle - 0.4), p1.y - hl * Math.sin(angle - 0.4))
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p1.x - hl * Math.cos(angle + 0.4), p1.y - hl * Math.sin(angle + 0.4))
      ctx.stroke()
    }

    ctx.restore()
  }, [toPixel])

  const redrawAll = useCallback((all) => {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    for (const a of all) drawAnnotation(a)
  }, [drawAnnotation])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      ctxRef.current = ctx
      redrawAll(annotations)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [annotations, redrawAll])

  // Render remote annotations — mirror inbound prop into local state so
  // redrawAll (on resize) can replay every annotation, local or remote.
  useEffect(() => {
    if (!remoteAnnotations?.length) return
    const last = remoteAnnotations[remoteAnnotations.length - 1]
    if (last) {
      if (last.tool === 'clear') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnnotations([])
        redrawAll([])
      } else if (last.tool === 'pointer') {
        // Just show remote pointer momentarily
        setPointerPos(last.pos)
        setTimeout(() => setPointerPos(null), 2000)
      } else {
        drawAnnotation(last)
        setAnnotations(prev => [...prev, last])
      }
    }
  }, [remoteAnnotations, drawAnnotation, redrawAll])

  const handleDown = useCallback((e) => {
    e.stopPropagation()
    if (tool === 'pointer') {
      const pos = getPos(e)
      setPointerPos(pos)
      if (onAnnotate) onAnnotate({ tool: 'pointer', pos })
      setTimeout(() => setPointerPos(null), 2000)
      return
    }
    setIsDrawing(true)
    const pos = getPos(e)
    startRef.current = pos
    currentRef.current = { tool, color, points: [pos] }
  }, [tool, color, getPos, onAnnotate])

  const handleMove = useCallback((e) => {
    e.stopPropagation()
    if (!isDrawing || !currentRef.current) return
    const pos = getPos(e)

    if (tool === 'pen' || tool === 'highlight') {
      currentRef.current.points.push(pos)
      // Incremental
      const ctx = ctxRef.current
      const pts = currentRef.current.points
      if (pts.length < 2) return
      const p0 = toPixel(pts[pts.length - 2])
      const p1 = toPixel(pts[pts.length - 1])
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = tool === 'highlight' ? 18 : 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = tool === 'highlight' ? 0.3 : 1
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.stroke()
      ctx.restore()
    } else if (tool === 'arrow') {
      currentRef.current.points = [startRef.current, pos]
      redrawAll(annotations)
      drawAnnotation(currentRef.current)
    }
  }, [isDrawing, tool, color, getPos, toPixel, redrawAll, drawAnnotation, annotations])

  const handleUp = useCallback(() => {
    if (!isDrawing || !currentRef.current) return
    setIsDrawing(false)
    const ann = currentRef.current
    currentRef.current = null
    if (ann.points.length >= 1) {
      setAnnotations(prev => [...prev, ann])
      if (onAnnotate) onAnnotate(ann)
    }
  }, [isDrawing, onAnnotate])

  const handleClear = () => {
    setAnnotations([])
    redrawAll([])
    if (onClear) onClear()
  }

  return (
    <div className="annot-overlay">
      <div className="annot-toolbar">
        {[
          { id: 'pen', icon: 'pen', label: 'Draw' },
          { id: 'highlight', icon: 'palette', label: 'Highlight' },
          { id: 'arrow', icon: 'arrow', label: 'Arrow' },
          { id: 'pointer', icon: 'pointer', label: 'Laser pointer' },
        ].map(t => (
          <button
            key={t.id}
            className={'annot-btn' + (tool === t.id ? ' active' : '')}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            <Icon name={t.icon} size={15} />
          </button>
        ))}

        <div className="annot-divider" />

        {COLORS.map(c => (
          <button
            key={c}
            className={'annot-color' + (c === color ? ' active' : '')}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}

        <div className="annot-divider" />

        <button className="annot-btn" onClick={handleClear} title="Clear annotations">
          <Icon name="trash" size={15} />
        </button>
        <button className="annot-btn" onClick={onClose} title="Stop annotating">
          <Icon name="close" size={15} />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="annot-canvas"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        style={{ cursor: tool === 'pointer' ? 'none' : 'crosshair' }}
      />

      {/* Laser pointer dot */}
      {pointerPos && (
        <div
          className="annot-pointer"
          style={{ left: `${pointerPos.x}%`, top: `${pointerPos.y}%` }}
        />
      )}
    </div>
  )
}
