/**
 * `TscnDefinitionProvider` — several references, several resources, and the two namespaces side by side.
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

  // ============================================================================
  // EDGE CASES - Multiple References
  // ============================================================================

  describe('Multiple References', () => {
    it('should handle multiple references to the same resource', () => {
      const content = `mesh = SubResource("BoxMesh_1")
collision_mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);

      // First reference
      const def1 = provider.provideDefinition(
        document,
        new vscode.Position(0, 15),
        mockCancellationToken
      ) as vscode.Location;

      expect(def1).toBeDefined();
      expect(def1.range.start.line).toBe(3);

      // Second reference
      const def2 = provider.provideDefinition(
        document,
        new vscode.Position(1, 25),
        mockCancellationToken
      ) as vscode.Location;

      expect(def2).toBeDefined();
      expect(def2.range.start.line).toBe(3);
    });

    it('should handle multiple resources on the same line', () => {
      const content = `mesh = SubResource("Mesh_1") material = SubResource("Mat_1")

[sub_resource type="BoxMesh" id="Mesh_1"]
[sub_resource type="Material" id="Mat_1"]`;

      const document = createMockDocument(content);

      // First resource
      const def1 = provider.provideDefinition(
        document,
        new vscode.Position(0, 15),
        mockCancellationToken
      ) as vscode.Location;

      expect(def1).toBeDefined();
      expect(def1.range.start.line).toBe(2);

      // Second resource
      const def2 = provider.provideDefinition(
        document,
        new vscode.Position(0, 45),
        mockCancellationToken
      ) as vscode.Location;

      expect(def2).toBeDefined();
      expect(def2.range.start.line).toBe(3);
    });

    it('should return first match when duplicate resource IDs exist', () => {
      const content = `mesh = SubResource("Duplicate")

[sub_resource type="BoxMesh" id="Duplicate"]
[sub_resource type="SphereMesh" id="Duplicate"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 15);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2); // First match
    });
  });

  // ============================================================================
  // EDGE CASES - Mixed SubResource and ExtResource
  // ============================================================================

  describe('Mixed SubResource and ExtResource', () => {
    // Same id in both namespaces: the only shape where a kind-blind lookup is catchable.
    it('should not confuse SubResource and ExtResource with same ID', () => {
      const content = `[ext_resource type="PackedScene" path="res://Scene.tscn" id="Resource_1"]

mesh = SubResource("Resource_1")
instance = ExtResource("Resource_1")

[sub_resource type="BoxMesh" id="Resource_1"]`;

      const document = createMockDocument(content);

      // SubResource should find sub_resource heading
      const subDef = provider.provideDefinition(
        document,
        new vscode.Position(2, 15),
        mockCancellationToken
      ) as vscode.Location;

      expect(subDef).toBeDefined();
      expect(subDef.range.start.line).toBe(5);

      // ExtResource should find ext_resource heading
      const extDef = provider.provideDefinition(
        document,
        new vscode.Position(3, 20),
        mockCancellationToken
      ) as vscode.Location;

      expect(extDef).toBeDefined();
      expect(extDef.range.start.line).toBe(0);
    });
  });
});
