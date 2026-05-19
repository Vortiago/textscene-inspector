/**
 * Renders the geometry JSX for a MeshInstance3D's `mesh` SubResource.
 * Switches on Godot mesh primitive type: BoxMesh / SphereMesh / PlaneMesh /
 * CylinderMesh / CapsuleMesh / TorusMesh / PrismMesh.
 *
 * Returns null for unknown / external (GLB) / unresolvable mesh references —
 * the caller renders a placeholder geometry instead.
 */

import { useMemo } from 'react';
import type { TscnInternalResource } from '../../../parser/types';
import { parseBoxMesh } from '../../../resources/meshes/boxmesh/parser';
import { parseSphereMesh } from '../../../resources/meshes/spheremesh/parser';
import { parsePlaneMesh } from '../../../resources/meshes/planemesh/parser';
import { parseCylinderMesh } from '../../../resources/meshes/cylindermesh/parser';
import { parseCapsuleMesh } from '../../../resources/meshes/capsulemesh/parser';
import { parseTorusMesh } from '../../../resources/meshes/torusmesh/parser';
import { parsePrismMesh } from '../../../resources/meshes/prismmesh/parser';

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
          args={[parsed.properties.size.x, parsed.properties.size.y, parsed.properties.size.z]}
        />
      );
    case 'SphereMesh':
      return (
        <sphereGeometry
          args={[
            parsed.properties.radius,
            parsed.properties.radial_segments ?? 32,
            parsed.properties.rings ?? 16,
          ]}
        />
      );
    case 'PlaneMesh':
      return (
        <planeGeometry
          args={[
            parsed.properties.size.x,
            parsed.properties.size.y,
            Math.max(1, parsed.properties.subdivideWidth),
            Math.max(1, parsed.properties.subdivideDepth),
          ]}
        />
      );
    case 'CylinderMesh':
      return (
        <cylinderGeometry
          args={[
            parsed.properties.top_radius,
            parsed.properties.bottom_radius,
            parsed.properties.height,
            parsed.properties.radial_segments ?? 32,
            parsed.properties.rings ?? 1,
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
      return (
        <cylinderGeometry
          args={[
            parsed.properties.size.x / 2,
            parsed.properties.size.x / 2,
            parsed.properties.size.y,
            3,
            Math.max(1, parsed.properties.subdivideHeight),
            false,
          ]}
        />
      );
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
