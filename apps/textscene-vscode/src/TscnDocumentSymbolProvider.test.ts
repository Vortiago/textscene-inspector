/** Tests for TscnDocumentSymbolProvider, the symbols of the Outline view. */

import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { TscnDocumentSymbolProvider } from './TscnDocumentSymbolProvider';

function createMockDocument(content: string): vscode.TextDocument {
  const lines = content.split('\n');
  return {
    getText: () => content,
    lineAt: (line: number) => ({
      text: lines[line] || '',
      lineNumber: line,
    }),
    lineCount: lines.length,
    uri: vscode.Uri.file('/test.tscn'),
  } as unknown as vscode.TextDocument;
}

const mockCancellationToken: vscode.CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: vi.fn(),
};

/**
 * The provider's return type is the API's `ProviderResult`, but its body is
 * synchronous and always returns an array. Narrowing once here keeps every
 * assertion below reading a `DocumentSymbol[]`.
 */
function symbolsOf(
  provider: TscnDocumentSymbolProvider,
  document: vscode.TextDocument
): vscode.DocumentSymbol[] {
  const result = provider.provideDocumentSymbols(document, mockCancellationToken);
  if (!Array.isArray(result)) {
    throw new Error('provideDocumentSymbols returned a thenable, not an array');
  }
  return result;
}

