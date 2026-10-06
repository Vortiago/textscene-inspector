/**
 * `res://` in a real VS Code: Godot defines it only by a `project.godot`, so a scene outside
 * every project gets no link target, no definition and no path completion. A `project.godot`
 * created later gives the scene its root, with no reload.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { godotProjectDir, lineStartingWith, removeGodotProject } from '../helpers/godotProjectHelpers';
import { EXTENSION_ID } from '../../smokeProject/sceneEditor';

const FOLDER = 'project-roots';

/** Resolves only against the workspace folder, so only a host that falls back to it links this path. */
const WORKSPACE_PATH = `res://${FOLDER}/art/grid.png`;
/** Resolves only against a `project.godot` in this folder. */
const PROJECT_PATH = 'res://art/grid.png';

/** One path per scene: VS Code's link resolve rejects the whole call when one link has no target. */
function sceneWith(resPath: string): string {
  return [
    '[gd_scene load_steps=2 format=3]',
    '',
    `[ext_resource type="Texture2D" path="${resPath}" id="1_grid"]`,
    '',
    '[node name="Root" type="Node3D"]',
    '',
  ].join('\n');
}

/** How long a `project.godot` created or deleted on disk may take to reach the extension's file watcher. */
const WATCHER_DELIVERY_MS = 10000;

/** Polls `read` every 100ms until `accept` holds for its value, and returns the last value. */
async function readUntil<T>(
  read: () => Thenable<T>,
  accept: (value: T) => boolean,
  timeoutMs: number
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!accept(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}

/** Shows the scene in an editor, since VS Code drops the model of a document no editor shows. */
async function shown(file: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(document, { preview: false });
  return document;
}

/** The position inside the scene's one `res://` path, `offset` characters into it. */
function inside(scene: vscode.TextDocument, resPath: string, offset: number): vscode.Position {
  const line = lineStartingWith(scene, '[ext_resource');
  return new vscode.Position(line, scene.lineAt(line).text.indexOf(resPath) + offset);
}

/** The fsPath the scene's one link resolves to. Null when the link has no target. */
async function linkTarget(scene: vscode.TextDocument): Promise<string | null> {
  try {
    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      'vscode.executeLinkProvider',
      scene.uri,
      1
    );
    return links[0]?.target?.fsPath ?? null;
  } catch (error) {
    // VS Code rejects the resolve of a link that has no target with this message.
    if (error instanceof Error && error.message === 'missing') return null;
    throw error;
  }
}

function definitionTargets(scene: vscode.TextDocument, resPath: string): Thenable<string[]> {
  return vscode.commands
    .executeCommand<Array<vscode.Location | vscode.LocationLink>>(
      'vscode.executeDefinitionProvider',
      scene.uri,
      inside(scene, resPath, resPath.length - 1)
    )
    .then((locations) =>
      locations.map((location) => ('uri' in location ? location.uri : location.targetUri).fsPath)
    );
}

function offeredPaths(scene: vscode.TextDocument, resPath: string): Thenable<string[]> {
  return vscode.commands
    .executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      scene.uri,
      inside(scene, resPath, 'res://'.length)
    )
    .then((list) =>
      list.items
        .map((item) => (typeof item.label === 'string' ? item.label : item.label.label))
        .filter((label) => label.startsWith('res://'))
    );
}

suite('Project roots', () => {
  let dir: string;
  let grid: string;

  suiteSetup(async () => {
    dir = godotProjectDir(FOLDER);
    grid = path.join(dir, 'art', 'grid.png');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(grid), { recursive: true });
    fs.writeFileSync(grid, '');
    fs.writeFileSync(path.join(dir, 'workspace-path.tscn'), sceneWith(WORKSPACE_PATH));
    fs.writeFileSync(path.join(dir, 'project-path.tscn'), sceneWith(PROJECT_PATH));
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await removeGodotProject(FOLDER);
  });

  test('a scene outside every project gets no link target, no definition and no res:// path', async () => {
    fs.rmSync(path.join(dir, 'project.godot'), { force: true });
    const scene = await shown(path.join(dir, 'workspace-path.tscn'));

    assert.strictEqual(await linkTarget(scene), null);
    assert.deepStrictEqual(await definitionTargets(scene, WORKSPACE_PATH), []);
    const paths = await readUntil(
      () => offeredPaths(scene, WORKSPACE_PATH),
      (offered) => offered.length === 0,
      WATCHER_DELIVERY_MS
    );
    assert.deepStrictEqual(paths, []);
  });

  test('a project.godot created later gives the scene its root, with no reload', async () => {
    fs.writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n');
    const scene = await shown(path.join(dir, 'project-path.tscn'));

    assert.strictEqual(await linkTarget(scene), grid);
    assert.deepStrictEqual(await definitionTargets(scene, PROJECT_PATH), [grid]);
    // The path listing refreshes when the file watcher reports the new project.godot.
    const paths = await readUntil(
      () => offeredPaths(scene, PROJECT_PATH),
      (offered) => offered.includes(PROJECT_PATH),
      WATCHER_DELIVERY_MS
    );
    assert.ok(paths.includes(PROJECT_PATH), `offered: ${paths.join(', ')}`);
  });
});
