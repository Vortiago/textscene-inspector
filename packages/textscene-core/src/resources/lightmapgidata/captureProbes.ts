/**
 * The capture probes of a LightmapGIData's `probe_data`, and the edges between them that Godot's
 * LightmapGI editor gizmo draws.
 */

import { int32Elements } from '../../godot/variant/packedInt32';
import { dictPackedField, packedFloatCount } from '../../godot/variant/packedArrayFields';
import { packedArrayBody, packedArrayForms } from '../../godot/variant/variantParser';
import { parsePackedColorArray, parsePackedVector3Array } from '../shapes/packedArray';
import { missingProbeDataField } from './probeData';

/** The components of a Vector3 point, and of a colour. */
const POINT_FLOATS = 3;
const COLOUR_FLOATS = 4;

/** The spherical harmonics colours a probe stores (`lightmap_gi_gizmo_plugin.cpp:97-100`). */
const SH_COLOURS_PER_POINT = 9;

/** `_set_probe_data` takes `tetrahedra` four indices at a time and `bsp` six (`lightmap_gi.cpp:283-286`). */
const TETRAHEDRON_INDICES = 4;
const BSP_NODE_INTS = 6;

const TETRAHEDRON_PAIRS = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
] as const;

const readPoints = dictPackedField('points', 'PackedVector3Array');
const readTetrahedra = dictPackedField('tetrahedra', 'PackedInt32Array');
const readBsp = dictPackedField('bsp', 'PackedInt32Array');
const readSh = dictPackedField('sh', 'PackedColorArray');
const INT32_FORMS = packedArrayForms('PackedInt32Array');
const POINT_FORMS = packedArrayForms('PackedVector3Array');
const COLOUR_FORMS = packedArrayForms('PackedColorArray');

export interface CaptureProbes {
  /** Flat `xyz` of each capture point, in the LightmapGI's local space. */
  points: Float32Array;
  /** Four point indices per tetrahedron. */
  tetrahedra: readonly number[];
  /** Flat `rgba` of the nine spherical harmonics colours of each point, in point order. */
  sh: Float32Array;
}

/**
 * How many capture points `set_capture_data` accepts from `probe_data` (`lightmap_gi.cpp:222-242`,
 * `:275-288`), counted without reading them, or null when it refuses the data: a missing key, `sh`
 * that is not nine colours per point, or a `tetrahedra` or `bsp` that is not whole groups.
 */
export function acceptedPointCount(probeData: string): number | null {
  if (missingProbeDataField(probeData) !== null) return null;
  const pointCount = elementCount(readPoints(probeData), POINT_FORMS, POINT_FLOATS);
  const shColours = elementCount(readSh(probeData), COLOUR_FORMS, COLOUR_FLOATS);
  const tetrahedraInts = elementCount(readTetrahedra(probeData), INT32_FORMS, 1);
  const bspInts = elementCount(readBsp(probeData), INT32_FORMS, 1);
  if (pointCount === null || shColours === null || tetrahedraInts === null || bspInts === null) return null;
  const isWhole =
    shColours === pointCount * SH_COLOURS_PER_POINT &&
    tetrahedraInts % TETRAHEDRON_INDICES === 0 &&
    bspInts % BSP_NODE_INTS === 0;
  return isWhole ? pointCount : null;
}

/** The elements of a packed field's value, null for a field the dictionary lacks. */
function elementCount(value: string | null, forms: readonly RegExp[], groupSize: number): number | null {
  return value === null ? null : packedFloatCount(forms, value, groupSize) / groupSize;
}

/** The probes `set_capture_data` keeps, or null when Godot keeps none: refused data or no points. */
export function readCaptureProbes(probeData: string | undefined): CaptureProbes | null {
  if (probeData === undefined || !acceptedPointCount(probeData)) return null;
  const points = flatPoints(readPoints(probeData));
  const tetrahedra = int32Field(readTetrahedra(probeData));
  const sh = flatColours(readSh(probeData));
  return points === null || tetrahedra === null || sh === null ? null : { points, tetrahedra, sh };
}

function flatPoints(value: string | null): Float32Array | null {
  return flatFloats(value, parsePackedVector3Array);
}

function flatColours(value: string | null): Float32Array | null {
  return flatFloats(value, parsePackedColorArray);
}

function flatFloats(value: string | null, parse: (value: string) => Float32Array): Float32Array | null {
  if (value === null) return null;
  try {
    return parse(value);
  } catch {
    // An array the tokenizer cannot read fails Godot's load, so the data has no probes.
    return null;
  }
}

function int32Field(value: string | null): number[] | null {
  const matched = value === null ? null : packedArrayBody(INT32_FORMS, value);
  return matched === null ? null : int32Elements(matched.body);
}

/**
 * Flat `xyz` segment ends, one segment for each unique edge of the tetrahedra, in order of first
 * appearance, low point index first (`lightmap_gi_gizmo_plugin.cpp:102-124`). A pair with an index
 * outside the points adds no segment: Godot fails its index check there.
 */
export function probeEdgeSegments({
  points,
  tetrahedra,
}: Pick<CaptureProbes, 'points' | 'tetrahedra'>): Float32Array {
  const pointCount = points.length / POINT_FLOATS;
  const seen = new Set<number>();
  const maxSegments = (tetrahedra.length / TETRAHEDRON_INDICES) * TETRAHEDRON_PAIRS.length;
  const segments = new Float32Array(maxSegments * 2 * POINT_FLOATS);
  let written = 0;
  const writePoint = (index: number) => {
    segments.set(points.subarray(index * POINT_FLOATS, (index + 1) * POINT_FLOATS), written);
    written += POINT_FLOATS;
  };
  for (let start = 0; start < tetrahedra.length; start += TETRAHEDRON_INDICES) {
    for (const [first, second] of TETRAHEDRON_PAIRS) {
      const a = tetrahedra[start + first]!;
      const b = tetrahedra[start + second]!;
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      const key = low * pointCount + high;
      if (seen.has(key) || low < 0 || high >= pointCount) continue;
      seen.add(key);
      writePoint(low);
      writePoint(high);
    }
  }
  return segments.slice(0, written);
}
