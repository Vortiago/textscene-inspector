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

/** The type is the `[ext_resource]` heading's, or null for a `Resource("…")` literal. */
export interface FileRead {
  readonly path: string;
  readonly type: string | null;
}

/** A `.tscn`: its `[sub_resource]` sections, and the `Resource()` literals of its `[node]` sections. */
export function sceneFailingReads(file: string, scene: SceneSections): string[] {
  const sections = scene.internalResources.map((section) => section.data);
  return failingReads(file, scene.externalResources, sections, nodeValues(scene.nodes));
}

/** A `.tres`: its `[sub_resource]` sections and its `[resource]` section. */
export function resourceFailingReads(file: string, parsed: ParsedResource): string[] {
  return failingReads(file, parsed.extResources, resourceSections(parsed), []);
}

// A section read fails the file and a [node] read does not (resource_format_text.cpp:647-650, :288-290).
function failingReads(
  file: string,
  externalResources: readonly TscnExternalResource[],
  sections: readonly Values[],
  nodes: readonly Values[]
): string[] {
  return readFiles(file, externalResources, sections, [...sections, ...nodes]).map((read) => read.path);
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
export function extResourcePathIn(file: string, path: string): string {
  if (path.includes('://') || isAbsolutePath(path)) return simplifyResPath(path);
  return simplifyPath(pathJoin(getBaseDir(file), path));
}

function nodeValues(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [node.rawProperties, ...nodeValues(node.children)]);
}
