# Visual A/B — `main` vs `feat/r3f-migration`

**Compares**: `main` @ `80fa99e` vs `feat/r3f-migration` @ `2e065d5` (migration HEAD as of dispatch).
**Captured**: 2026-05-20, by `ui-designer` on team `tscn-rescue`.
**Viewport**: 1440 × 900 (desktop), Chromium via Playwright.
**Screenshots**: `.tmp/visual-ab/<name>-{main,migration}.png` (gitignored).
**Fixtures sampled**: empty / `unit-plane-mesh.tscn` / `integration-all-primitives.tscn` / `example-hallway.tscn` (286 nodes, 19 missing files) / `edge-malformed-bracket.tscn`.

This audit answers a different question than `UI-IMPROVEMENTS.md`. That doc was a forward-looking polish list against the migration's own self-defined baseline. This doc is a backward-looking parity check: **what specifically got worse vs `main` that we should fix before merging**. Both docs share findings (the selection-row + tree-row work is already polished); the gap below is what main currently does *better*.

---

## Layout summary

### `main`

Three columns, `grid-template-columns: auto auto 1fr`:

1. **Left controls (450 px)** — Upload TSCN button, categorised fixture accordion (`Test Fixtures > Edge Cases / Examples / Integration / Unit ...`), Reset Camera **(blue primary button)**, Scene Info card (green accent), and Resource Files list with folder icon header.
2. **Middle Scene Tree column (350 px)** — header "Scene Tree" + expand/collapse icon buttons (gray pills), search box, then tree rows. The tree owns the whole height of the column.
3. **Right viewport (`1fr`)** — clean 3D canvas with a faint XZ grid.

Details panel renders *inline at the bottom of the middle column* under the tree, when a node is selected.

### `feat/r3f-migration`

Two columns, viewport on the left and a single 320 px right sidebar that stacks four panels vertically inside one `<aside>`:

1. **Toolbar row** (top of shell) — "TextScene Inspector" title + flat fixture `<select>` + Upload TSCN button.
2. **Reset Camera bar** — full-width gray button immediately under the toolbar.
3. **Left/main**: viewport canvas.
4. **Right sidebar (320 px)**, stacked vertically: Scene Info card → Missing Resources panel → Scene Tree → Node Details panel.

The migration removes the dedicated Scene Tree column and folds tree + details + scene-info + missing-files into one narrow sidebar. This is where most of the regressions below originate.

---

## Findings

Ordered by severity (high → low). Each finding has a proposed fix file:line and rough effort.

### 1. Scene Tree disappears below the fold on any scene with several missing resources

**Severity**: **HIGH** — at 1440×900 with `example-hallway.tscn` (19 missing files), the Scene Tree `[role="tree"]` lives at `y ≈ 1752 px` inside an `<aside>` that's `782 px` tall. The tree is *not visible at all* — the user has to scroll the panel before they can select anything.

**What main does**: Scene Tree lives in its own 350 px-wide column with its own scrollbar. Resource Files list is in the *left controls column* where its growth doesn't compete with the tree.

**What migration does**: Stacks `SceneInfoCard` + `MissingResourcesPanel` + `treePane` + `detailsPane` inside one `<aside>`. `MissingResourcesPanel` has no `max-height` and renders one row per missing file, so it grows to ~1500 px and pushes everything else off-screen. `.treePane` and `.detailsPane` set `flex: 1; min-height: 0` but the missing-resources block above them is `flex: <auto>` and wins the height race.

**Fix proposal**:

- `packages/textscene-core/src/r3f/components/MissingResourcesPanel/MissingResourcesPanel.module.css:1` — give `.panel` a `max-height` (e.g. `40vh` or `min(40vh, 320px)`) plus `overflow-y: auto`, so the missing-files list scrolls *inside the panel* rather than pushing the tree off-screen.
- *Or* `packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.module.css:119` — give `.sidebar` an explicit `display: grid; grid-template-rows: auto auto 1fr 1fr;` to pin the missing-files panel to a content-sized row and let tree + details split the rest 50/50.
- *Or* restore main's three-column layout: move `MissingResourcesPanel` into the canvas-side toolbar/footer instead of the right rail. Higher effort, biggest parity win.

