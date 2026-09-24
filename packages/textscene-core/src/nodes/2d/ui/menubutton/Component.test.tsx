/**
 * Tests the `<MenuButton>` render contract: Button's chrome, text and icon assembly, covered in full by
 * `button/Component.test.tsx`, plus MenuButton's own disabled font colour.
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { MenuButtonProperties } from './types';
import { MenuButton } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const RECT: Rect2 = { x: 0, y: 0, w: 120, h: 32 };

function solveNode(properties: Partial<MenuButtonProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyMenuButton',
    type: 'MenuButton',
    children: [],
    properties: { name: 'MyMenuButton', ...properties } as MenuButtonProperties,
  };
  return { ...emptySolveNode(), path: 'MyMenuButton', node };
}

function findChromeMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

function findTextMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

describe('<MenuButton> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws the default-theme button.normal chrome and label when flat=false is authored', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MenuButton {...painterEnv()} solveNode={solveNode({ text: 'File', flat: false })} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6): the button_normal object MenuButton's theme entry reuses.
    expect(color.getX(0)).toBeCloseTo(0.1, 5);
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it('flat=true (the parsed default) draws NO chrome mesh, but still draws the label', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MenuButton {...painterEnv()} solveNode={solveNode({ text: 'File', flat: true })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMesh(renderer.scene)).toBeUndefined();
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it("uses MenuButton's OWN disabled font colour (alpha 0.3), not Button's control_font_disabled_color (0.5)", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MenuButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'File', disabled: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(1), 5);
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.3, 5);
  });

  // MenuButton has no `_notification(NOTIFICATION_DRAW)`, so it inherits Button's alignment swap
  // (`button.cpp:271-275`): LEFT under RTL lands where RIGHT lands under LTR. This painter assembles
  // `layoutButtonContent` a second time, so `button/Component.test.tsx` misses a lost `rtl` here.
  it('places a LEFT-aligned label under RTL exactly where a RIGHT-aligned one lands under LTR', async () => {
    const labelX = async (properties: Partial<MenuButtonProperties>, rtl: boolean) => {
      const renderer = await ReactThreeTestRenderer.create(
        <MenuButton
          {...painterEnv()}
          solveNode={{ ...solveNode({ text: 'File', ...properties }), rtl }}
          rect={RECT}
          renderOrder={0}
        />
      );
      return findTextMesh(renderer.scene)!.parent!.position.x;
    };

    const ltrLeft = await labelX({ alignment: 0 }, false);
    const ltrRight = await labelX({ alignment: 2 }, false);
    const rtlLeft = await labelX({ alignment: 0 }, true);

    expect(ltrRight).toBeGreaterThan(ltrLeft);
    expect(rtlLeft).toBe(ltrRight);
  });
});
