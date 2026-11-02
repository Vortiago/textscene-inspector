/**
 * The RayCast3D editor gizmo, ported from ray_cast_3d.cpp:403-425: the origin→target_position line,
 * and, at a thickness above 1, the truncated pyramid the plugin adds as a fill
 * (ray_cast_3d_gizmo_plugin.cpp:61-67). The plugin passes the node's own debug material, and
 * `get_material` never replaces it, so the look holds in every selection and instance state. It
 * draws disabled in the grey `shape_material_disabled` fetches alone.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { basisSetAxisAngle, basisXform } from '../../../../godot/math/basisFloat.js';
import type { MutableBasis } from '../../../../godot/math/basis.js';
import { CMP_EPSILON, REAL_PI, type Rgba } from '../../../../godot/math/math.js';
import { normalizedVector3, type Vector3 } from '../../../../godot/math/vector.js';
import { storedReal } from '../../../../godot/math/real.js';
import { castTargetLine, isZeroTarget } from '../../shared/castTarget';
import { useCastGizmoLook } from '../../shared/castGizmoLook';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { GizmoMesh } from '../../../../r3f/components/GizmoMesh';

/** Godot's strip order: slot 0 to 3 walks the base ring, 4 to 7 the one at the tip (ray_cast_3d.cpp:420). */
const PYRAMID_STRIP = [4, 5, 0, 1, 2, 5, 6, 4, 7, 0, 3, 2, 7, 6] as const;

/** Godot pushes 14 strip vertices (ray_cast_3d.cpp:420), a triangle per consecutive triple: 12 of them. */
const STRIP_VERTICES = 14;

/** The strip drawn as triangles: consecutive triples of the 14 pushed vertices. */
const PYRAMID_TRIANGLES = new Uint16Array([
  0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 4, 5, 4, 5, 6, 5, 6, 7, 6, 7, 8, 7, 8, 9, 8, 9, 10, 9, 10, 11, 10, 11, 12, 11,
  12, 13,
]);

/** `Vector3::rotated` (core/math/vector3.cpp:38-40): the vertex through `Basis(axis, angle)`
 * (`basis.cpp:840-868`), whose axis-angle matrix this ports. */
function rotated(vertex: Vector3, axis: Vector3, angle: number): Vector3 {
  const basis: MutableBasis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  return basisXform(basisSetAxisAngle(basis, axis, angle), vertex);
}

/**
 * The truncated pyramid of a `thickness` above 1: a base ring `thickness / 100` m across at the
 * origin, a third of that at the tip, each slot swung a quarter turn step about the ray. Null
 * when the thickness fills nothing, or at the zero target.
 */
function rayPyramid(target: Vector3, thickness: number): THREE.BufferGeometry | null {
  if (thickness <= 1 || isZeroTarget(target)) return null;

  const [dx, dy, dz] = normalizedVector3(target.x, target.y, target.z);
  // The cross axis: a ray level with x and y picks the y/z pair (ray_cast_3d.cpp:417).
  const levelWithXAndY = Math.abs(dx) + Math.abs(dy) > CMP_EPSILON;
  const [nx, ny, nz] = normalizedVector3(
    levelWithXAndY ? -dy : 0,
    levelWithXAndY ? dx : -dz,
    levelWithXAndY ? 0 : dy
  );
  // `normal *= debug_shape_thickness / scale_factor` (ray_cast_3d.cpp:419): the base ring radius.
  const radius = storedReal(thickness / 100);
  const rx = storedReal(nx * radius);
  const ry = storedReal(ny * radius);
  const rz = storedReal(nz * radius);
  // The tip ring sits a third of the base radius out, at the target: slot >= 4 (ray_cast_3d.cpp:422-424).
  const tipX = storedReal(storedReal(rx / 3) + target.x);
  const tipY = storedReal(storedReal(ry / 3) + target.y);
  const tipZ = storedReal(storedReal(rz / 3) + target.z);
  const axis: Vector3 = { x: dx, y: dy, z: dz };

  const positions = new Float32Array(STRIP_VERTICES * 3);
  for (let v = 0; v < STRIP_VERTICES; v += 1) {
    // `vertices_strip_order[v] < 4` picks the ring slot, the tip a third of the base radius, at
    // `PI * (0.5 * (slot % 4) + 0.25)` about the ray (ray_cast_3d.cpp:422-424), each op real_t float.
    const slot = PYRAMID_STRIP[v]!;
    const angle = storedReal(REAL_PI * storedReal(storedReal(0.5 * (slot % 4)) + 0.25));
    const vertex = rotated(slot < 4 ? { x: rx, y: ry, z: rz } : { x: tipX, y: tipY, z: tipZ }, axis, angle);
    positions[v * 3] = vertex.x;
    positions[v * 3 + 1] = vertex.y;
    positions[v * 3 + 2] = vertex.z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(PYRAMID_TRIANGLES, 1));
  return geometry;
}

interface RayGizmoProps {
  /** The effective `target_position`, Godot's default when unauthored. */
  target: Vector3;
  /** The effective `debug_shape_thickness`, Godot's default 2 when unauthored. */
  thickness: number;
  /** The authored `debug_shape_custom_color`, undefined when unauthored. */
  customColor?: Rgba;
  /** Whether the ray casts. Godot default true, per ray_cast_3d.h:50. */
  enabled: boolean;
}

export function RayGizmo({ target, thickness, customColor, enabled }: RayGizmoProps) {
  const look = useCastGizmoLook(customColor, enabled);
  const line = useMemo(() => castTargetLine(target), [target]);
  const geometry = useMemo(() => rayPyramid(target, thickness), [target, thickness]);
  return (
    <>
      {line && <GizmoLine positions={line} color={look.color} opacity={look.opacity} />}
      <GizmoMesh geometry={geometry} color={look.color} alpha={look.opacity} />
    </>
  );
}
