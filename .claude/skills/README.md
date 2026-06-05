# TSCN Previewer Skills

Skills for the TextScene Inspector monorepo. Checked into the repo so they are
available in every environment (CLI, desktop, and Claude web).

## Skills

### textscene-dev
**Full-stack TypeScript development across the entire monorepo.**

Covers all implementation work including:
- Core library development (tscn-renderer package)
- VS Code extension features
- Web previewer development
- Feature implementation, debugging, and integration
- Node type implementations using vertical slicing pattern
- Testing and validation workflows

**When to use:**
- Implementing new features or node types
- Debugging rendering or parsing issues
- Refactoring existing code
- Adding utilities or shared functionality
- Any TypeScript development work

### e2e-testing
**End-to-end browser automation testing and validation.**

Specialized workflow for:
- Running E2E tests with Chrome DevTools MCP
- Visual regression testing
- Build integration validation
- Testing web previewer and VS Code extension

**When to use:**
- Running comprehensive test suites
- Validating features in browser
- Investigating test failures
- Creating test plans for features

### team-orchestration
**Patterns for running a team of long-lived agent teammates** on multi-WI
implementation goals with parallel work and cross-cutting verification.

### grill-with-docs
**Plan stress-testing against the domain model.** Challenges a plan against
CONTEXT.md vocabulary and docs/adr/ decisions, sharpening terminology and
updating the docs inline as decisions crystallise. Bundles the CONTEXT.md and
ADR format references used by the other doc-driven skills.

**When to use:** before committing to a design — "stress-test this plan",
"grill me on this against our docs".

### improve-codebase-architecture
**Architecture review for deepening opportunities.** Explores the codebase for
shallow modules and misplaced seams (informed by CONTEXT.md + ADRs), presents
candidates as a visual HTML report, then drops into a grilling loop on the
chosen candidate.

**When to use:** "find refactoring opportunities", periodic architecture
passes, pre-merge reviews of large branches.

### to-prd
**Conversation context → PRD on the issue tracker.** Synthesizes the current
discussion into a PRD (problem, solution, user stories, implementation and
testing decisions, out-of-scope) and publishes it as a `needs-triage` issue.

**When to use:** a feature has been scoped in conversation and needs to become
a tracked issue (e.g. issue #74, the TileMap PRD).

### to-issues
**Plan/PRD → independently-grabbable issues.** Breaks a plan or PRD into
tracer-bullet vertical-slice tickets on the issue tracker.

**When to use:** after a PRD is triaged and the work needs implementation
tickets.

---

## Related Agents

Skills coordinate with specialized agents for specific tasks:

- **codebase-architect**: Architecture analysis and refactoring planning
- **tscn-threejs-docs-researcher**: Godot and three.js documentation research
- **e2e-test-orchestrator**: Comprehensive E2E test orchestration

See `.claude/agents/` for agent documentation.
