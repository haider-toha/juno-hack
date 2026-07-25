---
name: haider-building-clis
description: Building Node CLIs – command surface design, commander structure, clack interaction, exit codes, non-interactive flags, config parsing, and publish/verification habits. Use when building, restructuring, or publishing a CLI, adding commands or flags, or deciding how a CLI should store state or distribute itself.
---

# Building CLIs

Defaults for this skill: commander, @clack/prompts, picocolors, tsup, vitest, ESM, Node 20+, strict TypeScript (also listed in [haider-engineering-defaults](../haider-engineering-defaults/SKILL.md)).

## Structure

- A `createCli(): Command` factory in `cli.ts`; the bin entry (`index.ts`) stays under 25 lines: shebang, an `uncaughtException` guard, `createCli().parseAsync().catch(...)`.
- The guard turns prompt-cancellation errors (`ExitPromptError`) into a clean `process.exit(130)`; everything else prints one red line to stderr and exits 1. Never dump a stack trace at a user.
- One module per command in `commands/<name>.ts`, exporting a plain function `(ctx, args, options)`. The factory only wires commander to those functions – no logic in `.action()` bodies beyond the call.
- Shared runtime state (repo root, content store, version) lives in a `CliContext` built by one `createContext()` function, resolved lazily inside each action so global options like `--root` are respected.
- Read the version from `package.json` via `createRequire(import.meta.url)` – never hardcode it.
- Cross-cutting behaviour (update banners, notices, telemetry) goes in a commander `postAction` hook – and it must skip any long-lived command whose stdout is a protocol channel (an MCP server, a watch mode).

## Command surface

- Nouns group, verbs act: e.g. `widgets list`, `widgets validate`, `config export`. Top-level verbs only for whole-project actions (`deploy`, `init`, `status`, `validate`). Treat product-specific verb names as illustrations, not a fixed vocabulary.
- A command says what it means. `status` reports installed or runtime state; `validate` checks integrity; `deploy --check` is the CI gate. Do not overload one verb with modes that change its meaning.
- Every interactive prompt has a flag equivalent so everything runs non-interactively: `--yes` for confirmations, explicit arguments for selections. CI uses flags, humans get prompts.
- Standard flags, same meaning everywhere: `--check` (report and exit non-zero, write nothing), `--yes` (skip confirmations), `--force` (overwrite), `--project <dir>` / `--global` (targeting), `--format json` (machine output), `-o/--out` (write to file instead of stdout).
- Exit codes: 0 success, 1 failure or findings (a linter with findings fails), 130 user cancelled. Set `process.exitCode`, do not call `process.exit()` mid-command.
- Data to stdout, feedback to stderr-adjacent colour: findings tables and exports are stdout (pipeable); status lines use picocolors – green ok, yellow warning, red error, dim hints.

## Interaction

- @clack/prompts only, and only when a flag has not already answered the question: `confirm` + `isCancel`, treat cancel as a no-op with a dim "Cancelled." – never as an error.
- Print what will happen before asking to do it (plan-then-confirm: print the plan, then ask about overwrites).
- After acting, say what happened in one line with a count: `Deployed 12 file(s) → <target>`. List kept or skipped files explicitly.

## State, config, migrations

- Per-project install or tool state in a project-root config file of your choosing: zod schema in core (`config/schema.ts` + `io.ts`), written on change with the CLI version, timestamp, and relevant payload. `parse`, never cast.
- A home-directory registry of projects the CLI has touched can be useful for multi-target commands – auto-populated on install, pruned when directories disappear.
- **Migrations (when the CLI installs into projects):** an ordered list keyed by version, each a transform over an installed project. Run entries newer than the project's recorded version, then stamp the new version even when nothing else changed. A release that changes installed artifacts should ship a migration.

## Publishing

Use whatever registry fits the project. GitHub Packages is one option, not the only one:

- Scope the package to the registry owner; the bin name is the brand and need not match the package name.
- The package carries code only. Bundle unpublishable workspace deps into `dist/` with tsup `noExternal: [/^@scope\//]` and promote their runtime deps into `dependencies`. Content resolves at runtime (env var → cwd walk-up → known fallback paths).
- Set `publishConfig`, `repository` (with `directory` if monorepo), `files: ["dist"]`, and `engines`.
- Publish from a tag-driven CI workflow. Guard three ways: the tag must equal the package version, build and tests must pass, and the built binary's `--version` must report the tagged version.
- Before the first publish, verify installability offline: `npm pack`, install the tarball globally into a scratch prefix, run the full command surface.

## Verification habits

- Drive every command end to end in a temp directory after building – including the failure paths (missing config, drifted files, wrong flag).
- Sandbox anything that touches the home directory by running the test with `HOME=$(mktemp -d)`.
- Prefer CI that dogfoods the CLI against the repo on every push.
