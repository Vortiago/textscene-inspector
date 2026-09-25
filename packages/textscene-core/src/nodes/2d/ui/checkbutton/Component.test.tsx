/**
 * `<CheckButton>` render contract: a toggle-switch icon, always drawn at the right edge, and
 * optional label text, with no chrome mesh. Structure, tint and render order only.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { CheckButton } from './Component';
import type { CheckButtonProperties } from './types';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { CHECK_BUTTON_ICONS } from '../../../../r3f/controls/native/themeIcons';

const RECT: Rect2 = { x: 0, y: 0, w: 150, h: 28 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<CheckButtonProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyCheckButton',
    type: 'CheckButton',
    children: [],
    properties: { name: 'MyCheckButton', ...properties } as CheckButtonProperties,
  };
  return { ...emptySolveNode(), path: 'MyCheckButton', node };
}

function findIconMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
}

function findTextMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

describe('<CheckButton> (isolated painter contract)', () => {
  it('draws NO chrome mesh — every one of its StyleBoxes is a StyleBoxEmpty', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    for (const mesh of meshes) {
      expect((mesh.geometry as THREE.BufferGeometry).attributes.color).toBeUndefined();
    }
  });

  it('draws the toggle icon even with no text at all (unconditional)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findIconMesh(renderer.scene)).toBeDefined();
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('the icon sits flush against the RIGHT edge, not the left', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const mesh = findIconMesh(renderer.scene)!;
    const group = mesh.parent as THREE.Object3D;
    // icon width 32, marginX 6: x = 150 - (32+6) = 112.
    expect(group.position.x).toBe(112);
  });

  it('draws the text mesh when text is present', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it('uses font_pressed_color (opaque white) when checked and not disabled', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'Hi', buttonPressed: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(1), 5);
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
  });

  it('uses font_color (0.875 gray) for an unchecked, non-disabled switch', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
  });

  it('uses font_disabled_color (alpha 0.5) once disabled', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi', disabled: true })} rect={RECT} renderOrder={0} />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
  });

  it('applies the walker-composed tint as ONE product, reaching the icon AND text alike', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        tint={painterTint({ r: 0.25, g: 0.25, b: 0.25, a: 1 })}
        solveNode={solveNode({ text: 'Hi' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const iconMaterial = findIconMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
    // button_unchecked_color(1) * own(0.25) = 0.25 in sRGB, linearised.
    expect(iconMaterial.color.r).toBeCloseTo(sRGBChannelToLinear(0.25), 4);

    const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, linearised.
    expect(textMaterial.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.21875), 5);
  });

  it('forwards renderOrder to every mesh (icon + text)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={7} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(7);
  });

  it('defaults text alignment to LEFT (CheckButton\'s own constructor override), not Button\'s CENTER', async () => {
    const rendererLeft = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const rendererCenter = await ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'Hi', alignment: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const leftGroup = findTextMesh(rendererLeft.scene)!.parent as THREE.Object3D;
    const centerGroup = findTextMesh(rendererCenter.scene)!.parent as THREE.Object3D;
    // marginX(6) alone for the default. An explicit CENTER override shifts it further right.
    expect(leftGroup.position.x).toBe(6);
    expect(centerGroup.position.x).toBeGreaterThan(leftGroup.position.x);
  });

  // `check_button.cpp:135`: `ofs.x = normal_style->get_margin(SIDE_LEFT)` under
  // RTL, against `:137`'s `size.width - (tex_size.width + margin(SIDE_RIGHT))`.
  // `cb_empty`'s X margin is 6 and the vendored toggle is 32 wide, so the LTR
  // arm is 150 - (32 + 6) = 112.
  it('draws the toggle at the LEFT content margin under RTL', async () => {
    const iconX = async (rtl: boolean) => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckButton {...painterEnv()} solveNode={{ ...solveNode({ text: 'On' }), rtl }} rect={RECT} renderOrder={0} />
      );
      return findIconMesh(renderer.scene)!.parent!.position.x;
    };
    expect(await iconX(false)).toBe(112);
    expect(await iconX(true)).toBe(6);
  });

  // `check_button.cpp:109-120` swaps the whole icon table for the `_mirrored`
  // one, a separately authored SVG (`default_theme.cpp:332-335`).
  it('draws the MIRRORED toggle SVG under RTL', async () => {
    const iconSrc = async (rtl: boolean) => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckButton {...painterEnv()} solveNode={{ ...solveNode({}), rtl }} rect={RECT} renderOrder={0} />
      );
      const material = findIconMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
      return (material.map!.image as { src?: string }).src;
    };
    expect(await iconSrc(false)).toBe(CHECK_BUTTON_ICONS.unchecked);
    expect(await iconSrc(true)).toBe(CHECK_BUTTON_ICONS.uncheckedMirrored);
  });

});
