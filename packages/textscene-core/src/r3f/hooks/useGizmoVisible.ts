/**
 * Selection gate for editor-only gizmos (light cones, camera frusta, audio
 * ranges, 2D marker/path helpers): a gizmo is visible only when its owning
 * TSCN node is the currently selected node in the panel's SelectionContext.
 *
 * Without this gate a scene with many decorated nodes (e.g. example-hallway's
 * 18 spotlights, WI-UX-14) renders a thicket of overlapping helpers that
 * obscure the actual scene. Hover does NOT show the gizmo — the orange
 * HoverHighlight BoxHelper is the hover affordance.
 *
 * Outside a NodeDispatcher (standalone-test usage), `useNodePath()` returns
 * null and the gate evaluates to false, so gizmos stay hidden.
 */

import { useNodePath } from '../contexts/NodePathContext';
import { useOptionalSelection } from '../contexts/SelectionContext';

export function useGizmoVisible(): boolean {
  const path = useNodePath();
  const selection = useOptionalSelection();
  if (path === null) return false;
  return selection?.selectedNodePath === path;
}
