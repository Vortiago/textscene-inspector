/**
 * `wrap_controls`: an embedded window grows to hold its Controls (`window.cpp:1629-1632`).
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../r3f/controls/native/testing/solveNode';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { heading } from '../../../parser/testing/parserKit';
import '../../../r3f/controls/index';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import { parseDialog } from '../acceptdialog/parser';
import { parseConfirmationDialog } from '../confirmationdialog/parser';
import { parseWindow } from './parser';
import { wrappedWindowSize } from './wrapControls';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };

function windowNode(type: string, properties: Record<string, string>, children: SolveNode[]): SolveNode {
  const node = {
    name: 'Dialog',
    type,
    children: [],
    properties: parseWindow(heading(type, { name: 'Dialog' }), properties),
  };
  return withThemeItems({ ...solveNode(), path: 'Dialog', node: node as unknown as TscnNode, children });
}

/** A Control at (x, y) with a custom minimum size, its own anchors at the top-left. */
function placed(x: number, y: number, minimum: { x: number; y: number }): SolveNode {
  const node = controlNode('Box', 'Control', {
    name: 'Box',
    offsetLeft: x,
    offsetTop: y,
    offsetRight: x,
    offsetBottom: y,
    customMinimumSize: minimum,
  });
  return { ...solveNode(), path: 'Dialog/Box', node };
}

describe('wrappedWindowSize', () => {
  it('grows a wrapping window to its furthest Control corner', () => {
    const window = windowNode('Window', { size: 'Vector2i(100, 100)', wrap_controls: 'true' }, [
      placed(20, 30, { x: 400, y: 280 }),
    ]);
    expect(wrappedWindowSize(window, THEME, null, EMBEDDER)).toEqual({ x: 420, y: 310 });
  });

  it('keeps the loaded size when it already holds the Controls', () => {
    const window = windowNode('Window', { size: 'Vector2i(500, 400)', wrap_controls: 'true' }, [
      placed(20, 30, { x: 400, y: 280 }),
    ]);
    expect(wrappedWindowSize(window, THEME, null, EMBEDDER)).toEqual({ x: 500, y: 400 });
  });

  it('scales the Controls by the content scale factor before it wraps', () => {
    const window = windowNode(
      'Window',
      { size: 'Vector2i(100, 100)', wrap_controls: 'true', content_scale_factor: '2.0' },
      [placed(20, 30, { x: 100, y: 80 })]
    );
    expect(wrappedWindowSize(window, THEME, null, EMBEDDER)).toEqual({ x: 240, y: 220 });
  });

  it('scales by the factor an integer stretch floors (`window.cpp:1240-1249`)', () => {
    const window = windowNode(
      'Window',
      {
        size: 'Vector2i(100, 100)',
        wrap_controls: 'true',
        content_scale_stretch: '1',
        content_scale_factor: '2.5',
      },
      [placed(20, 30, { x: 100, y: 80 })]
    );
    expect(wrappedWindowSize(window, THEME, null, EMBEDDER)).toEqual({ x: 240, y: 220 });
  });

  it('ignores the Controls of a window that does not wrap', () => {
    const window = windowNode('Window', { size: 'Vector2i(100, 100)' }, [placed(20, 30, { x: 400, y: 280 })]);
    expect(wrappedWindowSize(window, THEME, null, EMBEDDER)).toEqual({ x: 100, y: 100 });
  });

  it('wraps a PopupPanel, which wraps by default, around its panel', () => {
    const popup = windowNode('PopupPanel', { size: 'Vector2i(10, 10)' }, [placed(0, 0, { x: 200, y: 100 })]);
    expect(wrappedWindowSize(popup, THEME, null, EMBEDDER)).toEqual({ x: 208, y: 108 });
  });
});

const LONG_TEXT = '"This message is long enough to wrap across several lines when the dialog is narrow."';

/** A dialog parsed from `lines` in file order, after `visible = true`, with no authored Controls. */
function dialogNode(type: 'AcceptDialog' | 'ConfirmationDialog', lines: [string, string][]): SolveNode {
  const parse = type === 'AcceptDialog' ? parseDialog : parseConfirmationDialog;
  const properties = parse(
    heading(type, { name: 'Dialog' }),
    Object.fromEntries([['visible', 'true'], ...lines])
  );
  const node = { name: 'Dialog', type, children: [], properties } as unknown as TscnNode;
  return withThemeItems({ ...solveNode(), path: 'Dialog', node });
}

