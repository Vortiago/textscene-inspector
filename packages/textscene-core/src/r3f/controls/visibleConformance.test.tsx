/**
 * Conformance guard: `visible = false` hides every Control type.
 *
 * `controlLayoutStyle` emits `display: none` for a hidden Control, but a
 * component that spreads its OWN style defaults after the layout's silently
 * erases it — later key wins. OptionButton did exactly that with a
 * `display: 'inline-flex'` default, so a hidden dropdown rendered fully
 * visible (scenes/demos/3d/antialiasing/anti_aliasing.tscn's `FSRSharpness`).
 * The repo already knew the hazard: `createContainerComponent` re-applies
 * `display` explicitly to dodge it.
 *
 * Per class_canvasitem.html, `visible = false` hides the node AND its whole
 * subtree, which `display: none` gives us for free — so the check is simply
 * that the rendered root ends up with it, for every registered type.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import './index';
import { controlComponentRegistry } from './ControlComponentRegistry';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';

function parseHiddenNode(type: string): TscnNode {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n[node name="Probe" type="${type}"]\nvisible = false\n`
  );
  return scene.nodes[0];
}

describe('Control visibility conformance', () => {
  it('renders display:none for every registered Control type when visible = false', () => {
    const shown: string[] = [];

    for (const type of controlComponentRegistry.getAllTypeNames()) {
      const Component = controlComponentRegistry.get(type)!;
      const node = parseHiddenNode(type);
      const { container, unmount } = render(
        <SceneResourcesProvider internalResources={[]} externalResources={[]}>
          <Component node={node} path={node.name} />
        </SceneResourcesProvider>
      );
      const root = container.firstElementChild as HTMLElement | null;
      if (root && root.style.display !== 'none') shown.push(`${type} (display: ${root.style.display || 'unset'})`);
      unmount();
    }

    expect(shown).toEqual([]);
  });
});
