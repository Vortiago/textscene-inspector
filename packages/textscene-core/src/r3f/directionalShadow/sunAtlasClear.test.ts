import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SunAtlasClears } from './sunAtlasClear';
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

describe('SunAtlasClears', () => {
  it('clears the sun atlas at its first clear in a pass and keeps it for each later sun', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const clears = new SunAtlasClears(renderer);
    clears.start();
    bindAndClear(sunAtlas);
    bindAndClear(sunAtlas);
    bindAndClear(sunAtlas);
    clears.end();
    expect(cleared).toEqual([sunAtlas]);
  });

  it('clears every other target as three asks, such as a spot light’s atlas', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const spotAtlas = new THREE.WebGLRenderTarget(8, 8);
    new SunAtlasClears(renderer).start();
    bindAndClear(spotAtlas);
    bindAndClear(sunAtlas);
    bindAndClear(spotAtlas);
    expect(cleared).toEqual([spotAtlas, sunAtlas, spotAtlas]);
  });

  it('clears the sun atlas again in the next pass', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const clears = new SunAtlasClears(renderer);
    for (let pass = 0; pass < 2; pass++) {
      clears.start();
      bindAndClear(sunAtlas);
      clears.end();
    }
    expect(cleared).toEqual([sunAtlas, sunAtlas]);
  });

  it('gives the renderer its clear back at the end of the pass', () => {
    const { renderer } = clearingRenderer();
    const own = renderer.clear;
    const clears = new SunAtlasClears(renderer);
    clears.start();
    clears.end();
    expect(renderer.clear).toBe(own);
  });

  it('skips a later clear before a clear hook installed since the last pass sees it (edge case)', () => {
    const { renderer, bindAndClear } = clearingRenderer();
    const clears = new SunAtlasClears(renderer);
    const own = renderer.clear;
    const hooked = vi.fn((...args: Parameters<typeof own>) => own.call(renderer, ...args));
    renderer.clear = hooked;
    clears.start();
    bindAndClear(sunAtlas);
    bindAndClear(sunAtlas);
    clears.end();
    expect(hooked).toHaveBeenCalledOnce();
    expect(renderer.clear).toBe(hooked);
  });

  it('keeps the arguments of a clear it lets through (edge case)', () => {
    const { renderer } = clearingRenderer();
    const own = renderer.clear;
    new SunAtlasClears(renderer).start();
    renderer.clear(true, false, false);
    expect(own).toHaveBeenCalledWith(true, false, false);
  });
});
