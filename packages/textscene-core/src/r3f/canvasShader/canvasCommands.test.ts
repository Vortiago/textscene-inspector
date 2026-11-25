import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { canvasSurfaceGeometry } from '../canvasMesh/canvasSurface';
import { canvasMeshGeometry } from '../meshes/canvasMeshGeometry';
import {
  atlasRectRegion,
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
