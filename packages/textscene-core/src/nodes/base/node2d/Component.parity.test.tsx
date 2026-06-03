/**
 * Parity: CanvasItem.show_behind_parent (#36) — the node draws just behind its
 * parent (a small negative Z offset in the conjugated 2D group frame).
 */
import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node2D } from './Component';
import { parseNode2D } from './parser';
import { Z_INDEX_STEP } from '../../../r3f/node2dTransform';
import type { TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { type: 'Node2D', name: 'N' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'N', type: 'Node2D', children: [], properties: parseNode2D(heading, raw) };
}

describe('Node2D show_behind_parent parity (#36)', () => {
  it('parses show_behind_parent (default false)', () => {
    expect(parseNode2D(heading, {}).show_behind_parent).toBe(false);
    expect(parseNode2D(heading, { show_behind_parent: 'true' }).show_behind_parent).toBe(true);
  });

  it('show_behind_parent=true offsets the group behind its parent (negative Z)', async () => {
    const r = await ReactThreeTestRenderer.create(<Node2D node={node({ show_behind_parent: 'true' })} />);
    const group = r.scene.children[0]!.instance as { position: { z: number } };
    expect(group.position.z).toBeLessThan(0);
  });

  it('default sits at z_index plane (no negative offset)', async () => {
    const r = await ReactThreeTestRenderer.create(<Node2D node={node({ z_index: '1' })} />);
    const group = r.scene.children[0]!.instance as { position: { z: number } };
    expect(group.position.z).toBeCloseTo(Z_INDEX_STEP, 5);
  });
});
