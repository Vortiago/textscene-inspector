# Integration Tests Solution

## The "TSCN Parsing Issue" - What It Really Was

The TEST_COVERAGE_TODO.md mentioned "Integration test framework created but requires debugging (TSCN format parsing issues)". However, this was a **misnomer**. The actual issue was **WebGL context creation**, not TSCN parsing.

## The Real Problem: WebGL in Headless Environment

When running integration tests in a headless Node.js environment (using happy-dom for DOM APIs), three.js's `WebGLRenderer` cannot create a real WebGL context.

### Error Message
```
THREE.WebGLRenderer: Error creating WebGL context.
```

This caused ALL integration tests to fail immediately during `TscnRenderer` construction, before any TSCN parsing could even occur.

## The Solution: Mock WebGLRenderer

### 1. Mock the THREE.WebGLRenderer

In the test file, mock the WebGLRenderer to avoid requiring real WebGL:

```typescript
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    render = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    shadowMap = { enabled: false };

    constructor(options?: { canvas?: HTMLCanvasElement; antialias?: boolean }) {
      this.domElement = options?.canvas || document.createElement('canvas');
    }
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer
  };
});
```

### 2. Add Test-Only Scene Accessor

Since `TscnRenderer.scene` is private, add a test accessor:

```typescript
// In TscnRenderer.ts
/**
 * Get the THREE.js scene for testing purposes
 * @internal - For testing only
 */
getSceneForTesting(): THREE.Scene {
  return this.scene;
}
```

## Results

✅ **8 integration tests passing**

### Test Coverage
- Simple scene rendering (1 node)
- MeshInstance3D with BoxMesh
- Material application
- Multiple node types (meshes + lights)
- Nested node hierarchy with transform inheritance
- Missing mesh resource handling
- Malformed TSCN content handling
- Unknown node type handling

## Files Changed

1. **Created**: `packages/textscene-core/src/integration/renderPipeline.integration.test.ts`
   - 8 integration tests covering full render pipeline
   - Tests TSCN parsing → rendering → three.js scene graph

2. **Modified**: `packages/textscene-core/src/core/TscnRenderer.ts`
   - Added `getSceneForTesting()` method for test access

## Pattern for Future Integration Tests

When writing integration tests that use TscnRenderer:

1. **Always mock WebGLRenderer** using the pattern shown above
2. **Use `getSceneForTesting()`** to access the three.js scene
3. **Test through the scene graph** by traversing and inspecting THREE.js objects
4. **Avoid exact color/numeric comparisons** unless testing specific rendering behavior

## What We Learned

The "TSCN parsing issue" was actually a **test environment issue**. The lesson:
- WebGL APIs don't work in headless test environments
- Mocking three.js WebGLRenderer is standard practice for three.js tests
- The TSCN parsing worked fine - it just couldn't be tested until WebGL was mocked

## Next Steps for Sprint 4 Completion

The deferred integration tests from Sprint 4 can now be implemented using this pattern:

- External scene loading tests
- Hot-reload flow tests
- Missing resource flow tests
- Incremental update tests
- Complex scenario tests (performance, memory)

All can use the same WebGL mocking approach demonstrated here.
