import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { transform2DOnCanvas, transform2DWithinPath } from './liveTransform2D.js';
import { liveTreeOfText } from './liveSceneTree.testkit';
import { nodesOnTheWayTo } from './liveGlobalTransform.js';
import { NO_PATCHES } from './nodePatch.js';

const SCENE = `[gd_scene format=3]
[node name="Root" type="Node2D"]
position = Vector2(100, 0)
[node name="Mid" type="Node2D" parent="."]
position = Vector2(0, 10)
[node name="Leaf" type="Node2D" parent="Mid"]
position = Vector2(5, 0)
`;

function chainTo(path: string): ReadonlyMap<string, TscnNode> {
  return nodesOnTheWayTo(liveTreeOfText(SCENE), path, NO_PATCHES);
}

describe('transform2DOnCanvas', () => {
  it('composes every node on the way down', () => {
    const t = transform2DOnCanvas('Root/Mid/Leaf', chainTo('Root/Mid/Leaf'))!;

    expect([t.tx, t.ty]).toEqual([105, 10]);
  });
});

describe('transform2DOnCanvas under a node it cannot decode', () => {
  const CONTROL = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Panel" type="Control" parent="."]
pivot_offset = Vector2(10, 10)
[node name="Leaf" type="Node2D" parent="Panel"]
position = Vector2(5, 0)
`;

  it('reads no transform below a Control whose size the file does not state (edge case)', () => {
    const chain = nodesOnTheWayTo(liveTreeOfText(CONTROL), 'Root/Panel/Leaf', NO_PATCHES);

    expect(transform2DOnCanvas('Root/Panel/Leaf', chain)).toBeNull();
  });

  it('stops at a top-level node (edge case)', () => {
    const topLevel = SCENE.replace(
      'position = Vector2(0, 10)',
      'position = Vector2(0, 10)\ntop_level = true'
    );
    const chain = nodesOnTheWayTo(liveTreeOfText(topLevel), 'Root/Mid/Leaf', NO_PATCHES);

    const t = transform2DOnCanvas('Root/Mid/Leaf', chain)!;
    expect([t.tx, t.ty]).toEqual([5, 10]);
  });
});

describe('transform2DWithinPath', () => {
  it('leaves out the ancestor and the nodes above it', () => {
    const t = transform2DWithinPath('Root/Mid/Leaf', 'Root/Mid', chainTo('Root/Mid/Leaf'));

    expect([t.tx, t.ty]).toEqual([5, 0]);
  });

  it('is the identity for a node within itself', () => {
    const t = transform2DWithinPath('Root/Mid', 'Root/Mid', chainTo('Root/Mid'));

    expect([t.tx, t.ty]).toEqual([0, 0]);
  });
});
