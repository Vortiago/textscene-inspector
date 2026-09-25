/**
 * Default-theme icons from Godot 4.6.3's `scene/theme/icons/`, embedded as
 * `data:` base64 like `native/themeIcons.ts`. `resizer` is `resizer_se` for
 * GraphElement, GraphNode and GraphFrame (`default_theme.cpp:261`), and `port`
 * is GraphNode's `graph_port` (`default_theme.cpp:799`).
 */

// Licence: Godot Engine, MIT: see THIRD-PARTY-NOTICES.md.

function svgDataUrl(base64: string): string {
  return `data:image/svg+xml;base64,${base64}`;
}

/** `scene/theme/icons/resizer_se.svg` (16x16). */
const RESIZER_SE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmVmZmZlIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNjUiIHN0cm9rZS13aWR0aD0iMiIgZD0iTTExIDR2N0g0Ii8+PGNpcmNsZSBjeD0iNy41IiBjeT0iNy41IiByPSIxLjUiIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjY1Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/graph_port.svg` (10x10). */
const GRAPH_PORT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PGNpcmNsZSBjeD0iNSIgY3k9IjUiIHI9IjUiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSI1IiBjeT0iNSIgcj0iMy42NjciIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjY1Ii8+PC9zdmc+Cg==';

export const RESIZER_SE_ICON = svgDataUrl(RESIZER_SE_B64);
export const RESIZER_SE_ICON_SIZE = { x: 16, y: 16 };

export const GRAPH_PORT_ICON = svgDataUrl(GRAPH_PORT_B64);
export const GRAPH_PORT_ICON_SIZE = { x: 10, y: 10 };
