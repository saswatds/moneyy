# Makefile for Docker-based Money App Development
# All commands run in Docker containers - no local Go/Node installation needed
# Uses Docker Compose V2 (docker compose) - part of Docker CLI

.PHONY: help setup dev stop restart logs build migrate shell db-shell clean api-logs frontend-logs test status health

# Default target
.DEFAULT_GOAL := help

# Docker Compose command (V2)
DOCKER_COMPOSE := docker compose

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

help:
	@echo ""
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(BLUE)  Money App - Docker Development Commands$(NC)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo ""
	@echo "$(GREEN)🚀 Getting Started:$(NC)"
	@echo "  make setup        - First-time setup (create .env)"
	@echo "  make dev          - Start entire stack (database + api + frontend)"
	@echo "  make stop         - Stop all services"
	@echo ""
	@echo "$(GREEN)📊 Monitoring:$(NC)"
	@echo "  make status       - Show status of all containers"
	@echo "  make health       - Check health of all services"
	@echo "  make logs         - View logs from all services"
	@echo "  make api-logs     - View API logs only"
	@echo "  make frontend-logs- View frontend logs only"
	@echo ""
	@echo "$(GREEN)🗄️  Database:$(NC)"
	@echo "  make migrate      - Run database migrations"
	@echo "  make db-shell     - Connect to PostgreSQL (DB=<name>)"
	@echo ""
	@echo "$(GREEN)🔧 Development:$(NC)"
	@echo "  make restart      - Restart all services (keeps data)"
	@echo "  make shell        - Open shell in API container"
	@echo "  make test         - Run tests in Docker"
	@echo ""
	@echo "$(GREEN)🏗️  Build:$(NC)"
	@echo "  make build        - Build production Docker images"
	@echo ""
	@echo "$(GREEN)🧹 Cleanup:$(NC)"
	@echo "  make clean        - Stop and remove all containers + volumes"
	@echo ""
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo ""

# First-time setup
setup:
	@echo "$(BLUE)Setting up Money App development environment...$(NC)"
	@echo ""
	@echo "$(YELLOW)Checking Docker installation...$(NC)"
	@docker --version > /dev/null 2>&1 || (echo "$(RED)✗ Docker not found. Please install Docker Desktop$(NC)" && exit 1)
	@${DOCKER_COMPOSE} version > /dev/null 2>&1 || (echo "$(RED)✗ Docker Compose V2 not found. Please update Docker$(NC)" && exit 1)
	@echo "$(GREEN)✓ Docker Compose V2 installed$(NC)"
	@echo ""
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Creating .env file from template...$(NC)"; \
		cp .env.example .env; \
		echo "$(GREEN)✓ Created .env$(NC)"; \
		echo ""; \
		echo "$(YELLOW)⚠️  IMPORTANT: Edit .env and set:$(NC)"; \
		echo "  - DB_PASSWORD"; \
		echo "  - ENC_MASTER_KEY"; \
		echo ""; \
		echo "Press Enter after updating .env..."; \
		read; \
	else \
		echo "$(GREEN)✓ .env already exists$(NC)"; \
	fi
	@echo ""
	@echo "$(GREEN)✓ Setup complete! Run 'make dev' to start$(NC)"
	@echo ""

# Start entire development stack
dev:
	@echo "$(BLUE)Starting Money App development stack...$(NC)"
	@echo ""
	@${DOCKER_COMPOSE} up -d --build
	@echo ""
	@echo "$(GREEN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(GREEN)✓ Development stack is starting!$(NC)"
	@echo ""
	@echo "  🗄️  Database:  $(BLUE)localhost:5432$(NC)"
	@echo "  🚀 API:        $(BLUE)http://localhost:4000$(NC)"
	@echo "  🎨 Frontend:   $(BLUE)http://localhost:5173$(NC)"
	@echo ""
	@echo "  📊 Status:     $(YELLOW)make status$(NC)"
	@echo "  📝 Logs:       $(YELLOW)make logs$(NC)"
	@echo "  🛑 Stop:       $(YELLOW)make stop$(NC)"
	@echo "$(GREEN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo ""
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@$(MAKE) health

# Stop all services
stop:
	@echo "$(YELLOW)Stopping all services...$(NC)"
	@${DOCKER_COMPOSE} down
	@echo "$(GREEN)✓ All services stopped$(NC)"

# Restart services (preserves data)
restart:
	@echo "$(YELLOW)Restarting services...$(NC)"
	@${DOCKER_COMPOSE} restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

# View logs from all services
logs:
	@${DOCKER_COMPOSE} logs -f

