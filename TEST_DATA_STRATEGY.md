# Test Data Strategy

**Created**: 2025-11-05 (Sprint 0: Infrastructure Audit)
**Purpose**: Document test data patterns and fixture management strategies

---

## Overview

This document defines where test data should live and how to structure test fixtures for the TextScene Inspector project.

## Test Data Location Strategies

### 1. Inline TSCN Content (Unit Tests)

**Use for**: Small, focused unit tests that test single features in isolation

**Pattern**:
```typescript
describe('parseNode3D', () => {
  it('should parse Node3D with transform', () => {
    const tscn = `[gd_scene format=3]
[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)`;

    const result = parser.parse(tscn);
    expect(result.nodes).toHaveLength(1);
  });
});
```

**Advantages**:
- Test and data co-located (easy to understand)
- No file I/O overhead
- Fast test execution
- Easy to modify for specific test cases

**Disadvantages**:
- Can clutter test files if too long
- String escaping can be awkward

**Guidelines**:
- Keep inline TSCN < 20 lines
- Use template literals for multi-line content
- Only include properties relevant to the test

---

### 2. Shared Fixtures Directory (Integration Tests)

**Use for**: Integration tests, complex scenarios, tests needing real .tscn files

**Location**: `scenes/fixtures/` (existing fixtures) and `scenes/examples/` (integration scenes)

**Pattern**:
```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Integration: External Scene Loading', () => {
  it('should load scene with external references', async () => {
    const fixturePath = join(__dirname, '../../../scenes/fixtures/unit-plane-mesh.tscn');
    const content = readFileSync(fixturePath, 'utf-8');

    const renderer = new TscnRenderer(canvas);
    await renderer.render(content);

    // Assertions...
  });
});
```

**Existing Fixture Categories**:
- `scenes/fixtures/unit-*.tscn` - Unit-level test fixtures for individual node types
- `scenes/fixtures/edge-*.tscn` - Edge case fixtures for linter testing
- `scenes/fixtures/integration-*.tscn` - Multi-node integration test fixtures
- `scenes/examples/example-*.tscn` - Complex demo scenes

**Advantages**:
- Realistic test scenarios
- Reusable across multiple tests
- Can be used by web previewer for manual testing
- Linted as part of CI/CD

**Disadvantages**:
- Requires file I/O (slower)
- Test and data separated (harder to understand)
- Path resolution can be tricky

**Guidelines**:
- Use for tests requiring > 20 lines of TSCN
- Use for multi-file scenarios (external scenes)
- Document fixtures in `scenes/README.md` (if it exists)
- Run linter on fixtures before committing

---

### 3. Test-Specific Fixtures Directory

**Use for**: Test-specific data that doesn't belong in shared fixtures, multi-file scenarios

**Location**: `__fixtures__/` directory next to test file

**Pattern**:
```typescript
// File: src/core/TscnRenderer.test.ts
// Fixture: src/core/__fixtures__/external-scene.tscn
//          src/core/__fixtures__/main-scene.tscn

describe('TscnRenderer with external scenes', () => {
  it('should load multi-level external scenes', async () => {
    const mainPath = join(__dirname, '__fixtures__/main-scene.tscn');
    const content = readFileSync(mainPath, 'utf-8');

    // Test logic...
  });
});
```

**Advantages**:
- Test-specific data co-located with test
- Doesn't clutter global fixtures directory
- Easy to manage test-specific resources

**Disadvantages**:
- Duplication if similar fixtures needed elsewhere
- Adds directory structure overhead

**Guidelines**:
- Create `__fixtures__/` only when needed
- Use for complex multi-file test scenarios
- Clean up in `afterEach` or `afterAll` if generating files
- Document fixture purpose in README or test comments

---

### 4. Binary Test Resources (Textures, Models)

**Use for**: Testing texture loading, external resource handling

**Strategy**: Mock when possible, use minimal real files when necessary

**Mock Pattern** (Preferred):
```typescript
describe('Texture Loading', () => {
  it('should handle missing texture', async () => {
    const onResourceNeeded = vi.fn().mockResolvedValue(null);
    renderer.setOnResourceNeeded(onResourceNeeded);

    await renderer.render(sceneWithTexture);

    expect(onResourceNeeded).toHaveBeenCalledWith({
      path: 'res://texture.png',
      type: 'Texture2D',
      // ...
    });
  });
});
```

**Real File Pattern** (When Necessary):
```typescript
// Use 1x1 pixel test images
// Location: src/resources/__fixtures__/test-texture.png

describe('Texture Application', () => {
  it('should apply texture to material', async () => {
    const texturePath = join(__dirname, '__fixtures__/test-texture.png');
    const textureData = readFileSync(texturePath);

    // Provide texture via ResourceProvider
    // Test texture application
  });
});
```

**Guidelines**:
- Prefer mocking over real files
- If real files needed, use minimal size (1x1 pixel images)
- Store in `__fixtures__/` next to test
- Document why real file is necessary

