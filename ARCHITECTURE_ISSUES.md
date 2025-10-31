# Architecture Issues & Pain Points

**Analysis Date**: 2025-10-29
**Branch**: `claude/complete-rearchitecture-cleanup-011CUbDmMxnQW5w84JZ37TJd`
**Codebase Stats**: 4,875 lines production code, 5,650 lines test code, 31 test files, 418 passing tests

---

## Critical Issues

### 1. Dead Code: `findNodeInTree()` Method

**Location**: `packages/textscene-core/src/core/TscnRenderer.ts:509-521`

**Problem**:
- Method is defined but **never called** anywhere in codebase
- Was replaced by direct `tscnNodeMap.get()` lookup optimization
- Never removed after refactoring

**Impact**:
- 13 lines of unmaintained code
- Creates confusion for developers reading the code
- Suggests incomplete refactoring

**Evidence**:
```typescript
private findNodeInTree(nodePath: string, nodes: TscnNode[], currentPath = ''): TscnNode | null {
  for (const node of nodes) {
    const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
    if (fullPath === nodePath) {
      return node;
    }
    if (node.children.length > 0) {
      const found = this.findNodeInTree(nodePath, node.children, fullPath);
      if (found) return found;
    }
  }
  return null;
}
```

**Fix**: Delete the method entirely

**Priority**: HIGH (5 minute fix, improves code clarity)

---

### 2. Parser Re-instantiation for Every External Scene

**Location**: `packages/textscene-core/src/core/TscnRenderer.ts:226`

**Problem**:
- Creates new `TscnParser()` instance for every external scene load
- If scene has 20 Door.tscn instances, creates 20 parser objects
- Parser is stateless - no need for multiple instances

**Current Code**:
```typescript
const parser = new TscnParser();  // ❌ New instance every time
const externalScene = parser.parse(externalSceneContent);
```

**Impact**:
- Unnecessary memory allocation
- 14 total `new TscnParser()` instantiations across codebase
- Inefficient for scenes with many instances

**Fix Options**:
1. Reuse a single parser instance across all loads
2. Make `parse()` a static method (parser has no state)
3. Inject parser instance via constructor dependency

**Priority**: MEDIUM (performance optimization, not breaking functionality)

---

### 3. No Parsed Scene Caching

**Location**: `packages/textscene-core/src/resources/ResourceRegistry.ts`

**Problem**:
- Same external scene parsed multiple times if instanced multiple times
- `ResourceRegistry` caches raw file content (string) ✓
- `ResourceRegistry` does NOT cache parsed `TscnScene` object ✗

**Example Scenario**:
```
Hallway.tscn has 20 instances of Door.tscn
Current behavior:
  1. Load Door.tscn content once (cached) ✓
  2. Parse Door.tscn 20 times (NOT cached) ✗
```

**Impact**:
- Wasted CPU on redundant parsing
- Parsing same file 20+ times in complex scenes
- Each parse involves:
  - Line splitting
  - Heading parsing
  - Property extraction
  - Tree building
  - Resource registry creation

**Proposed Fix**:
```typescript
export class ResourceRegistry {
  private loadedCache: Map<string, string | ArrayBuffer> = new Map();
  private parsedSceneCache: Map<string, TscnScene> = new Map(); // NEW

  async loadAndParse(path: string): Promise<TscnScene> {
    // Check parsed cache first
    if (this.parsedSceneCache.has(path)) {
      return this.parsedSceneCache.get(path)!;
    }

    // Load and parse
    const content = await this.loadByPath(path);
    if (typeof content === 'string') {
      const parser = new TscnParser();
      const scene = parser.parse(content);
      this.parsedSceneCache.set(path, scene);
      return scene;
    }

    throw new Error('External scene must be text content');
  }
}
```

**Priority**: HIGH (significant performance impact for complex scenes)

---

### 4. God Object Pattern Emerging in TscnRenderer

**Location**: `packages/textscene-core/src/core/TscnRenderer.ts` (527 lines)

**Problem**: Class has too many responsibilities (Single Responsibility Principle violation)

**Current Responsibilities**:
- ✓ 3D scene rendering (primary responsibility - appropriate)
- ❌ Resource management (`missingResources` map, `provideResource()` method)
- ❌ External scene loading (`loadExternalSceneInstance()` - 100+ lines)
- ❌ Helper/gizmo management (BoxHelper for highlights)
- ❌ Raycasting and selection (`getNodePathAtScreenPosition()`)
- ❌ Node lifecycle management (add/remove/update nodes)
- ❌ Camera state management (get/set camera state)

