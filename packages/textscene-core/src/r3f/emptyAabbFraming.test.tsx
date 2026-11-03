/**
 * A GeometryInstance3D whose `get_aabb()` is empty adds a point at its node origin to the bounds
 * Godot frames on (`global_transform * AABB()`), so a scene with one beside a box frames on the
 * span between them. Each case sits at x = 8 beside a unit box at the origin, which Godot frames
 * on x = 3.75 (the box's -0.5 to the point's 8).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { frameSceneBounds } from './frameSceneBounds';
import { NodeTree } from './testing/NodeTree';
import '../nodes/base/node3d/index.r3f';
import '../nodes/3d/meshinstance3d/index.r3f';
import '../nodes/3d/multimeshinstance3d/index.r3f';
import '../nodes/3d/sprite3d/index.r3f';
import '../nodes/3d/animatedsprite3d/index.r3f';
import '../nodes/3d/label3d/index.r3f';
import '../nodes/3d/particles/cpuparticles3d/index.r3f';
import '../nodes/3d/particles/gpuparticles3d/index.r3f';

const sceneBeside = (type: string) => `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="Box"]

[node name="Root" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("Box")

[node name="Empty" type="${type}" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0)
`;

async function framedTarget(source: string): Promise<THREE.Vector3> {
  const scene = new TscnParser().parse(source);
  const root = scene.nodes[0]!;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <NodeTree node={root} path={root.name} />
    </SceneResourcesProvider>
  );
  const controls = { target: new THREE.Vector3(), update: () => {} };
  frameSceneBounds(renderer.scene.instance, new THREE.PerspectiveCamera(70, 1, 0.1, 4000), controls);
  return controls.target;
}

describe('a GeometryInstance3D with an empty AABB', () => {
  it.each([
    'CPUParticles3D',
    'GPUParticles3D',
    'MeshInstance3D',
    'MultiMeshInstance3D',
    'Sprite3D',
    'AnimatedSprite3D',
    'Label3D',
  ])('frames a %s as a point at its node origin', async (type) => {
    const target = await framedTarget(sceneBeside(type));

    expect(target.x).toBeCloseTo(3.75, 5);
  });
});
