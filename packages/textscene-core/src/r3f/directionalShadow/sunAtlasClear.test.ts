import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { clearSunAtlasOncePerPass } from './sunAtlasClear';
import { holdDirectionalShadowAtlas } from './shadowAtlas';

const sunAtlas = holdDirectionalShadowAtlas(new THREE.DirectionalLight().shadow);

/** A renderer whose clears are counted per bound target, as three's pass binds then clears each map. */
function clearingRenderer() {
  let bound: THREE.WebGLRenderTarget | null = null;
  const cleared: (THREE.WebGLRenderTarget | null)[] = [];
  const renderer = {
    getRenderTarget: () => bound,
    clear: vi.fn(() => cleared.push(bound)),
  } as unknown as THREE.WebGLRenderer;
  const bindAndClear = (target: THREE.WebGLRenderTarget) => {
    bound = target;
    renderer.clear();
  };
  return { renderer, cleared, bindAndClear };
}

describe('clearSunAtlasOncePerPass', () => {
  it('clears the sun atlas at its first clear in a pass and keeps it for each later sun', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const startPass = clearSunAtlasOncePerPass(renderer);
    startPass();
    bindAndClear(sunAtlas);
    bindAndClear(sunAtlas);
    bindAndClear(sunAtlas);
    expect(cleared).toEqual([sunAtlas]);
  });

  it('clears every other target as three asks, such as a spot light’s atlas', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const spotAtlas = new THREE.WebGLRenderTarget(8, 8);
    clearSunAtlasOncePerPass(renderer)();
    bindAndClear(spotAtlas);
    bindAndClear(sunAtlas);
    bindAndClear(spotAtlas);
    expect(cleared).toEqual([spotAtlas, sunAtlas, spotAtlas]);
  });

  it('clears the sun atlas again in the next pass', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const startPass = clearSunAtlasOncePerPass(renderer);
    startPass();
    bindAndClear(sunAtlas);
    startPass();
    bindAndClear(sunAtlas);
    expect(cleared).toEqual([sunAtlas, sunAtlas]);
  });

  it('keeps the arguments of a clear it lets through (edge case)', () => {
    const { renderer } = clearingRenderer();
    const own = renderer.clear;
    clearSunAtlasOncePerPass(renderer)();
    renderer.clear(true, false, false);
    expect(own).toHaveBeenCalledWith(true, false, false);
  });
});
