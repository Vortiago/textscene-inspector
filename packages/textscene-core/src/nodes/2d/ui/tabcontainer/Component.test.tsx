/**
 * `<TabContainer>` render contract: the panel StyleBox, and the internal strip
 * delegated to `<TabBar>` on a synthetic node built from the children. Structure
 * and order only: pixels are a golden-image concern (`pnpm ref:godot`).
 */

import { defaultThemeAt } from '../../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from '../../../../r3f/controls/native/defaultThemeRecords';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { ControlProperties } from '../control/types';
import type { TabContainerProperties } from './types';
import { TabContainer } from './Component';
import { countTintSplit, splitTints } from '../../../../r3f/controls/native/testing/tintSplit';
import { nearestGroupOrder } from '../../../../r3f/testing/paintOrder';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { wholeKeySlot } from '../../../../r3f/canvasItemState';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import {
  bundledRunMeshes,
  bundledRunOf,
  runGlyphs,
  runPenExtentPx,
} from '../../../../r3f/controls/native/testing/bundledRunStub';

/** Panel's `panel` box in the default theme table at scale 1 (`default_theme.cpp:134`). */
const TABLE_PANEL = defaultStyleBoxesOf(defaultThemeAt(1)).Panel!.panel!;

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const THEME = nativeTheme(1);
const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function page(name: string, properties: Partial<ControlProperties> = {}): SolveNode {
  const node: TscnNode = controlNode(name, 'Control', { name, ...properties });
  return withThemeItems({ ...emptySolveNode(), path: name, node });
}

function solveNode(properties: Partial<TabContainerProperties> = {}, children: SolveNode[] = []): SolveNode {
  const node: TscnNode = {
    rawProperties: {},
    name: 'Tabs',
    type: 'TabContainer',
    children: children.map((c) => c.node),
    properties: { name: 'Tabs', ...properties } as TabContainerProperties,
  };
  return withThemeItems({ ...emptySolveNode(), path: 'Tabs', node, children });
}

function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
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
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(2);
  });

  it("derives a tab's title from its own child node name when no tab_<idx>/title override is set", async () => {
    // Structural proxy: two differently-named, otherwise-identical pages
    // still produce two distinct text runs (no crash, no collapse to one).
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab: 0 }, [
          page('General'),
          page('AdvancedSettings', { visible: false }),
        ])}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws no tab strip at all when tabs_visible is false, and the panel spans the whole rect', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ tabsVisible: false }, [page('Only')])}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    // Only the panel StyleBox remains; no tab title to draw either.
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws no strip at all for a childless TabContainer (just the empty panel)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({}, [])}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
  });

  it("all_tabs_in_front flips the strip from the chrome slot to a piece of this node's own key", async () => {
    const behind = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab: 0, allTabsInFront: false }, [page('A')])}
        rect={RECT}
        theme={THEME}
        renderOrder={5}
        slot={wholeKeySlot(5)}
        chromeSlot={wholeKeySlot(9)}
      />
    );
    const front = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab: 0, allTabsInFront: true }, [page('A')])}
        rect={RECT}
        theme={THEME}
        renderOrder={5}
        slot={wholeKeySlot(5)}
        chromeSlot={wholeKeySlot(9)}
      />
    );
    const stripMesh = (scene: Rendered['scene']) => bundledRunMeshes(scene)[0]!;
    // Default (false): the strip draws inside the chrome slot (9), after the current page, as
    // Godot's INTERNAL_MODE_BACK does. true: INTERNAL_MODE_FRONT, after this node's own pixels (5)
    // and before its first page (6).
    const inSlot = (order: number, key: number) => key < order && order < key + 1;
    expect(inSlot(stripMesh(behind.scene).renderOrder, 9)).toBe(true);
    expect(inSlot(stripMesh(front.scene).renderOrder, 5)).toBe(true);
  });

  // three sorts by the nearest group's renderOrder before the mesh's own, so a strip text left in
  // the container's group draws under its own tab StyleBox.
  it('puts the strip text in a group at the subtree-chrome slot, as its tab StyleBox is', async () => {
    const behind = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab: 0, allTabsInFront: false }, [page('A')])}
        rect={RECT}
        theme={THEME}
        renderOrder={5}
        slot={wholeKeySlot(5)}
        chromeSlot={wholeKeySlot(9)}
      />
    );
    const groupOrder = nearestGroupOrder(bundledRunMeshes(behind.scene)[0]!);
    expect(9 < groupOrder && groupOrder < 10).toBe(true);
  });
});

