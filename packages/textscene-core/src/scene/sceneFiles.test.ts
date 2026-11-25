import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';
import type { SceneFile } from './sceneFiles';
import { variant } from './variant';
import { resourcePipelineOf } from '../r3f/sceneResourcePipeline';
import type { ResourceProvider } from '../resources/ResourceProvider';

const MAIN = 'res://main.tscn';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

/** A provider that answers only the files it holds, and lists no folder. */
function filesOf(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return { loadResource: async (path) => files[path] ?? null };
}

/** The files once none is loading. A notice of a change comes in a frame. */
function whenFiles(
  scene: Scene,
  isReady: (files: readonly SceneFile[]) => boolean,
  label: string
): Promise<readonly SceneFile[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: ${JSON.stringify(scene.files())}`)), 2000);
    const check = () => {
      const files = scene.files();
      if (!isReady(files)) return;
      clearTimeout(timer);
      stop();
      resolve(files);
    };
    const stop = scene.subscribe(check);
    check();
  });
}

function whenFilesLoaded(scene: Scene): Promise<readonly SceneFile[]> {
  return whenFiles(scene, (files) => !files.some((file) => file.state === 'loading'), 'still loading');
}

const SPRITE = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[node name="Main" type="Sprite2D"]
texture = ExtResource("1")
`;

const WITH_MATERIAL = `[gd_scene format=3]

[ext_resource type="Material" path="res://wood.tres" id="1"]

[node name="Main" type="MeshInstance3D"]
material_override = ExtResource("1")
`;

const WOOD = `[gd_resource type="StandardMaterial3D" format=3]

[ext_resource type="Texture2D" path="res://wood.png" id="1"]

[resource]
albedo_texture = ExtResource("1")
`;

describe('the files of a scene', () => {
  it('names a texture the provider does not hold as missing, with the file that asked and its type', async () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    expect(await whenFilesLoaded(scene)).toEqual([
      {
        path: 'res://icon.png',
        type: 'Texture2D',
        state: 'missing',
        owners: [MAIN],
        reason: { chain: ['res://icon.png'], cause: 'missing', addresses: [] },
        addresses: [],
        sceneFailure: null,
      },
    ]);
  });

  it('names a texture the provider holds as loaded', async () => {
    const scene = openScene({
      source: SPRITE,
      provider: filesOf({ 'res://icon.png': PNG }),
      rootScenePath: MAIN,
    });
    const [icon] = await whenFilesLoaded(scene);
    expect(icon).toMatchObject({ path: 'res://icon.png', state: 'loaded', reason: null });
  });

  it('gives each file, and the project settings, as loading before the loads answer', () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    expect(scene.files().map(({ path, state }) => ({ path, state }))).toEqual([
      { path: 'res://icon.png', state: 'loading' },
      { path: 'res://project.godot', state: 'loading' },
    ]);
  });

  it('lists no file for a scene that reads none, and never the scene itself', async () => {
    const scene = openScene({
      source: '[gd_scene format=3]\n\n[node name="Main" type="Node"]\n',
      provider: filesOf({}),
    });
    expect(await whenFilesLoaded(scene)).toEqual([]);
  });

  it('names no file missing where the host fails to read a file that exists', async () => {
    const provider: ResourceProvider = {
      loadResource: async (path) => {
        if (path === 'res://wood.tres') throw new Error('the host timed out');
        return null;
      },
    };
    const scene = openScene({ source: WITH_MATERIAL, provider, rootScenePath: MAIN });
    const files = await whenFilesLoaded(scene);
    expect(files.find((file) => file.path === 'res://wood.tres')?.state).toBe('loaded');
  });

  it('counts an import through its sidecar on a host that lists no folder', async () => {
    const provider = filesOf({ 'res://icon.png.import': '[remap]\n' });
    const scene = openScene({ source: SPRITE, provider, rootScenePath: MAIN });
    const [icon] = await whenFilesLoaded(scene);
    expect(icon).toMatchObject({ path: 'res://icon.png', state: 'loaded' });
  });

  it('follows a resource file to the files it reads, and names the chain through which it fails', async () => {
    const provider = filesOf({ 'res://wood.tres': WOOD });
    const scene = openScene({ source: WITH_MATERIAL, provider, rootScenePath: MAIN });
    const files = await whenFilesLoaded(scene);
    expect(files.map(({ path, state, owners, reason }) => ({ path, state, owners, reason }))).toEqual([
      {
        path: 'res://wood.png',
        state: 'missing',
        owners: ['res://wood.tres'],
        reason: { chain: ['res://wood.png'], cause: 'missing', addresses: [] },
      },
      {
        path: 'res://wood.tres',
        state: 'missing',
        owners: [MAIN],
        reason: { chain: ['res://wood.tres', 'res://wood.png'], cause: 'missing', addresses: [] },
      },
    ]);
  });

  it('names every file that asks for a shared file', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Material" path="res://wood.tres" id="1"]
[ext_resource type="Texture2D" path="res://wood.png" id="2"]

[node name="Main" type="Sprite2D"]
texture = ExtResource("2")

[node name="Box" type="MeshInstance3D" parent="."]
material_override = ExtResource("1")
`;
    const scene = openScene({ source, provider: filesOf({ 'res://wood.tres': WOOD }), rootScenePath: MAIN });
    const files = await whenFilesLoaded(scene);
    expect(files.find((file) => file.path === 'res://wood.png')?.owners).toEqual([MAIN, 'res://wood.tres']);
  });

  it('turns a missing file loaded when it arrives, and tells the subscribers', async () => {
    const files: Record<string, ArrayBuffer> = {};
    const scene = openScene({ source: SPRITE, provider: filesOf(files), rootScenePath: MAIN });
    await whenFilesLoaded(scene);
    files['res://icon.png'] = PNG;
    resourcePipelineOf(scene).loader.provideFile('res://icon.png');
    const [icon] = await whenFilesLoaded(scene);
    expect(icon?.state).toBe('loaded');
  });

  it('drops a file when a write stops the one node that reads it', async () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    await whenFilesLoaded(scene);
    await scene.getNode('.').set('texture', variant('null'));
    expect(await whenFilesLoaded(scene)).toEqual([]);
  });

  it('names a file a write reads through scene.load', async () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    await scene.getNode('.').set('texture', await scene.load('res://gone.png'));
    const files = await whenFilesLoaded(scene);
    expect(files.map(({ path, state, owners }) => ({ path, state, owners }))).toEqual([
      { path: 'res://gone.png', state: 'missing', owners: [MAIN] },
    ]);
  });

  it('drops a file when a new text stops naming it', async () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    await whenFilesLoaded(scene);
    scene.setSource('[gd_scene format=3]\n\n[node name="Main" type="Sprite2D"]\n');
    expect(await whenFilesLoaded(scene)).toEqual([]);
  });

  it('names a sub-resource address the file does not declare as missing', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Material" path="res://wood.tres::Absent" id="1"]

[node name="Main" type="MeshInstance3D"]
material_override = ExtResource("1")
`;
    const wood = '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\n';
    const scene = openScene({ source, provider: filesOf({ 'res://wood.tres': wood }), rootScenePath: MAIN });
    expect(await whenFilesLoaded(scene)).toEqual([
      {
        path: 'res://wood.tres',
        type: 'Material',
        state: 'missing',
        owners: [MAIN],
        reason: {
          chain: ['res://wood.tres::Absent'],
          cause: 'missing',
          addresses: ['res://wood.tres::Absent'],
        },
        addresses: ['res://wood.tres::Absent'],
        sceneFailure: null,
      },
    ]);
  });

  it('names every sub-resource address the file does not declare', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Material" path="res://wood.tres::A" id="1"]
[ext_resource type="Material" path="res://wood.tres::B" id="2"]

[node name="Main" type="MeshInstance3D"]
material_override = ExtResource("1")
material_overlay = ExtResource("2")
`;
    const wood = '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\n';
    const scene = openScene({ source, provider: filesOf({ 'res://wood.tres': wood }), rootScenePath: MAIN });
    const [file] = await whenFilesLoaded(scene);
    expect(file?.reason?.addresses).toEqual(['res://wood.tres::A', 'res://wood.tres::B']);
  });

  it('names the project settings the engine reads, and a project font they name that the provider does not hold', async () => {
    const project = '[gui]\n\ntheme/custom_font="res://fonts/body.ttf"\n';
    const provider = filesOf({ 'res://project.godot': project });
    const scene = openScene({ source: '[gd_scene format=3]\n\n[node name="Main" type="Label"]\n', provider });
    expect(await whenFilesLoaded(scene)).toEqual([
      {
        path: 'res://fonts/body.ttf',
        type: 'Font',
        state: 'missing',
        owners: ['res://project.godot'],
        reason: { chain: ['res://fonts/body.ttf'], cause: 'missing', addresses: [] },
        addresses: [],
        sceneFailure: null,
      },
      {
        path: 'res://project.godot',
        type: 'ProjectSettings',
        state: 'loaded',
        owners: [],
        reason: null,
        addresses: [],
        sceneFailure: null,
      },
    ]);
  });

  it('leaves out a file the scene declares and no value reads, as Godot reports none', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://unused.png" id="1"]

[node name="Main" type="Sprite2D"]
`;
    const scene = openScene({ source, provider: filesOf({}), rootScenePath: MAIN });
    expect(await whenFilesLoaded(scene)).toEqual([]);
  });

  it('names the file an orphaned node reads, as Godot re-roots the node (packed_scene.cpp:208-215)', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[node name="Main" type="Node2D"]

[node name="Lost" type="Sprite2D" parent="Gone"]
texture = ExtResource("1")
`;
    const scene = openScene({ source, provider: filesOf({}), rootScenePath: MAIN });
    const files = await whenFilesLoaded(scene);
    expect(files.map(({ path, state }) => ({ path, state }))).toEqual([
      { path: 'res://icon.png', state: 'missing' },
    ]);
  });

  it('follows an instanced scene to the files its nodes read', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Main" type="Node2D"]

[node name="Enemy" parent="." instance=ExtResource("1")]
`;
    const scene = openScene({
      source,
      provider: filesOf({ 'res://enemy.tscn': SPRITE }),
      rootScenePath: MAIN,
    });
    const files = await whenFilesLoaded(scene);
    expect(files.map(({ path, state, owners }) => ({ path, state, owners }))).toEqual([
      { path: 'res://enemy.tscn', state: 'loaded', owners: [MAIN] },
      { path: 'res://icon.png', state: 'missing', owners: ['res://enemy.tscn'] },
    ]);
  });

  it('gives the same array after a write that reads no other file', async () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    const files = await whenFilesLoaded(scene);
    await scene.getNode('.').set('flip_h', variant('true'));
    expect(scene.written()).not.toBe(scene.parse().sceneGraph);
    expect(scene.files()).toBe(files);
  });

  it('gives the same array while nothing changes', async () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    const files = await whenFilesLoaded(scene);
    expect(scene.files()).toBe(files);
  });

  it('gives no file, and loads none, once the scene is disposed', async () => {
    const asked: string[] = [];
    const provider: ResourceProvider = {
      loadResource: async (path) => {
        asked.push(path);
        return null;
      },
    };
    const scene = openScene({ source: SPRITE, provider, rootScenePath: MAIN });
    scene.dispose();

    expect(scene.files()).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked).toEqual([]);
  });
});

