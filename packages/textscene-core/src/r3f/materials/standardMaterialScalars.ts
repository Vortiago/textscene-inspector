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
 *
 * External textures (albedo / normal / roughness / metallic / emission)
 * are handled by `useResource` in the parent component. Shared by every
 * StandardMaterial3D-bearing node type (MeshInstance3D, CSGBox3D, …) via
 * `<StandardMaterialSlot>`.
 */

import * as THREE from 'three';
import { parseColor } from '../../utils/colorParser';

export interface StandardMaterial3DScalars {
  color: [number, number, number];
  opacity: number;
  metalness: number;
  roughness: number;
  /** Hex RGB; 0x000000 means "no emission". */
  emissive: number;
  emissiveIntensity: number;
  /** Per-axis tiling factor for every texture map applied by this material. */
  uv1Scale: { x: number; y: number };
  /** Per-axis offset for every texture map applied by this material. */
  uv1Offset: { x: number; y: number };
  /** True when albedo alpha < 1 OR Godot's `transparency` flag is non-zero. */
  transparent: boolean;
  /** three.js blending constant; defaults to NormalBlending. */
  blending: THREE.Blending;
  /** three.js side constant; defaults to FrontSide. */
  side: THREE.Side;
  /**
   * Whether `cull_mode` was explicitly set on the source material. Lets
   * downstream consumers apply a per-mesh-type default (see WI-HALL-6:
   * PlaneMesh-backed Canvas planes default to DoubleSide when the
   * source material didn't pick a side, to survive 90° flip transforms
   * that would otherwise back-cull the photo into invisibility).
   */
  cullModeExplicit: boolean;
  /** Uniform XY scale applied to the normal map (no-op without normalMap). */
  normalScale: { x: number; y: number };
  /**
   * Godot `uv1_triplanar` / `uv1_world_triplanar` (WI-HALL-5). We don't run a
   * triplanar shader; instead the consumer reproduces the tiling DENSITY for
   * planar meshes (repeat = mesh size × `uv1_scale`) via `triplanarPlaneScale`.
   * True when EITHER flag is set.
   */
  triplanar: boolean;
}

const DEFAULT_SCALARS: StandardMaterial3DScalars = {
  color: [1, 1, 1],
  opacity: 1,
  metalness: 0,
  roughness: 1,
  emissive: 0x000000,
  emissiveIntensity: 1,
  uv1Scale: { x: 1, y: 1 },
  uv1Offset: { x: 0, y: 0 },
  transparent: false,
  blending: THREE.NormalBlending,
  side: THREE.FrontSide,
  cullModeExplicit: false,
  normalScale: { x: 1, y: 1 },
  triplanar: false,
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

  const uv1Scale = parseVec2Components(properties['uv1_scale']) ?? DEFAULT_SCALARS.uv1Scale;
  const uv1Offset = parseVec2Components(properties['uv1_offset']) ?? DEFAULT_SCALARS.uv1Offset;

  const opacity = albedo ? clamp01(albedo.a) : DEFAULT_SCALARS.opacity;
  const transparencyFlag = parseTransparencyFlag(properties['transparency']);
  const blending = parseBlendMode(properties['blend_mode']);
  const side = parseCullMode(properties['cull_mode']);
  const cullModeExplicit = properties['cull_mode'] !== undefined;

  const normalScaleScalar = numericOr(properties['normal_scale'], 1);
  const normalScale = { x: normalScaleScalar, y: normalScaleScalar };

  const triplanar =
    properties['uv1_triplanar'] === 'true' || properties['uv1_world_triplanar'] === 'true';

  // WI-HALL-2: Godot encodes colors in sRGB. three.js's `<meshStandardMaterial color={...}>`
  // prop treats incoming values as **linear** RGB. Without converting,
  // mid-tone reds like `Color(0.545, 0.117, 0.117, 1)` (dark red `#8B1E1E`
  // in Godot) render as bright saturated pink because the renderer's
  // sRGB output transform re-applies the gamma curve on the already-
  // sRGB values. Convert at parse time so every downstream consumer
  // sees linear-space RGB.
  const linearAlbedo = albedo ? sRGBToLinearRGB(albedo.r, albedo.g, albedo.b) : null;
  const linearEmission = emissionColor
    ? sRGBToLinearRGB(emissionColor.r, emissionColor.g, emissionColor.b)
    : null;

  return {
    color: linearAlbedo
      ? [clamp01(linearAlbedo[0]), clamp01(linearAlbedo[1]), clamp01(linearAlbedo[2])]
      : DEFAULT_SCALARS.color,
    opacity,
    metalness: clamp01(metallic),
    roughness: clamp01(roughness),
    emissive:
      emissionEnabled && linearEmission
        ? rgbToHex(linearEmission[0], linearEmission[1], linearEmission[2])
        : 0x000000,
    emissiveIntensity: emissionEnabled ? Math.max(0, emissionEnergy) : 0,
    uv1Scale,
    uv1Offset,
    transparent: opacity < 1 || transparencyFlag,
    blending,
    side,
    cullModeExplicit,
    normalScale,
    triplanar,
  };
}

/**
 * Convert a single sRGB channel to its linear-space value.
 * Standard IEC 61966-2-1 inverse transfer function — same formula
 * `THREE.Color.convertSRGBToLinear` applies internally.
 */
function sRGBChannelToLinear(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

function sRGBToLinearRGB(r: number, g: number, b: number): [number, number, number] {
  return [sRGBChannelToLinear(r), sRGBChannelToLinear(g), sRGBChannelToLinear(b)];
}

/** Godot transparency enum: 0=DISABLED, anything non-zero engages transparency. */
function parseTransparencyFlag(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n !== 0;
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

function rgbToHex(r: number, g: number, b: number): number {
  const ri = Math.round(clamp01(r) * 255);
  const gi = Math.round(clamp01(g) * 255);
  const bi = Math.round(clamp01(b) * 255);
  return (ri << 16) | (gi << 8) | bi;
}
