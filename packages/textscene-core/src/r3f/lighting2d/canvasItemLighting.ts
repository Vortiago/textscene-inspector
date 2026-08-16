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
 * LIGHT CULLING. Godot applies a light to an item only when the item's
 * `light_mask`, its accumulated `z_final` and its canvas's layer all pass the
 * light's window (`lightCullKey`), so the accumulation is split into one buffer
 * per distinct cull TUPLE and this item reads the ones it is not culled from.
 * WHICH ones is decided on the CPU, once per item per frame, and arrives as a
 * per-slot weight. GLSL ES 1.00, which is what three compiles an
 * `onBeforeCompile` injection as, has no bitwise operators at all, and a
 * per-fragment test would recompute a per-item constant at every pixel. The
 * slots are UNROLLED because the same GLSL version cannot index a sampler array
 * by anything but a constant expression.
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
 * LIGHT MODE IS A UNIFORM, NOT A VARIANT. Godot picks a shader version per draw;
 * three bakes its program inputs in at a material's first compile
 * (`canvasItemProgram.ts`) while a re-parse edits `light_mode` under a MOUNTED
 * item. So the mode rides `uLightMode`, as "which lights exist" already rides
 * `uLightClassWeight`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type * as THREE from 'three';
import { CanvasItemLightMode } from '../../resources/materials/canvasitemmaterial/types.js';
import { MAX_LIGHT_CLASSES } from './CanvasLighting2D.js';
import { GODOT_TO_LINEAR_GLSL, GODOT_TO_SRGB_GLSL } from './srgbTransfer.js';

/**
 * The smallest canvas-modulate channel the CPU will fold into an item's colour.
 * One 8-bit step: below it the tint is indistinguishable from black on screen,
 * but dividing by it still recovers the albedo the lights need.
 */
export const CANVAS_MODULATE_FLOOR = 1 / 255;

/** The GLSL sampler holding class slot `index`'s accumulation. */
export function lightClassSampler(index: number): string {
  return `uLightClass${index}`;
}

/** The GLSL sampler holding class slot `index`'s albedo-free `shadow_color` term. */
export function shadowTintSampler(index: number): string {
  return `uShadowTint${index}`;
}

/** Both directions: the item side encodes to compare and decodes to write back. */
const TRANSFER_GLSL = GODOT_TO_SRGB_GLSL + GODOT_TO_LINEAR_GLSL;

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
  /** One `shadow_color` accumulator per class slot; a 1x1 black stand-in when unused. */
  readonly shadowTintBuffers: readonly THREE.IUniform[];
  /** `1` in the slots whose cull mask this item's `light_mask` selects, else `0`. */
  readonly classWeights: THREE.IUniform;
  readonly resolution: THREE.IUniform;
  readonly canvasModulate: THREE.IUniform;
  /** The item's `CanvasItemLightMode`, which is Godot's own LightMode ordinal. */
  readonly lightMode: THREE.IUniform;
}

/** Both injections depend only on module constants, so they are built once. */
const UNIFORM_PREAMBLE = `${CLASS_SLOTS.map(
  (index) =>
    `uniform sampler2D ${lightClassSampler(index)};\nuniform sampler2D ${shadowTintSampler(index)};`
).join('\n')}
uniform float uLightClassWeight[${MAX_LIGHT_CLASSES}];
uniform vec2 uLightResolution;
uniform vec3 uCanvasModulate;
uniform float uLightMode;
${TRANSFER_GLSL}
void main() {`;

/** Midpoints between adjacent LightMode ordinals, so the GLSL never tests equality. */
const midpoint = (a: number, b: number) => ((a + b) / 2).toFixed(1);
const ABOVE_NORMAL = midpoint(CanvasItemLightMode.NORMAL, CanvasItemLightMode.UNSHADED);
const ABOVE_UNSHADED = midpoint(CanvasItemLightMode.UNSHADED, CanvasItemLightMode.LIGHT_ONLY);

const LIGHT_INJECTION = `bool unshaded = uLightMode > ${ABOVE_NORMAL} && uLightMode < ${ABOVE_UNSHADED};
bool lightOnly = uLightMode > ${ABOVE_UNSHADED};
// canvas.glsl:719 — MODE_UNSHADED skips the canvas tint and the light loop,
// so the fragment leaves as it arrived.
if (!unshaded) {
  // canvas.glsl:713 — Light Only skips the tint; its buffers are seeded to match.
  vec3 lightSeed = lightOnly ? vec3(1.0) : uCanvasModulate;
  // Weight 0 covers both "no light on this canvas" and "culled from this class",
  // leaving S at the seed.
  vec4 accum = vec4(lightSeed, 0.0);
  // shadow_color is the one light term Godot does NOT scale by the albedo.
  vec3 shadowTint = vec3(0.0);
  vec2 lightUv = gl_FragCoord.xy / uLightResolution;
${CLASS_SLOTS.map(
  (index) => `  if (uLightClassWeight[${index}] > 0.5) {
    vec4 lightClass = texture2D(${lightClassSampler(index)}, lightUv);
    accum.rgb += lightClass.rgb - lightSeed;
    accum.a += lightClass.a;
    shadowTint += texture2D(${shadowTintSampler(index)}, lightUv).rgb;
  }`
).join('\n')}
  // Dividing by the seed IS the tint divide-out: Light Only seeds at 1, where it
  // is a no-op and the fragment already is the albedo.
  vec3 albedo = godotToSrgb(gl_FragColor.rgb) / max(lightSeed, vec3(${CANVAS_MODULATE_FLOOR}));
  if (lightOnly) gl_FragColor.a = clamp(gl_FragColor.a * accum.a, 0.0, 1.0);
  gl_FragColor.rgb = godotToLinear(clamp(albedo * accum.rgb + shadowTint, 0.0, 1.0));
}
#include <colorspace_fragment>`;

/** Constant: the injected source is the same literal for every item. */
const PROGRAM_CACHE_KEY = () => 'godot-canvas-light';

/**
 * Material props that make an ordinary `meshBasicMaterial` sample the light
 * accumulators. Spread onto the material like the blend state; an item that
 * spreads nothing simply stays unlit, which is what every 3D consumer needs.
 *
 * The SAME props whatever the light mode, and whether or not the scene has
 * lights: both are uniforms, not programs (see the module note).
 */
export function canvasItemLightingProps(
  uniforms: CanvasItemLightingUniforms
): CanvasItemLightingProps {
  return {
    customProgramCacheKey: PROGRAM_CACHE_KEY,
    // Light Only is an alpha mask, so it must reach the blend. Unconditional
    // because `transparent` is itself a program input (three's `OPAQUE`).
    transparent: true,
    onBeforeCompile: (shader) => {
      CLASS_SLOTS.forEach((index) => {
        shader.uniforms[lightClassSampler(index)] = uniforms.classBuffers[index]!;
        shader.uniforms[shadowTintSampler(index)] = uniforms.shadowTintBuffers[index]!;
      });
      shader.uniforms.uLightClassWeight = uniforms.classWeights;
      shader.uniforms.uLightResolution = uniforms.resolution;
      shader.uniforms.uCanvasModulate = uniforms.canvasModulate;
      shader.uniforms.uLightMode = uniforms.lightMode;

      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', UNIFORM_PREAMBLE)
        .replace('#include <colorspace_fragment>', LIGHT_INJECTION);
    },
  };
}
