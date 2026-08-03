/**
 * Conformance guard: every registered Control component must render the
 * `children` ControlDispatcher hands it.
 *
 * Godot draws a CanvasItem's children after the node itself, so a Control
 * parented to a Label or a TextureRect renders on top of it. `ControlDispatcher`
 * already dispatches that subtree and passes it down as `children`; a component
 * that destructures only `{ node }` deletes it. The 2D overlay's own gates
 * cannot see this — the goldens are WebGL-canvas-only (ADR-0024) and the
 * per-slice tests render each Control in isolation.
 *
 * The 3D counterpart is ../subtreeConformance.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import './index';
import { controlComponentRegistry } from './ControlComponentRegistry';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';

/** A node of `type` carrying only what its own parser produces by default. */
function parseBareNode(type: string): TscnNode {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Probe" type="${type}"]\n`
  );
  return scene.nodes[0]!;
}

describe('Control component subtree conformance', () => {
  it('renders the dispatched children for every registered Control type', () => {
    const dropped: string[] = [];

    for (const type of controlComponentRegistry.getAllTypeNames()) {
      const Component = controlComponentRegistry.get(type)!;
      const node = parseBareNode(type);
      const { container, unmount } = render(
        <SceneResourcesProvider internalResources={[]}>
          <Component node={node} path={node.name}>
            <div data-probe="1" />
          </Component>
        </SceneResourcesProvider>
      );
      if (!container.querySelector('[data-probe]')) dropped.push(type);
      unmount();
    }

    expect(dropped).toEqual([]);
  });
});
