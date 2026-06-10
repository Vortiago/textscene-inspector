/**
 * AnimationPlayer R3F component tests.
 *
 * AnimationPlayer has no viewport representation — it is purely a
 * container for clip data. Tests assert that the component mounts a
 * group with the correct userData and transform, passes children through,
 * and renders without crashing under default and edge-case props.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AnimationPlayer } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { AnimationPlayerProperties } from './types';
import { AnimationProcessMode, MethodCallMode } from './types';

function makeNode(overrides: Partial<AnimationPlayerProperties> = {}): TscnNode {
  const props: AnimationPlayerProperties = {
    name: overrides.name ?? 'AnimationPlayer',
    speed_scale: 1.0,
    playback_default_blend_time: 0.0,
    playback_process_mode: AnimationProcessMode.IDLE,
    method_call_mode: MethodCallMode.DEFERRED,
    playback_active: true,
    autoplay: '',
    current_animation: '',
    current_animation_length: 0.0,
    current_animation_position: 0.0,
    root_node: 'NodePath("..")',
    clips: [],
    ...overrides,
  };
  return {
    name: props.name ?? 'AnimationPlayer',
    type: 'AnimationPlayer',
    children: [],
    properties: props,
  };
}

describe('<AnimationPlayer>', () => {
  it('renders without crashing with default props', async () => {
    await expect(
      ReactThreeTestRenderer.create(<AnimationPlayer node={makeNode()} />)
    ).resolves.toBeDefined();
  });

  it('mounts a group tagged with nodeType AnimationPlayer', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AnimationPlayer node={makeNode({ name: 'Anim' })} />
    );
    const group = renderer.scene.findByProps({ name: 'Anim' });
    const userData = group.instance.userData as { nodeType: string };
    expect(userData.nodeType).toBe('AnimationPlayer');
  });

  it('positions the group at transform.origin when transform is set', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AnimationPlayer
        node={makeNode({
          name: 'Translated',
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: 2, y: 3, z: 4 },
          },
        })}
      />
    );
    const group = renderer.scene.findByProps({ name: 'Translated' });
    expect(group.instance.position.x).toBe(2);
    expect(group.instance.position.y).toBe(3);
    expect(group.instance.position.z).toBe(4);
  });

  it('passes children through into the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AnimationPlayer node={makeNode({ name: 'Parent' })}>
        <mesh name="child-node">
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial />
        </mesh>
      </AnimationPlayer>
    );
    expect(renderer.scene.findByProps({ name: 'child-node' })).toBeDefined();
  });

  it('renders no visible meshes of its own (is a pure container)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <AnimationPlayer node={makeNode()} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(0);
  });
});
