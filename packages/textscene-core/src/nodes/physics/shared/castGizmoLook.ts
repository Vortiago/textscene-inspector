/**
 * The look a cast node's gizmo parts draw with. The cast plugins pass the node's own debug material
 * and `get_material` never replaces it, so the look holds in every selection and instance state; a
 * disabled node draws in the grey `shape_material_disabled` fetches alone
 * (node_3d_editor_gizmos.cpp:1027-1028, ADR-0056).
 */

import type * as THREE from 'three';
import type { Rgba } from '../../../godot/math/math.js';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { INSTANTIATED_LINEAR } from '../../../r3f/gizmo/useGizmoLook';
import { INSTANTIATED_GIZMO_COLOUR, gizmoAlpha } from '../../../r3f/gizmo/gizmoVariant';
import { debugShapeColour } from './debugColor';

/** The {color, opacity} pair the cast gizmo's line and fill both draw with. */
export interface CastGizmoLook {
  color: THREE.Color;
  opacity: number;
}

/**
 * @canonical A cast node's gizmo look
 */
export function useCastGizmoLook(customColor: Rgba | undefined, enabled: boolean): CastGizmoLook {
  const colour = debugShapeColour(customColor);
  const color = useGodotLinearColor(colour);
  return enabled
    ? { color, opacity: colour.a }
    : { color: INSTANTIATED_LINEAR, opacity: gizmoAlpha('unselected', INSTANTIATED_GIZMO_COLOUR.a) };
}
