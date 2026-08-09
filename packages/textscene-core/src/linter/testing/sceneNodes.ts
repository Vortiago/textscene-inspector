/**
 * Scene helpers the `parentType.*.test.ts` files share.
 *
 * Both verdict families are read off a parsed tree by node NAME, and the two
 * families need DIFFERENT parsers, so the choice is made here once instead of
 * per file.
 */

import { TscnParser } from '../../parser/TscnParser.js';
import { StrictTscnParser } from '../StrictTscnParser.js';
import { visibleInTreeVerdict } from '../parentType.js';
import type { TscnNode } from '../../parser/types.js';

/** Parse with the lenient renderer parser. */
export function parseScene(source: string) {
  return new TscnParser().parse(source);
}

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
 * `visibleInTreeVerdict` for one named node of a source string.
 *
 * The strict parser, not the lenient one: it is what feeds the rules, and it
 * keeps property values as the file's own strings, which is what
 * `isExplicitlyHidden` reads.
 */
export function verdictOf(source: string, name: string) {
  const scene = new StrictTscnParser().parse(source).scene;
  if (!scene) throw new Error('the scanner produced no scene');
  return visibleInTreeVerdict(scene, byName(scene.nodes, name));
}
