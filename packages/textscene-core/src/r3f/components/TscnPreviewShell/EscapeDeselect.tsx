/**
 * Escape clears the current selection (#224) — a global shortcut, not
 * scoped to the 3D `<Canvas>` (unlike F-to-frame, which needs THREE camera
 * state and lives inside TscnCanvas), so it works the same in 2D and 3D
 * viewport modes. Guarded by `isTypingTarget` so it doesn't hijack Escape
 * from someone editing text (the web app's Source pane, ADR-0020).
 *
 * Mount once per `<TscnPreviewShell>` instance, inside its own
 * `<SelectionProvider>`.
 */
import { useEffect } from 'react';
import { useSelection } from '../../contexts/SelectionContext.js';
import { isTypingTarget } from '../../hooks/isTypingTarget.js';

export function EscapeDeselect() {
  const { setSelectedNodePath } = useSelection();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (isTypingTarget(e.target)) return;
      setSelectedNodePath(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedNodePath]);

  return null;
}
