## Problem Statement

The current Phase 13.5 work-in-progress branch (`claude/plan-event-foundation-*`) is in a broken, partially-completed state. As a user trying to render TSCN files in the web previewer or VS Code extension, I experience:

- Updates not propagating when files change (some changes load, others don't)
- Sync problems between the file system and the rendered scene
- Performance issues during file loads and incremental updates
- Multi-panel coordination failures

Beyond the user-facing bugs, the underlying architecture is hard to keep in working memory while debugging:

- The reconciliation infrastructure was scaffolded (immutable `SceneGraph`, `diffUtils.ts`) but never wired up — `webview.ts` does full re-renders despite receiving diff payloads
- Test files won't compile against the current code (`SceneData` imports from a non-existent `./types`, `subResources` field references when the actual field is `internalResources`)
- The event-based resource loading architecture (FileEventBus → ResourceEventBus → ResourceLoader) introduces three layers of indirection between "request a texture" and "the texture being applied", which makes debugging painful and is the source of recurring mistakes

The path to "just finish Phase 13.5" — implementing WI-78.5 (ReconciliationEngine) and WI-78.6 (Panel Integration) — requires owning a custom THREE.js reconciler indefinitely or accepting that the most cognitively expensive part of the architecture (event-based async coordination) will remain.

## Solution

Restart on the `main` branch and adopt **react-three-fiber (R3F)** as the rendering layer. React's reconciler replaces all the WI-78.x reconciliation work; React Suspense + Promise-based resource loading replaces the event-based plumbing with linear, debuggable control flow.

Keep what works:
- The TSCN parser, linter, and node registry (all data/validation, framework-agnostic)
- The immutable `SceneGraph` data structure and `SceneGraphBuilder` (deep, pure, salvageable)
- The `nodeDependsOnPath` predicate (already a pure function)
- The DOM UI overlay (tree viewer, node details, viewport selector) migrates to React components alongside the canvas — not kept as imperative DOM manipulation
- The VS Code language feature providers (`TscnDefinitionProvider`, `TscnDocumentSymbolProvider`) are unaffected — they operate on text, not on the renderer
- The generic-node fallback (WI-55) is preserved as `<GenericNodeFallback>` — unrecognized node types render as a labeled placeholder, not invisibly

Replace what was painful:
- The custom reconciliation pipeline is deleted, not finished — R3F's reconciler does the same work natively
- The three-layer event bus is hidden behind a `useResource` hook (surface API change, not necessarily an implementation replacement — see Implementation Decisions)
- Imperative renderers become declarative React components (one per node type), each independently testable with `@react-three/test-renderer`
- Imperative DOM UI (`SceneTreeViewer`, `NodeDetailsFormatter`, `TscnPreviewUI`) becomes a React component tree (`<SceneTreeViewer>`, `<NodeDetailsPanel>`, `<TscnPreviewShell>`)

## User Stories

1. As a TSCN file author, I want my edits to appear in the VS Code preview within a frame or two, so I can iterate on scenes quickly.
2. As a TSCN file author, I want every property change I make in the source file to actually update the rendered scene, so I am not confused about which changes "took".
3. As a TSCN file author, I want external textures I add to the project to load and apply on first save without requiring a reload, so my iteration loop is uninterrupted.
4. As a TSCN file author, I want to open two preview panels for two different scenes and have them update independently, so I can compare scenes side-by-side.
5. As a TSCN file author, I want missing-file errors to surface clearly in the UI rather than failing silently, so I know when a `res://` path is broken.
5a. As a TSCN file author, I want a scene that references a missing texture to render normally with a magenta placeholder on just the affected mesh, so I can see the rest of the scene while I track down the missing file.
5b. As a TSCN file author, I want to upload a previously-missing file at any point — seconds or hours after opening the scene — and have only the meshes that depend on it re-render with the new texture, without reloading the scene.
5c. As a TSCN file author, I want a clear visual indicator on placeholder meshes telling me which file is missing, so I know what to upload.
6. As a TSCN file author, I want to click a mesh in the preview viewport to select it and see its properties in the panel, so I can inspect nodes without searching the tree manually.
7. As a TSCN file author, I want helper gizmos for lights, cameras, and audio players to be visible in the preview, so I can see the placement of non-mesh nodes.
8. As a TSCN file author, I want the camera position and orbit state to survive a hot-reload when only scene content changes, so I do not lose my viewpoint when I save a file.
9. As a VS Code user, I want Cmd/Ctrl-clicking a `res://` path in a `.tscn` file to navigate to that resource, so I can quickly open referenced files.
10. As a VS Code user, I want the Outline panel to list the scene tree from the `.tscn` file, so I can navigate large scenes without scrolling.
11. As a TSCN file author, I want unrecognized node types to render as a labeled placeholder rather than disappear, so I can see the scene structure even when a node type is not yet implemented.
12. As a developer modifying this codebase, I want each node type's rendering logic to live in one declarative component file, so I can read the entire behavior of "what does MeshInstance3D do" in one place.
13. As a developer adding a new TSCN node type, I want to register a single React component with the node registry, so I do not have to coordinate parser, renderer, and lifecycle code across multiple files.
14. As a developer, I want each node-type component to have a unit test that asserts the resulting THREE.js scene structure synchronously, so I can refactor without worrying about regressing rendering behavior.
15. As a developer, I want to be able to render a small scene graph in a test and assert on it without spinning up a browser or async polling, so test feedback is fast.
16. As a developer, I want resource loading (textures, materials, GLBs) to follow a linear async control flow that I can read top-to-bottom, so debugging a failed load does not require tracing through three event buses.
17. As a developer, I want the dev workflow (`pnpm dev`) to support hot-reload of components so I can iterate on rendering logic without restarting the dev server.
18. As a developer, I want bundle size to stay reasonable despite adding React, so the VS Code extension remains lightweight to load.
19. As a maintainer, I want the rendering pipeline to be backed by a battle-tested library (R3F) rather than custom reconciliation code, so I do not own the correctness of fiber-style diffing indefinitely.
20. As a maintainer, I want the testing tools used (`@react-three/test-renderer`) to be maintained by the wider community, so I am not the only person responsible for the test infrastructure.
21. As a maintainer, I want this migration broken into self-contained work items with clear acceptance criteria, so progress is visible and reviewable in small chunks.
22. As a maintainer, I want a clear cherry-pick list from the broken branch, so the salvageable work is not lost when we reset.
23. As a maintainer, I want the linter package to remain THREE-free (the bundle-size discipline established in CLAUDE.md), so adding R3F to the renderer side does not bloat the linter.
24. As an AI-assisted developer, I want the architecture to be simple enough to hold in working memory during a single conversation, so the assistant does not make repeated mistakes due to context fragmentation.
25. As a TSCN file author rendering a scene with shared textures, I want all meshes referencing that texture to update when the texture loads, so I do not see one mesh textured and another not.
26. As a TSCN file author rendering a scene with a missing texture, I want the mesh to render with a visible placeholder rather than nothing, so I can tell that the mesh is there even when its material is broken.
27. As a developer, I want the camera, lighting, and orbit controls to work out-of-the-box in both the web previewer and the VS Code extension, so users do not need to manually configure anything.
28. As a developer, I want the rendering pipeline to be testable from the host application's perspective end-to-end without requiring a full browser, so CI runs fast.

## Implementation Decisions

### Major Modules to Build

**`<TscnCanvas>` (deep module, NEW)**
- React component that accepts a parsed `SceneGraph` and renders the entire scene tree.
- Encapsulates `<Canvas>` setup, default camera, default lighting, OrbitControls.
- Same component is mounted by both the web app and the VS Code webview.
- Public interface: `<TscnCanvas sceneGraph={graph} onError={...} />`. Stable once defined.

**Node Component Registry (deep module, NEW — mirrors current `NodeRegistry`)**
- Maps `TscnNode.type` string → React component.
- Each node-type module self-registers on import (preserves the existing self-registration pattern).
- Public interface: `nodeRegistry.register({ typeName, Component })`. Stable.

**Per-node-type Components (one per type, NEW)**
- One `.tsx` file per node type: `<MeshInstance3D>`, `<Camera3D>`, `<DirectionalLight>`, `<Node3D>`, etc.
- Each component receives the node's parsed properties as props and returns R3F JSX.
- Children are rendered by recursively dispatching through the registry.

**`<GenericNodeFallback>` (NEW)**
- Rendered for any node type not registered in the component registry.
- Renders a labeled axes-helper or bounding-box placeholder so unrecognized nodes remain visible in the scene.

**Helper gizmo components (NEW)**
- `<DirectionalLightGizmo>`, `<OmniLightGizmo>`, `<SpotLightGizmo>`, `<CameraGizmo>`, `<AudioPlayer3DGizmo>`
- Each renders a small editor-only helper mesh (arrow, sphere, frustum, speaker) at the node's transform.
- Gizmos are composited inside the respective node component; they do not require a separate registry.

**DOM UI components (NEW — replaces imperative `ui/` classes)**
- `<SceneTreeViewer>` — interactive tree hierarchy panel; replaces `ui/SceneTreeViewer.ts`
- `<NodeDetailsPanel>` — property display for selected node; replaces `ui/NodeDetailsFormatter.ts`
- `<ViewportSelector>` — scene-file dropdown; replaces `ui/ViewportSelector.ts`
- `<TscnPreviewShell>` — layout coordinator mounting canvas + panels; replaces `ui/TscnPreviewUI.ts`

**Context providers (NEW)**
- `SelectionContext` — scoped per panel; tracks the currently-selected node path; replaces `core/SelectionManager.ts`
- `HierarchyContext` — scoped per panel; exposes the scene tree to the UI; replaces `core/HierarchyRegistry.ts` singleton

**Resource Loading Module (deep module, SALVAGE-AND-WRAP)**
- Surface API: a `useResource(path, type)` hook that returns `{ value, status }` where `status` is `'pending' | 'loaded' | 'missing' | 'error'`. Components branch on status directly — no Suspense boundary needed, no subtree suspension on a missing file.

```tsx
const { value, status } = useResource('res://textures/foo.png', 'Texture2D');
if (status === 'missing') return <PlaceholderMesh tint="magenta" label="res://textures/foo.png" />;
if (status === 'pending')  return <PlaceholderMesh tint="gray" />;
return <mesh><meshStandardMaterial map={value} /></mesh>;
```

- **First-class requirement**: a mesh whose resource is missing must render with a placeholder, not suspend or disappear. The scene continues to function normally. When the user later uploads that file (seconds, minutes, or hours later), only the meshes that depend on it re-render — using the salvaged `nodeDependsOnPath` predicate to scope the update.
- **Suspense alone is wrong here**: a pending Promise suspends the entire subtree; there is no per-resource placeholder UI; the Promise leaks if the file never arrives. The explicit `status` field makes all these states representable and testable.
- **Implementation**: the `useResource` hook wraps the salvaged WI-79 event bus internally. The FileEventBus → ResourceEventBus → ResourceLoader layering becomes an internal implementation detail that callers never see. If during WI-R3F-2 the salvaged code fails the late-arrival fixture test, the WI scope includes patching WI-79 internals to make it pass. If the salvaged code proves fundamentally broken under load, the WI escalates to a rebuild discussion before being marked complete.
- The hook must support: (1) cache invalidation on file change, (2) `'missing'` status when path is unresolvable, (3) shared cache across multiple components referencing the same path, (4) late arrival — the resource becomes available after initial render.

**Host File Provider Interface (deep module, SALVAGE-AND-SIMPLIFY)**
- The Promise-returning analog of `FileEventBus`: hosts (web app, VS Code) implement `getFileBytes(path): Promise<Uint8Array>` and `watchFile(path, callback): Disposable`.
- The single interface between the rendering core and the host application.
- Replaces the current dual `FileEventBus` / `ResourceEventBus` layering.

### Major Modules to Salvage Verbatim

- `packages/textscene-core/src/core/SceneGraph.ts` — immutable scene-graph type
- `packages/textscene-core/src/core/SceneGraphBuilder.ts` — parser-result → SceneGraph (pure)
- `packages/textscene-core/src/core/nodeDependsOnPath.ts` — pure dependency-walk predicate
- `packages/textscene-core/src/parser/` — entire parser (lenient and strict)
- `packages/textscene-core/src/linter/` — entire linter, including bundle-isolation discipline
- `packages/textscene-core/src/nodes/**/parser.ts` — ALL node-type-specific parsing, including non-MVS types (2D nodes, physics, audio, animation, paths, Skeleton3D, Sprite3D); parsers are framework-agnostic and must not be discarded
- `packages/textscene-core/src/nodes/**/linter*.ts` — node-type-specific linting (all types)
- `apps/textscene-vscode/src/TscnDefinitionProvider.ts` — Go-to-definition (text-layer only, unaffected by R3F)
- `apps/textscene-vscode/src/TscnDocumentSymbolProvider.ts` — Outline panel symbols (text-layer only)
- `apps/textscene-vscode/src/TscnDefinitionProvider.test.ts` and `TscnDocumentSymbolProvider.test.ts`
- `apps/textscene-vscode/src/extension.ts` (file-watcher registration logic) — the file-watching glue is kept; the renderer it calls changes
- All fixture `.tscn` files in `scenes/`

### Major Modules to Delete

- `packages/textscene-core/src/core/TscnRenderer.ts` (780 LOC) — replaced by `<TscnCanvas>`
- `packages/textscene-core/src/core/NodeLifecycleManager.ts` (576 LOC) — replaced by React lifecycle
- `packages/textscene-core/src/core/NodeTracker.ts` — tracking now implicit in React component tree
- `packages/textscene-core/src/core/SelectionManager.ts` — replaced by `SelectionContext`
- `packages/textscene-core/src/core/CameraManager.ts` — replaced by R3F camera state in refs
- `packages/textscene-core/src/core/HelperManager.ts` — replaced by gizmo components
- `packages/textscene-core/src/core/ResourceRecoveryManager.ts` — replaced by `useResource` hook
- All `packages/textscene-core/src/nodes/**/renderer.ts` files — replaced by `Component.tsx`
- `packages/textscene-core/src/ui/SceneTreeViewer.ts` — replaced by `<SceneTreeViewer>` React component
- `packages/textscene-core/src/ui/NodeDetailsFormatter.ts` — replaced by `<NodeDetailsPanel>`
- `packages/textscene-core/src/ui/ViewportSelector.ts` — replaced by `<ViewportSelector>`
- `packages/textscene-core/src/ui/TscnPreviewUI.ts` — replaced by `<TscnPreviewShell>`
- `apps/textscene-vscode/src/diffUtils.ts` — reconciliation handled by React
- `scripts/generate-styles.mjs` and the generated `styles.ts` — replaced by CSS Modules build pipeline

### Architectural Decisions

- **React 19** is the target React version (concurrent features, native Suspense for data, no SSR).
- **`@react-three/fiber` v9** is the target R3F version.
- **`@react-three/drei`** is used for OrbitControls and helpers, kept as an explicit dependency rather than implementing inline.
- **The linter bundle stays React-free** — `packages/textscene-core/src/linter/index.ts` continues to import `linterParser.ts` and `linter.ts` directly, never reaching `nodes/**/Component.tsx`. The "linter direct-imports rule" from CLAUDE.md remains the architectural law.
- **TypeScript JSX configuration** added only to the renderer-touching packages; linter and parser stay `.ts`-only.
- **No SSR, no Next.js** — client-only renderer for two host apps. R3F's `<Canvas>` mounts to a DOM node provided by the host.
- **Camera and OrbitControls state** lives in React refs and is preserved across re-renders by component identity (key-stable parent). A full scene reload (different file path) resets camera; a content-only hot-reload preserves it.
- **Multi-panel coordination** uses React context per panel, replacing the current `HierarchyRegistry` singleton pattern. `SelectionContext` and `HierarchyContext` are scoped to each `<TscnPreviewShell>` instance so two panels cannot corrupt each other's selection state.
- **Selection and hover state** via React context, scoped per panel. No external state library.
- **CSS strategy**: CSS Modules. Each component gets a co-located `Component.module.css`; Vite emits scoped class names at build time. The VS Code webview links the emitted CSS bundle via `webview.asWebviewUri()` with the CSP nonce on the `<link>` tag.
- **TypeScript major bump**: workspace moves from TS `^5.7.3` to `^6.0.3` as part of this migration. The bump lands during WI-R3F-0 so the green baseline is established on TS 6 before any new code is written. Any salvaged code that doesn't type-check on TS 6 is fixed in WI-R3F-0, not deferred.

### Work Item Breakdown (sequenced)

- **WI-R3F-0: Cherry-pick salvage.** Reset to `main`, apply the salvage list above on a fresh branch, and bump TypeScript to `^6.0.3`. Acceptance: `pnpm build && pnpm type-check && pnpm test` all green — evaluated AFTER the TS 6 bump, not before. If salvaged code introduces TS 6 type errors, fix them as part of this WI.
- **WI-R3F-0.5: Compatibility Spike.** Before any real implementation, validate the full target stack in a throwaway scratch project (`.spike/r3f-compat/`, gitignored). Install React 19, `@react-three/fiber` v9, `@react-three/drei`, `@react-three/test-renderer`, Vitest 3, and TypeScript 5.x (matching repo version). Write one trivial test: render `<mesh>` and assert `findByType('Mesh')` via Vitest. Acceptance: (1) install succeeds with no peer-dependency conflicts; (2) trivial test passes. **If red**: migration plan reopens — WI-R3F-1 onward does NOT start, blocker documented with version pin recommendation. **If green**: spike is discarded and WI-R3F-1 proceeds.
- **WI-R3F-1: R3F Infrastructure.** Add React, R3F, drei to pnpm catalog using the version pins below. Add `tsconfig` JSX settings to renderer packages. Configure CSS Modules in the Vite build. Build empty `<TscnCanvas>` that mounts in both apps. Acceptance: (1) blank canvas renders in web app and VS Code webview; (2) CSS Modules build emits a CSS bundle that loads correctly under VS Code webview CSP.
  - **Version pins (verified by WI-R3F-0.5 spike)**: `react@^19.2`, `react-dom@^19.2`, `@react-three/fiber@^9.6`, `@react-three/drei@^10.7`, `@react-three/test-renderer@^9.1`, `three@^0.184`, `vitest@^4.1`, `@vitejs/plugin-react@^6.0`, `jsdom@^29`, `typescript@^6.0.3`. The spike confirmed these versions install cleanly with no peer-dep warnings and the central `findByType('Mesh')` test passes.
- **WI-R3F-2: Resource Loading Hook and Implementation.** Implement `useResource(path, type)` hook returning `{ value, status }`, wrapping the salvaged WI-79 event bus internally. Acceptance criteria: (1) loading an existing path resolves and renders normally; (2) requesting a missing path returns `status: 'missing'` and renders a placeholder — the scene does NOT suspend; (3) path can be requested before OR after the host has the file — resolution behavior is identical either way; (4) **HARD GATE**: the late-arrival fixture test MUST pass — missing file at scene load → user provides file later → only dependent meshes re-render (verified with `nodeDependsOnPath`). This is not a smoke test; the WI is not complete until this gate passes. If the salvaged WI-79 code does not pass it, patch WI-79 internals as part of this WI.
- **WI-R3F-3: Node Components Port (MVS subset).** Port the minimum viable set first: `Node3D`, `MeshInstance3D` (BoxMesh, SphereMesh, PlaneMesh, CylinderMesh, CapsuleMesh), `Camera3D`, `DirectionalLight`, `OmniLight`, `SpotLight`, `WorldEnvironment`, `<GenericNodeFallback>`. Each port comes with its own component tests using `@react-three/test-renderer`. Acceptance per type: existing fixture renders identically; component test asserts THREE primitive structure synchronously (no `vi.waitFor` polling). Acceptance for `<GenericNodeFallback>`: a TSCN file containing an unrecognized node type renders without error, with a visible placeholder present in the test scene graph at the expected position.
  - **WI-R3F-3.x follow-ups (post-MVS, not blocking WI-R3F-4):** 2D nodes (Node2D, Sprite2D, AnimatedSprite2D, Camera2D), physics bodies (StaticBody3D, RigidBody3D), audio (AudioStreamPlayer3D), animation (AnimationPlayer, AnimationTree), particles (GPUParticles3D), paths (Path3D, PathFollow3D), Skeleton3D, Sprite3D.
- **WI-R3F-4: DOM UI Migration.** Implement `<SceneTreeViewer>`, `<NodeDetailsPanel>`, `<ViewportSelector>`, `<TscnPreviewShell>`, `SelectionContext`, `HierarchyContext`. Mount in both apps. Acceptance: (1) tree viewer renders the scene hierarchy and updates on file change; (2) clicking a node in the tree selects it and populates the details panel; (3) clicking a mesh in the viewport selects it (click-to-select); (4) two panels open simultaneously have independent selection state; (5) CSS solution chosen is CSP-safe in VS Code webview.
- **WI-R3F-5: Integration and Multi-Panel.** Mount `<TscnCanvas>` with full editor feature parity in both apps. Acceptance: (1) `integration-all-primitives.tscn` renders correctly; (2) two VS Code panels open simultaneously update independently; (3) camera orbit state survives a hot-reload (content change without path change); (4) Go-to-definition (`TscnDefinitionProvider`) navigates to the correct file for `res://` paths; (5) VS Code Outline panel lists scene tree nodes from `TscnDocumentSymbolProvider`; (6) helper gizmos are visible for DirectionalLight, OmniLight, SpotLight, Camera3D, AudioStreamPlayer3D nodes.
- **WI-R3F-6: Cleanup and Documentation.** Delete the now-unused imperative renderer files. Update `ARCHITECTURE.md`. Acceptance: no dead-code paths; bundle no larger than current + 200 KB gzipped.

### Execution Plan

**Contracts first.** Before WI-R3F-2/3/4 start, `work_items/R3F-contracts.md` is drafted (TypeScript signatures + behavioral contracts for `useResource`, `NodeComponentRegistry`, `SelectionContext`, `HierarchyContext`). Each parallel teammate imports types from these contracts on day one. If a contract needs to change mid-WI, the contract file is patched and the change is announced to all three branches before merge.

**Branch strategy.**
- `feat/r3f-migration` is the integration branch. WI-R3F-0 and WI-R3F-1 land here directly.
- WI-R3F-2, 3, and 4 each get their own branch off `feat/r3f-migration`: `feat/r3f-2-resource-hook`, `feat/r3f-3-mvs-nodes`, `feat/r3f-4-dom-ui`. Each opens a PR back into `feat/r3f-migration`.
- WI-R3F-5 and WI-R3F-6 land on `feat/r3f-migration` directly.
- `feat/r3f-migration` merges to `main` only when WI-R3F-6 ships.

**Merge order for parallel WIs.** WI-R3F-2 merges first (WI-R3F-3 may consume `useResource`; WI-R3F-4's `SelectionContext` does not, but the ordering keeps the integration branch stable). Then WI-R3F-3, then WI-R3F-4. If a later-merging branch finds the contracts changed since it branched, the contract was wrong — fix the contract, not the WI.

**Test discipline.** Each feature branch keeps its own tests green at all times. Integration tests run on `feat/r3f-migration` after every merge.

**Code review.** The user reviews each parallel WI's PR before it merges into `feat/r3f-migration`.

## Testing Decisions

A good test in this codebase asserts external observable behavior: the resulting THREE.js scene structure, the colors and materials applied, the visibility of nodes, error messages surfaced to users. A bad test asserts internal implementation details: that a specific event handler fired, that a specific function was called, that the internal state of a manager class is in a particular shape.

The migration to R3F makes external-behavior testing dramatically easier — `@react-three/test-renderer` synchronously constructs the scene graph and exposes `findByType()` and `toGraph()` methods that return exactly the observable structure.

### Modules That Will Be Tested

- **`SceneGraphBuilder`** — pure data transform, ideal for unit tests with table-driven test cases. Tests verify graph shape for a battery of TSCN inputs. Prior art: existing tests for the parser are the right model.
- **`nodeDependsOnPath`** — pure predicate, already has tests; preserve them as-is.
- **`useResource` hook** — test the public contract across the full lifecycle: `pending → loaded` on a resolvable path; `pending → missing` on an unresolvable path; `missing → loaded` when the file arrives after initial render (the late-arrival case); multiple components consuming the same path all update on resolution; cache hit on second request for the same path. Do not test implementation internals (event handlers, Promise chains) — only the status transitions and returned values.
- **Per-node-type components** — each `Component.tsx` gets a `Component.test.tsx` co-located. Using `@react-three/test-renderer`: render the component with a battery of fixture props, assert the resulting scene contains the expected THREE primitive types and property values. Prior art: existing `nodes/3d/meshinstance3d/renderer.test.ts` shows the assertion patterns; rewrite them with `findByType()` instead of `toBeInstanceOf`.
- **`<TscnCanvas>` integration** — one test per scene fixture: render `<TscnCanvas sceneGraph={parsed-fixture} />`, assert top-level node count and types. This is the level at which "scenes look correct" is enforced.
- **DOM UI components** — `<SceneTreeViewer>` and `<NodeDetailsPanel>` get React Testing Library tests asserting rendered HTML structure. `SelectionContext` gets tests for state isolation between two mounted panels.

### Modules That Will NOT Get New Tests

- The parser, linter, and node-registry tests are salvaged verbatim. They already cover the data layer.
- Cherry-picked modules (`SceneGraph`, `SceneGraphBuilder`, `nodeDependsOnPath`) come with their existing tests.
- React context wiring and routing-style code in the app shells gets integration-level tests, not unit tests.
- `TscnDefinitionProvider` and `TscnDocumentSymbolProvider` tests are salvaged verbatim — they test text-layer behavior that is unchanged.

### Test Coverage Targets

- Three tests per public method remains the CLAUDE.md target: happy path, error path, edge case.
- Every node-type component must have at least one fixture rendering test before its `renderer.ts` predecessor is deleted.
- Bundle-size regression is checked by a CI step that fails if `dist/webview.js` exceeds current size + 200 KB.

## Out of Scope

- **Migration to a non-React framework** (solid-three, Threlte, TresJS). Section 7 of `work_items/SPIKE-r3f-migration.md` documents the watchlist for revisiting this. Not in scope for this PRD.
- **Server-side rendering or hydration.** Both host apps are client-only.
- **New TSCN feature sets beyond the MVS node list.** The WI-R3F-3.x items (2D nodes, physics, audio, animation, particles, paths, Skeleton3D, Sprite3D) are follow-ups that unblock after the MVS port lands. Not blocking WI-R3F-4.
- **Material property work from WI-65 through WI-75** (physically-based material flags, advanced shading). Those are post-migration feature work, not part of the renderer rewrite.
- **Phase 9–12 work items** (linter rules, diagnostics, hover docs). Those phases are unaffected by and do not block this migration.
- **Linter changes.** The linter is salvaged verbatim and its architecture is unchanged.
- **VS Code integration-test harness fixes.** The Inno-Setup mutex blocker is environmental and tracked separately.
- **A formal ADR system.** This project does not maintain ADRs; this PRD plus the SPIKE document serve as the architectural record.

## Further Notes

- The architect's spike document at `work_items/SPIKE-r3f-migration.md` contains the full path-comparison reasoning, the watchlist for non-React alternatives, and the original WI sketch. This PRD supersedes Section 9 of that document for active work.
- The "started months ago with weaker models" observation is a practical tailwind for any restart path. It is not a technical justification on its own, but it does mean that re-doing work from `main` is expected to produce higher-quality output than fixing the existing branch.
- Cherry-picking from the broken branch is not a `git cherry-pick` operation per se — it is "copy these files into a fresh branch from `main`". The branch has too much drift to use git's cherry-pick mechanism cleanly.
- WI-79's event-based resource pipeline took significant effort and is genuinely well-designed. It is salvaged as the internal implementation of the `useResource` hook. The cognitive cost concern was about exposing the three-layer architecture at the component surface; wrapping it behind the hook eliminates that concern without discarding the work. The decision is contingent on the late-arrival gate in WI-R3F-2 — if the salvaged code cannot be made to pass it, this PRD's resource-loading strategy is reopened.
- **TODO.md inheritance**: Phases 1–13 and Phase 13.5 work items that are not explicitly in the salvage list above are superseded by this PRD. Items already completed and merged to `main` before the broken branch (parsers, linters, fixture scenes, the VS Code language providers) are inherited intact and remain in their completed state.
- Test count discipline: the existing 3,708-test suite should not shrink during this migration. Salvaged tests stay; new tests are added per the per-node-component plan; deleted tests correspond only to deleted modules (the imperative renderers).
- **WI-R3F-0.5 spike result — GREEN.** The compatibility spike was run against the latest stable releases and passed at the version pins listed under WI-R3F-1. No peer-dependency conflicts. The `findByType('Mesh')` Vitest test passed. Bonus: the stderr noise present in earlier stack combinations (Three.Clock deprecation warning, React `act()` warning) is absent at Vitest 4. The spike scratch project has been discarded; the validated pins are the authoritative starting point for WI-R3F-1.
