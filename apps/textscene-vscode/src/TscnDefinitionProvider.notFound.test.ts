/**
 * `TscnDefinitionProvider` — the cases that resolve to nothing, and exactly where a reference stops.
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
});
