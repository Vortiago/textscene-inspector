/**
 * The one StandardMaterial3D decode (ADR-0031), for an inline `[sub_resource]` and an
 * external `.tres` alike: raw property strings in, `StandardMaterial3DData` out. Pure,
 * with no `three`, React or I/O. A texture reference stays a raw string, since resolving
 * it needs the tables of the file the material arrived in.
 */

import { parseColorOrUndefined } from '../../../utils/colorParser';
import { sRGBToLinearRGB } from '../../../utils/colorSpace';
import { boolOr, enumOr, floatOr, intOr } from '../../../parser/valueParsers';
import { parseVector3 } from '../../../parser/vectors';
import { emissionScalars } from './emission';
import {
  BlendMode,
  CullMode,
  DepthDrawMode,
  TEXTURE_SLOTS,
  Transparency,
  type MaterialVec2,
  type StandardMaterial3DData,
  type TextureSlot,
  type TextureSlotReferences,
} from './types';

const CONTEXT = 'StandardMaterial3D';

/**
 * `BaseMaterial3D::texture_filter` default, `TEXTURE_FILTER_LINEAR_WITH_MIPMAPS` (= 3).
 * Restated, not imported from `resources/textures/godotTextureFilter.ts`, which
 * value-imports `three`.
 */
const TEXTURE_FILTER_DEFAULT = 3;

const TRANSPARENCY_MODES = [
  Transparency.DISABLED,
  Transparency.ALPHA,
  Transparency.ALPHA_SCISSOR,
  Transparency.ALPHA_HASH,
  Transparency.ALPHA_DEPTH_PRE_PASS,
] as const;

const BLEND_MODES = [
  BlendMode.MIX,
  BlendMode.ADD,
  BlendMode.SUB,
  BlendMode.MUL,
  BlendMode.PREMULT_ALPHA,
] as const;

const CULL_MODES = [CullMode.BACK, CullMode.FRONT, CullMode.DISABLED] as const;

const DEPTH_DRAW_MODES = [
  DepthDrawMode.OPAQUE_ONLY,
  DepthDrawMode.ALWAYS,
  DepthDrawMode.DISABLED,
] as const;

/** Godot `BaseMaterial3D.DistanceFadeMode`; only PIXEL_ALPHA writes ALPHA. */
const DISTANCE_FADE_PIXEL_ALPHA = 1;

/**
 * The feature flag Godot gates each texture slot behind. A gated slot applies only when
 * its flag is on, as `_update_shader` emits the sampler only inside its
 * `if (features[…])` branch. An ungated slot applies whenever it is authored.
 */
const SLOT_GATES: Readonly<Record<TextureSlot, string | null>> = {
  albedo_texture: null,
  normal_texture: 'normal_enabled',
  roughness_texture: null,
  metallic_texture: null,
  emission_texture: 'emission_enabled',
  ao_texture: 'ao_enabled',
  heightmap_texture: 'heightmap_enabled',
  anisotropy_flowmap: 'anisotropy_enabled',
};

