# Makefile for Moneyy App
.PHONY: help dev stop logs clean build

.DEFAULT_GOAL := help

DOCKER_COMPOSE := docker compose
REGISTRY := ghcr.io
REGISTRY_USER := saswatds
IMAGE := $(REGISTRY)/$(REGISTRY_USER)/moneyy
VERSION ?= latest

help:
	@echo "Moneyy App - Development Commands"
	@echo ""
	@echo "  make dev     - Start development stack"
	@echo "  make stop    - Stop all services"
	@echo "  make logs    - View logs"
	@echo "  make clean   - Remove all containers and volumes"
	@echo "  make build   - Build production image"
	@echo ""

dev:
	@${DOCKER_COMPOSE} up -d --build
	@echo "✓ Services starting..."
	@echo "  API:      http://localhost:4000"
	@echo "  Frontend: http://localhost:5173"

stop:
	@${DOCKER_COMPOSE} down

logs:
	@${DOCKER_COMPOSE} logs -f

clean:
	@${DOCKER_COMPOSE} down -v
	@docker volume prune -f

build:
	@docker build -t $(IMAGE):$(VERSION) -t $(IMAGE):latest .
