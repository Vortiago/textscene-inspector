# ADR 0007 — Adopt the "Split Dock" (J) shell layout

- Status: Accepted (2026-06-01)
- Supersedes the 3-column DCC chrome introduced for `TscnPreviewShell` (left Scene
  dock · center viewport · right Inspector dock).
- Related: ADR-0003 (2D-UI overlay), ADR-0006 (viewport-mode seam / 2D framing).

## Context

The 3-column shell put the Scene tree (left) and Inspector (right) on opposite sides of
the viewport. User feedback during a prototype exploration (5 fresh-eyes designs → A+B
hybrids → G refinements) converged on **J / "Split Dock"**. The reference prototypes
were ephemeral and deleted after implementation; the shipped `TscnPreviewShell` +
`--tsi-*` tokens are the canonical design record.

- A left vertical rail/dock duplicates VS Code's OWN activity bar + Explorer (the webview
  sits in the editor area, right of that chrome) and wastes width in a narrow split.
- Tabs that drive a pane should live ON the pane, not on a detached top bar.
- Selecting a node then needing a second hop to reach its Inspector is cumbersome.
- The 2D mode was under-served — it should read as a real 2D **canvas** (bounds, zoom,
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
- The dock is a **master-detail**: Scene tree on top; below it a tab strip
  (Inspector / Resources / Cameras) whose lower section follows the selection. The
  Inspector updates the instant a node is selected — no tab switch for the core loop.
- **Top bar** carries only global chrome: file name + scene stats, camera selector,
  the 2D/3D switch (existing `ViewportToolbar`), collisions toggle.
- **2D mode** wraps the live `ControlOverlay` in a framed canvas (bounds + zoom% + pan),
  reusing the real overlay — not an image (consistent with ADR-0003/0006; "never
  composite", overlay-only 2D still holds).
- Reuse the existing `--tsi-*` design tokens (which map to `--vscode-*`), so VS Code
  theme integration and web fallback are preserved byte-for-byte where unchanged.
- Preserve all features + behavior: parse pipeline, the five contexts, selection/hover
  sync, missing-resource upload, sub-scene inspector, camera switching, collapse,
  responsive (≤768 / narrow dock), and **web + VS Code parity** (shared component).

## Staged plan (each stage builds + type-checks + tests green)

1. **Shell layout** — two-column master-detail; tree moves into the right dock above a
   tabbed lower section (Inspector default, follows selection); top bar trimmed; collapse
   + responsive retained. Update `TscnPreviewShell` tests to the new structure (no silent
   coverage loss).
2. **Pane tabs + Cameras** — on-pane tab strip; Resources tab hosts `MissingResourcesPanel`
   + resource list; new Cameras tab lists Camera nodes (via CameraControl) with "use".
3. **Visual language** — restyle `SceneTreeViewer`, `NodeDetailsPanel`, `SceneInfoCard`
   to J's denser, calmer look using `--tsi-*` tokens (type chips, breadcrumb, sticky
   group headers).
4. **2D canvas mode** — frame `ControlOverlay` as a canvas (bounds + zoom% + pan), 2D
   stats, on-canvas selection marker; 2D/3D switch swaps chrome accordingly.
5. **Parity + showcase** — verify web + VS Code, then `pnpm showcase:regen`; delete
   `prototypes/` once the real shell matches.

## Consequences

- The left-dock API (`leftCollapsed`, left `Splitter`) is removed; the shell exposes a
  single collapsible dock. Host props (`TscnPreviewShellProps`) are unchanged.
- Reference: the J prototype was an ephemeral artifact, deleted after implementation
  (per stage 5). The shipped `TscnPreviewShell` + `--tsi-*` tokens are the canonical
  design record. The prototype used hardcoded VS Code hexes; the real shell uses
  `--tsi-*`, so exact colors differ slightly by design (theme-aware).
