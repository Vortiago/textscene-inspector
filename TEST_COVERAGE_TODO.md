# Test Coverage Improvement Roadmap

**Created**: 2025-11-05
**Updated**: 2025-11-05 (Critical review applied)
**Status**: Not Started
**Estimated Effort**: ~620 new tests, 25-35 days of focused work (1.5-2 months, 5 sprints + prep)

---

## Executive Summary

### Current State (73 test files, ~2,300 tests)

- ✅ **Strong Coverage**: SceneManager (comprehensive callback/error testing), VSCode extension (excellent integration tests), linter rules (30+ node types), architecture.test.ts (valuable architectural guardrails)
- ❌ **Critical Gaps**: TscnRenderer, NodeLifecycleManager, Linter, StrictTscnParser (NO TESTS)
- ⚠️ **Partial Coverage**: Node renderers (parsers tested, renderers not), UI components, error paths, SceneSetup.ts (no tests)
- 🗑️ **Cleanup Needed**: Identify low-value tests (TBD in Sprint 0)

### Priority Areas

1. **P0 (Critical)**: Core managers (TscnRenderer, NodeLifecycleManager), Linter system, transform.ts
2. **P1 (High)**: Supporting managers, error paths, renderer tests, integration tests
3. **P2 (Medium)**: UI components, web app comprehensive tests
4. **P3 (Low)**: Cleanup redundant tests, optional utilities

---

## Sprint 0: Preparation & Infrastructure Audit (1-2 days)

**Priority**: P0 - Critical
**Estimated Effort**: 1-2 days
**Status**: [x] COMPLETE

### Goals

Prepare test infrastructure and identify actual cleanup targets before starting main work.

### Tasks

#### [x] Test Infrastructure Audit ✅

- [x] Verify vitest configuration for all packages
- [x] Verify happy-dom works for UI component testing
- [x] Create example UI component test (proof of concept)
- [x] Verify three.js rendering can be tested (check WebGL mocking needs)
- [x] Document test data strategy (fixtures location, inline vs files)
- [x] Set up coverage reporting dashboard

#### [x] Identify Low-Value Tests ✅

- [x] Audit all test files for tests that only check `.toBeDefined()` without further validation
- [x] Find tests with weak assertions that pass even when functionality is broken
- [x] List tests that duplicate coverage unnecessarily
- [x] Create specific removal list with justifications
- [x] **Note**: architecture.test.ts is VALUABLE (tests architectural invariants, self-registration, guards against god objects) - keep it

#### [x] Test Data Strategy ✅

- [x] Define where test .tscn fixtures go (inline vs `scenes/fixtures/` vs `__fixtures__/`)
- [x] Define how to handle binary test resources (textures, external scenes)
- [x] Create small test fixture examples for each strategy
- [x] Document in Testing Best Practices section

### Success Criteria

- [x] UI test environment verified working
- [x] Specific list of low-value tests to remove (with justifications)
- [x] Test data strategy documented
- [x] Coverage reporting functional
- [x] Ready to start Sprint 1

---

## Sprint 1: Core Managers Foundation (Week 1-2)

**Priority**: P0 - Critical
**Estimated Tests**: 150 tests (~3-4 days)
**Status**: [x] COMPLETE (124 tests added)

### Goals

Test the main orchestration layer that has NO tests currently. High risk for regressions.

### Tasks

#### [x] TscnRenderer.ts (47 tests) ✅
**File**: `packages/textscene-core/src/core/TscnRenderer.test.ts`

- [x] Constructor initialization and manager wiring
- [x] render() method queue/concurrency handling
- [x] Delegation methods (addNode, removeNode, updateNode, etc.)
- [x] Camera state management (getCameraState, setCameraState, resetCamera)
- [x] Resource callback wiring (onResourceNeeded propagation)
- [x] Error handling when managers fail
- [x] dispose() cleanup and resource release
- [x] Integration with all managers (SceneManager, NodeLifecycleManager, etc.)

