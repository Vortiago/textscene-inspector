/**
 * The `textscene.openPreviewToSide` command as a user runs it, with the real
 * `vscode.WebviewPanel` it opens, read back from VS Code's tab model. The other panel
 * suites build the panel over a fake, so only this suite sees what the command opens.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitFor } from '../helpers/panelHelpers';
import { openProjectDocument, removeGodotProject, writeGodotProject } from '../helpers/godotProjectHelpers';

const EXTENSION_ID = 'vortiago.textscene-inspector';
const PREVIEW_COMMAND = 'textscene.openPreviewToSide';
const PROJECT = 'preview-command';

/** A tab update reaches the extension host after the main thread opens the panel. */
const TAB_TIMEOUT_MS = 10000;

const SCENE = [
  '[gd_scene format=3 uid="uid://textscene_it_preview"]',
  '',
  '[node name="Scene" type="Node3D"]',
  '',
].join('\n');

suite('Preview Command', () => {
  let first: vscode.Uri;
  let second: vscode.Uri;
  let material: vscode.Uri;

  suiteSetup(async () => {
    writeGodotProject(PROJECT, {
      'first.tscn': SCENE,
      'second.tscn': SCENE,
      'material.tres': '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\n',
    });
    first = (await openProjectDocument(PROJECT, 'first.tscn')).uri;
    second = (await openProjectDocument(PROJECT, 'second.tscn')).uri;
    material = (await openProjectDocument(PROJECT, 'material.tres')).uri;
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await waitFor(
      () => previewTabLabels().length === 0,
      TAB_TIMEOUT_MS,
      () => `the previews stayed open after closing every editor: ${previewTabLabels().join(', ')}`
    );
  });

  suiteTeardown(() => {
    removeGodotProject(PROJECT);
  });

  test('every command the manifest contributes is registered', async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} is installed in the test host`);
    const contributed = (extension.packageJSON.contributes.commands as Array<{ command: string }>).map(
      (entry) => entry.command
    );
    const registered = new Set(await vscode.commands.getCommands(true));

    assert.ok(contributed.length > 0, 'the manifest contributes a command');
    assert.deepStrictEqual(
      contributed.filter((command) => !registered.has(command)),
      []
    );
  });

  test('a scene handed by a menu opens one preview titled with its file name', async () => {
    await vscode.commands.executeCommand(PREVIEW_COMMAND, first);

    await waitForPreviewTabs(['Preview: first.tscn']);
  });

  test('the command palette previews the scene in the active editor', async () => {
    await vscode.window.showTextDocument(second);

    await vscode.commands.executeCommand(PREVIEW_COMMAND);

    await waitForPreviewTabs(['Preview: second.tscn']);
  });

  test('a second run on the same scene reveals its preview, not a new one', async () => {
    await vscode.commands.executeCommand(PREVIEW_COMMAND, first);
    await waitForPreviewTabs(['Preview: first.tscn']);

    await vscode.commands.executeCommand(PREVIEW_COMMAND, first);
    // A second preview, had one opened, arrives no later than the one for second.tscn.
    await vscode.commands.executeCommand(PREVIEW_COMMAND, second);

    await waitForPreviewTabs(['Preview: first.tscn', 'Preview: second.tscn']);
  });

  test('a .tres file opens no preview', async () => {
    await vscode.commands.executeCommand(PREVIEW_COMMAND, material);
    // A preview for the .tres, had one opened, arrives no later than this one.
    await vscode.commands.executeCommand(PREVIEW_COMMAND, first);

    await waitForPreviewTabs(['Preview: first.tscn']);
  });

  test('closing a preview lets the command open it again', async () => {
    await vscode.commands.executeCommand(PREVIEW_COMMAND, first);
    await waitForPreviewTabs(['Preview: first.tscn']);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await waitForPreviewTabs([]);

    await vscode.commands.executeCommand(PREVIEW_COMMAND, first);

    await waitForPreviewTabs(['Preview: first.tscn']);
  });
});

/**
 * The label of every open preview tab, sorted. VS Code prefixes the viewType of a
 * webview tab with its own namespace, so the match is on the suffix.
 */
function previewTabLabels(): string[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(
      (tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith('tscnPreview')
    )
    .map((tab) => tab.label)
    .sort();
}

/** Waits until the open preview tabs are exactly `labels`, sorted. */
async function waitForPreviewTabs(labels: string[]): Promise<void> {
  const expected = JSON.stringify([...labels].sort());
  await waitFor(
    () => JSON.stringify(previewTabLabels()) === expected,
    TAB_TIMEOUT_MS,
    () => `expected the preview tabs ${expected}, found ${JSON.stringify(previewTabLabels())}`
  );
}