# View API logs only
api-logs:
	@${DOCKER_COMPOSE} logs -f api

# View frontend logs only
frontend-logs:
	@${DOCKER_COMPOSE} logs -f frontend

# View database logs
db-logs:
	@${DOCKER_COMPOSE} logs -f postgres

# Show container status
status:
	@echo "$(BLUE)Container Status:$(NC)"
	@echo ""
	@${DOCKER_COMPOSE} ps
	@echo ""

# Health check for all services
health:
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo ""
	@printf "  Database:  "
	@${DOCKER_COMPOSE} exec -T postgres pg_isready -U postgres > /dev/null 2>&1 && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(RED)✗ Unhealthy$(NC)"
	@printf "  API:       "
	@curl -sf http://localhost:4000/health > /dev/null 2>&1 && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(YELLOW)⏳ Starting...$(NC)"
	@printf "  Frontend:  "
	@curl -sf http://localhost:5173 > /dev/null 2>&1 && echo "$(GREEN)✓ Healthy$(NC)" || echo "$(YELLOW)⏳ Starting...$(NC)"
	@echo ""

# Run migrations
migrate:
	@echo "$(BLUE)Running database migrations...$(NC)"
	@${DOCKER_COMPOSE} up migrate
	@echo "$(GREEN)✓ Migrations complete$(NC)"

# Open shell in API container
shell:
	@echo "$(BLUE)Opening shell in API container...$(NC)"
	@${DOCKER_COMPOSE} exec api sh

# Connect to database shell
db-shell:
	@if [ -z "$(DB)" ]; then \
		echo "$(YELLOW)Available databases:$(NC)"; \
		echo "  - account"; \
		echo "  - balance"; \
		echo "  - currency"; \
		echo "  - holdings"; \
		echo "  - projections"; \
		echo "  - sync"; \
		echo "  - transaction"; \
		echo ""; \
		echo "Usage: make db-shell DB=<name>"; \
		echo "Example: make db-shell DB=account"; \
		exit 1; \
	fi
	@echo "$(BLUE)Connecting to $(DB) database...$(NC)"
	@${DOCKER_COMPOSE} exec postgres psql -U postgres -d $(DB)

# Run tests in Docker
test:
	@echo "$(BLUE)Running tests in Docker...$(NC)"
	@${DOCKER_COMPOSE} exec api go test -v ./...

# Build production images
build:
	@echo "$(BLUE)Building production Docker images...$(NC)"
	@${DOCKER_COMPOSE} -f ${DOCKER_COMPOSE}.prod.yml build
	@echo "$(GREEN)✓ Production images built$(NC)"

# Clean everything (stops containers and removes volumes)
clean:
	@echo "$(RED)⚠️  This will remove all containers, volumes, and data!$(NC)"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read
	@echo "$(YELLOW)Cleaning up...$(NC)"
	@${DOCKER_COMPOSE} down -v
	@docker volume prune -f
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

# Rebuild from scratch
rebuild:
	@echo "$(YELLOW)Rebuilding from scratch...$(NC)"
	@${DOCKER_COMPOSE} down -v
	@${DOCKER_COMPOSE} build --no-cache
	@${DOCKER_COMPOSE} up -d
	@echo "$(GREEN)✓ Rebuild complete$(NC)"

# Quick access to specific services
api:
	@${DOCKER_COMPOSE} up -d api
	@echo "$(GREEN)✓ API started at http://localhost:4000$(NC)"

frontend:
	@${DOCKER_COMPOSE} up -d frontend
	@echo "$(GREEN)✓ Frontend started at http://localhost:5173$(NC)"

db:
	@${DOCKER_COMPOSE} up -d postgres
	@echo "$(GREEN)✓ Database started at localhost:5432$(NC)"

# Backup database
backup:
	@echo "$(BLUE)Creating database backup...$(NC)"
	@mkdir -p backups
	@${DOCKER_COMPOSE} exec -T postgres pg_dumpall -U postgres > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Backup created in backups/$(NC)"

# Restore database (usage: make restore FILE=backups/backup_20240125_120000.sql)
restore:
	@if [ -z "$(FILE)" ]; then \
		echo "$(YELLOW)Usage: make restore FILE=<backup-file>$(NC)"; \
		ls -1 backups/ 2>/dev/null || echo "No backups found"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Restoring from $(FILE)...$(NC)"
	@cat $(FILE) | ${DOCKER_COMPOSE} exec -T postgres psql -U postgres
	@echo "$(GREEN)✓ Database restored$(NC)"
