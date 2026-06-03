/**
 * Renders the geometry JSX for a MeshInstance3D's `mesh` SubResource.
 * Switches on Godot mesh primitive type: BoxMesh / SphereMesh / PlaneMesh /
 * CylinderMesh / CapsuleMesh / TorusMesh / PrismMesh.
 *
 * Returns null for unknown / external (GLB) / unresolvable mesh references —
 * the caller renders a placeholder geometry instead.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { parseBoxMesh } from '../../../resources/meshes/boxmesh/parser';
import { parseSphereMesh } from '../../../resources/meshes/spheremesh/parser';
import { parsePlaneMesh } from '../../../resources/meshes/planemesh/parser';
import { parseCylinderMesh } from '../../../resources/meshes/cylindermesh/parser';
import { parseCapsuleMesh } from '../../../resources/meshes/capsulemesh/parser';
import { parseTorusMesh } from '../../../resources/meshes/torusmesh/parser';
import { parsePrismMesh } from '../../../resources/meshes/prismmesh/parser';
import type { PlaneMeshProperties } from '../../../resources/meshes/planemesh/types';

export interface MeshGeometryProps {
  resource: TscnInternalResource;
}

export function MeshGeometry({ resource }: MeshGeometryProps) {
  // useMemo avoids re-parsing on every render; resource is stable per scene.
  const parsed = useMemo(() => parseByType(resource), [resource]);

  switch (parsed.type) {
    case 'BoxMesh':
      return (
        <boxGeometry
          args={[
            parsed.properties.size.x,
            parsed.properties.size.y,
            parsed.properties.size.z,
            parsed.properties.subdivideWidth + 1,
            parsed.properties.subdivideHeight + 1,
            parsed.properties.subdivideDepth + 1,
          ]}
        />
      );
    case 'SphereMesh':
      // is_hemisphere → render only the top dome (theta 0..π/2); a full sphere
      // sweeps theta 0..π. phiStart/phiLength stay at the full-circle defaults.
      return (
        <sphereGeometry
          args={[
            parsed.properties.radius,
            parsed.properties.radial_segments ?? 64,
            parsed.properties.rings ?? 32,
            0,
            Math.PI * 2,
            0,
            parsed.properties.isHemisphere ? Math.PI / 2 : Math.PI,
          ]}
        />
      );
    case 'PlaneMesh':
      return <PlaneMeshGeometry properties={parsed.properties} />;
    case 'CylinderMesh':
      return (
        <cylinderGeometry
          args={[
            parsed.properties.top_radius,
            parsed.properties.bottom_radius,
            parsed.properties.height,
            parsed.properties.radial_segments ?? 64,
            parsed.properties.rings ?? 4,
            // three.js can only drop BOTH caps; Godot single-cap removal isn't
            // representable, so we open the ends only when both caps are off.
            parsed.properties.capTop === false && parsed.properties.capBottom === false,
          ]}
        />
      );
    case 'CapsuleMesh': {
      // Godot height includes hemisphere caps; three.js wants only the cylinder
      // section. (THREE 0.184 renamed `length` → `height`.)
      const cylinderHeight = Math.max(
        0.01,
        parsed.properties.height - 2 * parsed.properties.radius
      );
      return (
        <capsuleGeometry
          args={[
            parsed.properties.radius,
            cylinderHeight,
            parsed.properties.rings,
            parsed.properties.radialSegments,
          ]}
        />
      );
    }
    case 'TorusMesh': {
      const radius = (parsed.properties.outerRadius + parsed.properties.innerRadius) / 2;
      const tube = (parsed.properties.outerRadius - parsed.properties.innerRadius) / 2;
      return (
        <torusGeometry
          args={[radius, tube, parsed.properties.ringSegments, parsed.properties.rings]}
        />
      );
    }
    case 'PrismMesh':
      return <PrismMeshGeometry properties={parsed.properties} />;
    default:
      return null;
  }
}

type ParsedMesh =
  | { type: 'BoxMesh'; properties: ReturnType<typeof parseBoxMesh> }
  | { type: 'SphereMesh'; properties: ReturnType<typeof parseSphereMesh> }
  | { type: 'PlaneMesh'; properties: ReturnType<typeof parsePlaneMesh> }
  | { type: 'CylinderMesh'; properties: ReturnType<typeof parseCylinderMesh> }
  | { type: 'CapsuleMesh'; properties: ReturnType<typeof parseCapsuleMesh> }
  | { type: 'TorusMesh'; properties: ReturnType<typeof parseTorusMesh> }
  | { type: 'PrismMesh'; properties: ReturnType<typeof parsePrismMesh> }
  | { type: 'unknown' };

/**
 * PlaneMesh with `orientation` and `center_offset` baked into the
 * BufferGeometry. The default declarative `<planeGeometry>` produces an
 * XY plane (normal +Z); Godot orientation 0/1/2 = FACE_X / FACE_Y / FACE_Z
 * rotates that into the corresponding world axis. The mesh-local
 * `center_offset` is applied via `geometry.translate` so it shifts the
 * verts before the node-level transform stage.
 */
