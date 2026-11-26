import type { ParsedResource } from '../../parser/parsedResource';
import type { FileValue, RawNode, TscnExternalResource, TscnScene } from '../../parser/types';
import type { HeadingStop } from '../../parser/headingOrder';
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

type TextSections = Pick<TscnScene, 'externalResources' | 'internalResources' | 'fileValues' | 'headingStop'>;

type SceneSections = TextSections & { readonly nodes: readonly RawNode[] };

/** The type is the `[ext_resource]` heading's, or null for a `Resource("…")` literal. */
export interface FileRead {
  readonly path: string;
  readonly type: string | null;
}

/** Where a failing read sits, which names the error line Godot prints for it. */
export type FailingReadKind =
  'section ExtResource' | 'section Resource' | 'opening Resource' | 'node Resource';

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

/** A read the parse stops at, or a heading the loader stops at. */
export type ParseStop = ReadStop | HeadingStop;

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
export function sceneFailingReads(file: string, scene: TextSections): FailingReads {
  return failingFileReads(file, sceneReadsToStop(scene));
}

/** A `.tres`'s failing reads, from its text in file order. */
export function resourceFailingReads(file: string, parsed: ParsedResource): FailingReads {
  const sections = { externalResources: parsed.extResources, subResources: parsed.subResources };
  return failingFileReads(file, readsUpToStop(sections, parsed));
}

/** Each read the loader makes before its parse stops, in file order, with the value it sits in. */
export function readsBeforeParseStop(scene: TextSections): readonly OrderedRead[] {
  const { ordered, stop } = sceneReadsToStop(scene);
  return stop < 0 ? ordered : ordered.slice(0, stop);
}

function sceneReadsToStop(scene: TextSections): ReadsToStop {
  return readsUpToStop(
    { externalResources: scene.externalResources, subResources: scene.internalResources },
    scene
  );
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
    if (!types.has(at) || types.get(at) === null) types.set(at, ext?.type ?? null);
  }
  // A path the previewer cannot place is never claimed missing.
  return [...types].filter(([path]) => path.startsWith('res://')).map(([path, type]) => ({ path, type }));
}

/** What a read is judged against: the file's `[ext_resource]` headings and its sections in order. */
interface Sections {
  readonly externalResources: readonly TscnExternalResource[];
  readonly subResources: readonly { readonly id: string }[];
}

/** One read in file order, the value it sits in, and the line Godot prints for it. */
export interface OrderedRead {
  readonly read: ValueRead;
  /** The `[ext_resource]` headings before the value, the only ones its reads can name. */
  readonly declared: readonly TscnExternalResource[];
  readonly value: FileValue;
  readonly line: number;
}

/** The reads up to the heading stop, and the index of the read the parse stops at, or -1. */
interface ReadsToStop {
  readonly ordered: readonly OrderedRead[];
  readonly stop: number;
  readonly headingStop: HeadingStop | null;
}

/** What the scan records of a file's text as the loader parses it. */
type ScannedValues = Pick<TscnScene, 'fileValues' | 'headingStop'>;

function readsUpToStop(
  sections: Sections,
  { fileValues = [], headingStop: stopAt }: ScannedValues
): ReadsToStop {
  const headingStop = stopAt ?? null;
  // The loader reads a heading's own fields before it refuses the heading.
  const read = headingStop ? fileValues.filter((value) => value.line <= headingStop.line) : fileValues;
  const ordered = read.flatMap((value) => orderedReadsOf(sections.externalResources, value));
  const declaredAt = new Map<string, number>();
  sections.subResources.forEach(({ id }, at) => declaredAt.has(id) || declaredAt.set(id, at));
  // In file order, as the parse stops at the first value that fails (resource_format_text.cpp:152, :291).
  return { ordered, stop: ordered.findIndex((one) => failsParse(declaredAt, one)), headingStop };
}

// A section read fails the file and a [node] ExtResource read does not (resource_format_text.cpp:647-650).
function failingFileReads(file: string, { ordered, stop, headingStop }: ReadsToStop): FailingReads {
  const failing = new Map<string, FailingFileRead>();
  for (const { read, declared, value, line } of stop < 0 ? ordered : ordered.slice(0, stop)) {
    const failure = failingReadOf({ file, externalResources: declared, line }, read, value);
    // A uid or a path off `res://` may load.
    if (failure?.path.startsWith('res://') && !failing.has(failure.path)) failing.set(failure.path, failure);
  }
  return { failing: [...failing.values()], parseStop: stop < 0 ? headingStop : readStopOf(ordered[stop]!) };
}

function readStopOf({ read, value, line }: OrderedRead): ReadStop {
  if (read.kind === 'Resource') throw new Error(`expected a read that fails the parse, got ${read.path}`);
  return { read, place: value.place, isOpeningTag: value.isOpeningTag, line };
}

/** A value's reads, each with its line and the `[ext_resource]` headings before it. */
function orderedReadsOf(externalResources: readonly TscnExternalResource[], value: FileValue): OrderedRead[] {
  const declared =
    value.extResourcesBefore < externalResources.length
      ? externalResources.slice(0, value.extResourcesBefore)
      : externalResources;
  const lineOf = lineCounter(value);
  return valueReadsAt(value.text).map(({ read, printedAt }) => ({
    read,
    declared,
    value,
    line: lineOf(printedAt),
  }));
}

/** Godot's line of each offset, asked in rising order, so the text is scanned once. */
function lineCounter({ text, line: firstLine, skippedNewlines }: FileValue): (offset: number) => number {
  const skipped = new Set(skippedNewlines);
  let line = firstLine;
  let next = text.indexOf('\n');
  return (offset) => {
    for (; next >= 0 && next < offset; next = text.indexOf('\n', next + 1)) if (!skipped.has(next)) line++;
    return line;
  };
}

/** Measured: a binds `ExtResource` prints the section line, and a binds literal the `Parse error.` line. */
function failingReadOf(
  at: ReadAt,
  read: ValueRead,
  { place, isOpeningTag }: FileValue
): FailingFileRead | null {
  if (read.kind === 'Resource') return literalFailingRead(at, read, literalKind(place, isOpeningTag));
  return place === 'node' ? null : extFailingRead(at, read);
}

function literalKind(place: FileValue['place'], isOpeningTag: boolean): FailingReadKind {
  if (isOpeningTag) return 'opening Resource';
  return place === 'section' ? 'section Resource' : 'node Resource';
}

/** Where a read sits: its file, the `[ext_resource]` headings before it, and the line Godot prints. */
interface ReadAt {
  readonly file: string;
  readonly externalResources: readonly TscnExternalResource[];
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

function extFailingRead({ file, externalResources, line }: ReadAt, read: ValueRead): FailingFileRead | null {
  const ext = read.kind === 'ExtResource' ? findExtResource(externalResources, read.id) : undefined;
  return ext ? { path: extResourcePathIn(file, ext.path), kind: 'section ExtResource', uid: '', line } : null;
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
