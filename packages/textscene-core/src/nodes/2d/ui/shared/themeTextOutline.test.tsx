/**
 * The theme text outline of the Controls that draw a text buffer's outline under its fill:
 * Button, CheckBox, CheckButton, OptionButton and MenuButton (`button.cpp:458-462`), LinkButton
 * (`link_button.cpp:294-301`), the FoldableContainer title (`foldable_container.cpp:310-312`) and
 * ItemList items (`item_list.cpp:1642-1644`). `<TextRunMesh>` is stubbed to read the props each
 * painter hands it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ComponentType } from 'react';
import type { TscnNode } from '../../../../parser/types';
import type { Rgba } from '../../../../godot/math/math';
import type { Rect2 } from '../../../../godot/math/rect2';
import { OverrunBehavior } from '../../../../godot/text/textServerEnums';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import { TRIANGLE_OUTLINES } from '../../../../r3f/controls/native/testing/triangleOutlines';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import { outlineStrokeWidthPx } from '../../../../r3f/controls/native/text/textOutline';
import { Button } from '../button/Component';
import { CheckBox } from '../checkbox/Component';
import { CheckButton } from '../checkbutton/Component';
import { MenuButton } from '../menubutton/Component';
import { OptionButton } from '../optionbutton/Component';
import { LinkButton } from '../linkbutton/Component';
import { FoldableContainer } from '../foldablecontainer/Component';
import { ItemList } from '../itemlist/Component';

interface RunProps {
  layout: { fontMetrics: { kind: string }; lines: Array<{ glyphs: Array<{ char: string }> }> };
  tint: Rgba;
  strokeWidthPx?: number;
  renderOrder?: number;
}

/** The props of each mounted run, by mount: a second render of one run replaces its entry. */
const scene = vi.hoisted(() => ({ runs: new Map<object, RunProps>() }));

vi.mock('../../../../r3f/controls/native/text/TextRunMesh', async () => {
  const { useLayoutEffect, useState } = await import('react');
  return {
    TextRunMesh: (props: RunProps) => {
      const [key] = useState(() => ({}));
      scene.runs.set(key, props);
      useLayoutEffect(() => () => void scene.runs.delete(key), [key]);
      return null;
    },
  };
});

// The bundled canvas face settles at once, with no font to decode.
vi.mock('../../../../r3f/controls/native/text/sceneFontOutlines', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  peekOutlines: () => TRIANGLE_OUTLINES,
}));

const RECT = { x: 0, y: 0, w: 160, h: 40 };
const RED: Rgba = { r: 1, g: 0, b: 0, a: 1 };
const OUTLINE_SIZE = 8;

const CONTROLS: ReadonlyArray<readonly [string, ComponentType<NativeControlComponentProps>]> = [
  ['Button', Button],
  ['CheckBox', CheckBox],
  ['CheckButton', CheckButton],
  ['OptionButton', OptionButton],
  ['MenuButton', MenuButton],
  ['LinkButton', LinkButton],
  ['FoldableContainer', FoldableContainer],
  ['ItemList', ItemList],
];

function outlined(
  type: string,
  colors: SolveNode['colors'],
  constants: SolveNode['constants'],
  text = 'Hi',
  properties: Record<string, unknown> = {}
): SolveNode {
  // OptionButton and ItemList draw their items' text, FoldableContainer its title.
  const textProperties = { name: 'N', text, title: text, items: [{ text }], selected: 0 };
  const node: TscnNode = controlNode('N', type, { ...textProperties, ...properties });
  return { ...emptySolveNode(), path: 'N', node, colors, constants };
}

async function render(
  Control: ComponentType<NativeControlComponentProps>,
  solveNode: SolveNode,
  rect: Rect2 = RECT
) {
  scene.runs.clear();
  await ReactThreeTestRenderer.create(
    <Control {...painterEnv()} solveNode={solveNode} rect={rect} renderOrder={0} />
  );
}

