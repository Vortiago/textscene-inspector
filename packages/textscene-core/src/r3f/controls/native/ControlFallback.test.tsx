/** A Control with no `Native` painter gets an outline sized to its solved rect, never a fill. */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import type { SolveNode } from './solveTree';
import { ControlFallback } from './ControlFallback';
import { painterEnv } from './testing/painterProps';
import { solveNode as emptySolveNode } from './testing/solveNode';

function solveNode(overrides: Partial<SolveNode> = {}): SolveNode {
  const node: TscnNode = { name: 'Widget', type: 'SomeUnimplementedType', children: [], properties: {} };
  return {
    ...emptySolveNode(),
    path: 'Widget',
    node,
    ...overrides,
  };
}

describe('<ControlFallback>', () => {
  it('draws exactly one LineSegments outline', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlFallback {...painterEnv()} renderOrder={0} solveNode={solveNode()} rect={{ x: 0, y: 0, w: 80, h: 24 }} />
    );
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
  });

  it('never draws a filled Mesh — an outline only, not a quad', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlFallback {...painterEnv()} renderOrder={0} solveNode={solveNode()} rect={{ x: 0, y: 0, w: 80, h: 24 }} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('sizes the outline geometry to the solved rect (w, h)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlFallback {...painterEnv()} renderOrder={0} solveNode={solveNode()} rect={{ x: 0, y: 0, w: 64, h: 32 }} />
    );
    const line = renderer.scene.findByType('LineSegments');
    const geometry = (line.instance as THREE.LineSegments).geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(64);
    expect(box.max.y - box.min.y).toBeCloseTo(32);
  });

  it('handles a zero-size rect without throwing (edge case: unsolved/degenerate rect)', async () => {
    await expect(
      ReactThreeTestRenderer.create(<ControlFallback {...painterEnv()} renderOrder={0} solveNode={solveNode()} rect={{ x: 0, y: 0, w: 0, h: 0 }} />)
    ).resolves.toBeTruthy();
  });
});
