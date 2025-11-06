/**
 * Integration tests for TscnPreviewPanel lifecycle management.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  waitForPanelCreation,
  waitForPanelDisposal,
  getActivePanels,
} from '../helpers/panelHelpers';
import {
  getFixturePath,
  openFixture,
  listFixtures,
} from '../helpers/fixtureHelpers';
import {
  assertPanelActive,
  assertPanelResource,
  assertPanelCount,
} from '../helpers/assertionHelpers';

suite('Panel Lifecycle Tests', () => {
  setup(async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension(
      'vortiago.textscene-inspector',
    );
    await extension?.activate();
  });

  teardown(async () => {
    // Close all editors after each test
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  test('Should create panel when opening .tscn file', async function () {
    this.timeout(10000);

    // First open a .tscn file and show it in editor
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Now trigger panel creation
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Wait for panel creation
    const panel = await panelPromise;

    // Assertions
    assertPanelActive(panel, 'Panel should be created');
    assertPanelResource(panel, fixturePath.fsPath);
  });

  test('Should dispose panel when editor is closed', async function () {
    this.timeout(10000);

    // Open a fixture file
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Close all editors (should dispose panel)
    const disposalPromise = waitForPanelDisposal(panel);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    // Wait for disposal
    await disposalPromise;

    // Panel should no longer be in active panels
    const activePanels = getActivePanels();
    assert.strictEqual(
      activePanels.length,
      0,
      'No panels should be active after closing',
    );
  });

  test('Should support multiple panels for different files', async function () {
    this.timeout(15000);

    const fixtures = listFixtures();
    if (fixtures.length < 2) {
      this.skip(); // Skip if not enough fixtures
      return;
    }

    // Open first fixture
    const fixture1 = fixtures[0]!;
    const doc1 = await openFixture(fixture1);
    await vscode.window.showTextDocument(doc1, vscode.ViewColumn.One);

    const panel1Promise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel1 = await panel1Promise;

    // Open second fixture
    const fixture2 = fixtures[1]!;
    const doc2 = await openFixture(fixture2);
    await vscode.window.showTextDocument(doc2, vscode.ViewColumn.One);

    const panel2Promise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel2 = await panel2Promise;

    // Both panels should be active
    assertPanelCount(2, 'Two panels should be active');
    assertPanelActive(panel1);
    assertPanelActive(panel2);

    // Panels should manage different resources
    assert.notStrictEqual(
      panel1.resource.fsPath,
      panel2.resource.fsPath,
      'Panels should manage different resources',
    );
  });

  test('Should reveal existing panel when reopening same file', async function () {
    this.timeout(10000);

    // Open fixture and create panel
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);
    assertPanelResource(panel, fixturePath.fsPath);

    // Close the text editor but not the preview
    await vscode.commands.executeCommand(
      'workbench.action.closeActiveEditor',
    );

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Reopen the same file
    await vscode.window.showTextDocument(doc);

    // Try to open preview again - should reveal existing panel
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Should still have only one panel
    assertPanelCount(1, 'Should still have only one panel');

    // Panel should still be active and managing the same resource
    assertPanelActive(panel);
    assertPanelResource(panel, fixturePath.fsPath);
  });

  test('Should handle rapid open/close cycles', async function () {
    this.timeout(15000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');

    // Rapidly open and close panels
    for (let i = 0; i < 3; i++) {
      const doc = await vscode.workspace.openTextDocument(fixturePath);
      await vscode.window.showTextDocument(doc);

      const panelPromise = waitForPanelCreation();
      await vscode.commands.executeCommand('textscene.openPreviewToSide');
      const panel = await panelPromise;

      assertPanelActive(panel);

      // Close all
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // No panels should remain active
    const activePanels = getActivePanels();
    assert.strictEqual(
      activePanels.length,
      0,
      'No panels should remain after rapid cycling',
    );
  });
});
