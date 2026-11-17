import { octahedronEncode, octahedronTangentEncode } from '../math/octahedron.js';
import { normalizedVector3, vector3Cross } from '../math/vector.js';

const UNORM16_MAX = 65535;

/** `(uint16_t)CLAMP(value * 65535, 0, 65535)`: the cast truncates. */
const unorm16 = (value: number) =>
  Math.trunc(Math.min(Math.max(Math.fround(value * UNORM16_MAX), 0), UNORM16_MAX));

/** An uncompressed surface's normal and tangent octahedron lanes (`rendering_server.cpp:600-700`). */
export function encodedNormalTangent(
  normal: readonly number[],
  tangent: readonly number[] = madeUpTangent(normal)
): [number, number, number, number] {
  const [normalX, normalY] = octahedronEncode(normal).map(unorm16) as [number, number];
  let [tangentX, tangentY] = octahedronTangentEncode(tangent, tangent[3]!).map(unorm16) as [number, number];
  // (1, 1) and (0, 1) decode alike, and Godot reads (0, 1) as a compressed surface's lanes.
  if (tangentX === 0 && tangentY === UNORM16_MAX) tangentX = UNORM16_MAX;
  return [normalX, normalY, tangentX, tangentY];
}

/** Godot's tangent for a surface of normals and no tangents: any one at right angles to the normal. */
function madeUpTangent([x, y, z]: readonly number[]): number[] {
  const unit = normalizedVector3(x!, y!, z!);
  const across = vector3Cross([z!, -x!, y!], unit);
  return [...normalizedVector3(...across), 1];
}
