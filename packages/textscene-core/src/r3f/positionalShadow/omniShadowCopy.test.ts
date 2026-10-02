/**
 * The copy draws through the renderer, which happy-dom cannot run, so a stand-in records each draw.
 * The goldens check what the shader writes.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PositionalShadowSlot } from '../../godot/positionalShadowAtlas';
import { AtlasOmniShadow } from './atlasOmniShadow';
import { OmniShadowCopy } from './omniShadowCopy';
import { holdPositionalShadowAtlas, positionalShadowAtlas } from './shadowAtlasTarget';

holdPositionalShadowAtlas({}, 4096);

interface Draw {
  viewport: number[];
  scissor: number[];
  uniforms: Record<string, unknown>;
  autoClear: boolean;
  autoReset: boolean;
}

/** A renderer that records the atlas's viewport and the copy's uniforms at each draw. */
function recordingRenderer(): { renderer: THREE.WebGLRenderer; draws: Draw[] } {
  const draws: Draw[] = [];
  let target: THREE.WebGLRenderTarget | null = null;
  const renderer = {
    autoClear: true,
    info: { autoReset: true },
    setRenderTarget: (next: THREE.WebGLRenderTarget | null) => {
      target = next;
    },
    render: (quad: THREE.Mesh) => {
      const material = quad.material as THREE.ShaderMaterial;
      draws.push({
        viewport: target!.viewport.toArray(),
        scissor: target!.scissor.toArray(),
        uniforms: Object.fromEntries(Object.entries(material.uniforms).map(([k, u]) => [k, u.value])),
        autoClear: renderer.autoClear,
        autoReset: renderer.info.autoReset,
      });
    },
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, draws };
}

/** An omni light whose shadow holds a 256 cube, as three leaves it after a pass with range 8. */
function renderedLight(): THREE.PointLight & { shadow: AtlasOmniShadow } {
  const shadow = new AtlasOmniShadow();
  shadow.fitCube(256);
  shadow.camera.near = 0.025;
  shadow.camera.far = 8;
  const light = new THREE.PointLight(0xffffff, 1, 8);
  light.shadow = shadow;
  light.updateMatrixWorld();
  return Object.assign(light, { shadow });
}

const pair: PositionalShadowSlot = { x: 2048, y: 0, size: 512, paraboloidStep: [1, 0] };

describe('OmniShadowCopy.copy', () => {
  it('writes the -Z paraboloid into the first slot and the +Z one into the next', () => {
    const { renderer, draws } = recordingRenderer();
    new OmniShadowCopy().copy(renderer, renderedLight(), pair);
    expect(draws.map((draw) => draw.viewport)).toEqual([
      [2048, 0, 512, 512],
      [2560, 0, 512, 512],
    ]);
    expect(draws.map((draw) => draw.scissor)).toEqual(draws.map((draw) => draw.viewport));
    expect(draws.map((draw) => draw.uniforms.paraboloidSign)).toEqual([-1, 1]);
    expect(positionalShadowAtlas().scissorTest).toBe(true);
  });

  it('reads the cube with the planes three rendered it with, and insets by one slot texel', () => {
    const { renderer, draws } = recordingRenderer();
    const light = renderedLight();
    new OmniShadowCopy().copy(renderer, light, pair);
    const { uniforms } = draws[0]!;
    expect(uniforms.cube).toBe(light.shadow.map!.depthTexture);
    expect([uniforms.zNear, uniforms.zFar, uniforms.faceSize]).toEqual([0.025, 8, 256]);
    expect(uniforms.texelSize).toBe(1 / 512);
  });

  it('puts the second paraboloid at the start of the next row for a pair that wraps (edge case)', () => {
    const { renderer, draws } = recordingRenderer();
    new OmniShadowCopy().copy(renderer, renderedLight(), {
      x: 1536,
      y: 0,
      size: 512,
      paraboloidStep: [-3, 1],
    });
    expect(draws[1]!.viewport).toEqual([0, 512, 512, 512]);
  });

  it('neither clears nor resets the frame’s render info, and restores both (edge case)', () => {
    const { renderer, draws } = recordingRenderer();
    new OmniShadowCopy().copy(renderer, renderedLight(), pair);
    expect(draws.every((draw) => !draw.autoClear && !draw.autoReset)).toBe(true);
    expect([renderer.autoClear, renderer.info.autoReset]).toEqual([true, true]);
  });

  it('draws nothing for a spot slot or a light without a cube (error case)', () => {
    const { renderer, draws } = recordingRenderer();
    const copy = new OmniShadowCopy();
    copy.copy(renderer, renderedLight(), { ...pair, paraboloidStep: null });
    const cubeless = renderedLight();
    cubeless.shadow.dispose();
    copy.copy(renderer, cubeless, pair);
    expect(draws).toEqual([]);
  });
});
