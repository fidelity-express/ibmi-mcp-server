# Repository Guidelines

## Project Overview

IBM i MCP Server monorepo — an npm workspaces repo that ships two published packages:

- **`@ibm/ibmi-mcp-server`** (`packages/server/`) — MCP server binary (`ibmi-mcp-server`). Production-grade MCP server enabling AI agents to interact with IBM i via Db2 for i. Uses Mapepire (WebSocket-based SQL gateway).
- **`@ibm/ibmi-cli`** (`packages/cli/`) — the `ibmi` command-line interface. Depends on `@ibm/ibmi-mcp-server` (exact-pinned) and calls its tool logic directly for fast local execution without MCP protocol overhead.

Both packages co-version: a single `v*` git tag releases both with the same version.

## Common Commands

All commands run from the repo root (npm workspaces handle the dispatch):

```bash
# Build
npm run build              # Compile TypeScript to dist/
npm run rebuild            # Clean and rebuild

# Test
npm test                   # Run all tests (Vitest)
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report

# Quality
npm run lint               # ESLint
npm run typecheck          # TypeScript type checking
npm run format             # Prettier formatting
npm run validate           # Validate YAML tool configurations

# Run
npm run start:http         # HTTP transport (port 3010, recommended for dev)
npm run start:stdio        # Stdio transport (for MCP Inspector)
npm run inspector          # Launch MCP Inspector UI

# YAML Tools
npm run list-toolsets                       # List available toolsets
npm run validate                            # Validate tool YAML files

# Release
npm run release:patch      # Patch version bump
npm run release:minor      # Minor version bump
```

### Run the server with npx

```bash
npx -y @ibm/ibmi-mcp-server@latest --transport http --tools /path/to/tools.yaml
```

## Architecture

### Core Pattern: "Logic Throws, Handler Catches"

Every tool follows strict two-file separation:

- **`logic.ts`** - Pure business logic. Throws `McpError` on failure. No try/catch for response formatting.
- **`registration.ts`** - Handler layer. Wraps logic in try/catch, formats responses via `ErrorHandler`.

```
packages/
├── server/                         # @ibm/ibmi-mcp-server
│   ├── src/
│   │   ├── index.ts                # MCP server entry (ibmi-mcp-server bin)
│   │   ├── public/                 # Barrel re-exports consumed by @ibm/ibmi-cli
│   │   │   ├── tools.ts            # executeSqlTool, generateSqlTool, *Logic fns
│   │   │   ├── services.ts         # IBMiConnectionPool, SourceManager, etc.
│   │   │   ├── context.ts          # requestContextService
│   │   │   └── formatting.ts       # tableFormatter
│   │   ├── mcp-server/             # McpServer init, transports
│   │   ├── ibmi-mcp-server/        # Tools, services, security
│   │   ├── utils/                  # telemetry, logger, formatting
│   │   └── types-global/           # McpError, JsonRpcErrorCode
│   └── tests/
└── cli/                            # @ibm/ibmi-cli
    ├── src/
    │   ├── index.ts                # CLI entry (ibmi bin)
    │   ├── commands/               # 13 commands
    │   ├── config/                 # ~/.ibmi/config.yaml loader
    │   ├── formatters/
    │   └── utils/
    └── tests/
```

CLI imports server internals via the `exports` subpath surface:
`@ibm/ibmi-mcp-server/tools`, `/services`, `/context`, `/formatting`.

### YAML-Driven SQL Tools

SQL tools are defined declaratively in `tools/*.yaml`:

```yaml
sources:
  ibmi-system:
    host: ${DB2i_HOST}
    user: ${DB2i_USER}
    password: ${DB2i_PASS}
    port: 8076

tools:
  tool_name:
    source: ibmi-system
    description: "LLM-facing description"
    statement: |
      SELECT ... FROM ... WHERE :param_name ...
    parameters:
      - name: param_name
        type: string
        required: true
        description: "Parameter description"
    annotations:
      readOnlyHint: true

toolsets:
  toolset_name:
    tools: [tool_name]
```

