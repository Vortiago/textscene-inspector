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
import { Object3D } from 'three';
import { AnimationPlayer, resolveTrackTarget } from './Component';
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
    libraries: [],
    ...overrides,
  };
  return {
    name: props.name ?? 'AnimationPlayer',
    type: 'AnimationPlayer',
    children: [],
    properties: props,
  };
}

describe('resolveTrackTarget — root-targeting (NodePath ".")', () => {
  it('maps a "." targetPath to the root itself (not a child lookup)', () => {
    const root = new Object3D();
    root.name = 'Root';
    expect(resolveTrackTarget(root, '.')).toBe(root);
  });

  it('resolves a named targetPath to the matching descendant', () => {
    const root = new Object3D();
    const child = new Object3D();
    child.name = 'Mesh';
    root.add(child);
    expect(resolveTrackTarget(root, 'Mesh')).toBe(child);
  });

  it('returns undefined for a missing target', () => {
    expect(resolveTrackTarget(new Object3D(), 'Ghost')).toBeUndefined();
  });

  // These pin resolveTrackTarget to the SAME object THREE.PropertyBinding drives.
  // Anything it fails to resolve silently loses the YXZ Euler reorder and the
  // base-transform snapshot, so a mismatch is invisible until a rotation composes
  // wrongly or a target is left displaced after stop.
  it('resolves a multi-level descending path, which THREE binds by final name', () => {
    const root = new Object3D();
    const child = new Object3D();
    child.name = 'Child';
    const target = new Object3D();
    target.name = 'Target';
    root.add(child);
    child.add(target);
    expect(resolveTrackTarget(root, 'Child/Target')).toBe(target);
  });

  it('returns undefined for a path that resolves above the root, which the mixer also drops', () => {
    const root = new Object3D();
    const sibling = new Object3D();
    sibling.name = 'Sibling';
    root.add(sibling);
    // Named `Sibling` and present, but the path leaves the root — agreeing with
    // buildClip is what matters, or the snapshot covers what the mixer does not.
    expect(resolveTrackTarget(root, '../Sibling')).toBeUndefined();
    expect(resolveTrackTarget(root, '..')).toBeUndefined();
  });

  it('maps an empty targetPath to the root, matching the colon-only NodePath form', () => {
    const root = new Object3D();
    expect(resolveTrackTarget(root, '')).toBe(root);
  });

  it('resolves a path that cancels back to the root', () => {
    const root = new Object3D();
    const child = new Object3D();
    child.name = 'Sprite';
    root.add(child);
    expect(resolveTrackTarget(root, 'Sprite/..')).toBe(root);
  });
});

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
