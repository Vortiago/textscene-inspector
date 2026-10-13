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

export type ProgramName = keyof typeof THREE.ShaderLib;

/** One replacement: three's text, and the text that takes its place. */
export interface TextEdit {
  three: string;
  godot: string;
}

/** One replacement in a chunk. */
export interface ChunkEdit<Name extends ChunkName> extends TextEdit {
  chunk: Name;
}

/**
 * The text with the edit applied, or null when three's text is missing from it or occurs more than
 * once. A replacement function, not a string: a `$` in GLSL stays literal.
 */
function applyEdit(text: string, { three, godot }: TextEdit): string | null {
  if (text.split(three).length !== 2) return null;
  return text.replace(three, () => godot);
}

/** The text with every edit applied in order, or null when one is missing, as `applyEdit`. */
export function applyEdits(text: string, edits: readonly TextEdit[]): string | null {
  let patched: string | null = text;
  for (const edit of edits) {
    patched = applyEdit(patched, edit);
    if (patched === null) return null;
  }
  return patched;
}

/** The chunks with every edit applied in order, or null when one is missing, as `applyEdit`. */
export function applyChunkEdits<Name extends ChunkName>(
  chunks: Chunks<Name>,
  edits: readonly ChunkEdit<Name>[]
): Chunks<Name> | null {
  const patched = { ...chunks };
  for (const edit of edits) {
    const chunk = applyEdit(patched[edit.chunk], edit);
    if (chunk === null) return null;
    patched[edit.chunk] = chunk;
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
  /**
   * Edits to a program's own fragment shader in `THREE.ShaderLib`, for a line that no chunk holds.
   * They install with the chunks or not at all.
   */
  fragmentShaders?: Partial<Record<ProgramName, readonly TextEdit[]>>;
  /** What three lacks when an edit's text is missing, after "three's". */
  missing: string;
  /** The text of each patch this one reads, by the chunk that patch writes it into. */
  requires?: Partial<Record<ChunkName, string | readonly string[]>>;
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

/** The chunks that lack the text of a patch this one reads. */
function unmetRequirements(requires: Partial<Record<ChunkName, string | readonly string[]>>): ChunkName[] {
  return (Object.entries(requires) as [ChunkName, string | readonly string[]][])
    .filter(([name, texts]) => [texts].flat().some((text) => !THREE.ShaderChunk[name].includes(text)))
    .map(([name]) => name);
}

/** A program and its fragment shader with the patch's edits applied. */
interface PatchedProgram {
  program: THREE.ShaderLibShader;
  fragmentShader: string;
}

/** Each program with its edits applied, or null when a program or an edit's text is missing. */
function patchedPrograms(edits: Partial<Record<ProgramName, readonly TextEdit[]>>): PatchedProgram[] | null {
  const patched: PatchedProgram[] = [];
  for (const [name, programEdits] of Object.entries(edits) as [ProgramName, readonly TextEdit[]][]) {
    const program = THREE.ShaderLib[name];
    const fragmentShader = program ? applyEdits(program.fragmentShader, programEdits) : null;
    if (!program || fragmentShader === null) return null;
    patched.push({ program, fragmentShader });
  }
  return patched;
}

/**
 * Patches three's chunks and programs, and is true when they hold the patch after the call. A patch
 * whose required patches are missing, or a three release that lacks a replaced text, keeps all of
 * three's own text, and the call warns and is false. A second call changes nothing.
 */
export function installChunkPatch<Name extends ChunkName>(patch: ChunkPatch<Name>): boolean {
  const current = Object.fromEntries(
    patch.names.map((name) => [name, THREE.ShaderChunk[name]])
  ) as Chunks<Name>;
  if (patch.isApplied(current)) return true;
  const unmet = unmetRequirements(patch.requires ?? {});
  if (unmet.length > 0) {
    warn(
      `[Shading] the patch of ${patch.names.join(', ')} reads a patch missing from ${unmet.join(' and ')}`
    );
    return false;
  }
  const patched = patch.apply(current);
  const programs = patchedPrograms(patch.fragmentShaders ?? {});
  if (patched === null || programs === null) {
    warn(`[Shading] three's ${patch.missing}`);
    return false;
  }
  Object.assign(THREE.ShaderChunk, patched);
  for (const { program, fragmentShader } of programs) program.fragmentShader = fragmentShader;
  return true;
}