---

## Test Type Definitions

### Unit Tests
- **Scope**: Single class/function in isolation
- **Dependencies**: Mocked using `vi.fn()` or `vi.mock()`
- **Data Strategy**: Inline TSCN content (< 20 lines)
- **Example**: Testing `parseBoxMesh()` with minimal TSCN

### Integration Tests
- **Scope**: Multiple real classes working together
- **Dependencies**: Real managers, mocked external deps (filesystem, network)
- **Data Strategy**: Shared fixtures from `scenes/fixtures/`
- **Example**: TscnRenderer → SceneManager → NodeLifecycleManager → three.js

### End-to-End Tests (E2E)
- **Scope**: Full browser automation with real rendering
- **Tool**: Playwright (separate from vitest)
- **Data Strategy**: Real fixture files from `scenes/examples/`
- **Example**: Load .tscn in web previewer, verify visual output
- **Note**: Covered by separate `e2e-testing` skill

---

## Verification and Validation

### Test Infrastructure Verification (Sprint 0 Complete)

✅ **Vitest Configuration**: All packages configured correctly
✅ **happy-dom**: UI component testing works (SceneTreeViewer POC test)
✅ **three.js Testing**: No WebGL mocking needed (objects testable directly)
✅ **Coverage Reporting**: Requires `@vitest/coverage-v8` installation (see below)

### Coverage Reporting Setup

**Current Status**: Coverage provider not installed

**To enable**:
```bash
pnpm add -D -w @vitest/coverage-v8
```

**Run coverage**:
```bash
# All packages
pnpm test -- --run --coverage

# Specific package
pnpm --filter @textscene/core test -- --run --coverage
```

**Coverage Goals** (from TEST_COVERAGE_TODO.md):
- Core managers: >80% coverage
- Linter system: >90% coverage
- Utilities: >85% coverage
- Integration tests: All critical flows covered

---

## Examples from Existing Codebase

### Example 1: Unit Test with Inline Data

**File**: `src/resources/meshes/boxmesh/boxmesh.test.ts`

```typescript
describe('parseBoxMesh', () => {
  it('should parse BoxMesh with size', () => {
    const properties = {
      size: 'Vector3(2, 3, 4)',
    };

    const result = parseBoxMesh(properties);

    expect(result.size).toEqual({ x: 2, y: 3, z: 4 });
  });
});
```

**Data**: Inline object with minimal properties

---

### Example 2: Integration Test with Shared Fixture

**File**: `apps/textscene-vscode/src/TscnPreviewPanel.test.ts`

```typescript
it('should render scene from fixture', async () => {
  // Uses test fixture from scenes/fixtures/
  const tscnContent = await workspace.fs.readFile(fixtureUri);
  // Test rendering...
});
```

**Data**: Shared fixture from `scenes/fixtures/`

---

### Example 3: UI Component Test with DOM Manipulation

**File**: `packages/textscene-core/src/ui/SceneTreeViewer.test.ts` (POC)

```typescript
describe('SceneTreeViewer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should render tree with nodes', () => {
    const nodes: TscnNode[] = [
      { name: 'Root', type: 'Node3D', properties: {}, children: [] }
    ];

    viewer.renderTree(nodes);

    expect(container.querySelector('.tree-node')).toBeDefined();
  });
});
```

**Data**: Inline TypeScript objects (not TSCN strings)

---

## Best Practices Summary

1. **Keep it Simple**: Prefer inline data for unit tests (KISS principle)
2. **Reuse When Valuable**: Use shared fixtures for integration tests
3. **Mock When Possible**: Avoid real files unless necessary
4. **Co-locate Test Data**: Keep test and data close together
5. **Minimize Fixtures**: Only essential properties, keep TSCN < 20 lines
6. **Document Fixtures**: Comment why a fixture exists and what it tests
7. **Lint Fixtures**: Run `pnpm --filter @textscene/linter build && node apps/textscene-linter/dist/cli.js scenes/fixtures/*.tscn` before committing

---

## Sprint 0 Completion Checklist

- [x] Verify vitest configuration for all packages
- [x] Verify happy-dom works for UI component testing
- [x] Create example UI component test (SceneTreeViewer POC)
- [x] Verify three.js rendering can be tested (no WebGL mocking needed)
- [x] Document test data strategy (this file)
- [ ] Set up coverage reporting (requires @vitest/coverage-v8 installation)
- [ ] Audit test files for weak assertions
- [ ] Create test cleanup list

---

## Next Steps

**For Sprint 1-5**: Follow patterns documented here when writing new tests:
- Unit tests → Inline TSCN content
- Integration tests → `scenes/fixtures/` or `__fixtures__/`
- UI component tests → Inline TypeScript objects + happy-dom
- three.js tests → No mocking, test object properties directly

**Coverage Tracking**: Install coverage provider and run after each sprint to measure progress toward goals (>80% core, >90% linter)

---

**Last Updated**: 2025-11-05 (Sprint 0)
