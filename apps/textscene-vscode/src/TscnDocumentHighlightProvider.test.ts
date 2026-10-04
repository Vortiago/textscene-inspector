import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { TscnDocumentHighlightProvider } from './TscnDocumentHighlightProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';

const TOKEN = {} as vscode.CancellationToken;

describe('TscnDocumentHighlightProvider', () => {
  it('highlights every use of an id and its declaration', () => {
    const text = [
      '[ext_resource type="PackedScene" path="res://door.tscn" id="1_door"]',
      '',
      '[node name="M" type="MeshInstance3D"]',
      'mesh = ExtResource("1_door")',
    ].join('\n');
    const highlights = new TscnDocumentHighlightProvider().provideDocumentHighlights(
      createMockDocument(text),
      new vscode.Position(3, 'mesh = ExtResource("'.length + 2),
      TOKEN
    );
    expect(highlights.map((highlight) => highlight.range.start.line).sort((a, b) => a - b)).toEqual([0, 3]);
  });

  it('highlights nothing away from a reference', () => {
    const highlights = new TscnDocumentHighlightProvider().provideDocumentHighlights(
      createMockDocument('[node name="R" type="Node3D"]'),
      new vscode.Position(0, 2),
      TOKEN
    );
    expect(highlights).toEqual([]);
  });
});
