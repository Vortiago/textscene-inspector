/**
 * Parity: CanvasItem.show_behind_parent — the node draws BEFORE the parent it
 * hangs under, which `_cull_canvas_item` does by visiting the behind-children
 * ahead of attaching the parent itself (`renderer_canvas_cull.cpp:477-490`).
 * That is a position in the draw sequence, so it reaches the renderer as the
 * child's `renderOrder` (`canvasPaintOrder.ts`), not as a depth offset.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node2D } from './Component';
import { parseNode2D } from './parser';
import {
  allocatePaintRange,
  canvasRenderOrder,
  layerRankOf,
  layerRanks,
  WHOLE_CANVAS_RANGE,
} from '../../../r3f/canvasPaintOrder';
import { PaintRangeProvider } from '../../../r3f/contexts/PaintOrderContext';
import type { TscnNode } from '../../../parser/types';

/** The world canvas's rank — derived, never hardcoded: only a rank's ORDER
  * is meaningful, and spacing them for undeclared layers moved the value. */
const WORLD_RANK = layerRankOf(layerRanks([]), 0);

const heading = { type: 'node', attributes: { type: 'Node2D', name: 'N' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'N', type: 'Node2D', children: [], properties: parseNode2D(heading, raw) };
}

describe('Node2D show_behind_parent parity (#36)', () => {
  it('parses show_behind_parent (default false)', () => {
    expect(parseNode2D(heading, {}).show_behind_parent).toBe(false);
    expect(parseNode2D(heading, { show_behind_parent: 'true' }).show_behind_parent).toBe(true);
  });

  it('show_behind_parent=true draws the child BEFORE the parent it hangs under', async () => {
    // Needs the parent: the flag decides where the PARENT places this child in
    // its own run, so a node rendered on its own cannot express it.
    const child = node({ show_behind_parent: 'true' });
    const parent: TscnNode = { ...node(), name: 'P', children: [child] };
    // The range the dispatcher would hand this child, from the production
    // allocator — a literal here would just restate what it computes.
    const childRange = allocatePaintRange(WHOLE_CANVAS_RANGE, parent.children).children[0]!;
    const r = await ReactThreeTestRenderer.create(
      <Node2D node={parent}>
        <PaintRangeProvider value={childRange}>
          <Node2D node={child} />
        </PaintRangeProvider>
      </Node2D>
    );
    const groups = r.scene.findAllByType('Group').map((g) => g.instance);
    const parentGroup = groups.find((g) => g.name === 'P')!;
    const childGroup = groups.find((g) => g.name === 'N')!;
    expect(childGroup.renderOrder).toBeLessThan(parentGroup.renderOrder);
  });

  it('default sits in its own z_index bucket, with no behind-parent shift', async () => {
    const r = await ReactThreeTestRenderer.create(<Node2D node={node({ z_index: '1' })} />);
    const group = r.scene.children[0]!.instance as { renderOrder: number };
    expect(group.renderOrder).toBe(canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 1, sequence: 0 }));
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
