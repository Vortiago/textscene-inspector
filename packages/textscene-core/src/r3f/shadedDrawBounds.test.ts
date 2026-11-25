import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { ShaderText } from '../resources/materials/shadermaterial/types';
import { DEFAULT_CANVAS_MAPS, GODOT_CANVAS_TEXTURE_STATE } from '../shaders/canvas/canvasTexture';
import { withGodotAttributes } from '../shaders/spatial/meshAttributes';
import { GODOT_SAMPLING } from '../shaders/uniforms/samplerState';
import { computeWorldBoundingBox } from './bounds';
import { worldBox } from './canvasGroup/groupRegion';
import type { Drawable } from './drawable';
import type { CanvasShaderCommand } from './canvasShader/canvasCommands';
import { canvasShaderDraw, canvasShaderOf } from './canvasShader/canvasShaderDraw';
import { drawPoints } from './spatialShader/pointSurface';

/** The box the camera frames a draw on, and the box a clip group's region reads, or null for none. */
interface DrawBounds {
  readonly frame: THREE.Box3;
  readonly clip: THREE.Box3 | null;
}

const boundsOf = (drawn: THREE.Object3D): DrawBounds => {
  const frame = computeWorldBoundingBox(drawn);
  return { frame, clip: worldBox(drawn as Drawable)?.clone() ?? null };
};

const box = (min: [number, number, number], max: [number, number, number]) =>
  new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));

const EMPTY = new THREE.Box3();

const PLAIN = 'shader_type canvas_item;\nvoid fragment() { COLOR = vec4(UV, 0.5, 1.0); }\n';
const SIZED_POINTS = 'shader_type canvas_item;\nvoid vertex() { POINT_SIZE = 4.0; }\n';

function canvasItem(code: string) {
  const shader: ShaderText = { code, file: 'res://shader.gdshader', parameters: {}, textures: {} };
  const compiled = canvasShaderOf(shader, {});
  if (!('item' in compiled)) throw new Error(`expected a compiled canvas shader, got ${compiled.refusal}`);
  return compiled.item;
}

const gl = {
  getRenderTarget: () => null,
  getDrawingBufferSize: (size: THREE.Vector2) => size.set(64, 32),
} as unknown as THREE.WebGLRenderer;

const SAMPLING = {
  maps: DEFAULT_CANVAS_MAPS,
  textureState: GODOT_CANVAS_TEXTURE_STATE,
  sampling: GODOT_SAMPLING,
};
const TEXTURE = new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);

const rectAt = (x: number, y: number): CanvasShaderCommand => {
  const rect = { x, y, w: 8, h: 4 };
  return {
    kind: 'rect',
    region: { rect, source: rect, clipUv: false },
    modulate: { r: 1, g: 1, b: 1, a: 1 },
  };
};

const meshOf = (primitive: 'triangles' | 'points', points = [0, 0, 8, 0, 0, 4]): CanvasShaderCommand => ({
  kind: 'mesh',
  arrays: {
    primitive,
    points: Array.from({ length: points.length / 2 }, (_, i) => ({
      x: points[2 * i]!,
      y: points[2 * i + 1]!,
    })),
    colors: [],
    uvs: [],
  },
});

/** The item rect of the commands at (0, 0), 8 by 4 in Godot's frame, with three's y. */
const ITEM_RECT = box([0, -4, 0], [8, 0, 0]);

/** Each frame gives the batch new sources: the rects move, as an AnimatedSprite2D's do. */
function canvasBatch(code: string, commands: CanvasShaderCommand[], frames: CanvasShaderCommand[][] = []) {
  const draw = canvasShaderDraw(gl, canvasItem(code), SAMPLING, commands);
  for (const frame of frames) draw.setSource(TEXTURE, frame);
  return draw.object.children[0]!;
}

/** A quad of two draw groups, the second at x 1 to 4. */
function quadSurface(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 4, 0, 0, 4, 2, 0, 0, 2, 0], 3)
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 1);
  return withGodotAttributes(geometry);
}

const QUAD_BOX = box([0, 0, 0], [4, 2, 0]);

const material = new THREE.MeshBasicMaterial();

/** What `WebGLRenderer.render` calls on `scene` before it builds the render list. */
const beforeRenderList = (scene: THREE.Scene) =>
  scene.onBeforeRender(
    {} as THREE.WebGLRenderer,
    scene,
    new THREE.PerspectiveCamera(),
    null as never,
    material,
    null as never
  );

/** The emulated points of `host`, in a scene of their own so that no other case's render reaches them. */
function spatialPoints(host: THREE.Mesh, drawGroup: number | null = null, scene = new THREE.Scene()) {
  drawPoints(host, drawGroup, material, 'emulated', scene);
  return host.children[0]!;
}

function gainsPositionInPlace(): THREE.Object3D {
  const host = new THREE.Mesh(new THREE.BufferGeometry());
  const drawn = spatialPoints(host);
  host.geometry.setAttribute('position', quadSurface().getAttribute('position'));
  host.geometry.computeBoundingBox();
  return drawn;
}

