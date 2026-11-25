import * as THREE from 'three';
import { QUAD_VERTICES } from '../../godot/rendering/emulatedPoints.js';
import { storedLanes } from '../storedLanes.js';

/** The `userData` key of turned corners, which `clone` carries. A caller that sets a new index deletes it. */
export const FIRST_CORNER_LAST = 'godotFirstCornerLast';

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

/** The corners of a surface that one draw reads, as a three.js draw group holds them. */
export interface DrawRange {
  readonly start: number;
  readonly count: number;
}

/** A point for each index in `range`, as Vulkan's indexed points: `render_forward_clustered.cpp:603`. */
export function emulatedPointGeometry(
  surface: THREE.BufferGeometry,
  range?: DrawRange
): THREE.InstancedBufferGeometry {
  const vertices = drawnVertices(surface, range);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.instanceCount = vertices.length;
  // three counts a draw's vertices by `position`, which the template does not read.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(QUAD_VERTICES * 3), 3));
  for (const [name, attribute] of Object.entries(surface.attributes))
    if (name.endsWith('_attrib')) geometry.setAttribute(name, perPoint(attribute, vertices));
  // The quads' own positions are all zero, so bounds three computed from them would cull at the origin.
  if (surface.getAttribute('position')) {
    if (!surface.boundingSphere) surface.computeBoundingSphere();
    if (!surface.boundingBox) surface.computeBoundingBox();
  }
  // Shared, not copied: three recomputes a box in place, so a new box of the surface reaches the quads.
  geometry.boundingSphere = surface.boundingSphere;
  // A surface with no position yet bounds nothing, in a box of its own that its first compute fills in place.
  geometry.boundingBox = surface.boundingBox ??= new THREE.Box3();
  return geometry;
}

/** The vertex of each corner in `range`, in draw order: every vertex once for a surface with no index. */
function drawnVertices(surface: THREE.BufferGeometry, range: DrawRange | undefined): Float32Array {
  const index = surface.getIndex();
  // No corners for a surface with no position yet, as a mesh has before its geometry attaches.
  const cornerCount = index?.count ?? surface.getAttribute('position')?.count ?? 0;
  const start = range?.start ?? 0;
  const end = Math.min(range ? start + range.count : cornerCount, cornerCount);
  // A float holds every vertex index below 2^24 exactly.
  const vertices = new Float32Array(Math.max(0, end - start));
  const corners = surface.userData[FIRST_CORNER_LAST] as number | undefined;
  for (let corner = start; corner < end; corner++)
    vertices[corner - start] = index ? index.getX(corners ? godotCorner(corner, corners) : corner) : corner;
  return vertices;
}

/** The loader swaps a triangle's last two corners and `withFirstCornerLast` turns it: Godot's in reverse. */
function godotCorner(corner: number, corners: number): number {
  return corner - (corner % corners) + corners - 1 - (corner % corners);
}

/** `attribute` read once a point: every point shares the one item of a constant attribute. */
function perPoint(attribute: Attribute, vertices: Float32Array): THREE.InstancedBufferAttribute {
  const isConstant = (attribute as THREE.InstancedBufferAttribute).isInstancedBufferAttribute === true;
  const values = storedLanes(attribute, isConstant ? [0] : vertices);
  const perInstance = new THREE.InstancedBufferAttribute(
    values,
    attribute.itemSize,
    attribute.normalized,
    isConstant ? Math.max(1, vertices.length) : 1
  );
  perInstance.gpuType = (attribute as THREE.BufferAttribute).gpuType ?? THREE.FloatType;
  return perInstance;
}
