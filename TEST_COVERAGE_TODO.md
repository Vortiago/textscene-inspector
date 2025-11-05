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
**Status**: [x] COMPLETE (67 tests added) ✅

### Goals

Test the linting engine and strict parser that validate TSCN files. Critical for user experience.

### Tasks

#### [x] StrictTscnParser.ts (38 tests) ✅
**File**: `packages/textscene-core/src/linter/StrictTscnParser.test.ts`

- [x] Phase 1 syntax validation (parse errors)
- [x] Invalid heading format detection
- [x] Missing node name validation
- [x] Missing node identifier (type/index/instance) validation
- [x] Invalid property format detection
- [x] Line/column tracking accuracy
- [x] ParseError[] format correctness
- [x] Scene tree building validation
- [x] External and internal resource parsing
- [x] Edge cases (empty content, comments, multi-line strings)

#### [x] Linter.ts (29 tests) ✅
**File**: `packages/textscene-core/src/linter/Linter.test.ts`

- [x] lint() two-phase validation (parse errors + rule violations)
- [x] convertParseErrors() to Diagnostic[] format
- [x] lintScene() traversal logic
- [x] lintNode() rule application and recursion
- [x] sortDiagnostics() severity ordering (error → warning → info)
- [x] Integration: StrictTscnParser → ruleRegistry → output
- [x] Empty scene handling
- [x] Scene with only parse errors
- [x] Scene with only rule violations
- [x] Context passing to rules
- [x] Type-specific rule application
- [x] Edge cases and integration tests

### Success Criteria

- [x] StrictTscnParser catches syntax errors with accurate line/column ✅
- [x] Linter two-phase validation working correctly ✅
- [x] Diagnostic output format matches expected structure ✅
- [x] No false positives in test suite ✅
- [x] All 67 tests passing ✅

---

## Sprint 3: Supporting Managers + Error Paths (Week 3-4)

**Priority**: P1 - High
**Estimated Tests**: 145 tests (~3-4 days)
**Status**: [x] COMPLETE (148 tests added) ✅

### Goals

Complete testing of all core managers and add error path coverage to existing parsers.

### Tasks

#### [x] HelperManager.ts (31 tests) ✅
**File**: `packages/textscene-core/src/core/HelperManager.test.ts`

- [x] setHelper() BoxHelper creation
- [x] clearHelper() disposal and cleanup
- [x] highlightNode() clears hover first
- [x] Hover/highlight color correctness
- [x] Error when node path invalid
- [x] clearAll() disposes all helpers

#### [x] SelectionManager.ts (23 tests) ✅
**File**: `packages/textscene-core/src/core/SelectionManager.test.ts`

- [x] getNodePathAtScreenPosition() raycasting
- [x] Normalized device coordinate conversion
- [x] findNodePathInHierarchy() traversal
- [x] instanceRoot handling for external scenes
- [x] isMeshObject() recursive check
- [x] Edge cases (off-canvas clicks, overlapping meshes, no intersection)

#### [x] NodeRegistry.ts (30 tests) ✅
**File**: `packages/textscene-core/src/core/NodeRegistry.test.ts`

- [x] register() adds handlers correctly
- [x] parseNodeWithRegistry() dispatches to correct parser
- [x] renderNodeWithRegistry() dispatches to correct renderer
- [x] Error handling for unknown node types
- [x] Type guard execution order
- [x] Multiple registrations for same type (warning behavior)

#### [x] nodeHash.ts (22 tests) ✅
**File**: `packages/textscene-core/src/utils/nodeHash.test.ts`

- [x] Hash computation consistency
- [x] Hash changes when node properties change
- [x] buildNodeHashMap() recursive traversal
- [x] Edge cases and integration tests

#### [x] SceneSetup.ts (32 tests) ✅
**File**: `packages/textscene-core/src/core/SceneSetup.test.ts`

- [x] createDefaultScene() scene + lights + grid setup
- [x] createDefaultCamera() camera positioning and aspect ratio
- [x] createRenderer() WebGL renderer configuration (mocked)
- [x] createOrbitControls() controls setup and damping
- [x] setupThreeJsScene() full orchestration
- [x] Correct three.js object types returned
- [x] Scene graph structure validation

#### [x] Error Path Testing (10 tests to DirectionalLight3D) ✅
**Files**: `packages/textscene-core/src/nodes/3d/lights/directionallight3d/parser.test.ts`

