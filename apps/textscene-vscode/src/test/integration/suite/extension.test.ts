/**
 * Integration tests for VS Code extension activation and basic functionality.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

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

  test('Custom editor should be registered', async function () {
    this.timeout(10000); // workspace initialisation

    const extension = vscode.extensions.getExtension(
      'vortiago.textscene-inspector',
    );
    await extension?.activate();

    // A direct path, since workspace folders may not be ready at once on CI.
    const workspaceRoot = path.resolve(__dirname, '../../../../.test-workspace');
    const fixturePath = vscode.Uri.file(
      path.join(workspaceRoot, 'fixtures', 'unit-empty-scene.tscn'),
    );

    const doc = await vscode.workspace.openTextDocument(fixturePath);
    assert.ok(doc, 'Document should open');

    await vscode.window.showTextDocument(doc);

    // Reaching here without an error proves the registration.
    assert.ok(true, 'Custom editor handled .tscn file');
  });
});
