/**
 * The media queries of the narrow layout (ADR-0042). A VS Code webview is an iframe, so a
 * query measures the editor tab there and the window in the web app. The CSS modules repeat
 * this text, since a stylesheet cannot import it, and a test holds the two copies equal.
 */

/**
 * The dock becomes a bottom sheet under the viewport. A short panel keeps the side dock,
 * since a sheet under a viewport less than 500px tall leaves neither one usable.
 */
export const NARROW_LAYOUT_QUERY = '(max-width: 768px) and (min-height: 501px)';

/**
 * The chrome gets compact: a scrolling top bar, and the web app's Source pane as an overlay.
 * It holds for every narrow panel and for a phone in landscape, which is wider than 768px.
 */
export const COMPACT_LAYOUT_QUERY = '(max-width: 768px), (max-height: 500px) and (pointer: coarse)';

/** Whether the compact chrome applies now. False where `matchMedia` is missing or throws. */
export function isCompactLayout(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.(COMPACT_LAYOUT_QUERY).matches === true;
  } catch {
    return false;
  }
}
