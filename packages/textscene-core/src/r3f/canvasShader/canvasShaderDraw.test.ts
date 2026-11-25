import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { DEFAULT_CANVAS_MAPS, GODOT_CANVAS_TEXTURE_STATE } from '../../shaders/canvas/canvasTexture';
import { GODOT_SAMPLING } from '../../shaders/uniforms/samplerState';
import {
  canvasShaderOf,
  disposeCanvasShader,
  rectShaderDraw,
  warnOnTranslatorFault,
  type CanvasShader,
} from './canvasShaderDraw';

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

function drawOf(item = itemOf()) {
  const texture = new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);
  return rectShaderDraw(gl, item, {
    texture,
    maps: DEFAULT_CANVAS_MAPS,
    textureState: GODOT_CANVAS_TEXTURE_STATE,
    sampling: GODOT_SAMPLING,
  });
}

function worldLanes(draw: ReturnType<typeof drawOf>): number[] {
  const geometry = (draw.object as THREE.Mesh).geometry;
  const { data } = geometry.getAttribute('attrib_A') as THREE.InterleavedBufferAttribute;
  return Array.from(data.array.slice(0, 6) as Float32Array);
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

describe('rectShaderDraw', () => {
  it('draws a mesh that frustum culling never skips', () => {
    const { object } = drawOf();

    expect(object).toBeInstanceOf(THREE.Mesh);
    expect(object.frustumCulled).toBe(false);
  });

  it('throws when the draw reads no canvas transform uniform', () => {
    const item = itemOf();
    // The uniforms are read-only to a caller: the test removes one as a shader without it would.
    (item.draw('quad').uniforms as Map<string, unknown>).delete('canvas_data.canvas_transform');

    expect(() => drawOf(item)).toThrow(
      'expected a canvas draw to read the uniform canvas_data.canvas_transform'
    );
  });

  it('uploads the record when setRect writes it', () => {
    const draw = drawOf();
    const geometry = (draw.object as THREE.Mesh).geometry;
    const { data } = geometry.getAttribute('attrib_A') as THREE.InterleavedBufferAttribute;
    const version = data.version;

    draw.setRect({
      region: { rect: { x: 0, y: 0, width: 8, height: 4 }, source: { x: 0, y: 0, width: 8, height: 4 } },
      finalModulate: { r: 1, g: 1, b: 1, a: 1 },
      canvasModulate: { r: 1, g: 1, b: 1, a: 1 },
    } as never);

    expect(data.version).toBeGreaterThan(version);
  });

  it('writes the object position as the world when writeRecords runs', () => {
    const draw = drawOf();
    draw.object.position.set(5, 7, 0);

    draw.writeRecords();

    expect(worldLanes(draw).slice(4)).toEqual([5, -7]);
  });

  it('disposes the geometry', () => {
    const draw = drawOf();
    const disposed = vi.fn();
    (draw.object as THREE.Mesh).geometry.addEventListener('dispose', disposed);

    draw.dispose();

    expect(disposed).toHaveBeenCalledOnce();
  });
});

describe('disposeCanvasShader', () => {
  it('disposes the material of the quad draw', () => {
    const item = itemOf();
    const disposed = vi.fn();
    item.draw('quad').material.addEventListener('dispose', disposed);

    disposeCanvasShader(item);

    expect(disposed).toHaveBeenCalledOnce();
  });
});

describe('warnOnTranslatorFault', () => {
  it('warns once for a shader whose program the GPU refuses twice', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const shader = shaderOf(VALID);
    const item = itemOf();

    warnOnTranslatorFault(shader, item);
    const { onTranslatorFault } = item.draw('quad').material;
    onTranslatorFault!({ message: 'x' } as never);
    onTranslatorFault!({ message: 'x' } as never);

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '[material] The previewer failed to draw this canvas_item shader: x'
    );
  });
});
