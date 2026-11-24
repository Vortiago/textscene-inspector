import type * as THREE from 'three';

/** The userData flag of a mesh that draws for the engine, such as the sky: no object of Godot's. */
export const ENGINE_DRAW_FLAG = 'tscnEngineDraw';

/** A geometry group: three's typings name it a `Group` (r187 `WebGLRenderLists.d.ts`). */
interface DrawGroup {
  start: number;
  count: number;
}

export interface DrawnSurfaces {
  objects: number;
  primitives: number;
}

/** Adds the surfaces of `list` as Godot's monitor counts them. A surface with no vertex counts nothing. */
export function countDrawnSurfaces(list: THREE.WebGLRenderList, counts: DrawnSurfaces): void {
  countItems(list.opaque, counts);
  countItems(list.transmissive, counts);
  countItems(list.transparent, counts);
}

// Indexed, not `for...of`: no iterator per list per frame.
function countItems(items: readonly THREE.RenderItem[], counts: DrawnSurfaces): void {
  for (let index = 0; index < items.length; index++) {
    const { object, geometry, group } = items[index]!;
    // three's background mesh joins the list with no parent (r187 `WebGLBackground.js` `addToRenderList`).
    if (!geometry || !object.parent || object.userData[ENGINE_DRAW_FLAG]) continue;
    const vertices = drawnVertices(geometry, group as DrawGroup | null);
    if (vertices <= 0) continue;
    counts.objects += 1;
    counts.primitives += primitivesOf(object, vertices) * instancesOf(object, geometry);
  }
}

/** The vertices a draw of `geometry` reads, cut to `group` (r187 `WebGLRenderer.js` `renderBufferDirect`). */
function drawnVertices(geometry: THREE.BufferGeometry, group: DrawGroup | null): number {
  const available = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
  let start = Math.max(geometry.drawRange.start, 0);
  let end = Math.min(geometry.drawRange.start + geometry.drawRange.count, available);
  if (group) {
    start = Math.max(start, group.start);
    end = Math.min(end, group.start + group.count);
  }
  return end - start;
}

/** Godot's `_indices_to_primitives` (rasterizer_scene_gles3.cpp) for the primitive `object` draws. */
function primitivesOf(object: THREE.Object3D, vertices: number): number {
  const line = object as THREE.Line;
  if (line.isLine) return (object as THREE.LineSegments).isLineSegments ? vertices / 2 : vertices - 1;
  if ((object as THREE.Points).isPoints) return vertices;
  return Math.floor(vertices / 3);
}

function instancesOf(object: THREE.Object3D, geometry: THREE.BufferGeometry): number {
  if ((object as THREE.InstancedMesh).isInstancedMesh) return (object as THREE.InstancedMesh).count;
  const instanced = geometry as THREE.InstancedBufferGeometry & { _maxInstanceCount?: number };
  if (!instanced.isInstancedBufferGeometry) return 1;
  // three draws at most `_maxInstanceCount` instances (r187 `WebGLRenderer.js` `renderBufferDirect`).
  return Math.min(instanced.instanceCount, instanced._maxInstanceCount ?? Infinity);
}
