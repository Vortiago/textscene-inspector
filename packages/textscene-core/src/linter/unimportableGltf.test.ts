/**
 * A lint session reads each glTF a scene uses through the host's provider. A file whose `extensionsRequired`
 * names an extension Godot's importer does not read never imports (`gltf_document.cpp:7197-7202`). The text loader
 * then fails the file's load where a sub-resource, a `[resource]` body, a `[connection]` or the first node heading uses
 * it (`resource_format_text.cpp:146-154`), and leaves out only the node where a node uses it (`:288-289`).
 */

import { describe, expect, it, vi } from 'vitest';
import { Linter } from './Linter.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { triangleGlb } from '../resources/formats/glb/testing/triangleGlb.js';
import { PLAIN_PROJECT_FILE, memoryProject, unlistableProject } from './testing/memoryProject.js';
import './index.js';

const RULE = FILE_DIAGNOSTICS.unimportableGltf.ruleName;
const PLUGIN_RULE = FILE_DIAGNOSTICS.unimportableGltfUnlessPlugin.ruleName;
const NODE_RULE = FILE_DIAGNOSTICS.unimportableGltfInNode.ruleName;

/**
 * A provider over an in-memory project that can list itself, with a `project.godot` that enables no plugin and
 * declares no autoload unless `files` gives its own. A path it does not hold is missing.
 */
function project(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return memoryProject({ 'res://project.godot': PLAIN_PROJECT_FILE, ...files });
}

const INSTANCED_TREE = triangleGlb({ extensionsRequired: ['EXT_mesh_gpu_instancing'], instanced: true });

/**
 * A scene whose one ext_resource, on line 3, points at `path`, and whose root heading inherits it. The loader reads
 * that heading outside a node body, so a failed load of it fails the scene's load.
 */
function sceneUsing(path: string): string {
  return `[gd_scene format=3]

[ext_resource type="PackedScene" path="${path}" id="1_tree"]

[node name="Tree" instance=ExtResource("1_tree")]
`;
}

/** A scene whose one ext_resource, on line 3, points at `path`, and whose `Tree` child node instances it. */
function sceneInstancing(path: string): string {
  return `[gd_scene format=3]

[ext_resource type="PackedScene" path="${path}" id="1_tree"]

[node name="Root" type="Node3D"]

[node name="Tree" parent="." instance=ExtResource("1_tree")]
`;
}

async function refusals(content: string, provider: ResourceProvider) {
  const diagnostics = await new Linter().lintComplete(content, provider);
  const rules: readonly string[] = [RULE, PLUGIN_RULE, NODE_RULE];
  return diagnostics.filter((d) => rules.includes(d.ruleName));
}