const READS_ATLAS = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://atlas.tres" id="1"]

[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")

[node name="Main" type="Node2D"]
`;

const ATLAS_READS_GONE = `[gd_resource type="AtlasTexture" format=3]

[ext_resource type="Texture2D" path="res://gone.png" id="1"]

[resource]
atlas = ExtResource("1")
`;

const EMPTY_MATERIAL = '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\n';

/** The rows that carry a failure of the whole scene, by path. */
async function sceneFailures(source: string, files: Record<string, string>) {
  const scene = openScene({ source, provider: filesOf(files), rootScenePath: MAIN });
  const loaded = await whenFilesLoaded(scene);
  return Object.fromEntries(
    loaded.flatMap((file) => (file.sceneFailure ? [[file.path, file.sceneFailure]] : []))
  );
}

describe('the failure through which the game refuses the scene', () => {
  it('sits on the file a section reads, with Godot error line and the chain from that file', async () => {
    expect(await sceneFailures(READS_ATLAS, { 'res://atlas.tres': ATLAS_READS_GONE })).toEqual({
      'res://atlas.tres': {
        line: 'res://main.tscn - Parse Error: [ext_resource] referenced non-existent resource at: res://atlas.tres.',
        chain: ['res://atlas.tres', 'res://gone.png'],
        cause: 'missing',
      },
    });
  });

  it('sits on a file the scene reads that fails its parse at an undeclared ExtResource id', async () => {
    const atlas = ATLAS_READS_GONE.replace(
      '[resource]',
      '[sub_resource type="AtlasTexture" id="u"]\natlas = ExtResource("9")\n\n[resource]'
    );
    expect(await sceneFailures(READS_ATLAS, { 'res://atlas.tres': atlas })).toEqual({
      'res://atlas.tres': {
        line: 'res://main.tscn - Parse Error: [ext_resource] referenced non-existent resource at: res://atlas.tres.',
        chain: ['res://atlas.tres'],
        cause: 'unparsed',
      },
    });
  });

  it('is on no file once each file the scene reads loads', async () => {
    const files = { 'res://atlas.tres': ATLAS_READS_GONE, 'res://gone.png': 'bytes' };
    expect(await sceneFailures(READS_ATLAS, files)).toEqual({});
  });

  it('is on no file where only a node reads a failing file (resource_format_text.cpp:647-650)', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Material" path="res://wood.tres::Absent" id="1"]

[node name="Main" type="MeshInstance3D"]
material_override = ExtResource("1")
`;
    expect(await sceneFailures(source, { 'res://wood.tres': EMPTY_MATERIAL })).toEqual({});
  });

  it('names the undeclared address of a Resource() literal, as Godot fails its parse', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Material" path="res://wood.tres::A" id="1"]

[node name="Main" type="MeshInstance3D"]
material_override = ExtResource("1")
material_overlay = Resource("res://wood.tres::B")
`;
    expect(await sceneFailures(source, { 'res://wood.tres': EMPTY_MATERIAL })).toEqual({
      'res://wood.tres': {
        line: 'Parse Error: Parse error. [Resource file res://main.tscn]',
        chain: ['res://wood.tres::B'],
        cause: 'missing',
      },
    });
  });

  it('sits only on the first failing file in the order the scene reads', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://second.png" id="2"]
[ext_resource type="Texture2D" path="res://first.png" id="1"]

[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")

[sub_resource type="AtlasTexture" id="b"]
atlas = ExtResource("2")

[node name="Main" type="Node2D"]
`;
    expect(Object.keys(await sceneFailures(source, {}))).toEqual(['res://first.png']);
  });

  it('gives the line Godot prints for a Resource() literal of a section', async () => {
    const source = `[gd_scene format=3]

[sub_resource type="Resource" id="x"]
m = Resource("res://gone.tres")

[node name="Main" type="Node2D"]
`;
    expect(await sceneFailures(source, {})).toEqual({
      'res://gone.tres': {
        line: "res://main.tscn - Parse Error: Can't load resource at path: res://gone.tres with uid: .",
        chain: ['res://gone.tres'],
        cause: 'missing',
      },
    });
  });

  it('follows the file order across an ExtResource read and a Resource() literal', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://b.png" id="1"]

[sub_resource type="AtlasTexture" id="x"]
atlas = Resource("res://a.tres")

[sub_resource type="AtlasTexture" id="y"]
atlas = ExtResource("1")

[node name="Main" type="Node2D"]
`;
    expect(Object.keys(await sceneFailures(source, {}))).toEqual(['res://a.tres']);
  });

  it('is on no file while an earlier read still loads, though a later one fails', async () => {
    const source = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://slow.tres" id="1"]
[ext_resource type="Texture2D" path="res://gone.png" id="2"]

[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")

[sub_resource type="AtlasTexture" id="b"]
atlas = ExtResource("2")

[node name="Main" type="Node2D"]
`;
    const provider: ResourceProvider = {
      loadResource: (path) => (path === 'res://slow.tres' ? new Promise(() => {}) : Promise.resolve(null)),
    };
    const scene = openScene({ source, provider, rootScenePath: MAIN });
    const files = await whenFileMissing(scene, 'res://gone.png');
    expect(files.filter((file) => file.sceneFailure)).toEqual([]);
  });
});

/** The files once `path` is missing. A notice of a change comes in a frame. */
function whenFileMissing(scene: Scene, path: string): Promise<readonly SceneFile[]> {
  const isMissing = (files: readonly SceneFile[]) =>
    files.some((file) => file.path === path && file.state === 'missing');
  return whenFiles(scene, isMissing, 'not missing');
}
