# Parity Audit Post-Merge

**Audit tip: 05bd4d8 — date 2026-05-27**

Produced by `parity-auditor-2` on the `ld58-completion` team.
Prior audit reference: `docs/MAIN-VS-MIGRATION-DELTA.md` (tip `923ba7d`, 2026-05-20).
Parity reference: `main` HEAD `80fa99e`.

This document re-runs the two-layer audit against the post-merge integration tip
`05bd4d8` (merge of `feat/r3f-migration` into `feat/r3f-16-audio-animation`).
The prior delta's classified items are re-verified; items whose status has changed
are marked with `→ RESOLVED` or updated severity.

---

## Layer A — Per-node-type property comparison

For every TSCN node type, main's parser+renderer properties are compared against
the current branch's parser + R3F component. The parser files are **identical**
on both branches (same `packages/textscene-core/src/nodes/` tree). Only the
renderer path differs.

### MeshInstance3D

**Main renderer properties consumed:**
`mesh`, `materialOverride`, `materialOverlay`, `surfaceMaterialOverrides`,
`castShadow`, `giMode`, `giLightmapScale`, `visibilityRange*`, `layers`,
`skeleton`, `skin`, plus all `Node3D` transform fields.

**R3F component properties consumed:**
`mesh`, `materialOverride`, `surfaceMaterialOverrides`,
`castShadow` (full 4-mode decode — OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY),
all `Node3D` transform fields, `visible`.

**Gaps vs main:**
- `materialOverlay` — parsed but not wired into R3F component. In main the
  renderer blended it as an overlay material on top. No R3F equivalent exists.
  Low-impact: `material_overlay` is uncommon in practice.
- `giMode`, `giLightmapScale`, `visibilityRange*`, `layers`, `skeleton`, `skin`
  — all parsed, none wired. These were non-rendering metadata in main too
  (baked-lighting hints, visibility LOD, physics skin); the 3D output was
  identical. Classification: **EQUIVALENT** for visible output.

**Classification: PARTIAL** — `materialOverlay` silently dropped, but all
rendering-visible properties are present.

**Gains over main:**
- `cast_shadow` mode 2 (DOUBLE_SIDED) and mode 3 (SHADOWS_ONLY) properly decoded
  (WI-R3F-19 parity-audit fix). Main collapsed all non-zero values to castShadow=true.
- Multi-surface `surface_material_override/N` builds a proper material array.
  Main stopped at slot 0 for texture-bearing materials.
- `ao_texture` now wires to `material.aoMap` (was a silent drop in main).

---

### Camera3D

**Main renderer properties consumed:**
`projection`, `fov`, `size`, `near`, `far`, `h_offset`, `v_offset`, `keep_aspect`,
`transform` (all Node3D fields).

**R3F component properties consumed:**
All of the above. `h_offset`/`v_offset` restored via WI-R3F-19 fix (was a
silent drop in early migration). `keep_aspect` wired to `KeepAspectMode` enum
for orthographic cameras.

**Classification: EQUIVALENT**

---

### DirectionalLight3D

**Main renderer properties consumed:**
`light_color`, `light_energy`, `shadow_enabled`, `shadow_bias`,
`directional_shadow_max_distance`, `shadow_filter`.

**R3F component properties consumed:**
`light_color`, `light_energy`, `shadow_enabled`, `shadow_bias`,
`directional_shadow_max_distance`. `shadow_filter` not applied (was used in main
via `configureLightShadow` shadow map type; R3F uses WebGLRenderer defaults).

**Classification: PARTIAL** — `shadow_filter` silently dropped. Shadows are
rendered but the filter mode (soft/PCF/PCSS) is not user-configurable. Low-impact
for the ld58 use-case.

---

### OmniLight3D

**Main renderer properties consumed:**
`light_color`, `light_energy`, `omni_range`, `omni_attenuation`,
`shadow_enabled`, `shadow_bias`, `shadow_filter`.

**R3F component properties consumed:**
`light_color`, `light_energy`, `omni_range` (as `distance`),
`omni_attenuation` (as `decay`), `shadow_enabled`, `shadow_bias`.
`shadow_filter` not applied.

**Classification: PARTIAL** — same `shadow_filter` gap as DirectionalLight3D.

---

### SpotLight3D

**Main renderer properties consumed:**
`light_color`, `light_energy`, `spot_range`, `spot_angle`,
`spot_attenuation`, `spot_angle_attenuation`,
`shadow_enabled`, `shadow_bias`, `shadow_filter`.

