/** The files whose failure fails a text file as Godot's text loader reads it. */

import type { ParsedResource } from '../../parser/parsedResource';
import type { RawNode, TscnExternalResource, TscnScene } from '../../parser/types';
import { simplifyResPath } from '../../godot/string/string';
import { extResourceIdsIn, pathResourcePathsIn } from '../../godot/variant/resourceRef';
import { findExtResource } from '../SubResourceResolver';

type Values = Readonly<Record<string, string>>;

/** A `.tscn`: its `[sub_resource]` sections, and the `Resource()` literals of its `[node]` sections. */
export function sceneFailingReads(scene: TscnScene): string[] {
  const sections = scene.internalResources.map((section) => section.data);
  return failingReads(scene.externalResources, sections, nodeValues(scene.nodes));
}

/** A `.tres`: its `[sub_resource]` sections and its `[resource]` section. */
export function resourceFailingReads(file: ParsedResource): string[] {
  const sections = [...file.subResources.map((section) => section.data), file.properties];
  return failingReads(file.extResources, sections, []);
}

// A section read of a failed file fails the file (resource_format_text.cpp:647-650, :776); a [node]
// read is skipped (:288-290). A failed Resource() literal is a parse error anywhere (variant_parser.cpp:1170-1173).
function failingReads(
  externalResources: readonly TscnExternalResource[],
  sections: readonly Values[],
  nodes: readonly Values[]
): string[] {
  const paths = new Set<string>();
  for (const value of sections.flatMap(Object.values)) {
    for (const id of extResourceIdsIn(value)) {
      const ext = findExtResource(externalResources, id);
      if (ext) paths.add(simplifyResPath(ext.path));
    }
  }
  for (const value of [...sections, ...nodes].flatMap(Object.values)) {
    for (const path of pathResourcePathsIn(value)) paths.add(simplifyResPath(path));
  }
  return [...paths];
}

function nodeValues(nodes: readonly RawNode[]): Values[] {
  return nodes.flatMap((node) => [node.rawProperties, ...nodeValues(node.children)]);
}
