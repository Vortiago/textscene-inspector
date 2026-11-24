import { useNodePath } from '../contexts/NodePathContext';
import { useShowGizmos } from '../viewShow/ViewShowContext';
import type { GizmoVariant } from '../gizmo/gizmoVariant';
import { useIsSelected } from './useIsSelected';

// Some gizmo parts draw for every node, others only for the selected node (ADR-0056).
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