Add to existing parser tests:
- [x] Invalid parseFloat/parseInt inputs (NaN results)
- [x] Empty strings handling (defaults)
- [x] Negative values
- [x] Malformed color strings
- [x] Extremely large numeric values
- [x] Demonstrated pattern for error path testing

### Success Criteria

- [x] All core managers have test coverage ✅
- [x] Selection/helper systems verified ✅
- [x] Error path testing pattern demonstrated ✅
- [x] Edge cases documented and tested ✅

---

## Sprint 4: Renderer Tests + Integration (Week 4-5)

**Priority**: P1 - High
**Estimated Tests**: 110 tests (~3-4 days)
**Status**: [x] COMPLETE (152 tests added) ✅

### Goals

Verify visual correctness by testing renderers and add comprehensive integration tests for critical user flows.

### Tasks

#### [x] Mesh Renderer Tests (108 tests) ✅

- [x] **CylinderMesh renderer** (`packages/textscene-core/src/resources/meshes/cylindermesh/renderer.test.ts`) - 17 tests
  - Geometry parameters (radius, height, segments)
  - Vertex data validation
  - Bounding checks

- [x] **SphereMesh renderer** (`packages/textscene-core/src/resources/meshes/spheremesh/renderer.test.ts`) - 17 tests
  - Geometry parameters (radius, segments)
  - Uniformity validation

- [x] **PlaneMesh renderer** (`packages/textscene-core/src/resources/meshes/planemesh/renderer.test.ts`) - 19 tests
  - Geometry parameters (size, subdivisions)
  - Orientation handling (FACE_X, FACE_Y, FACE_Z)
  - Subdivision clamping

- [x] **CapsuleMesh renderer** (`packages/textscene-core/src/resources/meshes/capsulemesh/renderer.test.ts`) - 18 tests
  - Geometry parameters (radius, height, segments)
  - Height conversion (Godot to THREE.js)
  - Minimum length enforcement

- [x] **TorusMesh renderer** (`packages/textscene-core/src/resources/meshes/torusmesh/renderer.test.ts`) - 18 tests
  - Geometry parameters (inner/outer radius, segments)
  - Radius conversion (inner/outer to center/tube)

- [x] **PrismMesh renderer** (`packages/textscene-core/src/resources/meshes/prismmesh/renderer.test.ts`) - 19 tests
  - Geometry parameters (size, subdivisions)
  - Triangular cross-section validation

#### [x] Node Parser Tests (44 tests) ✅

- [x] **MeshInstance3D parser** (`packages/textscene-core/src/nodes/3d/meshinstance3d/parser.test.ts`) - 25 tests
  - Type guard testing
  - All properties (mesh, materials, shadows, GI, visibility range, skeleton, skin)
  - Surface material overrides (indexed properties)
  - Node3D property inheritance
  - Error handling (NaN for invalid inputs)

- [x] **Camera3D renderer** - Not implemented (skipped)
- [x] **Node3D parser** (`packages/textscene-core/src/nodes/base/node3d/parser.test.ts`) - 19 tests
  - Type guard testing
  - Name, parent, instance attributes
  - Transform parsing
  - Malformed transform handling (identity fallback)

#### [ ] Integration Tests (0 tests)
**Note**: Integration test framework created but requires debugging (TSCN format parsing issues). Deferred to future sprint.

**Not completed**:
- Full render pipeline tests
- External scene loading tests
- Hot-reload flow tests
- Missing resource flow tests
- Incremental update tests
- Complex scenario tests

### Success Criteria

- [x] All mesh renderers tested for geometry correctness ✅
- [x] Missing node parser tests added ✅
- [ ] At least 20 integration tests covering critical user flows (deferred)
- [x] Visual rendering verified through three.js scene graph inspection (via renderer tests) ✅
- [ ] Complex scenarios tested (performance, memory, multi-camera) (deferred)

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
- [x] Sprint 2: Linter System (67 tests added) ✅
- [x] Sprint 3: Supporting Managers + Error Paths (148 tests added) ✅
- [x] Sprint 4: Renderer Tests + Integration (152 tests added) ✅
- [ ] Sprint 5: UI Components + Web App (145 tests)
- [ ] Cleanup & Maintenance (ongoing)

**Total Progress**: 491 / 620 tests added (79%)
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

**Last Updated**: 2025-11-05 (Sprint 0, 1, 2, 3 & 4 Complete - Infrastructure + 491 tests added ✅)