const mountedRuns = () => [...scene.runs.values()];
const strokeRuns = () => mountedRuns().filter((run) => run.strokeWidthPx);
const fillRun = () =>
  mountedRuns()
    .filter((run) => !run.strokeWidthPx)
    .at(-1)!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(CONTROLS)('<%s> theme text outline', (type, Control) => {
  describe('on a scene font', () => {
    beforeEach(() => {
      vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    });

    it('strokes a ring below the fill', async () => {
      await render(Control, outlined(type, { font_outline_color: RED }, { outline_size: OUTLINE_SIZE }));

      expect(strokeRuns()).toHaveLength(1);
      expect(strokeRuns()[0]!.strokeWidthPx).toBe(outlineStrokeWidthPx(OUTLINE_SIZE));
      expect(strokeRuns()[0]!.renderOrder).toBeLessThan(fillRun().renderOrder!);
    });

    it('draws no ring at outline_size 0', async () => {
      await render(Control, outlined(type, { font_outline_color: RED }, { outline_size: 0 }));

      expect(strokeRuns()).toHaveLength(0);
    });

    it('draws no ring at a zero alpha', async () => {
      await render(
        Control,
        outlined(type, { font_outline_color: { ...RED, a: 0 } }, { outline_size: OUTLINE_SIZE })
      );

      expect(strokeRuns()).toHaveLength(0);
    });

    it('draws no ring by default', async () => {
      await render(Control, outlined(type, {}, {}));

      expect(strokeRuns()).toHaveLength(0);
    });
  });

  describe('on the bundled font', () => {
    it('strokes the ring and fills the text on the canvas face, as FreeType draws both', async () => {
      await render(Control, outlined(type, { font_outline_color: RED }, { outline_size: OUTLINE_SIZE }));

      await vi.waitFor(() => expect(fillRun().layout.fontMetrics.kind).toBe('canvas'));
      expect(strokeRuns()).toHaveLength(1);
      expect(strokeRuns()[0]!.strokeWidthPx).toBe(outlineStrokeWidthPx(OUTLINE_SIZE));
      expect(strokeRuns()[0]!.layout.fontMetrics.kind).toBe('canvas');
      expect(strokeRuns()[0]!.renderOrder).toBeLessThan(fillRun().renderOrder!);
    });

    it('draws no ring at outline_size 0', async () => {
      await render(Control, outlined(type, { font_outline_color: RED }, { outline_size: 0 }));

      expect(strokeRuns()).toHaveLength(0);
    });
  });
});

/** Twelve Hebrew letters: an AUTO paragraph that resolves right-to-left, 96 px at 8 px a letter. */
const HEBREW = 'אבגדהוזחטיכל';

/** Each trimming Control, with the properties and rect that trim `HEBREW` with an ellipsis. */
const TRIMMED: ReadonlyArray<
  readonly [string, ComponentType<NativeControlComponentProps>, Record<string, unknown>, Rect2]
> = [
  ['Button', Button, { overrunBehavior: OverrunBehavior.OVERRUN_TRIM_ELLIPSIS }, { ...RECT, w: 80 }],
  ['LinkButton', LinkButton, { overrunBehavior: OverrunBehavior.OVERRUN_TRIM_ELLIPSIS }, { ...RECT, w: 64 }],
  [
    'FoldableContainer',
    FoldableContainer,
    { titleTextOverrunBehavior: OverrunBehavior.OVERRUN_TRIM_ELLIPSIS },
    { ...RECT, w: 96 },
  ],
  ['ItemList', ItemList, { fixedColumnWidth: 64 }, RECT],
];

const drawnChars = (run: RunProps) => run.layout.lines[0]!.glyphs.map((glyph) => glyph.char).join('');

describe.each(TRIMMED)(
  '<%s> outline of a trimmed AUTO right-to-left line',
  (type, Control, properties, rect) => {
    beforeEach(() => {
      vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    });

    const renderTrimmed = () =>
      render(
        Control,
        outlined(type, { font_outline_color: RED }, { outline_size: OUTLINE_SIZE }, HEBREW, properties),
        rect
      );

    // text_server.cpp:1840 reads the inferred direction for the ring.
    it('strokes the ring by the inferred direction, the ellipsis first', async () => {
      await renderTrimmed();
      expect(drawnChars(strokeRuns()[0]!).startsWith('…')).toBe(true);
    });

    // text_server.cpp:1744 reads the set AUTO direction for the fill.
    it('fills from the visual left', async () => {
      await renderTrimmed();
      expect(drawnChars(fillRun()).startsWith('ל')).toBe(true);
    });
  }
);

describe('<FoldableContainer> outline colour', () => {
  beforeEach(() => {
    vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
  });

  // default_theme.cpp:1327 gives FoldableContainer a white outline, every other type black.
  it('strokes a white ring when only outline_size is set', async () => {
    await render(FoldableContainer, outlined('FoldableContainer', {}, { outline_size: OUTLINE_SIZE }));

    expect(strokeRuns()[0]!.tint).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});