Load tools via `--tools ./tools/file.yaml` and select toolsets via `--toolsets toolset_name`.

### Key Services

- **SourceManager** (`services/SourceManager.ts`) - Mapepire connection pooling
- **SqlSecurityValidator** (`services/SqlSecurityValidator.ts`) - Enforces read-only queries by default
- **ToolProcessor** (`utils/ToolProcessor.ts`) - YAML tool hydration and registration

### Request Context & Logging

All operations use `RequestContext` for traceability:
```typescript
const context = requestContextService.createRequestContext({
  operation: "ToolExecution",
  toolName: "execute_sql",
});
logger.info("Executing query", context);
```

## Tool Development

### TypeScript Tools

Follow the echoTool pattern in `src/mcp-server/tools/echoTool/`:

1. **logic.ts**: Define Zod schemas, export logic function that throws on error
2. **registration.ts**: Register with server, wrap logic in try/catch
3. **index.ts**: Barrel export of registration function

### YAML SQL Tools

1. Add tool definition to appropriate `tools/*.yaml` file
2. Use parameter binding (`:param_name`) - never string interpolation
3. Include `FETCH FIRST N ROWS ONLY` for result limiting
4. Set `readOnlyHint: true` for SELECT queries
5. Run `npm run validate` to check syntax

## Testing

- Framework: Vitest
- Location: `packages/server/tests/` and `packages/cli/tests/` (each mirrors its `src/` structure)
- Prefer integration tests over mocked unit tests
- Use `@anatine/zod-mock` for test data generation

Run a single test file:
```bash
npm test -- tests/path/to/test.test.ts
```

## Environment Variables

Key variables (set in `.env` or environment):

| Variable | Description |
|----------|-------------|
| `DB2i_HOST` | IBM i hostname |
| `DB2i_USER` | Database user |
| `DB2i_PASS` | Database password |
| `MCP_TRANSPORT_TYPE` | `stdio` or `http` |
| `MCP_LOG_LEVEL` | `debug`, `info`, `warn`, `error` |
| `IBMI_HTTP_AUTH_ENABLED` | Enable bearer token auth |

## Code Style

- Two-space indentation (Prettier enforced)
- camelCase for functions/variables
- PascalCase for classes/types
- SCREAMING_SNAKE_CASE for constants
- snake_case for tool names in YAML

## GitHub CLI

Always use `--repo IBM/ibmi-mcp-server` for all `gh` commands (issues, PRs, releases, etc.). The repo has multiple remotes and `gh` will fail without explicit repo targeting.

```bash
gh issue view 111 --repo IBM/ibmi-mcp-server
gh pr create --repo IBM/ibmi-mcp-server --head my-branch --base main --title "..."
```

## Git Commit Requirements

All commits MUST include a DCO sign-off. Always pass `-s` to `git commit`.

## Key Conventions

- Use Zod schemas for all input validation
- LLM-facing descriptions (in `.describe()`) must be clear and actionable
- Environment variables via `dotenv` - never hardcode credentials
- Structured logging with Pino - always include RequestContext
- Error responses use `McpError` with appropriate `JsonRpcErrorCode`

## Python Agents

Example agents in `agents/` and `client/` directories use Python with `uv`:

```bash
cd client
uv sync
uv run python agent.py
```

These are consumers of the MCP server, not part of the core TypeScript codebase.

## Related Documentation

- `packages/server/README.md` - Comprehensive server documentation
- `packages/cli/README.md` - CLI usage guide
- `tools/README.md` - YAML tool configuration guide

## Upstream notes (IBM/ibmi-mcp-server)

This repo is Fidelity Express' fork of IBM's `ibmi-mcp-server`. The block below is
upstream's own `AGENTS.md`, kept here so a future upstream pull conflicts only inside
this section. Every heading is demoted one level; the text is otherwise unchanged.

### Mission & Outcomes

