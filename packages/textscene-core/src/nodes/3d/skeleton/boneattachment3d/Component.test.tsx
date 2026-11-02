/**
 * <BoneAttachment3D>: the group applies the seat the pass composed, and a clip that plays to the
 * skeleton moves it through the bone-pose push store, in place. A node that binds no bone keeps the
 * transform the file wrote, so do the children while it is bound.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTscnContent } from '../../../../r3f/hooks/useParsedScene';
import type { SceneGraph } from '../../../../core/SceneGraph';
import { DispatchedScene } from '../../../../r3f/testing/DispatchedScene';
import { settleLoads } from '../../../../r3f/testing/settleLoads';
import { objectAt, sceneRoot } from '../../../../r3f/testing/animationPlayback';
import { loaderServing } from '../../../../resources/testing/servingResourceLoader';
import {
  AnimatedBonePosesProvider,
  useAnimatedBonePoses,
} from '../../../../r3f/contexts/AnimatedBonePosesContext';
import type { PushStore } from '../../../../r3f/contexts/pushStore';
import type { AnimatedPose, BonePose } from '../../skeleton3d/skeletonPose';
import type { Vector3 } from '../../../../godot/math/vector';
import type { Quaternion } from '../../../../godot/math/quaternion';
import '../../../../r3f/nodes/index';
import './index';

/**
 * The two bones the scene poses: b0 at the pose (0, 1.5, 0) and b1, whose pose turns 90 degrees
 * about Z away from a translation-only rest, the same numbers the seat pass tests hold.
 */
const BONES = `bones/0/name = "b0"
bones/0/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
bones/0/position = Vector3(0, 1.5, 0)
bones/1/name = "b1"
bones/1/parent = 0
bones/1/rest = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.5, 1, 0)
bones/1/position = Vector3(0.5, 1, 0)
bones/1/rotation = Quaternion(0, 0, 0.7071068, 0.7071068)
`;

/** A box under `attachmentProperties` on the bone, to read the seat off the scene it rides. */
function seatScene(attachmentProperties: string, childName = 'Lodged'): string {
  return `[gd_scene format=3]
[sub_resource type="BoxMesh" id="Box"]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 2, 3)
${BONES}[node name="Seat" type="BoneAttachment3D" parent="Skeleton3D"]
${attachmentProperties}[node name="${childName}" type="MeshInstance3D" parent="Skeleton3D/Seat"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0.1)
mesh = SubResource("Box")
`;
}

let bonePoses: PushStore<AnimatedPose> | null = null;

function Capture(): null {
  bonePoses = useAnimatedBonePoses();
  return null;
}

function parsed(content: string): SceneGraph {
  const { sceneGraph, error } = parseTscnContent(content, 'res://main.tscn');
  if (!sceneGraph) throw new Error(`expected a scene, got ${error}`);
  return sceneGraph;
}

async function renderScene(content: string) {
  const renderer = await ReactThreeTestRenderer.create(
    <AnimatedBonePosesProvider>
      <Capture />
      <DispatchedScene sceneGraph={parsed(content)} loader={loaderServing()} />
    </AnimatedBonePosesProvider>
  );
  await settleLoads();
  return renderer;
}

/** The seat group's THREE object, and the mesh the child under it draws. */
function seatObjects(renderer: Awaited<ReturnType<typeof renderScene>>, childName: string) {
  const root = sceneRoot(renderer);
  return { root, seat: objectAt(root, 'Seat') as THREE.Group, child: objectAt(root, childName) };
}

/** The pose a clip writes on the bone `name`, with one track for each part given. */
function posing(
  name: string,
  parts: { position?: Vector3; rotation?: Quaternion; scale?: Vector3 }
): AnimatedPose {
  const pose: BonePose = {
    ...(parts.position && { position: [parts.position] }),
    ...(parts.rotation && { rotation: [parts.rotation] }),
    ...(parts.scale && { scale: [parts.scale] }),
  };
  return new Map([[name, pose]]);
}

describe('<BoneAttachment3D>', () => {
  it('applies the seat local the pass composed, in the space of its parent', async () => {
    const renderer = await renderScene(seatScene('bone_idx = 1\n'));
    const { root, seat } = seatObjects(renderer, 'Lodged');

    root.updateMatrixWorld(true);
    expect(seat.position.x).toBeCloseTo(0.5, 5);
    expect(seat.position.y).toBeCloseTo(2.5, 5);
    expect(seat.rotation.z).toBeCloseTo(Math.PI / 2, 5);
  });

  it('carries its children with the seat', async () => {
    const renderer = await renderScene(seatScene('bone_idx = 1\n'));
    const { root, seat, child } = seatObjects(renderer, 'Lodged');

    root.updateMatrixWorld(true);
    // The child rides at (0, 0, 0.1) under the seat, which sits at (1.5, 4.5, 3) in the world.
    expect(seat.matrixWorld.elements[12]).toBeCloseTo(1.5, 5);
    expect(seat.matrixWorld.elements[13]).toBeCloseTo(4.5, 5);
    expect(seat.matrixWorld.elements[14]).toBeCloseTo(3, 5);
    expect(child.matrixWorld.elements[12]).toBeCloseTo(1.5, 5);
    expect(child.matrixWorld.elements[13]).toBeCloseTo(4.5, 5);
    expect(child.matrixWorld.elements[14]).toBeCloseTo(3.1, 5);
  });

  it('keeps the authored transform of a node that binds no bone', async () => {
    const renderer = await renderScene(
      seatScene('bone_name = "ghost"\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 7, 0)\n')
    );
    const { root, seat } = seatObjects(renderer, 'Lodged');

    root.updateMatrixWorld(true);
    expect(seat.position.x).toBeCloseTo(2, 5);
    expect(seat.position.y).toBeCloseTo(7, 5);
    expect(seat.position.z).toBeCloseTo(0, 5);
  });

  it('keeps the authored transform while override_pose is on', async () => {
    const renderer = await renderScene(
      seatScene(
        'bone_idx = 1\noverride_pose = true\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 7, 0)\n'
      )
    );
    const { root, seat } = seatObjects(renderer, 'Lodged');

    root.updateMatrixWorld(true);
    expect(seat.position.x).toBeCloseTo(2, 5);
    expect(seat.position.y).toBeCloseTo(7, 5);
  });

  it('moves with the clip a player pushes on the skeleton, and rests when it releases', async () => {
    const renderer = await renderScene(seatScene('bone_idx = 1\n'));
    const { seat } = seatObjects(renderer, 'Lodged');
    const pose = posing('b0', { position: { x: 0, y: 2.5, z: 0 } });

    await ReactThreeTestRenderer.act(async () => bonePoses!.set('Root/Skeleton3D', pose));

    // b0's animated pose is (0, 2.5, 0), so b1 composes (0.5, 3.5, 0) under it.
    expect(seat.position.x).toBeCloseTo(0.5, 5);
    expect(seat.position.y).toBeCloseTo(3.5, 5);

    await ReactThreeTestRenderer.act(async () => bonePoses!.set('Root/Skeleton3D', null));

    expect(seat.position.x).toBeCloseTo(0.5, 5);
    expect(seat.position.y).toBeCloseTo(2.5, 5);
  });
});
