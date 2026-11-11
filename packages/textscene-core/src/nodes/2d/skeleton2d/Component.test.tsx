/**
 * A Skeleton2D runs its modification stack on the bones each render draws, and puts the pose an
 * AnimationPlayer or the file wrote back once the render ends (`skeleton_2d.cpp:769-815`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { DispatchedScene } from '../../../r3f/testing/DispatchedScene';
import { fireSceneRender, fireSceneRenderEnd } from '../../../r3f/testing/fireSceneRender';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { OUTLINE_POINT_COUNT } from '../bone2d/boneKite';
import '../../../r3f/nodes/index';

/** One bone along +x whose LookAt aims at a target straight below it, so the bone turns a quarter. */
function scene(stackLines = 'enabled = true', armLines = ''): string {
  return `[gd_scene format=3]
[sub_resource type="SkeletonModification2DLookAt" id="lookat"]
bone_index = 0
bone2d_node = NodePath("Arm")
target_nodepath = NodePath("../Target")
[sub_resource type="SkeletonModificationStack2D" id="stack"]
${stackLines}
modification_count = 1
modifications/0 = SubResource("lookat")
[node name="Root" type="Node2D"]
[node name="Skeleton" type="Skeleton2D" parent="."]
position = Vector2(50, 50)
modification_stack = SubResource("stack")
[node name="Arm" type="Bone2D" parent="Skeleton"]
rest = Transform2D(1, 0, 0, 1, 0, 0)
auto_calculate_length_and_angle = false
length = 100.0
${armLines}
[node name="Hand" type="Node2D" parent="Skeleton/Arm"]
position = Vector2(100, 0)
[node name="Strip" type="Polygon2D" parent="."]
position = Vector2(50, 50)
skeleton = NodePath("../Skeleton")
polygon = PackedVector2Array(0, 0, 100, 0, 100, 10)
bones = [NodePath("Arm"), PackedFloat32Array(1, 1, 1)]
[node name="Target" type="Node2D" parent="."]
position = Vector2(50, 300)
`;
}

/**
 * Four equal bones whose first CCDIK pass folds the last one onto its parent, as in
 * `unit-skeleton2d-ccdik-fold.tscn`: the chain then bends to the side the last bit of each bone
 * transform picks.
 */
const FOLDING_CHAIN = `[gd_scene format=3]
[sub_resource type="SkeletonModification2DCCDIK" id="chain"]
target_nodepath = NodePath("../Target")
tip_nodepath = NodePath("A/B/C/D/Tip")
ccdik_data_chain_length = 4
joint_data/0/bone_index = 0
joint_data/0/bone2d_node = NodePath("A")
joint_data/1/bone_index = 1
joint_data/1/bone2d_node = NodePath("A/B")
joint_data/2/bone_index = 2
joint_data/2/bone2d_node = NodePath("A/B/C")
joint_data/3/bone_index = 3
joint_data/3/bone2d_node = NodePath("A/B/C/D")
[sub_resource type="SkeletonModificationStack2D" id="stack"]
enabled = true
modification_count = 1
modifications/0 = SubResource("chain")
[node name="Root" type="Node2D"]
[node name="Skeleton" type="Skeleton2D" parent="."]
position = Vector2(432, 122)
modification_stack = SubResource("stack")
[node name="A" type="Bone2D" parent="Skeleton"]
rest = Transform2D(1, 0, 0, 1, 0, 0)
[node name="B" type="Bone2D" parent="Skeleton/A"]
position = Vector2(30, 0)
rotation = 0.3
rest = Transform2D(1, 0, 0, 1, 30, 0)
[node name="C" type="Bone2D" parent="Skeleton/A/B"]
position = Vector2(30, 0)
rest = Transform2D(1, 0, 0, 1, 30, 0)
[node name="D" type="Bone2D" parent="Skeleton/A/B/C"]
position = Vector2(30, 0)
rest = Transform2D(1, 0, 0, 1, 30, 0)
auto_calculate_length_and_angle = false
length = 30.0
[node name="Tip" type="Node2D" parent="Skeleton/A/B/C/D"]
position = Vector2(30, 0)
[node name="Target" type="Node2D" parent="."]
position = Vector2(473, 192)
`;

async function render(tscn: string) {
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(new TscnParser().parse(tscn))}
      loader={createFakeResourceLoader().loader}
      workspace="2d"
      showGizmos
    />,
    { orthographic: true, camera: { position: [0, 0, 10] } }
  );
  await settleLoads();
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

const CAMERA = new THREE.OrthographicCamera();

/** Runs what a WebGLRenderer render runs before it draws: the matrix update and the scene's hook. */
function startDraw(renderer: Rendered): void {
  const drawn = renderer.scene.instance as THREE.Scene;
  drawn.updateMatrixWorld();
  fireSceneRender(drawn, CAMERA);
}

function endDraw(renderer: Rendered): void {
  fireSceneRenderEnd(renderer.scene.instance as THREE.Scene, CAMERA);
}

function named(renderer: Rendered, name: string): THREE.Object3D {
  return renderer.scene.find((node) => node.instance.name === name).instance;
}

/** Where the drawn object sits on the canvas, in Godot's +Y-down pixels. */
function canvasPosition(object: THREE.Object3D): { x: number; y: number } {
  const position = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
  return { x: position.x, y: -position.y };
}

function stripVertex(renderer: Rendered, index: number): { x: number; y: number } {
  let mesh: THREE.Mesh | null = null;
  named(renderer, 'Strip').traverse((object) => {
    if (!mesh && (object as THREE.Mesh).isMesh) mesh = object as THREE.Mesh;
  });
  const position = (mesh! as THREE.Mesh).geometry.getAttribute('position');
  return { x: position.getX(index), y: -position.getY(index) };
}

