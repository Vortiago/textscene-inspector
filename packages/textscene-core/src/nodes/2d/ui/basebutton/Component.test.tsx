/**
 * `<BaseButton>` — pins that it renders nothing into the scene graph, so a
 * later regression that accidentally adds a stray quad/outline shows up here
 * first.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { BaseButton } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function baseButtonSolveNode(properties: Record<string, unknown> = {}): SolveNode {
  const node: TscnNode = {
    name: 'Clicky',
    type: 'BaseButton',
    children: [],
    properties: { name: 'Clicky', ...properties },
  };
  return { ...solveNode(), path: 'Clicky', node };
}

describe('<BaseButton>', () => {
  it('renders no scene objects — BaseButton draws nothing of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <BaseButton {...painterEnv()} solveNode={baseButtonSolveNode()} rect={{ x: 0, y: 0, w: 100, h: 40 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('renders nothing even with pressed/toggle/disabled interaction state authored', async () => {
    const node = baseButtonSolveNode({ disabled: true, toggleMode: true, buttonPressed: true });
    const renderer = await ReactThreeTestRenderer.create(
      <BaseButton {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 100, h: 40 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
