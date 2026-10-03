/**
 * The linter's findings in the Problems panel, read back through
 * `vscode.languages.getDiagnostics` as VS Code itself holds them: on open, after an
 * edit, across files in a project and under the `textscene.diagnostics.enabled` setting.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitFor } from '../../waitFor';
import { getFixturePath } from '../helpers/fixtureHelpers';
import {
  lineStartingWith,
  openProjectDocument,
  removeGodotProject,
  writeGodotProject,
} from '../helpers/godotProjectHelpers';

const PROJECT = 'diagnostics';

/** A lint wait covers the debounce, the project walk and the cross-file read on a loaded runner. */
const LINT_TIMEOUT_MS = 10000;

const CLEAN_SCENE = [
  '[gd_scene load_steps=2 format=3 uid="uid://textscene_it_clean"]',
  '',
  '[sub_resource type="BoxMesh" id="BoxMesh_1"]',
  '',
  '[node name="Scene" type="Node3D"]',
  '',
  '[node name="Box" type="MeshInstance3D" parent="."]',
  'mesh = SubResource("BoxMesh_1")',
  '',
].join('\n');

/** Godot refuses a reference to a sub_resource id the file never declares. */
const DANGLING_SCENE = [
  '[gd_scene format=3 uid="uid://textscene_it_dangling"]',
  '',
  '[node name="Scene" type="Node3D"]',
  '',
  '[node name="Box" type="MeshInstance3D" parent="."]',
  'mesh = SubResource("Missing_1")',
  '',
].join('\n');

suite('Diagnostics', () => {
  suiteSetup(async () => {
    writeGodotProject(PROJECT, {
      'clean.tscn': CLEAN_SCENE,
      'dangling.tscn': DANGLING_SCENE,
      'fixable.tscn': DANGLING_SCENE,
    });
    await vscode.extensions.getExtension('vortiago.textscene-inspector')?.activate();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  suiteTeardown(async () => {
    await vscode.workspace
      .getConfiguration('textscene')
      .update('diagnostics.enabled', undefined, vscode.ConfigurationTarget.Global);
    removeGodotProject(PROJECT);
  });

  test('a dangling SubResource reference is an error on its line', async function () {
    this.timeout(LINT_TIMEOUT_MS + 5000);
    const document = await openProjectDocument(PROJECT, 'dangling.tscn');

    const [diagnostic] = await waitForLint(document.uri, (found) => found.length > 0);

    assert.strictEqual(diagnostic!.source, 'tscn-lint');
    assert.strictEqual(diagnostic!.code, 'dangling-resource-reference');
    assert.strictEqual(diagnostic!.severity, vscode.DiagnosticSeverity.Error);
    assert.strictEqual(diagnostic!.range.start.line, lineStartingWith(document, 'mesh = '));
  });

  test('a scene Godot loads has no diagnostics', async function () {
    this.timeout(LINT_TIMEOUT_MS + 5000);
    const clean = await openProjectDocument(PROJECT, 'clean.tscn');
    // A scene's own lint publishes as it opens. The dangling scene's error proves the linter runs.
    const dangling = await openProjectDocument(PROJECT, 'dangling.tscn');

    await waitForLint(dangling.uri, (found) => found.length > 0);

    assert.deepStrictEqual(lintOf(clean.uri), []);
  });

  test('fixing the reference in the editor clears its error', async function () {
    this.timeout(2 * LINT_TIMEOUT_MS + 5000);
    const document = await openProjectDocument(PROJECT, 'fixable.tscn');
    await waitForLint(document.uri, (found) => found.length > 0);

    const edit = new vscode.WorkspaceEdit();
    edit.delete(document.uri, document.lineAt(lineStartingWith(document, 'mesh = ')).rangeIncludingLineBreak);
    assert.ok(await vscode.workspace.applyEdit(edit), 'the edit applies');
    // Saved, so closing the editor in teardown raises no prompt. suiteSetup rewrites the file.
    await document.save();

    await waitForLint(document.uri, (found) => found.length === 0);
  });

  test('a glTF a scene loads is read across files from the project', async function () {
    this.timeout(LINT_TIMEOUT_MS + 5000);
    const scene = getFixturePath(
      'gltf-unsupported-required-extension/edge-gltf-unsupported-required-extension.tscn'
    );
    await vscode.workspace.openTextDocument(scene);

    const found = await waitForLint(scene, (diagnostics) =>
      diagnostics.some((d) => d.code === 'gltf-required-extension-unsupported')
    );

    const crossFile = found.find((d) => d.code === 'gltf-required-extension-unsupported');
    assert.strictEqual(crossFile!.severity, vscode.DiagnosticSeverity.Error);
  });

  test('turning diagnostics off clears them, and turning them on restores them', async function () {
    this.timeout(3 * LINT_TIMEOUT_MS + 5000);
    const document = await openProjectDocument(PROJECT, 'dangling.tscn');
    await waitForLint(document.uri, (found) => found.length > 0);
    const config = () => vscode.workspace.getConfiguration('textscene');

    await config().update('diagnostics.enabled', false, vscode.ConfigurationTarget.Global);
    await waitForLint(document.uri, (found) => found.length === 0);

    await config().update('diagnostics.enabled', true, vscode.ConfigurationTarget.Global);
    await waitForLint(document.uri, (found) => found.length > 0);
  });
});

/** The diagnostics the linter publishes for `uri`, without those of any other extension. */
function lintOf(uri: vscode.Uri): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri).filter((d) => d.source === 'tscn-lint');
}

/** Waits until the lint diagnostics of `uri` satisfy `settled`, and returns them. */
async function waitForLint(
  uri: vscode.Uri,
  settled: (found: vscode.Diagnostic[]) => boolean
): Promise<vscode.Diagnostic[]> {
  await waitFor(
    () => settled(lintOf(uri)),
    LINT_TIMEOUT_MS,
    () =>
      `the lint of ${uri.fsPath} did not settle within ${LINT_TIMEOUT_MS}ms. ` +
      `It has ${JSON.stringify(lintOf(uri).map((d) => `${d.code}: ${d.message}`))}`
  );
  return lintOf(uri);
}
