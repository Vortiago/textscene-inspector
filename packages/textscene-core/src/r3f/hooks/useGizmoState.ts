/**
 * What an editor gizmo draws for its node: nothing, the faint unselected variant or the selected
 * one. Godot's gizmo plugins draw some parts for every node and others only for the selected node,
 * and each part says which (ADR-0056). Hover does not show a gizmo: `HoverHighlight` is the hover
 * cue. Outside a NodeDispatcher the path is null, so no node owns the gizmo and it stays hidden.
 * `PluginGizmo` reads it for a gizmo-plugin gizmo, and `useGizmoDrawn` for the rest.
 */

import { useNodePath } from '../contexts/NodePathContext';
import { useShowGizmos } from '../contexts/ViewportModeContext';
import type { GizmoVariant } from '../gizmo/gizmoVariant';
import { useIsSelected } from './useIsSelected';

/** Whether a gizmo plugin draws a part for every node or only for the selected node. */
export type GizmoDrawnFor = 'every-node' | 'selected-only';

export type GizmoState = GizmoVariant | 'hidden';

/**
 * @canonical What an editor gizmo draws for its node
 */
export function useGizmoState(drawnFor: GizmoDrawnFor): GizmoState {
  const showGizmos = useShowGizmos();
  const isInNode = useNodePath() !== null;
  const isSelected = useIsSelected();
  if (!showGizmos || !isInNode) return 'hidden';
  if (isSelected) return 'selected';
  return drawnFor === 'every-node' ? 'unselected' : 'hidden';
}

/** Whether a gizmo that has no unselected look draws at all: for the parts that ignore the variant. */
export function useGizmoDrawn(drawnFor: GizmoDrawnFor): boolean {
  return useGizmoState(drawnFor) !== 'hidden';
}
