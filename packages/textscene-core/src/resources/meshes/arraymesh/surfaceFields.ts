/**
 * Field readers for one `_surfaces` entry, which Godot writes as a flat dict.
 *
 * Base64 payloads use the `A–Za–z0–9+/=` alphabet and the other values use `()`
 * (AABB/Vector4/ExtResource), so no braces appear inside a surface, and a
 * non-greedy brace match isolates each surface.
 */

import { warn } from '../../../logger.js';
import { parseGodotFloat } from '../../../godot/variant/number.js';
import { dictCallField, dictNumberField, dictStringField } from '../../../godot/variant/variantParser.js';
import { parseGodotInt } from '../../../godot/variant/int.js';
import { parsePackedByteArrayBody } from '../../../godot/variant/packedBytes.js';
import { unquoteString } from '../../../parser/utils.js';

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
function readFloatTuple(block: string, key: string, type: string, count: number): number[] | undefined {
  const body = dictCallField(key, type)(block);
  if (body === null) return undefined;
  // `parseGodotFloat`, not `Number`: the latter reads `0x10` as 16 and an empty
  // component as 0, neither of which Godot's tokenizer accepts, so a malformed
  // scale decoded as a plausible one instead of degrading.
  const values = body.split(',').map((v) => parseGodotFloat(v));
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

/** `uv_scale`: x and y re-expand a compressed UV1, z and w a compressed UV2. */
export function readUvScale(block: string): UvScale | undefined {
  const n = readFloatTuple(block, 'uv_scale', 'Vector4', 4);
  return n ? [n[0]!, n[1]!, n[2]!, n[3]!] : undefined;
}

/** A surface's `uv_scale` Vector4. */
export type UvScale = readonly [number, number, number, number];

const NAME_RE = dictStringField('name');

/**
 * A surface's `"name"`, its escapes decoded. Godot writes a String (`mesh.h:314`), and a
 * hand-written StringName converts to the same text.
 */
export function readName(block: string): string | undefined {
  const literal = NAME_RE.exec(block)?.[1];
  return literal === undefined ? undefined : unquoteString(literal);
}

/** A surface's raw `"material"` value, whichever reference form it holds. */
export function readMaterialRef(block: string): string | undefined {
  return /"material"\s*:\s*([^,\n}]+)/.exec(block)?.[1]?.trim();
}

/** Written only by `byteArrayField`. Never cleared: a mesh reads a fixed handful of keys. */
const BYTE_ARRAY_FIELDS = new Map<string, (text: string) => string | null>();

/** The `key` field's reader, built once per key rather than once per surface. */
function byteArrayField(key: string): (text: string) => string | null {
  let field = BYTE_ARRAY_FIELDS.get(key);
  if (!field) {
    field = dictCallField(key, 'PackedByteArray');
    BYTE_ARRAY_FIELDS.set(key, field);
  }
  return field;
}

/**
 * The bytes of a `"<key>": PackedByteArray(…)` field. A payload Godot cannot read gives an empty
 * buffer and a warning, so the caller drops just this surface rather than the whole mesh.
 */
export function readPackedBytes(block: string, key: string): Uint8Array {
  const body = byteArrayField(key)(block);
  if (body === null) return new Uint8Array(0);
  const bytes = parsePackedByteArrayBody(body);
  if (bytes) return bytes;
  warn(`[ArrayMesh] ${key} holds no readable PackedByteArray, so its payload is ignored`);
  return new Uint8Array(0);
}