describe('unimportable glTF', () => {
  it('reports an error on the ext_resource heading of a used GLB that requires EXT_mesh_gpu_instancing', async () => {
    const diagnostics = await refusals(
      sceneUsing('res://tree.glb'),
      project({ 'res://tree.glb': INSTANCED_TREE })
    );

    expect(diagnostics).toEqual([
      {
        severity: 'error',
        ruleName: RULE,
        nodeName: '1_tree',
        nodeType: 'PackedScene',
        location: { line: 3, column: 1 },
        message: expect.stringContaining("'EXT_mesh_gpu_instancing'"),
      },
    ]);
    expect(diagnostics[0]!.message).toContain('res://tree.glb');
    expect(diagnostics[0]!.message).toContain('Godot fails to load the file');
  });

  it('names every refused extension of a text glTF', async () => {
    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      extensionsRequired: ['EXT_mesh_gpu_instancing', 'KHR_draco_mesh_compression', 'KHR_texture_transform'],
    });
    const [diagnostic] = await refusals(sceneUsing('res://tree.gltf'), project({ 'res://tree.gltf': gltf }));

    expect(diagnostic!.message).toContain("'EXT_mesh_gpu_instancing', 'KHR_draco_mesh_compression'");
    expect(diagnostic!.message).not.toContain('KHR_texture_transform');
  });

  it('matches the file extension case-insensitively, as the importer does', async () => {
    expect(
      await refusals(sceneUsing('res://TREE.GLB'), project({ 'res://TREE.GLB': INSTANCED_TREE }))
    ).toHaveLength(1);
  });

  it('reports an error for a GLB named in a sub-resource value, which fails the load', async () => {
    const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[sub_resource type="MeshLibrary" id="lib"]
metadata/source = ExtResource("1_tree")

[node name="Root" type="Node3D"]
`;
    expect(await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }))).toMatchObject([
      { severity: 'error', ruleName: RULE },
    ]);
  });

  it("reports an error for a GLB named only in a .tres file's [resource] body", async () => {
    const content = `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[resource]
item/0/mesh = ExtResource("1_tree")
`;
    expect(await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }))).toMatchObject([
      { severity: 'error', ruleName: RULE },
    ]);
  });

  it("reports an error for a GLB named only in a [connection] heading's binds", async () => {
    const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[node name="Root" type="Node3D"]

[connection signal="ready" from="." to="." method="_on_ready" binds= [ExtResource("1_tree")]]
`;
    expect(await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }))).toMatchObject([
      { severity: 'error', ruleName: RULE },
    ]);
  });

  it('says the file fails to load, not a scene, for a .tres that uses the GLB', async () => {
    const content = `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[resource]
item/0/mesh = ExtResource("1_tree")
`;
    const [refusal] = await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }));

    expect(refusal!.message).toContain('Godot fails to load the file.');
    expect(refusal!.message).not.toContain('scene');
  });

  it('reports nothing for a .tres file that declares a refused GLB and uses it nowhere', async () => {
    const content = `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[resource]
item/0/name = "Tree"
`;
    expect(await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }))).toEqual([]);
  });

  it('reports nothing for a file whose required extensions Godot imports', async () => {
    const tree = triangleGlb({
      extensionsUsed: ['KHR_texture_transform'],
      extensionsRequired: ['KHR_texture_transform'],
    });
    expect(await refusals(sceneUsing('res://tree.glb'), project({ 'res://tree.glb': tree }))).toEqual([]);
  });

  it('reports nothing for a file the provider does not hold', async () => {
    expect(await refusals(sceneUsing('res://tree.glb'), project({}))).toEqual([]);
  });

  it('reports nothing when the provider throws', async () => {
    const failing: ResourceProvider = {
      loadResource: () => Promise.reject(new Error('Resource not found: res://tree.glb')),
    };
    expect(await refusals(sceneUsing('res://tree.glb'), failing)).toEqual([]);
  });

  it('reports nothing for a file whose JSON Godot cannot read', async () => {
    expect(
      await refusals(sceneUsing('res://tree.gltf'), project({ 'res://tree.gltf': '{"asset": ' }))
    ).toEqual([]);
  });

  it('reports nothing for an ext_resource no value uses', async () => {
    const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[node name="Root" type="Node3D"]
`;
    expect(await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }))).toEqual([]);
  });

  it('reports nothing for a relative path, which it does not resolve', async () => {
    expect(await refusals(sceneUsing('tree.glb'), project({ 'tree.glb': INSTANCED_TREE }))).toEqual([]);
  });

  it('reads the path of an ext_resource that also names a uid, which it does not resolve', async () => {
    const content = `[gd_scene format=3]

[ext_resource type="PackedScene" uid="uid://b2tree" path="res://tree.glb" id="1_tree"]

[node name="Tree" instance=ExtResource("1_tree")]
`;
    expect(await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }))).toHaveLength(1);
  });

  it('reads nothing for a path that is not a glTF', async () => {
    const read: string[] = [];
    const provider: ResourceProvider = {
      loadResource: async (path) => {
        read.push(path);
        return INSTANCED_TREE;
      },
    };
    expect(await refusals(sceneUsing('res://tree.tscn'), provider)).toEqual([]);
    expect(read).toEqual([]);
  });

  it('leaves the file-local lint silent, since it reads no other file', () => {
    expect(new Linter().lint(sceneUsing('res://tree.glb')).filter((d) => d.ruleName === RULE)).toEqual([]);
  });

  it('keeps the file-local diagnostics and sorts the merged list errors first', async () => {
    const content = `${sceneUsing('res://tree.glb')}
[node name="Light" type="OmniLight3D" parent="."]
omni_range = -1.0
`;
    const local = new Linter().lint(content);
    const merged = await new Linter().lintComplete(content, project({ 'res://tree.glb': INSTANCED_TREE }));

    expect(merged).toHaveLength(local.length + 1);
    expect(merged).toEqual(expect.arrayContaining(local));
    const ranks = merged.map((d) => ['error', 'warning', 'info'].indexOf(d.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('hands back the file-local diagnostics at once, before any file is read', () => {
    const content = sceneUsing('res://tree.glb');
    const { now } = new Linter().session().lint(content, { loadResource: () => new Promise(() => {}) });

    expect(now).toEqual(new Linter().lint(content));
  });

  it('has nothing to read later when the scene uses no glTF, so a host publishes once', () => {
    const provider = project({ 'res://tree.glb': INSTANCED_TREE });
    const unused = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[node name="Root" type="Node3D"]
`;

    expect(new Linter().session().lint(sceneUsing('res://tree.tscn'), provider).later).toBeNull();
    expect(new Linter().session().lint(unused, provider).later).toBeNull();
  });

  it('reports a throw inside the cross-file rule as rule-crashed and keeps the file-local diagnostics', async () => {
    const throwing: ResourceProvider = {
      loadResource: () => {
        throw new Error('provider bug');
      },
    };
    const content = `${sceneUsing('res://tree.glb')}
[node name="Light" type="OmniLight3D" parent="."]
omni_range = -1.0
`;
    const { now, later } = new Linter().session().lint(content, throwing);
    const complete = (await later) ?? [];

    expect(now.some((d) => d.ruleName === FILE_DIAGNOSTICS.ruleCrashed.ruleName)).toBe(false);
    expect(complete).toEqual(expect.arrayContaining(now));
    expect(complete.filter((d) => !now.includes(d))).toEqual([
      {
        severity: 'error',
        ruleName: FILE_DIAGNOSTICS.ruleCrashed.ruleName,
        nodeName: '<unknown>',
        nodeType: '<unknown>',
        message: expect.stringMatching(new RegExp(`^Rule '${RULE}' threw .*provider bug`)),
      },
    ]);
  });

  it('declines a legacy-format file whole, as the file-local lint does', () => {
    const content = sceneUsing('res://tree.glb').replace('format=3', 'format=2');
    const { now, later } = new Linter()
      .session()
      .lint(content, project({ 'res://tree.glb': INSTANCED_TREE }));

    expect(now).toEqual(new Linter().lint(content));
    expect(later).toBeNull();
  });
});

