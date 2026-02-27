import React, { useRef, useEffect } from 'react'

const GEN_COLORS = [
  '#7c5cff', '#ff5ca8', '#5cffb4', '#ffb05c'
]

export default function LossChart({ generations }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !generations.length) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = '#07070f'
    ctx.fillRect(0, 0, W, H)

    const padL = 40, padR = 20, padT = 20, padB = 30
    const plotW = W - padL - padR
    const plotH = H - padT - padB

    // Encontrar max epochs y max loss
    let maxEpochs = 0
    let maxLoss = 0
    generations.forEach(gen => {
      if (gen.loss_history) {
        maxEpochs = Math.max(maxEpochs, gen.loss_history.length)
        gen.loss_history.forEach(l => maxLoss = Math.max(maxLoss, l))
      }
    })
    maxLoss = Math.max(maxLoss, 0.1)

    // Grid
    ctx.strokeStyle = 'rgba(100,100,150,0.15)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * plotH
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke()
      
      // Labels
      ctx.fillStyle = 'rgba(150,150,200,0.6)'
      ctx.font = '9px Space Mono, monospace'
      ctx.textAlign = 'right'
      ctx.fillText((maxLoss * (1 - i / 4)).toFixed(2), padL - 5, y + 3)
    }

    // Etiqueta Y
    ctx.save()
    ctx.translate(10, padT + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = 'rgba(150,150,200,0.5)'
    ctx.font = '9px Space Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('LOSS', 0, 0)
    ctx.restore()

    // Curvas de pérdida por generación
    generations.forEach((gen, gi) => {
      if (!gen.loss_history || gen.loss_history.length < 2) return
      const color = GEN_COLORS[gi % GEN_COLORS.length]
      const history = gen.loss_history

      // Sombra/glow
      ctx.shadowColor = color
      ctx.shadowBlur = 6

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'

      history.forEach((loss, ei) => {
        const x = padL + (ei / Math.max(maxEpochs - 1, 1)) * plotW
        const y = padT + (1 - loss / maxLoss) * plotH
        if (ei === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.shadowBlur = 0

      // Label al final
      const lastLoss = history[history.length - 1]
      const lx = padL + (history.length / maxEpochs) * plotW
      const ly = padT + (1 - lastLoss / maxLoss) * plotH
      ctx.fillStyle = color
      ctx.font = 'bold 9px Space Mono, monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`G${gen.generation}`, Math.min(lx + 3, W - 25), ly + 3)
    })

    // Eje X
    ctx.fillStyle = 'rgba(150,150,200,0.5)'
    ctx.font = '9px Space Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ÉPOCAS', padL + plotW / 2, H - 5)

  }, [generations])

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={150}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
