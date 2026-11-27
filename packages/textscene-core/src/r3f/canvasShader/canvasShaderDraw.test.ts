import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { DEFAULT_CANVAS_MAPS, GODOT_CANVAS_TEXTURE_STATE } from '../../shaders/canvas/canvasTexture';
import { canvasInstances } from '../../shaders/canvas/canvasMultiMesh';
import { GODOT_SAMPLING } from '../../shaders/uniforms/samplerState';
import {
  canvasShaderOf,
  disposeCanvasShader,
  canvasShaderDraw,
  warnOnTranslatorFault,
  type CanvasShader,
} from './canvasShaderDraw';
import type { CanvasShaderCommand } from './canvasCommands';
import { DEFAULT_LIGHT_CULL_KEY, directionalLightCullKey } from '../lighting2d/lightCullKey';
import type { CanvasLightRows } from '../lighting2d/lightRows';
import type { CanvasLightDeclaration } from '../lighting2d/itemLightList';
import { type CanvasLightRow } from '../../shaders/canvas/canvasLights';
import type { RowBlock } from '../../shaders/template/rowBlock';
import type { CanvasVariant } from '../../shaders/canvas/transpileCanvas';
import { FLAGS } from '../../shaders/canvas/canvasInstance';
import { fakeCanvasRenderer, MAX_ANISOTROPY_PARAMETER } from '../testing/fakeCanvasRenderer';

const VALID = 'shader_type canvas_item;\nvoid fragment() { COLOR = vec4(UV, 0.5, 1.0); }\n';
const INVALID = 'shader_type canvas_item;\nvoid fragment() { COLOR = 1; }\n';

function shaderOf(code: string): ShaderText {
  return { code, file: 'res://shader.gdshader', parameters: {}, textures: {} };
}

function itemOf(code = VALID) {
  const compiled: CanvasShader = canvasShaderOf(shaderOf(code), {});
  if (!('item' in compiled)) throw new Error(`expected a compiled canvas shader, got ${compiled.refusal}`);
  return compiled.item;
}

const gl = {
  getRenderTarget: () => null,
  getDrawingBufferSize: (size: THREE.Vector2) => size.set(64, 32),
  info: { render: { frame: 0 } },
} as unknown as THREE.WebGLRenderer;

const RECT = { x: 0, y: 0, w: 8, h: 4 };
const RECT_COMMAND: CanvasShaderCommand = {
  kind: 'rect',
  region: { rect: RECT, source: RECT, clipUv: false },
  modulate: { r: 1, g: 1, b: 1, a: 1 },
};

type SingleMeshCommand = Extract<CanvasShaderCommand, { kind: 'mesh' }>;

function meshCommand(primitive: 'triangles' | 'points' = 'triangles'): SingleMeshCommand {
  return {
    kind: 'mesh',
    arrays: {
      primitive,
      indices: [0, 1, 2],
      points: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 0, y: 4 },
      ],
      colors: [],
      uvs: [],
    },
  };
}

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

const TEXTURE = new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);

function drawOf(commands: readonly CanvasShaderCommand[] = [RECT_COMMAND], item = itemOf(), firstOrder = 0) {
  const sampling = {
    maps: DEFAULT_CANVAS_MAPS,
    textureState: GODOT_CANVAS_TEXTURE_STATE,
    sampling: GODOT_SAMPLING,
  };
  const draw = canvasShaderDraw(gl, item, sampling, commands);
  draw.setFirstOrder(firstOrder);
  draw.setSource(TEXTURE, commands);
  return draw;
}

function rectWorldLanes(batch: THREE.Object3D, index = 0): number[] {
  const { data } = (batch as THREE.Mesh).geometry.getAttribute(
    'attrib_A'
  ) as THREE.InterleavedBufferAttribute;
  return Array.from(data.array.slice(index * data.stride, index * data.stride + 6) as Float32Array);
}

afterEach(() => vi.restoreAllMocks());

