/**
 * The compact-chrome media query of the narrow layout (ADR-0048). A VS Code webview is an
 * iframe, so the query measures the editor tab there and the window in the web app. The CSS
 * modules repeat this text, since a stylesheet cannot import it, and a test holds the copies equal.
 */

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
