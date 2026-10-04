import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { TscnCodeActionProvider } from './TscnCodeActionProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';

const TOKEN = {} as vscode.CancellationToken;
const CONTEXT = {} as vscode.CodeActionContext;

describe('TscnCodeActionProvider', () => {
  it('offers a rename for a deprecated property spelling', () => {
    const text = ['[node name="S" type="AnimatedSprite2D"]', 'frames = ExtResource("1")'].join('\n');
    const actions = new TscnCodeActionProvider().provideCodeActions(
      createMockDocument(text),
      new vscode.Range(0, 0, 1, 0),
      CONTEXT,
      TOKEN
    );
    expect(actions[0]?.title).toContain('sprite_frames');
    const edit = actions[0]?.edit as unknown as { replaces: Array<{ newText: string }> } | undefined;
    expect(edit?.replaces[0]?.newText).toBe('sprite_frames');
  });

  it('repairs a property key typo in the edit', () => {
    const text = ['[node name="M" type="MeshInstance3D"]', 'mash = null'].join('\n');
    const actions = new TscnCodeActionProvider().provideCodeActions(
      createMockDocument(text),
      new vscode.Range(1, 0, 1, 4),
      CONTEXT,
      TOKEN
    );
    expect(actions.map((action) => action.title)).toEqual(["Change 'mash' to 'mesh'"]);
  });

  it('provides quick-fix kinds only', () => {
    const provider = new TscnCodeActionProvider();
    expect(provider.providedCodeActionKinds).toEqual([vscode.CodeActionKind.QuickFix]);
  });
});
