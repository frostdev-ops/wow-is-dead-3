#!/bin/bash

# Start script for wowid3-server (backend + frontend)

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting wowid3-server manager...${NC}"
echo ""

# Check if .env exists in server directory
if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}Warning: server/.env not found. Creating from .env.example...${NC}"
    if [ -f "server/.env.example" ]; then
        cp server/.env.example server/.env
        echo -e "${GREEN}Created server/.env${NC}"
    else
        echo -e "${YELLOW}Warning: server/.env.example not found either. Using defaults.${NC}"
    fi
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${GREEN}[1/2] Starting Rust backend server...${NC}"
cd server
cargo run > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo -e "${BLUE}Waiting for backend to start...${NC}"
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${YELLOW}Backend failed to start. Check backend.log for details.${NC}"
    exit 1
fi

echo -e "${GREEN}Backend is running (PID: $BACKEND_PID)${NC}"
echo ""

# Start frontend
echo -e "${GREEN}[2/2] Starting React frontend dev server...${NC}"
cd web

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Server Manager is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Backend API:  ${BLUE}http://localhost:8080${NC}"
echo -e "Frontend UI:  ${BLUE}http://localhost:5173${NC}"
echo ""
echo -e "Backend logs:  backend.log"
echo -e "Frontend logs: frontend.log"
echo ""
echo -e "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

