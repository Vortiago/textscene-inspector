/**
 * CopyTransformModifier3D registration: it is parsed with its settings, and it joins the Skeleton3D
 * pass with the pose edit of its settings. It registers `transform-only` on the Node3D component, so
 * children keep their transform space.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import { parseCopyTransformModifier3D } from './parser';
import './index';
import './index.r3f';

describe('CopyTransformModifier3D registration', () => {
  it('registers the parser that reads the settings', () => {
    expect(nodeRegistry.getRegistration('CopyTransformModifier3D')!.parser).toBe(
      parseCopyTransformModifier3D
    );
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('CopyTransformModifier3D')).toBe(Node3D);
  });

  it('draws nothing of its own, and acts through the Skeleton3D pass', () => {
    expect(nodeComponentRegistry.renderIntentOf('CopyTransformModifier3D')).toBe('transform-only');
    expect(nodeComponentRegistry.scenePassTypeNames().has('CopyTransformModifier3D')).toBe(true);
  });

  it('reads a node into the edit of its settings, at its influence', () => {
    const node = {
      type: 'CopyTransformModifier3D',
      properties: { active: true, influence: 0.5, settings: [] },
    };
    const world = { skeletonGlobal: null as never, nodeGlobal: () => null };

    const edit = nodeComponentRegistry.poseModifierOf('CopyTransformModifier3D')!(node as never, world);

    expect(edit!.influence).toBe(0.5);
  });

  it('reads an inactive node into no edit', () => {
    const node = {
      type: 'CopyTransformModifier3D',
      properties: { active: false, influence: 1, settings: [] },
    };
    const world = { skeletonGlobal: null as never, nodeGlobal: () => null };

    expect(nodeComponentRegistry.poseModifierOf('CopyTransformModifier3D')!(node as never, world)).toBeNull();
  });
});
