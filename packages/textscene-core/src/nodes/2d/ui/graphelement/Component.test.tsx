/**
 * `<GraphElement>` draws no chrome of its own (`graph_element.cpp` has no
 * `NOTIFICATION_DRAW` case) — pinned so a later regression that accidentally
 * adds a stray quad/outline shows up here first.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { GraphElement } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function graphElementSolveNode(): SolveNode {
  const node: TscnNode = {
    name: 'GE',
    type: 'GraphElement',
    children: [],
    properties: { name: 'GE' },
  };
  return { ...solveNode(), path: 'GE', node };
}

describe('<GraphElement>', () => {
  it('renders no scene objects', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphElement
        {...painterEnv()}
        solveNode={graphElementSolveNode()}
        rect={{ x: 0, y: 0, w: 100, h: 40 }}
        renderOrder={0}
      />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
