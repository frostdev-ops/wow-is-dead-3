#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting WOWID3 Server (Backend + Frontend)${NC}"
echo ""

# Check if we're in the correct directory
if [ ! -f "server/Cargo.toml" ] || [ ! -f "web/package.json" ]; then
  echo -e "${RED}Error: This script must be run from the wowid3-server directory${NC}"
  exit 1
fi

# Install web dependencies if needed
if [ ! -d "web/node_modules" ]; then
  echo -e "${YELLOW}Installing web dependencies...${NC}"
  cd web
  npm install
  cd ..
fi

# Start backend
echo -e "${GREEN}Starting backend server...${NC}"
cd server
cargo run &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend
echo -e "${GREEN}Starting frontend dev server...${NC}"
cd web
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}Servers started!${NC}"
echo -e "Backend:  http://localhost:8080"
echo -e "Frontend: http://localhost:5173"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Wait for both processes
wait
