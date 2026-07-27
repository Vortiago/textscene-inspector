/**
 * How a canvas item receives the accumulated light.
 *
 * Godot's base pass ends at `albedo x canvas_modulation`, then each light adds
 * `albedo x light_i`, so the item's final colour is
 * `albedo x (canvas_modulation + SUM of light_i)`. The CPU side has already
 * produced `albedo x canvas_modulation` (that is what `useCanvasItemTint`
 * composes), so the shader only has to recover the albedo and add the light
 * term against it.
 *
 * All of it happens in Godot's space. A non-HDR 2D viewport (`hdr_2d` defaults
 * false) never enters a linear working space, so the injection decodes three's
 * linear fragment to sRGB, does Godot's arithmetic there, and re-encodes —
 * three's own `colorspace_fragment` then converts once more on the way out.
 *
 * Both `light_mode` exclusions are here, matching the guards in `canvas.glsl`:
 * `MODE_UNSHADED` skips the canvas tint AND the light loop, and
 * `MODE_LIGHT_ONLY` keeps only what the lights contributed.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type * as THREE from 'three';
import { CanvasItemLightMode } from '../../resources/materials/canvasitemmaterial/types.js';

/** sRGB transfer functions, matching three's own `sRGBTransferOETF`/`EOTF`. */
const TRANSFER_GLSL = /* glsl */ `
vec3 godotToSrgb(vec3 c) {
  return mix(c * 12.92, pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c));
}
vec3 godotToLinear(vec3 c) {
  return mix(c / 12.92, pow((max(c, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;

export interface CanvasItemLightingProps {
  onBeforeCompile?: (shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }) => void;
  customProgramCacheKey?: () => string;
}

export interface CanvasItemLightingInput {
  /**
   * Stable uniform objects, created once per item and MUTATED as the light
   * state changes. They cannot be recreated: three captures whatever
   * `onBeforeCompile` assigns at the material's first compile, and R3F never
   * bumps `material.needsUpdate` when the prop changes (verified in the fiber
   * 9.6.1 dist), so a later value would simply never reach the GPU.
   */
  uniforms: {
    uLightBuffer: THREE.IUniform;
    uLightResolution: THREE.IUniform;
    uCanvasModulate: THREE.IUniform;
  };
  lightMode: CanvasItemLightMode;
}

/**
 * Material props that make an ordinary `meshBasicMaterial` sample the light
 * buffer. Spread onto the material like the blend state; an item that spreads
 * nothing simply stays unlit, which is what every 3D and unlit-2D consumer
 * needs.
 *
 * Returns empty props only for an `Unshaded` item, which Godot excludes from
 * the light loop outright. Everything else compiles the light path whether or
 * not the scene currently has lights — see the note in `onBeforeCompile`.
 */
export function canvasItemLightingProps(
  input: CanvasItemLightingInput
): CanvasItemLightingProps {
  const { uniforms, lightMode } = input;
  if (lightMode === CanvasItemLightMode.UNSHADED) return {};

  const lightOnly = lightMode === CanvasItemLightMode.LIGHT_ONLY;

  return {
    customProgramCacheKey: () => `godot-canvas-light-${lightOnly ? 'light-only' : 'normal'}`,
    onBeforeCompile: (shader) => {
      // Compiled unconditionally, even with no lights in the scene: whether a
      // light exists is DATA, carried by the buffer uniform, not a different
      // program. Godot's canvas.glsl is shaped the same way — the light loop is
      // always present and zero lights simply contribute nothing. Making it a
      // compile-time choice is what left already-mounted items on a stock
      // shader forever once a light appeared.
      shader.uniforms.uLightBuffer = uniforms.uLightBuffer;
      shader.uniforms.uLightResolution = uniforms.uLightResolution;
      shader.uniforms.uCanvasModulate = uniforms.uCanvasModulate;

      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `uniform sampler2D uLightBuffer;
uniform vec2 uLightResolution;
uniform vec3 uCanvasModulate;
${TRANSFER_GLSL}
void main() {`
        )
        .replace(
          '#include <colorspace_fragment>',
          `{
  // The CPU colour is albedo x canvas_modulation; divide it back out to
  // recover the albedo each light must be multiplied against.
  vec3 lit = godotToSrgb(gl_FragColor.rgb);
  vec3 albedo = lit / max(uCanvasModulate, vec3(1e-4));
  vec3 lightSum = texture2D(uLightBuffer, gl_FragCoord.xy / uLightResolution).rgb;
  ${
    lightOnly
      ? 'gl_FragColor.rgb = godotToLinear(albedo * lightSum);'
      : 'gl_FragColor.rgb = godotToLinear(lit + albedo * lightSum);'
  }
}
#include <colorspace_fragment>`
        );
    },
  };
}
