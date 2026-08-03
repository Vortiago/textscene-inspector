/**
 * Field readers for one `_surfaces` entry, which Godot writes as a flat dict.
 *
 * Base64 payloads use the `A–Za–z0–9+/=` alphabet and the other values use `()`
 * (AABB/Vector4/ExtResource), so no braces appear inside a surface — a
 * non-greedy brace match isolates each surface reliably.
 */

import { warn } from '../../../logger.js';

/** A surface's declared `AABB(px, py, pz, sx, sy, sz)` — a compressed surface's position scale. */
export interface SurfaceAabb {
  position: [number, number, number];
  size: [number, number, number];
}

export function* iterateSurfaceBlocks(surfacesRaw: string): Generator<string> {
  const re = /\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(surfacesRaw)) !== null) {
    yield match[1]!;
  }
}

export function readInt(block: string, key: string): number {
  const match = new RegExp(`"${key}"\\s*:\\s*(-?\\d+)`).exec(block);
  return match ? Number(match[1]) : 0;
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
  const values = match[1]!.split(',').map((v) => Number(v.trim()));
  if (values.length < count || values.some((v) => !Number.isFinite(v))) return undefined;
  return values;
}

export function readAabb(block: string): SurfaceAabb | undefined {
  const n = readFloatTuple(block, 'aabb', 'AABB', 6);
  if (!n) return undefined;
  return { position: [n[0]!, n[1]!, n[2]!], size: [n[3]!, n[4]!, n[5]!] };
}

export function readUvScale(block: string): [number, number] | undefined {
  // Only x and y are consulted; z/w scale UV2, which nothing decodes yet.
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
 * A corrupt payload makes `atob` throw, which would fail the whole mesh; an
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
