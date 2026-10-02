/** Integration tests: representative scene fixtures open in an editor in the tscn language. */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getFixturePath } from '../helpers/fixtureHelpers';

suite('Fixture Loading Tests', () => {
  const representativeFixtures = [
    { name: 'Empty Scene', file: 'unit-empty-scene.tscn', category: 'Unit - Basic' },
    { name: 'Box Mesh', file: 'unit-box-mesh.tscn', category: 'Unit - Primitives' },
    { name: 'External Texture', file: 'unit-external-texture.tscn', category: 'Unit - External' },
    { name: 'Complex Scene', file: 'example-hallway-mockup.tscn', category: 'Examples' },
  ];

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  representativeFixtures.forEach((fixture) => {
    test(`should open ${fixture.name} (${fixture.category})`, async function () {
      this.timeout(10000);
      const fileUri = getFixturePath(fixture.file);

      const editor = await vscode.window.showTextDocument(fileUri, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });

      assert.strictEqual(editor.document.uri.fsPath, fileUri.fsPath, `the editor shows ${fixture.file}`);
      assert.strictEqual(editor.document.languageId, 'tscn', `${fixture.file} opens in the tscn language`);
      assert.strictEqual(
        vscode.window.activeTextEditor?.document.uri.fsPath,
        fileUri.fsPath,
        `${fixture.file} is active`
      );
    });
  });
});
