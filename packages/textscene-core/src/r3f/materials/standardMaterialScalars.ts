/**
 * Synchronous extraction of StandardMaterial3D scalar properties for R3F.
 *
 * Covers everything that doesn't require an async resource fetch:
 *   - albedo_color  (RGB + opacity)
 *   - metallic, roughness
 *   - emission_enabled, emission color, emission_energy_multiplier
 *   - uv1_scale, uv1_offset
 *   - transparency, blend_mode, cull_mode  (rendering flags)
 *   - normal_scale
 *   - anisotropy strength and direction
 *
 * External textures (albedo / normal / roughness / metallic / emission)
 * are handled by `useResource` in the parent component. Shared by every
 * StandardMaterial3D-bearing node type (MeshInstance3D, CSGBox3D, …) via
 * `<StandardMaterialSlot>`.
 */

import * as THREE from 'three';
import { parseColor } from '../../utils/colorParser';
import { sRGBToLinearRGB } from '../../utils/colorSpace';
import {
  emissionScalars,
  type EmissionScalars,
} from '../../resources/materials/standardmaterial3d/emission';

export interface StandardMaterial3DScalars extends EmissionScalars {
  color: [number, number, number];
  opacity: number;
  metalness: number;
  roughness: number;
  /**
   * Godot `emission_operator`: 0 ADD (default), 1 MULTIPLY. Only observable
   * alongside an `emission_texture` — `resolveEmission` combines the two.
   */
  emissionOperator: number;
  /** Per-axis tiling factor for every texture map applied by this material. */
  uv1Scale: { x: number; y: number };
  /** Per-axis offset for every texture map applied by this material. */
  uv1Offset: { x: number; y: number };
  /** True only when Godot's `transparency` is a blending mode (ALPHA / ALPHA_HASH / DEPTH_PRE_PASS). */
  transparent: boolean;
  /** Alpha-test cutoff for ALPHA_SCISSOR (Godot transparency mode 2); 0 = disabled. */
  alphaTest: number;
  /** three.js depthWrite — false only for ALPHA blending so objects behind stay visible. */
  depthWrite: boolean;
  /** Godot `shading_mode`: 'unshaded' (mode 0, unlit) or 'per_pixel' (default). */
  shadingMode: 'unshaded' | 'per_pixel';
  /** Godot `vertex_color_use_as_albedo` → three.js vertexColors (default false). */
  useVertexColors: boolean;
  /** Godot `ao_enabled` — aoMap is only applied when true (default false). */
  aoEnabled: boolean;
  /** three.js blending constant; defaults to NormalBlending. */
  blending: THREE.Blending;
  /** three.js side constant; defaults to FrontSide. */
  side: THREE.Side;
  /**
   * Whether `cull_mode` was explicitly set on the source material. Lets
   * downstream consumers apply a per-mesh-type default (PlaneMesh-backed
   * Canvas planes default to DoubleSide when the
   * source material didn't pick a side, to survive 90° flip transforms
   * that would otherwise back-cull the photo into invisibility).
   */
  cullModeExplicit: boolean;
  /** Uniform XY scale applied to the normal map (no-op without normalMap). */
  normalScale: { x: number; y: number };
  /**
   * Godot `uv1_triplanar` / `uv1_world_triplanar`. We don't run a
   * triplanar shader; instead the consumer reproduces the tiling DENSITY for
   * planar meshes (repeat = mesh size × `uv1_scale`) via `triplanarPlaneScale`.
   * True when EITHER flag is set.
   */
  triplanar: boolean;
  /** Godot `clearcoat` strength (0..1), gated on `clearcoat_enabled`. */
  clearcoat: number;
  /** Godot `clearcoat_roughness` (0..1), gated on `clearcoat_enabled`. */
  clearcoatRoughness: number;
  /** Godot `rim` strength (0..1), gated on `rim_enabled`. */
  rim: number;
  /** Godot `rim_tint` (0..1, blend light↔albedo), gated on `rim_enabled`. */
  rimTint: number;
  /**
   * Godot `heightmap_scale` (depth of the parallax/height effect; NOT clamped
   * to 0..1 — it is a scale factor, can exceed 1 or go negative to invert).
   * 0 when `heightmap_enabled` is off. Mapped to three.js `displacementScale`.
   */
  heightmapScale: number;
  /**
   * Godot `billboard_mode` (BaseMaterial3D.BillboardMode): 0 DISABLED (default),
   * 1 ENABLED (full billboard — the surface faces the camera), 2 FIXED_Y
   * (Y-locked, only yaw turns), 3 PARTICLES (flipbook; treated as ENABLED). The
   * mesh consumer feeds this straight to `useBillboard` — the same hook and
   * enum Label3D/Sprite3D drive — so a material that billboards turns its mesh
   * to face the camera. 0/undefined is a no-op (the overwhelming common case).
   */
  billboardMode: number;
  /**
   * Godot `billboard_keep_scale`. Godot's default (false) normalizes the model
   * scale away while billboarding; `useBillboard` only rewrites rotation, so our
   * billboard always preserves the authored scale (equivalent to keep_scale =
   * true). Parsed for completeness.
   */
  billboardKeepScale: boolean;
  /** Godot `anisotropy` magnitude (0..1), gated on `anisotropy_enabled`. */
  anisotropy: number;
  /** Godot `anisotropy` direction: 0 when positive, π/2 when negative. */
  anisotropyRotation: number;
  /** three.js `MeshPhysicalMaterial.transmission` — 1 when refraction enabled, 0 otherwise. */
  transmission: number;
  /** three.js `MeshPhysicalMaterial.thickness` — derived from `refraction_scale`, clamped ≥ 0. */
  refractionThickness: number;
}

