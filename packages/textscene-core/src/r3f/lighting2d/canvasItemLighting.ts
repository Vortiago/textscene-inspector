/**
 * How a canvas item takes the light, per `canvas.glsl`: `color.rgb = albedo × S`. `useCanvasItemTint`
 * composes `albedo × canvas_modulation`, so the injection divides the tint out. A non-HDR 2D
 * viewport (`hdr_2d` false) never goes linear, so the injection runs after three's
 * `colorspace_fragment` has written the sRGB numbers, and does Godot's arithmetic on them with its
 * [0, 1] clamp, as Godot's shader does, with no conversion of its own. A linear canvas (`hdr_2d`
 * true) is a program variant: it holds linear half floats, so the light adds to the linear albedo
 * with no clamp (`canvas.glsl:727-760`). The light colours stay as authored.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import type * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs.js';
import { editedProgram } from '../shaderPatch/chunkPatch.js';
import { canvasColorSpaceOf, canvasNumbersOf } from '../canvasColorSpace.js';
import { CanvasItemMaterialLightMode } from '../../godot/scene/canvasItemMaterial.js';

/**
 * The floor of the canvas modulate the CPU folds in and the shader divides by, so the divide-out
 * is exact. Without it a black CanvasModulate, the usual night, erases the albedo. One 8-bit step
 * costs at most that on the base term and nothing lit, since `S` carries the true modulate.
 */
export const CANVAS_MODULATE_FLOOR = 1 / 255;

/**
 * The floor in the numbers the canvas draws with. The CPU floors the sRGB tint, then converts it,
 * so a linear canvas divides by the converted floor: a bigger one would darken a dim tint's albedo.
 */
const canvasModulateFloorIn = (isLinearCanvas: boolean): number =>
  canvasNumbersOf(canvasColorSpaceOf(isLinearCanvas), {
    r: CANVAS_MODULATE_FLOOR,
    g: CANVAS_MODULATE_FLOOR,
    b: CANVAS_MODULATE_FLOOR,
  }).r;

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
  /** The accumulation of the item's light list, or a 1x1 stand-in while no light reaches it. */
  readonly lightBuffer: THREE.IUniform;
  /** The list's `shadow_color` accumulation, or a 1x1 black stand-in when no light tints it. */
  readonly shadowTintBuffer: THREE.IUniform;
  /** `1` while a light reaches the item, else `0`: an unlit item stays at the seed. */
  readonly isLit: THREE.IUniform;
  readonly resolution: THREE.IUniform;
  readonly canvasModulate: THREE.IUniform;
  /**
   * The item's `CanvasItemMaterialLightMode`, Godot's LightMode ordinal. A uniform, not a program variant:
   * three bakes program inputs at first compile, and a re-parse edits `light_mode` under a mounted
   * item. On Godot 4.6.3 Light Only masks alpha: transparent where unlit, authored colour where lit.
   */
  readonly lightMode: THREE.IUniform;
}

/**
 * The declarations every lit item's program reads, and the clamp of its canvas space. A linear canvas
 * is a compile-time `#define`, not a uniform: the canvas space is fixed per viewport, and the
 * program then carries no dead branch (cache key suffix: `canvasProgramKey`).
 */
export function itemLightingGlsl(isLinearCanvas: boolean): string {
  return `${isLinearCanvas ? '#define LINEAR_CANVAS\n' : ''}uniform vec2 uLightResolution;
uniform vec3 uCanvasModulate;
uniform float uLightMode;
const float canvasModulateFloor = ${canvasModulateFloorIn(isLinearCanvas)};
#ifdef LINEAR_CANVAS
vec3 canvasShaded(vec3 color) { return color; }
#else
vec3 canvasShaded(vec3 color) { return clamp(color, 0.0, 1.0); }
#endif`;
}

/** The program cache key of `base`, apart for a linear canvas, whose source differs. */
export const canvasProgramKey = (base: string, isLinearCanvas: boolean): string =>
  isLinearCanvas ? `${base}-linear` : base;

const preambleFor = (isLinearCanvas: boolean): string => `uniform sampler2D uLightList;
uniform sampler2D uShadowTint;
uniform float uLit;
${itemLightingGlsl(isLinearCanvas)}
void main() {`;

