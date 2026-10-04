/** Tests for the scene tree built as hierarchical document symbols. */

import { describe, it, expect } from 'vitest';
import { SymbolKind, type DocumentSymbol } from 'vscode-languageserver/node';
import { createLanguageDocument } from '@textscene/core/languageFeatures';
import { documentSymbols } from './symbols';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Player" type="CharacterBody3D" parent="."]
speed = 5.0

[node name="Hand" type="Node3D" parent="Player"]

[node name="Mesh" type="MeshInstance3D" parent="Player/Hand"]
`;

function childrenOf(symbol: DocumentSymbol): DocumentSymbol[] {
  return symbol.children ?? [];
}

function only(symbols: readonly DocumentSymbol[]): DocumentSymbol {
  const first = symbols[0];
  if (first === undefined) throw new Error('expected a symbol');
  return first;
}

describe('documentSymbols', () => {
  it('nests each node under the parent its parent= names', () => {
    const root = only(documentSymbols(createLanguageDocument(SCENE)));

    expect(root.name).toBe('Root');
    expect(root.detail).toBe('Node3D');
    expect(root.kind).toBe(SymbolKind.Object);

    const player = only(childrenOf(root));
    expect(player.name).toBe('Player');
    expect(player.detail).toBe('CharacterBody3D');

    const hand = only(childrenOf(player));
    expect(hand.name).toBe('Hand');
    expect(only(childrenOf(hand)).name).toBe('Mesh');
  });

  it('reaches a node range through its deepest descendant', () => {
    const root = only(documentSymbols(createLanguageDocument(SCENE)));

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
    const root = only(documentSymbols(createLanguageDocument(SCENE)));
    const player = only(childrenOf(root));
    const hand = only(childrenOf(player));
    const mesh = only(childrenOf(hand));

    expect(mesh.range.start.line).toBe(9);
    expect(mesh.range.end.line).toBe(9);
    expect(childrenOf(mesh)).toEqual([]);
  });

  it('gives an empty document no symbols', () => {
    expect(documentSymbols(createLanguageDocument(''))).toEqual([]);
  });

  it('keeps a node whose parent heading is missing as a second root', () => {
    const orphan = `[gd_scene format=3]

[node name="Loose" type="Node3D" parent="Gone"]
`;

    const symbols = documentSymbols(createLanguageDocument(orphan));

    expect(symbols.map((symbol) => symbol.name)).toEqual(['Loose']);
  });
});
