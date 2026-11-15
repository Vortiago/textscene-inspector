/**
 * The RemoteTransform pass asks for the bones the Skeleton2D stacks solve only when a 2D relay reads
 * a pose, so a tree with no relay solves no stack.
 */

import { describe, expect, it, vi } from 'vitest';
import { liveTreeOfText, runPass } from './liveSceneTree.testkit';
import { liveNodePatches } from './liveNodePatches';
import * as solvedBones from '../nodes/2d/skeleton2d/solvedBones.js';
import '../nodes/2d/skeleton2d/index';
import '../nodes/2d/bone2d/index';

vi.mock('../nodes/2d/skeleton2d/solvedBones.js', { spy: true });

const RIG_WITH_NO_RELAY = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Skeleton" type="Skeleton2D" parent="."]

[node name="Bone" type="Bone2D" parent="Skeleton"]
rest = Transform2D(1, 0, 0, 1, 0, 0)
`;

describe('the bone solve of the live node patches', () => {
  it('solves no Skeleton2D stack for a tree with no relay', () => {
    runPass(liveNodePatches, liveTreeOfText(RIG_WITH_NO_RELAY));

    expect(solvedBones.solveSkeleton2DBones).not.toHaveBeenCalled();
  });
});
