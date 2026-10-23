/**
 * The colour and opacity a gizmo part draws with. Inside a {@link PluginGizmo} the part wears the
 * look of its node: the instantiated grey where the edited scene does not own it, and the unselected
 * fade where it is not selected. Outside one it keeps its own colour.
 */

import type * as THREE from 'three';
import { godotColorToLinear } from '../godotColor';
import { INSTANTIATED_GIZMO_COLOUR, gizmoAlpha } from './gizmoVariant';
import { useGizmoLookValue } from './PluginGizmo';

/** One colour for every part: the materials only read it. */
const INSTANTIATED_LINEAR = godotColorToLinear(INSTANTIATED_GIZMO_COLOUR);

interface GizmoLook {
  color: THREE.ColorRepresentation;
  opacity: number;
}

export function useGizmoLook(color: THREE.ColorRepresentation, opacity: number): GizmoLook {
  const look = useGizmoLookValue();
  if (look === null) return { color, opacity };
  if (look.isInstantiated) {
    return { color: INSTANTIATED_LINEAR, opacity: gizmoAlpha(look.variant, INSTANTIATED_GIZMO_COLOUR.a) };
  }
  return { color, opacity: gizmoAlpha(look.variant, opacity) };
}