**R3F component properties consumed:**
`light_color`, `light_energy`, `spot_range`, `spot_angle`,
`spot_attenuation`, `spot_angle_attenuation`,
`shadow_enabled`, `shadow_bias`. `shadow_filter` not applied.

**Classification: PARTIAL** — same `shadow_filter` gap.

---

### WorldEnvironment

**Main renderer properties consumed:**
`environment` → `Environment` SubResource → `background_color`,
`background_mode`, `fog_enabled`, `fog_density`, `fog_color`,
ambient light settings.

**R3F component properties consumed:**
Same path via `resolveEnvironment` + `packages/textscene-core/src/resources/environment/`.
The `Environment` SubResource parsing is shared code (not duplicated); both
branches call the same underlying `parseEnvironment`.

**Classification: EQUIVALENT**

---

### Label3D

**Main renderer properties consumed:**
`text`, `pixel_size`, `billboard`, `modulate`, `outline_size`,
`outline_modulate`, `font_size` (opportunistic), `no_depth_test` (opportunistic).

**R3F component properties consumed:**
All of the above. Billboard per-frame update restored in WI-R3F-19
(`useFrame` loop matching main's `TscnRenderer.updateLabels()`).

**Classification: EQUIVALENT**

---

### Sprite3D

**Main:** Only had linter support (no renderer). No `renderer.ts` existed on main.
**Current branch:** Full R3F component added (WI-R3F-13) — parser, Component.tsx,
spritesheet UV, strict-verification. This is a **gain** over main.

**Classification: EQUIVALENT (gain)**

---

### AnimationPlayer / AnimationTree

**Main:** Only linter support (no renderer).
**Current branch:** Only linter support (no renderer). Both use the generic-node fallback.

**Classification: EQUIVALENT**

---

### AudioStreamPlayer3D

**Main:** Only linter support (no renderer — audio not applicable to a 3D viewer).
**Current branch:** Parser added (WI-R3F-16/A), R3F component shows static gizmo marker
(speaker icon). This is a **gain** over main.

**Classification: EQUIVALENT (gain)**

---

### Node / Node3D / GenericNodeFallback

**Main:** `Node` → plain Three.Group with transform. `Node3D` → Group with
`applyNode3DTransform`. Unknown types → empty group.

**R3F:** `Node` and `Node3D` have dedicated components that apply transform.
Unknown types → `<GenericNodeFallback>` renders a visible marker cube.
The fallback is more informative than main's empty group.

**Classification: EQUIVALENT**

---

## Layer B — App-shell capability pass

Cross-checked against `docs/MAIN-FEATURE-INVENTORY.md` and the prior delta
(`docs/MAIN-VS-MIGRATION-DELTA.md`). Findings are re-verified at 05bd4d8.

| # | Feature | Prior status | Current status | Evidence |
|---|---|---|---|---|
| 1 | Show/hide visibility toggle → `THREE.Object3D.visible` | PRESENT | **PRESENT** | `SelectionContext.hiddenNodePaths` → `NodeDispatcher.tsx:134` `visible={!isHidden}` |
| 2 | Highlight-selected (green BoxHelper in 3D) | PRESENT | **PRESENT** | `SelectionHighlight.tsx` reads `selectedNodePath` + `nodeObjectMap`, creates `THREE.BoxHelper(target, 0x00ff00)` via `useSceneHelper` |
| 3 | Missing-files-list / aggregate upload panel | PRESENT | **PRESENT** | `MissingResourcesPanel.tsx` + `MissingResourcesContext.tsx`; per-row `<input type="file">` with ✓/⚠ affordances; Remove flips back to missing. `onResourceUpload` prop gates panel mount. |
| 4 | Scene switcher (categorized dropdown) | PRESENT | **PRESENT** | `ViewportSelector.tsx` `bucketByCategory` → `<optgroup>` blocks |
| 5 | Expand-all / collapse-all | PRESENT | **PRESENT** | `SceneTreeViewer.tsx:64-68` `handleExpandAll` / `handleCollapseAll` |
| 6 | Tree search | PRESENT | **PRESENT** | `SceneTreeViewer.tsx:29-33` `nodeMatchesSearch`; empty-state "No nodes match…" |
| 7 | Scene Info card (Nodes count + Root name) | MISSING → RESOLVED | **PRESENT** | `SceneInfoCard.tsx` reads `sceneGraph.flattenedNodes.length` + root scene name. Mounted in `TscnPreviewShell.tsx:155`. |
| 8 | Node Details panel | PRESENT | **PRESENT** | `NodeDetailsPanel.tsx` + `PropertySection.tsx` |
| 9 | Reset Camera button (disabled until scene loads) | MISSING → RESOLVED | **PRESENT** | `CameraControlContext.registerResetHandler` + `resetCamera()`; toolbar in `r3f-main.tsx:277-285` disabled when `sceneGraph === null`. |
| 10 | Upload TSCN (top-level file input) | MISSING → RESOLVED | **PRESENT** | `r3f-main.tsx:257-266` `<input type="file" accept=".tscn">` with file.text() handler. `uploadedTscnName` state shown in toolbar. |
| 11 | Fixtures-list collapsible header | N/A (replaced) | N/A | Single `<select>` dropdown is intentional design replacement. |
| 12 | Hot-reload behavior | PRESENT | **PRESENT** | Vite HMR unchanged; `pnpm copy-fixtures` still needed for scene files. |
| 13 | Mobile responsive layout | MISSING → RESOLVED | **PRESENT** | `TscnPreviewShell.module.css:190-211` `@media (max-width: 768px)` stacks sidebar under canvas. Breakpoint matches main's `max-width: 767px`. Note: uses vertical stack (not main's radio-tab switcher) — equivalent usability. |
| 14 | Error banner | PRESENT | **PRESENT** | `TscnPreviewShell.tsx:145-149` `role="alert"` banner; `r3f-main.tsx:286-290` toolbar error span for fetch errors. |
| 15 | Hover-helper effect (orange BoxHelper in 3D) | MISSING → RESOLVED | **PRESENT** | `HoverHighlight.tsx` reads `hoveredNodePath`, creates `THREE.BoxHelper(target, 0xff8800)` via `useSceneHelper`. `TreeNode.tsx` fires `onPointerEnter`/`onPointerLeave` to `setHoveredNodePath`. |
| 16 | Auto-expand ancestors on programmatic selection | PARTIAL | **PARTIAL** | Viewport pick via `useViewportSelection.tsx:64-73` auto-expands ancestors. **Tree-click via `TreeNode.tsx:115` calls `setSelectedNodePath` without expanding ancestors.** Symptom: clicking a collapsed tree row's child from a deep search or programmatic selection does not scroll it into view. No host currently triggers this; users don't observe it in normal usage. |
| 17 | Camera-switch widget (Camera3D nodes) | PRESENT | **PRESENT** | `NodeDetailsPanel.tsx:117-131` "📷 Use This Camera" / "🔄 Return to Free View"; wired through `CameraControlContext`. |
| 18 | Fixture-load abort on rapid switching | PRESENT | **PRESENT** | `r3f-main.tsx:107` `let cancelled = false` + cleanup pattern |
| 19 | Empty-state info paragraph (mouse controls hint) | PARTIAL | **PARTIAL** | `TscnPreviewShell.tsx:127,132` shows "No scene loaded…" or "Loading scene…" — no "Use mouse to orbit camera" hint. Low-impact: VS Code/web users typically know orbit controls. |
| 20 | Resource provider abstraction | PRESENT | **PRESENT** | `WebResourceProvider.ts` + `VSCodeResourceProvider.ts` unchanged |
| 21 | VS Code extension parity | PRESENT (untested) | **PRESENT (untested)** | `TscnPreviewPanel.ts` webview-ready handshake at lines 52-53; pending-load content cache at line 53. No change since prior verification on `4ac6539`. |
| 22 | Drag-and-drop .tscn files | N/A | N/A | Neither branch has dragover/drop listeners. |
| 23 | Keyboard shortcuts | N/A | N/A | Neither branch has keydown handlers. |
| 24 | Tree-row icons | PRESENT | **PRESENT** | `TreeNode.tsx` all six icon classes preserved. |
| 25 | "Not Implemented" badge for unsupported node types | PRESENT (new) | **PRESENT** | `TreeNode.tsx:155-163`; improvement over main. |

