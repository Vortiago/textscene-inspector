/**
 * A re-parse mutates props on a mounted material, as `NodeDispatcher` keys a node
 * on its name. three bakes program parameters at first compile (`WebGLPrograms.js:56`)
 * and re-derives on a `version` move or `WebGLRenderer.js:2388`'s re-checks, and neither
 * covers `transparent`, `blending`, `side`, `vertexColors` or slot presence.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer, { type ReactThreeTest } from '@react-three/test-renderer';
import { NodeDispatcher } from '../NodeDispatcher';
import { SceneStack } from '../testing/SceneStack';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../../resources/ResourceLoader';
import { TscnParser } from '../../parser/TscnParser';
import { instanceAs } from '../../nodes/3d/testing/reactThreeTestInstance';

import '../nodes/index';
import { inlineTwoSurfaceMeshTscn } from '../../nodes/3d/meshinstance3d/testing/twoSurfaceMesh';

const SPRITE_TEXTURE = 'res://textures/sprite.png';

function treeFor(tscn: string, loader: ResourceLoader) {
  const scene = new TscnParser().parse(tscn);
  return (
    <SceneStack loader={loader} scene={scene}>
      <NodeDispatcher nodes={scene.nodes} />
    </SceneStack>
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

// A real two-surface mesh: `MeshInstance3D::_set`
// (`scene/3d/mesh_instance_3d.cpp:65-73`) drops an override past a
// PrimitiveMesh's single surface, so a BoxMesh has no `material-1` to rebuild.
const secondarySurfaceScene = (transparency: string) => `[gd_scene load_steps=3 format=3]

${inlineTwoSurfaceMeshTscn('Mesh_1')}
[sub_resource type="StandardMaterial3D" id="Mat_1"]
cull_mode = 0
transparency = ${transparency}
albedo_color = Color(1, 1, 1, 0.25)

[node name="Root" type="Node3D"]

[node name="Panel" type="MeshInstance3D" parent="."]
mesh = SubResource("Mesh_1")
surface_material_override/1 = SubResource("Mat_1")
`;

const spriteScene = (alphaCut: string) => `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="${SPRITE_TEXTURE}" id="1_tex"]

[node name="Root" type="Node3D"]

[node name="Billboard" type="Sprite3D" parent="."]
texture = ExtResource("1_tex")
double_sided = false
alpha_cut = ${alphaCut}
`;

/**
 * An opaque→transparent edit leaves `#define OPAQUE` (`WebGLProgram.js:776`) baked,
 * and `opaque_fragment` forces `diffuseColor.a = 1.0`. FrontSide only: a transparent
 * DoubleSide material re-derives once per pass (`WebGLRenderer.js:2133-2141`), as a
 * light-set change or an arriving env map also does, so the fault shows only sometimes.
 */
describe('a re-parsed scene rebuilds materials whose baked program parameters moved', () => {
  // The test renderer never reaches `setProgram`, so these assert the precondition:
  // a new material, or the same one with its `version` past the compiled program's.
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

  // `transparency` cannot serve here: a sprite blends at every value of it
  // (`scene/3d/sprite_3d.cpp:293` → TRANSPARENCY_ALPHA), so nothing baked moves.
  // `alpha_cut` DISCARD leaves the alpha pass entirely (`:287`).
  it('Sprite3D: alpha_cut DISABLED → DISCARD on a single-sided sprite', async () => {
    const fake = createFakeResourceLoader();
    fake.textures.seed(SPRITE_TEXTURE, seededTexture());
    const renderer = await ReactThreeTestRenderer.create(treeFor(spriteScene('0'), fake.loader));
    const blended = materialAt(renderer.scene, 'Billboard');
    expect(blended.transparent).toBe(true);
    expect(blended.alphaTest).toBe(0);
    const compiledVersion = blended.version;

    await renderer.update(treeFor(spriteScene('1'), fake.loader));

    const scissored = materialAt(renderer.scene, 'Billboard');
    expect(scissored.transparent).toBe(false);
    expect(scissored.alphaTest).toBeGreaterThan(0);
    expect(scissored.side).toBe(THREE.FrontSide);
    expect(scissored !== blended || scissored.version > compiledVersion).toBe(true);
  });
});