const DEFAULT_SCALARS: StandardMaterial3DScalars = {
  color: [1, 1, 1],
  opacity: 1,
  metalness: 0,
  roughness: 1,
  emissive: [0, 0, 0],
  emissiveIntensity: 1,
  emissionOperator: 0,
  uv1Scale: { x: 1, y: 1 },
  uv1Offset: { x: 0, y: 0 },
  transparent: false,
  alphaTest: 0,
  depthWrite: true,
  shadingMode: 'per_pixel',
  useVertexColors: false,
  aoEnabled: false,
  blending: THREE.NormalBlending,
  side: THREE.FrontSide,
  cullModeExplicit: false,
  normalScale: { x: 1, y: 1 },
  triplanar: false,
  clearcoat: 0,
  clearcoatRoughness: 0,
  rim: 0,
  rimTint: 0,
  heightmapScale: 0,
  billboardMode: 0,
  billboardKeepScale: false,
  anisotropy: 0,
  anisotropyRotation: 0,
  transmission: 0,
  refractionThickness: 0,
};

export function parseStandardMaterial3DScalars(
  properties: Record<string, string>
): StandardMaterial3DScalars {
  const albedo = properties['albedo_color']
    ? safeParseColor(properties['albedo_color'])
    : undefined;
  const metallic = numericOr(properties['metallic'], DEFAULT_SCALARS.metalness);
  const roughness = numericOr(properties['roughness'], DEFAULT_SCALARS.roughness);

  const emissionEnabled = properties['emission_enabled'] === 'true';
  const emissionColor = properties['emission']
    ? safeParseColor(properties['emission'])
    : undefined;
  const emissionEnergy = numericOr(
    properties['emission_energy_multiplier'],
    DEFAULT_SCALARS.emissiveIntensity
  );
  const emissionOperator = Math.trunc(
    numericOr(properties['emission_operator'], DEFAULT_SCALARS.emissionOperator)
  );

  const uv1Scale = parseVec2Components(properties['uv1_scale']) ?? DEFAULT_SCALARS.uv1Scale;
  const uv1Offset = parseVec2Components(properties['uv1_offset']) ?? DEFAULT_SCALARS.uv1Offset;

  const opacity = albedo ? clamp01(albedo.a) : DEFAULT_SCALARS.opacity;
  // Godot Transparency: 0 DISABLED, 1 ALPHA, 2 ALPHA_SCISSOR, 3 ALPHA_HASH, 4 DEPTH_PRE_PASS.
  // Only the blended modes use three.js's transparent pipeline; ALPHA_SCISSOR is a hard
  // cutout (alphaTest) on the OPAQUE pipeline (depth-writing). albedo alpha < 1 alone, with
  // transparency DISABLED, renders opaque in Godot — so it must NOT force transparency here.
  const transparencyMode = parseTransparencyMode(properties['transparency']);
  const transparent =
    transparencyMode === 1 || transparencyMode === 3 || transparencyMode === 4;
  const alphaTest =
    transparencyMode === 2 ? numericOr(properties['alpha_scissor_threshold'], 0.5) : 0;
  const depthWrite = transparencyMode !== 1; // only ALPHA blending disables depth writes
  const shadingMode = properties['shading_mode'] === '0' ? 'unshaded' : 'per_pixel';
  const blending = parseBlendMode(properties['blend_mode']);
  const side = parseCullMode(properties['cull_mode']);
  const cullModeExplicit = properties['cull_mode'] !== undefined;

  const normalScaleScalar = numericOr(properties['normal_scale'], 1);
  const normalScale = { x: normalScaleScalar, y: normalScaleScalar };

  const triplanar =
    properties['uv1_triplanar'] === 'true' || properties['uv1_world_triplanar'] === 'true';

  const clearcoatEnabled = properties['clearcoat_enabled'] === 'true';
  // Godot's BaseMaterial3D `clearcoat` defaults to 1.0 (not 0). Because .tscn
  // omits default-valued properties, `clearcoat_enabled` on with `clearcoat`
  // absent is the COMMON input and must resolve to a full-strength coat — NOT
  // DEFAULT_SCALARS.clearcoat, which is our flag-OFF (three.js off-state) constant.
  const clearcoat = clearcoatEnabled
    ? clamp01(numericOr(properties['clearcoat'], 1))
    : 0;
  const clearcoatRoughness = clearcoatEnabled
    ? clamp01(numericOr(properties['clearcoat_roughness'], 0.5))
    : 0;

  // Godot rim (FEATURE_RIM) enabled-but-unset defaults: rim 1.0 / rim_tint 0.5
  // (docs.godotengine.org). Gated on rim_enabled, clamped to 0..1.
  const rimEnabled = properties['rim_enabled'] === 'true';
  const rim = rimEnabled ? clamp01(numericOr(properties['rim'], 1)) : 0;
  const rimTint = rimEnabled ? clamp01(numericOr(properties['rim_tint'], 0.5)) : 0;

  // Godot heightmap (FEATURE_HEIGHT_MAPPING). heightmap_scale defaults to 5.0
  // when enabled (docs.godotengine.org) and is NOT clamped to 0..1 — it is a
  // depth scale that can exceed 1 or go negative. 0 when disabled.
  const heightmapEnabled = properties['heightmap_enabled'] === 'true';
  const heightmapScale = heightmapEnabled ? numericOr(properties['heightmap_scale'], 5.0) : 0;

  // Godot `billboard_mode` — the whole enum passes straight through to
  // `useBillboard` (0 no-op, 2 fixed-Y, everything else = face camera), so
  // PARTICLES (3) needs no special-casing here. Absent → 0 (DISABLED).
  const billboardMode = Math.trunc(numericOr(properties['billboard_mode'], 0));
  const billboardKeepScale = properties['billboard_keep_scale'] === 'true';

  const anisotropyEnabled = properties['anisotropy_enabled'] === 'true';
  const rawAniso = numericOr(properties['anisotropy'], 0);
  const anisotropy = anisotropyEnabled ? clamp01(Math.abs(rawAniso)) : 0;
  const anisotropyRotation = anisotropyEnabled && rawAniso < 0 ? Math.PI / 2 : 0;

  // Godot refraction (FEATURE_REFRACTION): screen-space distortion mapped to
  // three.js volumetric transmission. refraction_scale defaults to 0.05 in
  // Godot docs; clamped ≥ 0 (negative thickness is physically invalid).
  const refractionEnabled = properties['refraction_enabled'] === 'true';
  const refractionThickness = refractionEnabled
    ? Math.max(0, numericOr(properties['refraction_scale'], 0.05))
    : 0;
  const transmission = refractionEnabled ? 1 : 0;

  // Godot encodes colors in sRGB. three.js's `<meshStandardMaterial color={...}>`
  // prop treats incoming values as **linear** RGB. Without converting,
  // mid-tone reds like `Color(0.545, 0.117, 0.117, 1)` (dark red `#8B1E1E`
  // in Godot) render as bright saturated pink because the renderer's
  // sRGB output transform re-applies the gamma curve on the already-
  // sRGB values. Convert at parse time so every downstream consumer
  // sees linear-space RGB.
  const linearAlbedo = albedo ? sRGBToLinearRGB(albedo.r, albedo.g, albedo.b) : null;
  const emission = emissionScalars(emissionColor, emissionEnergy, emissionEnabled);

  const useVertexColors = properties['vertex_color_use_as_albedo'] === 'true';
  const aoEnabled = properties['ao_enabled'] === 'true';

  return {
    color: linearAlbedo
      ? [clamp01(linearAlbedo[0]), clamp01(linearAlbedo[1]), clamp01(linearAlbedo[2])]
      : DEFAULT_SCALARS.color,
    opacity,
    metalness: clamp01(metallic),
    roughness: clamp01(roughness),
    emissive: emission.emissive,
    emissiveIntensity: emission.emissiveIntensity,
    emissionOperator,
    uv1Scale,
    uv1Offset,
    transparent,
    alphaTest,
    depthWrite,
    shadingMode,
    useVertexColors,
    aoEnabled,
    blending,
    side,
    cullModeExplicit,
    normalScale,
    triplanar,
    clearcoat,
    clearcoatRoughness,
    rim,
    rimTint,
    heightmapScale,
    billboardMode,
    billboardKeepScale,
    anisotropy,
    anisotropyRotation,
    transmission,
    refractionThickness,
  };
}