describe('TscnDocumentSymbolProvider', () => {
  describe('Symbol Extraction', () => {
    it('should provide symbols for simple scene', () => {
      const tscnContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Player" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_abc123")

[node name="Camera" type="Camera3D" parent="Player"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 5)
`;

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols).toHaveLength(1); // Root
      expect(symbols[0]!.name).toBe('Root');
      expect(symbols[0]!.detail).toBe('Node3D');
      expect(symbols[0]!.children).toHaveLength(1); // Player
      expect(symbols[0]!.children[0]!.name).toBe('Player');
      expect(symbols[0]!.children[0]!.detail).toBe('MeshInstance3D');
      expect(symbols[0]!.children[0]!.children).toHaveLength(1); // Camera
      expect(symbols[0]!.children[0]!.children[0]!.name).toBe('Camera');
      expect(symbols[0]!.children[0]!.children[0]!.detail).toBe('Camera3D');
    });

    it('should assign correct symbol kinds', () => {
      const tscnContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Mesh" type="MeshInstance3D" parent="."]

[node name="Light" type="SpotLight3D" parent="."]

[node name="Cam" type="Camera3D" parent="."]
`;

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols).toHaveLength(1);
      expect(symbols[0]!.kind).toBe(vscode.SymbolKind.Module); // Node3D
      expect(symbols[0]!.children).toHaveLength(3);

      const meshChild = symbols[0]!.children.find(c => c.name === 'Mesh');
      const lightChild = symbols[0]!.children.find(c => c.name === 'Light');
      const camChild = symbols[0]!.children.find(c => c.name === 'Cam');

      expect(meshChild?.kind).toBe(vscode.SymbolKind.Class); // MeshInstance3D
      expect(lightChild?.kind).toBe(vscode.SymbolKind.Object); // SpotLight3D
      expect(camChild?.kind).toBe(vscode.SymbolKind.Struct); // Camera3D
    });

    it('should use default symbol kind for unknown node types', () => {
      const tscnContent = `[gd_scene format=3]

[node name="Root" type="CustomNodeType"]
`;

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols[0]!.kind).toBe(vscode.SymbolKind.Object); // Default fallback
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty files', () => {
      const document = createMockDocument('[gd_scene format=3]\n');
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols).toEqual([]);
    });

    it('should handle parse errors gracefully', () => {
      const document = createMockDocument('invalid tscn content @#$%');
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      // Should return empty array, not throw
      expect(symbols).toEqual([]);
    });

    it('should handle scene with single root', () => {
      const tscnContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
`;

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols).toHaveLength(1);
      expect(symbols[0]!.name).toBe('Root');
      expect(symbols[0]!.children).toHaveLength(1);
      expect(symbols[0]!.children[0]!.name).toBe('Child');
    });

    it('should handle deeply nested hierarchies', () => {
      const tscnContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Level1" type="Node3D" parent="."]

[node name="Level2" type="Node3D" parent="Level1"]

[node name="Level3" type="Node3D" parent="Level1/Level2"]
`;

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols).toHaveLength(1);
      expect(symbols[0]!.children).toHaveLength(1); // Level1
      expect(symbols[0]!.children[0]!.children).toHaveLength(1); // Level2
      expect(symbols[0]!.children[0]!.children[0]!.children).toHaveLength(1); // Level3
      expect(symbols[0]!.children[0]!.children[0]!.children[0]!.name).toBe('Level3');
    });
  });

  describe('Range Calculation', () => {
    it('should calculate ranges for nodes', () => {
      const tscnContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[node name="Child" type="Node3D" parent="."]
`;

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols).toHaveLength(1);
      expect(symbols[0]!.name).toBe('Root');
      expect(symbols[0]!.range).toBeDefined();
      expect(symbols[0]!.selectionRange).toBeDefined();
    });

    it('should assign ranges for nested nodes', () => {
      const tscnContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
visible = true

[node name="Child" type="Node3D" parent="."]
`;

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols[0]!.children).toHaveLength(1);
      expect(symbols[0]!.children[0]!.range).toBeDefined();
      expect(symbols[0]!.children[0]!.selectionRange).toBeDefined();
    });
  });

  describe('Duplicate Sibling Resolution', () => {
    it('resolves a duplicate child name using the exact parent, not a substring match', () => {
      // "Leaf" appears under both "AB" and "B". A loose `parentValue.includes(parentName)`
      // match treats "AB" as parent "B", since "AB".includes("B").
      const tscnContent = [
        '[gd_scene format=3]',
        '[node name="Root" type="Node3D"]',
        '[node name="AB" type="Node3D" parent="."]',
        '[node name="B" type="Node3D" parent="."]',
        '[node name="Leaf" type="Node3D" parent="AB"]',
        '[node name="Leaf" type="Node3D" parent="B"]',
      ].join('\n');

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      const ab = symbols[0]!.children.find(c => c.name === 'AB')!;
      const b = symbols[0]!.children.find(c => c.name === 'B')!;

      expect(ab.children[0]!.selectionRange.start).toBe(4);
      expect(b.children[0]!.selectionRange.start).toBe(5);
    });

    it('resolves a nested duplicate name using the full ancestor path, not just the immediate parent', () => {
      // "Target" appears once under "Foo/X" and once under "Bar/X". The immediate
      // parent name alone ("X") is identical for both, so a resolver that only
      // tracks the immediate parent (not the full Godot parent= path) cannot tell
      // them apart.
      const tscnContent = [
        '[gd_scene format=3]',
        '[node name="Root" type="Node3D"]',
        '[node name="Foo" type="Node3D" parent="."]',
        '[node name="Bar" type="Node3D" parent="."]',
        '[node name="X" type="Node3D" parent="Foo"]',
        '[node name="X" type="Node3D" parent="Bar"]',
        '[node name="Target" type="Node3D" parent="Foo/X"]',
        '[node name="Target" type="Node3D" parent="Bar/X"]',
      ].join('\n');

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      const foo = symbols[0]!.children.find(c => c.name === 'Foo')!;
      const bar = symbols[0]!.children.find(c => c.name === 'Bar')!;
      const targetUnderFoo = foo.children[0]!.children[0]!;
      const targetUnderBar = bar.children[0]!.children[0]!;

      expect(targetUnderFoo.selectionRange.start).toBe(6);
      expect(targetUnderBar.selectionRange.start).toBe(7);
    });
  });

  describe('Light Node Types', () => {
    it('should recognize all light types with correct symbols', () => {
      const tscnContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Spot" type="SpotLight3D" parent="."]

[node name="Directional" type="DirectionalLight3D" parent="."]

[node name="Omni" type="OmniLight3D" parent="."]
`;

      const document = createMockDocument(tscnContent);
      const provider = new TscnDocumentSymbolProvider();
      const symbols = symbolsOf(provider, document);

      expect(symbols[0]!.children).toHaveLength(3);
      expect(symbols[0]!.children[0]!.kind).toBe(vscode.SymbolKind.Object); // SpotLight3D
      expect(symbols[0]!.children[1]!.kind).toBe(vscode.SymbolKind.Object); // DirectionalLight3D
      expect(symbols[0]!.children[2]!.kind).toBe(vscode.SymbolKind.Object); // OmniLight3D
    });
  });
});
