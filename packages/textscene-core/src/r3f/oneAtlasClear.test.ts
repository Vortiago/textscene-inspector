import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { OneAtlasClear } from './oneAtlasClear';

const atlas = new THREE.WebGLRenderTarget(8, 8);
const isAtlas = (target: THREE.WebGLRenderTarget | null) => target === atlas;

/** A renderer that lists each clear's target and scissor test, as three binds then clears each map. */
function clearingRenderer() {
  let bound: THREE.WebGLRenderTarget | null = null;
  let isScissored = false;
  const cleared: [THREE.WebGLRenderTarget | null, boolean][] = [];
  const renderer = {
    getRenderTarget: () => bound,
    clear: vi.fn(() => cleared.push([bound, isScissored])),
    state: { setScissorTest: (on: boolean) => (isScissored = on) },
  } as unknown as THREE.WebGLRenderer;
  const bindAndClear = (target: THREE.WebGLRenderTarget) => {
    bound = target;
    isScissored = target.scissorTest;
    renderer.clear();
  };
  return { renderer, cleared, bindAndClear, isScissored: () => isScissored };
}

describe('OneAtlasClear', () => {
  it('clears the atlas at its first clear in a pass and keeps it for each later light', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const clears = new OneAtlasClear(renderer, isAtlas);
    clears.start();
    bindAndClear(atlas);
    bindAndClear(atlas);
    bindAndClear(atlas);
    clears.end();
    expect(cleared.map(([target]) => target)).toEqual([atlas]);
  });

  it('clears the whole atlas, past a slot’s scissor, and gives the draws the scissor back', () => {
    const { renderer, cleared, bindAndClear, isScissored } = clearingRenderer();
    const slotted = new THREE.WebGLRenderTarget(8, 8);
    slotted.scissorTest = true;
    new OneAtlasClear(renderer, (target) => target === slotted).start();
    bindAndClear(slotted);
    expect(cleared).toEqual([[slotted, false]]);
    expect(isScissored()).toBe(true);
  });

  it('clears every other target as three asks, scissored as bound', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const other = new THREE.WebGLRenderTarget(8, 8);
    other.scissorTest = true;
    new OneAtlasClear(renderer, isAtlas).start();
    bindAndClear(other);
    bindAndClear(atlas);
    bindAndClear(other);
    expect(cleared).toEqual([
      [other, true],
      [atlas, false],
      [other, true],
    ]);
  });

  it('clears the atlas again in the next pass', () => {
    const { renderer, cleared, bindAndClear } = clearingRenderer();
    const clears = new OneAtlasClear(renderer, isAtlas);
    for (let pass = 0; pass < 2; pass++) {
      clears.start();
      bindAndClear(atlas);
      clears.end();
    }
    expect(cleared).toHaveLength(2);
  });

  it('gives the renderer its clear back at the end of the pass', () => {
    const { renderer } = clearingRenderer();
    const own = renderer.clear;
    const clears = new OneAtlasClear(renderer, isAtlas);
    clears.start();
    clears.end();
    expect(renderer.clear).toBe(own);
  });

  it('skips a later clear before a clear hook installed since the last pass sees it (edge case)', () => {
    const { renderer, bindAndClear } = clearingRenderer();
    const clears = new OneAtlasClear(renderer, isAtlas);
    const own = renderer.clear;
    const hooked = vi.fn((...args: Parameters<typeof own>) => own.call(renderer, ...args));
    renderer.clear = hooked;
    clears.start();
    bindAndClear(atlas);
    bindAndClear(atlas);
    clears.end();
    expect(hooked).toHaveBeenCalledOnce();
    expect(renderer.clear).toBe(hooked);
  });

  it('keeps the arguments of a clear it lets through (edge case)', () => {
    const { renderer } = clearingRenderer();
    const own = renderer.clear;
    new OneAtlasClear(renderer, isAtlas).start();
    renderer.clear(true, false, false);
    expect(own).toHaveBeenCalledWith(true, false, false);
  });
});
