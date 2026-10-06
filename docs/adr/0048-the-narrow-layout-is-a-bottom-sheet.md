# The narrow layout is a bottom sheet

- Status: Accepted.
- Amends: ADR-0007 (the Split Dock). Its responsive clause ("at most 768 px") becomes this
  layout.
- Related: ADR-0020 (the web Source pane is a sibling of the shell, not a column of it),
  ADR-0029 (the touch navigation scheme).

## Context

The shell is shared by the web app and the VS Code webview. A webview is an iframe, so a
media query in the shell measures the editor tab in VS Code and the window in the web
app. A side-by-side preview tab and a phone are therefore the same problem.

Below 768 px the Split Dock stacked the dock under the viewport and kept its tree over its
detail pane. On a phone that gave each half about 150 px. The top bar did not fit, the
collapsed strip kept its vertical text, and the web app's 320 px Source pane stayed beside
a 390 px screen.

## Decision

**A narrow, tall panel shows the viewport over a bottom sheet, and the sheet shows the
tree or the details, one at a time.**

- The sheet query is `(max-width: 768px) and (min-height: 501px)`
  (`NARROW_LAYOUT_QUERY`).
- A Scene | Details switch picks the half. The sheet height is dragged from a grabber
  (25 % to 85 % of the column). The sheet collapses to a bar under the viewport.
- The half (`tsi.narrowPane`) and the share (`tsi.sheetShare`) persist beside the desktop
  dock keys. The desktop keys stay as they were.
- The narrow-only parts render in every layout, and the stylesheet hides them on a wide
  one. A resize across the breakpoint therefore never remounts the dock, and the shell
  needs no `matchMedia` listener.

**The chrome gets compact under a second query**, `(max-width: 768px), (max-height:
500px) and (pointer: coarse)` (`COMPACT_LAYOUT_QUERY`). It covers a phone in landscape,
which is wider than 768 px.

- The top bar drops the brand and the stat chips, and the host toolbar scrolls sideways.
- The web app's Source pane covers the preview below the top bar. It starts hidden on a
  first visit, and a stored choice wins.

A short panel keeps the side dock. A sheet under a viewport less than 500 px tall leaves
neither one usable.

**Touch sizing follows the pointer, not the width.** Under `(pointer: coarse)` the
targets grow to 36 to 40 px. The viewport pill names the touch bindings. A mouse in a
narrow VS Code tab keeps the dense sizing.

## Consequences

- VS Code and the web app keep parity through the shared shell, as ADR-0007 requires.
- The desktop layout is unchanged. Every new rule sits inside a media query, and every new
  element is `display: none` outside one. The golden images and the desktop E2E
  measurements prove it.
- The CSS modules repeat the two query strings, since a stylesheet cannot import them.
  `TscnPreviewShell.responsive.test.tsx` holds the copies equal.
- `pnpm test:e2e:web` has a phone scenario at 390x844. It checks for a sideways scroll, the
  stacked geometry, one half at a time, and the collapsed bar.

## Rejected

- **Full-screen tabs** (Viewport, Scene, Details and Source behind a bottom navigation
  bar). The viewport is hidden while the inspector is read, and a selection in the tree
  cannot be seen in the scene.
- **Keep the stacked Split Dock and fix only its defects.** The tree over the inspector
  inside a 45 % sheet leaves both halves too short to read.
