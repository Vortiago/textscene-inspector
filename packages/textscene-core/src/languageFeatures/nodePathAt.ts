/** The path Godot's "Copy Node Path" writes for the node under the cursor of a `.tscn`. */

import { spelledNodePath } from '../utils/nodePath.js';
import { seatedNodePaths } from './nodeSeating.js';
import type { LanguageDocument } from './document.js';
import type { Position } from './types.js';

/**
 * The copy path of the `[node]` section that holds the position, heading or body, or undefined on
 * any other line and on a node Godot does not seat in the tree.
 */
export function nodePathAt(document: LanguageDocument, position: Position): string | undefined {
  const section = document.sectionAt(position.line + 1);
  if (section?.kind !== 'node') return undefined;
  const path = seatedNodePaths(document).get(section);
  return path === undefined ? undefined : spelledNodePath(path);
}
