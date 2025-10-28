export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export function parseVector2(value: string): Vector2 {
  const match = value.match(/^Vector2\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid Vector2 format: ${value}`);
  }

  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
  };
}

export function parseVector3(value: string): Vector3 {
  const match = value.match(/^Vector3\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);

  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid Vector3 format: ${value}`);
  }

  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
    z: parseFloat(match[3]),
  };
}