describe('canvasShaderOf', () => {
  it('gives the item of a valid canvas_item shader', () => {
    expect(canvasShaderOf(shaderOf(VALID), {})).toHaveProperty('item');
  });

  it('refuses a shader Godot does not compile, with a [material] message', () => {
    const compiled = canvasShaderOf(shaderOf(INVALID), {});

    expect('refusal' in compiled && compiled.refusal).toMatch(/^\[material\] /);
  });
});

describe('canvasShaderDraw', () => {
  it('draws a run of rects as one batch and each mesh as its own, in command order', () => {
    const { object } = drawOf([RECT_COMMAND, RECT_COMMAND, meshCommand(), RECT_COMMAND]);

    expect(object.children.map((batch) => [batch.type, batch.renderOrder])).toEqual([
      ['Mesh', 0],
      ['Mesh', 1],
      ['Mesh', 2],
    ]);
    expect(((object.children[0] as THREE.Mesh).geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(
      2
    );
  });

  it('starts the batches at the first order it is given', () => {
    const { object } = drawOf([RECT_COMMAND, meshCommand()], itemOf(), 5);

    expect(object.children.map((batch) => batch.renderOrder)).toEqual([5, 6]);
  });

  it("holds its batches in no Group, so the canvas item's group keeps deciding three's group order", () => {
    const { object } = drawOf();

    expect((object as THREE.Group).isGroup).toBeUndefined();
  });

  it('draws a mesh of points through the points variant', () => {
    const { object } = drawOf([meshCommand('points')]);

    expect(object.children[0]).toBeInstanceOf(THREE.Points);
  });

  it('keeps one box across the sources of a rect batch', () => {
    const draw = drawOf();
    const geometry = (draw.object.children[0] as THREE.Mesh).geometry;
    const box = geometry.boundingBox;
    draw.setSource(TEXTURE, [RECT_COMMAND]);

    expect(geometry.boundingBox).toBe(box);
  });

  it('draws batches that frustum culling never skips', () => {
    const { object } = drawOf([RECT_COMMAND, meshCommand()]);

    expect(object.children.map((batch) => batch.frustumCulled)).toEqual([false, false]);
  });

  it('throws when the draw reads no canvas transform uniform', () => {
    const item = itemOf();
    // The uniforms are read-only to a caller: the test removes one as a shader without it would.
    (item.draw('quad').uniforms as Map<string, unknown>).delete('canvas_data.canvas_transform');

    expect(() => drawOf([RECT_COMMAND], item)).toThrow(
      'expected a canvas draw to read the uniform canvas_data.canvas_transform'
    );
  });

  it('draws the rects setSource gives in the batches it already has', () => {
    const draw = drawOf();
    const [batch] = draw.object.children;
    const records = () =>
      Array.from(
        ((batch as THREE.Mesh).geometry.getAttribute('attrib_A') as THREE.InterleavedBufferAttribute).data
          .array as Float32Array
      );
    draw.setColors({ finalModulate: WHITE, canvasModulate: WHITE });
    const before = records();

    draw.setSource(TEXTURE, [
      { ...RECT_COMMAND, region: { ...RECT_COMMAND.region, rect: { ...RECT, x: 3 } } },
    ]);
    draw.setColors({ finalModulate: WHITE, canvasModulate: WHITE });

    expect([draw.object.children[0], records()]).not.toEqual([batch, before]);
    expect(draw.object.children[0]).toBe(batch);
  });

  it('uploads the records when setColors writes them', () => {
    const draw = drawOf();
    const { data } = (draw.object.children[0] as THREE.Mesh).geometry.getAttribute(
      'attrib_A'
    ) as THREE.InterleavedBufferAttribute;
    const version = data.version;

    draw.setColors({ finalModulate: WHITE, canvasModulate: WHITE });

    expect(data.version).toBeGreaterThan(version);
  });

  it("writes the item's position as the world of each rect when writeRecords runs", () => {
    const draw = drawOf([RECT_COMMAND, RECT_COMMAND]);
    draw.object.position.set(5, 7, 0);

    draw.writeRecords();

    expect([0, 1].map((index) => rectWorldLanes(draw.object.children[0]!, index).slice(4))).toEqual([
      [5, -7],
      [5, -7],
    ]);
  });

  it("writes the item's position as the world of a mesh when writeRecords runs", () => {
    const draw = drawOf([meshCommand()]);
    draw.object.position.set(5, 7, 0);

    draw.writeRecords();

    const { world } = draw.object.children[0]!.userData.attributesConstants;
    expect([world.tx, world.ty]).toEqual([5, -7]);
  });

  it('draws a multimesh command as one batch of its instances', () => {
    const mesh = meshCommand();
    const instances = canvasInstances([
      { transform: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]), color: null, customData: null },
      { transform: new Float32Array([1, 0, 0, 9, 0, 1, 0, 0]), color: null, customData: null },
    ]);
    const { object } = drawOf([{ ...mesh, kind: 'multimesh', instances }]);
    const [batch] = object.children as THREE.Mesh[];

    expect([
      object.children.length,
      (batch!.geometry as THREE.InstancedBufferGeometry).instanceCount,
    ]).toEqual([1, 2]);
  });

  it("places a mesh by its command's transform inside the item", () => {
    const draw = drawOf([{ ...meshCommand(), transform: { a: 1, b: 0, c: 0, d: 1, tx: 3, ty: 4 } }]);
    draw.object.position.set(5, 7, 0);

    draw.writeRecords();

    const { world } = draw.object.children[0]!.userData.attributesConstants;
    expect([world.tx, world.ty]).toEqual([8, -3]);
  });

  it("hands a mesh's object to the command's receiver, and takes it back", () => {
    const meshRef = vi.fn();
    const draw = drawOf([{ ...meshCommand(), meshRef }]);
    draw.handOver()();

    expect(meshRef.mock.calls).toEqual([[draw.object.children[0]], [null]]);
  });

  it('hands nothing over before it is asked, as a render may build a draw it never commits', () => {
    const meshRef = vi.fn();
    drawOf([{ ...meshCommand(), meshRef }]);

    expect(meshRef).not.toHaveBeenCalled();
  });

  it('disposes the geometry of each batch', () => {
    const draw = drawOf([RECT_COMMAND, meshCommand()]);
    const disposed = vi.fn();
    for (const batch of draw.object.children)
      (batch as THREE.Mesh).geometry.addEventListener('dispose', disposed);

    draw.dispose();

    expect(disposed).toHaveBeenCalledTimes(2);
  });
});

