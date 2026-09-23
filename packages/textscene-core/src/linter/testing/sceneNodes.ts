/**
 * Scene helpers the `parentType.*.test.ts` files share. It reaches only
 * `StrictTscnParser`: the lenient `TscnParser` imports every node slice, which
 * the files that only want `verdictOf` do not need.
 */

import { StrictTscnParser } from '../StrictTscnParser.js';
import { visibleInTreeVerdict } from '../parentType.js';
import type { TscnNode } from '../../parser/types.js';

/** Depth-first lookup by name, since these trees are tiny. */
export function byName(nodes: readonly TscnNode[], name: string): TscnNode {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = n.children?.length ? byName(n.children, name) : undefined;
    if (hit) return hit;
  }
  throw new Error(`no node named ${name}`);
}

/**
 * `visibleInTreeVerdict` for one named node of a source string. The strict
 * parser feeds the rules and keeps property values as the file's own strings,
 * which `isExplicitlyHidden` reads.
 */
export function verdictOf(source: string, name: string) {
  const scene = new StrictTscnParser().parse(source).scene;
  if (!scene) throw new Error('the scanner produced no scene');
  return visibleInTreeVerdict(scene, byName(scene.nodes, name));
}
