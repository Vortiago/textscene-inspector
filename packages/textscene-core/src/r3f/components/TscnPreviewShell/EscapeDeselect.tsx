/**
 * Escape clears the selection. It is global, not scoped to `<Canvas>`, so it
 * works in 2D and 3D. Mount it once per `<TscnPreviewShell>`, inside its
 * `<SelectionProvider>`.
 */
import { useSelection } from '../../contexts/SelectionContext.js';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut.js';

export function EscapeDeselect() {
  const { setSelectedNodePath } = useSelection();
  // `useGlobalShortcut` yields to typing and to an open floating panel.
  useGlobalShortcut('escape', () => setSelectedNodePath(null));
  return null;
}