**Effort**: trivial (just the `max-height` cap) → substantial (full layout restructure).
**Impact**: **high** — without this, Hallway-scale scenes are unusable for selecting nodes via the tree.

---

### 2. Reset Camera loses its primary-action affordance

**Severity**: high.

**What main does**: `Reset Camera` is a saturated **blue button** (var(--bg-select) ≈ `#094771`) that anchors the controls column. It reads as the primary action you can take when no node is selected.

**What migration does**: `Reset Camera` is a **flat gray full-width bar** with no fill, sitting between the toolbar and the canvas. Looks more like a divider than a button. When the button is disabled (no scene loaded) it's nearly invisible against the panel background.

**Fix proposal**: `apps/textscene-vscode/src/webview/webviewHtml.ts` *and* `apps/textscene-web/src/main.tsx`/wherever `Reset Camera` is rendered in the web app — give the button `background: var(--tsi-accent-soft)` and `color: var(--tsi-accent-fg)` for the enabled state, current gray for the disabled state. Same height it has now is fine; just colour it.

**Effort**: trivial.
**Impact**: medium — affects how "primary" the action reads. Currently the button looks decorative.

---

### 3. Default-load fixture causes a saturated red banner on first render

**Severity**: medium — first impression / new-user UX.

**What main does**: First load shows the empty viewport with the message "Select a .tscn file to preview it in 3D." in the left column. No error.

**What migration does**: The select defaults to "Hallway", which loads on mount and resolves to 19 missing external resources. With the default ResourceProvider returning `null` for unresolved paths, parsing/loading proceeds but the page surfaces a red `Parse error: Parser could not extract any nodes from the content. The file may be malformed.` banner (when the picker was on an empty file) *and* a wall of yellow caution-icon resource rows. New visitor's first impression of the app is "errors".

**Fix proposal**: `apps/textscene-web/src/main.tsx` (or wherever the initial-fixture state is set) — default the `<select>` to a small scene with no external references, e.g. `unit-plane-mesh.tscn` or `unit-box-mesh.tscn`. Hallway is a great showcase but should be opt-in, not the first thing visitors see.

**Effort**: trivial.
**Impact**: high — first-load impression directly affects how the app reads.

---

### 4. Viewport pollutes "info" rendering with yellow Camera3D wireframe gizmos by default

**Severity**: medium-high.

**What main does**: On `example-hallway.tscn`, the viewport renders the actual hallway geometry — visible wooden door, red carpet runner, white-frame windows on the side. Clear and readable as a 3D scene.

**What migration does**: Same fixture shows **dozens of yellow wireframe Camera3D frustums** projecting everywhere across the scene, plus magenta wireframe cubes that I think are AudioStreamPlayer3D gizmos, all of which crowd out the actual geometry. Looks like a debug overlay accidentally left on.

**Fix proposal**: `packages/textscene-core/src/r3f/components/Camera3D.tsx` (and `AudioStreamPlayer3D.tsx`) — gate the gizmo rendering behind a "show gizmos" toggle that defaults to **off**, or only show the gizmo when the matching tree node is **selected/hovered**. Main's renderer was apparently more conservative about overlay primitives.

**Effort**: moderate (touches the per-node component + needs a context flag).
**Impact**: **high** — directly affects whether the app's primary surface (the 3D viewport) is intelligible at first glance for non-trivial scenes.

---

### 5. Fixture selector regresses from categorised accordion to flat `<select>`

**Severity**: medium.

