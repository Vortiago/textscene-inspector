/**
 * `<CodeEdit>` render contract: `<TextEditBody>` for chrome and text, plus the line-number
 * gutter. Structure only. Pixels belong to `pnpm ref:godot`.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { CodeEdit } from './Component';
import { countTintSplit, splitTints } from '../../../../r3f/controls/native/testing/tintSplit';
import type { CodeEditProperties } from './types';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import {
  bundledRunOf,
  bundledRunMeshes,
  bundledRuns,
} from '../../../../r3f/controls/native/testing/bundledRunStub';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

// A fold icon is a loaded texture. A stand-in texture lets the painter draw the arrows.
vi.mock('../../../../r3f/controls/native/useIconTexture', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNodeIcon: (_override: unknown, fallback: unknown) => (fallback === null ? null : new THREE.Texture()),
}));

const RECT: Rect2 = { x: 0, y: 0, w: 300, h: 100 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<CodeEditProperties> = {}): SolveNode {
  const node: TscnNode = controlNode('MyCodeEdit', 'CodeEdit', { name: 'MyCodeEdit', ...properties });
  return withThemeItems({ ...emptySolveNode(), path: 'MyCodeEdit', node });
}

/** The chrome `<TextEditBody>` draws: a `<StyleBoxQuad>` mesh with a `color` vertex attribute. */
function findChromeMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

describe('<CodeEdit> — reuses TextEditBody for chrome and text', () => {
  it('draws the shared chrome StyleBox', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMesh(renderer.scene)).toBeDefined();
  });

  it('draws one TextRun mesh per buffer line, exactly like TextEdit', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit {...painterEnv()} solveNode={solveNode({ text: 'a\nb' })} rect={RECT} renderOrder={0} />
    );
    // 2 buffer-line TextRuns. The gutter is off by default, so no line-number meshes.
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws an empty buffer as its placeholder at font_placeholder_color, as TextEdit does', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({ placeholderText: 'Code' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const tint = bundledRuns(renderer.scene)[0]!.tint;
    expect(tint.a).toBeCloseTo(0.6, 5);
  });
});

describe('<CodeEdit> — line-number gutter', () => {
  it('draws no line-number meshes when gutters_draw_line_numbers is unset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit {...painterEnv()} solveNode={solveNode({ text: 'a\nb\nc' })} rect={RECT} renderOrder={0} />
    );
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(3);
  });

  it('draws one extra TextRun mesh per buffer line once gutters_draw_line_numbers is set', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'a\nb\nc', gutterDrawLineNumbers: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    // 3 body TextRuns + 3 line-number TextRuns.
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(6);
  });

  it('shifts the body text right by the gutter band width once any gutter draws', async () => {
    // The main gutter's width (`get_line_height()`) does not depend on `measureText`,
    // unlike the line-number gutter's, so this isolates the shift from it.
    const withoutGutter = await ReactThreeTestRenderer.create(
      <CodeEdit {...painterEnv()} solveNode={solveNode({ text: 'a' })} rect={RECT} renderOrder={0} />
    );
    const withGutter = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'a', gutterDrawBookmarks: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    // The body text's group sits at the largest x among the text-bearing groups:
    // the line-number gutter, when present, starts to its left.
    const bodyGroupX = (scene: Rendered['scene']) =>
      Math.max(
        ...scene
          .findAllByType('Group')
          .map((g) => g.instance)
          .filter((g) => g.children.some((child) => bundledRunOf(child) !== undefined))
          .map((g) => g.position.x)
      );
    expect(bodyGroupX(withGutter.scene)).toBeGreaterThan(bodyGroupX(withoutGutter.scene));
  });

  it('shapes its own line numbers at the SAME wrap width TextEditBody uses, so a wrapped first line pushes the second line-number down by more than one row', async () => {
    const longLine = 'a repeated word wrap word wrap word wrap word wrap word wrap word wrap';
    const unwrapped = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({ text: `${longLine}\nb`, gutterDrawLineNumbers: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const wrapped = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({ text: `${longLine}\nb`, gutterDrawLineNumbers: true, wrapMode: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    // The line-number groups sit at the smallest x among the text-bearing groups,
    // left of the shifted body text. The deepest (most negative y) is buffer line 2's.
    const deepestLineNumberY = (scene: Rendered['scene']) => {
      const textGroups = scene
        .findAllByType('Group')
        .map((g) => g.instance)
        .filter((g) => g.children.some((child) => bundledRunOf(child) !== undefined));
      const minX = Math.min(...textGroups.map((g) => g.position.x));
      return Math.min(...textGroups.filter((g) => g.position.x === minX).map((g) => g.position.y));
    };
    expect(deepestLineNumberY(wrapped.scene)).toBeLessThan(deepestLineNumberY(unwrapped.scene));
  });
});

describe('<CodeEdit> — indent_size (text_edit.cpp:349-351)', () => {
  it('a wider indent_size widens every tab stop, wrapping a tab-heavy line into MORE rows at the same width', async () => {
    const tabs = '\t'.repeat(10);
    const narrow = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({ text: tabs, wrapMode: 1, indentSize: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const wide = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({ text: tabs, wrapMode: 1, indentSize: 16 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(bundledRunMeshes(wide.scene).length).toBeGreaterThan(bundledRunMeshes(narrow.scene).length);
  });
});

/** Every `<StyleBoxQuad>` mesh: the panel, and a track and a grabber for each scroll bar. */
function chromeMeshCount(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined).length;
}

const PANEL_MESHES = 1;
const BAR_MESHES = 2;
const SIX_LINES = 'one\ntwo\nthree\nfour\nfive\nsix';

describe('<CodeEdit> — scroll bars (text_edit.cpp:8587-8656)', () => {
  it('draws one vertical bar, a track and a grabber, for six rows in 100 px', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit {...painterEnv()} solveNode={solveNode({ text: SIX_LINES })} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshCount(renderer.scene)).toBe(PANEL_MESHES + BAR_MESHES);
  });

  it('draws no bar for two rows', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit {...painterEnv()} solveNode={solveNode({ text: 'one\ntwo' })} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshCount(renderer.scene)).toBe(PANEL_MESHES);
  });

  it('draws no bar under scroll_fit_content_height', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({ text: SIX_LINES, fitContentHeight: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(chromeMeshCount(renderer.scene)).toBe(PANEL_MESHES);
  });
});

describe('<CodeEdit> — self_modulate', () => {
  it('tints the box with tint and the text and the line numbers with childTint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        {...splitTints}
        solveNode={solveNode({ text: 'a\nb', gutters_draw_line_numbers: true } as never)}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(countTintSplit(renderer.scene)).toEqual({ own: 1, child: 2 });
  });
});

describe('<CodeEdit> — fold gutter', () => {
  it('clips the fold arrows to the node rect, as `text_ci` clips every gutter (text_edit.cpp:934)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CodeEdit
        {...painterEnv()}
        solveNode={solveNode({
          text: 'if a:\n\tb',
          gutterDrawFoldGutter: true,
          lineFolding: true,
        })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const arrows = renderer.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .filter((m) => (m.material as THREE.MeshBasicMaterial).map instanceof THREE.Texture);
    expect(arrows).toHaveLength(1);
    expect((arrows[0]!.material as THREE.Material).clippingPlanes?.length).toBeGreaterThanOrEqual(4);
  });
});
