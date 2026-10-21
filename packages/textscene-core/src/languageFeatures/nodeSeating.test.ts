/** The `[node]` headings of a document, seated as the parsers seat them. */

import { describe, it, expect } from 'vitest';
import { LanguageDocument } from './document';
import { nodeSectionOfPath, seatedNodeTree } from './nodeSeating';
import { INSTANCED_TREE, NODE_TREE_HEAD } from './fixtures.testkit';

const NESTED = new LanguageDocument(NODE_TREE_HEAD.join('\n'));

describe('nodeSectionOfPath', () => {
  it('finds the heading a root-relative path names', () => {
    expect(nodeSectionOfPath(NESTED, 'Player/Sprite')?.attributes.name).toBe('Sprite');
  });

  it('finds no heading for a path this file never declares', () => {
    expect(nodeSectionOfPath(NESTED, 'Player/Missing')).toBeUndefined();
  });

  it('finds a heading seated inside an instance at the path its parent= spells', () => {
    const document = new LanguageDocument(INSTANCED_TREE);
    expect(nodeSectionOfPath(document, 'Inst/Sub/X/Y')?.attributes.name).toBe('Y');
  });
});

describe('seatedNodeTree', () => {
  it('seats each heading under its parent, the scene root first', () => {
    const [root] = seatedNodeTree(NESTED);
    expect(root?.section.attributes.name).toBe('Root');
    expect(root?.children.map(({ section }) => section.attributes.name)).toEqual(['Player']);
  });

  it('seats a heading whose parent= names nothing under the root, as Godot re-roots it', () => {
    const source = [...NODE_TREE_HEAD, '[node name="Lost" type="Node3D" parent="Nowhere"]', ''].join('\n');
    const [root] = seatedNodeTree(new LanguageDocument(source));
    expect(root?.children.map(({ section }) => section.attributes.name)).toEqual(['Player', 'Lost']);
  });

  it('lists a heading Godot does not seat after the root, in line order', () => {
    // A second parentless heading refuses the scene (packed_scene.cpp:207), so nothing re-roots.
    const source = [...NODE_TREE_HEAD, '[node name="Stray" type="Node3D"]', ''].join('\n');
    const names = seatedNodeTree(new LanguageDocument(source)).map(({ section }) => section.attributes.name);
    expect(names).toEqual(['Root', 'Stray']);
  });

  it('is empty for a document with no node heading', () => {
    expect(seatedNodeTree(new LanguageDocument('[gd_scene format=3]\n'))).toEqual([]);
  });
});
