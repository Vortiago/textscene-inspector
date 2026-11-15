/**
 * `<TabContainer>` render contract: its painter draws the panel and the header band, and the walk
 * draws its internal TabBar (`internalControls.ts`). Structure and order only: pixels are a
 * golden-image concern (`pnpm ref:diff`).
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
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { walked } from '../../../../r3f/controls/native/testing/walk';
import { tabHeaderHeightChannel } from './nativeSolver';
import '../../../../r3f/controls/index';
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

vi.mock('../../../../r3f/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const THEME = nativeTheme(1);
const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function page(name: string, properties: Partial<ControlProperties> = {}): SolveNode {
  const node: TscnNode = controlNode(name, 'Control', { name, ...properties });
  return withThemeItems({ ...emptySolveNode(), path: `Tabs/${name}`, node });
}

/** A TabContainer `rect` large, at the canvas origin, holding `children`. */
function solveNode(
  properties: Partial<TabContainerProperties> = {},
  children: SolveNode[] = [],
  rect: Rect2 = RECT
): SolveNode {
  const node: TscnNode = {
    rawProperties: {},
    name: 'Tabs',
    type: 'TabContainer',
    children: children.map((c) => c.node),
    properties: {
      name: 'Tabs',
      offsetRight: rect.w,
      offsetBottom: rect.h,
      ...properties,
    } as TabContainerProperties,
  };
  return withThemeItems({ ...emptySolveNode(), path: 'Tabs', node, children });
}

function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

describe('<TabContainer> in the walk', () => {
  it('draws the panel plus one tab StyleBox and one title per page', async () => {
    const renderer = await walked(solveNode({ currentTab: 0 }, [page('General'), page('Advanced')]));
    expect(findChromeMeshes(renderer.scene)).toHaveLength(3);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws no tab strip when tabs_visible is false', async () => {
    const renderer = await walked(solveNode({ tabsVisible: false }, [page('Only')]));
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws no tab strip for a childless TabContainer', async () => {
    const renderer = await walked(solveNode({}, []));
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
  });

  it('a font_size override deepens the header band', async () => {
    const headerHeight = async (properties: Partial<TabContainerProperties>) => {
      const renderer = await walked(solveNode({ currentTab: 0, ...properties }, [page('General')]));
      const [panel] = findChromeMeshes(renderer.scene);
      return -panel!.getWorldPosition(new THREE.Vector3()).y;
    };
    expect(await headerHeight({ themeOverrideFontSizes: { font_size: 28 } })).toBeGreaterThan(
      await headerHeight({})
    );
  });
});

describe('<TabContainer> strip scrolled to the current page', () => {
  const CONTAINER: Rect2 = { x: 0, y: 0, w: 260, h: 100 };
  /** The right edge of the drawn titles, px: the furthest pen of any run. */
  const titlesRightEdge = async (currentTab: number) => {
    const pages = ['Inventory', 'Equipment', 'Journal', 'Settings'].map((name) => page(name));
    const renderer = await walked(solveNode({ currentTab }, pages, CONTAINER));
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

describe('<TabContainer> painter', () => {
  /** Lopsided overrides, so a band drawn at the wrong offset cannot hide behind a symmetric one. */
  const STYLE_BOXES: SolveNode['styleBoxes'] = {
    panel: { ...TABLE_PANEL, contentMargin: { left: 6, top: 3, right: 26, bottom: 3 } },
    tabbar_background: { ...TABLE_PANEL, contentMargin: { left: 4, top: 6, right: 28, bottom: 2 } },
  };
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
        meta={tabHeaderHeightChannel.seal(HEADER_HEIGHT)}
      />
    );
    return findChromeMeshes(renderer.scene).map((m) => m.getWorldPosition(new THREE.Vector3()).y);
  }

  it('starts the panel below the header band its solve seals (tab_container.cpp:264)', async () => {
    const [panelY, headerY] = await chromeYs({ tabsPosition: 0 });
    expect(panelY).toBe(-HEADER_HEIGHT);
    expect(headerY).toBe(0);
  });

  it('puts the header band at the bottom and the panel at the top for POSITION_BOTTOM (tab_container.cpp:258-264)', async () => {
    const [panelY, headerY] = await chromeYs({ tabsPosition: 1 });
    expect(panelY).toBe(0);
    expect(headerY).toBe(-(RECT.h - HEADER_HEIGHT));
  });

  it('spans the panel over the whole rect with no header', async () => {
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
  });

  it('tints the panel with tint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabContainer
        {...painterEnv()}
        {...splitTints}
        solveNode={solveNode({}, [page('General')])}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
        meta={tabHeaderHeightChannel.seal(HEADER_HEIGHT)}
      />
    );
    expect(countTintSplit(renderer.scene).own).toBe(1);
  });
});
