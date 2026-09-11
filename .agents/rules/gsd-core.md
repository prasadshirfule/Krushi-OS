# ⚡ KRUSHI OS — Operational GSD Rules

These rules govern execution, context efficiency, and safe development in this repository.

---

### 1. Context Efficiency & State Anchoring
- **Read State First**: Before beginning substantial feature or refactoring work, read [.gsd/STATE.md](file:///e:/antigravity/scratch/krushi-os/.gsd/STATE.md) to anchor context without rescanning the full codebase.
- **Search-First Inspection**: Use targeted searches (`grep_search` with specific `Includes` filters) rather than listing wide directories or dumping recursive trees.
- **Do Not Dump Entire Trees**: Never run recursive full-directory dumps or generate massive file-tree context dumps (such as `structure.txt`).
- **Targeted File Reading**: View only the specific files and line ranges relevant to the active task (`view_file` with `StartLine`/`EndLine`).
- **Authoritative Docs**: Consult [docs/architecture.md](file:///e:/antigravity/scratch/krushi-os/docs/architecture.md), [docs/database.md](file:///e:/antigravity/scratch/krushi-os/docs/database.md), and [docs/api.md](file:///e:/antigravity/scratch/krushi-os/docs/api.md) for architectural and schema details instead of re-deriving them.

### 2. Task Sizing & Subagent Delegation
- **Trivial / Small Fixes**: (UI styling, typos, single component adjustments) Execute directly in the primary context without creating subagent or planning overhead.
- **Substantial / Complex Work**: Use structured workflows (Plan &rarr; Execute &rarr; Verify).
- **Subagent Usage**: Spawn child subagents only when there is clear benefit (e.g. isolated deep research, multi-file log analysis, heavy parallel verification) to keep the primary conversation context clean.

### 3. Empirical Verification Gate
- **Never Claim Success Without Evidence**: Every code change must be validated against concrete verification commands before marking complete.
- **Verification Commands**:
  - Run `npx tsc --noEmit` to verify type safety.
  - Run targeted Vitest unit tests in `__tests__/` when modifying business logic or services.
  - Run `npm run build` for structural, routing, or SSR changes.
- If verification reveals errors, address them immediately before concluding the turn.

### 4. Git Safety & Working-Tree Protection
- **Protect Unrelated Work**: Check `git status` before touching files. Never modify, discard, stage, or commit unrelated working-tree changes.
- **No Blind Operations**: Never blindly stage all files (`git add .` / `git commit -a`). Stage only specifically edited files.
- **Explicit Push**: Never push to remote branches without explicit user instruction.

### 5. State Maintenance
- **Update State on Completion**: After completing meaningful architectural changes, new migrations, or major features, update [.gsd/STATE.md](file:///e:/antigravity/scratch/krushi-os/.gsd/STATE.md) and [.gsd/ROADMAP.md](file:///e:/antigravity/scratch/krushi-os/.gsd/ROADMAP.md) to keep the persistent state accurate.
- **Keep State Compact**: Keep `.gsd/STATE.md` concise (~50–100 lines) to minimize token consumption on future read operations.
