/**
 * Synchronous extraction of StandardMaterial3D scalar properties.
 *
 * Pulls out the color/metallic/roughness/opacity values that R3F can apply
 * declaratively without async resource loading. Textures are deferred to
 * useResource (handled by the caller).
 */

import { parseColor } from '../../../utils/colorParser';

export interface StandardMaterial3DScalars {
  color: [number, number, number];
  opacity: number;
  metalness: number;
  roughness: number;
}

const DEFAULT_SCALARS: StandardMaterial3DScalars = {
  color: [1, 1, 1],
  opacity: 1,
  metalness: 0,
  roughness: 1,
};

export function parseStandardMaterial3DScalars(
  properties: Record<string, string>
): StandardMaterial3DScalars {
  const albedo = properties['albedo_color'] ? parseColor(properties['albedo_color']) : undefined;
  const metallic = numericOr(properties['metallic'], DEFAULT_SCALARS.metalness);
  const roughness = numericOr(properties['roughness'], DEFAULT_SCALARS.roughness);

  return {
    color: albedo
      ? [clamp01(albedo.r), clamp01(albedo.g), clamp01(albedo.b)]
      : DEFAULT_SCALARS.color,
    opacity: albedo ? clamp01(albedo.a) : DEFAULT_SCALARS.opacity,
    metalness: clamp01(metallic),
    roughness: clamp01(roughness),
  };
}

function numericOr(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