This project exists to make it easy to build MCP tools and agents for IBM i systems. Prioritize ergonomics, observability, and safe Db2 for i defaults. Every change should simplify tool creation, expand IBM i coverage, or harden reliability for downstream agent builders.

### Architecture & Modules

npm workspaces monorepo. Two published packages:

- `@ibm/ibmi-mcp-server` (`packages/server/`) — MCP server runtime. Bootstraps from `packages/server/src/index.ts`, wiring the core server in `packages/server/src/mcp-server/server.ts` and IBM i extensions in `packages/server/src/ibmi-mcp-server/`. Transports live in `packages/server/src/mcp-server/transports/` (stdio plus streamable HTTP via Hono). Each tool follows the mandate: pure logic in `logic.ts`, registration and error handling in `registration.ts`. YAML-driven data access flows through `packages/server/src/ibmi-mcp-server/services/` where `SourceManager` builds Mapepire pools and `SqlSecurityValidator` enforces read-only guardrails. Observability is centralized in `packages/server/src/utils/telemetry/` and context-aware logging helpers under `packages/server/src/utils/internal/`. A public `exports` surface lives at `packages/server/src/public/` (`tools`, `services`, `context`, `formatting`) and is the stable contract consumed by the CLI.
- `@ibm/ibmi-cli` (`packages/cli/`) — the `ibmi` command-line interface. Depends on `@ibm/ibmi-mcp-server` at an exact-pinned version, imports tool logic via the `@ibm/ibmi-mcp-server/{tools,services,context,formatting}` subpaths, and invokes `.logic()` directly (no MCP protocol overhead for local use).

Both packages co-version: a single `v*` git tag releases a matched pair. See [RELEASING.md](./RELEASING.md).

### SQL Tooling Workflow

Declare SQL tools in YAML under `tools/` (`performance.yaml`, `sys-admin.yaml`) with `sources`, `tools`, and `toolsets`. The server hydrates them via `TOOLS_YAML_PATH`, validates queries, and loads requested toolsets (`--toolsets`). Prefer YAML statements for standard IBM i services like `QSYS2.SYSTEM_STATUS`; use dynamic `executeSql` only when strictly necessary and document it. Mirror new toolsets in `docs/` and seed mocks in `packages/server/tests/fixtures/`.

### Authentication & Security

Optional IBM i HTTP auth issues bearer tokens at `/api/v1/auth` when `IBMI_HTTP_AUTH_ENABLED=true`, creating per-token pools governed by `IBMI_AUTH_TOKEN_EXPIRY_SECONDS`. Development may enable plain HTTP (`IBMI_AUTH_ALLOW_HTTP=true`), but production paths must describe TLS, pool cleanup, and secret handling. Never commit credentials; keep `.env` local and validate schema changes with `npm run validate`.

### Testing & Quality

Vitest drives validation. Run `npm run test` at repo root (delegates to both workspaces via `--workspaces --if-present`) for fast feedback, `npm run test:coverage` before merging, and `npm run lint`/`npm run format` to uphold Prettier + ESLint defaults (two-space indentation, camelCase identifiers, PascalCase classes, SCREAMING_SNAKE constants). Server suites live under `packages/server/tests/mcp-server/` or service directories; CLI suites under `packages/cli/tests/`. Ensure integration specs cover logic/registration separation plus SQL security checks.

### Agents & Toolsets

Example agents live in `packages/server/tests/agents/` with a uv-based Python harness (`agent.py`) plus scripts for tool annotations and resource discovery. Keep these examples aligned with shipped YAML toolsets, document workflows in `agent.md`, and provide prompts when introducing new capabilities.

### Contribution Flow

Commits generally follow conventional prefixes (`feat:`, `fix:`, `chore:`) or scoped `Feat/topic`. Keep changes small, reference affected toolsets or auth flags in messages, and list validation commands in PR descriptions. Always confirm `npm run build` before review and highlight impacts to security posture or IBM i connectivity.
