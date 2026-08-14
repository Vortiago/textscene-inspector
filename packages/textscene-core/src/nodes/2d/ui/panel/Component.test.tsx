/**
 * `<Panel>` — the native (WebGL canvas) painter for `Panel`. Draws its
 * `theme_override_styles/panel` StyleBox (falling back to the default-theme
 * `panel` struct) across the node's whole solved rect, exactly like
 * `panel.cpp`'s `NOTIFICATION_DRAW`:
 * `theme_cache.panel_style->draw(ci, Rect2(Point2(), get_size()))`.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import type { ControlProperties } from '../control/types';
import { Panel } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function styleBox(overrides: Partial<StyleBoxFlatData> = {}): StyleBoxFlatData {
  return {
    bgColor: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
    borderColor: { r: 0, g: 0, b: 0, a: 1 },
    borderWidth: { ...ZERO_SIDES },
    cornerRadius: { ...ZERO_CORNERS },
    expandMargin: { ...ZERO_SIDES },
    contentMargin: { ...ZERO_SIDES },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

function solveNode(
  properties: Partial<ControlProperties> = {},
  styleBoxes: Record<string, StyleBoxFlatData> = {}
): SolveNode {
  const node: TscnNode = {
    name: 'MyPanel',
    type: 'Panel',
    children: [],
    properties: { name: 'MyPanel', ...properties } as ControlProperties,
  };
  return { ...emptySolveNode(), path: 'MyPanel', node, styleBoxes };
}

const RECT = { x: 0, y: 0, w: 100, h: 50 };

describe('<Panel> (isolated painter contract)', () => {
  it('draws the resolved theme_override_styles/panel override, not the default fill, when one is present', async () => {
    const override = styleBox({ bgColor: { r: 0.9, g: 0.1, b: 0.1, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <Panel {...painterEnv()} solveNode={solveNode({}, { panel: override })} rect={RECT} renderOrder={0} />
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // Raw sRGB: the StyleBox vertex attribute stays in sRGB and the shader
    // decodes it per fragment (`StyleBoxQuad.tsx`'s own doc).
    expect(color.getX(0)).toBeCloseTo(0.9, 4);
  });

  it('falls back to the default-theme panel struct when no override resolves', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Panel {...painterEnv()} solveNode={solveNode({}, {})} rect={RECT} renderOrder={0} />
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // Default-theme `panel` stylebox fill is `style_normal_color` =
    // Color(0.1, 0.1, 0.1, 0.6) (default_theme.cpp:134, nativeTheme.ts's
    // STYLE_FILL.normal), read raw — see `StyleBoxQuad.tsx` on colour space.
    expect(color.getX(0)).toBeCloseTo(0.1, 5);
    expect(color.getW(0)).toBeCloseTo(0.6, 5);
  });

  it('composes self_modulate onto the panel fill, in sRGB, with a single linear conversion', async () => {
    const flat = styleBox({ bgColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <Panel {...painterEnv()}
        solveNode={solveNode({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }, { panel: flat })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // 0.8 (bgColor) * 0.5 (self_modulate) = 0.4, composed in sRGB and left
    // there for the shader to decode.
    expect(color.getX(0)).toBeCloseTo(0.4, 4);
  });

  it('does NOT reapply the ambient modulate a second time (only self_modulate composes on top of it)', async () => {
    // If this painter re-ran useControlTint/useCanvasItemTint with this
    // node's OWN `modulate`, the ambient value below (already the product a
    // real ControlCanvasWalker would provide, ancestor × own modulate) would
    // get squared. own(sRGB) = ambient(0.5) * self_modulate(0.5) = 0.25 —
    // NOT 0.125 (which squaring the 0.5 a second time would produce).
    const flat = styleBox({ bgColor: { r: 1, g: 1, b: 1, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}>
        <Panel {...painterEnv()}
          solveNode={solveNode({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }, { panel: flat })}
          rect={RECT}
          renderOrder={0}
        />
      </Modulate2DContext.Provider>
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // 0.5 (ambient) * 0.5 (self_modulate) = 0.25, in sRGB.
    expect(color.getX(0)).toBeCloseTo(0.25, 4);
  });
});

describe('<Panel> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('honours visible === false on the Panel node itself (the WALKER hides the group, not this painter)', async () => {
    controlComponentRegistry.register({ typeName: 'Panel', Component: Panel });
    controlSolverRegistry.clear();
    const root = solveNode({ anchorsPreset: 15, visible: false });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance as { visible: boolean; name: string });
    const rootGroup = groups.find((g) => g.name === 'Panel:MyPanel');
    expect(rootGroup).toBeDefined();
    expect(rootGroup!.visible).toBe(false);

    controlComponentRegistry.clear();
  });
});
