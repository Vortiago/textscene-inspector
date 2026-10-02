/**
 * The extension as a user installs it: the packaged .vsix in a clean VS Code, with no
 * development path. A file the package leaves out, or an activation event, command or
 * bundle that works only from the repository, fails here and nowhere else.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { waitFor } from '../../waitFor';
import { INSTALLED_EXTENSIONS_DIR_ENV } from '../installedLaunch';
import { CLEAN_SCENE, DANGLING_SCENE } from '../installedWorkspace';

const EXTENSION_ID = 'vortiago.textscene-inspector';
const PREVIEW_COMMAND = 'textscene.openPreviewToSide';

/** Activation, a lint and a tab update each reach the extension host well inside this on a loaded runner. */
const SETTLE_TIMEOUT_MS = 10000;

suite('Installed package', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  // First: the other tests open a scene, which activates the extension for the rest of the run.
  test('opening a scene activates the extension, and nothing activates it before', async () => {
    const extension = installedExtension();
    assert.strictEqual(extension.isActive, false, 'the extension is inactive before a scene opens');

    await openScene(CLEAN_SCENE);

    await waitFor(
      () => extension.isActive,
      SETTLE_TIMEOUT_MS,
      () => 'opening a .tscn did not activate the extension'
    );
    // VS Code sets isActive on a failed activation too. Only activate() rejects with its error.
    await extension.activate();
  });

  test('the host runs the installed copy, not a development build', () => {
    const extensionsDir = process.env[INSTALLED_EXTENSIONS_DIR_ENV];
    assert.ok(extensionsDir, `${INSTALLED_EXTENSIONS_DIR_ENV} names the extensions directory`);

    const relative = path.relative(extensionsDir, installedExtension().extensionPath);

    assert.ok(
      !relative.startsWith('..') && !path.isAbsolute(relative),
      `expected the extension under ${extensionsDir}, found ${installedExtension().extensionPath}`
    );
  });

  test('every command the manifest contributes is registered', async () => {
    await openSceneAndActivate(CLEAN_SCENE);
    const contributed = (
      installedExtension().packageJSON.contributes.commands as Array<{ command: string }>
    ).map((entry) => entry.command);
    const registered = new Set(await vscode.commands.getCommands(true));

    assert.ok(contributed.length > 0, 'the manifest contributes a command');
    assert.deepStrictEqual(
      contributed.filter((command) => !registered.has(command)),
      []
    );
  });

  test('the packaged linter reports a dangling reference in the Problems panel', async () => {
    const document = await openSceneAndActivate(DANGLING_SCENE);
    const lintCodes = () =>
      vscode.languages
        .getDiagnostics(document.uri)
        .filter((d) => d.source === 'tscn-lint')
        .map((d) => d.code);

    await waitFor(
      () => lintCodes().includes('dangling-resource-reference'),
      SETTLE_TIMEOUT_MS,
      () => `expected dangling-resource-reference, found ${JSON.stringify(lintCodes())}`
    );
  });

  test('the preview command opens a preview of the scene', async () => {
    const document = await openSceneAndActivate(CLEAN_SCENE);

    await vscode.commands.executeCommand(PREVIEW_COMMAND, document.uri);

    await waitFor(
      () => previewTabLabels().includes(`Preview: ${CLEAN_SCENE}`),
      SETTLE_TIMEOUT_MS,
      () => `expected a preview of ${CLEAN_SCENE}, found the tabs ${JSON.stringify(previewTabLabels())}`
    );
  });
});

/** The installed extension. Throws when VS Code has not loaded it, which fails every test. */
function installedExtension(): vscode.Extension<unknown> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  if (!extension) throw new Error(`expected ${EXTENSION_ID} in the extensions directory, found none`);
  return extension;
}

/** Opens a scene of the workspace in an editor. */
async function openScene(name: string): Promise<vscode.TextDocument> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) throw new Error('expected the launcher to open the workspace folder, found none');
  const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, name));
  await vscode.window.showTextDocument(document);
  return document;
}

/** Opens a scene and waits for the activation it starts, so a test runs alone or in any order. */
async function openSceneAndActivate(name: string): Promise<vscode.TextDocument> {
  const document = await openScene(name);
  await installedExtension().activate();
  return document;
}

/** The label of every open preview tab. VS Code prefixes a webview tab's viewType with its own namespace. */
function previewTabLabels(): string[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(
      (tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith('tscnPreview')
    )
    .map((tab) => tab.label);
}
