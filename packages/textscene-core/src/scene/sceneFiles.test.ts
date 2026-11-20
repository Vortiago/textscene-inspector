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
function whenFilesLoaded(scene: Scene): Promise<readonly SceneFile[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`still loading: ${JSON.stringify(scene.files())}`)),
      2000
    );
    const check = () => {
      const files = scene.files();
      if (files.some((file) => file.state === 'loading')) return;
      clearTimeout(timer);
      stop();
      resolve(files);
    };
    const stop = scene.subscribe(check);
    check();
  });
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
        reason: { chain: ['res://icon.png'], cause: 'missing' },
        addresses: [],
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

  it('follows a resource file to the files it reads, and names the chain through which it fails', async () => {
    const provider = filesOf({ 'res://wood.tres': WOOD });
    const scene = openScene({ source: WITH_MATERIAL, provider, rootScenePath: MAIN });
    const files = await whenFilesLoaded(scene);
    expect(files.map(({ path, state, owners, reason }) => ({ path, state, owners, reason }))).toEqual([
      {
        path: 'res://wood.png',
        state: 'missing',
        owners: ['res://wood.tres'],
        reason: { chain: ['res://wood.png'], cause: 'missing' },
      },
      {
        path: 'res://wood.tres',
        state: 'missing',
        owners: [MAIN],
        reason: { chain: ['res://wood.tres', 'res://wood.png'], cause: 'missing' },
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

  it('keeps a file the scene text names after a write stops a node reading it', async () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    await whenFilesLoaded(scene);
    await scene.getNode('.').set('texture', variant('null'));
    expect((await whenFilesLoaded(scene)).map((file) => file.path)).toEqual(['res://icon.png']);
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
        reason: { chain: ['res://wood.tres::Absent'], cause: 'missing' },
        addresses: ['res://wood.tres::Absent'],
      },
    ]);
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
        reason: { chain: ['res://fonts/body.ttf'], cause: 'missing' },
        addresses: [],
      },
      {
        path: 'res://project.godot',
        type: 'ProjectSettings',
        state: 'loaded',
        owners: [],
        reason: null,
        addresses: [],
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

  it('gives the same array while nothing changes', async () => {
    const scene = openScene({ source: SPRITE, provider: filesOf({}), rootScenePath: MAIN });
    const files = await whenFilesLoaded(scene);
    expect(scene.files()).toBe(files);
  });
});
