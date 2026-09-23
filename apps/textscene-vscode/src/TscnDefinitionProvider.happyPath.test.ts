/**
 * `TscnDefinitionProvider`: resolving a SubResource or ExtResource reference to its heading.
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

  describe('SubResource - Happy Path', () => {
    it('should find SubResource definition with double quotes', () => {
      const content = `[node name="Player" type="MeshInstance3D"]
mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]
size = Vector3(1, 2, 1)`;

      const document = createMockDocument(content);
      const position = new vscode.Position(1, 15); // Inside "SubResource"

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition).toBeInstanceOf(vscode.Location);
      expect(definition.range.start.line).toBe(3);
      expect(definition.uri.toString()).toBe(document.uri.toString());
    });

    it('should find SubResource definition with single quotes', () => {
      const content = `mesh = SubResource('Material_xyz')

[sub_resource type="StandardMaterial3D" id="Material_xyz"]
albedo_color = Color(1, 0, 0, 1)`;

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

    it('should find SubResource definition with spaces around quotes', () => {
      const content = `shape = SubResource( "Shape_123" )

[sub_resource type="Shape" id="Shape_123"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 18);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });
  });

  describe('ExtResource - Happy Path', () => {
    it('should find ExtResource definition', () => {
      const content = `[ext_resource type="PackedScene" path="res://scenes/Door.tscn" id="Door_scene"]

[node name="Door1" instance=ExtResource("Door_scene")]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(2, 35);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(0);
    });

    it('should find ExtResource with texture type', () => {
      const content = `[ext_resource type="Texture2D" path="res://textures/wood.png" id="wood_texture"]

[node name="Sprite" type="Sprite2D"]
texture = ExtResource("wood_texture")`;

      const document = createMockDocument(content);
      const position = new vscode.Position(3, 25);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(0);
    });
  });
});
