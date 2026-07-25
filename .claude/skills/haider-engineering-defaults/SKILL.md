---
name: haider-engineering-defaults
description: Haider's full-stack engineering defaults — Next.js/TypeScript/React, Python, Postgres, and AWS. Use when scaffolding, choosing libraries, APIs, data access, cloud layout, or toolchain questions.
---

# Engineering defaults

Stack shape: **Next.js + TypeScript + React** for the web app, **Python** for services/APIs, **Postgres** for data, **AWS** for cloud. Deviate only when the project demands it, and say so when deviating.

Cross-links: [haider-commit-conventions](../haider-commit-conventions/SKILL.md) · [haider-building-clis](../haider-building-clis/SKILL.md) · [haider-building-mcp-servers](../haider-building-mcp-servers/SKILL.md) · [haider-design-taste](../haider-design-taste/SKILL.md) · [haider-ui-components](../haider-ui-components/SKILL.md).

## HARD (every layer)

| Area          | Default                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript    | Strict. Never `any`. Prefer `unknown` then narrow.                                                                                                                                    |
| Python typing | Type hints on public functions and API models. Prefer `mypy`/`pyright`-clean code over untyped glue.                                                                                  |
| Boundaries    | Validate at the edge (HTTP, queue, webhook, device poll) with schemas – zod on TS, Pydantic on Python. Trust nothing crossing a process boundary.                                     |
| Secrets       | No long-lived credentials in source or casual env dumps. Prefer short-lived auth (IAM roles, OIDC) and a secrets store. Fail closed if a required secret is missing – name which one. |
| Errors        | Structured, actionable errors at boundaries. Don't swallow exceptions into generic 500s without a code/path.                                                                          |
| Deviations    | Announce them when choosing something else.                                                                                                                                           |
| Commits       | Conventional Commits – see [haider-commit-conventions](../haider-commit-conventions/SKILL.md).                                                                                        |

## Web: Next.js + TypeScript + React

| Area                   | Default                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework              | Next.js App Router, TypeScript, React, Tailwind                                                                                                        |
| Rendering              | Server Components by default. `"use client"` only for interactive leaves (state, effects, browser APIs).                                               |
| Data on the server     | Fetch in Server Components / server actions / route handlers. Parallelise independent work with `Promise.all`.                                         |
| Mutations              | Prefer server actions (or route handlers) with input typed as `unknown` then schema-parsed before use.                                                 |
| Params                 | In current Next, `params` and `searchParams` are async – `await` them. Type the promises; don't pretend they're plain objects.                         |
| Client server-state    | TanStack Query when the client truly owns live/interactive data. Don't mirror the whole server into client fetch by default.                           |
| Server-only modules    | Mark DB clients, secret loaders, and privileged helpers with `server-only` so they can't leak into the client bundle.                                  |
| Interactive primitives | Base UI for new interactive components – see [haider-ui-components](../haider-ui-components/SKILL.md).                                                 |
| Icons                  | One set per project – prefer Radix Icons; Lucide only outside that register. Decorative spam → [haider-design-taste](../haider-design-taste/SKILL.md). |

**Anti-slop:** don't `"use client"` the whole tree; don't `fetch` in `useEffect` what a Server Component already can load; don't ship unvalidated `formData` / JSON into mutations; don't import server secrets into client files.

## Backend: Python + APIs

| Area                    | Default                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| HTTP API                | FastAPI for new Python services                                                                                        |
| Request/response models | Pydantic models at the boundary; keep domain logic free of raw `dict` soup                                             |
| Async                   | `async` end-to-end for I/O. Don't call blocking DB/HTTP drivers inside `async def` routes.                             |
| App lifecycle           | Create engines/pools/clients once at startup (lifespan); tear down on shutdown. No per-request engine construction.    |
| In-app Next routes      | Use Next route handlers / server actions when the endpoint belongs to the web app and doesn't need a separate service. |
| Jobs / workers          | Explicit queues or scheduled tasks (don't fake background work with fire-and-forget request handlers).                 |

**Anti-slop:** don't paste sync SQLAlchemy/`requests` into async handlers; don't `create_engine` inside the request path; don't return untyped `dict` from every endpoint "for speed."

## Data: Postgres

| Area            | Default                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database        | Postgres (RDS/Aurora on AWS when hosted)                                                                                                                         |
| Access (Python) | SQLAlchemy 2.x async + `asyncpg` (or an equivalent async stack the project already uses). Sessions via dependency/injection; close cleanly.                      |
| Access (TS)     | A small typed query layer or ORM the project already chose – keep queries in server-only modules.                                                                |
| Migrations      | Versioned migrations (Alembic on Python, or the project's TS migrator). Migrations run as their own step – not ad hoc `CREATE TABLE` in app boot for production. |
| Pooling         | One pool per process, sized for the deployment shape. `pool_pre_ping` / recycle so stale connections die quietly.                                                |
| Writes          | Explicit transactions for multi-step writes. Be clear about idempotency and races (unique constraints, compare-and-set, row locks).                              |

**Anti-slop:** don't open a new DB connection per serverless invocation without a pool/proxy strategy; don't put business rules only in the frontend; don't use string-concatenated SQL with user input.

## Cloud: AWS

| Area                  | Default                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compute               | Match the workload – container service or Lambda for APIs/workers; Next may ship on Vercel or AWS. Say which.                                            |
| Data plane            | Postgres on RDS or Aurora. Private network access from compute (VPC), not a wide-open public DB.                                                         |
| Serverless + Postgres | Prefer **RDS Proxy** (or an equivalent pooler) in front of Postgres when many short-lived workers hit the DB. Reuse connections across warm invocations. |
| Auth to AWS / DB      | IAM roles for compute. Prefer IAM DB auth or Secrets Manager–backed credentials over baked-in passwords. Least privilege on every role.                  |
| Secrets               | Secrets Manager (or SSM Parameter Store for non-DB config). Rotate; never commit.                                                                        |
| Observability         | Structured logs, request ids, and basic health checks (including a cheap DB ping where it matters).                                                      |
| Infra as code         | Prefer CDK, Terraform, or the project's existing IaC – no click-ops snowflakes for prod paths.                                                           |

**Anti-slop:** don't give every Lambda `*` IAM; don't stick DB passwords in plain Lambda env as the long-term design; don't ignore connection storms from fan-out serverless; don't open security groups to `0.0.0.0/0` "just for debug" and leave them.

## SOFT toolchain

| Area                 | Preference                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| JS package manager   | pnpm                                                                                                                             |
| Python env           | Poetry – one env per repo, locked deps (`poetry.lock`)                                                                           |
| JS test / build libs | vitest for unit; tsup when bundling libraries/CLIs; Node 20+                                                                     |
| Python test          | pytest                                                                                                                           |
| CLI / MCP craft      | [haider-building-clis](../haider-building-clis/SKILL.md), [haider-building-mcp-servers](../haider-building-mcp-servers/SKILL.md) |
