/**
 * The colour and opacity a gizmo part draws with. A part with a `variant` is a Godot gizmo-plugin
 * material, which wears the instantiated grey inside a node the edited scene does not own. A part with
 * none is no plugin material (a 2D helper, the follower handle) and keeps its own colour.
 */

import type * as THREE from 'three';
import { godotColorToLinear } from '../godotColor';
import { useIsInstantiated } from '../hooks/useIsInstantiated';
import { INSTANTIATED_GIZMO_COLOUR, gizmoAlpha, type GizmoVariant } from './gizmoVariant';

/** One colour for every part: the materials only read it. */
const INSTANTIATED_LINEAR = godotColorToLinear(INSTANTIATED_GIZMO_COLOUR);

interface GizmoLook {
  color: THREE.ColorRepresentation;
  opacity: number;
}

export function useGizmoLook(
  variant: GizmoVariant | undefined,
  color: THREE.ColorRepresentation,
  opacity: number
): GizmoLook {
  const isInstantiated = useIsInstantiated();
  if (variant === undefined) return { color, opacity };
  if (isInstantiated) {
    return { color: INSTANTIATED_LINEAR, opacity: gizmoAlpha(variant, INSTANTIATED_GIZMO_COLOUR.a) };
  }
  return { color, opacity: gizmoAlpha(variant, opacity) };
}