describe('disposeCanvasShader', () => {
  it('disposes the material of each variant its draws use', () => {
    const item = itemOf();
    drawOf([RECT_COMMAND, meshCommand()], item);
    const disposed = vi.fn();
    item.draw('quad').material.addEventListener('dispose', disposed);
    item.draw('attributes').material.addEventListener('dispose', disposed);

    disposeCanvasShader(item);

    expect(disposed).toHaveBeenCalledTimes(2);
  });

  it('disposes the variants again on a second call, as a StrictMode effect makes it', () => {
    const item = itemOf();
    drawOf([RECT_COMMAND], item);
    const disposed = vi.fn();
    item.draw('quad').material.addEventListener('dispose', disposed);

    disposeCanvasShader(item);
    disposeCanvasShader(item);

    expect(disposed).toHaveBeenCalledTimes(2);
  });
});

describe('warnOnTranslatorFault', () => {
  it('warns for a variant the item draws after the warning is set', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const item = itemOf();
    warnOnTranslatorFault(shaderOf(VALID), item);

    drawOf([meshCommand()], item);
    item.draw('attributes').material.onTranslatorFault!({ message: 'y' } as never);

    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns once for a shader whose program the GPU refuses twice', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const shader = shaderOf(VALID);
    const item = itemOf();

    drawOf([RECT_COMMAND], item);
    warnOnTranslatorFault(shader, item);
    const { onTranslatorFault } = item.draw('quad').material;
    onTranslatorFault!({ message: 'x' } as never);
    onTranslatorFault!({ message: 'x' } as never);

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '[material] The previewer failed to draw this canvas_item shader: x'
    );
  });
});

