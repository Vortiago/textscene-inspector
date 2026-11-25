import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { DEFAULT_CANVAS_MAPS, GODOT_CANVAS_TEXTURE_STATE } from '../../shaders/canvas/canvasTexture';
import { GODOT_SAMPLING } from '../../shaders/uniforms/samplerState';
import {
  canvasShaderOf,
  disposeCanvasShader,
  canvasShaderDraw,
  warnOnTranslatorFault,
  type CanvasShader,
} from './canvasShaderDraw';
import type { CanvasShaderCommand } from './canvasCommands';

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
} as unknown as THREE.WebGLRenderer;

const RECT = { x: 0, y: 0, w: 8, h: 4 };
const RECT_COMMAND: CanvasShaderCommand = {
  kind: 'rect',
  region: { rect: RECT, source: RECT, clipUv: false },
  modulate: { r: 1, g: 1, b: 1, a: 1 },
};

function meshCommand(primitive: 'triangles' | 'points' = 'triangles'): CanvasShaderCommand {
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

function drawOf(commands: readonly CanvasShaderCommand[] = [RECT_COMMAND], item = itemOf()) {
  const texture = new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);
  return canvasShaderDraw(
    gl,
    item,
    {
      texture,
      maps: DEFAULT_CANVAS_MAPS,
      textureState: GODOT_CANVAS_TEXTURE_STATE,
      sampling: GODOT_SAMPLING,
    },
    commands
  );
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

  it('draws a mesh of points through the points variant', () => {
    const { object } = drawOf([meshCommand('points')]);

    expect(object.children[0]).toBeInstanceOf(THREE.Points);
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
