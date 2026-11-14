/**
 * `<TabBar>` render contract: one StyleBox and text run per drawn tab, the current tab's chrome, and
 * the close icon where the display policy shows it. It asserts structure and colour, not pixels.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { TabBarProperties } from './types';
import { TabBar } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import { bundledRunMeshes, bundledRuns } from '../../../../r3f/controls/native/testing/bundledRunStub';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const THEME = nativeTheme(1);
const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 32 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<TabBarProperties> = {}): SolveNode {
  const node: TscnNode = controlNode('Tabs', 'TabBar', { name: 'Tabs', ...properties });
  return withThemeItems({ ...emptySolveNode(), path: 'Tabs', node });
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>`/`<ControlQuad>` do not. */
function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

describe('<TabBar> (isolated painter contract)', () => {
  it('draws one chrome StyleBox and one text run per tab', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        solveNode={solveNode({
          tabs: [
            { title: 'General', tooltip: '', disabled: false },
            { title: 'Advanced', tooltip: '', disabled: false },
          ],
          currentTab: 0,
        })}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(2);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws nothing for an empty tab list', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        solveNode={solveNode({ tabs: [] })}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(0);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
  });

  it('the current tab draws with tab_selected (a top border), an unselected tab with tab_unselected (no top border)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        solveNode={solveNode({
          tabs: [
            { title: 'A', tooltip: '', disabled: false },
            { title: 'B', tooltip: '', disabled: false },
          ],
          currentTab: 1,
        })}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    const meshes = findChromeMeshes(renderer.scene);
    // Selected (tab_selected, default_theme.cpp:975-976) fills with
    // style_normal_color (0.1, 0.1, 0.1, 0.6); unselected fills with
    // style_pressed_color (0, 0, 0, 0.6): distinct RGB, same alpha. The border ring precedes the
    // fill in the buffer (`StyleBoxQuad.tsx`), so every vertex is scanned.
    const hasFillRGBA = (mesh: THREE.Mesh, r: number, a: number) => {
      const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < color.count; i++) {
        if (Math.abs(color.getX(i) - r) < 1e-5 && Math.abs(color.getW(i) - a) < 1e-5) return true;
      }
      return false;
    };
    expect(meshes.some((m) => hasFillRGBA(m, 0.1, 0.6))).toBe(true);
    expect(meshes.some((m) => hasFillRGBA(m, 0, 0.6))).toBe(true);
  });

  describe('a bar whose scene authors no current_tab', () => {
    const tabs = [
      { title: 'A', tooltip: '', disabled: false },
      { title: 'B', tooltip: '', disabled: false },
    ];

    async function drawsSelectedFill(properties: Partial<TabBarProperties>): Promise<boolean> {
      const renderer = await ReactThreeTestRenderer.create(
        <TabBar
          {...painterEnv()}
          solveNode={solveNode({ tabs, ...properties })}
          rect={RECT}
          theme={THEME}
          renderOrder={0}
        />
      );
      // tab_selected fills with style_normal_color (0.1, 0.1, 0.1, 0.6), tab_unselected with (0, 0, 0, 0.6).
      return findChromeMeshes(renderer.scene).some((mesh) => {
        const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
        return Array.from({ length: color.count }, (_unused, i) => i).some(
          (i) => Math.abs(color.getX(i) - 0.1) < 1e-5 && Math.abs(color.getW(i) - 0.6) < 1e-5
        );
      });
    }

    it('selects the first tab, as set_tab_count does (tab_bar.cpp:763-767)', async () => {
      expect(await drawsSelectedFill({})).toBe(true);
    });

    it('selects none under deselect_enabled', async () => {
      expect(await drawsSelectedFill({ deselectEnabled: true })).toBe(false);
    });
  });

  it('a disabled tab draws tab_disabled even when it is the current tab (tab_bar.cpp:558)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        solveNode={solveNode({
          tabs: [{ title: 'A', tooltip: '', disabled: true }],
          currentTab: 0,
        })}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    const mesh = findChromeMeshes(renderer.scene)[0]!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // style_disabled_color alpha 0.3: some fill vertex carries it, in the vertex order noted above.
    let sawDisabledAlpha = false;
    for (let i = 0; i < color.count; i++) {
      if (Math.abs(color.getW(i) - 0.3) < 1e-5) sawDisabledAlpha = true;
    }
    expect(sawDisabledAlpha).toBe(true);
  });

  it('draws a close icon per tab under SHOW_ALWAYS but none under SHOW_NEVER', async () => {
    const tabs = [{ title: 'A', tooltip: '', disabled: false }];
    const always = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        solveNode={solveNode({ tabs, currentTab: 0, tabCloseDisplayPolicy: 2 })}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    const never = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        solveNode={solveNode({ tabs, currentTab: 0, tabCloseDisplayPolicy: 0 })}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    const alwaysIconMeshes = always.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .filter(
        (m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined
      );
    const neverIconMeshes = never.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .filter(
        (m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined
      );
    expect(alwaysIconMeshes.length).toBeGreaterThan(neverIconMeshes.length);
  });

  it('shapes a tab title at theme_override_font_sizes/font_size, not the theme default (tab_bar.cpp:365,2179)', async () => {
    const tabs = [{ title: 'Inventory', tooltip: '', disabled: false }];
    const titleFontSizePx = async (properties: Partial<TabBarProperties>) => {
      const renderer = await ReactThreeTestRenderer.create(
        <TabBar
          {...painterEnv()}
          solveNode={solveNode({ tabs, currentTab: 0, ...properties })}
          rect={RECT}
          theme={THEME}
          renderOrder={0}
        />
      );
      return bundledRuns(renderer.scene)[0]!.fontSizePx;
    };
    expect(await titleFontSizePx({ themeOverrideFontSizes: { font_size: 28 } })).toBe(28);
    expect(await titleFontSizePx({})).toBe(THEME.fontSize);
  });

  /** The `ControlQuad` icon meshes of a bar too narrow for its two tabs: the two scroll arrows. */
  async function scrollArrowMeshes(tint = painterEnv().tint) {
    const renderer = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        tint={tint}
        solveNode={solveNode({
          tabs: [
            { title: 'General Settings', tooltip: '', disabled: false },
            { title: 'Advanced Options Here', tooltip: '', disabled: false },
          ],
          currentTab: 0,
          clipTabs: true,
        })}
        rect={{ x: 0, y: 0, w: 60, h: 32 }}
        theme={THEME}
        renderOrder={0}
      />
    );
    return renderer.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .filter(
        (m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined
      );
  }

  it('draws the scroll arrows once the tabs overflow a clipped bar', async () => {
    // The overflowing second tab is clipped off (never drawn) and its
    // absence is what makes the two scroll arrows visible.
    expect((await scrollArrowMeshes()).length).toBeGreaterThanOrEqual(2);
  });

  it("tints the scroll arrows with the bar's modulate, as every item it draws (tab_bar.cpp:564-592)", async () => {
    const arrows = await scrollArrowMeshes(painterTint({ r: 0, g: 1, b: 0, a: 1 }));
    const colors = arrows.map((m) => (m.material as THREE.MeshBasicMaterial).color);
    expect(colors.map((c) => c.r)).toEqual(colors.map(() => 0));
  });
});

describe('<TabBar> with its tab style flipped (`set_tab_style_v_flip`, tab_bar.cpp:648-654)', () => {
  /** The product of every scale on y from the tab's StyleBox up: its sign says which way up it draws. */
  async function styleSignY(properties: Partial<TabBarProperties>): Promise<number> {
    const renderer = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        solveNode={solveNode({ tabs: [{ title: 'A', tooltip: '', disabled: false }], ...properties })}
        rect={RECT}
        theme={THEME}
        renderOrder={0}
      />
    );
    const [chrome] = findChromeMeshes(renderer.scene);
    let sign = 1;
    for (let o: THREE.Object3D | null = chrome!; o; o = o.parent) sign *= o.scale.y;
    return sign;
  }

  it('draws the StyleBox mirrored on y', async () => {
    expect(await styleSignY({ tabStyleVFlip: true })).toBe(-(await styleSignY({})));
  });
});