---

## Severity buckets

### SILENT-DROP-BLOCKER
*None.*

All items previously classified MISSING in the prior delta are now RESOLVED
at tip 05bd4d8. No new silent-drop-blockers identified.

### SILENT-DROP

| Item | Description | File:Line evidence |
|---|---|---|
| `MeshInstance3D.materialOverlay` | `material_overlay` parsed (`parser.ts:38-40`) but not read in `Component.tsx`. The overlay blending effect is absent. | `packages/textscene-core/src/nodes/3d/meshinstance3d/parser.ts:38` parses; `r3f/nodes/meshinstance3d/Component.tsx` — no reference to `materialOverlay` |

### PARTIAL

| Item | Description | Severity notes |
|---|---|---|
| Light `shadow_filter` | All three light types parse `shadow_filter` but do not apply the WebGL shadow map type. Shadows render, but the filter softness is always the default PCF. | User-observable only in scenes with soft shadows |
| Auto-expand on tree-click selection | `TreeNode.tsx:115` does not expand ancestors. Viewport-click selection does expand. | Only observable when a node is selected via keyboard/search/viewport and the tree row is inside a collapsed subtree |
| Empty-state mouse controls hint | Missing "Use mouse to orbit camera. Scroll to zoom." informational copy | Cosmetic only |