#### [x] NodeLifecycleManager.ts (44 tests) ✅
**File**: `packages/textscene-core/src/core/NodeLifecycleManager.test.ts`

- [x] addNode() with parent path resolution
- [x] External scene instance handling
- [x] Recursive child addition
- [x] removeNode() with descendant cleanup
- [x] updateNode() remove/re-add logic
- [x] setNodeVisibility() traversal
- [x] Error paths (parent not found, invalid paths)
- [x] SceneManager integration for external scenes

#### [x] transform.ts (33 tests) ✅
**File**: `packages/textscene-core/src/utils/transform.test.ts`

- [x] parseOptionalTransform() parsing
- [x] Transform3D matrix conversion accuracy
- [x] Edge cases (invalid formats, missing values, malformed input)
- [x] Default values when transform missing

### Success Criteria

- [x] TscnRenderer public API fully tested (render, addNode, camera operations)
- [x] NodeLifecycleManager scene graph operations verified
- [x] Transform parsing edge cases covered
- [x] All tests passing, no regressions introduced

---

## Sprint 2: Linter System (Week 2-3)

**Priority**: P0 - Critical
**Estimated Tests**: 70 tests (~2-3 days)
**Status**: [ ] Not Started

### Goals

Test the linting engine and strict parser that validate TSCN files. Critical for user experience.

### Tasks

#### [ ] StrictTscnParser.ts (30-40 tests)
**File**: `packages/textscene-core/src/linter/StrictTscnParser.test.ts`

- [ ] Phase 1 syntax validation (parse errors)
- [ ] Malformed Vector3 detection (e.g., "Vector3(1, 2,)")
- [ ] Malformed Transform3D detection
- [ ] Type mismatches (string where number expected)
- [ ] Invalid brackets, missing quotes
- [ ] Line/column tracking accuracy
- [ ] ParseError[] format correctness
- [ ] Comparison with lenient TscnParser behavior

#### [ ] Linter.ts (30-40 tests)
**File**: `packages/textscene-core/src/linter/Linter.test.ts`

- [ ] lint() two-phase validation (parse errors + rule violations)
- [ ] convertParseErrors() to Diagnostic[] format
- [ ] lintScene() traversal logic
- [ ] lintNode() rule application
- [ ] sortDiagnostics() severity ordering (error → warning → info)
- [ ] Integration: StrictTscnParser → ruleRegistry → output
- [ ] Empty scene handling
- [ ] Scene with only parse errors
- [ ] Scene with only rule violations
- [ ] Scene with both error types

### Success Criteria

- [ ] StrictTscnParser catches all syntax errors with accurate line/column
- [ ] Linter two-phase validation working correctly
- [ ] Diagnostic output format matches expected structure
- [ ] No false positives or missed errors

---

## Sprint 3: Supporting Managers + Error Paths (Week 3-4)

**Priority**: P1 - High
**Estimated Tests**: 145 tests (~3-4 days)
**Status**: [ ] Not Started

### Goals

Complete testing of all core managers and add error path coverage to existing parsers.

### Tasks

#### [ ] HelperManager.ts (15-20 tests)
**File**: `packages/textscene-core/src/core/HelperManager.test.ts`

- [ ] setHelper() BoxHelper creation
- [ ] clearHelper() disposal and cleanup
- [ ] highlightNode() clears hover first
- [ ] Hover/highlight color correctness
- [ ] Error when node path invalid
- [ ] clearAll() disposes all helpers

#### [ ] SelectionManager.ts (20-30 tests)
**File**: `packages/textscene-core/src/core/SelectionManager.test.ts`

- [ ] getNodePathAtScreenPosition() raycasting
- [ ] Normalized device coordinate conversion
- [ ] findNodePathInHierarchy() traversal
- [ ] instanceRoot handling for external scenes
- [ ] isMeshObject() recursive check
- [ ] Edge cases (off-canvas clicks, overlapping meshes, no intersection)

