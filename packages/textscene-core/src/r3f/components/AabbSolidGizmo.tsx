/**
 * A selection-gated gizmo that fills a box: an AABB as a translucent unlit mesh, the way Godot's
 * `add_solid_box` draws it. The caller gates it with `useGizmoVisible`.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Aabb } from '../../godot/math/aabb';
import { canvasItemFacing } from '../canvasItemFacing';
import { editorHelperUserData } from '../editorHelpers';
import { useGodotLinearColor } from '../godotColor';
import { materialProgramInputs } from '../materialProgramInputs';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { GIZMO_GROUP_ORDER, GIZMO_RENDER_ORDER } from './gizmoRenderOrder';

interface AabbSolidGizmoProps {
  aabb: Aabb;
  /** The sRGB colour Godot fills the box with. */
  color: { r: number; g: number; b: number };
  /** The opacity of the fill, from 0 to 1. */
  alpha: number;
}

function solidBoxGeometry({ position, size }: Aabb): THREE.BufferGeometry {
  return new THREE.BoxGeometry(size.x, size.y, size.z).translate(
    position.x + size.x / 2,
    position.y + size.y / 2,
    position.z + size.z / 2
  );
}

/** Draws nothing for a box with an `inf` or `nan` size or position, which three cannot bound. */
function isFiniteBox({ position, size }: Aabb): boolean {
  return [position.x, position.y, position.z, size.x, size.y, size.z].every(Number.isFinite);
}

export function AabbSolidGizmo({ aabb, color, alpha }: AabbSolidGizmoProps) {
  const isFinite = isFiniteBox(aabb);
  const geometry = useMemo(() => (isFinite ? solidBoxGeometry(aabb) : null), [aabb, isFinite]);
  useDisposeOnRelease(geometry);
  const helperUserData = useMemo(editorHelperUserData, []);
  const linearColor = useGodotLinearColor(color);
  // Godot's gizmo material culls no face (`node_3d_editor_gizmos.cpp:927`), so one pass draws both.
  const program = materialProgramInputs({
    props: {
      color: linearColor,
      opacity: alpha,
      transparent: true,
      depthWrite: false,
      fog: false,
      ...canvasItemFacing(),
    },
  });
  if (!geometry) return null;

  return (
    <group renderOrder={GIZMO_GROUP_ORDER} userData={helperUserData}>
      <mesh renderOrder={GIZMO_RENDER_ORDER} geometry={geometry}>
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    </group>
  );
}
