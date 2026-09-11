/**
 * `<TabBar>` render contract — one StyleBox + text run per drawn tab, the
 * current tab's own chrome, and the close icon where the display policy
 * shows it. Structure/colour assertions only — pixels are a golden-image
 * concern via `pnpm ref:godot`.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { TabBarProperties } from './types';
import { TabBar } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const THEME = nativeTheme(1);
const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 32 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<TabBarProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'Tabs',
    type: 'TabBar',
    children: [],
    properties: { name: 'Tabs', ...properties } as TabBarProperties,
  };
  return { ...emptySolveNode(), path: 'Tabs', node };
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>`/`<ControlQuad>` do not. */
function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms). */
function findTextMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
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
    expect(findTextMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws nothing for an empty tab list', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TabBar {...painterEnv()} solveNode={solveNode({ tabs: [] })} rect={RECT} theme={THEME} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(0);
    expect(findTextMeshes(renderer.scene)).toHaveLength(0);
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
    // style_pressed_color (0, 0, 0, 0.6) — distinct RGB, same alpha. The
    // border ring (`StyleBoxQuad.tsx`'s own vertex order) precedes the fill
    // in the buffer, so every vertex is scanned rather than assuming index 0.
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
    // style_disabled_color alpha 0.3 — some vertex in the fill carries it (see the note above on vertex order).
    let sawDisabledAlpha = false;
    for (let i = 0; i < color.count; i++) {
      if (Math.abs(color.getW(i) - 0.3) < 1e-5) sawDisabledAlpha = true;
    }
    expect(sawDisabledAlpha).toBe(true);
  });

  it('draws a close icon per tab under SHOW_ALWAYS but none under SHOW_NEVER', async () => {
    const tabs = [{ title: 'A', tooltip: '', disabled: false }];
    const always = await ReactThreeTestRenderer.create(
      <TabBar {...painterEnv()} solveNode={solveNode({ tabs, currentTab: 0, tabCloseDisplayPolicy: 2 })} rect={RECT} theme={THEME} renderOrder={0} />
    );
    const never = await ReactThreeTestRenderer.create(
      <TabBar {...painterEnv()} solveNode={solveNode({ tabs, currentTab: 0, tabCloseDisplayPolicy: 0 })} rect={RECT} theme={THEME} renderOrder={0} />
    );
    const alwaysIconMeshes = always.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .filter((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
    const neverIconMeshes = never.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .filter((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
    expect(alwaysIconMeshes.length).toBeGreaterThan(neverIconMeshes.length);
  });

  it('draws the scroll arrows once the tabs overflow a clipped bar', async () => {
    const narrowRect: Rect2 = { x: 0, y: 0, w: 60, h: 32 };
    const renderer = await ReactThreeTestRenderer.create(
      <TabBar
        {...painterEnv()}
        solveNode={solveNode({
          tabs: [
            { title: 'General Settings', tooltip: '', disabled: false },
            { title: 'Advanced Options Here', tooltip: '', disabled: false },
          ],
          currentTab: 0,
          clipTabs: true,
        })}
        rect={narrowRect}
        theme={THEME}
        renderOrder={0}
      />
    );
    const iconMeshes = renderer.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .filter((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
    // The overflowing second tab is clipped off (never drawn) and its
    // absence is what makes the two scroll arrows visible.
    expect(iconMeshes.length).toBeGreaterThanOrEqual(2);
  });
});
