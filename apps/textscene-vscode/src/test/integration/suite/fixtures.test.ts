/** Integration tests: representative scene fixtures open in an editor. */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Fixture Loading Tests', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../../.test-workspace');

  const representativeFixtures = [
    { name: 'Empty Scene', file: 'unit-empty-scene.tscn', category: 'Unit - Basic' },
    { name: 'Box Mesh', file: 'unit-box-mesh.tscn', category: 'Unit - Primitives' },
    { name: 'External Texture', file: 'unit-external-texture.tscn', category: 'Unit - External' },
    { name: 'Complex Scene', file: 'example-hallway-mockup.tscn', category: 'Examples' },
  ];

  representativeFixtures.forEach((fixture) => {
    test(`should open ${fixture.name} (${fixture.category})`, async function () {
      this.timeout(10000);

      // setupWorkspace copies every fixture into fixtures/.
      const filePath = path.join(workspaceRoot, 'fixtures', fixture.file);

      const fileUri = vscode.Uri.file(filePath);

      const doc = await vscode.workspace.openTextDocument(fileUri);
      assert.ok(doc, `Should open document for ${fixture.file}`);

      await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        assert.strictEqual(
          activeEditor.document.uri.fsPath,
          filePath,
          `Active editor should be ${fixture.file}`
        );
      }

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });
});
