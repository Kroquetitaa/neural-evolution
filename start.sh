#!/bin/bash
# NeuralEvolution — Script de inicio

echo "╔═══════════════════════════════════════╗"
echo "║       NeuralEvolution v1.0            ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# Instalar dependencias del backend
echo "📦 Instalando dependencias del backend..."
cd backend
pip install -r requirements.txt --break-system-packages -q
echo "✅ Backend listo"

# Iniciar backend en background
echo "🚀 Iniciando backend (puerto 8000)..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

sleep 2

# Instalar y arrancar frontend
echo ""
echo "📦 Instalando dependencias del frontend..."
cd ../frontend
npm install --silent
echo "✅ Frontend listo"

echo ""
echo "🌐 Iniciando frontend (puerto 5173)..."
echo ""
echo "═══════════════════════════════════════"
echo "  🖥  App:     http://localhost:5173"
echo "  ⚡  API:     http://localhost:8000"
echo "  📡  WS:      ws://localhost:8000/ws/train"
echo "═══════════════════════════════════════"
echo ""

npm run dev

# Cleanup al salir
kill $BACKEND_PID 2>/dev/null
