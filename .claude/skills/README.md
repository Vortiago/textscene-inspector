# TSCN Previewer Skills

Two specialized skills for the TextScene Inspector monorepo.

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

---

## Related Agents

Skills coordinate with specialized agents for specific tasks:

- **codebase-architect**: Architecture analysis and refactoring planning
- **tscn-threejs-docs-researcher**: Godot and three.js documentation research
- **e2e-test-orchestrator**: Comprehensive E2E test orchestration

See `.claude/agents/` for agent documentation.
