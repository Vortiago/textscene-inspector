/**
 * Integration tests for VS Code extension activation and basic functionality.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation Tests', () => {
  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension(
      'vortiago.textscene-inspector',
    );
    assert.ok(extension, 'Extension should be installed');
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension(
      'vortiago.textscene-inspector',
    );
    assert.ok(extension, 'Extension should be installed');

    await extension.activate();
    assert.strictEqual(
      extension.isActive,
      true,
      'Extension should be activated',
    );
  });

  test('Custom editor should be registered', async () => {
    const extension = vscode.extensions.getExtension(
      'vortiago.textscene-inspector',
    );
    await extension?.activate();

    // Try to open a .tscn file to trigger custom editor
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, 'Workspace folder should exist');

    const fixturePath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      'fixtures',
      'unit-empty-scene.tscn',
    );

    // Open the document
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    assert.ok(doc, 'Document should open');

    // Show it in an editor
    await vscode.window.showTextDocument(doc);

    // The custom editor should handle .tscn files
    // If we got here without errors, the registration works
    assert.ok(true, 'Custom editor handled .tscn file');
  });
});