function gainsSurfaceBeforeARender(): THREE.Object3D {
  const scene = new THREE.Scene();
  const host = new THREE.Mesh(new THREE.BufferGeometry());
  const drawn = spatialPoints(host, null, scene);
  host.geometry = quadSurface();
  beforeRenderList(scene);
  return drawn;
}

function recomputesInPlace(): THREE.Object3D {
  const host = new THREE.Mesh(quadSurface());
  const drawn = spatialPoints(host);
  host.geometry.getAttribute('position').setX(1, 6);
  host.geometry.computeBoundingBox();
  return drawn;
}

/** A new surface on the host before each of two renders, as a mesh written every frame. */
function newSurfaceEachFrame(): THREE.Object3D {
  const scene = new THREE.Scene();
  const host = new THREE.Mesh(quadSurface());
  const drawn = spatialPoints(host, null, scene);
  for (const width of [5, 6]) {
    host.geometry = quadSurface();
    host.geometry.getAttribute('position').setX(1, width);
    beforeRenderList(scene);
  }
  return drawn;
}

function overInstances(): THREE.Object3D {
  const instances = new THREE.InstancedBufferGeometry().copy(quadSurface() as THREE.InstancedBufferGeometry);
  const host = new THREE.Mesh(instances);
  return spatialPoints(host);
}

describe('the bounds of a shaded draw', () => {
  it.each<[string, () => THREE.Object3D, DrawBounds]>([
    [
      'a canvas rect batch before its first source',
      () => canvasBatch(PLAIN, [rectAt(0, 0)]),
      { frame: ITEM_RECT, clip: ITEM_RECT },
    ],
    [
      'a canvas rect batch whose rects move each frame',
      () => canvasBatch(PLAIN, [rectAt(0, 0)], [[rectAt(2, 0)], [rectAt(-2, 1)]]),
      { frame: box([-2, -5, 0], [6, -1, 0]), clip: box([-2, -5, 0], [6, -1, 0]) },
    ],
    [
      'a canvas mesh batch',
      () => canvasBatch(PLAIN, [meshOf('triangles')]),
      { frame: ITEM_RECT, clip: ITEM_RECT },
    ],
    [
      "a canvas mesh of three's points",
      () => canvasBatch(PLAIN, [meshOf('points')]),
      { frame: ITEM_RECT, clip: ITEM_RECT },
    ],
    [
      'a canvas mesh of emulated points',
      () => canvasBatch(SIZED_POINTS, [meshOf('points')]),
      { frame: ITEM_RECT, clip: ITEM_RECT },
    ],
    [
      'a canvas mesh of emulated points given a new source each frame',
      () => canvasBatch(SIZED_POINTS, [meshOf('points')], [[meshOf('points')], [meshOf('points')]]),
      { frame: ITEM_RECT, clip: ITEM_RECT },
    ],
    [
      'a canvas mesh of no points',
      () => canvasBatch(PLAIN, [meshOf('triangles', [])]),
      { frame: EMPTY, clip: null },
    ],
    [
      'emulated points of a spatial surface with positions',
      () => spatialPoints(new THREE.Mesh(quadSurface())),
      { frame: QUAD_BOX, clip: QUAD_BOX },
    ],
    [
      'emulated points of one draw group, which Godot bounds by the whole mesh (mesh_instance_3d.cpp:230-232)',
      () => spatialPoints(new THREE.Mesh(quadSurface()), 1),
      { frame: QUAD_BOX, clip: QUAD_BOX },
    ],
    [
      'emulated points of a spatial surface with no position yet',
      () => spatialPoints(new THREE.Mesh(new THREE.BufferGeometry())),
      { frame: EMPTY, clip: null },
    ],
    [
      'emulated points of a surface that gains positions in place',
      gainsPositionInPlace,
      { frame: QUAD_BOX, clip: QUAD_BOX },
    ],
    [
      'emulated points of a host that gains a surface before a render',
      gainsSurfaceBeforeARender,
      { frame: QUAD_BOX, clip: QUAD_BOX },
    ],
    [
      'emulated points of a surface whose box is recomputed in place',
      recomputesInPlace,
      { frame: box([0, 0, 0], [6, 2, 0]), clip: box([0, 0, 0], [6, 2, 0]) },
    ],
    [
      'emulated points of a host given a new surface each frame',
      newSurfaceEachFrame,
      { frame: box([0, 0, 0], [6, 2, 0]), clip: box([0, 0, 0], [6, 2, 0]) },
    ],
    [
      'emulated points over instances, which the host frames, and which no clip group holds',
      overInstances,
      { frame: EMPTY, clip: QUAD_BOX },
    ],
  ])('%s', (_, drawn, bounds) => {
    expect(boundsOf(drawn())).toEqual(bounds);
  });
});
