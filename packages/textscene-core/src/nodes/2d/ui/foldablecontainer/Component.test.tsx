/**
 * `<FoldableContainer>` render contract — title bar chrome + arrow icon +
 * title text, plus the content panel only when NOT folded. Structure/tint
 * assertions only (pixels are a golden-image concern via `pnpm ref:godot`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { FoldableContainerProperties } from './types';
import { FoldableContainer } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const RECT: Rect2 = { x: 0, y: 0, w: 120, h: 80 };

function solveNode(properties: Partial<FoldableContainerProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyFoldableContainer',
    type: 'FoldableContainer',
    children: [],
    properties: { name: 'MyFoldableContainer', ...properties } as FoldableContainerProperties,
  };
  return { ...emptySolveNode(), path: 'MyFoldableContainer', node };
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>`/icon `<ControlQuad>` do not. */
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

/** `<ControlQuad>` (the arrow icon) is a `PlaneGeometry`, identified by its own `.parameters.width`. */
function findIconMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
}

describe('<FoldableContainer> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('folded draws the title bar chrome + arrow, but NO content panel', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: true, title: 'Inventory' })} rect={RECT} renderOrder={0} />
    );
    // One title StyleBox, no content panel StyleBox.
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
    expect(findIconMeshes(renderer.scene)).toHaveLength(1);
    expect(findTextMeshes(renderer.scene)).toHaveLength(1);
  });

  it('unfolded draws the title bar chrome AND the content panel chrome', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: false, title: 'Inventory' })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws no text mesh when the title is empty, but still draws the arrow', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: false })} rect={RECT} renderOrder={0} />
    );
    expect(findTextMeshes(renderer.scene)).toHaveLength(0);
    expect(findIconMeshes(renderer.scene)).toHaveLength(1);
  });

  it("uses control_font_color for the UNFOLDED title, control_font_pressed_color (white) once folded", async () => {
    const expanded = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: false, title: 'A' })} rect={RECT} renderOrder={0} />
    );
    const expandedMaterial = findTextMeshes(expanded.scene)[0]!.material as THREE.ShaderMaterial;
    // control_font_color = 0.875 sRGB, decoded to linear inside the shader uniform.
    expect(expandedMaterial.uniforms.uColor!.value.x).toBeLessThan(0.9);

    const folded = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: true, title: 'A' })} rect={RECT} renderOrder={0} />
    );
    const foldedMaterial = findTextMeshes(folded.scene)[0]!.material as THREE.ShaderMaterial;
    // control_font_pressed_color = Color(1, 1, 1): linear 1 exactly.
    expect(foldedMaterial.uniforms.uColor!.value.x).toBeCloseTo(1, 5);
  });

  it('shifts the title text right for title_alignment CENTER/RIGHT, within the space left of the icon', async () => {
    // rect.w=120, margin=4 each side, arrow=16, h_separation=2, 'A' shaped
    // width=11 (ceil(1354*16/2048)): title_text_width = 120-8-16-2 = 94,
    // extraSpace = 94-11 = 83.
    const left = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: true, title: 'A', titleAlignment: 0 })} rect={RECT} renderOrder={0} />
    );
    const leftMesh = findTextMeshes(left.scene)[0]!;
    expect((leftMesh.parent as THREE.Object3D).position.x).toBe(4 + 16 + 2);

    const center = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: true, title: 'A', titleAlignment: 1 })} rect={RECT} renderOrder={0} />
    );
    const centerMesh = findTextMeshes(center.scene)[0]!;
    expect((centerMesh.parent as THREE.Object3D).position.x).toBe(4 + 16 + 2 + Math.floor(83 / 2));

    const right = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: true, title: 'A', titleAlignment: 2 })} rect={RECT} renderOrder={0} />
    );
    const rightMesh = findTextMeshes(right.scene)[0]!;
    expect((rightMesh.parent as THREE.Object3D).position.x).toBe(4 + 16 + 2 + 83);
  });

  it('applies the walker-composed tint alpha to the title chrome', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        tint={painterTint({ r: 1, g: 1, b: 1, a: 0.5 })}
        solveNode={solveNode({ folded: true, title: 'A' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const chrome = findChromeMeshes(renderer.scene)[0]!;
    const color = (chrome.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // style_pressed_color.a (0.6) * tint.a (0.5) = 0.3, raw sRGB.
    expect(color.getW(0)).toBeCloseTo(0.6 * 0.5, 4);
  });

  it('title_text_overrun_behavior trims the title to the space left of the icon (foldable_container.cpp:307-313)', async () => {
    const narrow: Rect2 = { x: 0, y: 0, w: 40, h: 28 };
    const untrimmed = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={solveNode({ folded: true, title: 'AAAAAAAAAAAA' })} rect={narrow} renderOrder={0} />
    );
    const trimmed = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'AAAAAAAAAAAA', titleTextOverrunBehavior: 1 })}
        rect={narrow}
        renderOrder={0}
      />
    );
    const quadCount = (r: Rendered) => findTextMeshes(r.scene)[0]!.geometry.attributes.position!.count / 4;
    expect(quadCount(trimmed)).toBeLessThan(quadCount(untrimmed));
  });
});
