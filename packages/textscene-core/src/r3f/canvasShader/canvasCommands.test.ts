import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { emulatedPointGeometry, withGodotAttributes } from '../../shaders/spatial/meshAttributes';
import { canvasSurfaceGeometry } from '../canvasMesh/canvasSurface';
import { canvasMeshGeometry } from '../meshes/canvasMeshGeometry';
import {
  atlasRectRegion,
  boundItem,
  meshCommands,
  sameCommandLayout,
  surfaceCommands,
  type CanvasShaderCommand,
} from './canvasCommands';

/** A 16 by 8 cell at (32, 16) of its atlas, with a 2 px margin left and top around a 14 by 6 region. */
const CELL = {
  sheetSize: { width: 64, height: 64 },
  cell: { x: 32, y: 16, w: 16, h: 8 },
  region: { x: 2, y: 2, w: 14, h: 6 },
  filterClip: true,
};

describe('atlasRectRegion', () => {
  it('reads the cell in the atlas, and draws only the region past the margin', () => {
    const region = {
      rect: { x: -8, y: -4, w: 16, h: 8 },
      source: { x: 0, y: 0, w: 16, h: 8 },
      clipUv: false,
    };

    expect(atlasRectRegion(region, CELL)).toEqual({
      rect: { x: -6, y: -2, w: 14, h: 6 },
      source: { x: 34, y: 18, w: 14, h: 6 },
      clipUv: true,
    });
  });

  it('keeps the margin on the far side of a flipped rect', () => {
    const region = {
      rect: { x: 8, y: -4, w: -16, h: 8 },
      source: { x: 0, y: 0, w: 16, h: 8 },
      clipUv: false,
    };

    expect(atlasRectRegion(region, CELL)?.rect).toEqual({ x: 8, y: -2, w: -14, h: 6 });
  });

  it('scales with the rect, as a magnified sprite does', () => {
    const region = { rect: { x: 0, y: 0, w: 32, h: 16 }, source: { x: 4, y: 0, w: 8, h: 8 }, clipUv: false };

    expect(atlasRectRegion(region, CELL)).toMatchObject({
      rect: { x: 0, y: 4, w: 32, h: 12 },
      source: { x: 36, y: 18, w: 8, h: 6 },
    });
  });

  it('draws nothing for a source wholly in the margin', () => {
    const region = { rect: { x: 0, y: 0, w: 2, h: 2 }, source: { x: 0, y: 0, w: 2, h: 2 }, clipUv: false };

    expect(atlasRectRegion(region, CELL)).toBeNull();
  });
});

/** A triangle in Godot's frame, as a drawer hands it to `canvasSurfaceGeometry`. */
const TRIANGLE = {
  positions: Float32Array.from([0, 0, 8, 0, 0, 4]),
  uvs: [0, 0, 1, 0, 0, 0.25],
  colors: Float32Array.from([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0.5]),
  indices: [0, 1, 2],
};

describe('surfaceCommands', () => {
  it("reads a surface's vertices back in Godot's frame: y down, and v down from the top", () => {
    const [command] = surfaceCommands([{ geometry: canvasSurfaceGeometry(TRIANGLE) }])!;

    expect(command).toEqual({
      kind: 'mesh',
      arrays: {
        primitive: 'triangles',
        indices: [0, 1, 2],
        points: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 0, y: 4 },
        ],
        colors: [
          { r: 1, g: 0, b: 0, a: 1 },
          { r: 0, g: 1, b: 0, a: 1 },
          { r: 0, g: 0, b: 1, a: 0.5 },
        ],
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 0.25 },
        ],
      },
    });
  });

  it('gives the array colour as the one colour of every vertex', () => {
    const geometry = canvasSurfaceGeometry({ positions: TRIANGLE.positions, indices: [0, 1, 2] });
    const arrayColor = { r: 0.5, g: 0.25, b: 1, a: 1 };

    const [command] = surfaceCommands([{ geometry, arrayColor }])!;

    expect(command?.kind === 'mesh' && [command.arrays.colors, command.arrays.uvs]).toEqual([
      [arrayColor],
      [],
    ]);
  });

  it('draws a points surface as points', () => {
    const geometry = canvasSurfaceGeometry({ positions: TRIANGLE.positions });
    geometry.userData.godotPrimitive = 'points';

    const [command] = surfaceCommands([{ geometry }])!;

    expect(command?.kind === 'mesh' && command.arrays.primitive).toBe('points');
  });

  it('gives no commands for a surface a skeleton bends', () => {
    expect(surfaceCommands([{ geometry: canvasSurfaceGeometry(TRIANGLE), isSkinned: true }])).toBeNull();
  });

  it.each([
    ['a position', { position: [1, 0, 0] as [number, number, number] }],
    ['a scale', { scale: [2, 2, 1] as [number, number, number] }],
    ['a matrix', { matrix: new THREE.Matrix4() }],
  ])('gives no commands for a surface placed by %s', (_, placement) => {
    expect(surfaceCommands([{ geometry: canvasSurfaceGeometry(TRIANGLE), ...placement }])).toBeNull();
  });
});