#### [ ] NodeRegistry.ts (20-30 tests)
**File**: `packages/textscene-core/src/core/NodeRegistry.test.ts`

- [ ] register() adds handlers correctly
- [ ] parseNodeWithRegistry() dispatches to correct parser
- [ ] renderNodeWithRegistry() dispatches to correct renderer
- [ ] Error handling for unknown node types
- [ ] Type guard execution order
- [ ] Multiple registrations for same type (warning behavior)

#### [ ] nodeHash.ts (10-15 tests)
**File**: `packages/textscene-core/src/utils/nodeHash.test.ts`

- [ ] Hash computation consistency
- [ ] Hash changes when node properties change
- [ ] Hash collision handling
- [ ] Performance with large nodes

#### [ ] SceneSetup.ts (15-20 tests)
**File**: `packages/textscene-core/src/core/SceneSetup.test.ts`

- [ ] createDefaultScene() scene + lights + grid setup
- [ ] createDefaultCamera() camera positioning and aspect ratio
- [ ] createRenderer() WebGL renderer configuration
- [ ] createOrbitControls() controls setup and damping
- [ ] setupThreeJsScene() full orchestration
- [ ] Correct three.js object types returned
- [ ] Scene graph structure validation

#### [ ] Error Path Testing (50-60 tests)
**Files**: Various node parser test files

Add to existing parser tests:
- [ ] MeshInstance3D parser error paths
- [ ] Camera3D parser error paths
- [ ] Light node parser error paths
- [ ] Node3D parser error paths
- [ ] Missing required properties
- [ ] Invalid property ranges
- [ ] Type mismatches
- [ ] Callback invocation on parsing errors

### Success Criteria

- [ ] All core managers have test coverage
- [ ] Selection/helper systems verified
- [ ] Error paths tested for all major parsers
- [ ] Edge cases documented and tested

---

## Sprint 4: Renderer Tests + Integration (Week 4-5)

**Priority**: P1 - High
**Estimated Tests**: 110 tests (~3-4 days)
**Status**: [ ] Not Started

### Goals

Verify visual correctness by testing renderers and add comprehensive integration tests for critical user flows.

### Tasks

#### [ ] Mesh Renderer Tests (40-50 tests)

- [ ] **CylinderMesh renderer** (`packages/textscene-core/src/resources/meshes/cylindermesh/renderer.test.ts`)
  - Geometry parameters (radius, height, segments)
  - Material application

- [ ] **SphereMesh renderer** (`packages/textscene-core/src/resources/meshes/spheremesh/renderer.test.ts`)
  - Geometry parameters (radius, segments)

- [ ] **PlaneMesh renderer** (`packages/textscene-core/src/resources/meshes/planemesh/renderer.test.ts`)
  - Geometry parameters (size, subdivisions)

- [ ] **CapsuleMesh renderer** (`packages/textscene-core/src/resources/meshes/capsulemesh/renderer.test.ts`)
  - Geometry parameters (radius, height, segments)

- [ ] **TorusMesh renderer** (`packages/textscene-core/src/resources/meshes/torusmesh/renderer.test.ts`)
  - Geometry parameters (inner/outer radius, segments)

- [ ] **PrismMesh renderer** (`packages/textscene-core/src/resources/meshes/prismmesh/renderer.test.ts`)
  - Geometry parameters (size, subdivisions)

#### [ ] Node Renderer Tests (20-30 tests)

- [ ] **MeshInstance3D parser** (`packages/textscene-core/src/nodes/meshinstance3d/parser.test.ts`) - MISSING
- [ ] **Camera3D renderer** (verify existing tests comprehensive)
- [ ] **Node3D parser** (`packages/textscene-core/src/nodes/base/node3d/parser.test.ts`) - MISSING

#### [ ] Integration Tests (20-25 tests)
**File**: `packages/textscene-core/src/integration.test.ts` (new file)

