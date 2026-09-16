/**
 * `<TextEdit>` render contract — chrome, per-row text, `highlight_current_line`,
 * `draw_tabs`/`draw_spaces` glyph icons. Structure/tint/clip assertions only;
 * pixels are `pnpm ref:godot`'s job.
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextEdit } from './Component';
import type { TextEditProperties } from './types';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 100 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(
  properties: Partial<TextEditProperties> = {},
  internalResources: readonly TscnInternalResource[] = []
): SolveNode {
  const node: TscnNode = {
    name: 'MyTextEdit',
    type: 'TextEdit',
    children: [],
    properties: { name: 'MyTextEdit', ...properties } as TextEditProperties,
  };
  return {
    ...emptySolveNode(),
    path: 'MyTextEdit',
    node,
    resources: { externalResources: [], internalResources },
  };
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; text/icon quads do not. */
function findChromeMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

function findFillColor(mesh: THREE.Mesh): { r: number; g: number; b: number; a: number } {
  const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < color.count; i++) {
    if (color.getX(i) > 0.0001) {
      return { r: color.getX(i), g: color.getY(i), b: color.getZ(i), a: color.getW(i) };
    }
  }
  throw new Error('no fill vertex found in chrome mesh');
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms). */
function findTextMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/** A plain `<ControlQuad>` (highlight rect or a tab/space icon) — `MeshBasicMaterial`, no `color` vertex attribute, no MSDF uniforms. */
function findPlainQuads(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter(
      (m) =>
        (m.geometry as THREE.BufferGeometry).attributes.color === undefined &&
        !(m.material as THREE.ShaderMaterial).uniforms?.uColor
    );
}

describe('<TextEdit> — chrome', () => {
  afterEach(() => controlSolverRegistry.clear());

  it('draws the default-theme "normal" StyleBox (shared with LineEdit) while editable', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const fill = findFillColor(findChromeMesh(renderer.scene)!);
    expect(fill.r).toBeCloseTo(0.1, 5);
    expect(fill.a).toBeCloseTo(0.6, 5);
  });

  it('switches to the "read_only" StyleBox once editable=false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ editable: false })} rect={RECT} renderOrder={0} />
    );
    const fill = findFillColor(findChromeMesh(renderer.scene)!);
    expect(fill.a).toBeCloseTo(0.3, 5);
  });
});

describe('<TextEdit> — per-line text', () => {
  it('draws one TextRun mesh per buffer line when unwrapped (wrap_mode NONE)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: 'a\nb\nc' })} rect={RECT} renderOrder={0} />
    );
    expect(findTextMeshes(renderer.scene)).toHaveLength(3);
  });

  it('still advances one full row for a blank buffer line — a blank line is not zero rows', async () => {
    const withBlank = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: 'a\n\nc' })} rect={RECT} renderOrder={0} />
    );
    const withoutBlank = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: 'a\nc' })} rect={RECT} renderOrder={0} />
    );
    // Every buffer line — including the empty one — draws its own TextRun mesh,
    // so a collapsed blank line would be indistinguishable from a real one by
    // count alone; the row Y offsets are what prove the blank line still ate a
    // whole row of vertical space.
    expect(findTextMeshes(withBlank.scene)).toHaveLength(3);
    const yOffsets = (scene: Rendered['scene']) =>
      scene
        .findAllByType('Group')
        .map((g) => g.instance)
        .filter((g) => g.children.some((c) => ((c as THREE.Mesh).material as THREE.ShaderMaterial)?.uniforms?.uColor))
        .map((g) => g.position.y)
        .sort((a, b) => b - a);
    const blankRows = yOffsets(withBlank.scene);
    const denseRows = yOffsets(withoutBlank.scene);
    // three's Y is negated Godot px: row 2 ('c' after the blank line) sits a
    // whole row FURTHER down than row 1 ('c' with no blank line before it).
    expect(blankRows[2]).toBeLessThan(denseRows[1]!);
  });

  it('wraps one long line into multiple rows once wrap_mode is BOUNDARY(1)', async () => {
    const longText = 'a repeated word wrap word wrap word wrap word wrap word wrap';
    const off = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: longText })} rect={RECT} renderOrder={0} />
    );
    const wrapped = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: longText, wrapMode: 1 })} rect={RECT} renderOrder={0} />
    );
    expect(findTextMeshes(off.scene)).toHaveLength(1);
    expect(findTextMeshes(wrapped.scene).length).toBeGreaterThan(1);
  });

  it('forwards renderOrder to the chrome mesh and every text mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: 'a\nb' })} rect={RECT} renderOrder={9} />
    );
    expect(findChromeMesh(renderer.scene)!.renderOrder).toBe(9);
    for (const mesh of findTextMeshes(renderer.scene)) expect(mesh.renderOrder).toBe(9);
  });
});

