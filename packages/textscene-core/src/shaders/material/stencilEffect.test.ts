import { describe, expect, it } from 'vitest';
import { StencilCompare, StencilFlag, StencilMode } from '../../godot/rendering/materials/stencil.js';
import { materialStateOf } from './materialProperties.js';
import { stencilPassOf } from './stencilEffect.js';

describe('stencilPassOf', () => {
  it("grows an outline's pass by the outline thickness and reads where the material wrote none", () => {
    const pass = stencilPassOf(
      materialStateOf('ORMMaterial3D', { stencil_mode: StencilMode.OUTLINE, stencil_outline_thickness: 0.5 })
    );

    expect(pass).toMatchObject({
      materialClass: 'StandardMaterial3D',
      renderPriorityOffset: 1,
      settings: {
        grow: true,
        grow_amount: 0.5,
        no_depth_test: false,
        stencil_flags: StencilFlag.READ,
        stencil_compare: StencilCompare.NOT_EQUAL,
      },
    });
  });

  it("draws an x-ray's pass through depth, with no growth", () => {
    const pass = stencilPassOf(materialStateOf('StandardMaterial3D', { stencil_mode: StencilMode.XRAY }));

    expect(pass?.settings).toMatchObject({ grow: false, grow_amount: 0, no_depth_test: true });
  });

  it('makes no pass for a custom or disabled stencil', () => {
    expect(stencilPassOf(materialStateOf('StandardMaterial3D', { stencil_mode: StencilMode.CUSTOM }))).toBe(
      undefined
    );
    expect(stencilPassOf(materialStateOf('StandardMaterial3D', {}))).toBe(undefined);
  });
});
