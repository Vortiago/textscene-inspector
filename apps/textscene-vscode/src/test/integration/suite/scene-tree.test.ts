/**
 * The Scene Tree view's signals in real VS Code. The Outline reads only a text editor,
 * so it is empty while a preview is the active editor. The view follows the preview's
 * own active state instead, which only a real `WebviewPanel` reports. The webview-CSP
 * gate reads the drawn view in the workbench.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from '../../../TscnPreviewPanel';
import { activeScene } from '../../../sceneTree/activeScene';
import { SceneTreeProvider } from '../../../sceneTree/SceneTreeProvider';
import { SCENE_TREE_VIEW_ID } from '../../../sceneTree/SceneTreeView';
import { waitFor } from '../../waitFor';
import { getExtensionUri } from '../helpers/panelHelpers';
import { openProjectDocument, removeGodotProject, writeGodotProject } from '../helpers/godotProjectHelpers';

const PROJECT = 'scene-tree';

/** A focus change reaches the extension host after the main thread moves it. */
const FOCUS_TIMEOUT_MS = 10000;

const SCENE = [
  '[gd_scene format=3 uid="uid://textscene_it_scene_tree"]',
  '',
  '[node name="Scene" type="Node3D"]',
  '',
  '[node name="Box" type="MeshInstance3D" parent="."]',
  '',
].join('\n');

suite('Scene Tree', () => {
  let main: vscode.TextDocument;
  let level: vscode.TextDocument;
  let preview: TscnPreviewPanel | undefined;

  suiteSetup(async () => {
    writeGodotProject(PROJECT, { 'main.tscn': SCENE, 'level.tscn': SCENE });
    main = await openProjectDocument(PROJECT, 'main.tscn');
    level = await openProjectDocument(PROJECT, 'level.tscn');
    await vscode.extensions.getExtension('vortiago.textscene-inspector')?.activate();
  });

  teardown(async () => {
    preview?.dispose();
    preview = undefined;
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  suiteTeardown(() => {
    removeGodotProject(PROJECT);
  });

  test('the manifest contributes the view to the Explorer', () => {
    const manifest = vscode.extensions.getExtension('vortiago.textscene-inspector')!.packageJSON;
    const explorerViews = (manifest.contributes.views.explorer as Array<{ id: string }>).map(
      (view) => view.id
    );

    assert.ok(explorerViews.includes(SCENE_TREE_VIEW_ID), `explorer views: ${explorerViews.join(', ')}`);
  });

  test('the active preview wins over the text editor of another scene', async () => {
    await vscode.window.showTextDocument(level);
    preview = TscnPreviewPanel.create(getExtensionUri(), main.uri);

    await waitFor(
      () => preview!.isActive,
      FOCUS_TIMEOUT_MS,
      () => 'the new preview never became active'
    );
    // In a window without focus, as on macOS CI, VS Code still reports the last text editor
    // as active, so the view must ask the preview first.
    assert.strictEqual(
      activeScene([preview], vscode.window.activeTextEditor)?.toString(),
      main.uri.toString()
    );
  });

  test('a text editor that takes over from the preview takes the view with it', async () => {
    preview = TscnPreviewPanel.create(getExtensionUri(), main.uri);
    await waitForActiveScene(() => [preview!], main.uri);
    let viewStateChanges = 0;
    preview.onDidChangeViewState(() => viewStateChanges++);

    await vscode.window.showTextDocument(level, vscode.ViewColumn.One);

    await waitForActiveScene(() => [preview!], level.uri);
    assert.ok(viewStateChanges > 0, 'the preview reported no change of its active state');
  });

  test("the view lists the preview's scene as the Outline lists its text", async () => {
    const provider = new SceneTreeProvider();
    provider.show(main);

    const outline = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      main.uri
    );

    assert.deepStrictEqual(namesOf(provider.getChildren()), namesOf(outline));
    provider.dispose();
  });
});

async function waitForActiveScene(previews: () => TscnPreviewPanel[], expected: vscode.Uri): Promise<void> {
  const current = () => activeScene(previews(), vscode.window.activeTextEditor)?.toString();
  await waitFor(
    () => current() === expected.toString(),
    FOCUS_TIMEOUT_MS,
    () => `expected the view to follow ${expected.toString()}, found ${current()}`
  );
}

/** Each symbol's name, nested as the tree nests them. */
function namesOf(symbols: readonly vscode.DocumentSymbol[]): unknown[] {
  return symbols.map((symbol) => [symbol.name, namesOf(symbol.children)]);
}