describe('unimportable glTF in a project that may register a GLTFDocumentExtension', () => {
  it('is an error when the project enables no editor plugin, declares no autoload and holds no GDExtension', async () => {
    const files = { 'res://tree.glb': INSTANCED_TREE, 'res://project.godot': 'config_version=5\n' };
    const [diagnostic] = await refusals(sceneUsing('res://tree.glb'), project(files));

    expect(diagnostic).toMatchObject({ severity: 'error', ruleName: RULE });
    expect(diagnostic!.message).toContain(
      'enables no editor plugin, declares no autoload and holds no GDExtension'
    );
  });

  it('is a warning when the project holds a .gdextension file anywhere, with no .godot directory', async () => {
    const files = { 'res://tree.glb': INSTANCED_TREE, 'res://addons/gltf/bin/gltf.gdextension': '' };
    const [diagnostic] = await refusals(sceneUsing('res://tree.glb'), project(files));

    expect(diagnostic).toMatchObject({ severity: 'warning', ruleName: PLUGIN_RULE });
  });

  it('is a warning when the project declares an autoload, which a tool script can make register one', async () => {
    const files = {
      'res://tree.glb': INSTANCED_TREE,
      'res://project.godot': '[autoload]\n\nGltf="*res://gltf.gd"\n',
    };
    const [diagnostic] = await refusals(sceneUsing('res://tree.glb'), project(files));

    expect(diagnostic).toMatchObject({ severity: 'warning', ruleName: PLUGIN_RULE });
    expect(diagnostic!.message).toContain('an autoload');
  });

  it('reads only the last declaration of an id, which is the one a use loads', async () => {
    const scene = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://old_tree.glb" id="1_tree"]
[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[node name="Tree" instance=ExtResource("1_tree")]
`;
    const files = { 'res://old_tree.glb': INSTANCED_TREE, 'res://tree.glb': triangleGlb({}) };

    expect(await refusals(scene, project(files))).toEqual([]);
    expect(await refusals(scene, project({ ...files, 'res://tree.glb': INSTANCED_TREE }))).toHaveLength(1);
  });

  it('is a warning when the project declares an autoload whose Unicode name Godot writes as a quoted key', async () => {
    const files = {
      'res://tree.glb': INSTANCED_TREE,
      'res://project.godot': '[autoload]\n\n"Größe"="*res://gltf.gd"\n',
    };
    const [diagnostic] = await refusals(sceneUsing('res://tree.glb'), project(files));

    expect(diagnostic).toMatchObject({ severity: 'warning', ruleName: PLUGIN_RULE });
  });

  it('is a warning for a provider that cannot list the project, since nothing rules a GDExtension out', async () => {
    const files = { 'res://tree.glb': INSTANCED_TREE, 'res://project.godot': PLAIN_PROJECT_FILE };
    const [diagnostic] = await refusals(sceneUsing('res://tree.glb'), unlistableProject(files));

    expect(diagnostic).toMatchObject({ severity: 'warning', ruleName: PLUGIN_RULE });
  });

  it('is a warning for a project whose project.godot it cannot read', async () => {
    const [diagnostic] = await refusals(
      sceneUsing('res://tree.glb'),
      memoryProject({ 'res://tree.glb': INSTANCED_TREE })
    );

    expect(diagnostic).toMatchObject({ severity: 'warning', ruleName: PLUGIN_RULE });
  });

  it('lists the project only when a glTF is refused', async () => {
    const tree = triangleGlb({
      extensionsUsed: ['KHR_texture_transform'],
      extensionsRequired: ['KHR_texture_transform'],
    });
    const provider = project({ 'res://tree.glb': tree });
    const list = vi.spyOn(provider, 'listFiles' as never) as unknown as ReturnType<typeof vi.fn>;

    await refusals(sceneUsing('res://tree.glb'), provider);

    expect(list).not.toHaveBeenCalled();
  });

  it('is a warning when the project enables an editor plugin, which may register one', async () => {
    const files = {
      'res://tree.glb': INSTANCED_TREE,
      'res://project.godot':
        '[editor_plugins]\n\nenabled=PackedStringArray("res://addons/gltf_instancing/plugin.cfg")\n',
    };
    const diagnostics = await refusals(sceneUsing('res://tree.glb'), project(files));

    expect(diagnostics).toEqual([
      {
        severity: 'warning',
        ruleName: PLUGIN_RULE,
        nodeName: '1_tree',
        nodeType: 'PackedScene',
        location: { line: 3, column: 1 },
        message: expect.stringContaining("'EXT_mesh_gpu_instancing'"),
      },
    ]);
    expect(diagnostics[0]!.message).toContain('GLTFDocumentExtension');
  });

  it('does not wait for the project files when nothing is refused', async () => {
    const tree = triangleGlb({
      extensionsUsed: ['KHR_texture_transform'],
      extensionsRequired: ['KHR_texture_transform'],
    });
    const provider: ResourceProvider = {
      loadResource: (path) => (path === 'res://tree.glb' ? Promise.resolve(tree) : new Promise(() => {})),
    };

    expect(await refusals(sceneUsing('res://tree.glb'), provider)).toEqual([]);
  });
});

describe('unimportable glTF that only a node uses', () => {
  it('is a warning on the ext_resource heading where a child node instances it, since the scene still loads', async () => {
    const diagnostics = await refusals(
      sceneInstancing('res://tree.glb'),
      project({ 'res://tree.glb': INSTANCED_TREE })
    );

    expect(diagnostics).toEqual([
      {
        severity: 'warning',
        ruleName: NODE_RULE,
        nodeName: '1_tree',
        nodeType: 'PackedScene',
        location: { line: 3, column: 1 },
        message: expect.stringContaining("'EXT_mesh_gpu_instancing'"),
      },
    ]);
    expect(diagnostics[0]!.message).toContain('nothing can add support');
    expect(diagnostics[0]!.message).toContain('the editor reports a broken dependency');
    expect(diagnostics[0]!.message).toContain('a running game loads the scene without it');
  });

  it("is a warning where only a node's property value names it", async () => {
    const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[node name="Root" type="Node3D"]
metadata/tree = ExtResource("1_tree")
`;
    expect(await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }))).toMatchObject([
      { severity: 'warning', ruleName: NODE_RULE },
    ]);
  });

  it('is one warning, which names the plugin, where code in the project may add support', async () => {
    const files = { 'res://tree.glb': INSTANCED_TREE, 'res://addons/gltf/gltf.gdextension': '' };
    const diagnostics = await refusals(sceneInstancing('res://tree.glb'), project(files));

    expect(diagnostics).toMatchObject([{ severity: 'warning', ruleName: NODE_RULE }]);
    expect(diagnostics[0]!.message).toContain('GLTFDocumentExtension');
    expect(diagnostics[0]!.message).toContain('a running game loads the scene without it');
  });

  it('is an error where a sub-resource also uses it, since the aborting use decides', async () => {
    const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[sub_resource type="MeshLibrary" id="lib"]
metadata/source = ExtResource("1_tree")

[node name="Root" type="Node3D"]

[node name="Tree" parent="." instance=ExtResource("1_tree")]
`;
    expect(await refusals(content, project({ 'res://tree.glb': INSTANCED_TREE }))).toMatchObject([
      { severity: 'error', ruleName: RULE },
    ]);
  });

  it('judges each ext_resource by its own uses in one scene', async () => {
    const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]
[ext_resource type="PackedScene" path="res://bush.glb" id="2_bush"]

[sub_resource type="MeshLibrary" id="lib"]
metadata/source = ExtResource("1_tree")

[node name="Root" type="Node3D"]

[node name="Bush" parent="." instance=ExtResource("2_bush")]
`;
    const files = { 'res://tree.glb': INSTANCED_TREE, 'res://bush.glb': INSTANCED_TREE };
    const diagnostics = await refusals(content, project(files));

    expect(diagnostics.map((d) => [d.nodeName, d.severity, d.ruleName])).toEqual([
      ['1_tree', 'error', RULE],
      ['2_bush', 'warning', NODE_RULE],
    ]);
  });
});

