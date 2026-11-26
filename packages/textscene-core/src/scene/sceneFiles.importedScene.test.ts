import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene, type Scene } from './openScene';
import type { SceneFile } from './sceneFiles';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { triangleGlb } from '../resources/formats/glb/testing/triangleGlb';

const MAIN = 'res://main.tscn';
const GLB = 'res://model.glb';
const BLUE = 'res://blue.tres';
const GLTF_MATERIAL = 'Body';

const SCENE = `[gd_scene format=3]

[ext_resource type="PackedScene" path="${GLB}" id="1"]

[node name="Main" type="Node3D"]

[node name="Model" parent="." instance=ExtResource("1")]
`;

/** A sidecar that remaps the glTF material `name` to `path` (resource_importer_scene.cpp:1620-1645). */
const sidecarRemapping = (name: string, path: string) => `[remap]

importer="scene"

[params]

_subresources={
"materials": {
"${name}": {
"use_external/enabled": true,
"use_external/path": "${path}"
}
}
}
`;

const BLUE_MATERIAL = '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\n';

function filesOf(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return { loadResource: async (path) => files[path] ?? null };
}

function withModel(files: Record<string, string>): ResourceProvider {
  const model = triangleGlb({ material: { name: GLTF_MATERIAL } });
  return filesOf({ [GLB]: model, ...files });
}

/** The files once none is loading and the model's own row has loaded. */
function whenModelLoaded(scene: Scene): Promise<readonly SceneFile[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(JSON.stringify(scene.files()))), 4000);
    const check = () => {
      const files = scene.files();
      const isLoading = files.some((file) => file.state === 'loading');
      if (isLoading || !files.some((file) => file.path === GLB)) return;
      clearTimeout(timer);
      stop();
      resolve(files);
    };
    const stop = scene.subscribe(check);
    check();
  });
}

const rowsOf = (files: readonly SceneFile[]) =>
  files.map(({ path, state, owners }) => ({ path, state, owners }));

describe('the files of an imported scene', () => {
  it('names the material file an import sidecar remaps a glTF material to, with the model as its owner', async () => {
    const provider = withModel({
      [`${GLB}.import`]: sidecarRemapping(GLTF_MATERIAL, BLUE),
      [BLUE]: BLUE_MATERIAL,
    });
    const scene = openScene({ source: SCENE, provider, rootScenePath: MAIN });

    const files = await whenModelLoaded(scene);

    expect(rowsOf(files).filter(({ path }) => path === BLUE)).toEqual([
      { path: BLUE, state: 'loaded', owners: [GLB] },
    ]);
  });

  it('names no remapped material file that fails to load, as Godot keeps the glTF material', async () => {
    const provider = withModel({ [`${GLB}.import`]: sidecarRemapping(GLTF_MATERIAL, BLUE) });
    const scene = openScene({ source: SCENE, provider, rootScenePath: MAIN });

    const files = await whenModelLoaded(scene);

    expect(files.map(({ path }) => path)).not.toContain(BLUE);
    expect(scene.sceneFailure()).toBeNull();
  });

  it('names no material file for a remap of a material the model does not have', async () => {
    const provider = withModel({ [`${GLB}.import`]: sidecarRemapping('Other', BLUE), [BLUE]: BLUE_MATERIAL });
    const scene = openScene({ source: SCENE, provider, rootScenePath: MAIN });

    const files = await whenModelLoaded(scene);

    expect(files.map(({ path }) => path)).not.toContain(BLUE);
  });
});
