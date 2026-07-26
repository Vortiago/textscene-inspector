/**
 * Builds a `BufferGeometry` from a Godot PrimitiveMesh sub-resource.
 *
 * Extracted from `meshGeometry.tsx` so callers that need geometry as DATA rather than as
 * JSX can share one definition: CSGMesh3D wraps a mesh resource as a CSG contribution,
 * and the boolean evaluator needs triangles, not a React element.
 *
 * Returns `null` for unknown, external (GLB) or unresolvable mesh types; the caller
 * decides whether that means a placeholder or nothing at all.
 *
 * Every axis fix and off-by-30-degree correction here is load-bearing parity work
 * measured against real Godot; the comments say which and why.
 */

import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { parseBoxMesh } from '../../../resources/meshes/boxmesh/parser';
import { parseSphereMesh } from '../../../resources/meshes/spheremesh/parser';
import { parsePlaneMesh } from '../../../resources/meshes/planemesh/parser';
import { parseCylinderMesh } from '../../../resources/meshes/cylindermesh/parser';
import { parseCapsuleMesh } from '../../../resources/meshes/capsulemesh/parser';
import { parseTorusMesh } from '../../../resources/meshes/torusmesh/parser';
import { parsePrismMesh } from '../../../resources/meshes/prismmesh/parser';
import { parseQuadMesh } from '../../../resources/meshes/quadmesh/parser';

/**
 * A stable key over the sub-resource's CONTENT, for memoizing the build.
 *
 * Keying on the resource object instead would rebuild (and never dispose) the geometry on
 * every reparse, because the parser allocates a fresh resource per parse and the source
 * pane reparses on every keystroke.
 */
export function primitiveMeshGeometryKey(resource: TscnInternalResource): string {
  return `${resource.type}|${JSON.stringify(resource.data)}`;
}

export function buildPrimitiveMeshGeometry(
  resource: TscnInternalResource
): THREE.BufferGeometry | null {
  const data = resource.data as Record<string, string>;

  switch (resource.type) {
    case 'BoxMesh': {
      const p = parseBoxMesh(data);
      // Godot subdivide_* counts extra edge loops: N loops give N+1 face segments.
      return new THREE.BoxGeometry(
        p.size.x,
        p.size.y,
        p.size.z,
        p.subdivideWidth + 1,
        p.subdivideHeight + 1,
        p.subdivideDepth + 1
      );
    }

    case 'SphereMesh': {
      const p = parseSphereMesh(data);
      // is_hemisphere sweeps theta 0..pi/2 instead of 0..pi.
      return new THREE.SphereGeometry(
        p.radius,
        p.radial_segments ?? 64,
        p.rings ?? 32,
        0,
        Math.PI * 2,
        0,
        p.isHemisphere ? Math.PI / 2 : Math.PI
      );
    }

    case 'PlaneMesh':
    case 'QuadMesh': {
      // QuadMesh is a PlaneMesh whose orientation is fixed to FACE_Z.
      const p = resource.type === 'QuadMesh' ? parseQuadMesh(data) : parsePlaneMesh(data);
      const geom = new THREE.PlaneGeometry(
        p.size.x,
        p.size.y,
        p.subdivideWidth + 1,
        p.subdivideDepth + 1
      );
      // three's PlaneGeometry is an XY plane with normal +Z, which is Godot's FACE_Z (2).
      // FACE_X (0) rotates it into YZ, FACE_Y (1) into XZ.
      if (p.orientation === 0) geom.rotateY(Math.PI / 2);
      else if (p.orientation === 1) geom.rotateX(-Math.PI / 2);

      const offset = p.centerOffset;
      if (offset) geom.translate(offset.x, offset.y, offset.z);

      // flip_faces reverses winding so the surface is visible from the other side.
      if (p.flipFaces) {
        geom.scale(-1, 1, 1);
        geom.computeVertexNormals();
      }
      return geom;
    }

    case 'CylinderMesh': {
      const p = parseCylinderMesh(data);
      return new THREE.CylinderGeometry(
        p.top_radius,
        p.bottom_radius,
        p.height,
        p.radial_segments ?? 64,
        p.rings ?? 4,
        // three can only drop BOTH caps, so Godot's single-cap removal is not
        // representable; open the ends only when both caps are off.
        p.capTop === false && p.capBottom === false
      );
    }

    case 'CapsuleMesh': {
      const p = parseCapsuleMesh(data);
      // Godot's `height` is the TOTAL height including both hemisphere caps; three
      // wants only the cylindrical mid-section.
      const mid = Math.max(0.01, p.height - 2 * p.radius);
      return new THREE.CapsuleGeometry(p.radius, mid, p.rings, p.radialSegments);
    }

    case 'TorusMesh': {
      const p = parseTorusMesh(data);
      // three revolves the tube around Z (ring in XY, hole facing +Z); Godot revolves
      // around Y (ring in XZ, hole facing +Y). The torus is symmetric about its ring
      // plane, so the rotation sign is immaterial.
      const geom = new THREE.TorusGeometry(
        (p.outerRadius + p.innerRadius) / 2,
        (p.outerRadius - p.innerRadius) / 2,
        p.ringSegments,
        p.rings
      );
      geom.rotateX(Math.PI / 2);
      return geom;
    }

    case 'PrismMesh': {
      const p = parsePrismMesh(data);
      // Approximated as a 3-segment cylinder. Godot puts a vertex of the triangular
      // face at +X (azimuth 0); three's CylinderGeometry starts at an EDGE, so without
      // the pi/6 rotation the prism sits 30 degrees off.
      const geom = new THREE.CylinderGeometry(
        p.size.x / 2,
        p.size.x / 2,
        p.size.y,
        3,
        p.subdivideHeight + 1,
        false
      );
      geom.rotateY(Math.PI / 6);
      return geom;
    }

    default:
      return null;
  }
}
