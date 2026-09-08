@AGENTS.md

## Claude Code specifics

The guidance below is specific to the Claude Code harness and deliberately lives outside
`AGENTS.md`, which is kept tool-neutral.

### Branch & Worktree Strategy

Every plan that involves code changes should create a new branch using worktree support. This keeps the main working tree clean and allows parallel work streams:

- Use `EnterWorktree` to create an isolated worktree for each feature/refactor branch
- Name worktrees descriptively (e.g., `feat/pool-timeouts`, `fix/idle-leak`)
- Worktrees prevent accidental contamination between concurrent tasks

### Agent Teams

Use `TeamCreate` and agent teams for tasks with independent parallel workstreams. Prefer teams when:

- A task has 3+ independent subtasks that can execute concurrently
- Research, implementation, and verification can be split across agents
- Multiple files need changes that don't depend on each other

Match agent types to the work: `Explore` for research, `general-purpose` for implementation, `Plan` for architecture decisions. Keep the orchestrator focused on coordination and user communication.
