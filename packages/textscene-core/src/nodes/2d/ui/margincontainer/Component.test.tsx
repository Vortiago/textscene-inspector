/**
 * `<MarginContainer>` render contract: MarginContainer draws no chrome
 * of its own in Godot (it only insets children, `nativeSolver.ts`), so the
 * native painter must render nothing — no mesh, no line, no group of its own.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { MarginContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';

function solveNode(): SolveNode {
  const node: TscnNode = { name: 'M', type: 'MarginContainer', children: [], properties: { name: 'M' } };
  return { path: 'M', node, children: [], styleBoxes: {}, textureSize: null, fontOverrides: {}, themeChain: [], projectTheme: null };
}

describe('<MarginContainer>', () => {
  it('renders nothing — MarginContainer has no chrome of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MarginContainer {...painterEnv()} solveNode={solveNode()} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