/** Godot Transparency enum value: 0 DISABLED, 1 ALPHA, 2 ALPHA_SCISSOR, 3 ALPHA_HASH, 4 DEPTH_PRE_PASS. */
function parseTransparencyMode(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Godot BaseMaterial3D blend modes (0..4) → three.js blending constants.
 * - 0 MIX        → NormalBlending
 * - 1 ADD        → AdditiveBlending
 * - 2 SUB        → SubtractiveBlending
 * - 3 MUL        → MultiplyBlending
 * - 4 PREMULT_ALPHA → CustomBlending in Godot; we approximate with NormalBlending.
 */
function parseBlendMode(raw: string | undefined): THREE.Blending {
  if (raw === undefined) return THREE.NormalBlending;
  switch (raw.trim()) {
    case '1':
      return THREE.AdditiveBlending;
    case '2':
      return THREE.SubtractiveBlending;
    case '3':
      return THREE.MultiplyBlending;
    default:
      return THREE.NormalBlending;
  }
}

/**
 * Godot cull modes: 0=BACK, 1=FRONT, 2=DISABLED (double-sided).
 * Maps to three.js FrontSide / BackSide / DoubleSide accordingly.
 *
 * Note: Godot's BACK means cull back faces → render FrontSide in three.js.
 */
function parseCullMode(raw: string | undefined): THREE.Side {
  if (raw === undefined) return THREE.FrontSide;
  switch (raw.trim()) {
    case '1':
      return THREE.BackSide;
    case '2':
      return THREE.DoubleSide;
    default:
      return THREE.FrontSide;
  }
}

function safeParseColor(
  value: string
): { r: number; g: number; b: number; a: number } | undefined {
  try {
    return parseColor(value);
  } catch {
    return undefined;
  }
}

/**
 * Parses Godot's `Vector3(x, y, z)` form and returns only the first two
 * axes — UV transforms ignore z. Returns undefined on any parse error so
 * the caller can apply a default.
 */
function parseVec2Components(
  raw: string | undefined
): { x: number; y: number } | undefined {
  if (!raw) return undefined;
  const match = raw.match(
    /^Vector3\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*[-\d.eE+]+\s*\)$/
  );
  if (!match || !match[1] || !match[2]) return undefined;
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  if (Number.isNaN(x) || Number.isNaN(y)) return undefined;
  return { x, y };
}

function numericOr(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
