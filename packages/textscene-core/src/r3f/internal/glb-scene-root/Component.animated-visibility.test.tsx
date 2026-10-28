/**
 * An AnimationPlayer `visible` value track on a node of an instanced GLB: the player pushes each
 * sampled value through the AnimatedValue registry under the node's Godot path, and `null` hands the
 * node back to its authored visibility.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parsedNode } from '../../../parser/testing/parserKit';
import { NodeDispatcher } from '../../NodeDispatcher';
import { SceneStack } from '../../testing/SceneStack';
import {
  AnimatedValueProvider,
  animatedValueKey,
  useAnimatedValueRegistry,
  type AnimatedValueRegistry,
} from '../../contexts/AnimatedValueContext';
import { visibleInTree } from '../../visibleInTree';
import { createGLBMesh } from '../../../resources/formats/glb/glbProcessing';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { RIG_GLB } from '../../../resources/formats/glb/testing/rigGlb';
import { skinnedRigGlb } from '../../../resources/formats/glb/testing/skinnedRigGlb';
import { godotNodePaths } from '../../../resources/formats/glb/godotNodes';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../../../resources/testing/seedGlbInstance';
import { settleLoads } from '../../testing/settleLoads';

import '../../nodes/index';
import '../../../nodes/node/index';
import '../../../nodes/base/node3d/index';

const GLB_PATH = 'res://rig.glb';

let registry: AnimatedValueRegistry;
function RegistryProbe() {
  registry = useAnimatedValueRegistry();
  return null;
}

/** A type-less override of a node of the GLB, as `[node name="Sword" parent="Rig/Armature/Skeleton3D/Hip"]` writes it. */
const override = (name: string, instanceSubPath: string, raw: Record<string, string>): TscnNode => ({
  ...parsedNode({ name, type: 'Node3D' }, raw),
  type: '',
  instanceSubPath,
  overridesExistingNode: true,
});

async function renderRig(children: TscnNode[] = [], glb: ArrayBuffer = RIG_GLB) {
  const fake = createFakeResourceLoader();
  seedGlbInstance(fake, GLB_PATH, await createGLBMesh(glb, NO_SIDECAR));
  const instance: TscnNode = {
    ...parsedNode({ name: 'Rig', type: 'Node', instance: 'ExtResource("rig")' }),
    children,
  };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack
      loader={fake.loader}
      scene={{ externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }] }}
    >
      <AnimatedValueProvider>
        <RegistryProbe />
        <NodeDispatcher nodes={[instance]} />
      </AnimatedValueProvider>
    </SceneStack>
  );
  await settleLoads();
  const named = (name: string): THREE.Object3D => renderer.scene.instance.getObjectByName(name)!;
  /** Pushes `value` as the player does, and lets the render it causes settle. */
  const push = async (path: string, value: number[] | null) => {
    await ReactThreeTestRenderer.act(async () => registry.set(animatedValueKey(path, 'visible'), value));
  };
  return { named, push };
}

describe('GLBSceneRoot — a pushed visible value', () => {
  it('hides the node at its Godot path, and shows it again when released', async () => {
    const { named, push } = await renderRig();

    await push('Rig/Armature/Skeleton3D/Hip/Sword', [0]);
    expect(visibleInTree(named('Sword'))).toBe(false);

    await push('Rig/Armature/Skeleton3D/Hip/Sword', null);
    expect(visibleInTree(named('Sword'))).toBe(true);
  });

  it('shows a node the instancing scene hides, since the track writes the property the override wrote', async () => {
    const { named, push } = await renderRig([
      override('Sword', 'Armature/Skeleton3D/Hip', { visible: 'false' }),
    ]);
    expect(visibleInTree(named('Sword'))).toBe(false);

    await push('Rig/Armature/Skeleton3D/Hip/Sword', [1]);

    expect(visibleInTree(named('Sword'))).toBe(true);
  });

  it('hides everything below a Skeleton3D when the track is on the Skeleton3D', async () => {
    const { named, push } = await renderRig();

    await push('Rig/Armature/Skeleton3D', [0]);

    expect([visibleInTree(named('Sword')), visibleInTree(named('Body'))]).toEqual([false, false]);
  });

  it('leaves a node that is not on the path drawn', async () => {
    const { named, push } = await renderRig();

    await push('Rig/Armature/Skeleton3D/Hip/Sword', [0]);

    expect(visibleInTree(named('Body'))).toBe(true);
  });

  it('keeps a node an override hides below a Skeleton3D hidden when the track shows the Skeleton3D', async () => {
    const { named, push } = await renderRig([
      override('Sword', 'Armature/Skeleton3D/Hip', { visible: 'false' }),
    ]);

    await push('Rig/Armature/Skeleton3D', [1]);

    expect(visibleInTree(named('Sword'))).toBe(false);
  });

  it('keeps a node its own track hides below a Skeleton3D hidden when the Skeleton3D track is released', async () => {
    const { named, push } = await renderRig();
    await push('Rig/Armature/Skeleton3D/Hip/Sword', [0]);

    await push('Rig/Armature/Skeleton3D', [0]);
    await push('Rig/Armature/Skeleton3D', null);

    expect(visibleInTree(named('Sword'))).toBe(false);
  });

  it('hides a skinned mesh that holds a child at each Godot path the mesh stands for', async () => {
    const { named, push } = await renderRig([], skinnedRigGlb([0, 0, 0], { bodyChild: true }));
    const paths = godotNodePaths(named('Body')).map((path) => `Rig/${path}`);

    for (const path of paths) {
      await push(path, [0]);
      expect([path, named('Body').visible]).toEqual([path, false]);
      await push(path, null);
    }
    expect(paths).toHaveLength(2);
  });
});