function PlaneMeshGeometry({ properties }: { properties: PlaneMeshProperties }) {
  const geometry = useMemo(() => {
    // Godot subdivide_* = extra edge loops: N loops → N+1 face segments
    // (subdivide 0 → 1 segment).
    const widthSegments = properties.subdivideWidth + 1;
    const heightSegments = properties.subdivideDepth + 1;
    const geom = new THREE.PlaneGeometry(
      properties.size.x,
      properties.size.y,
      widthSegments,
      heightSegments
    );
    // FACE_X (orientation 0) → plane sits in YZ, normal points +X.
    // FACE_Y (orientation 1) → plane sits in XZ, normal points +Y.
    // FACE_Z (orientation 2) → plane sits in XY (default), normal points +Z.
    if (properties.orientation === 0) {
      geom.rotateY(Math.PI / 2);
    } else if (properties.orientation === 1) {
      geom.rotateX(-Math.PI / 2);
    }
    if (properties.centerOffset) {
      geom.translate(
        properties.centerOffset.x,
        properties.centerOffset.y,
        properties.centerOffset.z
      );
    }
    // WI-R3F-19 parity-audit fix: `flip_faces` reverses winding so the
    // surface is visible from the opposite side. The pre-migration
    // imperative renderer used `geometry.scale(-1, 1, 1); computeVertexNormals()`.
    if (properties.flipFaces) {
      geom.scale(-1, 1, 1);
      geom.computeVertexNormals();
    }
    return geom;
  }, [
    properties.size.x,
    properties.size.y,
    properties.subdivideWidth,
    properties.subdivideDepth,
    properties.orientation,
    properties.centerOffset?.x,
    properties.centerOffset?.y,
    properties.centerOffset?.z,
    properties.flipFaces,
  ]);

  return <primitive object={geometry} attach="geometry" />;
}

/**
 * PrismMesh approximates Godot's three-sided prism as a 3-radial-segment
 * cylinder. Godot orients the triangular face with a vertex at +X
 * (azimuth 0); three.js's CylinderGeometry's first vertex sits at the
 * first edge, giving an off-by-30° orientation. The pre-migration
 * imperative renderer rotated the geometry by `π/6` around Y to align,
 * and this restores parity (WI-R3F-19).
 */
function PrismMeshGeometry({
  properties,
}: {
  properties: ReturnType<typeof parsePrismMesh>;
}) {
  const geometry = useMemo(() => {
    const geom = new THREE.CylinderGeometry(
      properties.size.x / 2,
      properties.size.x / 2,
      properties.size.y,
      3,
      Math.max(1, properties.subdivideHeight),
      false
    );
    geom.rotateY(Math.PI / 6);
    return geom;
  }, [properties.size.x, properties.size.y, properties.subdivideHeight]);

  return <primitive object={geometry} attach="geometry" />;
}

function parseByType(resource: TscnInternalResource): ParsedMesh {
  const data = resource.data as Record<string, string>;
  switch (resource.type) {
    case 'BoxMesh':
      return { type: 'BoxMesh', properties: parseBoxMesh(data) };
    case 'SphereMesh':
      return { type: 'SphereMesh', properties: parseSphereMesh(data) };
    case 'PlaneMesh':
      return { type: 'PlaneMesh', properties: parsePlaneMesh(data) };
    case 'CylinderMesh':
      return { type: 'CylinderMesh', properties: parseCylinderMesh(data) };
    case 'CapsuleMesh':
      return { type: 'CapsuleMesh', properties: parseCapsuleMesh(data) };
    case 'TorusMesh':
      return { type: 'TorusMesh', properties: parseTorusMesh(data) };
    case 'PrismMesh':
      return { type: 'PrismMesh', properties: parsePrismMesh(data) };
    default:
      return { type: 'unknown' };
  }
}
