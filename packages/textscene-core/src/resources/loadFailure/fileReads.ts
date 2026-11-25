import type { ParsedResource } from '../../parser/parsedResource';
import type { FileValue, RawNode, TscnExternalResource, TscnScene } from '../../parser/types';
import type { MisplacedHeading } from '../../parser/headingOrder';
import {
  getBaseDir,
  isAbsolutePath,
  pathJoin,
  simplifyPath,
  simplifyResPath,
} from '../../godot/string/string';
import {
  valueReadsAt,
  valueReadsIn,
  type LiteralRead,
  type ValueRead,
} from '../../godot/variant/resourceRef';
import { findExtResource } from '../SubResourceResolver';

type Values = Readonly<Record<string, string>>;

type SceneSections = Pick<
  TscnScene,
  'externalResources' | 'internalResources' | 'fileValues' | 'misplacedHeading'
> & {
  readonly nodes: readonly RawNode[];
};

/** The type is the `[ext_resource]` heading's, or null for a `Resource("…")` literal. */
export interface FileRead {
  readonly path: string;
  readonly type: string | null;
}

/** Where a failing read sits, which names the error line Godot prints for it. */
export type FailingReadKind = 'section ExtResource' | 'section Resource' | 'node Resource';

export interface FailingFileRead {
  readonly path: string;
  readonly kind: FailingReadKind;
  /** The literal's `uid://` argument, empty where it has none. */
  readonly uid: string;
  /** The line Godot prints: a reference's id, or a literal's closing `)` (resource_format_text.cpp:40). */
  readonly line: number;
}

/** The reads that fail the whole file, judged on the file's text as the loader reads it. */
export interface FailingReads {
  /** In file order, up to where the parse stops. */
  readonly failing: FailingFileRead[];
  /** Where the parse stops, null where the file parses. */
  readonly parseStop: ParseStop | null;
}

/** An undeclared or later id, or a refused literal: where it sits, and the line Godot prints for it. */
export interface ReadStop {
  readonly read: Exclude<ValueRead, LiteralRead>;
  readonly place: FileValue['place'];
  readonly isOpeningTag: boolean;
  readonly line: number;
}

/** A read the parse stops at, or a heading the loader refuses for its place in the file. */
export type ParseStop = ReadStop | MisplacedHeading;

/** A `.tscn`'s files, read from the written nodes, as the live tree reads them. */
export function sceneFileReads(file: string, scene: SceneSections): FileRead[] {
  const binds = (scene.fileValues ?? []).flatMap(({ text, place }) =>
    place === 'binds' ? valueReadsIn(text) : []
  );
  const sections = scene.internalResources.map((section) => section.data);
  return filesRead(file, scene.externalResources, [
    ...readsOf(sections),
    ...readsOf(nodeValues(scene.nodes)),
    binds,
  ]);
}

/** A `.tres`'s files: its `[sub_resource]` sections and its `[resource]` section. */
export function resourceFileReads(file: string, parsed: ParsedResource): FileRead[] {
  const sections = [...parsed.subResources.map((section) => section.data), parsed.properties];
  return filesRead(file, parsed.extResources, readsOf(sections));
}

/** A `.tscn`'s failing reads, from its text in file order. */
export function sceneFailingReads(file: string, scene: SceneSections): FailingReads {
  const context = { file, externalResources: scene.externalResources, subResources: scene.internalResources };
  return failingFileReads(context, scene.fileValues ?? [], scene.misplacedHeading ?? null);
}

/** A `.tres`'s failing reads, from its text in file order. */
export function resourceFailingReads(file: string, parsed: ParsedResource): FailingReads {
  const context = { file, externalResources: parsed.extResources, subResources: parsed.subResources };
  return failingFileReads(context, parsed.fileValues ?? [], parsed.misplacedHeading ?? null);
}

function readsOf(values: readonly Values[]): ValueRead[][] {
  return values.flatMap(Object.values).map(valueReadsIn);
}

/** Values only, as only a read reports a failed load (resource_format_text.cpp:147-157). */
function filesRead(
  file: string,
  externalResources: readonly TscnExternalResource[],
  values: readonly ValueRead[][]
): FileRead[] {
  const types = new Map<string, string | null>();
  for (const read of values.flat()) {
    const ext = read.kind === 'ExtResource' ? findExtResource(externalResources, read.id) : null;
    const path = ext ? extResourcePathIn(file, ext.path) : read.kind === 'Resource' && read.path;
    if (!path) continue;
    const at = ext ? path : simplifyResPath(path);
    // The `[ext_resource]` heading's type wins over a literal's none.
    if (!types.get(at)) types.set(at, ext?.type ?? null);
  }
  // A path the previewer cannot place is never claimed missing.
  return [...types].filter(([path]) => path.startsWith('res://')).map(([path, type]) => ({ path, type }));
}

/** What a read is judged against: the file, its `[ext_resource]` headings and its sections in order. */
interface ReadContext {
  readonly file: string;
  readonly externalResources: readonly TscnExternalResource[];
  readonly subResources: readonly { readonly id: string }[];
}