describe("the linter's glTF verdict cache", () => {
  it('reads a GLB once when two headings name it in one lint', async () => {
    let glbReads = 0;
    const files: Record<string, string | ArrayBuffer> = { 'res://project.godot': PLAIN_PROJECT_FILE };
    const provider: ResourceProvider = {
      ...memoryProject(files),
      loadResource: async (path) => {
        if (path !== 'res://tree.glb') return files[path] ?? null;
        glbReads++;
        return INSTANCED_TREE;
      },
      stamp: async () => '100:144',
    };
    const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_a"]
[ext_resource type="PackedScene" path="res://tree.glb" id="2_b"]

[node name="Root" type="Node3D"]

[node name="A" parent="." instance=ExtResource("1_a")]

[node name="B" parent="." instance=ExtResource("2_b")]
`;

    expect(await refusals(content, provider)).toHaveLength(2);
    expect(glbReads).toBe(1);
  });

  it('does not read an unchanged file again across lints, and reports the same refusal', async () => {
    let glbReads = 0;
    const provider: ResourceProvider = {
      loadResource: async (path) => {
        if (path === 'res://project.godot') return PLAIN_PROJECT_FILE;
        if (path !== 'res://tree.glb') return null;
        glbReads++;
        return INSTANCED_TREE;
      },
      stamp: async () => '100:144',
      listFiles: async () => [],
    };
    const linter = new Linter();

    const first = await linter.lintComplete(sceneUsing('res://tree.glb'), provider);
    const second = await linter.lintComplete(sceneUsing('res://tree.glb'), provider);

    expect(glbReads).toBe(1);
    expect(second).toEqual(first);
    expect(second.map((d) => d.ruleName)).toEqual([RULE]);
  });
});
