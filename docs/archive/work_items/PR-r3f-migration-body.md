Replaces the broken Phase 13.5 imperative reconciler with a React-Three-Fiber rendering pipeline. The result is a declarative, per-node-component architecture backed by React's reconciler — no custom diffing, no singleton managers, no three-layer event bus exposed at component surfaces.

## What changed

- **WI-R3F-0**: Cherry-picked salvageable work from the broken `claude/plan-event-foundation-*` branch onto a clean `main` baseline; bumped TypeScript to `^6.0.3` and Vitest to `^4.1`; fixed all TS 6 compile errors in salvaged code.
- **WI-R3F-0.5**: Ran a throwaway compatibility spike confirming the full target stack (React 19, R3F v9, drei, test-renderer, Vitest 4) installs cleanly and the central `findByType('Mesh')` test passes.
- **WI-R3F-1**: Added React 19, `@react-three/fiber` v9, `@react-three/drei`, `@react-three/test-renderer` to the pnpm catalog; wired CSS Modules into the Vite build; mounted a blank `<TscnCanvas>` in both apps; verified CSS bundle loads under VS Code webview CSP.
- **WI-R3F-2**: Implemented `useResource<T>(path, type)` hook returning `{ value, status }` (`pending | loaded | missing | error`). Wraps the salvaged WI-79 FileEventBus → ResourceEventBus → ResourceLoader pipeline internally. Late-arrival hard gate passes: a mesh missing at scene load re-renders automatically when the user later provides the file, scoped to only the affected meshes via `nodeDependsOnPath`.
- **WI-R3F-3**: Ported 11 MVS node components with co-located `@react-three/test-renderer` tests: `<Node>`, `<Node3D>`, `<MeshInstance3D>` (BoxMesh, SphereMesh, PlaneMesh, CylinderMesh, CapsuleMesh, QuadMesh, TorusMesh), `<Camera3D>`, `<DirectionalLight>`, `<OmniLight>`, `<SpotLight>`, `<WorldEnvironment>`, `<Label3D>`, `<GenericNodeFallback>`. NodeComponentRegistry self-registers on import, mirroring the existing NodeRegistry pattern.
- **WI-R3F-4**: Ported DOM UI to React: `<SceneTreeViewer>`, `<NodeDetailsPanel>`, `<ViewportSelector>` (web-only file dropdown), `<TscnPreviewShell>` (layout root); introduced `SelectionContext` and `HierarchyContext` scoped per panel (replaces `SelectionManager` singleton). Two panels open simultaneously have fully independent selection state.
- **WI-R3F-5**: Wired the node-component dispatcher into `<TscnCanvas>`; connected click-to-select via `useViewportSelection`; added helper gizmos for DirectionalLight, OmniLight, SpotLight, Camera3D, and AudioStreamPlayer3D; camera orbit state now survives content-only hot-reloads.
- **WI-R3F-6**: Deleted all imperative renderer modules (TscnRenderer, NodeLifecycleManager, NodeTracker, SelectionManager, CameraManager, HelperManager, ResourceRecoveryManager, all `nodes/**/renderer.ts`, all `ui/*.ts`, `generate-styles.mjs`); removed CSS-Modules and R3F feature flags; updated `ARCHITECTURE.md`.
- **WI-R3F-7**: Fixed 5 user-facing failures from first verification pass: webview-ready handshake (extension host caches and replays `loadTscn` until React listener installs), full texture-chain resolution (material_override → SubResource → ExtResource), magenta placeholder + floating label for missing textures, `<GenericNodeFallback>` type:name labels, malformed-file parse-error banner.
- **WI-R3F-8**: Wired all 5 StandardMaterial3D texture slots (normal, roughness, metallic, emission — albedo was the only one connected); applied UV transform (`uv1_scale`, `uv1_offset`) to every active texture map, not just albedo.
- **WI-R3F-9**: Implemented 96 property regression tests across 9 co-located test files (see `docs/archive/STRICT-VERIFICATION.md` Section 1 inventory). Tests assert THREE.js output values directly — not parser output, not that a function was called. These tests are the first-line CI gate for silent property misses.
- **WI-R3F-10**: Batch-fixed 20 silent feature misses surfaced by strict verification: Node3D rotation Euler conversion, multi-surface material override binding, `visible` flag, transparency/blend/cull modes, `normal_scale`, `PlaneMesh` center_offset and orientation, `Camera3D` keep_aspect, `SpotLight` penumbra, `WorldEnvironment` SKY mode and ambient light, `Label3D` billboard/no_depth_test/modulate/font_size.
- **WI-R3F-11**: Fixed `surface_material_override` texture binding (textures on indexed surface slots were overriding material correctly but losing texture map references on re-render). Final commit on this branch: `4ac6539`.

