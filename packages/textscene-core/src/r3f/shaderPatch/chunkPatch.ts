/**
 * How this repository patches three's shader text: edits that each replace one anchored text, one
 * installer that writes them into `THREE.ShaderChunk` once, for every program compiled after the
 * call, and the helpers that splice a program's own text at compile.
 */

import * as THREE from 'three';
import { warn } from '../../logger.js';

type ChunkName = keyof typeof THREE.ShaderChunk;

/** The text of each named chunk. */
type Chunks<Name extends ChunkName> = Record<Name, string>;

type ProgramName = keyof typeof THREE.ShaderLib;

/**
 * One replacement: three's text, and the text that takes its place. With `until`, the replaced text
 * is the block from three's text through the first `until` after it.
 */
export interface TextEdit {
  three: string;
  until?: string;
  godot: string;
}

/** One replacement in a chunk. */
export interface ChunkEdit<Name extends ChunkName> extends TextEdit {
  chunk: Name;
}

/** Where the block that opens before `from` ends, or -1 when its `until` is missing after `from`. */
function blockEnd(text: string, from: number, until: string): number {
  const at = text.indexOf(until, from);
  return at < 0 ? -1 : at + until.length;
}

/**
 * The text with the edit applied, or null when three's text is missing from it, occurs more than
 * once, or opens a block whose end is missing. A replacement by slicing, not a string `replace`: a
 * `$` in GLSL stays literal.
 */
function applyEdit(text: string, { three, until, godot }: TextEdit): string | null {
  const at = text.indexOf(three);
  if (at < 0 || text.indexOf(three, at + three.length) >= 0) return null;
  const end = until === undefined ? at + three.length : blockEnd(text, at + three.length, until);
  if (end < 0) return null;
  return text.slice(0, at) + godot + text.slice(end);
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
 * silently unpatched program. Every splice of a program's text goes through this, `editedProgram`
 * or `rewrittenShader`.
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
 * about a family of lines, not an anchor three must hold once, so a program without a match is no
 * error. `shaderTextSpliceConformance.test.ts` allows a `.replace` on shader text only here.
 */
export function rewrittenShader(
  text: string,
  pattern: RegExp,
  rewrite: (match: string, group: string) => string
): string {
  return text.replace(pattern, rewrite);
}

/**
 * Puts `text` in three's chunk `name`, for a chunk whose whole text a caller swaps at runtime, as
 * the tone curve is. True when the chunk changed. A null `text`, an edit whose anchor three lacks
 * as `applyEdits` gives it, keeps the chunk and warns that three's `missing`.
 */
export function swappedChunk(name: ChunkName, text: string | null, missing: string): boolean {
  if (THREE.ShaderChunk[name] === text) return false;
  if (text === null) {
    warn(`[Shading] three's ${missing}`);
    return false;
  }
  THREE.ShaderChunk[name] = text;
  return true;
}

/**
 * three's chunk `name` as it stands now, the patches installed so far included, with `edit` applied,
 * as `editedShader`.
 */
export function editedChunk(name: ChunkName, edit: TextEdit): string {
  return editedShader(THREE.ShaderChunk[name], [edit], `three's ${name}`);
}

/** The chunks with every edit applied in order, or null when one is missing, as `applyEdit`. */
function applyChunkEdits<Name extends ChunkName>(
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

/** A patch made of chunk edits, as `installChunkEdits` installs it. */
export interface ChunkEditsPatch<Name extends ChunkName> {
  edits: readonly ChunkEdit<Name>[];
  /** The text that proves the patch installed. An edit writes it, and that edit's chunk is checked. */
  mark: string;
  /** The patch's name in the warning, before "patch". */
  patch: string;
  /** Text added at the start of a chunk after the edits, for a block that no three line anchors. */
  prepend?: Partial<Record<ChunkName, string>>;
  /** Text added at the end of a chunk after the edits, for a block that no three line anchors. */
  append?: Partial<Record<ChunkName, string>>;
  /**
   * Edits to a program's own fragment shader in `THREE.ShaderLib`, for a line that no chunk holds.
   * They install with the chunks or not at all.
   */
  fragmentShaders?: Partial<Record<ProgramName, readonly TextEdit[]>>;
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

/** Each chunk the patch edits, prepends to or appends to, once. */
function patchedChunkNames({ edits, prepend = {}, append = {} }: ChunkEditsPatch<ChunkName>): ChunkName[] {
  const names = [...edits.map((edit) => edit.chunk), ...Object.keys(prepend), ...Object.keys(append)];
  return [...new Set(names as ChunkName[])];
}

/** The chunks with every edit applied and each added text in, or null as `applyChunkEdits`. */
function appliedEdits(
  chunks: Chunks<ChunkName>,
  { edits, prepend = {}, append = {} }: ChunkEditsPatch<ChunkName>
): Chunks<ChunkName> | null {
  const patched = applyChunkEdits(chunks, edits);
  if (patched === null) return null;
  for (const [name, text] of Object.entries(prepend) as [ChunkName, string][])
    patched[name] = text + patched[name];
  for (const [name, text] of Object.entries(append) as [ChunkName, string][]) patched[name] += text;
  return patched;
}

/** The warning for a three that lacks an edit's text: each edited chunk and program, and the patch. */
function missingTextWarning<Name extends ChunkName>(patch: ChunkEditsPatch<Name>): string {
  const edited = [...new Set(patch.edits.map((edit) => edit.chunk))];
  const programs = Object.keys(patch.fragmentShaders ?? {}).map((name) => `${name} fragment shader`);
  return `[Shading] three's ${alternatives([...edited, ...programs])} lacks a line the ${patch.patch} patch replaces`;
}

/**
 * Patches three's chunks and programs, and is true when they hold the patch after the call. A three
 * release that lacks a replaced text keeps all of three's own text, and the call warns and is false.
 * A patch that reads another's text installs that patch first, in its own install function. A
 * second call changes nothing.
 */
export function installChunkEdits<Name extends ChunkName>(patch: ChunkEditsPatch<Name>): boolean {
  if (THREE.ShaderChunk[markedChunk(patch)].includes(patch.mark)) return true;
  const current = Object.fromEntries(
    patchedChunkNames(patch).map((name) => [name, THREE.ShaderChunk[name]])
  ) as Chunks<ChunkName>;
  const patched = appliedEdits(current, patch);
  const programs = patchedPrograms(patch.fragmentShaders ?? {});
  if (patched === null || programs === null) {
    warn(missingTextWarning(patch));
    return false;
  }
  Object.assign(THREE.ShaderChunk, patched);
  for (const { program, fragmentShader } of programs) program.fragmentShader = fragmentShader;
  return true;
}