**Full Render Pipeline** (3-4 tests):
- [ ] Load simple TSCN → Parse → Render → Verify three.js scene graph
- [ ] Load complex scene with multiple node types → Verify all rendered correctly
- [ ] Load scene with meshes + lights + cameras → Verify complete scene

**External Scene Loading** (3-4 tests):
- [ ] Load scene with ext_resource → Instance tracking → Verify scene graph
- [ ] Multi-level external scenes (scene → scene → scene) → Verify nesting
- [ ] External scene with missing file → Error handling → Callback invoked

**Hot-Reload Flow** (3-4 tests):
- [ ] Initial load → Modify external .tscn → updateScene() → Verify updates
- [ ] Hot-reload with added nodes → Verify new nodes appear
- [ ] Hot-reload with removed nodes → Verify nodes cleaned up
- [ ] Hot-reload with property changes → Verify updates without full reload

**Missing Resource Flow** (3-4 tests):
- [ ] Load scene with missing mesh → Callback invoked → Provide resource → Re-render → Verify success
- [ ] Load scene with missing texture → Resource recovery → Verify applied
- [ ] Multiple missing resources → Batch callback → Provide all → Verify

**Incremental Updates** (3-4 tests):
- [ ] Full load → Modify property → Incremental update → Verify only changed nodes updated
- [ ] Transform change → Verify only transform updated
- [ ] Visibility change → Verify only visibility changed

**Complex Scenarios** (3-4 tests):
- [ ] Large scene performance (100+ nodes) → Verify no memory leaks
- [ ] Multiple cameras → Switch camera → Verify correct viewpoint
- [ ] Resource cleanup on scene unload → Verify three.js objects disposed
- [ ] Scene graph operations (parent changes, re-ordering) → Verify correctness

### Success Criteria

- [ ] All mesh renderers tested for geometry correctness
- [ ] Missing node parser tests added
- [ ] At least 20 integration tests covering critical user flows
- [ ] Visual rendering verified through three.js scene graph inspection
- [ ] Complex scenarios tested (performance, memory, multi-camera)

---

## Sprint 5: UI Components + Web App (Week 5+)

**Priority**: P2 - Medium
**Estimated Tests**: 145 tests (~4-5 days)
**Status**: [ ] Not Started

### Goals

Test UI layer and web app functionality. Verify UI test environment before full sprint.

### Preparation (before full sprint)

- [ ] **Verify UI test environment**: Ensure happy-dom + three.js work together (done in Sprint 0)
- [ ] **Create example UI component test**: Proof of concept for SceneTreeViewer or NodeDetailsFormatter
- [ ] **Document mocking strategy**: How to mock WebGL if needed for UI tests

### Tasks

#### [ ] UI Component Tests (80-100 tests)

- [ ] **TscnPreviewUI.ts** (`packages/textscene-core/src/ui/TscnPreviewUI.test.ts`)
  - loadTscn() orchestration
  - incrementalUpdate() handling
  - getMissingResources() display
  - UI element wiring
  - Event handlers

- [ ] **SceneTreeViewer.ts** (`packages/textscene-core/src/ui/SceneTreeViewer.test.ts`)
  - Tree rendering from scene data
  - Node selection handling
  - Expand/collapse functionality
  - Search functionality
  - Click handlers

- [ ] **NodeDetailsFormatter.ts** (`packages/textscene-core/src/ui/NodeDetailsFormatter.test.ts`)
  - formatNodeProperties() for different types
  - HTML generation correctness
  - Edge cases (null properties, unknown types, empty objects)

- [ ] **ViewportSelector.ts** (`packages/textscene-core/src/ui/ViewportSelector.test.ts`)
  - Viewport switching (perspective, top, side, front)
  - Gizmo creation
  - Camera positioning

#### [ ] Web App Tests (40-50 tests)