/** One read in file order, the value it sits in, its line, and the failure its failed load gives. */
interface OrderedRead {
  readonly read: ValueRead;
  /** The `[ext_resource]` headings before the value, the only ones its reads can name. */
  readonly declared: readonly TscnExternalResource[];
  readonly value: FileValue;
  readonly line: number;
  readonly failure: FailingFileRead | null;
}

// A section read fails the file and a [node] ExtResource read does not (resource_format_text.cpp:647-650).
function failingFileReads(
  context: ReadContext,
  values: readonly FileValue[],
  misplaced: MisplacedHeading | null
): FailingReads {
  // The loader reads a misplaced heading's own fields before it refuses the heading.
  const read = misplaced ? values.filter((value) => value.line <= misplaced.line) : values;
  const ordered = read.flatMap((value) => orderedReadsOf(context, value));
  const failing = new Map<string, FailingFileRead>();
  const declaredAt = new Map<string, number>();
  context.subResources.forEach(({ id }, at) => declaredAt.has(id) || declaredAt.set(id, at));
  // In file order, as the parse stops at the first value that fails (resource_format_text.cpp:152, :291).
  const stop = ordered.findIndex((ordered) => failsParse(declaredAt, ordered));
  for (const { failure } of stop < 0 ? ordered : ordered.slice(0, stop)) {
    // A uid or a path off `res://` may load.
    if (failure?.path.startsWith('res://') && !failing.has(failure.path)) failing.set(failure.path, failure);
  }
  return { failing: [...failing.values()], parseStop: stop < 0 ? misplaced : readStopOf(ordered[stop]!) };
}

function readStopOf({ read, value, line }: OrderedRead): ReadStop {
  if (read.kind === 'Resource') throw new Error(`expected a read that fails the parse, got ${read.path}`);
  return { read, place: value.place, isOpeningTag: value.isOpeningTag, line };
}

/** A value's reads, each with the failure its failed load gives where the value sits. */
function orderedReadsOf(context: ReadContext, value: FileValue): OrderedRead[] {
  const { externalResources } = context;
  const declared =
    value.extResourcesBefore < externalResources.length
      ? externalResources.slice(0, value.extResourcesBefore)
      : externalResources;
  const before = { ...context, externalResources: declared };
  return valueReadsAt(value.text).map(({ read, printedAt }) => {
    const line = value.line + newlinesBefore(value.text, printedAt);
    return {
      read,
      declared,
      value,
      line,
      failure: failingReadOf({ context: before, line }, read, value.place),
    };
  });
}

function newlinesBefore(text: string, end: number): number {
  let count = 0;
  for (let at = text.indexOf('\n'); at >= 0 && at < end; at = text.indexOf('\n', at + 1)) count++;
  return count;
}

/** Measured: a binds `ExtResource` prints the section line, and a binds literal the `Parse error.` line. */
function failingReadOf(at: ReadAt, read: ValueRead, place: FileValue['place']): FailingFileRead | null {
  if (read.kind === 'Resource')
    return literalFailingRead(at, read, place === 'section' ? 'section Resource' : 'node Resource');
  return place === 'node' ? null : extFailingRead(at, read);
}

/** Where a read sits: the file it is in, and the line Godot prints for it. */
interface ReadAt {
  readonly context: ReadContext;
  readonly line: number;
}

/** An `ExtResource` id no heading before it declares, a refused literal, or a later `SubResource` id. */
function failsParse(
  declaredAt: ReadonlyMap<string, number>,
  { read, declared, value }: OrderedRead
): boolean {
  if (read.kind === 'Refused') return true;
  if (read.kind === 'ExtResource') return !findExtResource(declared, read.id);
  if (read.kind !== 'SubResource') return false;
  const at = declaredAt.get(read.id);
  return at === undefined || at > value.subResourcesBefore;
}

function extFailingRead({ context, line }: ReadAt, read: ValueRead): FailingFileRead | null {
  const ext = read.kind === 'ExtResource' ? findExtResource(context.externalResources, read.id) : undefined;
  return ext
    ? { path: extResourcePathIn(context.file, ext.path), kind: 'section ExtResource', uid: '', line }
    : null;
}

function literalFailingRead(
  { line }: ReadAt,
  read: LiteralRead,
  kind: FailingReadKind
): FailingFileRead | null {
  return read.path === null ? null : { path: simplifyResPath(read.path), kind, uid: read.uid, line };
}

/** A `path=` relative to the file that writes it (resource_format_text.cpp:508-510). */
function extResourcePathIn(file: string, path: string): string {
  if (path.includes('://') || isAbsolutePath(path)) return simplifyResPath(path);
  return simplifyPath(pathJoin(getBaseDir(file), path));
}

/** Each node's `instance=` and properties, written ones included, as the live tree reads them. */
function nodeValues(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [
    ...(node.instance ? [{ instance: node.instance }] : []),
    node.rawProperties,
    ...nodeValues(node.children),
  ]);
}
