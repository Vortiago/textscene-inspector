/**
 * `TscnDefinitionProvider`: resource ids that are not plain identifiers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { TscnDefinitionProvider } from './TscnDefinitionProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';

describe('TscnDefinitionProvider', () => {
  let provider: TscnDefinitionProvider;
  let mockCancellationToken: vscode.CancellationToken;

  beforeEach(() => {
    provider = new TscnDefinitionProvider();
    mockCancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: vi.fn(),
    };
  });

  describe('a heading that carries a uid, which is what Godot 4.x writes', () => {
    // `uid` ends in `id`, so an unanchored /id\s*=\s*"…"/ captures the uid and
    // Go-to-Definition returns null. Most ext_resource headings write uid= before
    // id=. A sub_resource heading carries no uid.
    it('resolves an ext_resource whose uid precedes its id', () => {
      const content = `texture = ExtResource("1_abc")

[ext_resource type="Texture2D" uid="uid://bi18l6iy7jkou" path="res://vase.png" id="1_abc"]`;

      const document = createMockDocument(content);
      const definition = provider.provideDefinition(
        document,
        new vscode.Position(0, 25),
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('does not mistake the uid itself for the id', () => {
      const content = `texture = ExtResource("uid://bi18l6iy7jkou")

[ext_resource type="Texture2D" uid="uid://bi18l6iy7jkou" path="res://vase.png" id="1_abc"]`;

      const document = createMockDocument(content);
      expect(
        provider.provideDefinition(document, new vscode.Position(0, 25), mockCancellationToken)
      ).toBeNull();
    });
  });

  describe('Special Characters in IDs', () => {
    it('should handle IDs with dashes', () => {
      const content = `mesh = SubResource("Mesh_123-456")

[sub_resource type="BoxMesh" id="Mesh_123-456"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 20);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('should handle IDs with dots', () => {
      const content = `material = SubResource("Material.Main")

[sub_resource type="Material" id="Material.Main"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 25);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('should handle IDs with @ symbol', () => {
      const content = `texture = SubResource("Texture@2x")

[sub_resource type="Texture" id="Texture@2x"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 20);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('should handle IDs with underscores and numbers', () => {
      const content = `mesh = SubResource("Mesh_123_abc_456")

[sub_resource type="BoxMesh" id="Mesh_123_abc_456"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 20);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('should handle very long IDs', () => {
      const longId = 'VeryLongResourceId_' + 'x'.repeat(100);
      const content = `mesh = SubResource("${longId}")

[sub_resource type="BoxMesh" id="${longId}"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 20);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });
  });
});
