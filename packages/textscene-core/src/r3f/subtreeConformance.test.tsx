/**
 * Conformance guard: every registered node component must render the
 * `children` the dispatcher hands it.
 *
 * In Godot a node's descendants are part of the scene tree unconditionally —
 * no node type has leaf semantics. Our dispatchers already build the whole
 * subtree and pass it down as `children`, so a component that destructures
 * only `{ node }` silently deletes everything parented under it. That is
 * invisible to per-slice tests (they render the component alone) and to the
 * goldens (the fixtures put nothing under those nodes), which is exactly how
 * MeshInstance3D came to drop 144 authored child nodes across 19 vendored
 * demo scenes.
 *
 * The check renders each registered type with a probe child and asserts the
 * probe survives. Properties come from the type's real parser (a synthesised
 * one-node scene), so components that destructure parsed sub-objects get the
 * shape they expect instead of a bare `{}`.
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
 * empty property block — i.e. every default, nothing authored.
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
