/**
 * Scene helpers the `parentType.*.test.ts` files share. It reaches only
 * `StrictTscnParser`: the lenient `TscnParser` imports every node slice, which
 * the files that only want `silencesVisibilityGatedWarnings` do not need.
 */

import { StrictTscnParser } from '../StrictTscnParser.js';
import { hiddenOrUnknowableInTree } from '../parentType.js';
import type { RawNode } from '../../parser/types.js';

/** Depth-first lookup by name, since these trees are tiny. */
export function byName(nodes: readonly RawNode[], name: string): RawNode {
  const hit = findByName(nodes, name);
  if (!hit) throw new Error(`no node named ${name}`);
  return hit;
}

function findByName(nodes: readonly RawNode[], name: string): RawNode | undefined {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = findByName(n.children, name);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Whether a warning Godot gates on `is_visible_in_tree()` stays silent for one named node of a
 * source string: the node is hidden, or this file cannot tell. The strict parser feeds the rules
 * and keeps property values as the file's own strings, which `isExplicitlyHidden` reads.
 */
export function silencesVisibilityGatedWarnings(source: string, name: string): boolean {
  const scene = new StrictTscnParser().parse(source).scene;
  if (!scene) throw new Error('the scanner produced no scene');
  return hiddenOrUnknowableInTree(scene, byName(scene.nodes, name));
}
