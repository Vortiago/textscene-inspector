/**
 * A mesh drawn once for each instance of a MultiMesh, as one geometry. Godot's canvas draws each
 * surface with one instanced call (`renderer_canvas_render_rd.cpp:3187-3212`): every instance of
 * surface 0, then every instance of surface 1. One merged index order blends the same way here.
 */

import * as THREE from 'three';
import { copyDrawnPrimitive } from '../../resources/meshes/godotSurface';
import type { MultiMeshInstance } from '../../resources/meshes/multimesh';
import { flipbookCell, type ParticlesFlipbook } from '../particlesFlipbook';
import { canvasMeshGeometry } from './canvasMeshGeometry';

/** The one instance of a mesh a MeshInstance2D draws: untransformed, uncoloured, with no custom data. */
export const MESH_INSTANCE: MultiMeshInstance = {
  transform: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]),
  color: null,
  customData: null,
};

/** The z of `INSTANCE_CUSTOM`, which picks the flipbook cell (`canvas_item_material.cpp:127`). */
const CUSTOM_DATA_Z = 2;

/**
 * `geometry` copied once per instance, in canvas space (see {@link canvasMeshGeometry}): shrunk to a
 * flipbook cell, then under the instance transform (`canvas.glsl:253-266`). The colour is the vertex
 * colour times the instance colour, in sRGB as stored. The caller disposes the result.
 */
export function canvasInstancesGeometry(
  geometry: THREE.BufferGeometry,
  instances: readonly MultiMeshInstance[],
  flipbook: ParticlesFlipbook | null
): THREE.BufferGeometry {
  const canvas = canvasMeshGeometry(geometry);
  const position = canvas.getAttribute('position');
  const uv = canvas.getAttribute('uv');
  const vertexColor = canvas.getAttribute('color');
  const index = canvas.getIndex();
  const vertexCount = position.count;
  const hasColors = vertexColor !== undefined || instances.some((instance) => instance.color);

  const positions = new Float32Array(instances.length * vertexCount * 3);
  const uvs = uv ? new Float32Array(instances.length * vertexCount * 2) : null;
  const colorValues = hasColors ? new Float32Array(instances.length * vertexCount * 4) : null;

  instances.forEach((instance, i) => {
    const { transform, color, customData } = instance;
    const cell = flipbookCell(flipbook, customData?.[CUSTOM_DATA_Z] ?? 0);
    for (let v = 0; v < vertexCount; v++) {
      const at = i * vertexCount + v;
      // Godot's y runs down, and the canvas geometry has already turned it up for the world.
      const x = position.getX(v) / cell.hFrames;
      const y = -position.getY(v) / cell.vFrames;
      positions[at * 3] = transform[0]! * x + transform[1]! * y + transform[3]!;
      positions[at * 3 + 1] = -(transform[4]! * x + transform[5]! * y + transform[7]!);
      if (uv && uvs) {
        uvs[at * 2] = uv.getX(v) / cell.hFrames + cell.uOffset;
        // three's V runs up and Godot's down: the cell is windowed in Godot's.
        uvs[at * 2 + 1] = 1 - ((1 - uv.getY(v)) / cell.vFrames + cell.vOffset);
      }
      if (colorValues) {
        colorValues[at * 4] = (vertexColor?.getX(v) ?? 1) * (color?.[0] ?? 1);
        colorValues[at * 4 + 1] = (vertexColor?.getY(v) ?? 1) * (color?.[1] ?? 1);
        colorValues[at * 4 + 2] = (vertexColor?.getZ(v) ?? 1) * (color?.[2] ?? 1);
        colorValues[at * 4 + 3] =
          (vertexColor && vertexColor.itemSize === 4 ? vertexColor.getW(v) : 1) * (color?.[3] ?? 1);
      }
    }
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (uvs) merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  // itemSize 4 makes three define USE_COLOR_ALPHA, which carries the per-instance alpha.
  if (colorValues) merged.setAttribute('color', new THREE.BufferAttribute(colorValues, 4));
  const ranges = surfaceRanges(geometry, index ? index.count : vertexCount);
  // A single unindexed surface over every vertex needs no index: its vertices already run in instance order.
  const isWholeUnindexedSurface =
    !index && ranges.length === 1 && ranges[0]!.start === 0 && ranges[0]!.count === vertexCount;
  if (!isWholeUnindexedSurface) {
    merged.setIndex(
      new THREE.BufferAttribute(surfaceMajorIndex(index, ranges, instances.length, vertexCount), 1)
    );
  }
  copyDrawnPrimitive(geometry, merged);
  canvas.dispose();
  return merged;
}

interface Range {
  start: number;
  count: number;
}

/** The index or vertex ranges of each surface of `geometry`, or the whole of it when it has no groups. */
function surfaceRanges(geometry: THREE.BufferGeometry, length: number): readonly Range[] {
  return geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count: length }];
}

/**
 * The index of `copies` copies of a mesh of `vertexCount` vertices, each surface's range for every
 * copy before the next surface's. `index` is null for an unindexed mesh, whose ranges are vertices.
 */
function surfaceMajorIndex(
  index: THREE.BufferAttribute | null,
  ranges: readonly Range[],
  copies: number,
  vertexCount: number
): Uint32Array {
  const perCopy = ranges.reduce((total, range) => total + range.count, 0);
  const merged = new Uint32Array(copies * perCopy);
  let at = 0;
  for (const { start, count } of ranges) {
    // Read the source range once, not once per copy.
    const source = new Uint32Array(count);
    for (let i = 0; i < count; i++) source[i] = index ? index.getX(start + i) : start + i;
    for (let copy = 0; copy < copies; copy++) {
      const offset = copy * vertexCount;
      for (let i = 0; i < count; i++) merged[at++] = source[i]! + offset;
    }
  }
  return merged;
}