describe('<TextEdit> — highlight_current_line', () => {
  it('draws no highlight rect when highlight_current_line is unset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: 'a' })} rect={RECT} renderOrder={0} />
    );
    expect(findPlainQuads(renderer.scene)).toHaveLength(0);
  });

  it('draws exactly one highlight rect, at the top-left of the widget (row 0, caret is always there)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'a\nb', highlightCurrentLine: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const quads = findPlainQuads(renderer.scene);
    expect(quads).toHaveLength(1);
  });
});

describe('<TextEdit> — draw_tabs / draw_spaces', () => {
  it('draws one icon quad per tab character when draw_tabs is set', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'a\tb\tc', drawTabs: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findPlainQuads(renderer.scene)).toHaveLength(2);
  });

  it('draws NO icon quads when draw_tabs/draw_spaces are both unset, even with tabs and spaces present', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: 'a\tb c' })} rect={RECT} renderOrder={0} />
    );
    expect(findPlainQuads(renderer.scene)).toHaveLength(0);
  });

  it('draws one icon quad per space character when draw_spaces is set', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'a b c', drawSpaces: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findPlainQuads(renderer.scene)).toHaveLength(2);
  });
});

describe('<TextEdit> — tint composition', () => {
  it('applies the walker-composed tint to the chrome fill', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode({})}
        rect={RECT}
        renderOrder={0}
      />
    );
    const fill = findFillColor(findChromeMesh(renderer.scene)!);
    // style_normal_color(0.1) * tint(0.5) = 0.05, in sRGB.
    expect(fill.r).toBeCloseTo(0.05, 4);
  });
});

describe('<TextEdit> — clipping', () => {
  it("clips its text to the WHOLE node rect (unlike LineEdit's content-rect-only clip)", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: 'a' })} rect={RECT} renderOrder={0} />
    );
    const material = findTextMeshes(renderer.scene)[0]!.material as THREE.ShaderMaterial & {
      clippingPlanes?: THREE.Plane[];
    };
    const planes = material.clippingPlanes!;
    expect(planes.length).toBeGreaterThanOrEqual(4);
    const insideWholeRectButPastLineEditContentMargin = new THREE.Vector3(RECT.w - 1, -1, 0);
    expect(planes.every((p) => p.distanceToPoint(insideWholeRectButPastLineEditContentMargin) >= 0)).toBe(true);
  });
});

describe('<TextEdit> — syntax_highlighter', () => {
  const CODE_HIGHLIGHTER: TscnInternalResource = {
    id: 'CH',
    type: 'CodeHighlighter',
    data: { keyword_colors: '{\n"if": Color(1, 0, 0, 1)\n}' },
  };

  it('splits a keyword-containing line into one TextRun mesh per colour run', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'if x', syntaxHighlighter: 'SubResource("CH")' }, [CODE_HIGHLIGHTER])}
        rect={RECT}
        renderOrder={0}
      />
    );
    // "if" (keyword_color) / " " (a space is `is_symbol`, so `symbol_color`) /
    // "x" (plain `font_color`) — three colour changes, syntax_highlighter.cpp:391-401.
    const meshes = findTextMeshes(renderer.scene);
    expect(meshes).toHaveLength(3);
    const colors = meshes.map(
      (m) => (m.material as THREE.ShaderMaterial).uniforms.uColor!.value as THREE.Vector3
    );
    expect(colors[0]!.x).not.toBeCloseTo(colors[2]!.x, 2);
  });

  it('paints one plain-font_color run per row when no syntax_highlighter is set', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit {...painterEnv()} solveNode={solveNode({ text: 'if x' })} rect={RECT} renderOrder={0} />
    );
    expect(findTextMeshes(renderer.scene)).toHaveLength(1);
  });

  it('tints a drawn tab/space icon with the SAME per-glyph colour as the text, not a fixed font_color (text_edit.cpp:1674,1714)', async () => {
    // A tab is `is_symbol` too, so it colours via `symbol_color` (left at its
    // near-black default here) rather than inheriting the preceding keyword's.
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'if\tx', drawTabs: true, syntaxHighlighter: 'SubResource("CH")' }, [
          CODE_HIGHLIGHTER,
        ])}
        rect={RECT}
        renderOrder={0}
      />
    );
    const tabIcon = findPlainQuads(renderer.scene)[0]!;
    expect((tabIcon.material as THREE.MeshBasicMaterial).color.r).toBeLessThan(0.05);
  });

  it('ignores an unresolvable syntax_highlighter ref and falls back to one plain run', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'if x', syntaxHighlighter: 'SubResource("missing")' }, [])}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findTextMeshes(renderer.scene)).toHaveLength(1);
  });
});
