/**
 * `<VBoxContainerNative>` — a Container paints no chrome of its own; this
 * pins that it renders nothing into the scene graph, so a later regression
 * that accidentally adds a stray quad/outline shows up here first.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { VBoxContainerNative } from './NativeComponent';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';

function vboxSolveNode(): SolveNode {
  const node: TscnNode = {
    name: 'Column',
    type: 'VBoxContainer',
    children: [],
    properties: { name: 'Column' },
  };
  return { path: 'Column', node, children: [], styleBoxes: {}, textureSize: null };
}

describe('<VBoxContainerNative>', () => {
  it('renders no scene objects — a container draws nothing of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <VBoxContainerNative {...painterEnv()} solveNode={vboxSolveNode()} rect={{ x: 0, y: 0, w: 100, h: 40 }} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
