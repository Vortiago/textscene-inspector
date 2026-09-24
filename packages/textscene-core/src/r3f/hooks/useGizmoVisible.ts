/**
 * An editor-only gizmo (light cone, camera frustum, 2D helper) shows only while its node is
 * selected, so many decorated nodes do not bury the scene in helpers. Hover does not show it:
 * `HoverHighlight` is the hover cue. Outside a NodeDispatcher the path is null and gizmos hide.
 */

import { useNodePath } from '../contexts/NodePathContext';
import { useOptionalSelection } from '../contexts/SelectionContext';

export function useGizmoVisible(): boolean {
  const path = useNodePath();
  const selection = useOptionalSelection();
  if (path === null) return false;
  return selection?.selectedNodePath === path;
}