describe('<TabContainer> panel band', () => {
  /** Lopsided overrides, so a band drawn at the wrong offset cannot hide behind a symmetric one. */
  const STYLE_BOXES: SolveNode['styleBoxes'] = {
    panel: { ...TABLE_PANEL, contentMargin: { left: 6, top: 3, right: 26, bottom: 3 } },
    tabbar_background: { ...TABLE_PANEL, contentMargin: { left: 4, top: 6, right: 28, bottom: 2 } },
  };

  // `tab_selected`/`tab_unselected` carry a 4px top and bottom content margin
  // each (`default_theme.cpp:974,977`) and this harness shapes no text, so the
  // strip's own minimum height is 8; `tabbar_background` adds its own 6 and 2
  // (`tab_container.cpp:51-58`).
  const HEADER_HEIGHT = 16;

  async function chromeYs(properties: Partial<TabContainerProperties>) {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={withThemeItems({
          ...solveNode({ currentTab: 0, ...properties }, [page('Only')]),
          styleBoxes: STYLE_BOXES,
        })}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    return findChromeMeshes(renderer.scene).map((m) => m.getWorldPosition(new THREE.Vector3()).y);
  }

  it('starts the panel below the header band, never at the top of the container (tab_container.cpp:264)', async () => {
    const [panelY, headerY] = await chromeYs({ tabsPosition: 0 });
    expect(panelY).toBe(-HEADER_HEIGHT);
    expect(headerY).toBe(0);
  });

  it('puts the header band at the bottom and the panel at the top for POSITION_BOTTOM (tab_container.cpp:258-264)', async () => {
    const [panelY, headerY] = await chromeYs({ tabsPosition: 1 });
    expect(panelY).toBe(0);
    expect(headerY).toBe(-(RECT.h - HEADER_HEIGHT));
  });
});

describe('<TabContainer> internal strip at a font-size override', () => {
  // TabContainer binds `tab_font_size` as the item "font_size" (tab_container.cpp:1265) and
  // pushes it onto the internal bar as its `font_size` override (tab_container.cpp:339).
  // `_get_tab_height` (tab_container.cpp:51-58) turns the bar's minimum size into the
  // header band, so the shaped buffer sets both the band and its glyphs.
  const measured = { measureText: () => ({ x: 0, y: 0 }) };

  async function strip(properties: Partial<TabContainerProperties>) {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        {...measured}
        solveNode={solveNode({ currentTab: 0, ...properties }, [page('General')])}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    const chrome = findChromeMeshes(renderer.scene).map((m) => m.getWorldPosition(new THREE.Vector3()).y);
    const text = bundledRunMeshes(renderer.scene).map((m) => m.getWorldPosition(new THREE.Vector3()).y);
    return { headerHeight: -chrome[0]!, tabTop: chrome[1]!, textTop: text[0]! };
  }

  it('a font_size override deepens the header band the page is offset by', async () => {
    const plain = await strip({});
    const overridden = await strip({ themeOverrideFontSizes: { font_size: 28 } });
    expect(overridden.headerHeight).toBeGreaterThan(plain.headerHeight);
  });

  it('the strip the container sizes still contains the glyphs that strip draws (tab_bar.cpp:82,677)', async () => {
    const overridden = await strip({ themeOverrideFontSizes: { font_size: 28 } });
    expect(overridden.textTop).toBeLessThanOrEqual(overridden.tabTop);
  });
});

describe('<TabContainer> strip scrolled to the current page', () => {
  const CONTAINER: Rect2 = { x: 0, y: 0, w: 260, h: 100 };
  /** The right edge of the drawn titles, px: the furthest pen of any run. */
  const titlesRightEdge = async (currentTab: number) => {
    const pages = ['Inventory', 'Equipment', 'Journal', 'Settings'].map((name) => page(name));
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        solveNode={solveNode({ currentTab }, pages)}
        rect={CONTAINER}
        theme={THEME}
        renderOrder={0}
      />
    );
    let rightEdge = -Infinity;
    for (const mesh of bundledRunMeshes(renderer.scene)) {
      mesh.updateWorldMatrix(true, false);
      const run = bundledRunOf(mesh)!;
      const left =
        new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).x + (runGlyphs(run)[0]?.x ?? 0);
      rightEdge = Math.max(rightEdge, left + runPenExtentPx(run));
    }
    return rightEdge;
  };

  it('draws the titles of the pages it scrolled in, not the first pages (tab_bar.cpp:1875-1920)', async () => {
    expect(await titlesRightEdge(3)).not.toBeCloseTo(await titlesRightEdge(0), 0);
  });

  it('keeps every drawn title inside the bar beside the arrows', async () => {
    const arrowsWidth = 2 * 16;
    expect(await titlesRightEdge(3)).toBeLessThanOrEqual(CONTAINER.w - arrowsWidth);
  });
});

describe('<TabContainer> — self_modulate', () => {
  it('tints the panel with tint and the tab strip with childTint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        {...splitTints}
        solveNode={solveNode({ currentTab: 0 }, [page('General'), page('Advanced')])}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    const split = countTintSplit(renderer.scene);
    expect(split.own).toBe(1);
    expect(split.child).toBeGreaterThan(0);
  });
});
