/**
 * `<FoldableContainer>` draws the title bar, the arrow and the title text, and the
 * content panel only when not folded. The tests assert structure and tint, not pixels.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { FoldableContainerProperties } from './types';
import { FoldableContainer } from './Component';
import { defaultThemeAt } from '../../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from '../../../../r3f/controls/native/defaultThemeRecords';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import {
  bundledRunMeshes,
  bundledRuns,
  inkedGlyphCount,
} from '../../../../r3f/controls/native/testing/bundledRunStub';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const RECT: Rect2 = { x: 0, y: 0, w: 120, h: 80 };

function solveNode(properties: Partial<FoldableContainerProperties> = {}): SolveNode {
  const node: TscnNode = controlNode('MyFoldableContainer', 'FoldableContainer', {
    name: 'MyFoldableContainer',
    ...properties,
  });
  return withThemeItems({ ...emptySolveNode(), path: 'MyFoldableContainer', node });
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>`/icon `<ControlQuad>` do not. */
function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** `<ControlQuad>` (the arrow icon) is a `PlaneGeometry`, identified by its own `.parameters.width`. */
function findIconMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter(
      (m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined
    );
}

describe('<FoldableContainer> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('folded draws the title bar chrome + arrow, but NO content panel', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'Inventory' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    // One title StyleBox, no content panel StyleBox.
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
    expect(findIconMeshes(renderer.scene)).toHaveLength(1);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(1);
  });

  it('unfolded draws the title bar chrome AND the content panel chrome', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: false, title: 'Inventory' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws no text mesh when the title is empty, but still draws the arrow', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: false })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
    expect(findIconMeshes(renderer.scene)).toHaveLength(1);
  });

  it('uses control_font_color for the UNFOLDED title, control_font_pressed_color (white) once folded', async () => {
    const expanded = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: false, title: 'A' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const expandedTint = bundledRuns(expanded.scene)[0]!.tint;
    // control_font_color = 0.875 sRGB, decoded to linear inside the shader uniform.
    expect(expandedTint.r).toBeLessThan(0.9);

    const folded = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'A' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const foldedTint = bundledRuns(folded.scene)[0]!.tint;
    // control_font_pressed_color = Color(1, 1, 1): linear 1 exactly.
    expect(foldedTint.r).toBeCloseTo(1, 5);
  });

  it('shifts the title text right for title_alignment CENTER/RIGHT, within the space left of the icon', async () => {
    // rect.w=120, margin=4 each side, arrow=16, h_separation=2, 'A' shaped
    // width=11 (ceil(1354*16/2048)): title_text_width = 120-8-16-2 = 94,
    // extraSpace = 94-11 = 83.
    const left = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'A', titleAlignment: 0 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const leftMesh = bundledRunMeshes(left.scene)[0]!;
    expect((leftMesh.parent as THREE.Object3D).position.x).toBe(4 + 16 + 2);

    const center = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'A', titleAlignment: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const centerMesh = bundledRunMeshes(center.scene)[0]!;
    expect((centerMesh.parent as THREE.Object3D).position.x).toBe(4 + 16 + 2 + Math.floor(83 / 2));

    const right = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'A', titleAlignment: 2 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const rightMesh = bundledRunMeshes(right.scene)[0]!;
    expect((rightMesh.parent as THREE.Object3D).position.x).toBe(4 + 16 + 2 + 83);
  });

  it('under RTL puts the arrow at the trailing edge and the text at the leading margin (foldable_container.cpp:293-300)', async () => {
    // `icon_pos.x = size.width - title_style->get_margin(SIDE_RIGHT) - icon->get_width()`
    // and `title_text_pos.x += title_controls_width`, which is 0 because `title_controls`
    // is never serialised. That leaves the style's left margin.
    const rtlNode = { ...solveNode({ folded: true, title: 'A', titleAlignment: 2 }), rtl: true };
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer {...painterEnv()} solveNode={rtlNode} rect={RECT} renderOrder={0} />
    );
    const icon = findIconMeshes(renderer.scene)[0]!;
    expect((icon.parent as THREE.Object3D).position.x).toBe(120 - 4 - 16);
    // title_alignment RIGHT becomes LEFT under RTL, so no alignment shift.
    const text = bundledRunMeshes(renderer.scene)[0]!;
    expect((text.parent as THREE.Object3D).position.x).toBe(4);
  });

  it('swaps the title alignment LEFT/RIGHT under RTL, leaving CENTER alone (foldable_container.cpp:503-511)', async () => {
    // `_get_actual_alignment`. extraSpace = 94 - 11 = 83 as above.
    const alignmentX = async (titleAlignment: number) => {
      const n = { ...solveNode({ folded: true, title: 'A', titleAlignment }), rtl: true };
      const r = await ReactThreeTestRenderer.create(
        <FoldableContainer {...painterEnv()} solveNode={n} rect={RECT} renderOrder={0} />
      );
      return (bundledRunMeshes(r.scene)[0]!.parent as THREE.Object3D).position.x;
    };
    expect(await alignmentX(0)).toBe(4 + 83); // LEFT -> RIGHT
    expect(await alignmentX(1)).toBe(4 + Math.floor(83 / 2)); // CENTER unchanged
    expect(await alignmentX(2)).toBe(4); // RIGHT -> LEFT
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
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'AAAAAAAAAAAA' })}
        rect={narrow}
        renderOrder={0}
      />
    );
    const trimmed = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'AAAAAAAAAAAA', titleTextOverrunBehavior: 1 })}
        rect={narrow}
        renderOrder={0}
      />
    );
    const inkedTitleGlyphs = (r: Rendered) => inkedGlyphCount(bundledRuns(r.scene)[0]!);
    expect(inkedTitleGlyphs(trimmed)).toBeLessThan(inkedTitleGlyphs(untrimmed));
  });

  // Godot draws the title as one `TextLine`, so a trimmed title with a line break draws its first line.
  it('draws the first line only of a trimmed title with a line break', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: true, title: 'AB\nCD', titleTextOverrunBehavior: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(inkedGlyphCount(bundledRuns(renderer.scene)[0]!)).toBe(2);
  });
});

