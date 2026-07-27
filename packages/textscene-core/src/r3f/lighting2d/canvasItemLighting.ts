/**
 * How a canvas item receives the accumulated light.
 *
 * The accumulator holds `S` (see `CanvasLighting2D`), so an item's whole job is
 * `color.rgb = albedo x S`. The albedo is what the CPU side already produced —
 * `useCanvasItemTint` composes `albedo x canvas_modulation`, so the injection
 * divides that tint back out to recover the per-fragment albedo, which is the
 * only quantity a texture and vertex colours leave available per fragment.
 *
 * That division is exact rather than lossy, because the divisor is FLOORED: the
 * CPU folds `max(canvas_modulation, CANVAS_MODULATE_FLOOR)` and the shader
 * divides by the same. Without the floor a black CanvasModulate — the ordinary
 * way to author night — annihilates the albedo, and no light can ever bring it
 * back. The floor costs at most one 8-bit step on the base term, and nothing at
 * all on the lit result, because `S` still carries the TRUE canvas modulate.
 *
 * All of it happens in Godot's space. A non-HDR 2D viewport (`hdr_2d` defaults
 * false) never enters a linear working space, so the injection decodes three's
 * linear fragment to sRGB, does Godot's arithmetic there — including the [0, 1]
 * clamp Godot's framebuffer applies — and re-encodes; three's own
 * `colorspace_fragment` then converts once more on the way out.
 *
 * LIGHT CULLING. Godot applies a light to an item only when
 * `light.range_item_cull_mask & item.light_mask != 0`, so the accumulation is
 * split into one buffer per distinct cull mask and this item reads the ones its
 * own mask selects. WHICH ones is decided on the CPU, once per item per frame,
 * and arrives as a per-slot weight. GLSL ES 1.00, which is what three compiles
 * an `onBeforeCompile` injection as, has no bitwise operators at all, and a
 * per-fragment mask test would recompute a per-item constant at every pixel.
 * The slots are UNROLLED because the same GLSL version cannot index a sampler
 * array by anything but a constant expression.
 *
 * Combining several classes is `S = seed + Σ (S_class − seed)`, which is what
 * Godot's loop produces whenever the blends commute. One class (the ordinary
 * case, and every masked scene in the corpus) is reproduced EXACTLY, as is any
 * number of ADD/SUB classes, because each contributes an independent `± light·a`
 * term to the same sum. Only a MIX light in one class over a light in ANOTHER
 * class reaching the SAME item diverges, since MIX interpolates the accumulator
 * and so does not commute across the split.
 *
 * Both `light_mode` exclusions are here, matching the guards in `canvas.glsl`:
 * `MODE_UNSHADED` skips the canvas tint AND the light loop, while
 * `MODE_LIGHT_ONLY` skips only the canvas tint — so it reads the accumulation
 * seeded from an unmodulated white instead — and is then masked by the summed
 * cookie coverage. Measured against Godot 4.6.3, a Light Only item keeps its own
 * albedo where light reaches it and fades to nothing where none does: it is an
 * alpha mask, not a recolouring. An unlit Light Only panel renders fully
 * transparent, and a lit one at full cookie alpha renders its authored colour.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type * as THREE from 'three';
import { CanvasItemLightMode } from '../../resources/materials/canvasitemmaterial/types.js';
import { MAX_LIGHT_CLASSES } from './CanvasLighting2D.js';

/**
 * The smallest canvas-modulate channel the CPU will fold into an item's colour.
 * One 8-bit step: below it the tint is indistinguishable from black on screen,
 * but dividing by it still recovers the albedo the lights need.
 */
export const CANVAS_MODULATE_FLOOR = 1 / 255;

/**
 * Godot's whole 2D light-culling rule, from `RendererCanvasCull::_render_canvas_item`:
 *
 *   if (light->item_mask & ci->light_mask) { ...apply light... }
 *
 * `item_mask` is the light's `range_item_cull_mask`; the light's own
 * `light_mask` is its CanvasItem mask and says nothing about what it lights.
 * Both sides default to 1, which is why an untouched light reaches an untouched
 * item. JS `&` is a signed 32-bit operation over exactly the 32 bits Godot
 * compares, and `!== 0` reads the result the same way `if` does in C++.
 */
export function lightReachesItem(rangeItemCullMask: number, itemLightMask: number): boolean {
  return (rangeItemCullMask & itemLightMask) !== 0;
}

/** The GLSL sampler holding class slot `index`'s accumulation. */
export function lightClassSampler(index: number): string {
  return `uLightClass${index}`;
}

