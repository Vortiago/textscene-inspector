/**
 * SkeletonModifier3D registration: it is parsed with `active` and `influence`, and it joins the Skeleton3D pass as
 * the base of every node that rewrites a Skeleton3D's bone poses. The base itself makes no edit. It registers `transform-only` on the Node3D component, so children keep their
 * transform space.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { parseSkeletonModifier3D } from './parser';
import './index';
import './index.r3f';

describe('SkeletonModifier3D registration', () => {
  it('registers the parser that reads active and influence', () => {
    expect(nodeRegistry.getRegistration('SkeletonModifier3D')!.parser).toBe(parseSkeletonModifier3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('SkeletonModifier3D')).toBe(Node3D);
  });

  it('draws nothing of its own, and acts through the Skeleton3D pass', () => {
    expect(nodeComponentRegistry.renderIntentOf('SkeletonModifier3D')).toBe('transform-only');
    expect(nodeComponentRegistry.scenePassTypeNames().has('SkeletonModifier3D')).toBe(true);
  });

  it('makes no pose edit', () => {
    const reader = nodeComponentRegistry.poseModifierOf('SkeletonModifier3D')!;
    const node = { type: 'SkeletonModifier3D', name: 'M', properties: {} };

    expect(reader(node as never, { skeletonGlobal: null as never, nodeGlobal: () => null })).toBeNull();
  });
});
