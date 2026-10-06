import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { TscnCompletionItemProvider } from './TscnCompletionItemProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';

const TOKEN = {} as vscode.CancellationToken;
const CONTEXT = {} as vscode.CompletionContext;

describe('TscnCompletionItemProvider', () => {
  it('offers node classes inside a heading type=', async () => {
    const text = '[node name="R" type="No"]';
    const items = await new TscnCompletionItemProvider().provideCompletionItems(
      createMockDocument(text),
      new vscode.Position(0, text.indexOf('No') + 2),
      TOKEN,
      CONTEXT
    );
    expect(items.map((item) => item.label)).toContain('Node3D');
    expect(items[0]?.kind).toBe(vscode.CompletionItemKind.Class);
  });

  it('offers the properties a node does not already set', async () => {
    const text = ['[node name="M" type="MeshInstance3D"]', 'mesh = null'].join('\n');
    const items = await new TscnCompletionItemProvider().provideCompletionItems(
      createMockDocument(text),
      new vscode.Position(1, 0),
      TOKEN,
      CONTEXT
    );
    expect(items.map((item) => item.label)).toContain('visible');
    expect(items.map((item) => item.label)).not.toContain('mesh');
  });

  it('offers res:// paths through the project listing', async () => {
    const listing = { pathsFor: async () => ['res://scenes/Door.tscn'] };
    const text = ['[node name="M" type="MeshInstance3D"]', 'mesh = "res://sc'].join('\n');
    const items = await new TscnCompletionItemProvider(listing).provideCompletionItems(
      createMockDocument(text),
      new vscode.Position(1, text.split('\n')[1]!.length),
      TOKEN,
      CONTEXT
    );
    expect(items.map((item) => item.label)).toEqual(['res://scenes/Door.tscn']);
  });

  it('replaces the res:// text typed so far, not the word VS Code would pick', async () => {
    const listing = { pathsFor: async () => ['res://art/a.png'] };
    const line = 'mesh = "res://art/"';
    const cursor = line.indexOf('art/') + 'art/'.length;
    const items = await new TscnCompletionItemProvider(listing).provideCompletionItems(
      createMockDocument(['[node name="M" type="MeshInstance3D"]', line].join('\n')),
      new vscode.Position(1, cursor),
      TOKEN,
      CONTEXT
    );
    expect(items[0]?.range).toEqual(new vscode.Range(1, line.indexOf('res://'), 1, cursor));
  });
});
