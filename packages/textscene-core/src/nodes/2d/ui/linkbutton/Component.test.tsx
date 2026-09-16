/**
 * `<LinkButton>` render contract — text only, no chrome mesh, plus an
 * underline stroke gated on `underline_mode` and draw state. Structure/tint/
 * render-order assertions only (pixels are a golden-image concern via
 * `pnpm ref:godot`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { LinkButton } from './Component';
import type { LinkButtonProperties } from './types';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const RECT: Rect2 = { x: 0, y: 0, w: 150, h: 28 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<LinkButtonProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyLinkButton',
    type: 'LinkButton',
    children: [],
    properties: { name: 'MyLinkButton', ...properties } as LinkButtonProperties,
  };
  return { ...emptySolveNode(), path: 'MyLinkButton', node };
}

function findTextMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/** The underline stroke is a plain `MeshBasicMaterial`-backed `PlaneGeometry`, no `map`. */
function findUnderlineMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find(
      (m) =>
        (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined &&
        (m.material as THREE.MeshBasicMaterial).map == null
    );
}

describe('<LinkButton> (isolated painter contract)', () => {
  it('draws no mesh at all with no text', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws the text mesh when text is present', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton {...painterEnv()} solveNode={solveNode({ text: 'Visit' })} rect={RECT} renderOrder={0} />
    );
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it('draws NO StyleBox chrome mesh — LinkButton registers none of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton {...painterEnv()} solveNode={solveNode({ text: 'Visit' })} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    for (const mesh of meshes) {
      expect((mesh.geometry as THREE.BufferGeometry).attributes.color).toBeUndefined();
    }
  });

  it('underlines by default (UNDERLINE_MODE_ALWAYS is the Godot default) when normal', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton {...painterEnv()} solveNode={solveNode({ text: 'Visit' })} rect={RECT} renderOrder={0} />
    );
    expect(findUnderlineMesh(renderer.scene)).toBeDefined();
  });

  it('does not underline when underline_mode is NEVER (2) and normal', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'Visit', underline: 2 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findUnderlineMesh(renderer.scene)).toBeUndefined();
  });

  it('underlines when pressed even with underline_mode ON_HOVER (1) — pressed underlines on anything but NEVER', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'Visit', underline: 1, buttonPressed: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findUnderlineMesh(renderer.scene)).toBeDefined();
  });

  it('uses font_pressed_color (opaque white) when pressed', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'Visit', buttonPressed: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(1), 5);
  });

  it('uses opaque BLACK once disabled (no font_disabled_color in its ClassDB chain)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton {...painterEnv()} solveNode={solveNode({ text: 'Visit', disabled: true })} rect={RECT} renderOrder={0} />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0), 5);
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
  });

  it('applies the walker-composed tint to the text AND the underline alike', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode({ text: 'Visit' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    // control_font_color(0.875) * own(0.5) = 0.4375 in sRGB, linearised.
    expect(textMaterial.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.4375), 5);

    const underlineMaterial = findUnderlineMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
    expect(underlineMaterial.color.r).toBeCloseTo(sRGBChannelToLinear(0.4375), 4);
  });

  it('forwards renderOrder to every mesh (text + underline)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LinkButton {...painterEnv()} solveNode={solveNode({ text: 'Visit' })} rect={RECT} renderOrder={5} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(5);
  });

  it('text_overrun_behavior trims the label to the control\'s own rect width (link_button.cpp:286-289)', async () => {
    const narrow: Rect2 = { x: 0, y: 0, w: 30, h: 28 };
    const untrimmed = await ReactThreeTestRenderer.create(
      <LinkButton {...painterEnv()} solveNode={solveNode({ text: 'AAAAAAAAAAAA' })} rect={narrow} renderOrder={0} />
    );
    const trimmed = await ReactThreeTestRenderer.create(
      <LinkButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'AAAAAAAAAAAA', overrunBehavior: 1 })}
        rect={narrow}
        renderOrder={0}
      />
    );
    const quadCount = (r: Rendered) => findTextMesh(r.scene)!.geometry.attributes.position!.count / 4;
    expect(quadCount(trimmed)).toBeLessThan(quadCount(untrimmed));
  });
});