describe('<FoldableContainer> chrome placement', () => {
  /** World Y of a mesh, in three space (Godot Y-down is negated by the painter). */
  function worldY(scene: Rendered['scene'], mesh: THREE.Mesh) {
    scene.instance.updateMatrixWorld(true);
    return mesh.getWorldPosition(new THREE.Vector3()).y;
  }

  async function renderChrome(titlePosition: number) {
    return ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: false, title: 'A', titlePosition })}
        rect={RECT}
        renderOrder={0}
      />
    );
  }

  /** `value` to 1/1000 px, with no negative zero. */
  function roundMilli(value: number): number {
    return Math.round(value * 1000) / 1000 + 0;
  }

  /** The world Y of every vertex of `mesh`, rounded to 1/1000 px and sorted. */
  function worldVertexYs(scene: Rendered['scene'], mesh: THREE.Mesh): number[] {
    scene.instance.updateMatrixWorld(true);
    const position = (mesh.geometry as THREE.BufferGeometry).attributes.position!;
    const v = new THREE.Vector3();
    const ys: number[] = [];
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      ys.push(roundMilli(v.y));
    }
    return ys.sort((a, b) => a - b);
  }

  /** The world Y span of `mesh`'s style rect, its anti-aliased feather left out. */
  function worldYSpan(scene: Rendered['scene'], mesh: THREE.Mesh): { top: number; bottom: number } {
    scene.instance.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    return { top: Math.floor(box.max.y), bottom: Math.ceil(box.min.y) };
  }

  it('draws the content panel BELOW the title bar, not over it (foldable_container.cpp:317-321)', async () => {
    // `Rect2 panel_rect(Point2(0, title_minimum_size.height), ...)`: the panel starts where
    // the title bar ends. `StyleBoxQuad` takes only a size, so the group supplies the offset.
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={solveNode({ folded: false, title: 'A' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const [titleChrome, panelChrome] = findChromeMeshes(renderer.scene);
    // title bar height = content margin 8 + max(font height 23, arrow 16) = 31.
    expect(worldY(renderer.scene, titleChrome!)).toBe(0);
    expect(worldY(renderer.scene, panelChrome!)).toBe(-31);
  });

  it('draws the title bar at the BOTTOM edge for title_position BOTTOM (foldable_container.cpp:437-439)', async () => {
    // `Rect2(0, (title_position == POSITION_TOP) ? 0 : get_size().height -
    // title_minimum_size.height, ...)`; RECT.h is 80, so the title spans 49 to 80.
    const renderer = await renderChrome(1);
    const [titleChrome, panelChrome] = findChromeMeshes(renderer.scene);
    expect(worldYSpan(renderer.scene, titleChrome!)).toEqual({ top: -49, bottom: -80 });
    expect(worldYSpan(renderer.scene, panelChrome!)).toEqual({ top: 0, bottom: -49 });
  });

  it('places the bottom title from the box margin on its outer, bottom edge (foldable_container.cpp:286)', async () => {
    const tablePanel = defaultStyleBoxesOf(defaultThemeAt(1)).FoldableContainer!.title_panel!;
    const lopsided = { ...tablePanel, contentMargin: { left: 4, top: 2, right: 4, bottom: 10 } };
    const node = solveNode({ folded: false, title: 'A', titlePosition: 1 });
    const renderer = await ReactThreeTestRenderer.create(
      <FoldableContainer
        {...painterEnv()}
        solveNode={{ ...node, styleBoxes: { ...node.styleBoxes, title_panel: lopsided } }}
        rect={RECT}
        renderOrder={0}
      />
    );
    // The title is 12 + 23 = 35 tall from y 45. The 16 px arrow centres in the 23 px row, 3.5 px
    // down, below the bottom margin 10: its top is at 58.5 and its centre at 66.5.
    const [arrow] = findIconMeshes(renderer.scene);
    expect(worldY(renderer.scene, arrow!)).toBe(-66.5);
  });

  it('mirrors each box for title_position BOTTOM, so the rounded corners face away from the panel (foldable_container.cpp:523-532)', async () => {
    const top = await renderChrome(0);
    const bottom = await renderChrome(1);
    const [topTitle, topPanel] = findChromeMeshes(top.scene);
    const [bottomTitle, bottomPanel] = findChromeMeshes(bottom.scene);
    // The top title spans 0 to -31 and the panel -31 to -80, so the mirror is y -> -80 - y.
    const mirrored = (ys: number[]) => ys.map((y) => roundMilli(-80 - y)).sort((a, b) => a - b);
    expect(worldVertexYs(bottom.scene, bottomTitle!)).toEqual(mirrored(worldVertexYs(top.scene, topTitle!)));
    expect(worldVertexYs(bottom.scene, bottomPanel!)).toEqual(mirrored(worldVertexYs(top.scene, topPanel!)));
  });
});
