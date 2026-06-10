export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * One float component as Godot serializes it, including scientific
 * notation (`1e-05`), which Godot emits for small values. Strict by
 * construction: `1.2.3` or a lone `-` fail the whole anchored match,
 * so callers throw (and the value-decoder wrappers warn-then-fall-back)
 * instead of silently mis-parsing.
 */
export const FLOAT_PATTERN_SOURCE = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;

const F = FLOAT_PATTERN_SOURCE;
const VECTOR2_RE = new RegExp(String.raw`^Vector2\s*\(\s*(${F})\s*,\s*(${F})\s*\)$`);
const VECTOR3_RE = new RegExp(String.raw`^Vector3\s*\(\s*(${F})\s*,\s*(${F})\s*,\s*(${F})\s*\)$`);

export function parseVector2(value: string): Vector2 {
  const match = value.match(VECTOR2_RE);

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid Vector2 format: ${value}`);
  }

  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
  };
}

export function parseVector3(value: string): Vector3 {
  const match = value.match(VECTOR3_RE);

  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid Vector3 format: ${value}`);
  }

  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
    z: parseFloat(match[3]),
  };
}