**Impact**:
- Hard to test in isolation
- Hard to understand - too many concerns mixed together
- Difficult to extend without creating more bloat
- Growing towards 600+ lines

**Suggested Refactoring**:

```typescript
// Core renderer - focuses on rendering
class TscnRenderer {
  render(sceneData: TscnScene): Promise<void>
  addNode(nodePath, node, sceneData): Promise<void>
  removeNode(nodePath): void
  updateNode(nodePath, node, sceneData): Promise<void>
  startAnimationLoop(): void
  resize(width, height): void
}

// External scene loading logic extracted
class ExternalSceneLoader {
  loadExternalSceneInstance(instancePath, instanceNode, sceneData, instanceObject): Promise<void>
  // Handles all external scene loading complexity
}

// Selection and highlighting extracted
class SelectionManager {
  getNodePathAtScreenPosition(x, y): string | null
  highlightNode(nodePath): void
  clearHighlight(): void
  showHoverEffect(nodePath): void
  clearHoverEffect(): void
  // Manages raycasting, helpers, gizmos
}

// Missing resources handled by apps via callback (already have onResourceNeeded)
// Camera state handled by apps (already have getCameraState/setCameraState)
```

**Benefits**:
- Each class has clear single responsibility
- Easier to test each concern in isolation
- Easier to extend without bloating core renderer
- Better separation of concerns

