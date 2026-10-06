import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { TscnHoverProvider } from './TscnHoverProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';

const TOKEN = {} as vscode.CancellationToken;

describe('TscnHoverProvider', () => {
  it('describes the class a heading names', () => {
    const text = '[node name="Root" type="Node3D"]';
    const hover = new TscnHoverProvider().provideHover(
      createMockDocument(text),
      new vscode.Position(0, text.indexOf('Node3D') + 2),
      TOKEN
    );
    expect((hover?.contents as unknown as vscode.MarkdownString).value).toContain('**Node3D**');
  });

  it('describes a property key and the resource it accepts', () => {
    const text = ['[node name="M" type="MeshInstance3D"]', 'mesh = null'].join('\n');
    const hover = new TscnHoverProvider().provideHover(
      createMockDocument(text),
      new vscode.Position(1, 1),
      TOKEN
    );
    expect((hover?.contents as unknown as vscode.MarkdownString).value).toContain('A resource of `Mesh`');
  });

  it('answers nothing where the position names no engine fact', () => {
    const hover = new TscnHoverProvider().provideHover(
      createMockDocument('[node name="R" type="Node3D"]'),
      new vscode.Position(0, 2),
      TOKEN
    );
    expect(hover).toBeUndefined();
  });
});
