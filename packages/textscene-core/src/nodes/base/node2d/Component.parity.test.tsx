/**
 * Parity: CanvasItem.show_behind_parent — the node draws just behind its
 * parent (a small negative Z offset in the conjugated 2D group frame).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
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

describe('Node2D skew parity', () => {
  it('non-zero skew bakes a shear matrix onto the group (matrixAutoUpdate off)', async () => {
    const skew = Math.PI / 6;
    const r = await ReactThreeTestRenderer.create(<Node2D node={node({ skew: String(skew) })} />);
    const group = r.scene.children[0]!.instance as THREE.Group;
    expect(group.matrixAutoUpdate).toBe(false);
    // Local-Y basis is sheared toward X: column 1 = (sin(skew), cos(skew), 0).
    const e = group.matrix.elements;
    expect(e[4]).toBeCloseTo(Math.sin(skew), 5);
    expect(e[5]).toBeCloseTo(Math.cos(skew), 5);
    // A child at local (0,1) lands sheared in world space (proves the matrix
    // actually drives composition, not just that the prop was set).
    group.updateMatrixWorld(true);
    const p = new THREE.Vector3(0, 1, 0).applyMatrix4(group.matrixWorld);
    expect(p.x).toBeCloseTo(Math.sin(skew), 5);
    expect(p.y).toBeCloseTo(Math.cos(skew), 5);
  });

  it('zero skew keeps the plain TRS group (matrixAutoUpdate stays on)', async () => {
    const r = await ReactThreeTestRenderer.create(<Node2D node={node({ rotation: '0.3' })} />);
    const group = r.scene.children[0]!.instance as THREE.Group;
    expect(group.matrixAutoUpdate).toBe(true);
  });
});
