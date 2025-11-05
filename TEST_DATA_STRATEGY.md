# Test Data Strategy

**Created**: 2025-11-05
**Status**: Sprint 0 Documentation

This document defines how test data (TSCN fixtures, resources, etc.) should be organized and used across the test suite.

---

## Quick Reference

| Test Type | Data Location | Format | When to Use |
|-----------|--------------|--------|-------------|
| **Unit - Simple** | Inline string literals | `const tscn = '[gd_scene format=3]\n[node...]'` | Single node tests, property parsing |
| **Unit - Complex** | Inline template strings | Multi-line with \`\`\` | Multi-node tests, resource tests |
| **Integration** | `scenes/fixtures/` files | Committed .tscn files | Established node types, regression tests |
| **E2E/Complex** | `__fixtures__/` next to test | Test-specific .tscn files | Multi-file scenarios, external scenes |

---

## Strategy by Test Type

### 1. Unit Tests (Simple)

**Use inline string literals** for focused, minimal tests.

**Best for**:
- Testing single node parsing
- Property value validation
- Error handling with malformed input
- Edge cases (empty values, missing properties)

**Example**:
```typescript
it('should parse Node3D with transform', () => {
  const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)`;

  const result = parser.parse(content);
  expect(result.nodes[0].properties.transform.origin.x).toBe(2);
});
```

**Guidelines**:
- Keep fixtures minimal (only necessary properties)
- Use clear, descriptive node names
- One test, one concern

---

### 2. Unit Tests (Complex Scenarios)

**Use inline template strings** for multi-node or resource scenarios.

**Best for**:
- Testing node hierarchies
- Testing internal resources (SubResource)
- Testing external resources (ExtResource)
- Multi-node parsing validation

**Example**:
```typescript
const childCubeScene = `[gd_scene load_steps=3 format=3 uid="uid://child_cube_scene"]

[sub_resource type="BoxMesh" id="BoxMesh_1"]
size = Vector3(1, 1, 1)

[node name="ChildCube" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

it('should parse scene with internal resources', () => {
  const result = parser.parse(childCubeScene);
  expect(result.internalResources).toHaveLength(2);
});
```

**Guidelines**:
- Define fixture at top of describe block
- Reuse fixture across related tests
- Include comments for complex fixtures

---

### 3. Integration Tests (Established Fixtures)

**Use `scenes/fixtures/` files** for established node types and regression tests.

**Best for**:
- Testing implemented node types end-to-end
- Regression tests for known bugs
- Validating render pipeline with real fixtures
- Linter integration tests

**Guidelines**:
- Use existing fixtures when available
- Create new fixtures following naming convention:
  - `unit-<feature>.tscn` - Single node type tests
  - `integration-<feature>.tscn` - Multi-node combinations
  - `edge-<issue>.tscn` - Regression tests for specific bugs
- Commit fixtures to git
- Update `apps/textscene-web/src/fixtures.ts` for UI visibility
- Lint fixtures before committing: `pnpm lint:tscn`

---

## References

- Sprint 0 coverage audit (TEST_COVERAGE_TODO.md)
- Existing test patterns (TscnParser.test.ts, SceneManager.external-rendering.test.ts)
- CLAUDE.md testing guidelines

---

**Last Updated**: 2025-11-05 (Sprint 0 Complete)
