/**
 * A 2D light's blend rule once: Godot's `light_blend_compute` and its shadow split in TypeScript,
 * and the GLSL a normal-mapped item blends a light layer with, beside its twin. `lightBlend.test.ts`
 * holds a quad's fixed-function state (`accumulationState`) and the layer blend to the rule.
 */

/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type { Rgba } from '../../godot/math/math';
import { Light2DBlendMode } from '../../godot/scene/light2d';

/** A colour's three colour channels. */
export type Rgb = Pick<Rgba, 'r' | 'g' | 'b'>;

/**
 * `light_blend_compute` (`canvas.glsl:549-563`): ADD adds the light by its alpha, SUB subtracts it,
 * and MIX mixes the colour towards it. The renderer blends through `accumulationState` and
 * `BLEND_LAYER_GLSL`. This is the reference `lightBlend.test.ts` holds both to.
 *
 * @canonical The test reference for Godot's blend of one 2D light, not called by the renderer
 */
export function lightBlendCompute(mode: number, color: Rgb, light: Rgba): Rgb {
  const blend = (base: number, lightChannel: number) => {
    if (mode === Light2DBlendMode.SUB) return base - lightChannel * light.a;
    if (mode === Light2DBlendMode.MIX) return base + (lightChannel - base) * light.a;
    return base + lightChannel * light.a;
  };
  return { r: blend(color.r, light.r), g: blend(color.g, light.g), b: blend(color.b, light.b) };
}

/**
 * `canvas.glsl:543-547` at shadow fraction `s`, split as `writeShadowedLight` writes it: the light
 * term and the `shadow_color` term, both under the light's whole alpha.
 */
export function shadowedLightTerms(light: Rgba, shadowColor: Rgba, s: number): { light: Rgba; tint: Rgba } {
  const lit = 1 - s;
  const a = light.a * (lit + s * shadowColor.a);
  return {
    light: { r: light.r * lit, g: light.g * lit, b: light.b * lit, a },
    tint: { r: shadowColor.r * s, g: shadowColor.g * s, b: shadowColor.b * s, a },
  };
}

/**
 * `vec3 blendLayer(color, term, alpha, mixes)`: a light layer holds its term premultiplied by its
 * alpha and negated by a SUB light, so each mode of `light_blend_compute` is this one line. `mixes`
 * is 1 for a MIX light and 0 otherwise.
 */
export const BLEND_LAYER_GLSL = /* glsl */ `
vec3 blendLayer(vec3 color, vec3 term, float alpha, float mixes) {
  return color * (1.0 - mixes * alpha) + term;
}
`;

/** `BLEND_LAYER_GLSL` in TypeScript. */
export function blendLayer(color: Rgb, term: Rgb, alpha: number, mixes: boolean): Rgb {
  const keep = 1 - (mixes ? alpha : 0);
  return { r: color.r * keep + term.r, g: color.g * keep + term.g, b: color.b * keep + term.b };
}
