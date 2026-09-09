/**
 * Scene helpers the `parentType.*.test.ts` files share.
 *
 * Deliberately reaches only `StrictTscnParser`. The LENIENT `TscnParser` stays
 * out: it side-effect-imports every node slice, so a shared module naming it
 * would hand a 466-module graph to the two files here that only want
 * `verdictOf` — the one file that does parse leniently constructs its own.
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
