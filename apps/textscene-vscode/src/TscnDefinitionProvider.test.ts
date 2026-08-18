import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { TscnDefinitionProvider } from './TscnDefinitionProvider';

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
  // HAPPY PATH TESTS - SubResource
  // ============================================================================

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

  // ============================================================================
  // HAPPY PATH TESTS - ExtResource
  // ============================================================================

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

    it('should find ExtResource on a heading that also carries a uid', () => {
      // Godot 4 writes `uid=` on every ext_resource, and an unanchored `id=`
      // match reads the uid instead — leaving go-to-definition dead on the
      // shape that occurs in every real scene.
      const content = `[ext_resource type="Texture2D" uid="uid://cabc123" path="res://icon.svg" id="1_x7k2n"]

[node name="Sprite" type="Sprite2D"]
texture = ExtResource("1_x7k2n")`;

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

  // ============================================================================
  // EDGE CASES - Special Characters in IDs
  // ============================================================================

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

  // ============================================================================
  // ERROR CONDITIONS - Not Found
  // ============================================================================

  describe('Error Conditions - Not Found', () => {
    it('should return null when resource definition not found', () => {
      const content = `[node name="Player" type="MeshInstance3D"]
mesh = SubResource("NonExistent")`;

      const document = createMockDocument(content);
      const position = new vscode.Position(1, 15);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      );

      expect(definition).toBeNull();
    });

    it('should return null when cursor not on resource reference', () => {
      const content = `[node name="Player" type="MeshInstance3D"]
mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(1, 0); // Start of line, not on resource

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      );

      expect(definition).toBeNull();
    });

    it('should return null when cursor is just after resource reference', () => {
      const content = `mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 32); // Right after closing paren

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      );

      expect(definition).toBeNull();
    });

    it('should return null for empty document', () => {
      const content = '';
      const document = createMockDocument(content);
      const position = new vscode.Position(0, 0);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      );

      expect(definition).toBeNull();
    });

    it('should return null when document has no resource definitions', () => {
      const content = `[node name="Player" type="MeshInstance3D"]
mesh = SubResource("BoxMesh_1")`;

      const document = createMockDocument(content);
      const position = new vscode.Position(1, 15);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      );

      expect(definition).toBeNull();
    });
  });

  // ============================================================================
  // BOUNDARY CONDITIONS - Cursor Position
  // ============================================================================

  describe('Boundary Conditions - Cursor Position', () => {
    it('should find definition when cursor is at start of SubResource keyword', () => {
      const content = `mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 7); // Start of "SubResource"

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('should find definition when cursor is at end of closing parenthesis', () => {
      const content = `mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 31); // On closing paren

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('should find definition when cursor is on the ID string', () => {
      const content = `mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 22); // Inside "BoxMesh_1"

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('should return null when cursor is one character before SubResource', () => {
      const content = `mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 6); // Before "SubResource"

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      );

      expect(definition).toBeNull();
    });
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
  // EDGE CASES - Malformed Input
  // ============================================================================

  describe('Malformed Input', () => {
    it('should return null when resource heading is missing id attribute', () => {
      const content = `mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 15);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      );

      expect(definition).toBeNull();
    });

    it('should handle resource heading with id attribute using single quotes', () => {
      const content = `mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id='BoxMesh_1']`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 15);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });

    it('should handle resource heading with extra spaces around equals', () => {
      const content = `mesh = SubResource("BoxMesh_1")

[sub_resource type="BoxMesh" id = "BoxMesh_1"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 15);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(2);
    });
  });

  // ============================================================================
  // EDGE CASES - Mixed SubResource and ExtResource
  // ============================================================================

  describe('Mixed SubResource and ExtResource', () => {
    it('should correctly distinguish between SubResource and ExtResource', () => {
      const content = `[ext_resource type="PackedScene" path="res://Door.tscn" id="Door"]

mesh = SubResource("BoxMesh_1")
instance = ExtResource("Door")

[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);

      // SubResource
      const subDef = provider.provideDefinition(
        document,
        new vscode.Position(2, 15),
        mockCancellationToken
      ) as vscode.Location;

      expect(subDef).toBeDefined();
      expect(subDef.range.start.line).toBe(5);

      // ExtResource
      const extDef = provider.provideDefinition(
        document,
        new vscode.Position(3, 20),
        mockCancellationToken
      ) as vscode.Location;

      expect(extDef).toBeDefined();
      expect(extDef.range.start.line).toBe(0);
    });

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

  // ============================================================================
  // BOUNDARY CONDITIONS - Document Boundaries
  // ============================================================================

  describe('Document Boundaries', () => {
    it('should find definition when resource is on first line', () => {
      const content = `mesh = SubResource("BoxMesh_1")
[sub_resource type="BoxMesh" id="BoxMesh_1"]`;

      const document = createMockDocument(content);
      const position = new vscode.Position(0, 15);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(1);
    });

    it('should find definition when resource heading is on first line', () => {
      const content = `[sub_resource type="BoxMesh" id="BoxMesh_1"]

mesh = SubResource("BoxMesh_1")`;

      const document = createMockDocument(content);
      const position = new vscode.Position(2, 15);

      const definition = provider.provideDefinition(
        document,
        position,
        mockCancellationToken
      ) as vscode.Location;

      expect(definition).toBeDefined();
      expect(definition.range.start.line).toBe(0);
    });

    it('should find definition when resource is on last line', () => {
      const content = `[sub_resource type="BoxMesh" id="BoxMesh_1"]

mesh = SubResource("BoxMesh_1")`;

      const document = createMockDocument(content);
      const position = new vscode.Position(2, 15);

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

// ============================================================================
// MOCK HELPERS
// ============================================================================

function createMockDocument(content: string): vscode.TextDocument {
  const lines = content.split('\n');
  return {
    getText: () => content,
    lineAt: (lineOrPosition: number | vscode.Position) => {
      const lineNumber =
        typeof lineOrPosition === 'number'
          ? lineOrPosition
          : lineOrPosition.line;
      return {
        text: lines[lineNumber] || '',
        lineNumber: lineNumber,
        range: new vscode.Range(
          new vscode.Position(lineNumber, 0),
          new vscode.Position(lineNumber, (lines[lineNumber] || '').length)
        ),
        rangeIncludingLineBreak: new vscode.Range(
          new vscode.Position(lineNumber, 0),
          new vscode.Position(lineNumber + 1, 0)
        ),
        firstNonWhitespaceCharacterIndex: 0,
        isEmptyOrWhitespace: (lines[lineNumber] || '').trim().length === 0,
      };
    },
    lineCount: lines.length,
    uri: vscode.Uri.file('/test.tscn'),
  } as vscode.TextDocument;
}
