/** The scene tree as hierarchical document symbols. */

import { describe, it, expect } from 'vitest';
import { LanguageDocument } from './document';
import { documentSymbols } from './symbols';
import type { DocumentSymbol } from './types';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Player" type="CharacterBody3D" parent="."]
speed = 5.0

[node name="Hand" type="Node3D" parent="Player"]

[node name="Mesh" type="MeshInstance3D" parent="Player/Hand"]
`;

function only(symbols: readonly DocumentSymbol[]): DocumentSymbol {
  const [first] = symbols;
  if (symbols.length !== 1 || first === undefined) {
    throw new Error(`expected one symbol, got ${symbols.length}`);
  }
  return first;
}

describe('documentSymbols', () => {
  it('nests each node under the parent its parent= names', () => {
    const root = only(documentSymbols(new LanguageDocument(SCENE)));

    expect(root.name).toBe('Root');
    expect(root.detail).toBe('Node3D');
    expect(root.kind).toBe('module');

    const player = only(root.children);
    expect(player.name).toBe('Player');
    expect(player.detail).toBe('CharacterBody3D');
    expect(player.kind).toBe('object');

    const hand = only(player.children);
    expect(hand.name).toBe('Hand');
    expect(only(hand.children).name).toBe('Mesh');
  });

  it('reaches a node range through its deepest descendant', () => {
    const root = only(documentSymbols(new LanguageDocument(SCENE)));

    // The last line is the deepest heading, so the root folds the whole tree.
    expect(root.range).toEqual({
      start: { line: 2, character: 0 },
      end: { line: 9, character: '[node name="Mesh" type="MeshInstance3D" parent="Player/Hand"]'.length },
    });
    expect(root.selectionRange).toEqual({
      start: { line: 2, character: 0 },
      end: { line: 2, character: '[node name="Root" type="Node3D"]'.length },
    });
  });

  it('gives a leaf a range that ends on its own last line', () => {
    const root = only(documentSymbols(new LanguageDocument(SCENE)));
    const player = only(root.children);
    const hand = only(player.children);
    const mesh = only(hand.children);

    expect(mesh.range.start.line).toBe(9);
    expect(mesh.range.end.line).toBe(9);
    expect(mesh.children).toEqual([]);
  });

  it('gives an empty document no symbols', () => {
    expect(documentSymbols(new LanguageDocument(''))).toEqual([]);
  });

  it('leaves out a node whose name is still empty, as while a heading is typed', () => {
    const typing = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="" type="Node3D" parent="."]
`;

    const root = only(documentSymbols(new LanguageDocument(typing)));

    expect(root.children).toEqual([]);
  });

  it('keeps a node whose parent heading is missing as a second root', () => {
    const orphan = `[gd_scene format=3]

[node name="Loose" type="Node3D" parent="Gone"]
`;

    const symbols = documentSymbols(new LanguageDocument(orphan));

    expect(symbols.map((symbol) => symbol.name)).toEqual(['Loose']);
  });
});
