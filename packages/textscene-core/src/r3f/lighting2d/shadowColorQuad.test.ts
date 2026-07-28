/**
 * `Light2D.shadow_color` — the term a shadowed light contributes INSTEAD of its
 * cookie, not the absence of one.
 *
 * `canvas.glsl`'s `light_shadow_compute` is
 *
 *   shadow_color.a *= light_color.a;                  // .a is the cookie's
 *   return mix(light_color, shadow_color, shadow);
 *
 * so a fully shadowed pixel emits `vec4(shadow_color.rgb, shadow_color.a *
 * cookie.a)` — the light's own colour, energy and cookie rgb all drop out, and
 * the surface albedo is never applied to it (the albedo multiply happens on the
 * lit branch, before this mix).
 *
 * Measured against Godot 4.6.3 on `unit-lightoccluder2d-shadow-color.tscn`
 * (surface `Color(0.25, 0.25, 0.25)`, light `Color(1, 0.55, 0.2)` at
 * `energy = 1.5`, `shadow_color = Color(0.15, 0.35, 1, 1)`): the probe behind
 * the occluder reads `rgb(79, 101, 171)` over an unlit `rgb(63, 63, 63)`. Each
 * channel divides out to the SAME cookie alpha —
 *
 *   (79 - 63) / (0.15 * 255) = 0.418
 *   (101 - 63) / (0.35 * 255) = 0.426
 *   (171 - 63) / (1.00 * 255) = 0.424
 *
 * which is the proof that energy (1.5) and the light's warm colour are absent:
 * either one would break the agreement between the three channels.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createShadowColorQuadMaterial,
  shadowColorContributes,
  Light2DBlendMode,
} from './lightQuad';
import { litQuadStencilProps, shadowColorQuadStencilProps, shadowStencilRef } from './ShadowVolumeMask';

const BLUE = { r: 0.15, g: 0.35, b: 1, a: 1 };

describe('shadowColorContributes', () => {
  it('is false at the Light2D default, so no quad is drawn for an ordinary shadow', () => {
    // Godot defaults shadow_color to Color(0, 0, 0, 0) — a transparent term
    // that adds nothing. Withholding the light IS the whole shadow there.
    expect(shadowColorContributes({ r: 0, g: 0, b: 0, a: 0 })).toBe(false);
  });

  it('is false for any fully transparent colour, whatever its rgb', () => {
    expect(shadowColorContributes({ r: 1, g: 0, b: 0, a: 0 })).toBe(false);
  });

  it('is true once the colour has alpha to contribute', () => {
    expect(shadowColorContributes(BLUE)).toBe(true);
  });
});

describe('createShadowColorQuadMaterial', () => {
  it('emits shadow_color.rgb with no cookie rgb, no light colour and no energy', () => {
    const mat = createShadowColorQuadMaterial(new THREE.Texture(), BLUE, Light2DBlendMode.ADD, {});
    // The cookie is sampled for its ALPHA only; its rgb never reaches the output.
    expect(mat.fragmentShader).toContain('vec4(uShadowColor.rgb, uShadowColor.a * cookie.a)');
    expect(mat.fragmentShader).not.toContain('uEnergy');
    expect(mat.fragmentShader).not.toContain('lightToSrgb(cookie.rgb)');
  });

  it('carries the shadow colour as a straight sRGB uniform', () => {
    const mat = createShadowColorQuadMaterial(new THREE.Texture(), BLUE, Light2DBlendMode.ADD, {});
    const v = mat.uniforms.uShadowColor!.value as THREE.Vector4;
    expect([v.x, v.y, v.z, v.w]).toEqual([0.15, 0.35, 1, 1]);
  });

  it('blends into the accumulator exactly as the lit quad does', () => {
    // `mix` replaces the light term in place, so `light_blend_compute` still
    // runs on it — a shadow under a SUB light subtracts.
    const sub = createShadowColorQuadMaterial(new THREE.Texture(), BLUE, Light2DBlendMode.SUB, {});
    expect(sub.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(sub.blendSrc).toBe(THREE.SrcAlphaFactor);
  });
});

describe('shadowColorQuadStencilProps', () => {
  it('covers exactly where the lit quad does not', () => {
    const ordinal = 3;
    const lit = litQuadStencilProps(ordinal);
    const shadowed = shadowColorQuadStencilProps(ordinal);

    // Same ref, opposite test — together they partition the light's rect, which
    // is what makes the pair a `mix` rather than a double-count or a gap.
    expect(shadowed.stencilRef).toBe(shadowStencilRef(ordinal));
    expect(lit.stencilFunc).toBe(THREE.NotEqualStencilFunc);
    expect(shadowed.stencilFunc).toBe(THREE.EqualStencilFunc);
  });

  it('reads the stamp without disturbing it', () => {
    // The volumes are stamped once per light and both quads test them; a quad
    // that wrote back would corrupt the ref for whichever draws second.
    const props = shadowColorQuadStencilProps(1);
    expect(props.stencilFail).toBe(THREE.KeepStencilOp);
    expect(props.stencilZFail).toBe(THREE.KeepStencilOp);
    expect(props.stencilZPass).toBe(THREE.KeepStencilOp);
  });
});
