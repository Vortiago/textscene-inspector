import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { clearSunAtlasOnce } from './sunAtlasClear';
import { holdDirectionalShadowAtlas } from './shadowAtlas';

const sunAtlas = holdDirectionalShadowAtlas(new THREE.DirectionalLight().shadow);

/** A renderer whose clears are counted per bound target, as three's pass binds then clears each map. */
function clearingRenderer() {
  let bound: THREE.WebGLRenderTarget | null = null;
  const cleared: (THREE.WebGLRenderTarget | null)[] = [];
  const ownClear = vi.fn(() => cleared.push(bound));
  const renderer = {
    getRenderTarget: () => bound,
    clear: ownClear,
  } as unknown as THREE.WebGLRenderer;
  const bindAndClear = (target: THREE.WebGLRenderTarget) => {
    bound = target;
    renderer.clear();
  };
  return { renderer, cleared, ownClear, bindAndClear };
}

describe('clearSunAtlasOnce', () => {
  it('clears the sun atlas at its first clear and keeps it for each later sun', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    clearSunAtlasOnce(renderer, () => {
      bindAndClear(sunAtlas);
      bindAndClear(sunAtlas);
      bindAndClear(sunAtlas);
    });
    expect(cleared).toEqual([sunAtlas]);
  });

  it('clears every other target as three asks, such as a spot light’s atlas', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const spotAtlas = new THREE.WebGLRenderTarget(8, 8);
    clearSunAtlasOnce(renderer, () => {
      bindAndClear(spotAtlas);
      bindAndClear(sunAtlas);
      bindAndClear(spotAtlas);
    });
    expect(cleared).toEqual([spotAtlas, sunAtlas, spotAtlas]);
  });

  it('clears the sun atlas again in the next pass', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    clearSunAtlasOnce(renderer, () => bindAndClear(sunAtlas));
    clearSunAtlasOnce(renderer, () => bindAndClear(sunAtlas));
    expect(cleared).toEqual([sunAtlas, sunAtlas]);
  });

  it('gives the renderer back its own clear, after a draw that throws too (error case)', () => {
    const { renderer, ownClear } = clearingRenderer();
    expect(() =>
      clearSunAtlasOnce(renderer, () => {
        throw new Error('draw failed');
      })
    ).toThrow('draw failed');
    expect(renderer.clear).toBe(ownClear);
  });
});
