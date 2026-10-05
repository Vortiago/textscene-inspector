/**
 * The editor features a user reaches from a `.tscn` file, called through VS Code's own
 * `vscode.execute*` commands. A provider the unit tests pass can still miss the
 * editor: a wrong document selector or language contribution reaches no document.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  godotProjectDir,
  lineStartingWith,
  openProjectDocument,
  positionInside,
  removeGodotProject,
  writeGodotProject,
} from '../helpers/godotProjectHelpers';

const PROJECT = 'language-features';

const MAIN_SCENE = [
  '[gd_scene load_steps=4 format=3 uid="uid://textscene_it_language_features"]',
  '',
  '[ext_resource type="Texture2D" path="res://textures/grid.png" id="1_grid"]',
  '',
  '[sub_resource type="BoxMesh" id="BoxMesh_1"]',
  '',
  '[sub_resource type="StandardMaterial3D" id="Material_1"]',
  'albedo_texture = ExtResource("1_grid")',
  '',
  '[node name="Scene" type="Node3D"]',
  '',
  '[node name="Box" type="MeshInstance3D" parent="."]',
  'mesh = SubResource("BoxMesh_1")',
  'surface_material_override/0 = SubResource("Material_1")',
  '',
  '[node name="Lamp" type="OmniLight3D" parent="Box"]',
  '',
].join('\n');

const MATERIAL = ['[gd_resource type="StandardMaterial3D" format=3]', '', '[resource]', ''].join('\n');

const TYPO_SCENE = ['[node name="S" type="MeshInstance3D"]', 'mash = null', ''].join('\n');

suite('Language Features', () => {
  let main: vscode.TextDocument;

  suiteSetup(async () => {
    writeGodotProject(PROJECT, {
      'main.tscn': MAIN_SCENE,
      'material.tres': MATERIAL,
      'typo.tscn': TYPO_SCENE,
      // The file `main.tscn` links to. A link to a missing file has no target.
      'textures/grid.png': '',
    });
    main = await openProjectDocument(PROJECT, 'main.tscn');
    await vscode.extensions.getExtension('vortiago.textscene-inspector')?.activate();
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    removeGodotProject(PROJECT);
  });

  test('a .tscn and a .tres document open in the tscn language', async () => {
    const material = await openProjectDocument(PROJECT, 'material.tres');

    assert.strictEqual(main.languageId, 'tscn');
    assert.strictEqual(material.languageId, 'tscn');
  });

  test('the Outline shows the node tree under the root node', async () => {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      main.uri
    );

    assert.deepStrictEqual(outlineOf(symbols), [
      'Scene: Node3D',
      '  Box: MeshInstance3D',
      '    Lamp: OmniLight3D',
    ]);
    const box = symbols[0]!.children[0]!;
    assert.strictEqual(box.selectionRange.start.line, lineStartingWith(main, '[node name="Box"'));
  });

  test('Go to Definition on a SubResource reference lands on its sub_resource heading', async () => {
    const locations = await definitionsAt(main, positionInside(main, 'mesh = ', 'SubResource'));

    assert.deepStrictEqual(
      locations.map((location) => location.range.start.line),
      [lineStartingWith(main, '[sub_resource type="BoxMesh"')]
    );
  });

  test('Go to Definition on an ExtResource reference lands on its ext_resource heading', async () => {
    const locations = await definitionsAt(main, positionInside(main, 'albedo_texture = ', 'ExtResource'));

    assert.deepStrictEqual(
      locations.map((location) => location.range.start.line),
      [lineStartingWith(main, '[ext_resource')]
    );
  });

  test('Go to Definition outside a resource reference finds nothing', async () => {
    const locations = await definitionsAt(
      main,
      new vscode.Position(lineStartingWith(main, '[node name="Scene"'), 2)
    );

    assert.deepStrictEqual(locations, []);
  });

  test('a res:// path is a link to the file under the project root', async () => {
    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      'vscode.executeLinkProvider',
      main.uri,
      // Resolve every link, as a hover or a click does.
      Number.MAX_SAFE_INTEGER
    );

    assert.strictEqual(links.length, 1, `expected one link, got ${links.length}`);
    const { range, target } = links[0]!;
    assert.strictEqual(range.start.line, lineStartingWith(main, '[ext_resource'));
    assert.ok(target, 'the link resolves to a target');
    // path.relative compares the drive letter without regard to case on Windows.
    assert.strictEqual(
      path.relative(godotProjectDir(PROJECT), target.fsPath),
      path.join('textures', 'grid.png')
    );
  });

  test('Hover on a node type names the class and its reference page', async () => {
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      main.uri,
      positionInside(main, '[node name="Box" type="', 'MeshInstance3D')
    );

    assert.ok(hoverText(hovers).includes('MeshInstance3D'), 'the hover names the class');
  });

  test('Completion on a property line offers a property the node does not set', async () => {
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      main.uri,
      new vscode.Position(lineStartingWith(main, 'mesh = '), 0)
    );
    const labels = list.items.map((item) => (typeof item.label === 'string' ? item.label : item.label.label));

    assert.ok(labels.includes('visible'), 'a catalogue property is offered');
    assert.ok(!labels.includes('mesh'), 'a property already set is not offered');
  });

  test('a quick fix repairs a property-name typo', async () => {
    const typo = await openProjectDocument(PROJECT, 'typo.tscn');
    const line = lineStartingWith(typo, 'mash =');
    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      typo.uri,
      new vscode.Range(line, 0, line, 4)
    );

    const fix = actions.find((action) => action.title.includes('mesh'));
    assert.ok(fix?.edit, 'a quick fix carries an edit');
  });
});

/** The plain text of a hover's contents, whichever shape the provider returned. */
function hoverText(hovers: readonly vscode.Hover[]): string {
  const parts = hovers.flatMap((hover) =>
    Array.isArray(hover.contents) ? hover.contents : [hover.contents]
  );
  return parts
    .map((part) => (typeof part === 'string' ? part : 'value' in part ? part.value : ''))
    .join('\n');
}

/** Each symbol as `name: detail`, indented two spaces per level of nesting. */
function outlineOf(symbols: readonly vscode.DocumentSymbol[], depth = 0): string[] {
  return symbols.flatMap((symbol) => [
    `${'  '.repeat(depth)}${symbol.name}: ${symbol.detail}`,
    ...outlineOf(symbol.children, depth + 1),
  ]);
}

/** The provider answers with a `Location`, which VS Code hands back in a list. */
async function definitionsAt(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.Location[]> {
  return vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeDefinitionProvider',
    document.uri,
    position
  );
}
