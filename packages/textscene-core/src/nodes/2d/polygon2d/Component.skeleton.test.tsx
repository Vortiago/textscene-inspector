/**
 * A Polygon2D bound to a Skeleton2D draws each vertex where its bones move it
 * (`skeleton.glsl:157-182`), off the bone transforms each render draws, so a bone an
 * AnimationPlayer moves moves the skin with it.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { DispatchedScene } from '../../../r3f/testing/DispatchedScene';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import '../../../r3f/nodes/index';

/** A strip along +x whose one bone turns a quarter, so Godot's (100, 0) draws at (0, 100). */
function scene(polygonLines = ''): string {
  return `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Skeleton" type="Skeleton2D" parent="."]
position = Vector2(50, 50)
[node name="Arm" type="Bone2D" parent="Skeleton"]
rotation = 1.5707964
rest = Transform2D(1, 0, 0, 1, 0, 0)
[node name="Strip" type="Polygon2D" parent="."]
position = Vector2(50, 50)
skeleton = NodePath("../Skeleton")
polygon = PackedVector2Array(0, 0, 100, 0, 100, 10)
bones = [NodePath("Arm"), PackedFloat32Array(1, 1, 1)]
${polygonLines}
`;
}

async function render(tscn: string) {
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(new TscnParser().parse(tscn))}
      loader={createFakeResourceLoader().loader}
      workspace="2d"
    />,
    { orthographic: true, camera: { position: [0, 0, 10] } }
  );
  await settleLoads();
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

/** Runs what a WebGLRenderer render runs before it draws: the matrix update and the scene's hook. */
function drawOnce(renderer: Rendered): void {
  const scene = renderer.scene.instance as THREE.Scene;
  scene.updateMatrixWorld();
  const camera = new THREE.OrthographicCamera();
  (scene.onBeforeRender as (...args: unknown[]) => void).call(scene, null, scene, camera, null);
}

function stripVertex(renderer: Rendered, index: number): { x: number; y: number } {
  const strip = renderer.scene.find((node) => node.instance.name === 'Strip').instance;
  let mesh: THREE.Mesh | null = null;
  strip.traverse((object) => {
    if (!mesh && (object as THREE.Mesh).isMesh) mesh = object as THREE.Mesh;
  });
  const position = (mesh! as THREE.Mesh).geometry.getAttribute('position');
  // Back to Godot's +Y-down pixels.
  return { x: position.getX(index), y: -position.getY(index) };
}

describe('Polygon2D bound to a Skeleton2D', () => {
  it('draws each vertex where its bone moves it', async () => {
    const renderer = await render(scene());
    drawOnce(renderer);
    const vertex = stripVertex(renderer, 1);
    expect(vertex.x).toBeCloseTo(0, 3);
    expect(vertex.y).toBeCloseTo(100, 3);
  });

  it('follows a bone that moves after the first draw', async () => {
    const renderer = await render(scene());
    drawOnce(renderer);
    const arm = renderer.scene.find((node) => node.instance.name === 'Arm').instance;
    // What a 2D rotation track writes: the negated angle on the conjugated group (`clipBuilder.ts`).
    arm.rotation.z = 0;
    drawOnce(renderer);
    const vertex = stripVertex(renderer, 1);
    expect(vertex.x).toBeCloseTo(100, 3);
    expect(vertex.y).toBeCloseTo(0, 3);
  });

  it('draws undeformed with invert_enabled on', async () => {
    const renderer = await render(scene('invert_enabled = true'));
    drawOnce(renderer);
    expect(stripVertex(renderer, 1)).toEqual({ x: 100, y: 0 });
  });
});
