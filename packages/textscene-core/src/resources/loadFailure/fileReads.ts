import type { ParsedResource } from '../../parser/parsedResource';
import type { RawNode, TscnExternalResource, TscnScene } from '../../parser/types';
import {
  getBaseDir,
  isAbsolutePath,
  pathJoin,
  simplifyPath,
  simplifyResPath,
} from '../../godot/string/string';
import { extResourceIdsIn, pathResourcePathsIn } from '../../godot/variant/resourceRef';
import { findExtResource } from '../SubResourceResolver';

type Values = Readonly<Record<string, string>>;

type SceneSections = Pick<TscnScene, 'externalResources' | 'internalResources'> & {
  readonly nodes: readonly RawNode[];
};

/** A `.tscn`: its `[sub_resource]` sections, and the `Resource()` literals of its `[node]` sections. */
export function sceneFailingReads(file: string, scene: SceneSections): string[] {
  const sections = scene.internalResources.map((section) => section.data);
  return failingReads(file, scene.externalResources, sections, nodeValues(scene.nodes));
}

/** A `.tres`: its `[sub_resource]` sections and its `[resource]` section. */
export function resourceFailingReads(file: string, parsed: ParsedResource): string[] {
  const sections = [...parsed.subResources.map((section) => section.data), parsed.properties];
  return failingReads(file, parsed.extResources, sections, []);
}

// A section read fails the file and a [node] read does not (resource_format_text.cpp:647-650, :288-290).
function failingReads(
  file: string,
  externalResources: readonly TscnExternalResource[],
  sections: readonly Values[],
  nodes: readonly Values[]
): string[] {
  const paths = new Set<string>();
  for (const value of sections.flatMap(Object.values)) {
    for (const id of extResourceIdsIn(value)) {
      const ext = findExtResource(externalResources, id);
      if (ext) paths.add(extResourcePathIn(file, ext.path));
    }
  }
  for (const value of [...sections, ...nodes].flatMap(Object.values)) {
    for (const path of pathResourcePathsIn(value)) paths.add(simplifyResPath(path));
  }
  // A path the previewer cannot place is never claimed missing.
  return [...paths].filter((path) => path.startsWith('res://'));
}

/** A file a text file reads, with the type its `[ext_resource]` heading gives, or null for a `Resource("…")` literal. */
export interface FileRead {
  readonly path: string;
  readonly type: string | null;
}

/**
 * Every file a value of a `.tscn` reads, an `instance=` included. Godot reports a file a heading
 * names and no value reads in no list, since only a read waits on its load (resource_format_text.cpp:147-157).
 */
export function sceneReads(file: string, scene: SceneSections): FileRead[] {
  const sections = scene.internalResources.map((section) => section.data);
  return readFiles(file, scene.externalResources, [
    ...sections,
    ...nodeValues(scene.nodes),
    ...instancesOf(scene.nodes),
  ]);
}

/** Every file a value of a `.tres` reads. */
export function resourceReads(file: string, parsed: ParsedResource): FileRead[] {
  const sections = [...parsed.subResources.map((section) => section.data), parsed.properties];
  return readFiles(file, parsed.extResources, sections);
}

function readFiles(
  file: string,
  externalResources: readonly TscnExternalResource[],
  values: readonly Values[]
): FileRead[] {
  const reads = new Map<string, string | null>();
  for (const value of values.flatMap(Object.values)) {
    for (const id of extResourceIdsIn(value)) {
      const ext = findExtResource(externalResources, id);
      const path = ext && extResourcePathIn(file, ext.path);
      if (path && !reads.has(path)) reads.set(path, ext.type);
    }
    for (const path of pathResourcePathsIn(value)) {
      const simplified = simplifyResPath(path);
      if (!reads.has(simplified)) reads.set(simplified, null);
    }
  }
  return [...reads].filter(([path]) => path.startsWith('res://')).map(([path, type]) => ({ path, type }));
}

function instancesOf(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [
    ...(node.instance ? [{ instance: node.instance }] : []),
    ...instancesOf(node.children),
  ]);
}

/** A `path=` relative to the file that writes it (resource_format_text.cpp:508-510). */
export function extResourcePathIn(file: string, path: string): string {
  if (path.includes('://') || isAbsolutePath(path)) return simplifyResPath(path);
  return simplifyPath(pathJoin(getBaseDir(file), path));
}

function nodeValues(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [node.rawProperties, ...nodeValues(node.children)]);
}