export function decodeStandardMaterial3D(
  properties: Record<string, string>
): StandardMaterial3DData {
  const albedo = parseColorOrUndefined(properties['albedo_color']);
  // Godot stores sRGB and its `source_color` uniform converts to linear before the
  // shader, as three's `color` expects. Not clamped: `albedo_color` has no range hint,
  // `Color::srgb_to_linear` extrapolates past 1, and an HDR albedo such as
  // `Color(2.33575, 3.29442, 3.29442, 1)` crosses the glow bright pass on purpose.
  const albedoLinear = albedo ? sRGBToLinearRGB(albedo.r, albedo.g, albedo.b) : null;

  const emissionEnabled = boolOr(properties['emission_enabled'], false, CONTEXT);
  const emission = emissionScalars(
    parseColorOrUndefined(properties['emission']),
    floatOr(properties['emission_energy_multiplier'], 1, CONTEXT),
    emissionEnabled
  );

  // Godot's flag-gated features. An omitted scalar is the constructor's default, as
  // Godot never writes one, and a feature whose flag is off reads as three's off-state (0).
  // Refraction rewrites the depth-draw mode and the alpha, so the pass decision
  // below depends on it.
  const clearcoatEnabled = boolOr(properties['clearcoat_enabled'], false, CONTEXT);
  const rimEnabled = boolOr(properties['rim_enabled'], false, CONTEXT);
  const heightmapEnabled = boolOr(properties['heightmap_enabled'], false, CONTEXT);
  const anisotropyEnabled = boolOr(properties['anisotropy_enabled'], false, CONTEXT);
  const refractionEnabled = boolOr(properties['refraction_enabled'], false, CONTEXT);

  // `_update_shader` emits `ALPHA *= albedo.a * albedo_tex.a` only when
  // `transparency != TRANSPARENCY_DISABLED` (or shadow-to-opacity, pixel-alpha
  // distance fade or proximity fade is on). So albedo alpha < 1 with transparency
  // DISABLED renders fully opaque in Godot.
  const transparency = enumOr(
    properties['transparency'],
    Transparency.DISABLED,
    TRANSPARENCY_MODES,
    `${CONTEXT}.transparency`
  );
  const blendMode = enumOr(
    properties['blend_mode'],
    BlendMode.MIX,
    BLEND_MODES,
    `${CONTEXT}.blend_mode`
  );

  // Which of Godot's two render lists this surface joins, and whether its fragments
  // reach the depth buffer. `transparency` is only one of the inputs.
  const depthTest = !boolOr(properties['no_depth_test'], false, CONTEXT);
  // `_update_shader`: `DepthDrawMode ddm = depth_draw_mode; if
  // (features[FEATURE_REFRACTION]) { ddm = DEPTH_DRAW_ALWAYS; }`. A refractive
  // surface draws depth wherever it lands.
  const depthDrawMode = refractionEnabled
    ? DepthDrawMode.ALWAYS
    : enumOr(
        properties['depth_draw_mode'],
        DepthDrawMode.OPAQUE_ONLY,
        DEPTH_DRAW_MODES,
        `${CONTEXT}.depth_draw_mode`
      );
  const alphaPass = rendersInAlphaPass(properties, {
    transparency,
    blendMode,
    refractionEnabled,
    depthDrawMode,
    depthTest,
  });
  // A deliberate parity deviation: Godot keeps ALPHA_HASH in the opaque pass with a
  // dithered discard. three has no stochastic clip, and fully opaque is further
  // from Godot's look than blending. The depth write keeps the exact opaque-pass one.
  const transparent = alphaPass || transparency === Transparency.ALPHA_HASH;

  const normalScale = floatOr(properties['normal_scale'], 1, CONTEXT);

  // `anisotropy` is −1..1, where the sign is the tangent direction. three splits it
  // into a 0..1 magnitude and a rotation, so a negative value keeps its strength and
  // turns the highlight 90°.
  const anisotropyRaw = floatOr(properties['anisotropy'], 0, CONTEXT);

  return {
    albedo: albedoLinear ?? [1, 1, 1],
    // FEATURE_REFRACTION replaces the `ALPHA *= albedo.a * albedo_tex.a` line with
    // `ALPHA = 1.0` ("Force transparency on the material (required for refraction)"),
    // so a refractive surface is fully opaque however low its authored alpha.
    alpha: refractionEnabled ? 1 : albedo ? clamp01(albedo.a) : 1,
    metallic: clamp01(floatOr(properties['metallic'], 0, CONTEXT)),
    roughness: clamp01(floatOr(properties['roughness'], 1, CONTEXT)),
    emission,
    emissionOperator: intOr(properties['emission_operator'], 0, CONTEXT),
    textureFilter: intOr(properties['texture_filter'], TEXTURE_FILTER_DEFAULT, CONTEXT),
    textureRepeat: boolOr(properties['texture_repeat'], true, CONTEXT),
    uv1Scale: vec2FromVector3(properties['uv1_scale'], { x: 1, y: 1 }),
    uv1Offset: vec2FromVector3(properties['uv1_offset'], { x: 0, y: 0 }),
    transparency,
    transparent,
    // `alpha_scissor_threshold` hint is "0,1,0.001". 0 means "no cutout" to three,
    // which every non-scissor mode wants.
    alphaTest:
      transparency === Transparency.ALPHA_SCISSOR
        ? clamp01(floatOr(properties['alpha_scissor_threshold'], 0.5, CONTEXT))
        : 0,
    depthDrawMode,
    depthWrite: godotDepthWrite(alphaPass, transparency, depthDrawMode, depthTest),
    depthTest,
    blendMode,
    cullMode: enumOr(
      properties['cull_mode'],
      CullMode.BACK,
      CULL_MODES,
      `${CONTEXT}.cull_mode`
    ),
    cullModeExplicit: properties['cull_mode'] !== undefined,
    shadingMode: properties['shading_mode'] === '0' ? 'unshaded' : 'per_pixel',
    useVertexColors: boolOr(properties['vertex_color_use_as_albedo'], false, CONTEXT),
    aoEnabled: boolOr(properties['ao_enabled'], false, CONTEXT),
    normalEnabled: boolOr(properties['normal_enabled'], false, CONTEXT),
    normalScale: { x: normalScale, y: normalScale },
    triplanar:
      boolOr(properties['uv1_triplanar'], false, CONTEXT) ||
      boolOr(properties['uv1_world_triplanar'], false, CONTEXT),
    clearcoat: clearcoatEnabled ? clamp01(floatOr(properties['clearcoat'], 1, CONTEXT)) : 0,
    clearcoatRoughness: clearcoatEnabled
      ? clamp01(floatOr(properties['clearcoat_roughness'], 0.5, CONTEXT))
      : 0,
    rim: rimEnabled ? clamp01(floatOr(properties['rim'], 1, CONTEXT)) : 0,
    rimTint: rimEnabled ? clamp01(floatOr(properties['rim_tint'], 0.5, CONTEXT)) : 0,
    heightmapScale: heightmapEnabled ? floatOr(properties['heightmap_scale'], 5, CONTEXT) : 0,
    billboardMode: intOr(properties['billboard_mode'], 0, CONTEXT),
    billboardKeepScale: boolOr(properties['billboard_keep_scale'], false, CONTEXT),
    anisotropy: anisotropyEnabled ? clamp01(Math.abs(anisotropyRaw)) : 0,
    anisotropyRotation: anisotropyEnabled && anisotropyRaw < 0 ? Math.PI / 2 : 0,
    // Godot refraction is a screen-space distortion; three models the same
    // "see the background through this surface" effect volumetrically, so
    // `refraction_scale` drives `thickness` and cannot go negative there.
    transmission: refractionEnabled ? 1 : 0,
    refractionThickness: refractionEnabled
      ? Math.max(0, floatOr(properties['refraction_scale'], 0.05, CONTEXT))
      : 0,
    textureSlots: decodeTextureSlots(properties),
  };
}

