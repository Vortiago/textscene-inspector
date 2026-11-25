import type { ParsedResource } from '../../parser/parsedResource';
import type { RawNode, TscnExternalResource, TscnScene } from '../../parser/types';
import {
  getBaseDir,
  isAbsolutePath,
  pathJoin,
  simplifyPath,
  simplifyResPath,
} from '../../godot/string/string';
import {
  extResourceIdsIn,
  literalReadsIn,
  pathResourcePathsIn,
  valueReadsIn,
} from '../../godot/variant/resourceRef';
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

/** A `.tscn`: its `[sub_resource]` sections, and the `Resource()` literals of its `[node]` sections. */
export function sceneFailingFileReads(file: string, scene: SceneSections): FailingFileRead[] {
  const sections = scene.internalResources.map((section) => section.data);
  return failingFileReads(file, scene.externalResources, sections, nodeValues(scene.nodes));
}

/** A `.tres`: its `[sub_resource]` sections and its `[resource]` section. */
export function resourceFailingFileReads(file: string, parsed: ParsedResource): FailingFileRead[] {
  return failingFileReads(file, parsed.extResources, resourceSections(parsed), []);
}

// A section read fails the file and a [node] read does not (resource_format_text.cpp:647-650, :288-290).
function failingFileReads(
  file: string,
  externalResources: readonly TscnExternalResource[],
  sections: readonly Values[],
  nodes: readonly Values[]
): FailingFileRead[] {
  const reads = new Map<string, FailingFileRead>();
  const add = (read: FailingFileRead | null) => {
    if (read?.path.startsWith('res://') && !reads.has(read.path)) reads.set(read.path, read);
  };
  // In file order, as the parse stops at the first value that fails (resource_format_text.cpp:152, :291).
  for (const value of sections.flatMap(Object.values)) {
    for (const read of valueReadsIn(value)) {
      if (read.kind === 'Resource')
        add({ path: simplifyResPath(read.path), kind: 'section Resource', uid: read.uid });
      else add(extFailingRead(file, externalResources, read.id));
    }
  }
  for (const value of nodes.flatMap(Object.values)) {
    for (const read of literalReadsIn(value))
      add({ path: simplifyResPath(read.path), kind: 'node Resource', uid: read.uid });
  }
  return [...reads.values()];
}

function extFailingRead(
  file: string,
  externalResources: readonly TscnExternalResource[],
  id: string
): FailingFileRead | null {
  const ext = findExtResource(externalResources, id);
  return ext ? { path: extResourcePathIn(file, ext.path), kind: 'section ExtResource', uid: '' } : null;
}

/** Values only, as only a read reports a failed load (resource_format_text.cpp:147-157). */
export function sceneReads(file: string, scene: SceneSections): FileRead[] {
  const sections = scene.internalResources.map((section) => section.data);
  const values = [...sections, ...nodeValues(scene.nodes), ...instancesOf(scene.nodes)];
  return readFiles(file, scene.externalResources, values, values);
}

/** Every file a value of a `.tres` reads. */
export function resourceReads(file: string, parsed: ParsedResource): FileRead[] {
  const sections = resourceSections(parsed);
  return readFiles(file, parsed.extResources, sections, sections);
}

function resourceSections(parsed: ParsedResource): Values[] {
  return [...parsed.subResources.map((section) => section.data), parsed.properties];
}

/** The `ExtResource` ids of `extValues` and the `Resource("…")` literals of `pathValues`, first type kept. */
function readFiles(
  file: string,
  externalResources: readonly TscnExternalResource[],
  extValues: readonly Values[],
  pathValues: readonly Values[]
): FileRead[] {
  const reads = new Map<string, string | null>();
  for (const value of extValues.flatMap(Object.values)) {
    for (const id of extResourceIdsIn(value)) {
      const ext = findExtResource(externalResources, id);
      const path = ext && extResourcePathIn(file, ext.path);
      if (path && !reads.has(path)) reads.set(path, ext.type);
    }
  }
  for (const value of pathValues.flatMap(Object.values)) {
    for (const path of pathResourcePathsIn(value)) {
      const simplified = simplifyResPath(path);
      if (!reads.has(simplified)) reads.set(simplified, null);
    }
  }
  // A path the previewer cannot place is never claimed missing.
  return [...reads].filter(([path]) => path.startsWith('res://')).map(([path, type]) => ({ path, type }));
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
