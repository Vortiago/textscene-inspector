/**
 * Escape clears the current selection (#224) — a global shortcut, not
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
  useGlobalShortcut('escape', () => setSelectedNodePath(null));
  return null;
}
