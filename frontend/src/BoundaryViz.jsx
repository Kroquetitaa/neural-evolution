import React, { useRef, useEffect } from 'react'

export default function BoundaryViz({ boundary, points }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Background grid
    ctx.fillStyle = '#0a0a14'
    ctx.fillRect(0, 0, W, H)

    // Función para convertir coordenadas del espacio [-1.5, 1.5] a canvas
    const toCanvas = (val, min = -1.5, max = 1.5, size) => {
      return ((val - min) / (max - min)) * size
    }

    // Dibujar boundary
    if (boundary && boundary.length > 0) {
      const gridSize = boundary.length
      const cellW = W / gridSize
      const cellH = H / gridSize

      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const val = boundary[row][col]
          const r = Math.floor(val * 80 + 20)
          const g = Math.floor(val * 30)
          const b = Math.floor((1 - val) * 80 + 20)
          ctx.fillStyle = `rgba(${r * 2}, ${g}, ${b * 2}, 0.6)`
          ctx.fillRect(col * cellW, row * cellH, cellW + 1, cellH + 1)
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(100,100,150,0.15)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 6; i++) {
      const x = (i / 6) * W
      const y = (i / 6) * H
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Ejes
    const cx = toCanvas(0, -1.5, 1.5, W)
    const cy = toCanvas(0, -1.5, 1.5, H)
    ctx.strokeStyle = 'rgba(150,150,200,0.4)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke()

    // Puntos del dataset
    if (points) {
      points.X.forEach((pt, i) => {
        const x = toCanvas(pt[0], -1.5, 1.5, W)
        const y = toCanvas(pt[1], -1.5, 1.5, H)
        const label = points.y[i]

        ctx.beginPath()
        ctx.arc(x, y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = label > 0.5
          ? 'rgba(255, 100, 150, 0.9)'
          : 'rgba(80, 200, 255, 0.9)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      })
    }

  }, [boundary, points])

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      style={{ width: '100%', height: '100%', borderRadius: '4px' }}
    />
  )
}
