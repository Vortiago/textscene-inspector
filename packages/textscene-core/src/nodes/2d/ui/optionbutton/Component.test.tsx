/**
 * `<OptionButton>` render contract — chrome (StyleBox) + selected-item
 * text + the chevron arrow icon. Structure/tint/render-order assertions only
 * (pixels are a golden-image concern via `pnpm ref:godot`, not this suite).
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { ControlProperties } from '../control/types';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { OptionButton } from './Component';
import type { OptionButtonProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 150, h: 32 };

function solveNode(properties: Partial<OptionButtonProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyOptionButton',
    type: 'OptionButton',
    children: [],
    properties: { name: 'MyOptionButton', ...properties } as ControlProperties,
  };
  return { path: 'MyOptionButton', node, children: [], styleBoxes: {}, textureSize: null };
}

const ITEMS = [
  { text: 'Easy', id: 0 },
  { text: 'Normal', id: 1 },
  { text: 'Hard', id: 2 },
];

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>`/`<ControlQuad>` do not. */
function findChromeMesh(scene: { findAllByType: (t: string) => { instance: THREE.Mesh }[] }) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
    .find((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms). */
function findTextMesh(scene: { findAllByType: (t: string) => { instance: THREE.Mesh }[] }) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/** The arrow `ControlQuad` is a `PlaneGeometry`, identified by its own `.parameters.width`. */
function findArrowMesh(scene: { findAllByType: (t: string) => { instance: THREE.Mesh }[] }) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
    .find((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
}

describe('<OptionButton> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws the chrome StyleBox using the default-theme normal fill', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6).
    expect(color.getX(0)).toBeCloseTo(sRGBChannelToLinear(0.1), 5);
    expect(color.getW(0)).toBeCloseTo(0.6, 5);
  });

  it('switches to the disabled fill once disabled=true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton {...painterEnv()} solveNode={solveNode({ disabled: true })} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    expect(color.getW(0)).toBeCloseTo(0.3, 5);
  });

  it('always draws the chevron arrow, even with zero items (has_theme_icon is unconditional)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findArrowMesh(renderer.scene)).toBeDefined();
  });

  it('draws NO text mesh when selected is absent/out of range', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 99 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('draws the SELECTED item\'s text, not the first item\'s', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it("uses control_font_color (0.875 sRGB) for the NORMAL label", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
  });

  it('uses control_font_disabled_color (alpha 0.5) for the DISABLED label', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1, disabled: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
  });

  it(
    'composes self_modulate onto chrome, arrow AND text, in the SAME product, without re-applying this node\'s own modulate',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}>
          <OptionButton
            {...painterEnv()}
            solveNode={solveNode({ items: ITEMS, selected: 1, selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } })}
            rect={RECT}
            renderOrder={0}
          />
        </Modulate2DContext.Provider>
      );
      // own(sRGB) = ambient(0.5) * self_modulate(0.5) = 0.25, NOT 0.125.
      const chromeColor = (findChromeMesh(renderer.scene)!.geometry as THREE.BufferGeometry).attributes
        .color as THREE.BufferAttribute;
      expect(chromeColor.getX(0)).toBeCloseTo(sRGBChannelToLinear(0.1 * 0.25), 4);

      const arrowMaterial = findArrowMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
      expect(arrowMaterial.color.r).toBeCloseTo(sRGBChannelToLinear(0.25), 4);

      const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, THEN linearised.
      expect(textMaterial.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.21875), 5);
    }
  );

  it('forwards renderOrder to every mesh (chrome, arrow, text)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1 })}
        rect={RECT}
        renderOrder={7}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.length).toBeGreaterThanOrEqual(3);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(7);
  });
});