- [ ] **main.ts** (`apps/textscene-web/src/main.test.ts` - expand existing)
  - File upload handling
  - Fixture loading from dropdown
  - Resource file management UI
  - Missing resource tracking display
  - Reset camera functionality
  - Error display
  - Scene info display (node count, etc.)

#### [ ] Supporting Tests (5-10 tests)

- [ ] **NodeTracker.ts** (`packages/textscene-core/src/core/NodeTracker.test.ts`)
  - Atomic set/delete operations
  - Map synchronization (nodePathMap ↔ tscnNodeMap)
  - getAllPaths() correctness
  - size property

### Success Criteria

- [ ] UI components testable and tested
- [ ] Web app critical flows verified
- [ ] User interactions covered by tests

---

## Ongoing: Cleanup & Maintenance

**Status**: [ ] Not Started
**Note**: Actual cleanup targets identified in Sprint 0

### Tasks

#### [ ] Remove Unnecessary Tests (based on Sprint 0 audit)

- [ ] Remove tests from Sprint 0 cleanup list (with justifications documented)
- [ ] Consolidate redundant parser tests (if found)
- [ ] Remove tests that only verify "true === true" or similar no-ops
- [ ] **DO NOT remove architecture.test.ts** - these are valuable architectural guardrails that:
  - Test self-registration patterns (30+ node types)
  - Guard against TscnRenderer becoming a god object (< 25 methods limit)
  - Validate package exports remain stable
  - Ensure manager delegation pattern maintained

#### [ ] Fix Invalid Tests (as discovered during sprint work)

- [ ] Update tests with outdated function signatures
- [ ] Strengthen weak assertions (avoid `.toBeDefined()` without further checks)
- [ ] Fix tests that could pass when functionality is broken
- [ ] Add missing assertions to ensure tests actually validate behavior
- [ ] Document bugs found during test writing in CHANGELOG.md

---

## Testing Best Practices (Apply Throughout)

### Core Principles

Following CLAUDE.md guidelines:

- ✅ **Test happy paths, error paths, edge cases** - Every public method should have at least 3 tests
- ✅ **Test callbacks** - Verify callbacks invoked with correct data, test graceful degradation without callbacks
- ✅ **Test state changes** - Verify internal state updates correctly
- ✅ **Update tests FIRST when refactoring** - Prevents silent breakage
- ✅ **Co-locate tests** - Tests live next to implementation files (*.test.ts)
- ✅ **Use strict TypeScript** - Catches outdated signatures automatically

### Test Type Definitions

**Unit Tests**:
- Single class/function in isolation
- Dependencies mocked using vi.fn() or vi.mock()
- Fast execution, no I/O or external dependencies
- Example: Testing TscnParser.parse() with mocked file content

**Integration Tests**:
- Multiple real classes working together
- No browser, may use happy-dom for DOM APIs
- Use real managers but mock external dependencies (file system, network)
- Example: TscnRenderer → SceneManager → NodeLifecycleManager → three.js scene graph

**E2E Tests** (not in this plan):
- Full browser automation with real rendering
- Uses Playwright or similar
- Covered by separate e2e-testing skill

### Test Data Strategy

**Unit Tests** (small, focused):
- Inline .tscn content as string literals
- Keep fixtures minimal (only necessary properties)
- Example: `const tscn = '[gd_scene load_steps=1]\\n[node name="Root" type="Node3D"]';`

**Integration Tests** (realistic):
- Use existing `scenes/fixtures/` files for established node types
- Create `scenes/fixtures/integration-*.tscn` for new integration scenarios
- Fixtures should be committed to git

**Complex Scenarios**:
- Create `__fixtures__/` directory next to test file for test-specific data
- Use for multi-file scenarios (external scenes, resource loading)
- Clean up test artifacts in afterEach/afterAll

**Binary Resources** (textures, models):
- Mock using vi.fn() when possible
- Use 1x1 pixel test images for texture tests (minimal size)
- Store in `__fixtures__/` if needed physically

