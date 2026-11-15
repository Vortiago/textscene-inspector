/** The files whose failure fails a text file as Godot's text loader reads it. */

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

// A section read of a failed file fails the file (resource_format_text.cpp:647-650, :776); a [node]
// read is skipped (:288-290). A failed Resource() literal is a parse error anywhere (variant_parser.cpp:1170-1173).
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

/** A `path=` relative to the file that writes it, as the text loader localises it (resource_format_text.cpp:508-510). */
export function extResourcePathIn(file: string, path: string): string {
  if (path.includes('://') || isAbsolutePath(path)) return simplifyResPath(path);
  return simplifyPath(pathJoin(getBaseDir(file), path));
}

function nodeValues(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [node.rawProperties, ...nodeValues(node.children)]);
}