describe('canvasShaderDraw anisotropy', () => {
  /** A texture with a mipmap chain, which the anisotropic filters sample. */
  const mipmapped = () => {
    const texture = new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);
    texture.mipmaps = [
      { data: new Uint8Array(8 * 4 * 4), width: 8, height: 4 },
      { data: new Uint8Array(4 * 2 * 4), width: 4, height: 2 },
    ];
    return texture;
  };

  /** The taps the draw writes for its bound texture, with `filter` on a renderer that has stored it. */
  function tapsWritten(filter: 'nearest_mipmap_anisotropic' | 'nearest_mipmap') {
    const { gl: context, renderer } = fakeCanvasRenderer({ isAllocated: true });
    const sampling = {
      maps: DEFAULT_CANVAS_MAPS,
      textureState: { ...GODOT_CANVAS_TEXTURE_STATE, filter },
      sampling: GODOT_SAMPLING,
    };
    const draw = canvasShaderDraw(
      { ...gl, ...renderer } as unknown as THREE.WebGLRenderer,
      itemOf(),
      sampling,
      [RECT_COMMAND]
    );
    draw.setSource(mipmapped(), [RECT_COMMAND]);
    return context.texParameterf.mock.calls
      .filter(([, parameter]) => parameter === MAX_ANISOTROPY_PARAMETER)
      .map(([, , taps]) => taps);
  }

  it("writes the 4 taps three skips for a nearest magnification, as the canvas's default sampler reads", () => {
    expect(tapsWritten('nearest_mipmap_anisotropic')).toEqual([4]);
  });

  it('writes no taps for a filter that is not anisotropic', () => {
    expect(tapsWritten('nearest_mipmap')).toEqual([]);
  });
});

