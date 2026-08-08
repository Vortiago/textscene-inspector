/**
 * `TscnDefinitionProvider` — headings the scan must tolerate, and references at the file’s edges.
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