/** The red of the first fill point of the kite of the bone `name`, which tells the IK colour from white. */
function kiteFillRed(renderer: Rendered, name: string): number {
  const kite = named(renderer, name)
    .children.flatMap((child) => child.children)
    .find((object): object is THREE.Mesh => (object as THREE.Mesh).isMesh)!;
  return kite.geometry.getAttribute('color').getX(OUTLINE_POINT_COUNT);
}

/** `bone_ik_color` (`editor_settings.cpp:978`) is 0.9 red, which is 0.787 linear. The plain fill is white. */
const IK_RED = 0.78741;

describe('Skeleton2D', () => {
  it('draws a child of a bone where the stack moves the bone', async () => {
    const renderer = await render(scene());
    startDraw(renderer);
    const hand = canvasPosition(named(renderer, 'Hand'));
    expect(hand.x).toBeCloseTo(50, 3);
    expect(hand.y).toBeCloseTo(150, 3);
  });

  it('skins a Polygon2D with the pose the stack solved', async () => {
    const renderer = await render(scene());
    startDraw(renderer);
    const vertex = stripVertex(renderer, 1);
    expect(vertex.x).toBeCloseTo(0, 3);
    expect(vertex.y).toBeCloseTo(100, 3);
  });

  it('puts the pose of the file back on the bone once the render ends', async () => {
    const renderer = await render(scene());
    const arm = named(renderer, 'Arm');
    startDraw(renderer);
    endDraw(renderer);
    expect(arm.matrixAutoUpdate).toBe(true);
    expect(arm.matrix.elements[0]).toBeCloseTo(1, 6);
    expect(arm.rotation.z).toBe(0);
  });

  it('puts the pose of the file back after a render that threw before it ended', async () => {
    const renderer = await render(scene());
    const arm = named(renderer, 'Arm');
    startDraw(renderer);
    startDraw(renderer);
    endDraw(renderer);
    expect(arm.matrixAutoUpdate).toBe(true);
    expect(arm.matrix.elements[0]).toBeCloseTo(1, 6);
  });

  it('skins a Polygon2D with the pose of the file once the target of the stack is gone', async () => {
    const renderer = await render(scene());
    startDraw(renderer);
    stripVertex(renderer, 1);
    endDraw(renderer);
    named(renderer, 'Target').removeFromParent();
    startDraw(renderer);
    const vertex = stripVertex(renderer, 1);
    expect(vertex.x).toBeCloseTo(100, 3);
    expect(vertex.y).toBeCloseTo(0, 3);
  });

  // The second buffer of a 2D light and a span of a canvas group draw the scene with its matrices kept.
  it('draws the same pose in a render that updates no matrix of the scene', async () => {
    const renderer = await render(scene('enabled = true\nstrength = 0.5'));
    startDraw(renderer);
    const first = canvasPosition(named(renderer, 'Hand'));
    endDraw(renderer);
    fireSceneRender(renderer.scene.instance as THREE.Scene, CAMERA);
    const second = canvasPosition(named(renderer, 'Hand'));
    expect(second.x).toBeCloseTo(first.x, 3);
    expect(second.y).toBeCloseTo(first.y, 3);
  });

  it('solves again for a target that moved since the last render', async () => {
    const renderer = await render(scene());
    startDraw(renderer);
    endDraw(renderer);
    // What a 2D position track writes: the y negated on the conjugated group.
    named(renderer, 'Target').position.set(-200, -50, 0);
    startDraw(renderer);
    const hand = canvasPosition(named(renderer, 'Hand'));
    expect(hand.x).toBeCloseTo(-50, 3);
    expect(hand.y).toBeCloseTo(50, 3);
  });

  it('starts each solve from the pose an animation wrote on the bone', async () => {
    const renderer = await render(scene('enabled = true\nstrength = 0.5'));
    // A rotation track writes the negated angle: the bone points up, and the stack pulls it half
    // way to the target below, through the short way round.
    named(renderer, 'Arm').rotation.z = Math.PI / 2;
    startDraw(renderer);
    const hand = canvasPosition(named(renderer, 'Hand'));
    expect(hand.y).toBeCloseTo(50, 2);
    expect(Math.abs(hand.x - 50)).toBeCloseTo(100, 2);
  });

  // Godot 4.6.3 leaves D at (481.78064, 163.313812). The other side of the bend puts it elsewhere.
  it('bends a chain that folds onto one line to the side Godot bends it', async () => {
    const renderer = await render(FOLDING_CHAIN);
    startDraw(renderer);
    const last = canvasPosition(named(renderer, 'D'));
    expect(last.x).toBeCloseTo(481.7806, 2);
    expect(last.y).toBeCloseTo(163.3138, 2);
  });

  it('draws the kite of a bone a modification holds in the IK colour', async () => {
    const renderer = await render(scene());
    startDraw(renderer);
    expect(kiteFillRed(renderer, 'Arm')).toBeCloseTo(IK_RED, 4);
  });

  // The skeleton removes the meta from each bone its stack does not hold (`skeleton_2d.cpp:798-803`).
  it('draws the kite of a bone no modification holds in the plain colour, whatever meta the file stores', async () => {
    const stored = 'metadata/_local_pose_override_enabled_ = true';
    const renderer = await render(scene('enabled = false', stored));
    startDraw(renderer);
    expect(kiteFillRed(renderer, 'Arm')).toBe(1);
  });

  it('leaves the bones alone for a disabled stack', async () => {
    const renderer = await render(scene('enabled = false'));
    startDraw(renderer);
    const hand = canvasPosition(named(renderer, 'Hand'));
    expect(hand.x).toBeCloseTo(150, 3);
    expect(hand.y).toBeCloseTo(50, 3);
  });
});
