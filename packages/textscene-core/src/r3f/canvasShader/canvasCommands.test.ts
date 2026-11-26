import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { withGodotAttributes } from '../../shaders/spatial/meshAttributes';
import { canvasInstances } from '../../shaders/canvas/canvasMultiMesh';
import { emulatedPointGeometry } from '../../shaders/template/emulatedPoints';
import { canvasSurfaceGeometry } from '../canvasMesh/canvasSurface';
import { canvasMeshGeometry } from '../meshes/canvasMeshGeometry';
import {
  atlasRectRegion,
  boundByItem,
  itemBox,
  meshCommands,
  multiMeshCommands,
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

  it('hands the object that draws a surface to its receiver, which a skin deforms', () => {
    const meshRef = () => {};
    const [command] = surfaceCommands([{ geometry: canvasSurfaceGeometry(TRIANGLE), meshRef }]);

    expect(command?.kind === 'mesh' && command.meshRef).toBe(meshRef);
  });

  it('places a surface by no transform when it has no placement', () => {
    const [command] = surfaceCommands([{ geometry: canvasSurfaceGeometry(TRIANGLE) }]);

    expect(command).not.toHaveProperty('transform');
  });

  type Triple = [number, number, number];

  it.each([
    ['a position', { position: [3, -5, 0] as Triple }, { a: 1, b: 0, c: 0, d: 1, tx: 3, ty: 5 }],
    ['a scale', { scale: [-1, 2, 1] as Triple }, { a: -1, b: 0, c: 0, d: 2, tx: 0, ty: 0 }],
    [
      'a matrix',
      { matrix: new THREE.Matrix4().makeTranslation(4, 6, 0) },
      { a: 1, b: 0, c: 0, d: 1, tx: 4, ty: -6 },
    ],
  ])("places a surface placed by %s at its transform in Godot's frame", (_, placement, transform) => {
    const [command] = surfaceCommands([{ geometry: canvasSurfaceGeometry(TRIANGLE), ...placement }]);

    expect(command?.kind === 'mesh' && roundedTransform(command.transform)).toEqual(transform);
  });
});

/** A transform with -0 read as 0, as a placement's flip of y writes it. */
function roundedTransform(transform: object | undefined) {
  return (
    transform &&
    Object.fromEntries(Object.entries(transform).map(([key, value]) => [key, (value as number) + 0]))
  );
}

