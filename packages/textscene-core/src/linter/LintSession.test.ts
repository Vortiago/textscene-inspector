/**
 * A lint session shows a document's own diagnostics at once, beside the cross-file ones of its last read, moved onto
 * the lines of the newest parse, and the full list once the glTF files it uses are read.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from './Linter.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { triangleGlb } from '../resources/formats/glb/testing/triangleGlb.js';
import { PLAIN_PROJECT_FILE, memoryProject } from './testing/memoryProject.js';
import './index.js';

const RULE = FILE_DIAGNOSTICS.unimportableGltf.ruleName;
const INSTANCED_TREE = triangleGlb({ extensionsRequired: ['EXT_mesh_gpu_instancing'], instanced: true });

/** A project that can list itself and whose `project.godot` lets nothing add to the importer, holding `files`. */
function project(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return memoryProject({ 'res://project.godot': PLAIN_PROJECT_FILE, ...files });
}

/**
 * A scene whose `[ext_resource]` `id` for `path` sits on line `3 + blankLines`, and whose root heading inherits it, so
 * a refusal fails the scene's load.
 */
function sceneUsing(path: string, { id = '1_tree', blankLines = 0 } = {}): string {
  return `[gd_scene format=3]
${'\n'.repeat(blankLines)}
[ext_resource type="PackedScene" path="${path}" id="${id}"]

[node name="Tree" instance=ExtResource("${id}")]
`;
}

const TREE_PROJECT = project({ 'res://tree.glb': INSTANCED_TREE, 'res://other.glb': INSTANCED_TREE });

function refusalLines(diagnostics: readonly { ruleName: string; location?: { line?: number } }[]) {
  return diagnostics.filter((d) => d.ruleName === RULE).map((d) => d.location?.line);
}

/** A session whose last lint of `sceneUsing('res://tree.glb')` has read the refused file. */
async function sessionAfterRefusal() {
  const session = new Linter().session();
  await session.lint(sceneUsing('res://tree.glb'), TREE_PROJECT).later;
  return session;
}

describe('LintSession.lint', () => {
  it('publishes the file-local list now and the full list later, errors first', async () => {
    const { now, later } = new Linter().session().lint(sceneUsing('res://tree.glb'), TREE_PROJECT);

    expect(refusalLines(now)).toEqual([]);
    const complete = await later;
    expect(refusalLines(complete!)).toEqual([3]);
    const ranks = complete!.map((d) => ['error', 'warning', 'info'].indexOf(d.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('keeps the last cross-file diagnostics in the next lint while its read is pending', async () => {
    const session = await sessionAfterRefusal();

    expect(refusalLines(session.lint(sceneUsing('res://tree.glb'), TREE_PROJECT).now)).toEqual([3]);
  });

  it('moves a kept diagnostic onto the line its [ext_resource] moved to', async () => {
    const session = await sessionAfterRefusal();

    expect(
      refusalLines(session.lint(sceneUsing('res://tree.glb', { blankLines: 2 }), TREE_PROJECT).now)
    ).toEqual([5]);
  });

  it('drops a kept diagnostic whose [ext_resource] id is gone', async () => {
    const session = await sessionAfterRefusal();

    expect(
      refusalLines(session.lint(sceneUsing('res://tree.glb', { id: '2_tree' }), TREE_PROJECT).now)
    ).toEqual([]);
  });

  it('drops a kept diagnostic whose [ext_resource] now names another file', async () => {
    const session = await sessionAfterRefusal();

    expect(refusalLines(session.lint(sceneUsing('res://other.glb'), TREE_PROJECT).now)).toEqual([]);
  });

  it('keeps a kept diagnostic about the whole file as it was', async () => {
    const throwing: ResourceProvider = {
      loadResource: () => {
        throw new Error('provider bug');
      },
    };
    const session = new Linter().session();
    await session.lint(sceneUsing('res://tree.glb'), throwing).later;

    const { now } = session.lint(sceneUsing('res://tree.glb', { blankLines: 1 }), throwing);

    expect(now.filter((d) => d.ruleName === FILE_DIAGNOSTICS.ruleCrashed.ruleName)).toHaveLength(1);
  });

  it('forgets the cross-file diagnostics once a lint uses no glTF', async () => {
    const session = await sessionAfterRefusal();
    const { later } = session.lint('[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n', TREE_PROJECT);

    expect(later).toBeNull();
    expect(refusalLines(session.lint(sceneUsing('res://tree.glb'), TREE_PROJECT).now)).toEqual([]);
  });

  it('resolves an overtaken lint to null, and keeps only the newest read', async () => {
    const session = new Linter().session();
    const first = session.lint(sceneUsing('res://tree.glb'), TREE_PROJECT);
    const second = session.lint(sceneUsing('res://tree.glb', { blankLines: 1 }), TREE_PROJECT);

    expect(await first.later).toBeNull();
    expect(refusalLines((await second.later)!)).toEqual([4]);
  });

  it('runs only the file-local rules with no provider, and forgets the kept diagnostics', async () => {
    const session = await sessionAfterRefusal();
    const { now, later } = session.lint(sceneUsing('res://tree.glb'), null);

    expect(later).toBeNull();
    expect(refusalLines(now)).toEqual([]);
  });
});

describe('LintSession.reads', () => {
  it('names the used glTF files and the project files the plugin probe reads', () => {
    const session = new Linter().session();
    session.lint(sceneUsing('res://tree.glb'), TREE_PROJECT);

    expect([...session.reads].sort()).toEqual([
      'res://.godot/extension_list.cfg',
      'res://godot/extension_list.cfg',
      'res://project.godot',
      'res://tree.glb',
    ]);
  });

  it('is empty for a file that uses no glTF, and before any lint', () => {
    const session = new Linter().session();
    expect(session.reads).toEqual([]);

    session.lint(sceneUsing('res://tree.tscn'), TREE_PROJECT);
    expect(session.reads).toEqual([]);
  });
});

describe('Linter.lintComplete', () => {
  it('is the full list in one answer', async () => {
    expect(refusalLines(await new Linter().lintComplete(sceneUsing('res://tree.glb'), TREE_PROJECT))).toEqual(
      [3]
    );
  });

  it('is the file-local lint with no provider', async () => {
    const content = sceneUsing('res://tree.glb');
    expect(await new Linter().lintComplete(content, null)).toEqual(new Linter().lint(content));
  });
});
