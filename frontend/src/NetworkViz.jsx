import React, { useRef, useEffect } from 'react'

export default function NetworkViz({ state, isActive }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!state || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const { layers, weight_magnitudes, activation_means } = state
    if (!layers || !weight_magnitudes) return

    const paddingX = 60
    const paddingY = 40
    const layerCount = layers.length
    const layerSpacing = (W - paddingX * 2) / (layerCount - 1)

    // Calcular posiciones de neuronas
    const neuronPositions = []
    layers.forEach((count, li) => {
      const x = paddingX + li * layerSpacing
      const positions = []
      const maxNeurons = Math.max(...layers)
      const displayCount = Math.min(count, 8)
      const spacing = (H - paddingY * 2) / Math.max(displayCount - 1, 1)
      for (let ni = 0; ni < displayCount; ni++) {
        const y = displayCount === 1 ? H / 2 : paddingY + ni * spacing
        positions.push({ x, y, index: ni })
      }
      neuronPositions.push(positions)
    })

    // Dibujar conexiones
    for (let li = 0; li < layerCount - 1; li++) {
      const fromLayer = neuronPositions[li]
      const toLayer = neuronPositions[li + 1]
      const magnitudes = weight_magnitudes[li] || []

      fromLayer.forEach((from, fi) => {
        toLayer.forEach((to, ti) => {
          const mag = magnitudes[fi]?.[ti] ?? 0
          const normalizedMag = Math.min(mag / 2, 1)
          
          const r = isActive ? Math.floor(100 + normalizedMag * 155) : 60
          const g = isActive ? Math.floor(50 + normalizedMag * 80) : 60
          const b = isActive ? Math.floor(200 + normalizedMag * 55) : 80
          const alpha = 0.1 + normalizedMag * 0.5

          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
          ctx.lineWidth = 0.5 + normalizedMag * 2
          ctx.stroke()
        })
      })
    }

    // Dibujar neuronas
    neuronPositions.forEach((positions, li) => {
      const actMean = activation_means?.[li - 1] ?? 0
      positions.forEach(({ x, y }) => {
        const activation = Math.min(Math.max(actMean, 0), 1)
        
        // Glow
        if (isActive && activation > 0.3) {
          const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, 20)
          glowGradient.addColorStop(0, `rgba(120, 80, 255, ${activation * 0.3})`)
          glowGradient.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.beginPath()
          ctx.arc(x, y, 20, 0, Math.PI * 2)
          ctx.fillStyle = glowGradient
          ctx.fill()
        }

        // Neurona
        const radius = 8
        const gradient = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, radius)
        if (li === 0) {
          gradient.addColorStop(0, '#60efff')
          gradient.addColorStop(1, '#0070a0')
        } else if (li === layers.length - 1) {
          gradient.addColorStop(0, isActive ? '#ff6b9d' : '#884466')
          gradient.addColorStop(1, isActive ? '#a0003d' : '#440022')
        } else {
          const v = activation
          gradient.addColorStop(0, `rgba(${100 + v*155}, ${80 + v*100}, 255, 1)`)
          gradient.addColorStop(1, `rgba(${40 + v*80}, ${20 + v*40}, ${150 + v*80}, 1)`)
        }

        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
        ctx.strokeStyle = isActive ? 'rgba(200,180,255,0.6)' : 'rgba(100,100,150,0.3)'
        ctx.lineWidth = 1
        ctx.stroke()
      })
    })

    // Labels
    ctx.font = '10px Space Mono, monospace'
    ctx.fillStyle = 'rgba(180,170,220,0.7)'
    layers.forEach((count, li) => {
      const x = neuronPositions[li][0].x
      ctx.textAlign = 'center'
      ctx.fillText(`${count}n`, x, H - 8)
    })

  }, [state, isActive])

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={200}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
