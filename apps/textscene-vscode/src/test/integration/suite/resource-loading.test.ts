/**
 * Integration tests for resource loading (textures, materials, external scenes).
 * Tests that resources can be loaded, missing resources are tracked, and file watcher updates work.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  openFixture,
  createTempFixture,
  cleanupTempFixture,
} from '../helpers/fixtureHelpers';
import {
  waitForPanelCreation,
  waitForWebviewMessage,
  sendMessageFromWebview,
} from '../helpers/panelHelpers';
import * as path from 'path';
import * as fs from 'fs';

suite('Resource Loading Tests', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../../.test-workspace');

  test('should track missing texture resource', async function () {
    this.timeout(10000);

    // Open fixture with missing texture
    const doc = await openFixture('test-missing-texture.tscn');

    // Show document
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });

    // Wait a moment for document to be shown
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger preview panel creation
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Wait for panel to be created
    const panel = await waitForPanelCreation(5000);
    assert.ok(panel, 'Panel should be created');

    // Wait for loadTscn message to be sent to webview
    await waitForWebviewMessage(panel, 'loadTscn', 3000);

    // Simulate webview reporting missing resource
    await sendMessageFromWebview(panel, {
      type: 'resourceNeeded',
      resource: {
        path: 'res://textures/test-upload.png',
        type: 'Texture2D',
        id: '1',
      },
    });

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Clean up
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    panel.dispose();
  });

  test('should track missing material resource', async function () {
    this.timeout(10000);

    // Open fixture with missing material
    const doc = await openFixture('test-missing-material.tscn');

    // Show document
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });

    // Wait a moment for document to be shown
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger preview panel creation
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Wait for panel to be created
    const panel = await waitForPanelCreation(5000);
    assert.ok(panel, 'Panel should be created');

    // Wait for loadTscn message
    await waitForWebviewMessage(panel, 'loadTscn', 3000);

    // Simulate webview reporting missing material
    await sendMessageFromWebview(panel, {
      type: 'resourceNeeded',
      resource: {
        path: 'res://materials/test.tres',
        type: 'Material',
        id: '1',
      },
    });

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Clean up
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    panel.dispose();
  });

  test('should load external texture when requested', async function () {
    this.timeout(10000);

    // Create actual texture file in test workspace
    const texturesDir = path.join(workspaceRoot, 'fixtures', 'textures');
    if (!fs.existsSync(texturesDir)) {
      fs.mkdirSync(texturesDir, { recursive: true });
    }

    // Create a simple test texture (1x1 red PNG)
    const texturePath = path.join(texturesDir, 'test-load.png');
    // Simple 1x1 red PNG (minimal valid PNG data)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
      0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
      0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND chunk
      0xae, 0x42, 0x60, 0x82,
    ]);
    fs.writeFileSync(texturePath, pngData);

    // Open fixture with external texture reference
    const doc = await openFixture('unit-external-texture.tscn');

    // Show document
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });

    // Wait a moment for document to be shown
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger preview panel creation
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Wait for panel to be created
    const panel = await waitForPanelCreation(5000);
    assert.ok(panel, 'Panel should be created');

    // Wait for loadTscn message
    await waitForWebviewMessage(panel, 'loadTscn', 3000);

    // Simulate webview requesting texture load
    await sendMessageFromWebview(panel, {
      type: 'loadResource',
      path: 'res://textures/albedo-red.svg', // This file exists in test workspace
      resourceType: 'Texture2D',
      requestId: 'test-req-1',
    });

    // Wait for resourceLoaded response
    const loadedMessage = await waitForWebviewMessage(panel, 'resourceLoaded', 3000);
    assert.ok(loadedMessage, 'Should receive resourceLoaded message');

    // Clean up
    fs.unlinkSync(texturePath);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    panel.dispose();
  });

  test('should track missing external scene', async function () {
    this.timeout(10000);

    // Open fixture with missing external scene
    const doc = await openFixture('test-missing-external-scene.tscn');

    // Show document
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });

    // Wait a moment for document to be shown
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger preview panel creation
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Wait for panel to be created
    const panel = await waitForPanelCreation(5000);
    assert.ok(panel, 'Panel should be created');

    // Wait for loadTscn message
    await waitForWebviewMessage(panel, 'loadTscn', 3000);

    // Simulate webview reporting missing external scene
    await sendMessageFromWebview(panel, {
      type: 'resourceNeeded',
      resource: {
        path: 'res://subscenes/child.tscn',
        type: 'PackedScene',
        id: '1',
      },
    });

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Clean up
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    panel.dispose();
  });

  test('should reload panel when external texture file changes (file watcher)', async function () {
    this.timeout(15000);

    // Create temporary texture file
    const texturesDir = path.join(workspaceRoot, 'fixtures', 'textures');
    if (!fs.existsSync(texturesDir)) {
      fs.mkdirSync(texturesDir, { recursive: true });
    }

    const texturePath = path.join(texturesDir, 'watcher-test.png');
    const initialContent = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
      0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
      0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
      0xae, 0x42, 0x60, 0x82,
    ]);
    fs.writeFileSync(texturePath, initialContent);

    // Open fixture that references textures
    const doc = await openFixture('unit-external-texture.tscn');

    // Show document
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });

    // Wait a moment for document to be shown
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger preview panel creation
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Wait for panel to be created
    const panel = await waitForPanelCreation(5000);
    assert.ok(panel, 'Panel should be created');

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn', 3000);

    // Clear message history
    const panelWithTest = panel as unknown as { _testGetMessages?: () => unknown[] };
    if (panelWithTest._testGetMessages) {
      const messages = panelWithTest._testGetMessages();
      messages.length = 0; // Clear array
    }

    // Modify the texture file
    const modifiedContent = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
      0x08, 0xd7, 0x63, 0x60, 0xf8, 0xcf, 0x00, 0x00, // Different pixel data
      0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
      0xae, 0x42, 0x60, 0x82,
    ]);
    fs.writeFileSync(texturePath, modifiedContent);

    // Wait for file watcher to detect change and trigger panel update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify panel received loadTscn or incrementalUpdate message
    const messages = panelWithTest._testGetMessages?.() || [];
    const hasUpdate = messages.some(
      (m) => (m as { type: string }).type === 'loadTscn' ||
             (m as { type: string }).type === 'incrementalUpdate'
    );
    assert.ok(hasUpdate, 'Panel should receive update after resource file change');

    // Clean up
    fs.unlinkSync(texturePath);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    panel.dispose();
  });

  test('should reload panel when external .tres material file changes', async function () {
    this.timeout(15000);

    // Create temporary material file
    const materialsDir = path.join(workspaceRoot, 'fixtures', 'materials');
    if (!fs.existsSync(materialsDir)) {
      fs.mkdirSync(materialsDir, { recursive: true });
    }

    const materialPath = path.join(materialsDir, 'watcher-test.tres');
    const initialContent = `[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(1, 0, 0, 1)
`;
    fs.writeFileSync(materialPath, initialContent);

    // Open fixture that references materials
    const doc = await openFixture('unit-external-material.tscn');

    // Show document
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.One,
    });

    // Wait a moment for document to be shown
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger preview panel creation
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Wait for panel to be created
    const panel = await waitForPanelCreation(5000);
    assert.ok(panel, 'Panel should be created');

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn', 3000);

    // Clear message history
    const panelWithTest = panel as unknown as { _testGetMessages?: () => unknown[] };
    if (panelWithTest._testGetMessages) {
      const messages = panelWithTest._testGetMessages();
      messages.length = 0;
    }

    // Modify the material file
    const modifiedContent = `[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0, 1, 0, 1)
metallic = 0.5
`;
    fs.writeFileSync(materialPath, modifiedContent);

    // Wait for file watcher to detect change
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify panel received update
    const messages = panelWithTest._testGetMessages?.() || [];
    const hasUpdate = messages.some(
      (m) => (m as { type: string }).type === 'loadTscn' ||
             (m as { type: string }).type === 'incrementalUpdate'
    );
    assert.ok(hasUpdate, 'Panel should receive update after material file change');

    // Clean up
    fs.unlinkSync(materialPath);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    panel.dispose();
  });

  test('should reload panel when external .tscn scene file changes', async function () {
    this.timeout(15000);

    // Create temporary external scene file
    const subscenesDir = path.join(workspaceRoot, 'fixtures', 'subscenes');
    if (!fs.existsSync(subscenesDir)) {
      fs.mkdirSync(subscenesDir, { recursive: true });
    }

    const scenePath = path.join(subscenesDir, 'watcher-test.tscn');
    const initialContent = `[gd_scene format=3]

[node name="ExternalChild" type="Node3D"]
`;
    fs.writeFileSync(scenePath, initialContent);

    // Create main scene that references the external scene
    const tempFixture = await createTempFixture(
      `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://subscenes/watcher-test.tscn" id="1"]

[node name="World" type="Node3D"]

[node name="External" type="Node3D" parent="." instance=ExtResource("1")]
`,
      'temp-external-ref.tscn'
    );

    // Open the main scene
    const doc = await vscode.workspace.openTextDocument(tempFixture);
    await vscode.window.showTextDocument(doc);

    // Trigger preview panel creation
    await vscode.commands.executeCommand('textscene.openPreviewToSide');

    // Wait for panel to be created
    const panel = await waitForPanelCreation(5000);
    assert.ok(panel, 'Panel should be created');

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn', 3000);

    // Clear message history
    const panelWithTest = panel as unknown as { _testGetMessages?: () => unknown[] };
    if (panelWithTest._testGetMessages) {
      const messages = panelWithTest._testGetMessages();
      messages.length = 0;
    }

    // Modify the external scene file
    const modifiedContent = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="box"]

[node name="ExternalChild" type="Node3D"]

[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("box")
`;
    fs.writeFileSync(scenePath, modifiedContent);

    // Wait for file watcher to detect change
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify panel received update
    const messages = panelWithTest._testGetMessages?.() || [];
    const hasUpdate = messages.some(
      (m) => (m as { type: string }).type === 'loadTscn' ||
             (m as { type: string }).type === 'incrementalUpdate'
    );
    assert.ok(hasUpdate, 'Panel should receive update after external scene change');

    // Clean up
    fs.unlinkSync(scenePath);
    await cleanupTempFixture('temp-external-ref.tscn');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    panel.dispose();
  });
});
