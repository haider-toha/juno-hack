# Task runner for the Next.js app.
SHELL := /bin/bash

.PHONY: help setup install dev build format lint typecheck clean

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: install ## Install deps and create .env from the example
	cp -n .env.example .env || true

install: ## Install dependencies (pnpm)
	pnpm install

dev: ## Run the dev server (:3000)
	pnpm dev

build: ## Production build
	pnpm build

format: ## Format (prettier)
	pnpm run format

lint: ## Lint (eslint)
	pnpm run lint

typecheck: ## Type-check (tsc)
	pnpm run typecheck

clean: ## Remove build artifacts and tool caches
	rm -rf .next *.tsbuildinfo

# --- Track B ---------------------------------------------------------------
# Appended at the end so Track A's targets and these never collide.

.PHONY: seed

seed: ## Reset the demo to a known state (dev server must be running)
	curl -fsS -X POST http://localhost:3000/api/seed && echo
