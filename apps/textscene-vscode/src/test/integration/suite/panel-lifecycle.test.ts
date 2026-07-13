/**
 * Integration tests for TscnPreviewPanel lifecycle management.
 *
 * Panels are constructed directly using the public `TscnPreviewPanel`
 * constructor with a fake `vscode.WebviewPanel` (see `createTestPanel` in
 * panelHelpers). This lets tests observe lifecycle events without any
 * test-mode plumbing baked into production code.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  createTestPanel,
  waitForPanelDisposal,
} from '../helpers/panelHelpers';
import {
  getFixturePath,
  listFixtures,
} from '../helpers/fixtureHelpers';
import {
  assertPanelActive,
  assertPanelResource,
} from '../helpers/assertionHelpers';

suite('Panel Lifecycle Tests', () => {
  setup(async () => {
    const extension = vscode.extensions.getExtension('vortiago.textscene-inspector');
    await extension?.activate();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  test('Should create panel for a .tscn file', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = vscode.extensions.getExtension('vortiago.textscene-inspector')!.extensionUri;

    const { panel } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel, 'Panel should be created');
    assertPanelResource(panel, fixturePath.fsPath);
  });

  test('Should dispose panel on demand and fire onDidDispose', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = vscode.extensions.getExtension('vortiago.textscene-inspector')!.extensionUri;

    const { panel } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    const disposalPromise = waitForPanelDisposal(panel);
    panel.dispose();
    await disposalPromise;

    // After dispose the onDidDispose event has fired — the promise resolved.
    assert.ok(true, 'onDidDispose fired after panel.dispose()');
  });

  test('Should support panels for multiple files independently', function () {
    const fixtures = listFixtures();
    if (fixtures.length < 2) {
      this.skip();
      return;
    }

    const extensionUri = vscode.extensions.getExtension('vortiago.textscene-inspector')!.extensionUri;
    const fixture1Path = getFixturePath(fixtures[0]!);
    const fixture2Path = getFixturePath(fixtures[1]!);

    const { panel: panel1 } = createTestPanel(extensionUri, fixture1Path);
    const { panel: panel2 } = createTestPanel(extensionUri, fixture2Path);

    assertPanelActive(panel1);
    assertPanelActive(panel2);

    assert.notStrictEqual(
      panel1.resource.fsPath,
      panel2.resource.fsPath,
      'Panels should manage different resources',
    );
  });

  test('Should update resource when update() is called', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = vscode.extensions.getExtension('vortiago.textscene-inspector')!.extensionUri;

    const { panel } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);
    assertPanelResource(panel, fixturePath.fsPath);

    const fixtures = listFixtures();
    const otherName = fixtures.find((f) => f !== 'unit-empty-scene.tscn');
    if (!otherName) {
      this.skip();
      return;
    }

    const otherPath = getFixturePath(otherName);
    panel.update(otherPath);
    await new Promise((resolve) => setTimeout(resolve, 200));

    assertPanelResource(panel, otherPath.fsPath);
  });

  test('Should handle rapid create/dispose cycles without error', async function () {
    this.timeout(15000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = vscode.extensions.getExtension('vortiago.textscene-inspector')!.extensionUri;

    for (let i = 0; i < 3; i++) {
      const { panel } = createTestPanel(extensionUri, fixturePath);
      assertPanelActive(panel);
      const disposalPromise = waitForPanelDisposal(panel);
      panel.dispose();
      await disposalPromise;
    }

    assert.ok(true, 'Rapid create/dispose cycles completed without error');
  });
});