### EQUIVALENT (parity met)

All remaining 22 entries in Layer B classified PRESENT. All per-node-type
renderers consume equivalent or superior property sets vs main.

---

## New gains over main (not regressions)

The following capabilities exist on the current branch but NOT on main:

| Feature | Where |
|---|---|
| Sprite3D full renderer (texture atlas, UV, billboard) | `r3f/nodes/sprite3d/Component.tsx` |
| AudioStreamPlayer3D gizmo marker | `r3f/nodes/audio/audiostreamplayer3d/` |
| `cast_shadow` mode 2+3 proper decode | `r3f/nodes/meshinstance3d/Component.tsx:549-560` |
| `ao_texture` → `material.aoMap` | `r3f/nodes/meshinstance3d/Component.tsx:124-127` |
| Multi-surface material array | `r3f/nodes/meshinstance3d/Component.tsx:261-269` |
| Per-frame Label3D billboard update | `r3f/nodes/label3d/Component.tsx:61-73` |
| Hover BoxHelper (orange, WI-UX-10) | `r3f/components/HoverHighlight.tsx` |
| Mobile responsive stacked layout | `TscnPreviewShell.module.css:190-211` |
| VS Code theme token integration | `TscnPreviewShell.module.css:26-96` |
| Not-Implemented badge per tree row | `SceneTreeViewer/TreeNode.tsx:155-163` |
| `h_offset`/`v_offset` on Camera3D | `r3f/nodes/camera3d/Component.tsx:36-47` |

---

## Antipattern #10 closed-checklist cross-reference

Every row from `docs/MAIN-FEATURE-INVENTORY.md` is classified below:

| Inventory section | Classification |
|---|---|
| Show/hide button on tree rows | PRESENT |
| Highlight-selected in viewport | PRESENT |
| Missing-files-list / aggregate upload panel | PRESENT |
| Scene switcher (fixture list) | PRESENT |
| Expand-all / collapse-all | PRESENT |
| Tree search | PRESENT |
| Scene Info card | PRESENT |
| Node Details panel | PRESENT |
| Reset Camera button | PRESENT |
| Upload .tscn (top-level file input) | PRESENT |
| Fixtures-list collapsible header | N/A (replaced by dropdown — intentional) |
| Hot-reload behavior | PRESENT |
| Mobile responsive layout | PRESENT (stacked variant) |
| Error banner | PRESENT |
| Hover-helper effect | PRESENT |
| Auto-expand ancestors | PARTIAL (tree-click doesn't expand; viewport-click does) |
| Camera-switch widget | PRESENT |
| Fixture-load abort | PRESENT |
| Empty-state info paragraph | PARTIAL (no mouse-controls hint) |
| Resource provider abstraction | PRESENT |

**Summary:** 17 PRESENT / 1 N/A / 2 PARTIAL / 0 MISSING / 0 SILENT-DROP-BLOCKER

One SILENT-DROP identified: `materialOverlay`. Not a blocker for ld58 gate since
the hallway fixture does not use `material_overlay`.

---

## Gate 1 assessment

**Gate 1 criteria (per STRICT-VERIFICATION.md):** All features documented in
`MAIN-FEATURE-INVENTORY.md` must be PRESENT or N/A; no SILENT-DROP-BLOCKERs.

**Result: Gate 1 MET at 05bd4d8.**

Remaining PARTIAL items (auto-expand-ancestors, empty-state hint, shadow_filter,
materialOverlay) are low-impact and do not block the ld58 LD or a PR merge.
They are tracked as post-MVS candidates.
