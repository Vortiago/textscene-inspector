/**
 * A selection-gated gizmo that fills a box: an AABB as a translucent unlit mesh, the way Godot's
 * `add_solid_box` draws it. The caller gates it with `useGizmoVisible`.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { aabbCenter, type Aabb } from '../../godot/math/aabb';
import { allFinite } from '../../godot/variant/number';
import { useGodotLinearColor } from '../godotColor';
import { GizmoMesh } from './GizmoMesh';

interface AabbSolidGizmoProps {
  aabb: Aabb;
  /** The sRGB colour Godot fills the box with. */
  color: { r: number; g: number; b: number };
  alpha: number;
}

function solidBoxGeometry(aabb: Aabb): THREE.BufferGeometry {
  const { size } = aabb;
  const centre = aabbCenter(aabb);
  return new THREE.BoxGeometry(size.x, size.y, size.z).translate(centre.x, centre.y, centre.z);
}

/** Draws nothing for a box with an `inf` or `nan` size or position, which three cannot bound. */
function isFiniteBox({ position, size }: Aabb): boolean {
  return allFinite([position.x, position.y, position.z, size.x, size.y, size.z]);
}

export function AabbSolidGizmo({ aabb, color, alpha }: AabbSolidGizmoProps) {
  const geometry = useMemo(() => (isFiniteBox(aabb) ? solidBoxGeometry(aabb) : null), [aabb]);
  return <GizmoMesh geometry={geometry} color={useGodotLinearColor(color)} alpha={alpha} />;
}
