import React, { useState, useRef, useCallback, useEffect } from 'react'
import NetworkViz from './NetworkViz.jsx'
import BoundaryViz from './BoundaryViz.jsx'
import LossChart from './LossChart.jsx'

const GEN_COLORS = ['#7c5cff', '#ff5ca8', '#5cffb4', '#ffb05c']
const GEN_NAMES = ['Primogénita', 'Heredera', 'Evolucionada', 'Maestra']

const DATASETS_INFO = {
  xor: { name: 'XOR', desc: 'Separación no lineal clásica', emoji: '⊕' },
  spiral: { name: 'Espiral', desc: 'Patrón espiral complejo', emoji: '🌀' },
  circles: { name: 'Círculos', desc: 'Círculos concéntricos', emoji: '⭕' },
}

export default function App() {
  const [phase, setPhase] = useState('config') // config | training | complete
  const [config, setConfig] = useState({
    dataset: 'xor',
    epochs_per_gen: 200,
    max_generations: 4,
    lr: 0.05,
    speed: 2,
  })

  const [generations, setGenerations] = useState([])
  const [currentGen, setCurrentGen] = useState(null)
  const [currentEpoch, setCurrentEpoch] = useState(0)
  const [currentLoss, setCurrentLoss] = useState(null)
  const [currentAccuracy, setCurrentAccuracy] = useState(null)
  const [currentBoundary, setCurrentBoundary] = useState(null)
  const [datasetPoints, setDatasetPoints] = useState(null)
  const [networkState, setNetworkState] = useState(null)
  const [logs, setLogs] = useState([])
  const [activeTab, setActiveTab] = useState('network')

  const wsRef = useRef(null)
  const logsEndRef = useRef(null)

  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [...prev.slice(-50), { msg, type, id: Date.now() + Math.random() }])
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const startTraining = useCallback(() => {
    if (wsRef.current) wsRef.current.close()

    const ws = new WebSocket('ws://localhost:8000/ws/train')
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify(config))
      setPhase('training')
      setGenerations([])
      setCurrentGen(null)
      setLogs([])
      addLog('🔌 Conectado al servidor', 'success')
    }

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data)

      switch (data.type) {
        case 'started':
          addLog(`🚀 ${data.message}`, 'success')
          break

        case 'dataset':
          setDatasetPoints(data.points)
          addLog(`📊 Dataset cargado: ${data.dataset} (${data.points.X.length} puntos)`, 'info')
          break

        case 'new_generation':
          setCurrentGen(data.generation)
          setCurrentEpoch(0)
          setCurrentBoundary(null)
          setNetworkState(null)
          addLog(data.inherited
            ? `🧬 Gen ${data.generation} — Heredando pesos de Gen ${data.generation - 1}`
            : `🧬 Gen ${data.generation} — Red nueva (${data.architecture.join('→')})`,
            'gen'
          )
          break

        case 'epoch_update':
          setCurrentEpoch(data.epoch)
          setCurrentLoss(data.loss)
          setCurrentAccuracy(data.accuracy)
          setNetworkState(data.state)
          if (data.boundary) setCurrentBoundary(data.boundary)

          // Actualizar historial de la generación actual
          setGenerations(prev => {
            const updated = [...prev]
            const genIdx = updated.findIndex(g => g.generation === data.generation)
            const genData = {
              generation: data.generation,
              loss_history: data.state.loss_history || [],
              accuracy_history: data.state.accuracy_history || [],
              state: data.state,
              progress: data.progress,
              active: true,
            }
            if (genIdx >= 0) updated[genIdx] = genData
            else updated.push(genData)
            return updated
          })
          break

        case 'generation_complete':
          addLog(`✅ Gen ${data.generation}: Loss=${data.final_loss.toFixed(4)} | Acc=${data.final_accuracy.toFixed(1)}%`, 'success')
          setGenerations(prev => prev.map(g =>
            g.generation === data.generation
              ? { ...g, active: false, complete: true, final_loss: data.final_loss, final_accuracy: data.final_accuracy }
              : g
          ))
          break

        case 'training_complete':
          addLog('🎉 ¡Evolución completa!', 'success')
          setPhase('complete')
          setCurrentGen(null)
          break

        case 'error':
          addLog(`❌ Error: ${data.message}`, 'error')
          break
      }
    }

    ws.onerror = () => addLog('❌ Error de conexión WebSocket', 'error')
    ws.onclose = () => addLog('🔌 Conexión cerrada', 'info')
  }, [config, addLog])

  const stopTraining = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    setPhase('config')
  }, [])

  const progress = currentEpoch / config.epochs_per_gen

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={styles.logoGlyph}>⬡</span>
            <span style={styles.logoText}>NeuralEvolution</span>
          </div>
          <span style={styles.headerSub}>Redes que aprenden y evolucionan</span>
        </div>
        <div style={styles.headerRight}>
          {phase === 'training' && currentGen && (
            <div style={styles.statusPill}>
              <span style={{ ...styles.dot, background: GEN_COLORS[(currentGen - 1) % 4] }} />
              Gen {currentGen} • Época {currentEpoch}
            </div>
          )}
          {phase === 'complete' && (
            <div style={{ ...styles.statusPill, borderColor: '#5cffb4' }}>
              <span style={{ ...styles.dot, background: '#5cffb4' }} />
              Evolución completa
            </div>
          )}
        </div>
      </header>

      <div style={styles.main}>
        {/* Panel izquierdo: Config + Logs */}
        <aside style={styles.sidebar}>
          {/* Configuración */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>CONFIGURACIÓN</div>

            <label style={styles.label}>Dataset</label>
            <div style={styles.datasetGrid}>
              {Object.entries(DATASETS_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => phase === 'config' && setConfig(c => ({ ...c, dataset: key }))}
                  style={{
                    ...styles.datasetBtn,
                    ...(config.dataset === key ? styles.datasetBtnActive : {}),
                    opacity: phase !== 'config' ? 0.5 : 1,
                    cursor: phase !== 'config' ? 'default' : 'pointer',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{info.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{info.name}</span>
                  <span style={{ fontSize: 9, opacity: 0.7 }}>{info.desc}</span>
                </button>
              ))}
            </div>

            <label style={styles.label}>Generaciones: {config.max_generations}</label>
            <input type="range" min={2} max={4} value={config.max_generations}
              disabled={phase !== 'config'}
              onChange={e => setConfig(c => ({ ...c, max_generations: +e.target.value }))}
              style={styles.slider} />

            <label style={styles.label}>Épocas por gen: {config.epochs_per_gen}</label>
            <input type="range" min={50} max={500} step={50} value={config.epochs_per_gen}
              disabled={phase !== 'config'}
              onChange={e => setConfig(c => ({ ...c, epochs_per_gen: +e.target.value }))}
              style={styles.slider} />

            <label style={styles.label}>Learning rate: {config.lr}</label>
            <input type="range" min={0.01} max={0.2} step={0.01} value={config.lr}
              disabled={phase !== 'config'}
              onChange={e => setConfig(c => ({ ...c, lr: +e.target.value }))}
              style={styles.slider} />

            <label style={styles.label}>Velocidad: {['', 'Normal', 'Rápido', '', '', 'Turbo'][config.speed]}</label>
            <input type="range" min={1} max={5} value={config.speed}
              disabled={phase !== 'config'}
              onChange={e => setConfig(c => ({ ...c, speed: +e.target.value }))}
              style={styles.slider} />

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              {phase === 'config' || phase === 'complete' ? (
                <button onClick={startTraining} style={styles.btnPrimary}>
                  {phase === 'complete' ? '↺ REINICIAR' : '▶ INICIAR EVOLUCIÓN'}
                </button>
              ) : (
                <button onClick={stopTraining} style={styles.btnDanger}>
                  ■ DETENER
                </button>
              )}
            </div>
          </div>

          {/* Terminal de logs */}
          <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={styles.cardTitle}>TERMINAL</div>
            <div style={styles.terminal}>
              {logs.map(log => (
                <div key={log.id} style={{
                  ...styles.logLine,
                  color: log.type === 'error' ? '#ff5c5c'
                    : log.type === 'success' ? '#5cffb4'
                    : log.type === 'gen' ? '#ffb05c'
                    : '#a0a0c0'
                }}>
                  {log.msg}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </aside>

        {/* Centro: Visualización principal */}
        <main style={styles.center}>
          {/* Generaciones en cards */}
          <div style={styles.genGrid}>
            {Array.from({ length: config.max_generations }, (_, gi) => {
              const gen = generations.find(g => g.generation === gi + 1)
              const isActive = currentGen === gi + 1
              const isDone = gen?.complete
              const isPending = !gen

              const color = GEN_COLORS[gi]

              return (
                <div
                  key={gi}
                  style={{
                    ...styles.genCard,
                    borderColor: isActive ? color : isDone ? color + '60' : '#1a1a2e',
                    boxShadow: isActive ? `0 0 20px ${color}40` : 'none',
                    opacity: isPending ? 0.35 : 1,
                    transition: 'all 0.4s ease',
                  }}
                >
                  {/* Gen header */}
                  <div style={styles.genHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ ...styles.genDot, background: color, boxShadow: isActive ? `0 0 8px ${color}` : 'none' }} />
                      <div>
                        <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: 1 }}>
                          GEN {gi + 1}
                        </div>
                        <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>
                          {GEN_NAMES[gi]}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {isDone && (
                        <>
                          <div style={{ fontSize: 11, color: '#5cffb4', fontFamily: 'Space Mono' }}>
                            {gen.final_accuracy?.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: 9, color: '#555' }}>accuracy</div>
                        </>
                      )}
                      {isActive && (
                        <div style={{ fontSize: 10, color, fontFamily: 'Space Mono' }}>
                          {currentAccuracy?.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {isActive && (
                    <div style={styles.progressBar}>
                      <div style={{
                        ...styles.progressFill,
                        width: `${progress * 100}%`,
                        background: color,
                        boxShadow: `0 0 6px ${color}`,
                      }} />
                    </div>
                  )}
                  {isDone && (
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: '100%', background: color + '60' }} />
                    </div>
                  )}

                  {/* Network viz */}
                  <div style={styles.networkCanvas}>
                    {(isActive || isDone) && (
                      <NetworkViz
                        state={isActive ? networkState : gen?.state}
                        isActive={isActive}
                      />
                    )}
                    {isPending && (
                      <div style={styles.pendingMsg}>
                        <span style={{ fontSize: 24, opacity: 0.3 }}>⬡</span>
                        <span style={{ fontSize: 10, color: '#333', marginTop: 4 }}>Esperando...</span>
                      </div>
                    )}
                  </div>

                  {/* Architecture label */}
                  {gen?.state && (
                    <div style={styles.archLabel}>
                      {gen.state.layers?.join(' → ')}
                    </div>
                  )}

                  {/* Stats */}
                  {isActive && currentLoss !== null && (
                    <div style={styles.statRow}>
                      <span style={styles.stat}>
                        <span style={styles.statKey}>loss</span>
                        <span style={{ ...styles.statVal, color }}>{currentLoss.toFixed(4)}</span>
                      </span>
                      <span style={styles.stat}>
                        <span style={styles.statKey}>época</span>
                        <span style={{ ...styles.statVal, color }}>{currentEpoch}</span>
                      </span>
                    </div>
                  )}
                  {isDone && (
                    <div style={styles.statRow}>
                      <span style={styles.stat}>
                        <span style={styles.statKey}>loss</span>
                        <span style={{ ...styles.statVal, color }}>{gen.final_loss?.toFixed(4)}</span>
                      </span>
                      <span style={styles.stat}>
                        <span style={styles.statKey}>✓ completa</span>
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Herencia visual */}
          {generations.length > 1 && (
            <div style={styles.inheritRow}>
              {generations.slice(0, -1).map((gen, gi) => (
                <div key={gi} style={styles.inheritArrow}>
                  <div style={{ ...styles.inheritLine, background: GEN_COLORS[gi] }} />
                  <span style={{ fontSize: 9, color: GEN_COLORS[gi], opacity: 0.8 }}>
                    hereda pesos
                  </span>
                  <div style={{ ...styles.inheritLine, background: GEN_COLORS[gi + 1] }} />
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Panel derecho */}
        <aside style={styles.rightPanel}>
          {/* Tabs */}
          <div style={styles.tabs}>
            {['boundary', 'loss', 'info'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === tab ? '2px solid #7c5cff' : '2px solid transparent',
                  color: activeTab === tab ? '#7c5cff' : '#555',
                }}
              >
                {{ boundary: 'FRONTERA', loss: 'PÉRDIDA', info: 'INFO' }[tab]}
              </button>
            ))}
          </div>

          {activeTab === 'boundary' && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>FRONTERA DE DECISIÓN</div>
              <div style={{ ...styles.boundaryCanvas }}>
                <BoundaryViz boundary={currentBoundary} points={datasetPoints} />
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <span style={styles.legend}>
                  <span style={{ ...styles.legendDot, background: 'rgba(80,200,255,0.9)' }} />
                  Clase 0
                </span>
                <span style={styles.legend}>
                  <span style={{ ...styles.legendDot, background: 'rgba(255,100,150,0.9)' }} />
                  Clase 1
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: 9, color: '#444', textAlign: 'center' }}>
                Regiones coloreadas por predicción de la red
              </div>
            </div>
          )}

          {activeTab === 'loss' && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>CURVAS DE PÉRDIDA</div>
              <div style={styles.lossCanvas}>
                <LossChart generations={generations} />
              </div>
              <div style={{ marginTop: 8 }}>
                {generations.map((gen, gi) => (
                  <div key={gi} style={styles.genLegendRow}>
                    <span style={{ ...styles.legendDot, background: GEN_COLORS[gi] }} />
                    <span style={{ fontSize: 10, color: '#888' }}>Gen {gen.generation}</span>
                    {gen.final_accuracy && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: GEN_COLORS[gi], fontFamily: 'Space Mono' }}>
                        {gen.final_accuracy.toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>CÓMO FUNCIONA</div>
              <div style={styles.infoSection}>
                <div style={styles.infoTitle}>🧬 Evolución Generacional</div>
                <div style={styles.infoText}>
                  Cada generación hereda los pesos de la anterior con una pequeña mutación. Esto es aprendizaje por transferencia + evolución genética.
                </div>
              </div>
              <div style={styles.infoSection}>
                <div style={styles.infoTitle}>🔗 Conexiones</div>
                <div style={styles.infoText}>
                  El grosor y brillo de cada conexión representa el peso (w) de esa sinapsis. Más brillante = más importante.
                </div>
              </div>
              <div style={styles.infoSection}>
                <div style={styles.infoTitle}>💜 Neuronas</div>
                <div style={styles.infoText}>
                  El color de cada neurona indica su nivel de activación. Las neuronas de entrada (azul) y salida (rosa) tienen roles fijos.
                </div>
              </div>
              <div style={styles.infoSection}>
                <div style={styles.infoTitle}>📉 Pérdida (Loss)</div>
                <div style={styles.infoText}>
                  Cuanto menor la pérdida, mejor clasifica la red. El descenso de gradiente ajusta los pesos para minimizarla.
                </div>
              </div>
              <div style={styles.infoSection}>
                <div style={styles.infoTitle}>🗺️ Frontera de decisión</div>
                <div style={styles.infoText}>
                  El mapa de colores muestra qué región del espacio la red clasifica como clase 0 (azul) o clase 1 (rosa).
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: '100vh',
    background: '#050508',
    color: '#e8e8f0',
    fontFamily: "'Syne', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    fontSize: 13,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid #1a1a2e',
    background: '#070710',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoGlyph: { fontSize: 22, color: '#7c5cff' },
  logoText: { fontSize: 18, fontWeight: 800, letterSpacing: 1 },
  headerSub: { fontSize: 11, color: '#444', fontFamily: 'Space Mono, monospace' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  statusPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 12px', borderRadius: 20,
    border: '1px solid #333', fontSize: 11,
    fontFamily: 'Space Mono, monospace', color: '#aaa',
  },
  dot: { width: 6, height: 6, borderRadius: '50%' },

  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    gap: 0,
  },

  sidebar: {
    width: 240,
    borderRight: '1px solid #12121e',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    overflow: 'auto',
    background: '#060609',
    flexShrink: 0,
  },

  card: {
    padding: 16,
    borderBottom: '1px solid #12121e',
  },

  cardTitle: {
    fontSize: 9,
    fontFamily: 'Space Mono, monospace',
    color: '#444',
    letterSpacing: 2,
    marginBottom: 12,
  },

  label: {
    display: 'block',
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
    marginTop: 10,
  },

  slider: {
    width: '100%',
    accentColor: '#7c5cff',
    cursor: 'pointer',
  },

  datasetGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 6,
    marginBottom: 4,
  },

  datasetBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 2, padding: '8px 4px',
    background: '#0d0d1a', border: '1px solid #1a1a2e',
    borderRadius: 6, cursor: 'pointer', color: '#888',
    transition: 'all 0.2s',
  },
  datasetBtnActive: {
    borderColor: '#7c5cff', color: '#c8b8ff',
    background: '#12103a', boxShadow: '0 0 8px #7c5cff40',
  },

  btnPrimary: {
    flex: 1, padding: '10px 0', background: '#7c5cff',
    border: 'none', borderRadius: 6, color: '#fff',
    fontFamily: 'Space Mono, monospace', fontSize: 11,
    fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
  },
  btnDanger: {
    flex: 1, padding: '10px 0', background: '#3a1020',
    border: '1px solid #ff5c5c', borderRadius: 6, color: '#ff5c5c',
    fontFamily: 'Space Mono, monospace', fontSize: 11,
    fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
  },

  terminal: {
    flex: 1, background: '#030306', borderRadius: 4,
    padding: 10, overflowY: 'auto', maxHeight: 200,
    fontFamily: 'Space Mono, monospace', fontSize: 10,
    lineHeight: 1.8,
  },
  logLine: { wordBreak: 'break-word' },

  // Centro
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: 20,
    gap: 16,
  },

  genGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
  },

  genCard: {
    background: '#080810',
    border: '1px solid #1a1a2e',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  genHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  genDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },

  progressBar: {
    height: 2, background: '#1a1a2e', borderRadius: 1, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 1, transition: 'width 0.1s linear',
  },

  networkCanvas: {
    height: 160, borderRadius: 6, overflow: 'hidden',
    background: '#050510',
  },
  pendingMsg: {
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
  },

  archLabel: {
    fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#333',
    textAlign: 'center',
  },

  statRow: {
    display: 'flex', justifyContent: 'space-between',
  },
  stat: { display: 'flex', alignItems: 'center', gap: 4 },
  statKey: { fontSize: 9, color: '#444', fontFamily: 'Space Mono, monospace' },
  statVal: { fontSize: 11, fontFamily: 'Space Mono, monospace', fontWeight: 700 },

  inheritRow: {
    display: 'flex', gap: 12, alignItems: 'center',
    padding: '0 20px', justifyContent: 'center',
  },
  inheritArrow: {
    display: 'flex', alignItems: 'center', gap: 8, flex: 1,
    justifyContent: 'center',
  },
  inheritLine: {
    height: 1, flex: 1, opacity: 0.4,
  },

  // Right panel
  rightPanel: {
    width: 260,
    borderLeft: '1px solid #12121e',
    display: 'flex',
    flexDirection: 'column',
    background: '#060609',
    flexShrink: 0,
    overflow: 'auto',
  },

  tabs: {
    display: 'flex', borderBottom: '1px solid #12121e',
  },
  tab: {
    flex: 1, padding: '10px 0', background: 'none', border: 'none',
    fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: 1,
    cursor: 'pointer', transition: 'all 0.2s',
  },

  boundaryCanvas: {
    height: 200, borderRadius: 6, overflow: 'hidden',
    background: '#07070f',
  },
  lossCanvas: {
    height: 150, borderRadius: 6, overflow: 'hidden',
  },

  legend: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 10, color: '#666',
  },
  legendDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  genLegendRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '3px 0', borderBottom: '1px solid #0d0d1a',
  },

  infoSection: { marginBottom: 14 },
  infoTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  infoText: { fontSize: 10, color: '#666', lineHeight: 1.6 },
}
