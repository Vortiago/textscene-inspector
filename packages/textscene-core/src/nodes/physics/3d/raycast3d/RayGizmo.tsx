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
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { GizmoMesh } from '../../../../r3f/components/GizmoMesh';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { INSTANTIATED_LINEAR } from '../../../../r3f/gizmo/useGizmoLook';
import { INSTANTIATED_GIZMO_COLOUR, gizmoAlpha } from '../../../../r3f/gizmo/gizmoVariant';
import { debugShapeColour } from '../../shared/debugColor';

/** Godot's strip order: slot 0 to 3 walks the base ring, 4 to 7 the one at the tip (ray_cast_3d.cpp:420). */
const PYRAMID_STRIP = [4, 5, 0, 1, 2, 5, 6, 4, 7, 0, 3, 2, 7, 6] as const;

/** Godot pushes 14 strip vertices, a triangle per consecutive triple: 12 of them. */
const STRIP_VERTICES = 14;
const STRIP_TRIANGLES = STRIP_VERTICES - 2;

/** The strip drawn as triangles: consecutive triples of the 14 pushed vertices. */
const PYRAMID_TRIANGLES = new Uint16Array(
  Array.from({ length: STRIP_TRIANGLES * 3 }, (_, i) => Math.floor(i / 3) + (i % 3))
);

interface PyramidGeometry {
  positions: Float32Array;
  indices: Uint16Array;
}

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
function rayPyramid(target: Vector3, thickness: number): PyramidGeometry | null {
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

  const positions = new Float32Array(STRIP_VERTICES * 3);
  for (let v = 0; v < STRIP_VERTICES; v += 1) {
    // `vertices_strip_order[v] < 4` picks the ring slot, the tip a third of the base radius, at
    // `PI * (0.5 * (slot % 4) + 0.25)` about the ray (ray_cast_3d.cpp:422-424), each op real_t float.
    const slot = PYRAMID_STRIP[v]!;
    const angle = storedReal(REAL_PI * storedReal(storedReal(0.5 * (slot % 4)) + 0.25));
    const vertex = rotated(
      {
        x: slot < 4 ? rx : storedReal(storedReal(rx / 3) + target.x),
        y: slot < 4 ? ry : storedReal(storedReal(ry / 3) + target.y),
        z: slot < 4 ? rz : storedReal(storedReal(rz / 3) + target.z),
      },
      { x: dx, y: dy, z: dz },
      angle
    );
    positions[v * 3] = vertex.x;
    positions[v * 3 + 1] = vertex.y;
    positions[v * 3 + 2] = vertex.z;
  }
  return { positions, indices: PYRAMID_TRIANGLES };
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
  // The enabled look is the node's debug colour; the disabled one is the grey that
  // `get_material("shape_material_disabled")` fetches alone, the unselected instantiated variant (:1027-1028).
  const colour = debugShapeColour(customColor);
  const color = useGodotLinearColor(colour);
  const look = enabled
    ? { color, opacity: colour.a }
    : { color: INSTANTIATED_LINEAR, opacity: gizmoAlpha('unselected', INSTANTIATED_GIZMO_COLOUR.a) };
  const line = useMemo(() => castTargetLine(target), [target]);
  const pyramid = useMemo(() => rayPyramid(target, thickness), [target, thickness]);
  const geometry = useMemo(() => {
    if (!pyramid) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pyramid.positions, 3));
    g.setIndex(new THREE.BufferAttribute(pyramid.indices, 1));
    return g;
  }, [pyramid]);
  return (
    <>
      {line && <GizmoLine positions={line} color={look.color} opacity={look.opacity} />}
      <GizmoMesh geometry={geometry} color={look.color} alpha={look.opacity} />
    </>
  );
}
