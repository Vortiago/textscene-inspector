/**
 * Escape clears the current selection — a global shortcut, not
 * scoped to the 3D `<Canvas>` (unlike F-to-frame, which needs THREE camera
 * state and lives inside TscnCanvas), so it works the same in 2D and 3D
 * viewport modes. `useGlobalShortcut` carries the isTypingTarget guard so
 * it doesn't hijack Escape from someone editing text (the web app's Source
 * pane, ADR-0020).
 *
 * Mount once per `<TscnPreviewShell>` instance, inside its own
 * `<SelectionProvider>`.
 */
import { useSelection } from '../../contexts/SelectionContext.js';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut.js';

export function EscapeDeselect() {
  const { setSelectedNodePath } = useSelection();
  // Yielding to an open floating panel is `useGlobalShortcut`'s job, not this
  // one's — the same way the don't-hijack-typing guard is.
  useGlobalShortcut('escape', () => setSelectedNodePath(null));
  return null;
}
