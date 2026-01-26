#!/bin/bash

# Development script - runs API and frontend together with hot reload
# Similar to "encore run" experience

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Money App - Development Environment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env with your database credentials${NC}"
    echo ""
    exit 1
fi

# Check if air is installed
if ! command -v air &> /dev/null; then
    echo -e "${YELLOW}Installing Air for hot reload...${NC}"
    go install github.com/air-verse/air@latest
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $API_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start API server with hot reload
echo -e "${GREEN}🚀 Starting API server with hot reload...${NC}"
echo -e "${BLUE}   http://localhost:4000${NC}"
air > /tmp/money-api.log 2>&1 &
API_PID=$!

# Wait a bit for API to start
sleep 2

# Start frontend dev server
if [ -d "frontend" ]; then
    echo -e "${GREEN}🎨 Starting frontend dev server...${NC}"
    echo -e "${BLUE}   http://localhost:5173${NC}"
    cd frontend
    npm run dev > /tmp/money-frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
else
    echo -e "${YELLOW}⚠️  Frontend directory not found${NC}"
fi

echo ""
echo -e "${GREEN}✓ Development environment ready!${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  API:      ${GREEN}http://localhost:4000${NC}"
echo -e "  Frontend: ${GREEN}http://localhost:5173${NC}"
echo -e "  Health:   ${GREEN}http://localhost:4000/health${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Logs:"
echo -e "  API:      tail -f /tmp/money-api.log"
echo -e "  Frontend: tail -f /tmp/money-frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script running and tail logs
tail -f /tmp/money-api.log /tmp/money-frontend.log
