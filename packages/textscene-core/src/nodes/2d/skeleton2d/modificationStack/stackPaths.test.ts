import { describe, expect, it } from 'vitest';
import type { ModificationStack2D } from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { stackNodePaths } from './stackPaths';
import { NO_CONSTRAINT } from './stackScenes.testkit';

const BASE = { enabled: true, executionMode: 0 };

describe('stackNodePaths', () => {
  it('lists each path the modifications read once, with those of a held stack', () => {
    const held: ModificationStack2D = {
      enabled: true,
      strength: 1,
      modifications: [
        {
          ...BASE,
          type: 'SkeletonModification2DFABRIK',
          target: 'T',
          joints: [
            { bone: { index: 0, node: 'A' }, magnetPosition: { x: 0, y: 0 }, useTargetRotation: false },
          ],
        },
      ],
    };
    const stack: ModificationStack2D = {
      enabled: true,
      strength: 1,
      modifications: [
        null,
        {
          ...BASE,
          type: 'SkeletonModification2DLookAt',
          bone: { index: 0, node: 'A' },
          target: 'T',
          additionalRotation: 0,
          constraint: NO_CONSTRAINT,
        },
        {
          ...BASE,
          type: 'SkeletonModification2DCCDIK',
          target: undefined,
          tip: 'Tip',
          joints: [{ bone: { index: 0, node: 'Unread' }, rotateFromJoint: false, constraint: NO_CONSTRAINT }],
        },
        { ...BASE, type: 'SkeletonModification2DStackHolder', heldStack: held },
      ],
    };
    expect(stackNodePaths(stack)).toEqual(['T', 'A', 'Tip']);
  });
});