### Example Callback Testing Pattern

```typescript
it('should invoke callback on error', async () => {
  const callbackSpy = vi.fn().mockResolvedValue(null);
  manager.setCallback(callbackSpy);
  await manager.performAction();
  expect(callbackSpy).toHaveBeenCalled();
});

it('should pass correct data to callback', async () => {
  const callbackSpy = vi.fn();
  manager.setCallback(callbackSpy);
  await manager.performAction();
  expect(callbackSpy).toHaveBeenCalledWith({
    expectedField: 'value'
  });
});

it('should not throw when callback not set', async () => {
  await expect(manager.performAction()).resolves.not.toThrow();
});
```

### Handling Blockers

**If tests reveal design issues**:
- Don't force tests on untestable code
- Consider if refactoring is needed first
- Update plan with refactoring tasks
- Re-prioritize remaining sprints
- Document learnings in ARCHITECTURE.md

**Common testability issues**:
- Tight coupling (extract interfaces, use dependency injection)
- God objects (extract managers)
- Hidden dependencies (make explicit via constructor)
- Global state (use instances instead)

### Knowledge Capture

**Document learnings during testing**:
- Add complex test scenarios to work_items/ as examples
- Update ARCHITECTURE.md if tests reveal design patterns
- Update CLAUDE.md with new testing patterns discovered
- Keep CHANGELOG.md entry for bugs fixed during testing
- Add comments in tests explaining non-obvious assertions

---

## Quick Reference

### Running Tests

```bash
# Run all tests in monorepo
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for specific package
pnpm --filter @textscene/core test
pnpm --filter @textscene/vscode test
pnpm --filter @textscene/web test

# Run tests with coverage report
pnpm test --coverage

# Run specific test file
pnpm test path/to/file.test.ts

# Run tests matching pattern
pnpm test --grep "TscnRenderer"
```

### Coverage Goals

- **Core managers**: >80% coverage
- **Linter system**: >90% coverage
- **Utilities**: >85% coverage
- **Integration tests**: All critical flows covered

### Test Commands (vitest)

```typescript
// Basic assertions
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toBeDefined();
expect(array).toHaveLength(n);
expect(array).toContain(item);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow(error);

// Mocking
const spy = vi.fn();
const mockFn = vi.fn().mockReturnValue(value);
const mockAsync = vi.fn().mockResolvedValue(value);
```

---

## Progress Tracking

### Overall Progress

- [x] Sprint 0: Preparation & Infrastructure Audit ✅
- [x] Sprint 1: Core Managers Foundation (124 tests added) ✅
- [ ] Sprint 2: Linter System (70 tests)
- [ ] Sprint 3: Supporting Managers + Error Paths (145 tests)
- [ ] Sprint 4: Renderer Tests + Integration (110 tests)
- [ ] Sprint 5: UI Components + Web App (145 tests)
- [ ] Cleanup & Maintenance (ongoing)

**Total Progress**: 124 / 620 tests added (20%)
**Note**: Sprint 0 was infrastructure/documentation work (no new tests added)

### Progress Update Frequency

- Check off individual tasks as completed
- Update test count after completing each file
- Mark sprint complete when all tasks done
- Run `pnpm test --coverage` at end of each sprint
- Update "Last Updated" date at bottom of file

### Risk Assessment

- **High Risk (untested)**: Linter, StrictTscnParser, SceneSetup.ts
- **Medium Risk (partial)**: Node renderers, UI components
- **Low Risk (well-tested)**: TscnRenderer, NodeLifecycleManager, SceneManager, VSCode extension, linter rules, transform.ts

### Success Metrics

