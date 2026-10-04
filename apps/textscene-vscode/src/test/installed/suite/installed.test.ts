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
import { CLEAN_SCENE, DANGLING_SCENE } from '../../smokeProject/scenes';
import {
  extensionUnderTest,
  lintCodes,
  openScene,
  openSceneAndActivate,
  PREVIEW_COMMAND,
  previewTabLabels,
  unregisteredCommands,
} from '../../smokeProject/sceneEditor';

/** Activation, a lint and a tab update each reach the extension host well inside this on a loaded runner. */
const SETTLE_TIMEOUT_MS = 10000;

suite('Installed package', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  // First: the other tests open a scene, which activates the extension for the rest of the run.
  test('opening a scene activates the extension, and nothing activates it before', async () => {
    const extension = extensionUnderTest();
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

    const relative = path.relative(extensionsDir, extensionUnderTest().extensionPath);

    assert.ok(
      !relative.startsWith('..') && !path.isAbsolute(relative),
      `expected the extension under ${extensionsDir}, found ${extensionUnderTest().extensionPath}`
    );
  });

  test('every command the manifest contributes is registered', async () => {
    await openSceneAndActivate(CLEAN_SCENE);

    assert.deepStrictEqual(await unregisteredCommands(), []);
  });

  test('the packaged linter reports a dangling reference in the Problems panel', async () => {
    const document = await openSceneAndActivate(DANGLING_SCENE);

    await waitFor(
      () => lintCodes(document).includes('dangling-resource-reference'),
      SETTLE_TIMEOUT_MS,
      () => `expected dangling-resource-reference, found ${JSON.stringify(lintCodes(document))}`
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

  test('the packaged extension contributes and registers the agent tools', async () => {
    await openSceneAndActivate(CLEAN_SCENE);

    const contributes = extensionUnderTest().packageJSON.contributes as
      { languageModelTools?: Array<{ name: string }> } | undefined;
    const contributed = (contributes?.languageModelTools ?? []).map((tool) => tool.name);
    const expected = [
      'textscene_lint',
      'textscene_scene_tree',
      'textscene_open_preview',
      'textscene_missing_resources',
      'textscene_capture',
    ];

    for (const name of expected) {
      assert.ok(contributed.includes(name), `${name} is contributed`);
    }

    // The tools API is newer than the extension's engines floor; below it, none registers.
    if (vscode.lm?.tools) {
      const registered = vscode.lm.tools.map((tool) => tool.name);
      for (const name of expected) {
        assert.ok(registered.includes(name), `${name} is registered`);
      }
    }
  });
});
