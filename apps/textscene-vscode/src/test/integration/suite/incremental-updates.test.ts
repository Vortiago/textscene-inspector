/**
 * Integration tests for incremental update functionality.
 * Tests the hash-based diff algorithm and incremental reload logic.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  waitForPanelCreation,
  waitForWebviewMessage,
} from '../helpers/panelHelpers';
import {
  getFixturePath,
  createTempFixture,
  cleanupTempFixture,
} from '../helpers/fixtureHelpers';
import {
  assertPanelActive,
  assertFullReloadSent,
} from '../helpers/assertionHelpers';

suite('Incremental Update Tests', () => {
  const tempFixtures: string[] = [];

  setup(async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension(
      'vortiago.textscene-inspector',
    );
    await extension?.activate();
  });

  teardown(async () => {
    // Close all editors
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    // Clean up temp fixtures
    for (const fixture of tempFixtures) {
      await cleanupTempFixture(fixture);
    }
    tempFixtures.length = 0;

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  test('Should send full reload on initial file open', async function () {
    this.timeout(10000);

    // Open fixture
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load message
    await waitForWebviewMessage(panel, 'loadTscn');

    // First message should be full reload (loadTscn)
    assertFullReloadSent(panel);
  });

  test('Should trigger incremental update on single property change', async function () {
    this.timeout(15000);

    // Create a temp fixture we can modify
    const simpleScene = `[gd_scene format=3]

[node name="RootNode" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[node name="ChildNode" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)
`;

    const tempFileName = 'temp-incremental-test.tscn';
    tempFixtures.push(tempFileName);
    await createTempFixture(simpleScene, tempFileName);

    // Open temp fixture
    const fixturePath = getFixturePath(tempFileName);
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    // Clear message history to track next update
    const initialMessageCount = panel._testGetMessages().length;

    // Modify the document using VS Code's edit API
    const edit = new vscode.WorkspaceEdit();
    const content = doc.getText();
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(content.length),
    );
    const newContent = content.replace(
      'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)',
      'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)',
    );
    edit.replace(doc.uri, fullRange, newContent);
    await vscode.workspace.applyEdit(edit);

    // Save the document to trigger update
    await doc.save();

    // Wait for update message (file watcher + processing)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Should have sent an incremental update
    const messages = panel._testGetMessages();
    const incrementalMessage = messages
      .slice(initialMessageCount)
      .find((m) => m.type === 'incrementalUpdate');

    assert.ok(
      incrementalMessage,
      'Should send incremental update for single property change',
    );
  });

  test('Should trigger full reload when adding new node', async function () {
    this.timeout(15000);

    // Create temp fixture
    const simpleScene = `[gd_scene format=3]

[node name="RootNode" type="Node3D"]
`;

    const tempFileName = 'temp-add-node-test.tscn';
    tempFixtures.push(tempFileName);
    await createTempFixture(simpleScene, tempFileName);

    // Open temp fixture
    const fixturePath = getFixturePath(tempFileName);
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    const initialMessageCount = panel._testGetMessages().length;

    // Add a new node using VS Code edit API
    const edit = new vscode.WorkspaceEdit();
    const content = doc.getText();
    const newContent = content + '\n[node name="NewChild" type="Node3D" parent="."]\n';
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(content.length),
    );
    edit.replace(doc.uri, fullRange, newContent);
    await vscode.workspace.applyEdit(edit);
    await doc.save();

    // Wait for update
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Should send full reload when node structure changes
    const messages = panel._testGetMessages();
    const reloadMessage = messages
      .slice(initialMessageCount)
      .find((m) => m.type === 'loadTscn');

    assert.ok(
      reloadMessage,
      'Should send full reload when adding new node',
    );
  });

  test('Should trigger full reload when deleting node', async function () {
    this.timeout(15000);

    // Create temp fixture with multiple nodes
    const multiNodeScene = `[gd_scene format=3]

[node name="RootNode" type="Node3D"]

[node name="ChildNode" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)
`;

    const tempFileName = 'temp-delete-node-test.tscn';
    tempFixtures.push(tempFileName);
    await createTempFixture(multiNodeScene, tempFileName);

    // Open temp fixture
    const fixturePath = getFixturePath(tempFileName);
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    const initialMessageCount = panel._testGetMessages().length;

    // Delete the child node using VS Code edit API
    const edit = new vscode.WorkspaceEdit();
    const content = doc.getText();
    const newContent = content.replace(
      /\[node name="ChildNode".*?\n.*?\n/s,
      '',
    );
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(content.length),
    );
    edit.replace(doc.uri, fullRange, newContent);
    await vscode.workspace.applyEdit(edit);
    await doc.save();

    // Wait for update
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Should send full reload when deleting node
    const messages = panel._testGetMessages();
    const reloadMessage = messages
      .slice(initialMessageCount)
      .find((m) => m.type === 'loadTscn');

    assert.ok(
      reloadMessage,
      'Should send full reload when deleting node',
    );
  });

  test('Should not send update if content is unchanged', async function () {
    this.timeout(10000);

    // Open fixture
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    const initialMessageCount = panel._testGetMessages().length;

    // Trigger save without changes
    await doc.save();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should not send additional messages
    const messages = panel._testGetMessages();
    assert.strictEqual(
      messages.length,
      initialMessageCount,
      'Should not send update if content unchanged',
    );
  });

  test('Should handle rapid successive updates', async function () {
    this.timeout(15000);

    // Create temp fixture
    const simpleScene = `[gd_scene format=3]

[node name="RootNode" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    const tempFileName = 'temp-rapid-update-test.tscn';
    tempFixtures.push(tempFileName);
    await createTempFixture(simpleScene, tempFileName);

    // Open temp fixture
    const fixturePath = getFixturePath(tempFileName);
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    // Perform multiple rapid updates
    for (let i = 1; i <= 3; i++) {
      const edit = new vscode.WorkspaceEdit();
      const content = doc.getText();
      const newContent = content.replace(
        /transform = Transform3D\(1, 0, 0, 0, 1, 0, 0, 0, 1, \d+, 0, 0\)/,
        `transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${i * 5}, 0, 0)`,
      );
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(content.length),
      );
      edit.replace(doc.uri, fullRange, newContent);
      await vscode.workspace.applyEdit(edit);
      await doc.save();

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Panel should still be active after rapid updates
    assertPanelActive(panel);

    // Should have sent multiple update messages (at least 3 more after initial load)
    const messages = panel._testGetMessages();
    assert.ok(
      messages.length >= 4,
      `Should have sent multiple updates (got ${messages.length})`,
    );
  });

  test('Should use hash-based comparison for change detection', async function () {
    this.timeout(15000);

    // Create temp fixture
    const simpleScene = `[gd_scene format=3]

[node name="RootNode" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

    const tempFileName = 'temp-hash-test.tscn';
    tempFixtures.push(tempFileName);
    await createTempFixture(simpleScene, tempFileName);

    // Open temp fixture
    const fixturePath = getFixturePath(tempFileName);
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    const initialMessageCount = panel._testGetMessages().length;

    // Modify property (should trigger incremental update via hash comparison)
    const edit = new vscode.WorkspaceEdit();
    const content = doc.getText();
    const newContent = content.replace(
      'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
      'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)',
    );
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(content.length),
    );
    edit.replace(doc.uri, fullRange, newContent);
    await vscode.workspace.applyEdit(edit);
    await doc.save();

    // Wait for update
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Check that hash-based diff detected the change
    const messages = panel._testGetMessages();
    const updateMessages = messages.slice(initialMessageCount);

    assert.ok(
      updateMessages.length > 0,
      'Should detect change via hash comparison',
    );
  });
});
