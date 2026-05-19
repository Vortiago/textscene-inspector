/**
 * Synchronous extraction of StandardMaterial3D scalar properties for R3F.
 *
 * Covers everything that doesn't require an async resource fetch:
 *   - albedo_color  (RGB + opacity)
 *   - metallic, roughness
 *   - emission_enabled, emission color, emission_energy_multiplier
 *   - uv1_scale, uv1_offset
 *
 * External textures (albedo / normal / roughness / metallic / emission)
 * are handled by `useResource` in the parent component.
 */

import { parseColor } from '../../../utils/colorParser';

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

  return {
    color: albedo
      ? [clamp01(albedo.r), clamp01(albedo.g), clamp01(albedo.b)]
      : DEFAULT_SCALARS.color,
    opacity: albedo ? clamp01(albedo.a) : DEFAULT_SCALARS.opacity,
    metalness: clamp01(metallic),
    roughness: clamp01(roughness),
    emissive:
      emissionEnabled && emissionColor
        ? rgbToHex(emissionColor.r, emissionColor.g, emissionColor.b)
        : 0x000000,
    emissiveIntensity: emissionEnabled ? Math.max(0, emissionEnergy) : 0,
    uv1Scale,
    uv1Offset,
  };
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
