import { useSelectPath } from './previewSelection.js';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut.js';

// Global, not scoped to the canvas, so Escape clears the selection in 2D and 3D alike.
export function EscapeDeselect() {
  const selectPath = useSelectPath();
  // `useGlobalShortcut` yields to typing and to an open floating panel.
  useGlobalShortcut('escape', () => selectPath(null));
  return null;
}
