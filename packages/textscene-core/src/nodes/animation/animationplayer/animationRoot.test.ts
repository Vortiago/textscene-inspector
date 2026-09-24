/**
 * animationRoot tests: resolving the mixer root (D1) and the standing
 * feasibility guard for ADR-0011's name-path binding through the
 * dispatcher's unnamed pickable wrappers (D2).
 */

import { describe, it, expect } from 'vitest';
import {
  AnimationClip,
  AnimationMixer,
  Object3D,
  VectorKeyframeTrack,
} from 'three';
import { resolveAnimationRoot } from './animationRoot';

/**
 * Mirror the dispatcher's nesting: a named node group wraps an UNNAMED
 * pickable wrapper that wraps the child's named component group.
 */
function namedNode(name: string, child?: Object3D): Object3D {
  const group = new Object3D();
  group.name = name;
  if (child) {
    const wrapper = new Object3D(); // unnamed pickable wrapper
    wrapper.add(child);
    group.add(wrapper);
  }
  return group;
}

describe('resolveAnimationRoot (D1)', () => {
  it('resolves root_node ".." to the parent node group, skipping the unnamed wrapper', () => {
    const player = new Object3D();
    player.name = 'AnimationPlayer';
    const character = namedNode('Character', player);

    expect(resolveAnimationRoot(player, 'NodePath("..")')).toBe(character);
  });

  it('resolves root_node "." to the player\'s own object', () => {
    const player = new Object3D();
    player.name = 'AnimationPlayer';
    namedNode('Character', player);

    expect(resolveAnimationRoot(player, 'NodePath(".")')).toBe(player);
  });

  it('returns null when no named ancestor exists for ".."', () => {
    const orphan = new Object3D();
    orphan.name = 'AnimationPlayer';
    expect(resolveAnimationRoot(orphan, 'NodePath("..")')).toBeNull();
  });
});

describe('PropertyBinding feasibility guard (D2)', () => {
  it('binds a single-level track name to a named object through an unnamed wrapper', () => {
    // root("Character") > wrapper(unnamed) > mesh("Mesh")
    const mesh = new Object3D();
    mesh.name = 'Mesh';
    const root = namedNode('Character', mesh);

    const clip = new AnimationClip('a', 1, [
      new VectorKeyframeTrack('Mesh.position', [0, 1], [0, 0, 0, 5, 0, 0]),
    ]);
    const mixer = new AnimationMixer(root);
    mixer.clipAction(clip).play();
    mixer.update(0.5); // sample mid-clip (avoid the loop-wrap at t=duration)

    expect(mesh.position.x).toBeCloseTo(2.5);
  });
});
