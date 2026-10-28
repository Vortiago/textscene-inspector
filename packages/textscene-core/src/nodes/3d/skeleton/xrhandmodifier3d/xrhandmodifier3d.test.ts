/**
 * XRHandModifier3D registration: it is parsed with `active` and `influence`, and it joins the Skeleton3D pass as
 * a modifier that writes tracked hand poses. Without an XR tracker it makes no edit. It registers `transform-only` on the Node3D component, so children keep their
 * transform space.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { parseSkeletonModifier3D } from '../skeletonmodifier3d/parser';
import './index';
import './index.r3f';

describe('XRHandModifier3D registration', () => {
  it('registers the parser that reads active and influence', () => {
    expect(nodeRegistry.getRegistration('XRHandModifier3D')!.parser).toBe(parseSkeletonModifier3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('XRHandModifier3D')).toBe(Node3D);
  });

  it('draws nothing of its own, and acts through the Skeleton3D pass', () => {
    expect(nodeComponentRegistry.renderIntentOf('XRHandModifier3D')).toBe('transform-only');
    expect(nodeComponentRegistry.scenePassTypeNames().has('XRHandModifier3D')).toBe(true);
  });

  it('makes no pose edit', () => {
    const reader = nodeComponentRegistry.poseModifierOf('XRHandModifier3D')!;
    const node = { type: 'XRHandModifier3D', name: 'M', properties: {} };

    expect(reader(node as never, { skeletonGlobal: null as never, nodeGlobal: () => null })).toBeNull();
  });
});