interface PassInputs {
  transparency: Transparency;
  blendMode: BlendMode;
  refractionEnabled: boolean;
  depthDrawMode: DepthDrawMode;
  depthTest: boolean;
}

/**
 * Godot's `ShaderData::uses_alpha_pass()`
 * (`servers/rendering/renderer_rd/forward_clustered/scene_shader_forward_clustered.h`), in
 * its own variable names so the two diff line by line. The flags are what
 * `BaseMaterial3D::_update_shader` emits, so `transparency` alone never decides it.
 */
function rendersInAlphaPass(properties: Record<string, string>, inputs: PassInputs): boolean {
  const { transparency, blendMode, refractionEnabled, depthDrawMode, depthTest } = inputs;

  const proximityFade = boolOr(properties['proximity_fade_enabled'], false, CONTEXT);
  const distanceFadeMode = intOr(properties['distance_fade_mode'], 0, CONTEXT);
  const shadowToOpacity = boolOr(properties['shadow_to_opacity'], false, CONTEXT);
  // `alpha_antialiasing_mode != OFF`, honoured only with a cutout mode, re-admits the
  // cutout to the alpha pass (alpha-to-coverage).
  const alphaAntialiasing = intOr(properties['alpha_antialiasing_mode'], 0, CONTEXT) !== 0;

  // The shader writes ALPHA: for a transparency mode, for refraction (`ALPHA = 1.0`),
  // and for the fades and `shadow_to_opacity`, which share one `else if`.
  const usesAlpha =
    refractionEnabled ||
    transparency !== Transparency.DISABLED ||
    shadowToOpacity ||
    distanceFadeMode === DISTANCE_FADE_PIXEL_ALPHA ||
    proximityFade;
  // The two cutout modes discard instead of blending, so they stay opaque.
  const usesAlphaClip =
    transparency === Transparency.ALPHA_SCISSOR || transparency === Transparency.ALPHA_HASH;

  // Refraction samples `screen_texture`, and refraction or proximity fade samples
  // `depth_texture`.
  const hasReadScreenAlpha = refractionEnabled || proximityFade;
  const hasBaseAlpha =
    (usesAlpha && (!usesAlphaClip || alphaAntialiasing)) || hasReadScreenAlpha;
  // `uses_blend_alpha` is true for ADD, SUB, MUL and PREMULT_ALPHA, which puts an
  // additive material in the alpha pass whatever its `transparency` says.
  const hasAlpha = hasBaseAlpha || blendMode !== BlendMode.MIX;

  return (
    hasAlpha ||
    hasReadScreenAlpha ||
    depthDrawMode === DepthDrawMode.DISABLED ||
    !depthTest
  );
}

