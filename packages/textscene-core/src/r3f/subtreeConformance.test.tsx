/**
 * Conformance guard: every registered node component renders the `children` the
 * dispatcher hands it, since no Godot node has leaf semantics. Each type renders
 * with a probe child and properties from its real parser, and the probe must
 * survive. Per-slice tests and goldens cannot see a dropped subtree.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import './nodes/index';
import { nodeComponentRegistry } from './NodeComponentRegistry';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { TscnParser } from '../parser/TscnParser';
import type { TscnNode } from '../parser/types';

/**
 * A node of `type` with only the properties its own parser produces for an
 * empty property block: every default, nothing authored.
 */
function parseBareNode(type: string): TscnNode {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Probe" type="${type}"]\n`
  );
  return scene.nodes[0]!;
}

describe('node component subtree conformance', () => {
  it('renders the dispatched children for every registered node type', async () => {
    const dropped: string[] = [];

    for (const type of nodeComponentRegistry.getAllTypeNames()) {
      // CanvasItem slices render into the 2D DOM overlay, not the R3F scene;
      // their conformance guard lives in controls/subtreeConformance.test.tsx.
      if (nodeComponentRegistry.isCanvasItem(type)) continue;
      const Component = nodeComponentRegistry.get(type)!;

      const renderer = await ReactThreeTestRenderer.create(
        <SceneResourcesProvider internalResources={[]}>
          <Component node={parseBareNode(type)}>
            <group name="__probe__" />
          </Component>
        </SceneResourcesProvider>
      );
      const survived = renderer.scene
        .findAllByType('Group')
        .some((g) => (g.instance as unknown as { name: string }).name === '__probe__');
      if (!survived) dropped.push(type);
      await renderer.unmount();
    }

    expect(dropped).toEqual([]);
  });
});
