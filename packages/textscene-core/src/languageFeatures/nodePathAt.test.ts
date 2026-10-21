/** The path Godot's "Copy Node Path" writes for the node section under the cursor. */

import { describe, it, expect } from 'vitest';
import { LanguageDocument } from './document';
import { nodePathAt } from './nodePathAt';
import { INSTANCED_TREE, NODE_TREE_HEAD } from './fixtures.testkit';

const NESTED = new LanguageDocument(
  [...NODE_TREE_HEAD, '[ext_resource path="res://a.png" type="Texture2D" id="1"]', ''].join('\n')
);

describe('nodePathAt', () => {
  it.each([
    ['the scene root (node_path.cpp:301-302)', 2, '.'],
    ['a child of the root, by its name alone', 4, 'Player'],
    ['a deeper node, from the root and without its name', 6, 'Player/Sprite'],
  ])('copies %s', (_what, line, expected) => {
    expect(nodePathAt(NESTED, { line, character: 3 })).toBe(expected);
  });

  it('answers for a body line of a node section', () => {
    const document = new LanguageDocument(
      [
        '[gd_scene format=3]',
        '[node name="Root" type="Node3D"]',
        '[node name="A" type="Node3D" parent="."]',
        'visible = false',
      ].join('\n')
    );
    expect(nodePathAt(document, { line: 3, character: 2 })).toBe('A');
  });

  it('copies a heading seated inside an instance at the path its parent= spells', () => {
    expect(nodePathAt(new LanguageDocument(INSTANCED_TREE), { line: 6, character: 0 })).toBe('Inst/Sub/X');
  });

  it('answers undefined on a line outside every node section', () => {
    expect(nodePathAt(NESTED, { line: 10, character: 0 })).toBeUndefined();
  });
});
