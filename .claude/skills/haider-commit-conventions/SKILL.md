---
name: haider-commit-conventions
description: Full-stack Conventional Commits for Haider projects. Use when writing commits or configuring commitlint – frontend, backend, firmware, tooling, anything.
---

# Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): subject`.

- Imperative subject, lower-case start, under ~70 characters
- Body (optional): British English, spaced en-dashes, no ampersands or emojis
- Scope is optional but preferred when it clarifies the area of the change

Same types for API work, UI work, data, infra, and tooling. Put the layer in the **scope**, not in a custom type.

## Types

| Type       | Use when                                                         |
| ---------- | ---------------------------------------------------------------- |
| `feat`     | New user-facing or caller-facing capability                      |
| `fix`      | Something was broken or wrong                                    |
| `refactor` | Internal change with no intended behaviour change                |
| `perf`     | Measurable performance improvement                               |
| `style`    | Formatting / lint-only – invisible to users and callers          |
| `docs`     | Documentation only                                               |
| `test`     | Tests only                                                       |
| `build`    | Build system, bundler, dependencies that affect build            |
| `ci`       | CI config and pipelines                                          |
| `chore`    | Maintenance that does not fit above (repo hygiene, bump scripts) |

## Scopes

Pick a short scope that names the surface. Match the project; examples:

| Layer             | Example scopes                         |
| ----------------- | -------------------------------------- |
| Frontend          | `ui`, `app`, `capture`, `relay-client` |
| Backend / API     | `api`, `auth`, `worker`, `queue`       |
| Data              | `db`, `schema`, `migration`            |
| Device / firmware | `firmware`, `tof`, `mic`               |
| Tooling           | `cli`, `mcp`, `ci`                     |

```
feat(api): accept activity heartbeat without bumping command seq
fix(relay): stop replaying suppressed bus commands after still
feat(ui): show route-88 confirmation on arrival
refactor(firmware): isolate siren path from wifi poll loop
perf(api): cache pull payload serialization
chore(ci): run native firmware tests on pr
```

## Litmus tests

| Question                                  | Type       |
| ----------------------------------------- | ---------- |
| Was something broken or incorrect?        | `fix`      |
| Can a caller or user do something new?    | `feat`     |
| Same behaviour, clearer/safer structure?  | `refactor` |
| Faster with evidence or a clear hot path? | `perf`     |
| Only Prettier / import order / lint?      | `style`    |

Polish that improves an already-working surface is usually `refactor`, or `feat` if the improvement is user-visible.

## Reviewer note

Judge `feat` / `fix` on behaviour and correctness. Judge `refactor` / `perf` on whether the claim holds. Keep real fixes as `fix`, not `refactor` or `chore`.
