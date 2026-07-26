# Task runner for the Next.js app.
SHELL := /bin/bash

.PHONY: help setup install dev build format lint typecheck clean eval e2e seed \
        operator ring unring clock miss clear-letter arc

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

eval: ## Score extraction against the medic's gold labels (needs `make dev`)
	node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/eval-extraction.ts

e2e: ## Drive the demo arc in a real browser (needs a running app)
	node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/e2e-demo.ts

seed: ## Reset the demo to a known state (dev server must be running)
	curl -fsS -X POST http://localhost:3000/api/seed && echo

# Headless forms of the operator panel's buttons. The panel is the interface on
# the night; these exist so the arc can be rehearsed or scripted without one.

operator: ## Open the operator control panel
	open http://localhost:3000/operator

ring: ## Raise the incoming check-in on the phone
	curl -fsS -X POST http://localhost:3000/api/demo/check-in && echo

unring: ## Cancel the raised check-in
	curl -fsS -X DELETE http://localhost:3000/api/demo/check-in && echo

clock: ## Move the demo clock (DAY=2026-07-28, or SHIFT=1)
	@if [ -n "$(DAY)" ]; then BODY='{"day":"$(DAY)"}'; else BODY='{"shiftDays":$(or $(SHIFT),1)}'; fi; \
	curl -fsS -X POST http://localhost:3000/api/demo/clock \
		-H 'content-type: application/json' -d "$$BODY" && echo

miss: ## Record a missed step (ITEM=med-apixaban, DAY=2026-07-26)
	curl -fsS -X POST http://localhost:3000/api/demo/log \
		-H 'content-type: application/json' \
		-d '{"itemId":"$(or $(ITEM),med-apixaban)","day":$(if $(DAY),"$(DAY)",null),"status":"missed"}' && echo

# Run `seed` then this to open a take on an empty account: the plan goes, the
# primed misses and the clock stay, and the letter is photographed on camera.
clear-letter: ## Delete the stored plan, keeping the log and the clock
	curl -fsS -X DELETE http://localhost:3000/api/demo/plan && echo

arc: ## Drive the whole demo arc over HTTP and assert each beat
	bash scripts/demo-arc.sh
