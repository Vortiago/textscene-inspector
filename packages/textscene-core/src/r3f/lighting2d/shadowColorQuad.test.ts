/**
 * `Light2D.shadow_color`: the term a shadowed light emits instead of its cookie. `canvas.glsl`'s
 * `light_shadow_compute` gives a fully shadowed pixel `vec4(shadow_color.rgb, shadow_color.a *
 * cookie.a)`, without the light's colour, energy or cookie rgb, and the albedo multiply comes before.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createShadowColorQuadMaterial,
  shadowColorContributes,
  Light2DBlendMode,
  SHADOW_FILTER_NONE,
  SHADOW_FILTER_PCF5,
  SHADOW_FILTER_PCF13,
} from './lightQuad';
import { litQuadStencilProps, shadowColorQuadStencilProps, shadowStencilRef } from './ShadowVolumeMask';

const BLUE = { r: 0.15, g: 0.35, b: 1, a: 1 };

describe('shadowColorContributes', () => {
  it('is false at the Light2D default, so no quad is drawn for an ordinary shadow', () => {
    // Godot's default shadow_color is Color(0, 0, 0, 0), which adds nothing, so withholding the
    // light is the whole shadow.
    expect(shadowColorContributes({ r: 0, g: 0, b: 0, a: 0 }, SHADOW_FILTER_PCF13)).toBe(false);
  });

  it('is false for a transparent colour on an unfiltered light, whatever its rgb', () => {
    // A binary shadow puts `shadow_color.a` alone in front of the rgb.
    expect(shadowColorContributes({ r: 1, g: 0, b: 0, a: 0 }, SHADOW_FILTER_NONE)).toBe(false);
  });

  it("is true for a transparent colour's rgb on a filtered light, which tints the penumbra", () => {
    // `mix(light_color, shadow_color, s)` leaves `rgb · a` a `shadow_color.rgb · s · (1 − s)` term.
    // Godot 4.6.3 under PCF13 adds 38/255 of red there for Color(1, 0, 0, 0).
    expect(shadowColorContributes({ r: 1, g: 0, b: 0, a: 0 }, SHADOW_FILTER_PCF5)).toBe(true);
  });

  it('is true once the colour has alpha to contribute', () => {
    expect(shadowColorContributes(BLUE, SHADOW_FILTER_NONE)).toBe(true);
  });
});

describe('createShadowColorQuadMaterial', () => {
  it('emits shadow_color.rgb with no cookie rgb, no light colour and no energy', () => {
    const mat = createShadowColorQuadMaterial({
      cookie: new THREE.Texture(),
      shadowColor: BLUE,
      blendMode: Light2DBlendMode.ADD,
    });
    // Godot 4.6.3, `unit-lightoccluder2d-shadow-color.tscn` (surface 0.25, light (1, 0.55, 0.2) at
    // energy 1.5, shadow (0.15, 0.35, 1, 1)): rgb(79, 101, 171) over unlit 63 divides to one cookie
    // alpha per channel, 0.418 / 0.426 / 0.424, so energy and the warm colour are absent. The
    // cookie gives alpha only.
    expect(mat.fragmentShader).toContain('vec4(uShadowColor.rgb, uShadowColor.a * cookie.a)');
    expect(mat.fragmentShader).not.toContain('uEnergy');
    expect(mat.fragmentShader).not.toContain('godotToSrgb(cookie.rgb)');
  });

  it('carries the shadow colour as a straight sRGB uniform', () => {
    const mat = createShadowColorQuadMaterial({
      cookie: new THREE.Texture(),
      shadowColor: BLUE,
      blendMode: Light2DBlendMode.ADD,
    });
    const v = mat.uniforms.uShadowColor!.value as THREE.Vector4;
    expect([v.x, v.y, v.z, v.w]).toEqual([0.15, 0.35, 1, 1]);
  });

  it('blends into the accumulator exactly as the lit quad does', () => {
    // `mix` replaces the light term in place, so `light_blend_compute` still runs on it: a shadow
    // under a SUB light subtracts.
    const sub = createShadowColorQuadMaterial({
      cookie: new THREE.Texture(),
      shadowColor: BLUE,
      blendMode: Light2DBlendMode.SUB,
    });
    expect(sub.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(sub.blendSrc).toBe(THREE.SrcAlphaFactor);
  });
});

describe('shadowColorQuadStencilProps', () => {
  it('covers exactly where the lit quad does not', () => {
    const ordinal = 3;
    const lit = litQuadStencilProps(ordinal);
    const shadowed = shadowColorQuadStencilProps(ordinal);

    // Same ref, opposite test: together they partition the light's rect, so the pair is a `mix`,
    // not a double count or a gap.
    expect(shadowed.stencilRef).toBe(shadowStencilRef(ordinal));
    expect(lit.stencilFunc).toBe(THREE.NotEqualStencilFunc);
    expect(shadowed.stencilFunc).toBe(THREE.EqualStencilFunc);
  });

  it('reads the stamp without disturbing it', () => {
    // The volumes are stamped once per light and both quads test them. A quad that wrote back
    // would corrupt the ref for whichever draws second.
    const props = shadowColorQuadStencilProps(1);
    expect(props.stencilFail).toBe(THREE.KeepStencilOp);
    expect(props.stencilZFail).toBe(THREE.KeepStencilOp);
    expect(props.stencilZPass).toBe(THREE.KeepStencilOp);
  });
});
