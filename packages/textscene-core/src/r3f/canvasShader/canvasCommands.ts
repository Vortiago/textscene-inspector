import type * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { rect2Intersection, type Rect2 } from '../../godot/math/rect2';
import { bottomUpV } from '../../godot/math/uv';
import type { Vector2 } from '../../godot/math/vector';
import { geometryPrimitive } from '../../resources/meshes/godotSurface';
import type { AtlasCellRects } from '../../resources/useTexture2D';
import type { CanvasVertexArrays } from '../../shaders/canvas/canvasAttributes';
import type { CanvasSurface } from '../canvasMesh/canvasSurface';

/** `canvas_item_add_texture_rect_region` with a white modulate (`renderer_canvas_cull.cpp:1624`). */
export interface CanvasRectRegion {
  /** In the item's pixels. */
  readonly rect: Rect2;
  /** In the texture's texels. */
  readonly source: Rect2;
  readonly clipUv: boolean;
  /** Whether the texture's x runs along the rect's y, as a transposed tile draws. */
  readonly transpose?: boolean;
}

/** `AtlasTexture::get_rect_region` (`atlas_texture.cpp:193-224`): the rect on the atlas, or null for none. */
export function atlasRectRegion(
  { rect, source }: CanvasRectRegion,
  atlas: AtlasCellRects
): CanvasRectRegion | null {
  const { cell, region } = atlas;
  const size = source.w === 0 && source.h === 0 ? { w: region.w, h: region.h } : { w: source.w, h: source.h };
  const scaleX = rect.w / size.w;
  const scaleY = rect.h / size.h;
  const moved = { x: source.x + cell.x, y: source.y + cell.y, ...size };
  const clipped = rect2Intersection(
    { x: cell.x + region.x, y: cell.y + region.y, w: region.w, h: region.h },
    moved
  );
  if (clipped.w === 0 && clipped.h === 0) return null;
  const offsetX = clipped.x - moved.x + (scaleX < 0 ? clipped.w - moved.w : 0);
  const offsetY = clipped.y - moved.y + (scaleY < 0 ? clipped.h - moved.h : 0);
  return {
    rect: {
      x: rect.x + offsetX * scaleX,
      y: rect.y + offsetY * scaleY,
      w: clipped.w * scaleX,
      h: clipped.h * scaleY,
    },
    source: clipped,
    clipUv: atlas.filterClip,
  };
}

/** An item's command that a canvas_item shader draws through Godot's canvas template. */
export type CanvasShaderCommand =
  | { readonly kind: 'rect'; readonly region: CanvasRectRegion; readonly modulate: Rgba }
  | { readonly kind: 'mesh'; readonly arrays: CanvasVertexArrays };

/** Each surface at the item's origin, white (`polygon_2d.cpp:401`), or null for a placed or skinned one. */
export function surfaceCommands(surfaces: readonly CanvasSurface[]): CanvasShaderCommand[] | null {
  if (surfaces.some(isPlacedOrSkinned)) return null;
  return surfaces.map(({ geometry, arrayColor }) => ({
    kind: 'mesh',
    arrays: vertexArraysOf(geometry, arrayColor, threeFramePoint),
  }));
}

/** The command of each mesh geometry, read from the source: its y already runs down, as Godot's. */
export function meshCommands(geometries: readonly THREE.BufferGeometry[]): CanvasShaderCommand[] {
  return geometries.map((geometry) => ({
    kind: 'mesh',
    arrays: vertexArraysOf(geometry, undefined, godotFramePoint),
  }));
}

type PointReader = (position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) => Vector2;

const threeFramePoint: PointReader = (position, i) => ({ x: position.getX(i), y: 0 - position.getY(i) });

const godotFramePoint: PointReader = (position, i) => ({ x: position.getX(i), y: position.getY(i) });

const isPlacedOrSkinned = ({ position, scale, matrix, isSkinned }: CanvasSurface) =>
  Boolean(position || scale || matrix || isSkinned);

/** The arrays of a geometry in Godot's frame, its points through `pointOf`, v down from the top. */
function vertexArraysOf(
  geometry: THREE.BufferGeometry,
  arrayColor: Rgba | undefined,
  pointOf: PointReader
): CanvasVertexArrays {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const color = geometry.getAttribute('color');
  const points: Vector2[] = [];
  const uvs: Vector2[] = [];
  const colors: Rgba[] = arrayColor && !color ? [arrayColor] : [];
  for (let i = 0; i < position.count; i++) {
    points.push(pointOf(position, i));
    if (uv) uvs.push({ x: uv.getX(i), y: bottomUpV(uv.getY(i)) });
    if (color)
      colors.push({
        r: color.getX(i),
        g: color.getY(i),
        b: color.getZ(i),
        a: color.itemSize === 4 ? color.getW(i) : 1,
      });
  }
  const index = geometry.getIndex();
  return {
    primitive: geometryPrimitive(geometry),
    ...(index && { indices: Array.from(index.array) }),
    points,
    colors,
    uvs,
  };
}

/** Whether two command lists draw the same batches: the same kinds in order, and the same mesh arrays. */
export function sameCommandLayout(
  a: readonly CanvasShaderCommand[],
  b: readonly CanvasShaderCommand[]
): boolean {
  return (
    a.length === b.length &&
    a.every((command, index) => {
      const other = b[index]!;
      if (command.kind === 'rect') return other.kind === 'rect';
      return other.kind === 'mesh' && other.arrays === command.arrays;
    })
  );
}
