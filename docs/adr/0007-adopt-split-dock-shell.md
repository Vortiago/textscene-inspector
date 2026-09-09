# ADR 0007 — Adopt the "Split Dock" (J) shell layout

- Status: Accepted (2026-06-01)
- Supersedes the 3-column DCC chrome introduced for `TscnPreviewShell` (left Scene
  dock · centre viewport · right Inspector dock).
- Related: ADR-0003 (2D-UI overlay), ADR-0006 (viewport-mode seam / 2D framing).

## Context

The 3-column shell put the Scene tree (left) and Inspector (right) on opposite sides of
the viewport. User feedback during a prototype exploration (five fresh-eyes designs,
then A+B hybrids, then G refinements) converged on **J / "Split Dock"**. The reference
prototypes were ephemeral and deleted after implementation. The shipped
`TscnPreviewShell` plus `--tsi-*` tokens are the canonical design record.

- A left vertical rail or dock duplicates VS Code's OWN activity bar and Explorer (the
  webview sits in the editor area, right of that chrome) and wastes width in a narrow
  split.
- Tabs that drive a pane should live ON the pane, not on a detached top bar.
- Selecting a node and then needing a second hop to reach its Inspector is cumbersome.
- The 2D mode was under-served. It should read as a real 2D **canvas** (bounds, zoom,
  pan), not a viewport that happens to show flat content.

## Decision

Restructure `TscnPreviewShell` into a **two-column** layout:

```
┌───────────────────────────────────────────────────────────┐
│ Top bar: file/brand · global stats · camera · 2D/3D · …     │
├──────────────────────────────────────┬────────────────────┤
│                                        │ SCENE TREE (master)│
│            VIEWPORT                    │  ───────────────── │
│   (live r3f TscnCanvas / 2D canvas)    │ [Inspector|Res|Cam]│  ← tabs ON the pane
│            — large —                   │  detail (follows   │
│                                        │   selection; no    │
│                                        │   tab hop needed)  │
└──────────────────────────────────────┴────────────────────┘
```

- **One right dock**, collapsible to give a full-width viewport. No left rail.
- The dock is a **master-detail**: Scene tree on top, and below it a tab strip
  (Inspector / Resources / Cameras) whose lower section follows the selection. The
  Inspector updates the instant a node is selected. No tab switch for the core loop.
- **Top bar** carries only global chrome: file name plus scene stats, camera selector,
  the 2D/3D switch (existing `ViewportToolbar`), collisions toggle.
- **2D mode** wraps the live `ControlOverlay` in a framed canvas (bounds, zoom% and
  pan), reusing the real overlay rather than an image. This kept ADR-0003/0006's
  overlay-only 2D. ADR-0006's 2026-06-11 amendment later replaced the framed overlay
  with the composited `Canvas2DStage`.
- Reuse the existing `--tsi-*` design tokens (which map to `--vscode-*`), so VS Code
  theme integration and web fallback are preserved byte-for-byte where unchanged.
- Preserve all features and behaviour: parse pipeline, the five contexts, selection
  and hover sync, missing-resource upload, sub-scene inspector, camera switching,
  collapse, responsive layout (at most 768 px, or a narrow dock), and **web + VS Code
  parity** (shared component).

## Staged plan (each stage builds + type-checks + tests green)

1. **Shell layout**: two-column master-detail. The tree moves into the right dock above
   a tabbed lower section (Inspector default, follows selection). The top bar is
   trimmed. Collapse and responsive layout are retained. `TscnPreviewShell` tests are
   updated to the new structure with no silent coverage loss.
2. **Pane tabs + Cameras**: on-pane tab strip. The Resources tab hosts
   `MissingResourcesPanel` plus the resource list. A new Cameras tab lists Camera nodes
   (through CameraControl) with "use".
3. **Visual language**: restyle `SceneTreeViewer`, `NodeDetailsPanel`, `SceneInfoCard`
   to J's denser, calmer look using `--tsi-*` tokens (type chips, breadcrumb, sticky
   group headers).
4. **2D canvas mode**: frame `ControlOverlay` as a canvas (bounds, zoom% and pan), 2D
   stats, on-canvas selection marker. The 2D/3D switch swaps chrome accordingly.
5. **Parity + showcase**: verify web and VS Code, then `pnpm showcase:regen`. Delete
   `prototypes/` once the real shell matches.

## Consequences

- The left-dock API (`leftCollapsed`, left `Splitter`) is removed. The shell exposes a
  single collapsible dock. Host props (`TscnPreviewShellProps`) are unchanged.
- The prototype used hardcoded VS Code hexes and the real shell uses `--tsi-*`, so exact
  colours differ slightly by design (theme-aware).
