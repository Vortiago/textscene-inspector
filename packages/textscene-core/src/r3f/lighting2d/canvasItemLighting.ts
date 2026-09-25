/**
 * How a canvas item takes the light, per `canvas.glsl`: `color.rgb = albedo × S`. `useCanvasItemTint`
 * composes `albedo × canvas_modulation`, so the injection divides the tint out. A non-HDR 2D
 * viewport (`hdr_2d` false) never goes linear, so the injection decodes to sRGB, does Godot's
 * arithmetic with its [0, 1] clamp, and re-encodes before three's `colorspace_fragment`.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs.js';
import { CanvasItemLightMode } from '../../resources/materials/canvasitemmaterial/types.js';
import { MAX_LIGHT_CLASSES } from './CanvasLighting2D.js';
import { GODOT_TO_LINEAR_GLSL, GODOT_TO_SRGB_GLSL } from './srgbTransfer.js';

/**
 * The floor of the canvas modulate the CPU folds in and the shader divides by, so the divide-out
 * is exact. Without it a black CanvasModulate, the usual night, erases the albedo. One 8-bit step
 * costs at most that on the base term and nothing lit, since `S` carries the true modulate.
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

/**
 * A `merge` part for `materialProgramInputs()`: the one material prop the
 * injection forces, and the injection itself as a paired unit.
 */
export interface CanvasItemLightingProps {
  /**
   * Light Only is an alpha mask, so it must reach the blend. Unconditional because `transparent`
   * is a program input (three's `OPAQUE`), and spread last, so it overrides the item's value and
   * the key follows the merged result.
   */
  readonly transparent: true;
  readonly injection: ProgramInjection;
}

/**
 * Stable uniform objects, created once per item and mutated as the light state changes. three
 * captures what `onBeforeCompile` assigns at first compile, and R3F never sets
 * `material.needsUpdate` on a prop change (fiber 9.6.1 dist), so a new object never reaches the GPU.
 */
export interface CanvasItemLightingUniforms {
  /** One accumulator sampler per class slot; unmatched slots hold a 1x1 stand-in. */
  readonly classBuffers: readonly THREE.IUniform[];
  /** One `shadow_color` accumulator per class slot; a 1x1 black stand-in when unused. */
  readonly shadowTintBuffers: readonly THREE.IUniform[];
  /**
   * `1` in the class slots this item is not culled from (`lightCullKey`), else `0`, set on the CPU
   * once per item per frame: GLSL ES 1.00 has no bitwise operators. The slots are unrolled, since
   * it indexes a sampler array only by a constant.
   */
  readonly classWeights: THREE.IUniform;
  readonly resolution: THREE.IUniform;
  readonly canvasModulate: THREE.IUniform;
  /**
   * The item's `CanvasItemLightMode`, Godot's LightMode ordinal. A uniform, not a program variant:
   * three bakes program inputs at first compile, and a re-parse edits `light_mode` under a mounted
   * item. On Godot 4.6.3 Light Only masks alpha: transparent where unlit, authored colour where lit.
   */
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

// Classes combine as `S = seed + Σ (S_class − seed)`, Godot's loop whenever the blends commute:
// exact for one class and for any number of ADD/SUB classes. Only a MIX light over a light of
// another class on the same item diverges, since MIX does not commute across the split.
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
const PROGRAM_CACHE_KEY = 'godot-canvas-light';

/**
 * Props that make a `meshBasicMaterial` sample the light accumulators, as a merge part for
 * `materialProgramInputs()`. An item that passes none stays unlit, as every 3D consumer needs. The
 * props are the same for every light mode, with or without lights: both are uniforms.
 */
export function canvasItemLightingProps(
  uniforms: CanvasItemLightingUniforms
): CanvasItemLightingProps {
  return {
    transparent: true,
    injection: {
      cacheKey: PROGRAM_CACHE_KEY,
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
    },
  };
}
