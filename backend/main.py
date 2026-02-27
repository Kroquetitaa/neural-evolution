"""
NeuralEvolution Backend
FastAPI + WebSockets - Entrena redes neuronales y transmite datos en tiempo real
"""

import asyncio
import json
import math
import random
import time
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np

app = FastAPI(title="NeuralEvolution API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Red Neuronal desde cero (sin frameworks) ────────────────────────────────

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

def sigmoid_derivative(x):
    s = sigmoid(x)
    return s * (1 - s)

def relu(x):
    return np.maximum(0, x)

def relu_derivative(x):
    return (x > 0).astype(float)

class NeuralNetwork:
    def __init__(self, layers: list[int], generation: int = 1, parent_weights=None):
        self.layers = layers
        self.generation = generation
        self.weights = []
        self.biases = []
        self.loss_history = []
        self.accuracy_history = []
        self.epoch = 0
        
        # Inicializar pesos (heredar del padre si existe)
        for i in range(len(layers) - 1):
            w = np.random.randn(layers[i], layers[i+1]) * np.sqrt(2.0 / layers[i])
            b = np.zeros((1, layers[i+1]))
            
            if parent_weights and i < len(parent_weights['weights']):
                pw = np.array(parent_weights['weights'][i])
                pb = np.array(parent_weights['biases'][i])
                
                # Heredar estructura del padre con mutación
                rows = min(w.shape[0], pw.shape[0])
                cols = min(w.shape[1], pw.shape[1])
                w[:rows, :cols] = pw[:rows, :cols]
                b[:, :cols] = pb[:, :cols]
                
                # Mutación genética (~10% de ruido)
                mutation = np.random.randn(*w.shape) * 0.1
                w += mutation
            
            self.weights.append(w)
            self.biases.append(b)
    
    def forward(self, X):
        self.activations = [X]
        self.z_values = []
        
        current = X
        for i, (w, b) in enumerate(zip(self.weights, self.biases)):
            z = current @ w + b
            self.z_values.append(z)
            # ReLU en capas ocultas, sigmoid en salida
            if i < len(self.weights) - 1:
                current = relu(z)
            else:
                current = sigmoid(z)
            self.activations.append(current)
        
        return current
    
    def backward(self, X, y, lr=0.01):
        m = X.shape[0]
        output = self.activations[-1]
        
        # Gradiente de la pérdida (BCE)
        delta = output - y
        
        gradients_w = []
        gradients_b = []
        
        for i in range(len(self.weights) - 1, -1, -1):
            dw = self.activations[i].T @ delta / m
            db = np.sum(delta, axis=0, keepdims=True) / m
            gradients_w.insert(0, dw)
            gradients_b.insert(0, db)
            
            if i > 0:
                delta = delta @ self.weights[i].T * relu_derivative(self.z_values[i-1])
        
        # Actualizar pesos
        for i in range(len(self.weights)):
            self.weights[i] -= lr * gradients_w[i]
            self.biases[i] -= lr * gradients_b[i]
    
    def compute_loss(self, X, y):
        output = self.forward(X)
        eps = 1e-8
        loss = -np.mean(y * np.log(output + eps) + (1 - y) * np.log(1 - output + eps))
        predictions = (output > 0.5).astype(float)
        accuracy = np.mean(predictions == y) * 100
        return float(loss), float(accuracy)
    
    def get_weights_snapshot(self):
        return {
            'weights': [w.tolist() for w in self.weights],
            'biases': [b.tolist() for b in self.biases]
        }
    
    def get_state_for_viz(self):
        """Retorna estado para visualización"""
        # Normalizar pesos para visualización
        weight_magnitudes = []
        for w in self.weights:
            magnitudes = np.abs(w).tolist()
            weight_magnitudes.append(magnitudes)
        
        activation_means = []
        for act in self.activations[1:]:
            activation_means.append(float(np.mean(act)))
        
        return {
            'generation': self.generation,
            'epoch': self.epoch,
            'layers': self.layers,
            'weight_magnitudes': weight_magnitudes,
            'activation_means': activation_means,
            'loss_history': self.loss_history[-100:],
            'accuracy_history': self.accuracy_history[-100:],
        }


# ─── Datasets ────────────────────────────────────────────────────────────────

def make_xor_dataset(n=200):
    X = np.random.rand(n, 2) * 2 - 1  # [-1, 1]
    y = ((X[:, 0] * X[:, 1]) > 0).astype(float).reshape(-1, 1)
    return X, y

def make_spiral_dataset(n=300):
    """Dataset en espiral - más complejo que XOR"""
    X = np.zeros((n * 2, 2))
    y = np.zeros((n * 2, 1))
    
    for c in range(2):
        ix = range(n * c, n * (c + 1))
        r = np.linspace(0.0, 1, n)
        t = np.linspace(c * 3, (c + 1) * 3, n) + np.random.randn(n) * 0.2
        X[ix] = np.c_[r * np.sin(t * 2.5), r * np.cos(t * 2.5)]
        y[ix] = c
    
    return X, y

def make_circles_dataset(n=300):
    """Círculos concéntricos"""
    angles = np.random.rand(n) * 2 * np.pi
    r1 = np.random.rand(n//2) * 0.5
    r2 = np.random.rand(n - n//2) * 0.5 + 0.6
    
    X1 = np.c_[r1 * np.cos(angles[:n//2]), r1 * np.sin(angles[:n//2])]
    X2 = np.c_[r2 * np.cos(angles[n//2:]), r2 * np.sin(angles[n//2:])]
    
    X = np.vstack([X1, X2])
    y = np.vstack([np.zeros((n//2, 1)), np.ones((n - n//2, 1))])
    
    idx = np.random.permutation(n)
    return X[idx], y[idx]

DATASETS = {
    'xor': make_xor_dataset,
    'spiral': make_spiral_dataset,
    'circles': make_circles_dataset,
}

ARCHITECTURES = [
    [2, 4, 1],        # Gen 1: muy simple
    [2, 8, 4, 1],     # Gen 2: una capa más
    [2, 16, 8, 4, 1], # Gen 3: más profunda
    [2, 32, 16, 8, 1],# Gen 4: más ancha y profunda
]

# ─── Estado global ─────────────────────────────────────────────────────────

training_sessions = {}

# ─── WebSocket Manager ──────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
    
    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
    
    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
    
    async def send(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps(data))
        except:
            self.disconnect(ws)

manager = ConnectionManager()


# ─── Endpoint principal WebSocket ────────────────────────────────────────────

@app.websocket("/ws/train")
async def websocket_train(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        # Esperar configuración inicial
        config_raw = await websocket.receive_text()
        config = json.loads(config_raw)
        
        dataset_name = config.get('dataset', 'xor')
        epochs_per_gen = config.get('epochs_per_gen', 150)
        max_generations = config.get('max_generations', 4)
        lr = config.get('lr', 0.05)
        speed = config.get('speed', 1)  # 1=normal, 2=fast, 5=turbo
        
        await manager.send(websocket, {
            'type': 'started',
            'config': config,
            'message': f'Iniciando entrenamiento: {dataset_name} | {max_generations} generaciones'
        })
        
        # Generar dataset
        X, y = DATASETS[dataset_name]()
        
        # Puntos del dataset para visualización (muestra de 100)
        idx = np.random.choice(len(X), min(100, len(X)), replace=False)
        dataset_points = {
            'X': X[idx].tolist(),
            'y': y[idx].flatten().tolist()
        }
        
        await manager.send(websocket, {
            'type': 'dataset',
            'points': dataset_points,
            'dataset': dataset_name
        })
        
        parent_weights = None
        all_networks_history = []
        
        for gen in range(1, max_generations + 1):
            arch = ARCHITECTURES[min(gen - 1, len(ARCHITECTURES) - 1)]
            
            # Crear red (heredando del padre si existe)
            network = NeuralNetwork(arch, generation=gen, parent_weights=parent_weights)
            
            await manager.send(websocket, {
                'type': 'new_generation',
                'generation': gen,
                'architecture': arch,
                'message': f'🧬 Generación {gen} - Arquitectura: {arch}',
                'inherited': parent_weights is not None
            })
            
            # Entrenamiento
            for epoch in range(1, epochs_per_gen + 1):
                network.forward(X)
                network.backward(X, y, lr=lr)
                network.epoch = epoch
                
                loss, accuracy = network.compute_loss(X, y)
                network.loss_history.append(loss)
                network.accuracy_history.append(accuracy)
                
                # Enviar actualización cada N epochs según velocidad
                send_every = max(1, speed)
                if epoch % send_every == 0 or epoch == epochs_per_gen:
                    state = network.get_state_for_viz()
                    
                    # Calcular boundary para visualización (grid 20x20)
                    if epoch % 10 == 0 or epoch == epochs_per_gen:
                        grid_size = 20
                        xx = np.linspace(-1.5, 1.5, grid_size)
                        yy = np.linspace(-1.5, 1.5, grid_size)
                        grid_X, grid_Y = np.meshgrid(xx, yy)
                        grid_input = np.c_[grid_X.ravel(), grid_Y.ravel()]
                        grid_output = network.forward(grid_input).reshape(grid_size, grid_size)
                        boundary = grid_output.tolist()
                    else:
                        boundary = None
                    
                    await manager.send(websocket, {
                        'type': 'epoch_update',
                        'generation': gen,
                        'epoch': epoch,
                        'total_epochs': epochs_per_gen,
                        'loss': loss,
                        'accuracy': accuracy,
                        'state': state,
                        'boundary': boundary,
                        'progress': epoch / epochs_per_gen
                    })
                    
                    await asyncio.sleep(0.02 / speed)
            
            # Generación completada
            final_loss, final_accuracy = network.compute_loss(X, y)
            
            all_networks_history.append({
                'generation': gen,
                'architecture': arch,
                'final_loss': final_loss,
                'final_accuracy': final_accuracy,
                'loss_history': network.loss_history,
                'accuracy_history': network.accuracy_history,
            })
            
            await manager.send(websocket, {
                'type': 'generation_complete',
                'generation': gen,
                'final_loss': final_loss,
                'final_accuracy': final_accuracy,
                'architecture': arch,
                'message': f'✅ Gen {gen} completa: Loss={final_loss:.4f} | Acc={final_accuracy:.1f}%'
            })
            
            # Guardar pesos para heredar
            parent_weights = network.get_weights_snapshot()
            
            # Pausa dramática entre generaciones
            await asyncio.sleep(1.5)
        
        await manager.send(websocket, {
            'type': 'training_complete',
            'all_generations': all_networks_history,
            'message': '🎉 Evolución completa! Todas las generaciones han aprendido.'
        })
        
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        try:
            await manager.send(websocket, {'type': 'error', 'message': str(e)})
        except:
            pass
        manager.disconnect(websocket)


@app.get("/")
def root():
    return {"status": "NeuralEvolution API running", "endpoints": ["/ws/train"]}

@app.get("/datasets")
def get_datasets():
    return {"datasets": list(DATASETS.keys())}
