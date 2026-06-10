/**
 * Integration tests for representative scene fixtures.
 * Tests that fixture files can be opened in the custom editor.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Fixture Loading Tests', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../../.test-workspace');

  // Test a few representative fixtures instead of all 45
  const representativeFixtures = [
    { name: 'Empty Scene', file: 'unit-empty-scene.tscn', category: 'Unit - Basic' },
    { name: 'Box Mesh', file: 'unit-box-mesh.tscn', category: 'Unit - Primitives' },
    { name: 'External Texture', file: 'unit-external-texture.tscn', category: 'Unit - External' },
    { name: 'Complex Scene', file: 'example-hallway-mockup.tscn', category: 'Examples' },
  ];

  representativeFixtures.forEach((fixture) => {
    test(`should open ${fixture.name} (${fixture.category})`, async function () {
      // Increase timeout for complex scenes
      this.timeout(10000);

      // All files are in fixtures/ directory (setupWorkspace copies all there)
      const filePath = path.join(workspaceRoot, 'fixtures', fixture.file);

      // Convert to URI
      const fileUri = vscode.Uri.file(filePath);

      // Open the document (this should trigger the custom editor)
      const doc = await vscode.workspace.openTextDocument(fileUri);
      assert.ok(doc, `Should open document for ${fixture.file}`);

      // Show the document (triggers custom editor provider)
      await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });

      // Wait a bit for custom editor to activate
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify the tab is open
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        assert.strictEqual(
          activeEditor.document.uri.fsPath,
          filePath,
          `Active editor should be ${fixture.file}`
        );
      }

      // Close the editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

      // Wait a bit before opening next file
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });
});