**Priority**: MEDIUM (code quality, doesn't affect functionality)

---

### 5. Dual Map Maintenance Burden

**Location**: `packages/textscene-core/src/core/TscnRenderer.ts:116-117`

**Problem**: Two maps tracking the same keys, must stay synchronized

**Current Code**:
```typescript
this.nodePathMap.set(nodePath, object3D);  // Map 1: path → Three.js object
this.tscnNodeMap.set(nodePath, node);      // Map 2: path → TSCN data
```

**Risk**:
- Forgetting to update one map causes bugs
- Already happened once - `provideResource()` initially couldn't find nodes because `tscnNodeMap` wasn't being updated
- Fixed in previous session, but risk remains

**Why Both Maps Are Needed**:
- `nodePathMap`: Maps to Three.js `Object3D` for rendering operations
- `tscnNodeMap`: Maps to `TscnNode` for TSCN data (needed when re-loading external scenes)

**Current Update Sites**:
1. `TscnRenderer.addNode()` - line 116-117
2. `TscnRenderer.removeNode()` - line 267-268

**Potential Issues**:
- What if someone adds a third update site and forgets one map?
- What if removal logic gets out of sync?

**Proposed Mitigation**:
```typescript
class NodeTracker {
  private nodePathMap: Map<string, THREE.Object3D> = new Map();
  private tscnNodeMap: Map<string, TscnNode> = new Map();

  set(nodePath: string, object3D: THREE.Object3D, tscnNode: TscnNode): void {
    this.nodePathMap.set(nodePath, object3D);
    this.tscnNodeMap.set(nodePath, tscnNode);
  }

  delete(nodePath: string): void {
    this.nodePathMap.delete(nodePath);
    this.tscnNodeMap.delete(nodePath);
  }

  getObject(nodePath: string): THREE.Object3D | undefined {
    return this.nodePathMap.get(nodePath);
  }

  getNode(nodePath: string): TscnNode | undefined {
    return this.tscnNodeMap.get(nodePath);
  }

  clear(): void {
    this.nodePathMap.clear();
    this.tscnNodeMap.clear();
  }
}
```

**Benefits**:
- Enforces synchronized updates
- Single point of failure
- Easier to extend (e.g., add third map if needed)
- Type-safe interface

**Priority**: LOW (working correctly now, but good defensive programming)

---

### 6. No Circular Instance Protection at Renderer Level

**Location**: `packages/textscene-core/src/core/TscnRenderer.ts` (external scene loading)

**Problem**: No protection against circular scene instances

**Current State**:
- `ResourceRegistry` has `loadingStack` to detect circular *file* dependencies (line 81-83) ✓
- `TscnRenderer` has NO protection against circular *instancing* ✗

**Dangerous Scenario**:
```
SceneA.tscn instances SceneB.tscn
SceneB.tscn instances SceneA.tscn
→ Infinite recursion → Stack overflow → Crash
```

**Current Protection**:
```typescript
// ResourceRegistry.ts:81-83
if (this.loadingStack.has(path)) {
  throw new Error(`Circular dependency detected: ${path}`);
}
```

This catches circular *file loads*, but NOT circular *instances*:
- File: Door.tscn references Door.tscn ✓ Caught
- Instance: Room.tscn → Hallway.tscn → Room.tscn ✗ NOT caught

**Why It's Not Caught**:
- Each scene loads its file once (cached)
- But instances can cross-reference in a cycle
- No tracking of instance loading stack

**Proposed Fix**:
```typescript
export class TscnRenderer {
  private instanceLoadingStack: Set<string> = new Set();

  private async loadExternalSceneInstance(...): Promise<void> {
    // Check for circular instances
    if (this.instanceLoadingStack.has(resourceMetadata.path)) {
      throw new Error(`Circular instance detected: ${resourceMetadata.path}`);
    }

    this.instanceLoadingStack.add(resourceMetadata.path);
    try {
      // ... existing loading logic
    } finally {
      this.instanceLoadingStack.delete(resourceMetadata.path);
    }
  }
}
```

**Priority**: HIGH (prevents crashes, defensive programming)

---

## Medium Issues

### 7. No Validation of External Resource Types

**Location**: `packages/textscene-core/src/core/TscnRenderer.ts:125-128`

**Problem**: Assumes all `instance` attributes reference PackedScene resources

**Current Code**:
```typescript
if (node.instance) {
  logger.info(`Node ${nodePath} has instance attribute: ${node.instance}`);
  await this.loadExternalSceneInstance(nodePath, node, sceneData, object3D);
}
```

**Risk Scenario**:
```tscn
[node name="Sprite" type="Sprite2D" instance=ExtResource("texture.png")]
```

This would:
1. Try to load texture.png as text
2. Try to parse PNG binary data as TSCN
3. Get cryptic parse errors instead of clear "wrong type" error

**Current Behavior**:
- No type checking before calling `parser.parse()`
- Parser fails with confusing "unexpected character" errors
- User doesn't know the real problem (wrong resource type)

**Proposed Fix**:
```typescript
private async loadExternalSceneInstance(...): Promise<void> {
  const resourceMetadata = registry.getMetadata(resourceId);

  // Validate resource type
  if (resourceMetadata.type !== 'PackedScene') {
    logger.error(
      `Instance attribute must reference PackedScene, got ${resourceMetadata.type}: ${resourceMetadata.path}`
    );
    return;
  }

  // ... proceed with loading
}
```

**Priority**: MEDIUM (improves error messages, prevents confusion)

---

### 8. ResourceProvider Interface Too Minimal

**Location**: `packages/textscene-core/src/resources/ResourceProvider.ts`

**Current Interface**:
```typescript
export interface ResourceProvider {
  loadResource(path: string, type: string): Promise<string | ArrayBuffer>;
  hasResource?(path: string): boolean;  // Optional, barely used
}
```

**Missing Capabilities**:
1. **Can't list available resources**
   - Web app maintains separate `uploadedFiles` map outside provider
   - VSCode provider can't proactively scan workspace for .tscn files

2. **Can't watch for new resources being added**
   - Apps must manually call `addUploadedFile()` on web provider
   - No event system for "new resource available"

3. **Can't validate resource type before loading**
   - Must load entire file to check if it's valid
   - Wastes bandwidth/I/O for validation

4. **Can't get resource metadata**
   - Size, modification time, etc.
   - Useful for UI display

**Impact**:
- Apps duplicate resource tracking logic
- Web app has `WebResourceProvider.uploadedFiles` map AND passes same data to UI
- No standard way to enumerate available resources
- Provider interface doesn't match real-world usage patterns

**Proposed Extensions** (backward compatible):
```typescript
export interface ResourceProvider {
  // Existing
  loadResource(path: string, type: string): Promise<string | ArrayBuffer>;
  hasResource?(path: string): boolean;

  // New - Optional for backward compatibility
  listResources?(): string[];
  getMetadata?(path: string): { size?: number; modified?: Date; type?: string };
  onResourceAdded?(callback: (path: string) => void): void;
}
```

**Priority**: MEDIUM (quality of life improvement, not breaking)

---

### 9. External Scene Context Complexity

**Location**: `packages/textscene-core/src/core/TscnRenderer.ts:77, 90-114`

**Problem**: `externalSceneContext` parameter grows more complex as nesting support added

**Current Signature**:
```typescript
async addNode(
  nodePath: string,
  node: TscnNode,
  sceneData: TscnScene,
  parentPath?: string,
  externalSceneContext?: { instancePath: string; parentObject: THREE.Object3D }
): Promise<void>
```

**Usage Count**: 6+ conditional checks based on `externalSceneContext`:
```typescript
const parent = externalSceneContext ? ... : ...;  // Line 80

if (externalSceneContext) {
  logger.info(`[External Scene Node] Rendering node...`);  // Line 91
}

if (externalSceneContext) {
  logger.info(`[External Scene Node] Successfully rendered...`);  // Line 102
}

// Set external scene specific userData
if (externalSceneContext) {
  object3D.userData.isExternalSceneContent = true;
  object3D.userData.belongsToExternalInstance = externalSceneContext.instancePath;
}  // Line 111-114

if (externalSceneContext) {
  logger.info(`[External Scene Node] Added to scene graph...`);  // Line 120
}

if (externalSceneContext) {
  logger.info(`[External Scene Node] Processing children...`);  // Line 132
}
```

**Impact**:
- Makes `addNode()` harder to reason about
- Two different execution paths based on context
- Growing complexity as nested instances supported
- Parameter pollution (5 parameters, last two optional)

**Alternative Approach**:
```typescript
// Separate methods for clarity
async addRootNode(nodePath: string, node: TscnNode, sceneData: TscnScene, parentPath?: string)
async addExternalNode(nodePath: string, node: TscnNode, sceneData: TscnScene, context: ExternalSceneContext)

// Or use strategy pattern
interface NodeAdditionStrategy {
  determineParent(): THREE.Object3D | THREE.Scene;
  shouldLog(): boolean;
  applyUserData(object: THREE.Object3D): void;
}
```

**Priority**: LOW (works correctly, just complex to read)

---

### 10. No Visual Error Indication for Failed Scenes

**Location**: `packages/textscene-core/src/core/TscnRenderer.ts` (external scene loading failure)

**Problem**: Failed external scenes are invisible in 3D viewport

**Current Behavior**:
1. External scene fails to load
2. Empty `Object3D` created at instance location
3. Nothing visible in 3D view
4. User must check console logs OR missing resources UI to know something failed

**Better UX Options**:
1. **Error marker in 3D space**
   - Show red bounding box where instance should be
   - Add icon/sprite indicating error

2. **Placeholder geometry**
   - Show wireframe cube with "?" texture
   - Makes it obvious something is missing

3. **Tree view indication**
   - Mark node with error icon in tree viewer
   - Show tooltip with error message

**Proposed Implementation**:
```typescript
private async loadExternalSceneInstance(...): Promise<void> {
  try {
    // ... existing loading logic
  } catch (error) {
    logger.error(`[External Scene] Failed to load: ${resourceMetadata.path}`);

    // Add visual error marker
    this.addErrorMarker(instanceObject, resourceMetadata.path, error);
  }
}

private addErrorMarker(parent: THREE.Object3D, path: string, error: Error): void {
  // Create red wireframe box
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true
  });
  const errorBox = new THREE.Mesh(geometry, material);
  errorBox.userData.isErrorMarker = true;
  errorBox.userData.errorMessage = error.message;
  errorBox.userData.missingPath = path;

  parent.add(errorBox);
}
```

**Priority**: MEDIUM (UX improvement, not critical functionality)

---

## Minor Issues

### 11. Verbose Logging Throughout

**Location**: Throughout `packages/textscene-core/src/`

**Observation**:
- 50+ `logger.info()` calls in TscnRenderer.ts alone
- Every method logs its execution
- More like tracing than logging

**Example**:
```typescript
logger.info(`[External Scene] Starting to load for instance: ${instancePath}`);
logger.info(`[External Scene] Parsed resource ID: ${resourceId} from: ${instanceNode.instance}`);
logger.info(`[External Scene] Looking up resource ID "${resourceId}" in registry`);
logger.info(`[External Scene] Found resource metadata...`);
logger.info(`[External Scene] Loading content from: ${resourceMetadata.path}`);
logger.info(`[External Scene] Loaded content type: ${typeof externalSceneContent}...`);
logger.info(`[External Scene] Parsed scene with ${externalScene.nodes.length} root nodes`);
```

**CLAUDE.md Guidance**:
> Verbose logging is encouraged for rapid prototyping and debugging.
> Host applications control log levels.
> Don't remove verbose logging from the core library - let apps decide what to show.

**Verdict**: This is **intentional design**, not a bug. Apps can filter logs.

**Counter-argument**:
- Library is doing excessive I/O (console output)
- Violates Single Responsibility Principle (library shouldn't concern itself with logging presentation)
- Makes code harder to read (more log statements than logic in some methods)

**Priority**: NOT A BUG (stated design choice in CLAUDE.md) - Document as architectural decision

---

### 12. Property Formatter Duplication

**Already Tracked**: WI-47 and WI-48 in TODO.md

**Issue**:
- Light property parsing duplicated (~45 lines across 3 light types)
- Shadow formatting duplicated (~60 lines across 3 light types)

**Status**: Correctly prioritized as LOW in TODO.md

**Priority**: LOW (code quality, already tracked)

---

### 13. No Registry Cleanup on Scene Unload

**Location**:
- `packages/textscene-core/src/core/NodeRegistry.ts`
- `packages/textscene-core/src/resources/ResourceRegistry.ts`

**Problem**: Registries never call `.clear()` method

**Observation**:
- Both registries have `.clear()` methods defined
- Neither is called anywhere in codebase
- Resources accumulate across multiple scene loads

**Scenario**:
```
Web app session:
1. Load Scene1.tscn (10 resources registered)
2. Load Scene2.tscn (10 more resources registered, total: 20)
3. Load Scene3.tscn (10 more resources registered, total: 30)
→ ResourceRegistry grows unbounded
```

**Impact**:
- Memory leak potential in long-running web app sessions
- Not critical for VS Code extension (one file at a time)
- Matters for web app with fixture switching

**Where to Call Clear**:
```typescript
// In TscnPreviewUI or TscnRenderer
async loadScene(content: string): Promise<void> {
  // Clear previous scene
  this.renderer.clearScene();  // Should clear registries

  // Parse and render new scene
  const scene = this.parser.parse(content);
  scene.resourceRegistry.clear();  // Or here?
  await this.renderer.render(scene);
}
```

**Complexity**: Each `TscnScene` has its own `ResourceRegistry` instance. Should old registries be cleared when new scene loads?

**Priority**: LOW (memory leak potential, but only in long sessions)

---

## Positive Architectural Aspects ✓

### What's Working Well

1. **Vertical Slicing Pattern** ✓
   - Each node type in its own folder with parser/renderer/tests
   - Easy to add new node types without touching core files
   - Clear separation of concerns

2. **Self-Registration System** ✓
   - Node types register themselves on import
   - No central switch statements
   - Open/Closed Principle followed

3. **Test Coverage** ✓
   - 5,650 test lines vs 4,875 production lines
   - 31 test files, 418 passing tests
   - Co-located tests next to implementation

4. **Resource Loading Abstraction** ✓
   - `ResourceProvider` interface allows different implementations
   - Web app loads from uploads, VSCode loads from workspace
   - Clean separation between core library and host environment

5. **External Scene Loading Works** ✓
   - Complex feature successfully implemented
   - Handles nested external scenes
   - Cascading dependency loading

6. **Generic Resource Resolution** ✓
   - `resolveResource<T>()` eliminates duplication
   - Type-safe handler registration
   - Single error handling path

---

## Recommended Action Plan

### Immediate (Next Session)

**Priority 1 - Quick Wins**:
1. ✅ Delete `findNodeInTree()` dead code (5 min)
2. ✅ Add instance type validation (15 min)
3. ✅ Add circular instance detection (30 min)

**Priority 2 - Performance**:
4. ✅ Add parsed scene caching to ResourceRegistry (1 hour)
5. ✅ Reuse parser instance instead of creating new ones (30 min)

### Short Term (This Week)

**Priority 3 - Code Quality**:
6. ⏱️ Extract ExternalSceneLoader class from TscnRenderer (2-3 hours)
7. ⏱️ Add NodeTracker wrapper for dual maps (1 hour)

**Priority 4 - UX Improvements**:
8. ⏱️ Add visual error markers for failed external scenes (1-2 hours)

### Long Term (Future)

**Priority 5 - Nice to Have**:
9. 📋 Extend ResourceProvider interface (design discussion needed)
10. 📋 Simplify external scene context passing (refactoring)
11. 📋 Add registry cleanup lifecycle hooks (design decision needed)

### Not Planned

- ❌ Verbose logging (intentional design choice per CLAUDE.md)
- ❌ Property formatter duplication (already tracked as WI-47/48, LOW priority)

---

## Metrics Summary

**Codebase Health**:
- ✅ Test/Production Ratio: 1.16 (excellent coverage)
- ⚠️ Largest Class: TscnRenderer.ts (527 lines - approaching God Object)
- ✅ Dead Code: 1 method found (findNodeInTree)
- ⚠️ Circular Dependency Protection: Partial (files yes, instances no)

**Technical Debt**:
- 🔴 Critical: 3 issues (dead code, no instance caching, no circular instance protection)
- 🟡 Medium: 4 issues (type validation, provider interface, God Object, error UX)
- ⚫ Minor: 3 issues (verbose logging, duplication already tracked, registry cleanup)

**Overall Assessment**: Architecture is **fundamentally sound** with a few critical optimizations needed and one refactoring opportunity (God Object). External scene loading is a major achievement. Most issues are performance optimizations and defensive programming improvements rather than fundamental design flaws.
