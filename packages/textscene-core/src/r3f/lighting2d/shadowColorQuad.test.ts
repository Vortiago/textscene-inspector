/**
 * `Light2D.shadow_color`: the term a shadowed light emits instead of its cookie. `canvas.glsl`'s
 * `light_shadow_compute` gives a fully shadowed pixel `vec4(shadow_color.rgb, shadow_color.a *
 * cookie.a)`, without the light's colour, energy or cookie rgb, and the albedo multiply comes before.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLightQuadMaterial, shadowColorContributes } from './lightQuad';
import { Light2DBlendMode, Light2DShadowFilter } from '../../godot/scene/light2d';
import { shadowSampling } from './testing/shadowSampling';

const BLUE = { r: 0.15, g: 0.35, b: 1, a: 1 };

/** The quad of a NONE light that casts `BLUE`. */
function tintQuad(blendMode: number = Light2DBlendMode.ADD) {
  return createLightQuadMaterial({
    cookie: new THREE.Texture(),
    color: { r: 1, g: 0.55, b: 0.2, a: 1 },
    energy: 1.5,
    blendMode,
    shadow: shadowSampling({ filter: Light2DShadowFilter.NONE, shadowColor: BLUE }),
  });
}

describe('shadowColorContributes', () => {
  it('is false at the Light2D default, so no quad is drawn for an ordinary shadow', () => {
    // Godot's default shadow_color is Color(0, 0, 0, 0), which adds nothing, so withholding the
    // light is the whole shadow.
    expect(shadowColorContributes({ r: 0, g: 0, b: 0, a: 0 }, Light2DShadowFilter.PCF13)).toBe(false);
  });

  it('is false for a transparent colour on an unfiltered light, whatever its rgb', () => {
    // A binary shadow puts `shadow_color.a` alone in front of the rgb.
    expect(shadowColorContributes({ r: 1, g: 0, b: 0, a: 0 }, Light2DShadowFilter.NONE)).toBe(false);
  });

  it("is true for a transparent colour's rgb on a filtered light, which tints the penumbra", () => {
    // `mix(light_color, shadow_color, s)` leaves `rgb · a` a `shadow_color.rgb · s · (1 − s)` term.
    // Godot 4.6.3 under PCF13 adds 38/255 of red there for Color(1, 0, 0, 0).
    expect(shadowColorContributes({ r: 1, g: 0, b: 0, a: 0 }, Light2DShadowFilter.PCF5)).toBe(true);
  });

  it('is true once the colour has alpha to contribute', () => {
    expect(shadowColorContributes(BLUE, Light2DShadowFilter.NONE)).toBe(true);
  });
});

describe('the shadow_color term of a light quad', () => {
  it("takes the cookie's alpha through the edge fade, so it matches the lit quad's coverage", () => {
    const mat = tintQuad();
    expect(mat.fragmentShader).toContain('sampleCookie(vLightUv)');
    expect(mat.uniforms.uCookieEdgeFade!.value).toBe(1);
  });

  it('emits shadow_color.rgb with no cookie rgb, no light colour and no energy', () => {
    const mat = tintQuad();
    // Godot 4.6.3, `unit-lightoccluder2d-shadow-color.tscn` (surface 0.25, light (1, 0.55, 0.2) at
    // energy 1.5, shadow (0.15, 0.35, 1, 1)): rgb(79, 101, 171) over unlit 63 divides to one cookie
    // alpha per channel, 0.418 / 0.426 / 0.424, so energy and the warm colour are absent. The
    // cookie gives alpha only.
    const tintTerm = mat.fragmentShader.split('\n').find((line) => line.includes('uShadowColor.rgb * s'));
    expect(tintTerm).toContain('vec4(uShadowColor.rgb * s, alpha)');
    expect(tintTerm).not.toContain('uEnergy');
    expect(tintTerm).not.toContain('cookie.rgb');
  });

  it('carries the shadow colour as a straight sRGB uniform', () => {
    const v = tintQuad().uniforms.uShadowColor!.value as THREE.Vector4;
    expect([v.x, v.y, v.z, v.w]).toEqual([0.15, 0.35, 1, 1]);
  });

  it('blends into the accumulator exactly as the lit quad does', () => {
    // `mix` replaces the light term in place, so `light_blend_compute` still runs on it: a shadow
    // under a SUB light subtracts.
    const sub = tintQuad(Light2DBlendMode.SUB);
    expect(sub.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(sub.blendSrc).toBe(THREE.SrcAlphaFactor);
  });
});
