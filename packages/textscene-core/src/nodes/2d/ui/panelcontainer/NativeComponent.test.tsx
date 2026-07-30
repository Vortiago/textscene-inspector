/**
 * `<PanelContainerNative>` — the native (WebGL canvas) painter for
 * `PanelContainer`. Draws the SAME chrome `<PanelNative>` draws (the resolved
 * `theme_override_styles/panel` override, or the default-theme `panel`
 * struct, across the node's whole solved rect) — the container BEHAVIOUR
 * (content-rect inset + minimum size) lives in `nativeSolver.ts`, wired
 * through `controlSolverRegistry`, not in this painter.
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
import { controlComponentRegistry, type ControlComponent } from '../../../../r3f/controls/ControlComponentRegistry';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import type { ControlProperties } from '../control/types';
import { PanelContainerNative } from './NativeComponent';

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const DomStub: ControlComponent = () => null;

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
    ...overrides,
  };
}

function solveNode(
  properties: Partial<ControlProperties> = {},
  styleBoxes: Record<string, StyleBoxFlatData> = {}
): SolveNode {
  const node: TscnNode = {
    name: 'MyPanelContainer',
    type: 'PanelContainer',
    children: [],
    properties: { name: 'MyPanelContainer', ...properties } as ControlProperties,
  };
  return { path: 'MyPanelContainer', node, children: [], styleBoxes, textureSize: null };
}

const RECT = { x: 0, y: 0, w: 240, h: 80 };

describe('<PanelContainerNative> (isolated painter contract)', () => {
  it('draws the resolved theme_override_styles/panel override, not the default fill, when one is present', async () => {
    const override = styleBox({ bgColor: { r: 0.9, g: 0.1, b: 0.1, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <PanelContainerNative solveNode={solveNode({}, { panel: override })} rect={RECT} />
    );
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // sRGBChannelToLinear(0.9) ≈ 0.787412 (utils/colorSpace.ts).
    expect(color.getX(0)).toBeCloseTo(0.787412, 4);
  });

  it('falls back to the default-theme panel struct when no override resolves', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <PanelContainerNative solveNode={solveNode({}, {})} rect={RECT} />
    );
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // Default-theme `panel` stylebox fill is `style_normal_color` =
    // Color(0.1, 0.1, 0.1, 0.6) — the SAME struct Panel falls back to
    // (default_theme.cpp:134 and :1274 call make_flat_stylebox with the
    // identical arguments for "Panel" and "PanelContainer").
    expect(color.getX(0)).toBeCloseTo(0.0100228, 5);
    expect(color.getW(0)).toBeCloseTo(0.6, 5);
  });

  it('composes self_modulate onto the panel fill, in sRGB, with a single linear conversion', async () => {
    const flat = styleBox({ bgColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <PanelContainerNative
        solveNode={solveNode({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }, { panel: flat })}
        rect={RECT}
      />
    );
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // 0.8 (bgColor) * 0.5 (self_modulate) = 0.4 in sRGB, THEN converted once:
    // sRGBChannelToLinear(0.4) ≈ 0.1328683.
    expect(color.getX(0)).toBeCloseTo(0.1328683, 4);
  });

  it('does NOT reapply the ambient modulate a second time (only self_modulate composes on top of it)', async () => {
    // own(sRGB) = ambient(0.5) * self_modulate(0.5) = 0.25 — NOT 0.125,
    // which squaring the ambient a second time would produce.
    const flat = styleBox({ bgColor: { r: 1, g: 1, b: 1, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}>
        <PanelContainerNative
          solveNode={solveNode({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }, { panel: flat })}
          rect={RECT}
        />
      </Modulate2DContext.Provider>
    );
    const geom = renderer.scene.findByType('Mesh').instance.geometry as THREE.BufferGeometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // sRGBChannelToLinear(0.25) ≈ 0.050876.
    expect(color.getX(0)).toBeCloseTo(0.050876, 4);
  });
});

describe('<PanelContainerNative> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('honours visible === false on the PanelContainer node itself (the WALKER hides the group, not this painter)', async () => {
    controlComponentRegistry.register({
      typeName: 'PanelContainer',
      Component: DomStub,
      Native: PanelContainerNative,
    });
    controlSolverRegistry.clear();
    const root = solveNode({ anchorsPreset: 15, visible: false });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance as { visible: boolean; name: string });
    const rootGroup = groups.find((g) => g.name === 'PanelContainer:MyPanelContainer');
    expect(rootGroup).toBeDefined();
    expect(rootGroup!.visible).toBe(false);

    controlComponentRegistry.clear();
  });
});
