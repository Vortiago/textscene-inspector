/**
 * What an editor gizmo draws for its node: nothing, the faint unselected variant or the selected
 * one. Godot's gizmo plugins draw some parts for every node and others only for the selected node,
 * and each part says which (ADR-0056). Hover does not show a gizmo: `HoverHighlight` is the hover
 * cue. Outside a NodeDispatcher the path is null, so no node owns the gizmo and it stays hidden.
 */

import { useNodePath } from '../contexts/NodePathContext';
import { useOptionalSelection } from '../contexts/SelectionContext';
import { useViewportMode } from '../contexts/ViewportModeContext';
import type { GizmoVariant } from '../gizmo/gizmoVariant';

/** Whether a gizmo plugin draws a part for every node or only for the selected node. */
export type GizmoDrawnFor = 'every-node' | 'selected-only';

export type GizmoState = GizmoVariant | 'hidden';

export function useGizmoState(drawnFor: GizmoDrawnFor): GizmoState {
  const { showGizmos } = useViewportMode();
  const path = useNodePath();
  const selection = useOptionalSelection();
  if (!showGizmos || path === null) return 'hidden';
  if (selection?.selectedNodePath === path) return 'selected';
  return drawnFor === 'every-node' ? 'unselected' : 'hidden';
}

/** Whether a gizmo that has no unselected look draws at all: for the parts that ignore the variant. */
export function useGizmoDrawn(drawnFor: GizmoDrawnFor): boolean {
  return useGizmoState(drawnFor) !== 'hidden';
}