/** The two preambles depend only on module constants, so they are built once. */
const UNIFORM_PREAMBLES = { srgb: preambleFor(false), linear: preambleFor(true) };

/** Midpoints between adjacent LightMode ordinals, so the GLSL never tests equality. */
const midpoint = (a: number, b: number) => ((a + b) / 2).toFixed(1);
const ABOVE_NORMAL = midpoint(CanvasItemMaterialLightMode.NORMAL, CanvasItemMaterialLightMode.UNSHADED);
const ABOVE_UNSHADED = midpoint(CanvasItemMaterialLightMode.UNSHADED, CanvasItemMaterialLightMode.LIGHT_ONLY);

/** The item's light mode, from `uLightMode`, as every lit item's program reads it. */
export const LIGHT_MODE_GLSL = `bool unshaded = uLightMode > ${ABOVE_NORMAL} && uLightMode < ${ABOVE_UNSHADED};
bool lightOnly = uLightMode > ${ABOVE_UNSHADED};`;

/**
 * Where `S` starts, the fragment's place in the light buffers, and the albedo. canvas.glsl:713:
 * Light Only skips the tint, and its buffers are seeded to match. Dividing by the seed is the tint
 * divide-out: Light Only seeds at 1, where the fragment already is the albedo.
 */
export const ITEM_ALBEDO_GLSL = `vec3 lightSeed = lightOnly ? vec3(1.0) : uCanvasModulate;
vec2 lightUv = gl_FragCoord.xy / uLightResolution;
vec3 albedo = gl_FragColor.rgb / max(lightSeed, vec3(canvasModulateFloor));`;

const LIGHT_INJECTION = `#include <colorspace_fragment>
${LIGHT_MODE_GLSL}
// canvas.glsl:719: MODE_UNSHADED skips the canvas tint and the light loop,
// so the fragment leaves as it arrived. So does an item no light reaches: the CPU already folded
// the tint in, and dividing it out and multiplying it back would only perturb it.
if (!unshaded && (uLit > 0.5 || lightOnly)) {
  ${ITEM_ALBEDO_GLSL}
  vec4 accum = uLit > 0.5 ? texture2D(uLightList, lightUv) : vec4(lightSeed, 0.0);
  // shadow_color is the one light term Godot does NOT scale by the albedo.
  vec3 shadowTint = texture2D(uShadowTint, lightUv).rgb;
  if (lightOnly) gl_FragColor.a = clamp(gl_FragColor.a * accum.a, 0.0, 1.0);
  gl_FragColor.rgb = canvasShaded(albedo * accum.rgb + shadowTint);
}`;

/** The injected source is the same literal for every item of one canvas space. */
const PROGRAM_CACHE_KEY = 'godot-canvas-light';

/**
 * Props that make a `meshBasicMaterial` sample the light accumulators, as a merge part for
 * `materialProgramInputs()`. An item that passes none stays unlit, as every 3D consumer needs. The
 * props are the same for every light mode, with or without lights: both are uniforms.
 */
export function canvasItemLightingProps(
  uniforms: CanvasItemLightingUniforms,
  isLinearCanvas: boolean
): CanvasItemLightingProps {
  return {
    transparent: true,
    injection: {
      cacheKey: canvasProgramKey(PROGRAM_CACHE_KEY, isLinearCanvas),
      onBeforeCompile: (shader) => {
        shader.uniforms.uLightList = uniforms.lightBuffer;
        shader.uniforms.uShadowTint = uniforms.shadowTintBuffer;
        shader.uniforms.uLit = uniforms.isLit;
        shader.uniforms.uLightResolution = uniforms.resolution;
        shader.uniforms.uCanvasModulate = uniforms.canvasModulate;
        shader.uniforms.uLightMode = uniforms.lightMode;

        editedProgram(
          shader,
          {
            fragment: [
              {
                three: 'void main() {',
                godot: isLinearCanvas ? UNIFORM_PREAMBLES.linear : UNIFORM_PREAMBLES.srgb,
              },
              { three: '#include <colorspace_fragment>', godot: LIGHT_INJECTION },
            ],
          },
          'canvas item lighting'
        );
      },
    },
  };
}
