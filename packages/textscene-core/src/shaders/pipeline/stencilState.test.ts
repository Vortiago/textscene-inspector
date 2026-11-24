import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { StencilCompare, StencilFlag } from '../../godot/rendering/materials/stencil.js';
import {
  applyGodotStencil,
  isAnyStencilMaterialLive,
  type StencilState,
  type StencilTest,
} from './stencilState.js';

const STENCIL_KEYS = [
  'stencilWrite',
  'stencilRef',
  'stencilFunc',
  'stencilFuncMask',
  'stencilWriteMask',
  'stencilFail',
  'stencilZFail',
  'stencilZPass',
] as const;

/** The stencil state `applyGodotStencil` gives a material for `test`. */
function godotStencilState(test: StencilTest): StencilState {
  const material = new THREE.MeshBasicMaterial();
  applyGodotStencil(material, test);
  material.dispose();
  return Object.fromEntries(STENCIL_KEYS.map((key) => [key, material[key]])) as StencilState;
}

describe('Godot’s stencil state as three’s', () => {
  it('turns the test on and keeps the value on every outcome with no flag', () => {
    expect(godotStencilState({ flags: 0, compare: StencilCompare.ALWAYS, reference: 3 })).toEqual({
      stencilWrite: true,
      stencilRef: 3,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilFuncMask: 0,
      stencilWriteMask: 0,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp,
    });
  });

  it('read compares against the whole stored value', () => {
    expect(
      godotStencilState({ flags: StencilFlag.READ, compare: StencilCompare.EQUAL, reference: 1 })
    ).toMatchObject({
      stencilFuncMask: 255,
      stencilWriteMask: 0,
    });
  });

  it('write replaces the value where the depth test passes', () => {
    expect(
      godotStencilState({ flags: StencilFlag.WRITE, compare: StencilCompare.ALWAYS, reference: 1 })
    ).toMatchObject({
      stencilFuncMask: 0,
      stencilWriteMask: 255,
      stencilZPass: THREE.ReplaceStencilOp,
      stencilZFail: THREE.KeepStencilOp,
    });
  });

  it('write_depth_fail replaces the value where the depth test fails', () => {
    const state = godotStencilState({
      flags: StencilFlag.WRITE_DEPTH_FAIL,
      compare: StencilCompare.ALWAYS,
      reference: 1,
    });
    expect(state).toMatchObject({
      stencilWriteMask: 255,
      stencilZPass: THREE.KeepStencilOp,
      stencilZFail: THREE.ReplaceStencilOp,
    });
  });

  it.each([
    [StencilCompare.ALWAYS, THREE.AlwaysStencilFunc],
    [StencilCompare.LESS, THREE.LessStencilFunc],
    [StencilCompare.EQUAL, THREE.EqualStencilFunc],
    [StencilCompare.LESS_OR_EQUAL, THREE.LessEqualStencilFunc],
    [StencilCompare.GREATER, THREE.GreaterStencilFunc],
    [StencilCompare.NOT_EQUAL, THREE.NotEqualStencilFunc],
    [StencilCompare.GREATER_OR_EQUAL, THREE.GreaterEqualStencilFunc],
  ])('compare %i tests the reference with GL’s function %i', (compare, func) => {
    expect(godotStencilState({ flags: StencilFlag.READ, compare, reference: 1 }).stencilFunc).toBe(func);
  });
});

describe('the live stencil materials', () => {
  const test = { flags: StencilFlag.WRITE, compare: StencilCompare.ALWAYS, reference: 1 };

  it('counts a material from its stencil state until it is disposed', () => {
    const material = new THREE.MeshBasicMaterial();
    applyGodotStencil(material, test);
    expect([material.stencilWrite, isAnyStencilMaterialLive()]).toEqual([true, true]);
    material.dispose();
    expect(isAnyStencilMaterialLive()).toBe(false);
  });

  it('counts a material once however often its state is applied', () => {
    const material = new THREE.MeshBasicMaterial();
    applyGodotStencil(material, test);
    applyGodotStencil(material, test);
    material.dispose();
    expect(isAnyStencilMaterialLive()).toBe(false);
  });
});