describe('canvasShaderDraw lighting', () => {
  const rowOf = (r: number): CanvasLightRow => ({
    textureMatrix: { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 },
    color: { r, g: 0.25, b: 1, a: 2 },
    flags: 0,
    height: 0,
    position: { x: 0, y: -1 },
    atlasRect: { x: 0, y: 0, w: 0, h: 0 },
  });

  const lightOf = (sequence: number | null, row: CanvasLightRow): CanvasLightDeclaration => ({
    reach:
      sequence === null
        ? directionalLightCullKey(0, 0)
        : { ...DEFAULT_LIGHT_CULL_KEY, layerMin: 0, layerMax: 0 },
    sequence,
    slot: sequence === null ? 0 : undefined,
    shadowItemCullMask: null,
    castsShadow: false,
    tintsShadow: false,
    mixes: false,
    rowSource: { listedRow: () => row },
  });

  /** A sun at index 0 of `light_array`, then the positional ordinals 1 and 2 at indices 1 and 2. */
  const rows = (): CanvasLightRows => ({
    lights: new Map([
      [0, lightOf(null, rowOf(0.5))],
      [1, lightOf(0, rowOf(0.75))],
      [2, lightOf(1, rowOf(1))],
    ]),
  });

  const lightingOf = (lights: readonly number[] = [2, 1]) => ({ rows: rows(), layer: 0, lights });

  /** Runs the light hook of `draw`'s `variant` as one render draws it. */
  function render(
    item: ReturnType<typeof itemOf>,
    draw: ReturnType<typeof drawOf>,
    variant: CanvasVariant = 'quad'
  ) {
    const block = item.draw(variant).buffers.get('light_array') as RowBlock;
    const camera = new THREE.OrthographicCamera();
    block['store'].node.update({
      renderer: {},
      renderId: 1,
      frameId: 1,
      object: draw.object,
      camera,
    } as never);
    return block;
  }

  const lightingBit = (item: ReturnType<typeof itemOf>) =>
    (item.draw('quad').specialisations.get('pso_sc_packed_0')!.value as number) & 1;

  /** The first record's words: its float lanes lead one buffer, and its word lanes another. */
  function recordWords(batch: THREE.Object3D): Uint32Array {
    const buffers = Object.values((batch as THREE.Mesh).geometry.attributes).map(
      (attribute) => (attribute as THREE.InterleavedBufferAttribute).data
    );
    const [floats, words] = [buffers[0]!, buffers.at(-1)!];
    const record = new Uint32Array(floats.stride + words.stride);
    record.set(new Uint32Array((floats.array as Float32Array).buffer, 0, floats.stride));
    record.set((words.array as Uint32Array).subarray(0, words.stride), floats.stride);
    return record;
  }

  it('draws the lit variant while lights reach the item, and the unlit one again without', () => {
    const item = itemOf();
    const draw = drawOf([RECT_COMMAND], item);

    draw.setLighting(lightingOf());
    const lit = lightingBit(item);
    draw.setLighting(null);

    expect([lit, lightingBit(item)]).toEqual([1, 0]);
  });

  /** The bits of the lights [2, 1] at their indices 2 and 1 of `light_array`. */
  const BITS = { flags: 2, lights: [2 | (1 << 8), 0, 0, 0] };

  it("writes the item's light count and indices into each rect record before the render", () => {
    const item = itemOf();
    const draw = drawOf([RECT_COMMAND], item);
    draw.setColors({ finalModulate: WHITE, canvasModulate: WHITE });
    draw.setLighting(lightingOf());
    render(item, draw);

    draw.writeRecords();

    const words = recordWords(draw.object.children[0]!);
    expect([words[FLAGS]! & 15, ...words.slice(28, 32)]).toEqual([2, ...BITS.lights]);
  });

  it('writes no light into the records before the first render lists the lights', () => {
    const draw = drawOf();
    draw.setColors({ finalModulate: WHITE, canvasModulate: WHITE });
    draw.setLighting(lightingOf());

    draw.writeRecords();

    expect(recordWords(draw.object.children[0]!)[FLAGS]! & 15).toBe(0);
  });

  it('writes the light indices out of the records once the item draws unlit', () => {
    const item = itemOf();
    const draw = drawOf([RECT_COMMAND], item);
    draw.setColors({ finalModulate: WHITE, canvasModulate: WHITE });
    draw.setLighting(lightingOf());
    render(item, draw);
    draw.writeRecords();

    draw.setLighting(null);
    draw.writeRecords();

    expect(recordWords(draw.object.children[0]!)[FLAGS]! & 15).toBe(0);
  });

  it("hands a mesh the item's light indices", () => {
    const item = itemOf();
    const draw = drawOf([meshCommand()], item);
    draw.setColors({ finalModulate: WHITE, canvasModulate: WHITE });
    draw.setLighting(lightingOf());
    render(item, draw, 'attributes');

    draw.writeRecords();

    expect(draw.object.children[0]!.userData.attributesConstants.lights).toEqual(BITS);
  });

  it("binds the light atlas to a lit draw's atlas texture", () => {
    const item = itemOf();
    const draw = drawOf([RECT_COMMAND], item);
    const placeholder = item.draw('quad').textures.get('atlas_texture')?.value;

    draw.setLighting(lightingOf());

    expect(item.draw('quad').textures.get('atlas_texture')!.value).not.toBe(placeholder);
  });

  it("points a lit draw at its canvas layer's light rows, and writes the directional count", () => {
    const item = itemOf();
    const draw = drawOf([RECT_COMMAND], item);
    draw.setLighting(lightingOf());

    const block = render(item, draw);

    const texture = block['store'].node.value as THREE.DataTexture;
    const data = new Float32Array((texture.image as { data: Uint32Array }).data.buffer);
    const color = Array.from(data.slice(16, 20));
    const count = (item.draw('quad').uniforms.get('canvas_data.directional_light_count') as { value: number })
      .value;
    expect([count, color]).toEqual([1, [0.5, 0.25, 1, 2]]);
  });
});
