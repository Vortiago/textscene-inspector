## R3F Migration: Shared Interface Contracts

These are the load-bearing interfaces that WI-R3F-2, WI-R3F-3, and WI-R3F-4 must all agree on before parallel work begins. TypeScript source is written in WI-R3F-1; this document defines the behavioral contracts so parallel teammates can work against them from day one.

If any contract must change during implementation, patch this file and notify all active feature branches before the change merges.

---

### 1. `useResource<T>(path, type)`

**Purpose**: The single surface API for loading any external resource (texture, material, GLB, scene file) inside a node component. Hides the WI-79 event bus internals.

**Signature**:
```typescript
// Import source: packages/textscene-core/src/resources/useResource.ts (created in WI-R3F-2)
type ResourceStatus = 'pending' | 'loaded' | 'missing' | 'error';

interface ResourceResult<T> {
  value: T | undefined;
  status: ResourceStatus;
  error?: string; // human-readable message; present when status === 'error' or 'missing'
}

function useResource<T>(path: string, type: ResourceType): ResourceResult<T>;

type ResourceType = 'Texture2D' | 'StandardMaterial3D' | 'GLBMesh' | 'PackedScene';
```

**Behavioral contract**: `value` is defined only when `status === 'loaded'`. The hook never throws and never causes a React Suspense suspension — components must branch on `status` directly. The `missing → loaded` transition is a valid and supported state change: when the host later provides a file that was missing at initial render, all subscribers re-render with `status: 'loaded'` and the resolved value. Cache is invalidated when the host signals a file change for `path`.

**Error field**: `error` is a plain human-readable `string`, not a typed union. Implementers must distinguish failure states via `status` (`'missing'` = path unresolvable by host; `'error'` = host found the file but parsing/decoding failed). Do not branch on `error` content — branch on `status`.

**Cache and identity semantics by resource type**:
- `Texture2D`, `StandardMaterial3D`, data buffers: two components calling `useResource` with the same `path` + `type` receive the **same cached reference** (identity equality). These types have no parent/ownership constraint in THREE.js.
- `GLBMesh` (`THREE.Object3D`): `THREE.Object3D` can only have one parent, so the cache stores a **canonical template** and the hook returns a **fresh clone per call** (`cloneWithMaterials(template)`). Callers must not assume identity equality across two `useResource` calls for the same GLB path. Tests should assert on geometry/material properties, not reference identity.
- `PackedScene`: treated as data; returns the parsed `SceneGraph` structure by reference (same semantics as `Texture2D`).

---

### 2. `NodeComponentRegistry`

**Purpose**: Maps `TscnNode.type` strings to React components. Self-registration on import preserves the existing NodeRegistry pattern.

**Signature**:
```typescript
// TscnNode import: import type { TscnNode } from 'packages/textscene-core/src/parser/types'
interface NodeComponentProps {
  node: TscnNode;
  children?: React.ReactNode;
}

type NodeComponent = React.ComponentType<NodeComponentProps>;

interface NodeComponentRegistration {
  typeName: string;
  Component: NodeComponent;
}

interface NodeComponentRegistry {
  register(registration: NodeComponentRegistration): void;
  get(typeName: string): NodeComponent | undefined;
}
```

**Behavioral contract**: `children` passed to a component are already-rendered React nodes produced by the recursive dispatcher — the component does not re-dispatch them. `get` returns `undefined` for unregistered types; the dispatcher renders `<GenericNodeFallback>` in that case. **`register()` with a duplicate `typeName` silently overwrites the previous entry** — no throw, no warning. This is intentional: HMR re-triggers self-registration on every hot reload; a throw would crash the dev server on every HMR cycle.

---

### 3. `SelectionContext`

**Purpose**: Per-panel React context tracking selected and hovered nodes. Two panels must not share state — isolation is a hard contract.

**Signature**:
```typescript
interface SelectionState {
  selectedNodePath: string | null;
  hoveredNodePath: string | null;
  expandedNodePaths: ReadonlySet<string>;
  setSelectedNodePath: (path: string | null) => void;
  setHoveredNodePath: (path: string | null) => void;
  toggleExpandedNodePath: (path: string) => void;
}

const SelectionContext: React.Context<SelectionState>;
```

**Behavioral contract**: `SelectionContext` is provided by `<TscnPreviewShell>`. Each shell instance creates its own context value; there is no singleton. A component consuming `SelectionContext` outside a `<TscnPreviewShell>` boundary throws in development mode. **`selectedNodePath` is a slash-separated string of node names with no leading `./`** — e.g., `"Node3D/MeshInstance3D"`, not `"./Node3D/MeshInstance3D"` and not an array. This matches the format used by `TscnNode.parent` in `packages/textscene-core/src/parser/types.ts` and by `NodeTracker` path keys. Setting `selectedNodePath` to a path that does not exist in the current scene is allowed and not an error — the UI simply shows nothing selected.

---

### 4. `HierarchyContext`

**Purpose**: Per-panel React context carrying the current `SceneGraph` and a stable `panelId` for logging and multi-panel coordination.

**Signature**:
```typescript
// SceneGraph import: import type { SceneGraph } from 'packages/textscene-core/src/core/SceneGraph'
interface HierarchyState {
  sceneGraph: SceneGraph | null;
  panelId: string;
}

const HierarchyContext: React.Context<HierarchyState>;
```

**Behavioral contract**: `sceneGraph` is `null` until the first parse completes. **Components must handle `null` by rendering a passive loading state (e.g., an empty `<group>` or a spinner) — not by throwing, and not by rendering partial output.** Rendering partial output while `null` would cause a flash of unstyled content on every panel open. `panelId` is stable for the lifetime of the panel and unique across all open panels in the same VS Code window. `HierarchyContext` is provided by `<TscnPreviewShell>` alongside `SelectionContext`; they are always co-located. The `sceneGraph` reference changes on every file save that produces a parse result — components should not use deep equality checks, only reference equality.
