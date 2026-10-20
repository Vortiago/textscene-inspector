/**
 * `TscnDefinitionProvider`: a node path goes to the `[node]` heading it names.
 */
import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { TscnDefinitionProvider } from './TscnDefinitionProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';

const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) };

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Button" type="Button" parent="."]

[connection signal="pressed" from="Button" to="." method="_on_pressed"]
`;

async function definitionAt(line: number, needle: string): Promise<vscode.Location | null> {
  const document = createMockDocument(SCENE);
  const character = document.lineAt(line).text.indexOf(needle) + 1;
  return (await new TscnDefinitionProvider().provideDefinition(
    document,
    new vscode.Position(line, character),
    token
  )) as vscode.Location | null;
}

describe('TscnDefinitionProvider node paths', () => {
  it('goes from a from= path to the heading of that node', async () => {
    expect((await definitionAt(6, 'Button'))?.range.start.line).toBe(4);
  });

  it('goes from a to= of . to the root heading', async () => {
    expect((await definitionAt(6, '"."'))?.range.start.line).toBe(2);
  });

  it('gives nothing for a path no heading declares', async () => {
    const document = createMockDocument(SCENE.replace('from="Button"', 'from="Missing"'));
    const position = new vscode.Position(6, document.lineAt(6).text.indexOf('Missing') + 1);

    expect(await new TscnDefinitionProvider().provideDefinition(document, position, token)).toBeNull();
  });
});
