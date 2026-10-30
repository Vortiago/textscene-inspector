/**
 * BoneConstraint3D registration: it is parsed with `active` and `influence`, and it joins the Skeleton3D pass as
 * the base of the bone constraint modifiers. The base itself makes no edit. It registers `transform-only` on the Node3D component, so children keep their
 * transform space.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { parseBoneConstraint3D } from './parser';
import './index';
import './index.r3f';

describe('BoneConstraint3D registration', () => {
  it('registers the parser that reads active and influence', () => {
    expect(nodeRegistry.getRegistration('BoneConstraint3D')!.parser).toBe(parseBoneConstraint3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('BoneConstraint3D')).toBe(Node3D);
  });

  it('draws nothing of its own, and acts through the Skeleton3D pass', () => {
    expect(nodeComponentRegistry.renderIntentOf('BoneConstraint3D')).toBe('transform-only');
    expect(nodeComponentRegistry.scenePassTypeNames().has('BoneConstraint3D')).toBe(true);
  });

  it('makes no pose edit', () => {
    const reader = nodeComponentRegistry.poseModifierOf('BoneConstraint3D')!;
    const node = { type: 'BoneConstraint3D', name: 'M', properties: {} };

    expect(reader(node as never, { skeletonGlobal: null as never, nodeGlobal: () => null })).toBeNull();
  });
});