/**
 * The colour pass's `enable_depth_write` (`scene_shader_forward_clustered.cpp`
 * `_create_pipeline`): the depth-draw mode decides it, and the transparent pipeline
 * overrides OPAQUE_ONLY to false. A disabled depth test writes nothing.
 */
function godotDepthWrite(
  alphaPass: boolean,
  transparency: Transparency,
  depthDrawMode: DepthDrawMode,
  depthTest: boolean
): boolean {
  if (!depthTest || depthDrawMode === DepthDrawMode.DISABLED) return false;
  if (!alphaPass) return true;
  // Its colour pipeline writes no depth, but `uses_depth_in_alpha_pass()` puts it in
  // the depth prepass, which a single-pass renderer spells as writing depth.
  if (transparency === Transparency.ALPHA_DEPTH_PRE_PASS) return true;
  return depthDrawMode !== DepthDrawMode.OPAQUE_ONLY;
}

/**
 * The authored texture references, minus every slot whose feature flag is off. Gated
 * here, not per arrival path, so a material has the same maps however it is referenced.
 */
function decodeTextureSlots(properties: Record<string, string>): TextureSlotReferences {
  const slots: Partial<Record<TextureSlot, string>> = {};
  for (const slot of TEXTURE_SLOTS) {
    const reference = properties[slot];
    if (reference === undefined) continue;
    const gate = SLOT_GATES[slot];
    if (gate !== null && !boolOr(properties[gate], false, CONTEXT)) continue;
    slots[slot] = reference;
  }
  return slots;
}

/**
 * Godot writes UV transforms as `Vector3`, and only x and y reach a 2D UV. It wraps the
 * throwing `parseVector3`, so the float grammar, scientific notation included, is shared.
 */
function vec2FromVector3(raw: string | undefined, fallback: MaterialVec2): MaterialVec2 {
  if (!raw) return fallback;
  try {
    const { x, y } = parseVector3(raw);
    return { x, y };
  } catch {
    return fallback;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
