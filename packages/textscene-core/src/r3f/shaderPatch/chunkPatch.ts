/**
 * How this repository patches three's shader text: a pure function of the chunks' text, one
 * installer that writes its result into `THREE.ShaderChunk` once, for every program compiled after
 * the call, and the helper that splices a program's own text at compile.
 */

import * as THREE from 'three';
import { warn } from '../../logger.js';

type ChunkName = keyof typeof THREE.ShaderChunk;

/** The text of each named chunk. */
export type Chunks<Name extends ChunkName> = Record<Name, string>;

type ProgramName = keyof typeof THREE.ShaderLib;

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
 * once. A replacement by slicing, not a string `replace`: a `$` in GLSL stays literal.
 */
function applyEdit(text: string, { three, godot }: TextEdit): string | null {
  const at = text.indexOf(three);
  if (at < 0 || text.indexOf(three, at + three.length) >= 0) return null;
  return text.slice(0, at) + godot + text.slice(at + three.length);
}

/** The text with every edit applied in order, up to the first edit whose text is missing. */
function applyEditsUntilMissing(
  text: string,
  edits: readonly TextEdit[]
): { text: string; missing: TextEdit | null } {
  let edited = text;
  for (const edit of edits) {
    const next = applyEdit(edited, edit);
    if (next === null) return { text: edited, missing: edit };
    edited = next;
  }
  return { text: edited, missing: null };
}

/** The text with every edit applied in order, or null when one is missing, as `applyEdit`. */
export function applyEdits(text: string, edits: readonly TextEdit[]): string | null {
  const { text: edited, missing } = applyEditsUntilMissing(text, edits);
  return missing === null ? edited : null;
}

/**
 * `text` of the shader named `shader` with every edit applied in order. It throws when an edit's
 * text is missing or occurs more than once, so a three that moved the text fails loudly, not with a
 * silently unpatched program. Every splice of a program's text goes through this, `editedProgram` or `rewrittenShader`.
 */
export function editedShader(text: string, edits: readonly TextEdit[], shader: string): string {
  const { text: edited, missing } = applyEditsUntilMissing(text, edits);
  if (missing !== null)
    throw new Error(`expected ${shader} to hold "${missing.three}" once, got:\n${edited}`);
  return edited;
}

/** The two stages of a program, as three hands them to `onBeforeCompile`. */
interface ProgramStages {
  vertexShader: string;
  fragmentShader: string;
}

/**
 * Applies the edits of each stage to `program`, as `editedShader`, and names the stage and `patch`
 * in the error. A stage with no list keeps its text.
 */
export function editedProgram(
  program: ProgramStages,
  edits: { vertex?: readonly TextEdit[]; fragment?: readonly TextEdit[] },
  patch: string
): void {
  if (edits.vertex) {
    program.vertexShader = editedShader(
      program.vertexShader,
      edits.vertex,
      `the vertex shader of the ${patch}`
    );
  }
  if (edits.fragment) {
    program.fragmentShader = editedShader(
      program.fragmentShader,
      edits.fragment,
      `the fragment shader of the ${patch}`
    );
  }
}

/**
 * `text` with every match of `pattern` rewritten, and with no match left as it is. It serves a rule
 * about a family of lines, not an anchor three must hold once, so a program without a match is no error.
 */
export function rewrittenShader(
  text: string,
  pattern: RegExp,
  rewrite: (match: string, group: string) => string
): string {
  return text.replace(pattern, rewrite);
}

/**
 * three's chunk `name` as it stands now, the patches installed so far included, with `edit` applied,
 * as `editedShader`.
 */
export function editedChunk(name: ChunkName, edit: TextEdit): string {
  return editedShader(THREE.ShaderChunk[name], [edit], `three's ${name}`);
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

/** A patch made of chunk edits, as `installChunkEdits` installs it. */
export interface ChunkEditsPatch<Name extends ChunkName> {
  edits: readonly ChunkEdit<Name>[];
  /** The text that proves the patch installed. An edit writes it, and that edit's chunk is checked. */
  mark: string;
  /** The patch's name in the warning, before "patch". */
  patch: string;
  /** Text added at the end of a chunk after the edits, for a block that no three line anchors. */
  append?: Partial<Record<Name, string>>;
  fragmentShaders?: ChunkPatch<Name>['fragmentShaders'];
  requires?: ChunkPatch<Name>['requires'];
}

/** The items as an English list that ends with "or". */
function alternatives(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;
}

/** The chunk whose edit writes the mark, which an installed patch holds. */
function markedChunk<Name extends ChunkName>({ edits, mark, patch }: ChunkEditsPatch<Name>): Name {
  const marked = edits.find((edit) => edit.godot.includes(mark));
  if (!marked)
    throw new Error(`expected an edit of the ${patch} patch to write its mark "${mark}", got none`);
  return marked.chunk;
}

/** The chunks with every edit applied and each appended text added, or null as `applyChunkEdits`. */
function appliedEdits<Name extends ChunkName>(
  chunks: Chunks<Name>,
  { edits, append = {} }: ChunkEditsPatch<Name>
): Chunks<Name> | null {
  const patched = applyChunkEdits(chunks, edits);
  if (patched === null) return null;
  for (const [name, text] of Object.entries(append) as [Name, string][]) patched[name] += text;
  return patched;
}

/**
 * `installChunkPatch` for a patch of chunk edits. The chunk names, the check and the warning come
 * from the edits.
 */
export function installChunkEdits<Name extends ChunkName>(patch: ChunkEditsPatch<Name>): boolean {
  const edited = [...new Set(patch.edits.map((edit) => edit.chunk))];
  const appended = Object.keys(patch.append ?? {}) as Name[];
  const marked = markedChunk(patch);
  const programs = Object.keys(patch.fragmentShaders ?? {}).map((name) => `${name} fragment shader`);
  return installChunkPatch({
    names: [...new Set([...edited, ...appended])],
    isApplied: (chunks) => chunks[marked].includes(patch.mark),
    apply: (chunks) => appliedEdits(chunks, patch),
    fragmentShaders: patch.fragmentShaders,
    missing: `${alternatives([...edited, ...programs])} lacks a line the ${patch.patch} patch replaces`,
    requires: patch.requires,
  });
}
