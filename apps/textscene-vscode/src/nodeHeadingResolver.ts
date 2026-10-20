/**
 * The `[node …]` heading a scene-tree node names, for "jump to node". The language-feature engine
 * seats the headings as Godot does, so two same-named nodes under different parents resolve apart.
 */

import { createLanguageDocument, nodeDeclarationRange } from '@textscene/core/languageFeatures';

/**
 * The 0-based line of the heading of the node at `treePath`, or undefined where the file declares
 * no such node. `treePath` is the scene-tree path from the root, its first segment the root's name:
 * "Root/B/Leaf". It skips the `parent=` value, which a root may also carry (`packed_scene.cpp:218`).
 */
export function nodeHeadingLine(text: string, treePath: string): number | undefined {
  const pathFromRoot = treePath.split('/').slice(1).join('/') || '.';
  return nodeDeclarationRange(createLanguageDocument(text), pathFromRoot)?.start.line;
}
