/**
 * `<TabContainer>` render contract — the panel StyleBox, and the internal
 * tab strip delegated to `<TabBar>` against a synthetic node built from this
 * TabContainer's own children. Structure/order assertions only — pixels are
 * a golden-image concern via `pnpm ref:godot`.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { ControlProperties } from '../control/types';
import type { TabContainerProperties } from './types';
import { TabContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const THEME = nativeTheme(1);
const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function page(name: string, properties: Partial<ControlProperties> = {}): SolveNode {
  const node: TscnNode = { name, type: 'Control', children: [], properties: { name, ...properties } as ControlProperties };
  return { ...emptySolveNode(), path: name, node };
}

function solveNode(properties: Partial<TabContainerProperties> = {}, children: SolveNode[] = []): SolveNode {
  const node: TscnNode = {
    name: 'Tabs',
    type: 'TabContainer',
    children: children.map((c) => c.node),
    properties: { name: 'Tabs', ...properties } as TabContainerProperties,
  };
  return { ...emptySolveNode(), path: 'Tabs', node, children };
}

function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

function findTextMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

describe('<TabContainer> (isolated painter contract)', () => {
  it('draws the panel StyleBox plus one tab strip StyleBox per page', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab: 0 }, [page('General'), page('Advanced', { visible: false })])}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    // 1 panel + 2 tab StyleBoxes.
    expect(findChromeMeshes(renderer.scene)).toHaveLength(3);
    expect(findTextMeshes(renderer.scene)).toHaveLength(2);
  });

  it("derives a tab's title from its own child node name when no tab_<idx>/title override is set", async () => {
    // Structural proxy: two differently-named, otherwise-identical pages
    // still produce two distinct text runs (no crash, no collapse to one).
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab: 0 }, [page('General'), page('AdvancedSettings', { visible: false })])}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    expect(findTextMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws no tab strip at all when tabs_visible is false, and the panel spans the whole rect', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer {...painterEnv()} solveNode={solveNode({ tabsVisible: false }, [page('Only')])} rect={RECT} theme={THEME} renderOrder={0} />
    );
    // Only the panel StyleBox remains; no tab title to draw either.
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
    expect(findTextMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws no strip at all for a childless TabContainer (just the empty panel)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer {...painterEnv()} solveNode={solveNode({}, [])} rect={RECT} theme={THEME} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
    expect(findTextMeshes(renderer.scene)).toHaveLength(0);
  });

  it('all_tabs_in_front flips the strip from the subtree-chrome slot to this node\'s own paint slot', async () => {
    const behind = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab: 0, allTabsInFront: false }, [page('A')])}
        rect={RECT}
        theme={THEME}
        renderOrder={5}
        subtreeChromeRenderOrder={9}
      />
    );
    const front = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab: 0, allTabsInFront: true }, [page('A')])}
        rect={RECT}
        theme={THEME}
        renderOrder={5}
        subtreeChromeRenderOrder={9}
      />
    );
    const stripMesh = (scene: Rendered['scene']) => findTextMeshes(scene)[0]!;
    // Default (false): the strip's own StyleBox/text draws at the
    // subtree-chrome slot (9.5), AFTER the current page — Godot's own
    // INTERNAL_MODE_BACK. true: this node's own paint slot (5) instead.
    expect(stripMesh(behind.scene).renderOrder).toBeCloseTo(9.5, 5);
    expect(stripMesh(front.scene).renderOrder).toBe(5);
  });
});