/**
 * A size line clamps the size to the contents minimum while `wrap_controls` is on at that line
 * (`window.cpp:1183-1190,2244-2251`). Godot 4.6.3 sizes, from `sceneOracle.gd` in
 * `acceptdialog/testing/dialogGeometry/`.
 */
describe('the size line of a dialog that stops wrapping', () => {
  const sizeOf = (type: 'AcceptDialog' | 'ConfirmationDialog', lines: [string, string][]) =>
    wrappedWindowSize(dialogNode(type, lines), THEME, measureText, EMBEDDER);
  const small: [string, string] = ['size', 'Vector2i(120, 60)'];
  const noWrap: [string, string] = ['wrap_controls', 'false'];

  it('grows to the contents minimum when the size line comes before wrap_controls = false', () => {
    expect(sizeOf('AcceptDialog', [['dialog_text', LONG_TEXT], small, noWrap])).toEqual({ x: 662, y: 80 });
  });

  it('keeps the size line when wrap_controls = false comes first', () => {
    expect(sizeOf('AcceptDialog', [['dialog_text', LONG_TEXT], noWrap, small])).toEqual({ x: 120, y: 60 });
  });

  it('reads the message an earlier size line cached, not one set after it', () => {
    const lines: [string, string][] = [
      ['size', 'Vector2i(20, 20)'],
      ['dialog_text', LONG_TEXT],
      small,
      noWrap,
    ];
    expect(sizeOf('AcceptDialog', lines)).toEqual({ x: 120, y: 80 });
  });

  it('reads the buttons the message cached on a visible dialog, not a later OK text', () => {
    const lines: [string, string][] = [
      ['dialog_text', '"Hi"'],
      ['ok_button_text', '"A very long OK button text here"'],
      ['size', 'Vector2i(20, 20)'],
      noWrap,
    ];
    expect(sizeOf('AcceptDialog', lines)).toEqual({ x: 55, y: 80 });
  });

  it('reads the OK text set before the first size line', () => {
    const lines: [string, string][] = [
      ['ok_button_text', '"A very long OK button text here"'],
      ['size', 'Vector2i(20, 20)'],
      noWrap,
    ];
    expect(sizeOf('AcceptDialog', lines)).toEqual({ x: 276, y: 80 });
  });

  it('reads a message cached while it autowraps as one line', () => {
    const lines: [string, string][] = [
      ['dialog_autowrap', 'true'],
      ['dialog_text', LONG_TEXT],
      small,
      noWrap,
    ];
    expect(sizeOf('AcceptDialog', lines)).toEqual({ x: 120, y: 80 });
  });

  it('reads the empty message a ConfirmationDialog constructor cached', () => {
    expect(sizeOf('ConfirmationDialog', [['dialog_text', LONG_TEXT], small, noWrap])).toEqual({
      x: 200,
      y: 80,
    });
  });

  it('reads the default buttons a ConfirmationDialog constructor cached', () => {
    const lines: [string, string][] = [
      ['ok_button_text', '"A very long OK button text here"'],
      small,
      noWrap,
    ];
    expect(sizeOf('ConfirmationDialog', lines)).toEqual({ x: 200, y: 80 });
  });

  it('reads a ConfirmationDialog row cached before the constructor adds Cancel', () => {
    const lines: [string, string][] = [
      ['min_size', 'Vector2i(10, 10)'],
      ['size', 'Vector2i(20, 20)'],
      noWrap,
    ];
    expect(sizeOf('ConfirmationDialog', lines)).toEqual({ x: 55, y: 80 });
  });

  it('drops the constructor clamp at a size line written after wrap_controls = false', () => {
    expect(sizeOf('ConfirmationDialog', [noWrap, small])).toEqual({ x: 200, y: 70 });
  });

  it('scales the cached minimum by the content scale factor', () => {
    const lines: [string, string][] = [
      ['content_scale_factor', '2.0'],
      ['dialog_text', '"Hi"'],
      ['size', 'Vector2i(20, 20)'],
      noWrap,
    ];
    expect(sizeOf('AcceptDialog', lines)).toEqual({ x: 110, y: 160 });
  });
});
