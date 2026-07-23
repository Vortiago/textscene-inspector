/**
 * Godot's tonemapper as a `postprocessing` full-screen `Effect`.
 *
 * The previewer normally tonemaps in-material (a `CustomToneMapping` shader
 * chunk). That cannot coexist with glow: bloom must read pre-tonemap HDR
 * luminance, and `@react-three/postprocessing`'s composer forces the renderer
 * to `NoToneMapping` while it is mounted anyway. So on the glow path the exact
 * same Godot curve is applied here instead, as the LAST effect after bloom —
 * bloom adds to the HDR buffer, then this compresses the result.
 *
 * The curve GLSL is the single source in `godotToneMapping.ts`; this only wraps
 * it in `postprocessing`'s `mainImage` convention and threads exposure.
 */

import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { toneMappingEffectGlsl } from '../../resources/environment/godotToneMapping';

export interface GodotToneMappingOptions {
  /** Godot `tonemap_mode`: 0 LINEAR, 1 REINHARDT, 2 FILMIC, 3 ACES, 4 AGX. */
  mode: number;
  /** Godot `tonemap_exposure`. */
  exposure: number;
  /** Godot `tonemap_white` — the input the curve maps to 1.0. */
  white: number;
}

function fragmentShader(mode: number, white: number): string {
  const curve = toneMappingEffectGlsl(mode, white);
  // LINEAR (and, as a prototype limitation, AGX) have no ported curve here:
  // apply exposure only, leaving the colour otherwise untouched. AGX on this
  // path is a known gap — the material path uses three's AgX (PARITY).
  const body =
    curve ??
    /* glsl */ `vec3 godotToneMap(vec3 color, float exposure) { return color * exposure; }`;
  return /* glsl */ `
uniform float godotExposure;
${body}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 mapped = godotToneMap(max(inputColor.rgb, 0.0), godotExposure);
  outputColor = vec4(mapped, inputColor.a);
}
`;
}

export class GodotToneMappingEffect extends Effect {
  constructor({ mode, exposure, white }: GodotToneMappingOptions) {
    super('GodotToneMappingEffect', fragmentShader(mode, white), {
      uniforms: new Map([['godotExposure', new Uniform(exposure)]]),
    });
  }
}

