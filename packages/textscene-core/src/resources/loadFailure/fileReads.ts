import type { ParsedResource } from '../../parser/parsedResource';
import type { HeadingValues, RawNode, TscnExternalResource, TscnScene } from '../../parser/types';
import {
  getBaseDir,
  isAbsolutePath,
  pathJoin,
  simplifyPath,
  simplifyResPath,
} from '../../godot/string/string';
import { valueReadsIn, type LiteralRead, type ValueRead } from '../../godot/variant/resourceRef';
import { findExtResource } from '../SubResourceResolver';

type Values = Readonly<Record<string, string>>;

type SceneSections = Pick<TscnScene, 'externalResources' | 'internalResources' | 'headingValues'> & {
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
}

/** Every file a value reads, and the reads that fail the whole file, from one scan of each value. */
export interface FileReads {
  readonly reads: FileRead[];
  /** In file order, up to the first value at which the parse fails. */
  readonly failing: FailingFileRead[];
  /** True where a value names an undeclared or later id, or a refused literal: the file does not load. */
  readonly failsToParse: boolean;
}

/** A `.tscn`: its files read from the written nodes, and its failure from the file's values in file order. */
export function sceneFileReads(file: string, scene: SceneSections): FileReads {
  const sections = scene.internalResources.map((section) => readsOf([section.data]).flat());
  const context = { file, externalResources: scene.externalResources, subResources: scene.internalResources };
  const headings = (scene.headingValues ?? []).flatMap((values) => headingReads(context, values));
  const binds = (scene.headingValues ?? []).flatMap((values) =>
    values.kind === 'connection' ? valueReadsIn(values.binds) : []
  );
  return {
    reads: filesRead(file, scene.externalResources, [
      ...sections,
      ...readsOf(nodeValues(scene.nodes)),
      binds,
    ]),
    ...failingFileReads(context, [
      ...sections.flatMap((reads, at) => reads.map((read) => sectionRead(context, read, at))),
      ...headings,
    ]),
  };
}

/** A `.tres`: its `[sub_resource]` sections and its `[resource]` section. */
export function resourceFileReads(file: string, parsed: ParsedResource): FileReads {
  const sections = [...parsed.subResources.map((section) => section.data), parsed.properties].map((values) =>
    readsOf([values]).flat()
  );
  const context = { file, externalResources: parsed.extResources, subResources: parsed.subResources };
  return {
    reads: filesRead(file, parsed.extResources, sections),
    ...failingFileReads(
      context,
      sections.flatMap((reads, at) => reads.map((read) => sectionRead(context, read, at)))
    ),
  };
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

/** One read in file order, the index of the section it sits in, and the failure its failed load gives. */
interface OrderedRead {
  readonly read: ValueRead;
  readonly at: number;
  readonly failure: FailingFileRead | null;
}

/** The section index of a read outside every `[sub_resource]`, which sees each one. */
const AFTER_SECTIONS = Number.POSITIVE_INFINITY;

// A section read fails the file and a [node] ExtResource read does not (resource_format_text.cpp:647-650).
function failingFileReads(
  context: ReadContext,
  ordered: readonly OrderedRead[]
): Pick<FileReads, 'failing' | 'failsToParse'> {
  const failing = new Map<string, FailingFileRead>();
  const declaredAt = new Map<string, number>();
  context.subResources.forEach(({ id }, at) => declaredAt.has(id) || declaredAt.set(id, at));
  // In file order, as the parse stops at the first value that fails (resource_format_text.cpp:152, :291).
  const stop = ordered.findIndex((read) => failsParse(context, declaredAt, read));
  for (const { failure } of stop < 0 ? ordered : ordered.slice(0, stop)) {
    // A uid or a path off `res://` may load.
    if (failure?.path.startsWith('res://') && !failing.has(failure.path)) failing.set(failure.path, failure);
  }
  return { failing: [...failing.values()], failsToParse: stop >= 0 };
}

/** An undeclared `ExtResource` id, a refused literal, or a `SubResource` no section up to here declares. */
function failsParse(
  { externalResources }: ReadContext,
  declaredAt: ReadonlyMap<string, number>,
  { read, at }: OrderedRead
): boolean {
  if (read.kind === 'Refused') return true;
  if (read.kind === 'ExtResource') return !findExtResource(externalResources, read.id);
  if (read.kind !== 'SubResource') return false;
  const declared = declaredAt.get(read.id);
  return declared === undefined || declared > at;
}

/** A read whose failed load fails the file: a section's value, or an `instance=` outside a node body. */
function sectionRead(context: ReadContext, read: ValueRead, at: number): OrderedRead {
  if (read.kind === 'Resource') return { read, at, failure: literalFailingRead(read, 'section Resource') };
  return { read, at, failure: extFailingRead(context, read) };
}

/** Measured: a binds `ExtResource` prints the section line, and a literal the node's `Parse error.` line. */
function bindFailingRead(context: ReadContext, read: ValueRead): FailingFileRead | null {
  return read.kind === 'Resource' ? literalFailingRead(read, 'node Resource') : extFailingRead(context, read);
}

function extFailingRead({ file, externalResources }: ReadContext, read: ValueRead): FailingFileRead | null {
  const ext = read.kind === 'ExtResource' ? findExtResource(externalResources, read.id) : undefined;
  return ext ? { path: extResourcePathIn(file, ext.path), kind: 'section ExtResource', uid: '' } : null;
}

function nodeFailingRead(read: ValueRead): FailingFileRead | null {
  return read.kind === 'Resource' ? literalFailingRead(read, 'node Resource') : null;
}

function literalFailingRead(read: LiteralRead, kind: FailingReadKind): FailingFileRead | null {
  return read.path === null ? null : { path: simplifyResPath(read.path), kind, uid: read.uid };
}

/** A `path=` relative to the file that writes it (resource_format_text.cpp:508-510). */
function extResourcePathIn(file: string, path: string): string {
  if (path.includes('://') || isAbsolutePath(path)) return simplifyResPath(path);
  return simplifyPath(pathJoin(getBaseDir(file), path));
}

/** A heading's reads in file order: a node's `instance=` before its properties, or a connection's binds. */
function headingReads(context: ReadContext, values: HeadingValues): OrderedRead[] {
  if (values.kind === 'connection') {
    return valueReadsIn(values.binds).map((read) => ({
      read,
      at: AFTER_SECTIONS,
      failure: bindFailingRead(context, read),
    }));
  }
  const instance = (values.instance ? valueReadsIn(values.instance) : []).map((read) =>
    values.isInstanceAborting
      ? sectionRead(context, read, AFTER_SECTIONS)
      : { read, at: AFTER_SECTIONS, failure: nodeFailingRead(read) }
  );
  const properties = readsOf([values.properties])
    .flat()
    .map((read) => ({ read, at: AFTER_SECTIONS, failure: nodeFailingRead(read) }));
  return [...instance, ...properties];
}

/** Each node's `instance=` and properties, written ones included, as the live tree reads them. */
function nodeValues(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [
    ...(node.instance ? [{ instance: node.instance }] : []),
    node.rawProperties,
    ...nodeValues(node.children),
  ]);
}
