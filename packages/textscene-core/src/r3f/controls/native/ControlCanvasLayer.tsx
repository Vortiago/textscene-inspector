/**
 * Native (WebGL) Control mount point (#368) — where a `useNativeControls`
 * viewport (`ViewportModeContext`) draws Control nodes as canvas items,
 * superseding the DOM `<ControlOverlay>` (ADR-0003) that the flag being off
 * still uses. Mounted by `World2DContents` as a sibling right after
 * `<NodeDispatcher>`, inside the same `SceneResourcesProvider`.
 *
 * This packet (P2) ships only the flag + mount seam: the layer draws
 * nothing. A later packet replaces this body with the real Control rect
 * solver and canvas-item drawing, at this exact mount point.
 */
export function ControlCanvasLayer() {
  return null;
}