**What main does**: Custom "Test Fixtures" accordion. Items are grouped by category (`Edge Cases`, `Examples - Complex Scenes`, `Integration - Multi-Node`, `Unit - Primitive Meshes`, etc.). Each row is a click target with a hover affordance. Categories act as scannable section headers.

**What migration does**: A single native `<select>` with all 54 fixtures dumped flat, no grouping. The option `Hallway` is mixed in with `Plane Mesh` and `Material Emissive` with no visual breaks. The native dropdown also has the OS look-and-feel mismatch in dark mode (a gray border + system focus ring).

**Fix proposal**: `packages/textscene-core/src/r3f/components/ViewportSelector/ViewportSelector.tsx` — switch from `<select>` to `<select>` with `<optgroup label="Edge Cases">…</optgroup>` for each category. Native `<optgroup>` is supported everywhere and gets us back to grouping without a custom component. Larger fix: build a dedicated accordion component for parity with main.

**Effort**: trivial (optgroups) → moderate (custom component).
**Impact**: medium — affects how quickly a developer can find a fixture, especially as the fixture count grows.

---

### 6. No Scene Tree column header — only an icon row

**Severity**: medium.

**What main does**: The Scene Tree column has a "Scene Tree" `<h2>` label, then a row of expand/collapse buttons (gray pills with `⊞` / `⊟` icons), then the search box. Clear hierarchy: section title → controls → input.

**What migration does**: No "Scene Tree" label anywhere. The search box and the two icon buttons are jammed on a single row with the buttons floating to the search box's right. With no label, the user has to infer that this column is the tree from context (the rows below).

**Fix proposal**: `packages/textscene-core/src/r3f/components/SceneTreeViewer/SceneTreeViewer.tsx` — add an `<h2>Scene Tree</h2>` (or `<header>`) above the controls row. `SceneTreeViewer.module.css` already has `--tsi-font-md` / `--tsi-font-lg` for headings.

**Effort**: trivial.
**Impact**: low-medium — affordance / scannability.

---

### 7. Migration adds Scene Info card but at the cost of the Resource Files header

**Severity**: medium.

**What main does**: Resource Files panel has a clear `<h3>📁 Resource Files</h3>` heading with a folder emoji, and items are spaced with consistent padding. The panel reads as a self-contained section.

**What migration does**: Resource Files renders without an icon header — just an uppercase `RESOURCE FILES` text label that visually collides with the `SCENE INFO` card above it. Both share the same dark-on-dark treatment with no visual division between them.

**Fix proposal**: `packages/textscene-core/src/r3f/components/MissingResourcesPanel/MissingResourcesPanel.module.css:11` — give `.title` either a folder/upload icon or a left-border accent (similar to `.item.uploaded`). Better separation between Scene Info and Resource Files in the sidebar.

**Effort**: trivial.
**Impact**: low-medium.

---

### 8. Empty-viewport state hides the "Load a scene" guidance behind 3D rotation

**Severity**: low-medium.

**What main does**: When no scene is loaded, the left column shows a "Select a .tscn file to preview it in 3D. Use mouse to orbit camera. Scroll to zoom." panel. That's plain DOM text the user can read at any time.

**What migration does**: Renders "Load a scene to begin" as a giant 3D text label inside the canvas, tilted to camera angle. Looks more polished as a hero moment but is unreadable when the user orbits to a non-axis-aligned view, and the operating guidance ("orbit / zoom") is dropped entirely.

**Fix proposal**: Two options:
1. Keep the canvas-rendered "Load a scene to begin" text but add a small bottom-left DOM overlay with "Mouse: orbit · Scroll: zoom" — `packages/textscene-core/src/r3f/TscnCanvas.tsx`.
2. Skip the 3D text, render an empty viewport, and put the guidance in a DOM panel under the Reset Camera button.

**Effort**: trivial.
**Impact**: low.

---

### 9. Toolbar has no visual separation from the canvas, no padding

**Severity**: low-medium.

