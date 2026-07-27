/**
 * The producer side of the 2D light pass: the material one PointLight2D
 * contributes to the accumulator.
 *
 * Each `Light2D.BlendMode` is one fixed-function blend of `light_blend_compute`,
 * so the blend state IS the port — an approximation would show up here as two
 * modes sharing one set of factors.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLightQuadMaterial, Light2DBlendMode } from './lightQuad';

const WARM = { r: 1, g: 0.75, b: 0.35, a: 1 };

function material(blendMode: number, energy = 1) {
  return createLightQuadMaterial(new THREE.Texture(), WARM, energy, blendMode);
}

describe('createLightQuadMaterial', () => {
  it('emits the light term unclamped, in sRGB, with the cookie alpha kept separate', () => {
    const mat = material(Light2DBlendMode.ADD);
    // rgb is the light term; alpha stays raw because the accumulator needs it
    // both as the blend factor and, summed, as the Light Only mask.
    expect(mat.fragmentShader).toContain('vec4(lightToSrgb(cookie.rgb) * uColor * uEnergy, cookie.a)');
    expect(mat.fragmentShader).not.toContain('clamp(');
  });

  it('carries colour and energy as separate sRGB uniforms', () => {
    const mat = material(Light2DBlendMode.ADD, 2);
    const color = mat.uniforms.uColor!.value as THREE.Vector3;
    expect([color.x, color.y, color.z]).toEqual([1, 0.75, 0.35]);
    expect(mat.uniforms.uEnergy!.value).toBe(2);
  });

  it('accumulates ADD as src×srcAlpha + dst', () => {
    const mat = material(Light2DBlendMode.ADD);
    expect(mat.blending).toBe(THREE.CustomBlending);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });

  it('accumulates SUB by reverse-subtracting that same term', () => {
    const mat = material(Light2DBlendMode.SUB);
    expect(mat.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });

  it('accumulates MIX by interpolating toward the light', () => {
    const mat = material(Light2DBlendMode.MIX);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  });

  it('sums the coverage mask whatever the colour mode does', () => {
    // light_only_alpha is a plain sum, measured: three overlapping cookies of
    // alpha 0.3 mask to 0.9, not to the 0.657 a screen combination would give.
    for (const mode of [Light2DBlendMode.ADD, Light2DBlendMode.SUB, Light2DBlendMode.MIX]) {
      const mat = material(mode);
      expect(mat.blendEquationAlpha, `mode ${mode}`).toBe(THREE.AddEquation);
      expect(mat.blendSrcAlpha, `mode ${mode}`).toBe(THREE.OneFactor);
      expect(mat.blendDstAlpha, `mode ${mode}`).toBe(THREE.OneFactor);
    }
  });

  it('gives the three modes three distinct blends', () => {
    const signature = (mode: number) => {
      const m = material(mode);
      return `${m.blendEquation}/${m.blendSrc}/${m.blendDst}`;
    };
    const all = [
      signature(Light2DBlendMode.ADD),
      signature(Light2DBlendMode.SUB),
      signature(Light2DBlendMode.MIX),
    ];
    expect(new Set(all).size).toBe(3);
  });

  it('sorts with the transparent list, so lights replay in canvas order', () => {
    // The opaque list sorts nearest-first, reversing canvas order — and MIX is
    // the one mode whose result depends on the order lights are applied.
    expect(material(Light2DBlendMode.MIX).transparent).toBe(true);
  });

  it('never occludes or is occluded: a light has no depth of its own', () => {
    const mat = material(Light2DBlendMode.ADD);
    expect(mat.depthTest).toBe(false);
    expect(mat.depthWrite).toBe(false);
  });

  it('falls back to ADD for an out-of-range blend mode', () => {
    const mat = material(99);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
    expect(mat.blendDst).toBe(THREE.OneFactor);
  });
});
