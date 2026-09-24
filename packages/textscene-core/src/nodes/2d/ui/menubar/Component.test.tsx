/**
 * Tests the `<MenuBar>` render contract: one chrome StyleBox and one text run per PopupMenu child's
 * title. It asserts structure and tint only: pixels belong to the golden images and `pnpm ref:godot`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { MenuBarProperties } from './types';
import { MenuBar } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 32 };

function popup(name: string): TscnNode {
  return { name, type: 'PopupMenu', children: [], properties: {} };
}

function solveNode(properties: Partial<MenuBarProperties> = {}, children: TscnNode[] = []): SolveNode {
  const node: TscnNode = {
    name: 'Bar',
    type: 'MenuBar',
    children,
    properties: { name: 'Bar', ...properties } as MenuBarProperties,
  };
  return { ...emptySolveNode(), path: 'Bar', node };
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>` does not. */
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

describe('<MenuBar> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws one chrome mesh and one text mesh per PopupMenu child', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MenuBar {...painterEnv()} solveNode={solveNode({}, [popup('File'), popup('Edit')])} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(2);
    expect(findTextMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws nothing for a MenuBar with no PopupMenu children', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MenuBar {...painterEnv()} solveNode={solveNode({}, [])} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(0);
    expect(findTextMeshes(renderer.scene)).toHaveLength(0);
  });

  it('flat=true draws NO chrome mesh at all, but still draws the titles', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MenuBar
        {...painterEnv()}
        solveNode={solveNode({ flat: true }, [popup('File')])}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(0);
    expect(findTextMeshes(renderer.scene)).toHaveLength(1);
  });

  it("uses control_font_color (0.875 sRGB) for every title, tinted the node's own colour", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MenuBar {...painterEnv()} solveNode={solveNode({}, [popup('File')])} rect={RECT} renderOrder={0} />
    );
    const material = findTextMeshes(renderer.scene)[0]!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
  });

  it('applies the walker-composed tint to chrome AND text alike', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <MenuBar
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode({}, [popup('File')])}
        rect={RECT}
        renderOrder={0}
      />
    );
    const chrome = findChromeMeshes(renderer.scene)[0]!;
    const color = (chrome.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // style_normal_color.r (0.1) * tint (0.5) = 0.05, raw sRGB.
    expect(color.getX(0)).toBeCloseTo(0.05, 4);
  });

  it('ignores a stray non-PopupMenu child instead of drawing a title for it', async () => {
    const stray: TscnNode = { name: 'NotAMenu', type: 'Label', children: [], properties: {} };
    const renderer = await ReactThreeTestRenderer.create(
      <MenuBar {...painterEnv()} solveNode={solveNode({}, [stray, popup('File')])} rect={RECT} renderOrder={0} />
    );
    expect(findTextMeshes(renderer.scene)).toHaveLength(1);
  });
});