/** sRGB transfer functions, matching three's own `sRGBTransferOETF`/`EOTF`. */
const TRANSFER_GLSL = /* glsl */ `
vec3 godotToSrgb(vec3 c) {
  return mix(c * 12.92, pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c));
}
vec3 godotToLinear(vec3 c) {
  return mix(c / 12.92, pow((max(c, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;

const CLASS_SLOTS = Array.from({ length: MAX_LIGHT_CLASSES }, (_unused, index) => index);

export interface CanvasItemLightingProps {
  onBeforeCompile?: (shader: {
    vertexShader: string;
    fragmentShader: string;
    uniforms: Record<string, THREE.IUniform>;
  }) => void;
  customProgramCacheKey?: () => string;
  transparent?: boolean;
}

/**
 * Stable uniform objects, created once per item and MUTATED as the light state
 * changes. They cannot be recreated: three captures whatever `onBeforeCompile`
 * assigns at the material's first compile, and R3F never bumps
 * `material.needsUpdate` when the prop changes (verified in the fiber 9.6.1
 * dist), so a later value would simply never reach the GPU.
 */
export interface CanvasItemLightingUniforms {
  /** One accumulator sampler per class slot; unmatched slots hold a 1x1 stand-in. */
  readonly classBuffers: readonly THREE.IUniform[];
  /** `1` in the slots whose cull mask this item's `light_mask` selects, else `0`. */
  readonly classWeights: THREE.IUniform;
  readonly resolution: THREE.IUniform;
  readonly canvasModulate: THREE.IUniform;
}

export interface CanvasItemLightingInput {
  uniforms: CanvasItemLightingUniforms;
  lightMode: CanvasItemLightMode;
}

/**
 * Material props that make an ordinary `meshBasicMaterial` sample the light
 * accumulators. Spread onto the material like the blend state; an item that
 * spreads nothing simply stays unlit, which is what every 3D consumer needs.
 *
 * Returns empty props only for an `Unshaded` item, which Godot excludes from the
 * light loop outright. Everything else compiles the light path whether or not
 * the scene currently has lights — see the note in `onBeforeCompile`.
 */
export function canvasItemLightingProps(
  input: CanvasItemLightingInput
): CanvasItemLightingProps {
  const { uniforms, lightMode } = input;
  if (lightMode === CanvasItemLightMode.UNSHADED) return {};

  const lightOnly = lightMode === CanvasItemLightMode.LIGHT_ONLY;
  const seed = lightOnly ? 'vec3(1.0)' : 'uCanvasModulate';

  return {
    customProgramCacheKey: () => `godot-canvas-light-${lightOnly ? 'light-only' : 'normal'}`,
    // A Light Only item is a mask, so its alpha has to survive to the blend.
    ...(lightOnly ? { transparent: true } : {}),
    onBeforeCompile: (shader) => {
      // Compiled unconditionally, even with no lights in the scene: which lights
      // exist is DATA, carried by `uLightClassWeight`, not a different program.
      // Godot's canvas.glsl is shaped the same way: the light loop is always
      // present and zero lights simply contribute nothing. Making it a
      // compile-time choice is what left already-mounted items on a stock
      // shader forever once a light appeared.
      CLASS_SLOTS.forEach((index) => {
        shader.uniforms[lightClassSampler(index)] = uniforms.classBuffers[index]!;
      });
      shader.uniforms.uLightClassWeight = uniforms.classWeights;
      shader.uniforms.uLightResolution = uniforms.resolution;
      shader.uniforms.uCanvasModulate = uniforms.canvasModulate;

      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          `${CLASS_SLOTS.map((index) => `uniform sampler2D ${lightClassSampler(index)};`).join('\n')}
uniform float uLightClassWeight[${MAX_LIGHT_CLASSES}];
uniform vec2 uLightResolution;
uniform vec3 uCanvasModulate;
${TRANSFER_GLSL}
void main() {`
        )
        .replace(
          '#include <colorspace_fragment>',
          `{
  // Every slot this item's light_mask does not select weighs 0, which covers
  // both a canvas with no light at all and a class this item is culled from.
  // S is then just the seed its light mode would have started from.
  vec3 lightSeed = ${seed};
  vec4 accum = vec4(lightSeed, 0.0);
  vec2 lightUv = gl_FragCoord.xy / uLightResolution;
${CLASS_SLOTS.map(
  (index) => `  if (uLightClassWeight[${index}] > 0.5) {
    vec4 lightClass = texture2D(${lightClassSampler(index)}, lightUv);
    accum.rgb += lightClass.rgb - lightSeed;
    accum.a += lightClass.a;
  }`
).join('\n')}
  vec3 lit = godotToSrgb(gl_FragColor.rgb);
${
  lightOnly
    ? `  // Light Only skipped the canvas tint on the CPU, so the fragment IS the
  // albedo, and the buffers it reads were seeded unmodulated to match.
  vec3 albedo = lit;
  gl_FragColor.a = clamp(gl_FragColor.a * accum.a, 0.0, 1.0);`
    : `  vec3 albedo = lit / max(uCanvasModulate, vec3(${CANVAS_MODULATE_FLOOR}));`
}
  gl_FragColor.rgb = godotToLinear(clamp(albedo * accum.rgb, 0.0, 1.0));
}
#include <colorspace_fragment>`
        );
    },
  };
}
