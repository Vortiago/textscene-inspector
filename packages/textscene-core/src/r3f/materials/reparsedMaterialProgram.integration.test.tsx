/**
 * A `.tscn` re-parse mutates props on an ALREADY-MOUNTED material.
 *
 * `NodeDispatcher` keys a node on its NAME, so an edited scene re-renders the
 * SAME React element with new props rather than mounting a new one. three bakes
 * its derived program parameters at a material's FIRST compile
 * (`WebGLPrograms.js:56` `getParameters`) and re-derives only when
 * `material.version` moves or one of the fixed re-checks at
 * `WebGLRenderer.js:2388` fires — `transparent`, `blending`, `side`,
 * `vertexColors` and the texture-slot presences are on neither list. An
 * opaque→transparent edit therefore leaves `#define OPAQUE`
 * (`WebGLProgram.js:776`) baked, and `opaque_fragment` forces
 * `diffuseColor.a = 1.0` for the life of the material — opacity ignored.
 *
 * FrontSide only: a transparent DoubleSide material re-derives once per pass at
 * `WebGLRenderer.js:2133-2141`, which incidentally refreshes every stale
 * parameter at once. So does any other coincidental re-derive (a light-set
 * change, an env map arriving) — which is why the bug is flaky and no golden or
 * e2e run ever caught it.
 *
 * The test renderer never reaches `setProgram`, so these assert the
 * PRECONDITION for the recompile — a material three has never seen, or the same
 * one with its `version` moved past the compiled program's — not the recompile.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer, { type ReactThreeTest } from '@react-three/test-renderer';
import { NodeDispatcher } from '../NodeDispatcher';
import { SelectionProvider } from '../contexts/SelectionContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../../resources/ResourceLoader';
import { TscnParser } from '../../parser/TscnParser';
import { instanceAs } from '../../nodes/3d/testing/reactThreeTestInstance';

import '../nodes/index';

const SPRITE_TEXTURE = 'res://textures/sprite.png';

function treeFor(tscn: string, loader: ResourceLoader) {
  const scene = new TscnParser().parse(tscn);
  return (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider
        internalResources={scene.internalResources}
        externalResources={scene.externalResources}
      >
        <SelectionProvider>
          <NodeDispatcher nodes={scene.nodes} />
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

/** The material at `slot` on the mesh the dispatcher rendered for `name`. */
function materialAt(
  scene: ReactThreeTest.ReactThreeTestInstance,
  name: string,
  slot = 0
): THREE.Material {
  const node = scene.findAllByType('Mesh').find((m) => m.instance.name === name);
  if (!node) throw new Error(`no mesh named ${name}`);
  const material = instanceAs<THREE.Mesh>(node).material;
  return Array.isArray(material) ? material[slot]! : material;
}

/** A texture with image dimensions, which is all Sprite3D's quad sizing reads. */
function seededTexture(): THREE.Texture {
  const t = new THREE.Texture();
  (t as unknown as { image: { width: number; height: number } }).image = {
    width: 64,
    height: 64,
  };
  return t;
}

const meshScene = (transparency: string) => `[gd_scene load_steps=3 format=3]

[sub_resource type="BoxMesh" id="Box_1"]
size = Vector3(1, 1, 1)

[sub_resource type="StandardMaterial3D" id="Mat_1"]
cull_mode = 0
transparency = ${transparency}
albedo_color = Color(1, 1, 1, 0.25)

[node name="Root" type="Node3D"]

[node name="Panel" type="MeshInstance3D" parent="."]
mesh = SubResource("Box_1")
material_override = SubResource("Mat_1")
`;

const secondarySurfaceScene = (transparency: string) => `[gd_scene load_steps=3 format=3]

[sub_resource type="BoxMesh" id="Box_1"]
size = Vector3(1, 1, 1)

[sub_resource type="StandardMaterial3D" id="Mat_1"]
cull_mode = 0
transparency = ${transparency}
albedo_color = Color(1, 1, 1, 0.25)

[node name="Root" type="Node3D"]

[node name="Panel" type="MeshInstance3D" parent="."]
mesh = SubResource("Box_1")
surface_material_override/1 = SubResource("Mat_1")
`;

const spriteScene = (transparency: string) => `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="${SPRITE_TEXTURE}" id="1_tex"]

[node name="Root" type="Node3D"]

[node name="Billboard" type="Sprite3D" parent="."]
texture = ExtResource("1_tex")
double_sided = false
transparency = ${transparency}
`;

describe('a re-parsed scene rebuilds materials whose baked program parameters moved', () => {
  it('MeshInstance3D: transparency 0 → 1 on an inline StandardMaterial3D', async () => {
    const fake = createFakeResourceLoader();
    const renderer = await ReactThreeTestRenderer.create(treeFor(meshScene('0'), fake.loader));
    const opaque = materialAt(renderer.scene, 'Panel');
    expect(opaque.transparent).toBe(false);
    const compiledVersion = opaque.version;

    await renderer.update(treeFor(meshScene('1'), fake.loader));

    const blended = materialAt(renderer.scene, 'Panel');
    expect(blended.transparent).toBe(true);
    expect(blended.side).toBe(THREE.FrontSide);
    expect(blended !== opaque || blended.version > compiledVersion).toBe(true);
  });

  it('MeshInstance3D secondary surface: transparency 0 → 1 at material-1', async () => {
    const fake = createFakeResourceLoader();
    const renderer = await ReactThreeTestRenderer.create(
      treeFor(secondarySurfaceScene('0'), fake.loader)
    );
    const opaque = materialAt(renderer.scene, 'Panel', 1);
    expect(opaque.transparent).toBe(false);
    const compiledVersion = opaque.version;

    await renderer.update(treeFor(secondarySurfaceScene('1'), fake.loader));

    const blended = materialAt(renderer.scene, 'Panel', 1);
    expect(blended.transparent).toBe(true);
    expect(blended.side).toBe(THREE.FrontSide);
    expect(blended !== opaque || blended.version > compiledVersion).toBe(true);
  });

  it('Sprite3D: transparency 0 → 0.5 on a single-sided sprite', async () => {
    const fake = createFakeResourceLoader();
    fake.textures.seed(SPRITE_TEXTURE, seededTexture());
    const renderer = await ReactThreeTestRenderer.create(treeFor(spriteScene('0'), fake.loader));
    const opaque = materialAt(renderer.scene, 'Billboard');
    expect(opaque.transparent).toBe(false);
    const compiledVersion = opaque.version;

    await renderer.update(treeFor(spriteScene('0.5'), fake.loader));

    const blended = materialAt(renderer.scene, 'Billboard');
    expect(blended.transparent).toBe(true);
    expect(blended.side).toBe(THREE.FrontSide);
    expect(blended !== opaque || blended.version > compiledVersion).toBe(true);
  });
});
