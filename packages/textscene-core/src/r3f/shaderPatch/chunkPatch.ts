/**
 * How this repository patches three's shader chunks: a pure function of the chunks' text, and one
 * installer that writes its result into `THREE.ShaderChunk` once, for every program compiled after
 * the call.
 */

import * as THREE from 'three';
import { warn } from '../../logger.js';

export type ChunkName = keyof typeof THREE.ShaderChunk;

/** The text of each named chunk. */
export type Chunks<Name extends ChunkName> = Record<Name, string>;

/** One replacement: the chunk, three's text in it, and the text that takes its place. */
export interface ChunkEdit<Name extends ChunkName> {
  chunk: Name;
  three: string;
  godot: string;
}

/**
 * The chunks with every edit applied in order, or null when an edit's text is missing from its
 * chunk or occurs more than once. A replacement function, not a string: a `$` in GLSL stays literal.
 */
export function applyChunkEdits<Name extends ChunkName>(
  chunks: Chunks<Name>,
  edits: readonly ChunkEdit<Name>[]
): Chunks<Name> | null {
  const patched = { ...chunks };
  for (const { chunk, three, godot } of edits) {
    if (patched[chunk].split(three).length !== 2) return null;
    patched[chunk] = patched[chunk].replace(three, () => godot);
  }
  return patched;
}

/** A patch of the chunks it names, as `installChunkPatch` installs it. */
export interface ChunkPatch<Name extends ChunkName> {
  names: readonly Name[];
  /** Whether the chunks already hold the patch, as after an earlier call. */
  isApplied(chunks: Chunks<Name>): boolean;
  /** The patched chunks, or null when three's chunks lack a text the patch replaces. */
  apply(chunks: Chunks<Name>): Chunks<Name> | null;
  /** What three lacks when `apply` is null, after "three's". */
  missing: string;
}

/** The record form of a patch of one chunk's text. */
export function onChunk<Name extends ChunkName>(
  name: Name,
  patch: (chunk: string) => string | null
): (chunks: Chunks<Name>) => Chunks<Name> | null {
  return (chunks) => {
    const patched = patch(chunks[name]);
    return patched === null ? null : ({ [name]: patched } as Chunks<Name>);
  };
}

/**
 * Patches three's chunks, and is true when they hold the patch after the call. A three release that
 * lacks a replaced text keeps all its own chunks, and the call warns and is false. A second call
 * changes nothing.
 */
export function installChunkPatch<Name extends ChunkName>(patch: ChunkPatch<Name>): boolean {
  const current = Object.fromEntries(
    patch.names.map((name) => [name, THREE.ShaderChunk[name]])
  ) as Chunks<Name>;
  if (patch.isApplied(current)) return true;
  const patched = patch.apply(current);
  if (patched === null) {
    warn(`[Shading] three's ${patch.missing}`);
    return false;
  }
  Object.assign(THREE.ShaderChunk, patched);
  return true;
}
