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
  useAnimatedValueRegistry,
  type AnimatedValueRegistry,
} from '../../contexts/AnimatedValueContext';
import { visibleInTree } from '../../visibleInTree';
import { createGLBMesh } from '../../../resources/formats/glb/glbProcessing';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { RIG_GLB } from '../../../resources/formats/glb/testing/rigGlb';
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

async function renderRig(children: TscnNode[] = []) {
  const fake = createFakeResourceLoader();
  seedGlbInstance(fake, GLB_PATH, await createGLBMesh(RIG_GLB, NO_SIDECAR));
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
    await ReactThreeTestRenderer.act(async () => registry.set(path, 'visible', value));
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
});
