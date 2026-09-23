/** Tests that the `<Range>` painter adds nothing to the scene graph. */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { Range } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function rangeSolveNode(properties: Record<string, unknown> = {}): SolveNode {
  const node: TscnNode = {
    name: 'Bounded',
    type: 'Range',
    children: [],
    properties: { name: 'Bounded', ...properties },
  };
  return { ...solveNode(), path: 'Bounded', node };
}

describe('<Range>', () => {
  it('renders no scene objects — Range draws nothing of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Range {...painterEnv()} solveNode={rangeSolveNode()} rect={{ x: 0, y: 0, w: 100, h: 40 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('renders nothing even with value/min/max/step authored', async () => {
    const node = rangeSolveNode({ value: 30, minValue: 0, maxValue: 100, step: 5 });
    const renderer = await ReactThreeTestRenderer.create(
      <Range {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 100, h: 40 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
