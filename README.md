# ⬡ NeuralEvolution

Visualización en tiempo real de redes neuronales que aprenden y evolucionan por generaciones.

## 🧬 Concepto

Cada generación de red neuronal:
1. **Nace** con una arquitectura más compleja que la anterior
2. **Hereda** los pesos de su red madre (transfer learning)
3. **Muta** ligeramente los pesos heredados
4. **Aprende** durante N épocas con backpropagation
5. **Transfiere** su conocimiento a la siguiente generación

## 🖥️ Stack

| Componente | Tecnología |
|---|---|
| Backend | Python + FastAPI + WebSockets |
| ML Engine | NumPy puro (sin PyTorch/TF) |
| Frontend | React + Vite |
| Visualización | Canvas 2D nativo |

## 🚀 Inicio rápido

```bash
chmod +x start.sh
./start.sh
```

O manualmente:

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Abre: http://localhost:5173

## 📊 Datasets disponibles

- **XOR** — Problema clásico de separación no lineal
- **Espiral** — Patrón espiral entrelazado, más complejo
- **Círculos** — Círculos concéntricos

## 🏗️ Arquitecturas por generación

| Gen | Arquitectura | Parámetros |
|---|---|---|
| 1 | 2 → 4 → 1 | ~17 |
| 2 | 2 → 8 → 4 → 1 | ~61 |
| 3 | 2 → 16 → 8 → 4 → 1 | ~229 |
| 4 | 2 → 32 → 16 → 8 → 1 | ~825 |

## 🔭 Próximos pasos (v2)

- [ ] Dataset MNIST (imágenes 28x28)
- [ ] Visualización de activaciones por capa (heatmap)
- [ ] Comparador de generaciones en tiempo real
- [ ] Exportar modelo entrenado
- [ ] Modo competición: múltiples redes en paralelo

## 📡 API WebSocket

Conectar a `ws://localhost:8000/ws/train` y enviar:

```json
{
  "dataset": "xor",
  "epochs_per_gen": 200,
  "max_generations": 4,
  "lr": 0.05,
  "speed": 2
}
```

Mensajes recibidos: `started`, `dataset`, `new_generation`, `epoch_update`, `generation_complete`, `training_complete`