describe('meshCommands', () => {
  it("reads a mesh's own vertices as the canvas surface of the mesh gives them", () => {
    const mesh = canvasMeshGeometry(canvasSurfaceGeometry(TRIANGLE));

    expect(meshCommands([mesh])).toEqual(surfaceCommands([{ geometry: canvasMeshGeometry(mesh) }]));
  });

  it("reads the mesh's CUSTOM0 and CUSTOM1 arrays, which the canvas template reads", () => {
    const geometry = canvasSurfaceGeometry(TRIANGLE);
    const custom1 = new Float32Array(12).fill(0.25);
    geometry.setAttribute('custom1', new THREE.BufferAttribute(custom1, 4));
    const [command] = meshCommands([geometry]);

    expect(command?.kind === 'mesh' && command.arrays.customs).toEqual([undefined, custom1]);
  });

  it('gives a mesh with no custom array no customs', () => {
    const [command] = meshCommands([canvasSurfaceGeometry(TRIANGLE)]);

    expect(command?.kind === 'mesh' && 'customs' in command.arrays).toBe(false);
  });

  it.each([
    [1, [1, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1]],
    [2, [1, 2, 0, 1, 3, 4, 0, 1, 5, 6, 0, 1]],
    [3, [1, 2, 3, 1, 4, 5, 6, 1, 7, 8, 9, 1]],
  ])('reads a custom array of %i lanes as four, a missing lane 0 and a missing alpha 1', (width, lanes) => {
    const geometry = canvasSurfaceGeometry(TRIANGLE);
    const values = Float32Array.from({ length: 3 * width }, (_, i) => i + 1);
    geometry.setAttribute('custom0', new THREE.BufferAttribute(values, width));
    const [command] = meshCommands([geometry]);

    expect(command?.kind === 'mesh' && [...command.arrays.customs![0]!]).toEqual(lanes);
  });

  it('reads an interleaved custom array by its lanes', () => {
    const geometry = canvasSurfaceGeometry(TRIANGLE);
    const interleaved = new THREE.InterleavedBuffer(
      Float32Array.from({ length: 15 }, (_, i) => i),
      5
    );
    geometry.setAttribute('custom0', new THREE.InterleavedBufferAttribute(interleaved, 4, 1));
    const [command] = meshCommands([geometry]);

    expect(command?.kind === 'mesh' && [...command.arrays.customs![0]!]).toEqual([
      1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14,
    ]);
  });
});

describe('sameCommandLayout', () => {
  const rect = (x: number): CanvasShaderCommand => ({
    kind: 'rect',
    region: { rect: { x, y: 0, w: 1, h: 1 }, source: { x: 0, y: 0, w: 1, h: 1 }, clipUv: false },
    modulate: { r: 1, g: 1, b: 1, a: 1 },
  });
  const mesh = (): CanvasShaderCommand =>
    surfaceCommands([{ geometry: canvasSurfaceGeometry(TRIANGLE) }])![0]!;

  it('holds two lists of rects in the same places alike, whatever their regions', () => {
    expect(sameCommandLayout([rect(0)], [rect(4)])).toBe(true);
  });

  it('tells a list with another count of commands apart', () => {
    expect(sameCommandLayout([rect(0)], [rect(0), rect(1)])).toBe(false);
  });

  it('tells a mesh of other arrays apart', () => {
    expect(sameCommandLayout([mesh()], [mesh()])).toBe(false);
  });
});

describe('boundItem', () => {
  /** A surface with a box of its own, and the emulated points that share it. */
  function pointsOverSurface() {
    const source = withGodotAttributes(new THREE.BoxGeometry(2, 2, 2));
    source.computeBoundingBox();
    return { source, emulated: emulatedPointGeometry(source) };
  }

  it("bounds emulated points by the item rect and leaves their source's box as it was", () => {
    const { source, emulated } = pointsOverSurface();
    boundItem(emulated, [meshCommands([canvasSurfaceGeometry(TRIANGLE)])[0]!]);

    expect([emulated.boundingBox!.max.x, source.boundingBox!.max.x]).toEqual([8, 1]);
  });

  it("lets emulated points follow a recompute of their source's box until the item bounds them", () => {
    const { source, emulated } = pointsOverSurface();
    source.getAttribute('position').setX(0, 9);
    source.computeBoundingBox();

    expect(emulated.boundingBox!.max.x).toBe(9);
  });
});

describe('boundItem of one command', () => {
  const itemBox = (command: CanvasShaderCommand) => {
    const geometry = new THREE.BufferGeometry();
    boundItem(geometry, [command]);
    return geometry.boundingBox!;
  };
  const corners = (min: [number, number], max: [number, number]) =>
    new THREE.Box3(new THREE.Vector3(...min, 0), new THREE.Vector3(...max, 0));

  it("takes a rect's corners with y negated, a flipped rect as the same area", () => {
    const flipped: CanvasShaderCommand = {
      kind: 'rect',
      region: { rect: { x: 8, y: 6, w: -16, h: -4 }, source: { x: 0, y: 0, w: 4, h: 4 }, clipUv: false },
      modulate: { r: 1, g: 1, b: 1, a: 1 },
    };

    expect(itemBox(flipped)).toEqual(corners([-8, -6], [8, -2]));
  });

  it("takes a mesh's points, which Godot bounds as the surface's AABB", () => {
    const mesh: CanvasShaderCommand = {
      kind: 'mesh',
      arrays: {
        primitive: 'triangles',
        points: [
          { x: -3, y: 2 },
          { x: 5, y: -7 },
          { x: 1, y: 4 },
        ],
        colors: [],
        uvs: [],
      },
    };

    expect(itemBox(mesh)).toEqual(corners([-3, -4], [5, 7]));
  });

  it('leaves the box empty for a mesh of no points', () => {
    const empty: CanvasShaderCommand = {
      kind: 'mesh',
      arrays: { primitive: 'triangles', points: [], colors: [], uvs: [] },
    };

    expect(itemBox(empty).isEmpty()).toBe(true);
  });
});
