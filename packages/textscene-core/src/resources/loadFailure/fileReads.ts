import type { ParsedResource } from '../../parser/parsedResource';
import type { RawNode, TscnExternalResource, TscnScene } from '../../parser/types';
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

type SceneSections = Pick<TscnScene, 'externalResources' | 'internalResources'> & {
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
  /** In file order, up to the first read that fails the parse where no file can show it. */
  readonly failing: FailingFileRead[];
}

/** A `.tscn`: its sections, its `[node]` sections and their instances. */
export function sceneFileReads(file: string, scene: SceneSections): FileReads {
  const sections = readsOf(scene.internalResources.map((section) => section.data));
  const nodes = readsOf(nodeValues(scene.nodes));
  const instances = readsOf(instancesOf(scene.nodes));
  return {
    reads: filesRead(file, scene.externalResources, [...sections, ...nodes, ...instances]),
    failing: failingFileReads(file, scene.externalResources, sections, nodes),
  };
}

/** A `.tres`: its `[sub_resource]` sections and its `[resource]` section. */
export function resourceFileReads(file: string, parsed: ParsedResource): FileReads {
  const sections = readsOf(resourceSections(parsed));
  return {
    reads: filesRead(file, parsed.extResources, sections),
    failing: failingFileReads(file, parsed.extResources, sections, []),
  };
}

function resourceSections(parsed: ParsedResource): Values[] {
  return [...parsed.subResources.map((section) => section.data), parsed.properties];
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

// A section read fails the file and a [node] ExtResource read does not (resource_format_text.cpp:647-650).
function failingFileReads(
  file: string,
  externalResources: readonly TscnExternalResource[],
  sections: readonly ValueRead[][],
  nodes: readonly ValueRead[][]
): FailingFileRead[] {
  const reads = new Map<string, FailingFileRead>();
  // In file order, as the parse stops at the first value that fails (resource_format_text.cpp:152, :291).
  const ordered = [
    ...sections.flat().map((read) => sectionFailingRead(file, externalResources, read)),
    ...nodes
      .flat()
      .flatMap((read) => (read.kind === 'Resource' ? [literalFailingRead(read, 'node Resource')] : [])),
  ];
  for (const read of ordered) {
    // An undeclared id, an unresolved uid or a path off `res://` fails the parse where no row shows it.
    if (!read?.path.startsWith('res://')) break;
    if (!reads.has(read.path)) reads.set(read.path, read);
  }
  return [...reads.values()];
}

function sectionFailingRead(
  file: string,
  externalResources: readonly TscnExternalResource[],
  read: ValueRead
): FailingFileRead | null {
  if (read.kind === 'Resource') return literalFailingRead(read, 'section Resource');
  const ext = findExtResource(externalResources, read.id);
  return ext ? { path: extResourcePathIn(file, ext.path), kind: 'section ExtResource', uid: '' } : null;
}

function literalFailingRead(read: LiteralRead, kind: FailingReadKind): FailingFileRead | null {
  return read.path === null ? null : { path: simplifyResPath(read.path), kind, uid: read.uid };
}

function instancesOf(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [
    ...(node.instance ? [{ instance: node.instance }] : []),
    ...instancesOf(node.children),
  ]);
}

/** A `path=` relative to the file that writes it (resource_format_text.cpp:508-510). */
function extResourcePathIn(file: string, path: string): string {
  if (path.includes('://') || isAbsolutePath(path)) return simplifyResPath(path);
  return simplifyPath(pathJoin(getBaseDir(file), path));
}

function nodeValues(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [node.rawProperties, ...nodeValues(node.children)]);
}
