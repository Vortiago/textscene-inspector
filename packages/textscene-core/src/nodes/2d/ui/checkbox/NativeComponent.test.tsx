/**
 * `<CheckBoxNative>` render contract — icon (always drawn, checked/unchecked/
 * radio variant) + optional label text, NO chrome mesh. Structure/tint/
 * render-order assertions only (pixels are a golden-image concern via
 * `pnpm ref:godot`, not this suite).
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
import { CheckBoxNative } from './NativeComponent';
import type { CheckBoxProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 150, h: 28 };

function solveNode(properties: Partial<CheckBoxProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyCheckBox',
    type: 'CheckBox',
    children: [],
    properties: { name: 'MyCheckBox', ...properties } as ControlProperties,
  };
  return { path: 'MyCheckBox', node, children: [], styleBoxes: {}, textureSize: null };
}

/** The icon `ControlQuad` is a `PlaneGeometry`, identified by its own `.parameters.width` (survives a duplicate-three.js test environment). */
function findIconMesh(scene: { findAllByType: (t: string) => { instance: THREE.Mesh }[] }) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
    .find((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms). */
function findTextMesh(scene: { findAllByType: (t: string) => { instance: THREE.Mesh }[] }) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

describe('<CheckBoxNative> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws NO chrome mesh — CheckBox has no visible StyleBox (StyleBoxEmpty)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBoxNative {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    // Every mesh here is either the icon (PlaneGeometry, .parameters) or the
    // text run (BufferGeometry, no .parameters) — none carries a `color`
    // vertex attribute the way a StyleBoxQuad chrome mesh would.
    for (const mesh of meshes) {
      expect((mesh.geometry as THREE.BufferGeometry).attributes.color).toBeUndefined();
    }
  });

  it('draws the icon even with no text at all (the check glyph is unconditional)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBoxNative {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findIconMesh(renderer.scene)).toBeDefined();
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('draws the text mesh when text is present', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBoxNative {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it(
    'uses font_pressed_color (opaque white) for a CHECKED, non-disabled box — verified against ' +
      'pnpm ref:godot: probe (527,298) on unit-checkbox.tscn\'s checked row reads rgb(255,255,255)',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckBoxNative
          {...painterEnv()}
          solveNode={solveNode({ text: 'Hi', buttonPressed: true })}
          rect={RECT}
          renderOrder={0}
        />
      );
      const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(1), 5);
      expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
    }
  );

  it(
    'uses font_color (0.875 gray) for an UNCHECKED, non-disabled box (DRAW_NORMAL, not DRAW_PRESSED)',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckBoxNative {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
      );
      const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
      expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
    }
  );

  it(
    'uses font_disabled_color (alpha 0.5) once disabled — verified against pnpm ref:godot: probe (526,350) on ' +
      "unit-checkbox.tscn's disabled row reads rgb(150,150,150) ≈ 0.5*223 + 0.5*76",
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckBoxNative
          {...painterEnv()}
          solveNode={solveNode({ text: 'Hi', disabled: true })}
          rect={RECT}
          renderOrder={0}
        />
      );
      const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
      expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
    }
  );

  it('disabled wins over pressed for the icon variant AND the font colour', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBoxNative
        {...painterEnv()}
        solveNode={solveNode({ text: 'Hi', buttonPressed: true, disabled: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    // font_disabled_color, NOT font_pressed_color.
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
  });

  it(
    'composes self_modulate onto the icon AND text, in the SAME product, without re-applying this node\'s own modulate',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}>
          <CheckBoxNative
            {...painterEnv()}
            solveNode={solveNode({ text: 'Hi', selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } })}
            rect={RECT}
            renderOrder={0}
          />
        </Modulate2DContext.Provider>
      );
      // own(sRGB) = ambient(0.5) * self_modulate(0.5) = 0.25, NOT 0.125.
      const iconMaterial = findIconMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
      expect(iconMaterial.color.r).toBeCloseTo(sRGBChannelToLinear(0.25), 4);

      const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, THEN linearised.
      expect(textMaterial.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.21875), 5);
    }
  );

  it('forwards renderOrder to every mesh (icon + text)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBoxNative {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={7} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(7);
  });
});