describe('multiMeshCommands', () => {
  const INSTANCE = {
    transform: new Float32Array([1, 0, 0, 7, 0, 1, 0, 9]),
    color: new Float32Array([1, 0.5, 0.25, 1]),
    customData: null,
  };

  it('gives a multimesh command for each surface, every one with all the instances', () => {
    const geometries = [canvasSurfaceGeometry(TRIANGLE), canvasSurfaceGeometry(TRIANGLE)];
    const commands = multiMeshCommands(geometries, [INSTANCE, INSTANCE]);

    expect(commands.map((command) => command.kind === 'multimesh' && command.instances.count)).toEqual([
      2, 2,
    ]);
  });

  it('gives no command for no instance, as a batch of no instance draws nothing', () => {
    expect(multiMeshCommands([canvasSurfaceGeometry(TRIANGLE)], [])).toEqual([]);
  });

  it("reads the mesh's vertices as meshCommands reads them", () => {
    const geometry = canvasSurfaceGeometry(TRIANGLE);
    const [multi] = multiMeshCommands([geometry], [INSTANCE]);
    const [mesh] = meshCommands([geometry]);

    expect(multi?.kind === 'multimesh' && multi.arrays).toEqual(mesh?.kind === 'mesh' && mesh.arrays);
  });

  it('carries the transform it is given', () => {
    const transform = { a: 1, b: 0, c: 0, d: 1, tx: -3, ty: -4 };
    const [command] = multiMeshCommands([canvasSurfaceGeometry(TRIANGLE)], [INSTANCE], transform);

    expect(command?.kind === 'multimesh' && command.transform).toBe(transform);
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

  const multimesh = (command: CanvasShaderCommand, count: number): CanvasShaderCommand =>
    command.kind === 'rect'
      ? command
      : {
          kind: 'multimesh',
          arrays: command.arrays,
          instances: { count, words: new Uint32Array(count * 8), usesColors: false, usesCustomData: false },
        };

  it('holds two multimeshes of the same arrays and count alike, whatever their instances hold', () => {
    const shared = mesh();

    expect(sameCommandLayout([multimesh(shared, 2)], [multimesh(shared, 2)])).toBe(true);
  });

  it('tells a multimesh of another instance count apart', () => {
    const shared = mesh();

    expect(sameCommandLayout([multimesh(shared, 2)], [multimesh(shared, 3)])).toBe(false);
  });

  it('tells a multimesh from a mesh of the same arrays apart', () => {
    const shared = mesh();

    expect(sameCommandLayout([shared], [multimesh(shared, 1)])).toBe(false);
  });
});

describe('boundByItem', () => {
  /** A surface with a box of its own, and the emulated points that share it. */
  function pointsOverSurface() {
    const source = withGodotAttributes(new THREE.BoxGeometry(2, 2, 2));
    source.computeBoundingBox();
    return { source, emulated: emulatedPointGeometry(source) };
  }

  it("bounds emulated points by the item rect and leaves their source's box as it was", () => {
    const { source, emulated } = pointsOverSurface();
    boundByItem(new THREE.Mesh(emulated), [meshCommands([canvasSurfaceGeometry(TRIANGLE)])[0]!]);

    expect([emulated.boundingBox!.max.x, source.boundingBox!.max.x]).toEqual([8, 1]);
  });
});

describe('itemBox of one command', () => {
  const boxOf = (command: CanvasShaderCommand) => itemBox(new THREE.Box3(), [command]);
  const corners = (min: [number, number], max: [number, number]) =>
    new THREE.Box3(new THREE.Vector3(...min, 0), new THREE.Vector3(...max, 0));

  it("takes a rect's corners with y negated, a flipped rect as the same area", () => {
    const flipped: CanvasShaderCommand = {
      kind: 'rect',
      region: { rect: { x: 8, y: 6, w: -16, h: -4 }, source: { x: 0, y: 0, w: 4, h: 4 }, clipUv: false },
      modulate: { r: 1, g: 1, b: 1, a: 1 },
    };

    expect(boxOf(flipped)).toEqual(corners([-8, -6], [8, -2]));
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

    expect(boxOf(mesh)).toEqual(corners([-3, -4], [5, 7]));
  });

  it('leaves the box empty for a mesh of no points', () => {
    const empty: CanvasShaderCommand = {
      kind: 'mesh',
      arrays: { primitive: 'triangles', points: [], colors: [], uvs: [] },
    };

    expect(boxOf(empty).isEmpty()).toBe(true);
  });

  const SQUARE = {
    primitive: 'triangles' as const,
    points: [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ],
    colors: [],
    uvs: [],
  };

  it("places a mesh's points by its command transform", () => {
    const moved: CanvasShaderCommand = {
      kind: 'mesh',
      arrays: SQUARE,
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 },
    };

    expect(boxOf(moved)).toEqual(corners([10, -22], [12, -20]));
  });

  it("takes a multimesh's mesh rect at every instance, then at the command transform", () => {
    const instance = (tx: number, ty: number) => ({
      transform: new Float32Array([1, 0, 0, tx, 0, 1, 0, ty]),
      color: null,
      customData: null,
    });
    const scaled: CanvasShaderCommand = {
      kind: 'multimesh',
      arrays: SQUARE,
      instances: canvasInstances([instance(0, 0), instance(100, 50)]),
      transform: { a: 2, b: 0, c: 0, d: 2, tx: 1, ty: 0 },
    };

    expect(boxOf(scaled)).toEqual(corners([1, -104], [205, 0]));
  });
});
