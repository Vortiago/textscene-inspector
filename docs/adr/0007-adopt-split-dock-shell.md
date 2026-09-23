# ADR 0007: Adopt the "Split Dock" (J) shell layout

- Status: Accepted
- Supersedes the 3-column DCC chrome of `TscnPreviewShell` (left Scene dock · centre
  viewport · right Inspector dock).
- Related: ADR-0003 (2D-UI overlay), ADR-0006 (viewport-mode seam / 2D framing).

## Context

The 3-column shell put the Scene tree (left) and the Inspector (right) on opposite sides
of the viewport. The shipped `TscnPreviewShell` plus the `--tsi-*` tokens are the
canonical design record of the "Split Dock" (J) layout that replaced it.

- A left vertical rail or dock duplicates the activity bar and Explorer of VS Code (the
  webview sits in the editor area, right of that chrome) and wastes width in a narrow
  split.
- Tabs that drive a pane belong on the pane, not on a detached top bar.
- A second hop from a selected node to its Inspector is cumbersome.
- 2D mode must read as a real 2D **canvas** (bounds, zoom, pan), not a viewport that
  happens to show flat content.

## Decision

`TscnPreviewShell` has a **two-column** layout:

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
- The dock is a **master-detail**: the Scene tree on top, and below it an on-pane tab
  strip (Inspector / Resources / Cameras) whose lower section follows the selection. The
  Inspector updates the instant a node is selected, with no tab switch for the core loop.
  The Resources tab hosts `MissingResourcesPanel` plus the resource list. The Cameras tab
  lists Camera nodes (through CameraControl) with "use".
- The **top bar** carries only global chrome: file name plus scene stats, camera
  selector, the 2D/3D switch (`ViewportToolbar`) and the collisions toggle.
- `SceneTreeViewer`, `NodeDetailsPanel` and `SceneInfoCard` use the denser J style with
  `--tsi-*` tokens (type chips, breadcrumb, sticky group headers).
- **2D mode** wrapped the live `ControlOverlay` in a framed canvas (bounds, zoom% and
  pan, 2D stats, an on-canvas selection marker), reusing the real overlay rather than an
  image. The workspace-parity amendment of ADR-0006 replaced the framed overlay with the
  composited `Canvas2DStage`.
- The layout reuses the `--tsi-*` design tokens (which map to `--vscode-*`), so VS Code
  theme integration and the web fallback stay byte-for-byte where unchanged.
- All features and behaviour stay: parse pipeline, the five contexts, selection and
  hover sync, missing-resource upload, sub-scene inspector, camera switching, collapse,
  responsive layout (at most 768 px, or a narrow dock), and **web + VS Code parity**
  (shared component).

## Consequences

- The left-dock API (`leftCollapsed`, left `Splitter`) is removed. The shell exposes a
  single collapsible dock. The host props (`TscnPreviewShellProps`) are unchanged.
- The showcase clips show the shell, so a layout change is followed by
  `pnpm showcase:regen`.
