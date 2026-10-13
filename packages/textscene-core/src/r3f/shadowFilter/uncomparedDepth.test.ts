/**
 * The raw read of a shadow atlas's depth. A stand-in context records the texture parameters, since
 * happy-dom runs no WebGL.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { drawWithUncomparedDepth } from './uncomparedDepth';

const GL = {
  TEXTURE_2D: 0x0de1,
  TEXTURE_COMPARE_MODE: 0x884c,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  NONE: 0,
  NEAREST: 0x2600,
  LINEAR: 0x2601,
  COMPARE_REF_TO_TEXTURE: 0x884e,
};

/** A renderer whose context keeps each texture's parameters, and whose state binds one texture. */
function recordingRenderer(handles: Map<THREE.Texture, object>) {
  const parameters = new Map<object, Map<number, number>>();
  let bound: object | null = null;
  const gl = {
    ...GL,
    getTexParameter: (_target: number, name: number) => parameters.get(bound!)!.get(name),
    texParameteri: (_target: number, name: number, value: number) => parameters.get(bound!)!.set(name, value),
  };
  for (const handle of handles.values()) {
    parameters.set(
      handle,
      new Map([
        [GL.TEXTURE_COMPARE_MODE, GL.COMPARE_REF_TO_TEXTURE],
        [GL.TEXTURE_MIN_FILTER, GL.LINEAR],
        [GL.TEXTURE_MAG_FILTER, GL.LINEAR],
      ])
    );
  }
  const renderer = {
    getContext: () => gl,
    properties: { get: (texture: THREE.Texture) => ({ __webglTexture: handles.get(texture) }) },
    state: { bindTexture: vi.fn((_target: number, handle: object) => (bound = handle)) },
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, parameters };
}

describe('drawWithUncomparedDepth', () => {
  it('reads each atlas uncompared and unfiltered while the draw runs', () => {
    const atlas = new THREE.DepthTexture(4, 4);
    const handle = {};
    const { renderer, parameters } = recordingRenderer(new Map([[atlas, handle]]));
    let during: number[] = [];

    drawWithUncomparedDepth(renderer, [atlas], () => {
      const atlasParameters = parameters.get(handle)!;
      during = [GL.TEXTURE_COMPARE_MODE, GL.TEXTURE_MIN_FILTER, GL.TEXTURE_MAG_FILTER].map((name) =>
        atlasParameters.get(name)!
      );
    });

    expect(during).toEqual([GL.NONE, GL.NEAREST, GL.NEAREST]);
  });

  it('compares and filters again once the draw is done', () => {
    const atlas = new THREE.DepthTexture(4, 4);
    const handle = {};
    const { renderer, parameters } = recordingRenderer(new Map([[atlas, handle]]));

    drawWithUncomparedDepth(renderer, [atlas], () => {});

    expect([...parameters.get(handle)!.values()]).toEqual([GL.COMPARE_REF_TO_TEXTURE, GL.LINEAR, GL.LINEAR]);
  });

  it('restores the parameters when the draw throws (error case)', () => {
    const atlas = new THREE.DepthTexture(4, 4);
    const handle = {};
    const { renderer, parameters } = recordingRenderer(new Map([[atlas, handle]]));

    expect(() =>
      drawWithUncomparedDepth(renderer, [atlas], () => {
        throw new Error('lost context');
      })
    ).toThrow('lost context');
    expect(parameters.get(handle)!.get(GL.TEXTURE_COMPARE_MODE)).toBe(GL.COMPARE_REF_TO_TEXTURE);
  });

  it('leaves an atlas no shadow pass has drawn unbound (edge case)', () => {
    const { renderer } = recordingRenderer(new Map());
    const draw = vi.fn();

    drawWithUncomparedDepth(renderer, [new THREE.DepthTexture(4, 4)], draw);

    expect(renderer.state.bindTexture).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledOnce();
  });
});