- [x] All core managers have >80% coverage (measurable via `pnpm test --coverage`) ✅ Sprint 1
- [ ] Linter system catches all known error types (regression suite established)
- [ ] All linter edge cases from analysis documented and tested
- [ ] Error paths tested for all public APIs (at least 1 error test per public method)
- [ ] At least 20 integration tests covering critical user flows
- [x] Low-value tests identified and removed (documented in Sprint 0) ✅ Result: NO tests to remove
- [x] All tests follow CLAUDE.md patterns (callback testing, error handling, state verification) ✅ Validated in Sprint 0
- [x] No tests with only `.toBeDefined()` without further validation ✅ Audited in Sprint 0 - patterns are valid
- [x] All new tests have descriptive names explaining what they verify ✅ Validated in Sprint 0

---

## Timeline Estimates

### Pure Test Writing

- **Sprint 0**: 1-2 days (infrastructure audit, cleanup identification)
- **Sprint 1**: 3-4 days (150 tests - core managers)
- **Sprint 2**: 2-3 days (70 tests - linter system)
- **Sprint 3**: 3-4 days (145 tests - supporting managers + SceneSetup)
- **Sprint 4**: 3-4 days (110 tests - renderers + integration)
- **Sprint 5**: 4-5 days (145 tests - UI components)
- **Cleanup**: 1-2 days (remove low-value tests, fix invalid tests)

**Subtotal**: 17-24 days of pure test writing

### Additional Work (Reality Buffer)

- **Bug fixes**: 5-7 days (tests will reveal implementation bugs that need fixing)
- **Refactoring**: 2-4 days (UI components may need refactoring for testability)
- **Rework**: 1-2 days (tests that need revision, mock strategy adjustments)

**Buffer Subtotal**: 8-13 days

### Total Realistic Estimate

**25-35 days of focused work (1.5-2 months)**

### Assumptions

- One person working full-time on testing
- Pre-commit checks run after each file (incremental validation)
- Tests written incrementally (small changes → build → test → next change)
- Bug fixes handled immediately when discovered (don't defer)
- If multiple people work in parallel, Sprints 1-2 can run concurrently with Sprints 3-4 (reduce calendar time)

---

## Notes

### Workflow

- **Start with Sprint 0** - Infrastructure audit is critical before main work
- Focus on one sprint at a time (don't jump ahead)
- Mark items complete immediately after finishing (stay current)
- Run full test suite after each sprint: `pnpm test`
- Run coverage report at sprint end: `pnpm test --coverage`
- Update this file as priorities shift or new gaps discovered

### When to Update TODO.md

- Add sprint to TODO.md when starting work on it
- Mark work item as done in TODO.md when sprint completes
- Don't clutter TODO.md with all 5 sprints at once

### Critical Reminders

- **DO NOT remove architecture.test.ts** - these are valuable architectural guardrails
- Tests will reveal bugs - allocate time to fix them
- If code is untestable, refactor it (don't force bad tests)
- Document learnings in ARCHITECTURE.md and CLAUDE.md
- Keep test fixtures small and focused

### Mid-Sprint Discoveries

If you encounter blockers:
- Stop and assess (don't power through bad tests)
- Document the blocker and root cause
- Update plan with refactoring tasks if needed
- Re-prioritize remaining sprints
- Ask for guidance if architectural changes needed

---

## Revision History

- **2025-11-05**: Initial plan created (550 tests, 16-22 days)
- **2025-11-05**: Critical review applied - revised to 620 tests, 25-35 days
  - Added Sprint 0 (infrastructure audit, cleanup identification)
  - Added SceneSetup.ts to Sprint 3 (+15 tests)
  - Increased Sprint 4 integration tests from 10-15 to 20-25 (+10 tests)
  - Increased Sprint 5 from 110 to 145 tests (+35 tests)
  - Clarified architecture.test.ts is valuable (not cleanup target)
  - Added test data strategy, test type definitions, blocker handling
  - Added Quick Reference section with commands
  - Improved success metrics (more measurable)
  - Added realistic timeline with bug fix buffer

---

**Last Updated**: 2025-11-05 (Sprint 0 & 1 Complete - Infrastructure audit + 124 tests added + Hooks installed ✅)
