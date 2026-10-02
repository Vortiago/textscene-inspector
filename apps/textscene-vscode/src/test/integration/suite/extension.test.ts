/** Integration tests for VS Code extension activation. */
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation Tests', () => {
  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('vortiago.textscene-inspector');
    assert.ok(extension, 'Extension should be installed');
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('vortiago.textscene-inspector');
    assert.ok(extension, 'Extension should be installed');

    await extension.activate();
    assert.strictEqual(extension.isActive, true, 'Extension should be activated');
  });
});
