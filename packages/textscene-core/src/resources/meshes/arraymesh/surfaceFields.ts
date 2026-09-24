/**
 * Field readers for one `_surfaces` entry, which Godot writes as a flat dict.
 *
 * Base64 payloads use the `A–Za–z0–9+/=` alphabet and the other values use `()`
 * (AABB/Vector4/ExtResource), so no braces appear inside a surface, and a
 * non-greedy brace match isolates each surface.
 */

import { warn } from '../../../logger.js';
import { parseGodotFloat } from '../../../godot/number.js';
import { dictNumberField } from '../../../godot/variantParser.js';
import { parseGodotInt } from '../../../godot/int.js';

/** A surface's declared `AABB(px, py, pz, sx, sy, sz)`: a compressed surface's position scale. */
export interface SurfaceAabb {
  position: [number, number, number];
  size: [number, number, number];
}

/**
 * The `{…}` surface dicts, braces included: the field readers run to a `,`/`}`
 * delimiter, so a brace-stripped body leaves the last key with no terminator.
 */
export function* iterateSurfaceBlocks(surfacesRaw: string): Generator<string> {
  const re = /\{[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(surfacesRaw)) !== null) {
    yield match[0];
  }
}

export function readInt(block: string, key: string): number {
  const match = dictNumberField(key).exec(block);
  if (!match) return 0;
  // Read at int64, the Variant's own width: `format` is a
  // `BitField<Mesh::ArrayFormat>` (mesh.cpp:244), and a compressed surface's
  // value runs past 2^32, so int32 zeroes the whole attribute layout. The
  // counts beside it are `int` and sit far inside that band.
  const stored = parseGodotInt(match[1]!, 'int64');
  return stored === null || Number.isNaN(stored) ? 0 : stored;
}

/**
 * Read a `"<key>": <Type>(a, b, …)` field as at least `count` finite floats.
 * Undefined when absent, short or unparseable, so the surface degrades rather
 * than decoding against a partly-read scale.
 */
function readFloatTuple(
  block: string,
  key: string,
  type: string,
  count: number
): number[] | undefined {
  const match = new RegExp(`"${key}"\\s*:\\s*${type}\\(([^)]*)\\)`).exec(block);
  if (!match) return undefined;
  // `parseGodotFloat`, not `Number`: the latter reads `0x10` as 16 and an empty
  // component as 0, neither of which Godot's tokenizer accepts, so a malformed
  // scale decoded as a plausible one instead of degrading.
  const values = match[1]!.split(',').map((v) => parseGodotFloat(v));
  if (values.length < count || values.some((v) => v === null || !Number.isFinite(v))) {
    return undefined;
  }
  return values as number[];
}

export function readAabb(block: string): SurfaceAabb | undefined {
  const n = readFloatTuple(block, 'aabb', 'AABB', 6);
  if (!n) return undefined;
  return { position: [n[0]!, n[1]!, n[2]!], size: [n[3]!, n[4]!, n[5]!] };
}

export function readUvScale(block: string): [number, number] | undefined {
  // Only x and y are consulted. z/w scale UV2, which nothing decodes.
  const n = readFloatTuple(block, 'uv_scale', 'Vector4', 4);
  return n ? [n[0]!, n[1]!] : undefined;
}

export function readName(block: string): string | undefined {
  const match = /"name"\s*:\s*"([^"]*)"/.exec(block);
  return match?.[1];
}

/** A surface's raw `"material"` value, whichever reference form it holds. */
export function readMaterialRef(block: string): string | undefined {
  return /"material"\s*:\s*([^,\n}]+)/.exec(block)?.[1]?.trim();
}

/**
 * Extract the base64 payload of a `"<key>": PackedByteArray("…")` field.
 * A corrupt payload makes `atob` throw, which would fail the whole mesh. An
 * empty buffer instead lets the caller drop just this surface.
 */
export function readPackedBytes(block: string, key: string): Uint8Array {
  const match = new RegExp(`"${key}"\\s*:\\s*PackedByteArray\\("([^"]*)"\\)`).exec(block);
  if (!match) return new Uint8Array(0);
  try {
    return Uint8Array.from(atob(match[1]!), (c) => c.charCodeAt(0));
  } catch {
    warn(`[ArrayMesh] ${key} is not valid base64 — ignoring the payload`);
    return new Uint8Array(0);
  }
}