## What was preserved

- TSCN parser (lenient rendering parser + strict linting parser) — unchanged
- Full linter with THREE-free bundle isolation — unchanged
- All node-type parsers and linters, including non-MVS types (2D nodes, physics, audio, animation, particles, Skeleton3D) — unregistered types fall through to `<GenericNodeFallback>`
- WI-79 event-based resource pipeline — retained as internal implementation of `useResource`
- VS Code `TscnDefinitionProvider` and `TscnDocumentSymbolProvider` — unchanged
- File-watcher hot-reload in `extension.ts` — unchanged
- All scene fixtures in `scenes/`
- Full unit test suite (**2988 tests passing post-cleanup** across 115 files; 0 fails, 0 expected-fail, 4 skip)

## Verification

Strict-protocol end-to-end verification across 11 checklists at `docs/archive/strict-checklists/`. Methodology: `docs/archive/STRICT-VERIFICATION.md`. Each row in a checklist names the TSCN property, its expected THREE.js value, and the observed value — no row may be marked PASS on visual impression alone.

- **Web app** (4 checklists, 70 rows): 69 PASS / 1 CANT-VERIFY / 0 FAIL
- **VS Code extension** (7 checklists, 108 rows): 103 PASS / 5 CANT-VERIFY / 0 FAIL
- **Combined**: 172 PASS / 6 CANT-VERIFY / 0 FAIL across 178 rows
- All 6 CANT-VERIFYs tied to harness limitations (cross-origin webview iframe inaccessibility, VS Code Outline virtualization); each has a Section 1 regression test covering the property.
- The UV-scale fixture proved the strict protocol end-to-end: WI-R3F-9 unit tests caught the regression before re-verification, WI-R3F-11 fixed it, strict checklist PASSed.

First verification pass (pre-WI-R3F-7) discovered 5 user-facing failures and exposed the need for the strict framework. Strict re-verification discovered 20 silent feature misses, all fixed in WI-R3F-8/10/11. 0 canaries (`git grep EXPECTED-FAIL` returns empty).

## Strict-verification artifacts

11 per-flow strict checklists live in `docs/archive/strict-checklists/`. The framework definition — property inventory, snapshot strategy, verifier protocol, and CI integration rules — is at `docs/archive/STRICT-VERIFICATION.md`. The 96 property regression tests are co-located with each Component (e.g., `meshinstance3d/Component.material-uv.test.tsx`); they run in `pnpm test:unit` and block CI on any regression.

## Spike result

See `work_items/SPIKE-r3f-migration.md` for the full path-comparison reasoning, non-React alternatives watchlist, and the stack compatibility analysis that produced the version pins.

## Bundle size

`apps/textscene-vscode/dist/webview.js`:

| | Raw | Gzipped | Δ vs main |
| --- | --- | --- | --- |
| main baseline (pre-migration) | 1,429,646 B | 247,543 B | — |
| This PR (`4ac6539`) | **3,691,702 B** | **629,543 B** | **+382 KB gzipped** |

**Over the +200 KB gzipped budget by ~182 KB.** Intrinsic to React 19 + R3F v9 + drei + the full three.js surface. WI-R3F-8/10/11 added ~5 KB total. Three reduction options documented in `ARCHITECTURE.md` (subset three.js imports, lazy-load `<NodeDetailsPanel>` and `<SceneTreeViewer>` into separate chunks, switch the webview build to ESM with code-splitting). Accepted as a known follow-up rather than blocking the migration.

## Known limitations

- **WEB-07**: Web app has no content-only file-watch path; users re-select the fixture to reload. VS Code hot-reload works correctly. Architectural — web app has no file-watcher API.
- **VSCODE-04**: `res://` → file Go-to-Definition not implemented; salvaged provider navigates within-file `SubResource`/`ExtResource` IDs only. Pre-existing gap, not a migration regression.
- **Bundle size**: 182 KB over the +200 KB gzipped budget. Tracked as a follow-up (see above).

## Known follow-ups (intentional out-of-scope)

- **WI-R3F-3.x**: 2D nodes (Node2D, Sprite2D, AnimatedSprite2D, Camera2D), physics (StaticBody3D, RigidBody3D), audio (AudioStreamPlayer3D), animation (AnimationPlayer, AnimationTree), particles (GPUParticles3D), paths (Path3D, PathFollow3D), Skeleton3D, Sprite3D — tracked as backlog items
- **Material feature flags WI-65..75**: physically-based shading flags, advanced material properties — post-migration feature work
- **`PropertyItem.value` migration**: currently HTML strings in `<NodeDetailsPanel>`; migration to ReactNode is a follow-up

## Refs

Closes #44