**What main does**: A clear `<header>` band at the top of the page, padded `1rem`, with a bottom border. The "TextScene Inspector" title gets breathing room.

**What migration does**: The "TextScene Inspector" title is jammed onto the same line as the fixture select and the upload button, with minimal padding. The Reset Camera bar abuts the toolbar above and the canvas below with no visible separator. Compresses the chrome but feels cluttered.

**Fix proposal**: Add a thin `border-bottom: 1px solid var(--tsi-border);` and `padding: var(--tsi-space-2) var(--tsi-space-3);` to the toolbar wrapper in the web/extension entry html — `apps/textscene-web/index.html` (toolbar element wrapping fixture select). The shell `.shell` already has flex column; this is purely the toolbar div's padding.

**Effort**: trivial.
**Impact**: low.

---

### 10. Migration's tree rows use a green `↕` indicator next to the type badge that has no visible legend

**Severity**: low.

**What main does**: Tree rows show `[type-badge] [name]` with eye icon on right for visibility. Simple two-zone layout.

**What migration does**: Adds a small green `↕` (or similar arrow) glyph between the badge and the eye icon on each non-root row. I can't tell from outside what it means — drag-handle? expand-hint? "has-children"? No legend, no tooltip in my reading.

**Fix proposal**: If it's a drag-handle that's not actually wired up (drag-reorder isn't a TSCN feature), remove it: `packages/textscene-core/src/r3f/components/SceneTreeViewer/TreeNode.tsx`. If it's serving a purpose, add a `title=` attribute and possibly only render when relevant (e.g. only on hover).

**Effort**: trivial (verify intent first).
**Impact**: low.

---

### 11. Reset Camera button is full-width and dominates the toolbar row

**Severity**: low.

**What main does**: Reset Camera sits inside the left controls column, 450 px wide, separate from the canvas chrome.

**What migration does**: Reset Camera spans the entire window width (~1120 px when sidebar is 320 px) as a thin bar between the toolbar and the canvas. Visually disproportionate for a single action.

**Fix proposal**: Wrap Reset Camera in a flex row with `align-items: flex-end; justify-content: flex-end` and width-cap the button to ~12 rem. Or move it into the toolbar row alongside the fixture select. `packages/textscene-core/src/r3f/components/TscnPreviewShell/TscnPreviewShell.tsx:144` — wherever the `toolbar` prop is rendered.

**Effort**: trivial.
**Impact**: low.

---

### 12. No visible "Resource Files" / "Scene Info" affordance distinction in sidebar

**Severity**: low.

**What main does**: Scene Info card has a distinct **dark green** background. Resource Files header has a folder emoji. Easy to scan and tell apart at a glance.

**What migration does**: Both `Scene Info` and `Resource Files` sit on the same dark panel background. The Scene Info card has a slim left border accent only; both labels are the same uppercase small text style. Without colour or icon differentiation, the user has to *read* to tell which section they're looking at.

**Fix proposal**: `packages/textscene-core/src/r3f/components/SceneInfoCard/SceneInfoCard.module.css` — restore some accent (a left border in `--tsi-success` would be on-token, or a subtle background tint). Keep VS-Code theme compatibility — accent has a VS Code analog (`--vscode-terminal-ansiGreen`).

**Effort**: trivial.
**Impact**: low.

---

### 13. Eye icon for visibility uses native emoji `👁️`, which renders differently across OSes

**Severity**: low.

**What main does**: Eye icon — same emoji `👁️`. Same problem.

**What migration does**: Same — also emoji.

**Fix proposal**: Replace with an inline SVG eye icon. Either roll one or pull from `lucide-react` / a similar minimal icon set. Same fix for `⊞` / `⊟` expand-collapse glyphs. This is a parity-neutral fix (main has the same gap) but worth doing while we're in the area.

**Effort**: moderate.
**Impact**: low (works everywhere; just looks slightly off on Linux Chromium / older Windows).

---

### 14. Migration's `<aside>` lacks a top-of-sidebar header label

**Severity**: low.

**What main does**: Each column gets a header — the tree column has "Scene Tree" prominently. The left controls column has "Upload TSCN File:" inline labels.

**What migration does**: The sidebar starts straight into Scene Info → Resource Files. No "Inspector" or "Details" framing label.

**Fix proposal**: Optional — add a sticky header at the top of the sidebar with a "Scene" or "Inspector" label, matching the toolbar's typography. Low priority because the content immediately reveals what it is.

**Effort**: trivial.
**Impact**: very low.

---

### 15. Migration's `Reset Camera` button stays in the layout when no scene is loaded, looks like an empty divider

**Severity**: very low.

**What main does**: Reset Camera button is disabled (greyed out) when no scene is loaded but still readable.

**What migration does**: Reset Camera shows as a gray bar with the text greyed to near-invisible. With no scene loaded the whole row looks decorative rather than functional. Reinforces the issue from finding #2.

**Fix proposal**: Same as #2 (give the disabled state a slightly more visible foreground colour so it reads as "button, currently off" rather than "divider").

**Effort**: trivial (covered by #2).
**Impact**: very low.

---

## What the migration does BETTER than main

For completeness — these should not be regressed when fixing the above:

- **Parse-error banner**: Migration shows a clear red banner with the parse error message when content can't be parsed. Main silently displays "No nodes to display" with no indication that anything is wrong. This is a genuine UX improvement to keep.
- **Selection-row affordance in tree**: Migration's selected row has a deep-blue background + a left blue-accent border. Visually crisper than main's selection state.
- **Type badge fixed-width formatting**: Migration's `MESH` / `OMNI` / `DIR` / `N3D` badges are consistently sized pills. Main's badges look a touch more ad-hoc in width.
- **Scene change reset**: Migration's `SceneChangeResetter` (TscnPreviewShell.tsx:193) clears selection/hover/expanded state on scene switch — main reportedly didn't (per docs/archive/MAIN-VS-MIGRATION-DELTA.md).
- **Missing-resource upload UI**: Migration lets the user upload missing files inline per row. Main's Resource Files panel shows the same info but with separate `Choose File` buttons in a slightly less polished layout.
- **`SceneInfoCard`** itself: Main has a similar card but the migration's keeps the "Nodes / Root" stat clean and is easier to scan.

---

## Roadmap

| # | Area | Severity | Effort | Pre-merge? |
|---|------|----------|--------|-----------|
| 1 | Scene Tree off-screen with missing files | high | trivial → substantial | **yes** |
| 4 | Camera/Audio gizmos default-on cluttering viewport | high | moderate | **yes** |
| 2 | Reset Camera lost primary-action colour | high | trivial | **yes** |
| 3 | Default fixture loads error-state | medium | trivial | **yes** |
| 5 | Fixture selector — flat select vs categorised | medium | trivial (optgroups) | **yes** |
| 6 | No "Scene Tree" column header | medium | trivial | **yes** |
| 7 | Resource Files lost folder-icon header / accent | medium | trivial | yes |
| 11 | Reset Camera full-width disproportionate | low | trivial | yes |
| 9 | Toolbar has no padding / divider | low-medium | trivial | yes |
| 12 | Scene Info / Resource Files visually identical | low | trivial | no |
| 8 | "Load a scene" guidance rendered in 3D | low-medium | trivial | no |
| 14 | Sidebar lacks a top-of-rail label | very low | trivial | no |
| 10 | Mystery green `↕` glyph in tree rows | low | trivial | no |
| 15 | Reset disabled state too dim | very low | trivial (rolls into #2) | no |
| 13 | Emoji icons (eye, ⊞/⊟) cross-OS rendering | low | moderate | no |

**Pre-merge count**: 9.

The minimum viable fix list before merging the migration is items 1, 2, 3, 4, 5, 6, 7, 9, 11. Of those, items 1 and 4 carry the most user impact — they directly determine whether someone loading a non-trivial scene can navigate it. Items 2/3/5/6 collectively bring the chrome up to main's polish level. Items 7/9/11 close visible parity gaps without much effort.

Items 8, 10, 12, 13, 14, 15 can ship in a follow-up polish pass; they're real but the migration is no worse than main on most of them, or affect mood/breath rather than function.

---

## Post-fix re-check on `44a8ab1`

Three fix PRs landed: `e47df8a` (WI-UX-13 — sidebar overlap), `73e2102` (WI-UX-14 — gizmo gating), `44a8ab1` (WI-UX-15 — Reset Camera color + default fixture). Re-verified on `feat/r3f-migration` @ `44a8ab1` at 1440×900.

### Result table

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Sidebar overlap with long missing-resources list (hallway) | **PASS** | Resource Files panel now scrolls *internally* (own scrollbar visible on the right of the panel). Scene Tree row "N3D Hallway" + details placeholder both visible in the same sidebar at 1440×900. Tree no longer pushed off-screen. |
| 2 | Camera3D + AudioStreamPlayer3D gizmos render eagerly | **PASS** | Yellow Camera frustums that previously dominated the Hallway viewport are gone. Only remaining overlay primitive is the magenta Sprite3D *missing-texture placeholder* — that is documented UX, not a debug gizmo (see `packages/textscene-core/src/r3f/nodes/sprite3d/Component.tsx:128`), and is the same behavior MeshInstance3D uses for missing textures. |
| 3 | Reset Camera primary-action color | **PASS** | Computed style: `background: rgb(23, 61, 107)` (= `--tsi-accent-soft` `#173d6b`), `color: rgb(231, 241, 255)` (= `--tsi-accent-fg` `#e7f1ff`), focus border tinted blue. Reads as primary CTA. Screenshot: `.tmp/visual-ab/postfix-default-fixture.png`. |
| 4 | Default fixture switch | **PASS** | First paint after `localStorage.clear() + reload` lands on `unit-plane-mesh.tscn` ("Plane Mesh" shown in the toolbar select), no parse-error banner, no missing-files panel. Screenshot: `.tmp/visual-ab/postfix-default-fixture.png`. |

### Side-by-side screenshots

| Item | Pre-fix | Post-fix |
|------|---------|----------|
| Default fixture (item 4) — first paint | `.tmp/visual-ab/empty-migration.png` (red banner + parse error) | `.tmp/visual-ab/postfix-default-fixture.png` (clean Plane Mesh viewport, blue Reset Camera bar) |
| Reset Camera color (item 3) | `.tmp/visual-ab/plane-mesh-migration.png` (flat gray Reset Camera bar) | `.tmp/visual-ab/postfix-default-fixture.png` (blue Reset Camera bar) |
| Hallway sidebar + gizmos (items 1 + 2) | `.tmp/visual-ab/hallway-migration-full.png` (yellow Camera frustums everywhere, tree pushed off-screen) | `.tmp/visual-ab/postfix-hallway-quick.png` (clean Hallway geometry visible, Resource Files panel scrolls internally, Scene Tree reachable above the details placeholder) |

### Outcome

**4 / 4 PASS.** No further code changes needed from this re-check. The 4 HIGH-severity findings from the original visual-AB audit at `2e065d5` are all resolved at `44a8ab1`.

The 11 medium and low findings (items 5-15) remain deferred to a post-merge polish pass per team-lead's decision; this re-check intentionally did not re-scan them.

The "Migration WINS over main" list — parse-error banner, selection-row affordance, `SceneChangeResetter` — is preserved on `44a8ab1`. The parse-error banner is unchanged in `TscnPreviewShell.tsx:147`; selection styles unchanged in `SceneTreeViewer.module.css`. No regression in any of those.
