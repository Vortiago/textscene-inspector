/**
 * The geometry of an AcceptDialog and a ConfirmationDialog, against rects measured in Godot 4.6.3
 * (`testing/dialogGeometry/`, window space, at the default theme scale).
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { createSolveContext } from '../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { flatStyleBox } from '../../../r3f/controls/native/styleBoxFlat';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import { controlNode, solveNode, withThemeItems } from '../../../r3f/controls/native/testing/solveNode';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { dialogGeometry } from './dialogLayout';
import { parseConfirmationDialog } from '../confirmationdialog/parser';
import { parseDialog } from './parser';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };
const LONG_TEXT = 'This is a rather long message that should wrap across several lines inside the dialog';

function quoted(text: string): string {
  return JSON.stringify(text);
}

function dialog(
  type: string,
  properties: Record<string, string>,
  children: SolveNode[] = [],
  themeItems: Partial<Pick<SolveNode, 'styleBoxes' | 'constants'>> = {}
): SolveNode {
  const node = {
    name: 'Dialog',
    type,
    children: [],
    properties: (type === 'AcceptDialog' ? parseDialog : parseConfirmationDialog)(
      heading(type, { name: 'Dialog' }),
      properties
    ),
  };
  return withThemeItems({
    ...solveNode(),
    path: 'Dialog',
    node: node as unknown as TscnNode,
    children,
    ...themeItems,
  });
}

/** A ColorRect with a custom minimum size, as the oracle adds it. */
function authoredBox(name = 'Box', minimum = { x: 120, y: 50 }): SolveNode {
  const node = controlNode(name, 'ColorRect', { name, customMinimumSize: minimum });
  return withThemeItems({ ...solveNode(), path: `Dialog/${name}`, node });
}

function sizeOf(window: SolveNode) {
  return wrappedWindowSize(window, THEME, measureText, EMBEDDER);
}

/** A fresh context for each solve: it memoises minimum sizes by path. */
function geometryOf(window: SolveNode) {
  return dialogGeometry(window, sizeOf(window), createSolveContext(THEME, measureText));
}

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe('an AcceptDialog with a short message', () => {
  const window = dialog('AcceptDialog', { dialog_text: quoted('Are you sure you want to continue?') });

  it('grows to hold the message and the button row', () => {
    expect(sizeOf(window)).toEqual({ x: 290, y: 100 });
  });

  it('fills the panel margins with the label above a centred OK button', () => {
    const { content: label, buttons } = geometryOf(window);
    expect(label).toEqual(rect(8, 8, 274, 43));
    expect(buttons).toEqual([{ role: 'ok', text: 'OK', rect: rect(129, 61, 31, 31) }]);
  });
});

describe('an AcceptDialog without a message', () => {
  it('keeps the 100x100 default size', () => {
    const window = dialog('AcceptDialog', {});
    expect(sizeOf(window)).toEqual({ x: 100, y: 100 });
    expect(geometryOf(window).buttons[0]!.rect).toEqual(rect(34, 61, 31, 31));
  });
});

describe('an AcceptDialog message with several lines', () => {
  it('grows by one line pitch for each newline', () => {
    const window = dialog('AcceptDialog', { dialog_text: quoted('one\ntwo\nthree') });
    expect(sizeOf(window)).toEqual({ x: 100, y: 132 });
    expect(geometryOf(window).content).toEqual(rect(8, 8, 84, 75));
  });

  it('widens to a long single line', () => {
    expect(sizeOf(dialog('AcceptDialog', { dialog_text: quoted(LONG_TEXT) }))).toEqual({ x: 661, y: 100 });
  });
});

describe('an AcceptDialog with dialog_autowrap', () => {
  it('wraps at the loaded width and grows downwards', () => {
    const window = dialog('AcceptDialog', { dialog_text: quoted(LONG_TEXT), dialog_autowrap: 'true' });
    expect(sizeOf(window)).toEqual({ x: 100, y: 366 });
    expect(geometryOf(window).content).toEqual(rect(8, 8, 84, 309));
  });

  it('wraps at a wider loaded width in fewer lines', () => {
    const window = dialog('AcceptDialog', {
      dialog_text: quoted(LONG_TEXT),
      dialog_autowrap: 'true',
      size: 'Vector2i(300, 100)',
    });
    expect(sizeOf(window)).toEqual({ x: 300, y: 132 });
    expect(geometryOf(window).content).toEqual(rect(8, 8, 284, 75));
  });

  it('keeps a loaded height the wrapped text already fits', () => {
    const window = dialog('AcceptDialog', {
      dialog_text: quoted(LONG_TEXT),
      dialog_autowrap: 'true',
      size: 'Vector2i(400, 40)',
    });
    expect(sizeOf(window)).toEqual({ x: 400, y: 106 });
  });
});

/**
 * A Control caches its minimum size, and the cache is not invalidated outside the tree (`Control::
 * update_minimum_size`). `dialog_text` read after `visible = true` caches the label's unwrapped
 * minimum, which a later `dialog_autowrap` does not clear before the window wraps its Controls.
 * Measured with `/mnt/project-files/dialog-1178/scn`, `A`, `C`, `E`, `F`, `H6` and `H8`.
 */
describe('an AcceptDialog read in a scene with dialog_autowrap and visible', () => {
  const wrapped = (lines: Record<string, string>) => dialog('AcceptDialog', lines);
  const longText = quoted(LONG_TEXT);

  it('keeps the unwrapped minimum when visible comes before the text', () => {
    const window = wrapped({ visible: 'true', dialog_text: longText, dialog_autowrap: 'true' });
    expect(sizeOf(window)).toEqual({ x: 661, y: 100 });
  });

  it('keeps it through a later size line', () => {
    const window = wrapped({
      visible: 'true',
      dialog_text: longText,
      dialog_autowrap: 'true',
      size: 'Vector2i(300, 100)',
    });
    expect(sizeOf(window)).toEqual({ x: 661, y: 100 });
  });

  it('wraps when the text comes before visible', () => {
    const window = wrapped({ dialog_text: longText, visible: 'true', dialog_autowrap: 'true' });
    expect(sizeOf(window)).toEqual({ x: 100, y: 366 });
  });

  it('wraps when dialog_autowrap comes before the text', () => {
    const window = wrapped({
      visible: 'true',
      dialog_autowrap: 'true',
      dialog_text: longText,
      size: 'Vector2i(300, 100)',
    });
    expect(sizeOf(window)).toEqual({ x: 300, y: 132 });
  });

  it.each([
    ['a size line before visible', { size: 'Vector2i(300, 100)' }, 'visible'],
    ['a size line between visible and the text', { size: 'Vector2i(300, 100)' }, 'text'],
  ])('wraps with %s', (_name, line, before) => {
    const lines: Record<string, string> =
      before === 'visible'
        ? { ...line, visible: 'true', dialog_text: longText }
        : { visible: 'true', ...line, dialog_text: longText };
    expect(sizeOf(wrapped({ ...lines, dialog_autowrap: 'true' }))).toEqual({ x: 300, y: 132 });
  });

  it('wraps after a min_size line, which also asks the window for its minimum', () => {
    const window = wrapped({
      min_size: 'Vector2i(1, 1)',
      visible: 'true',
      dialog_text: longText,
      dialog_autowrap: 'true',
    });
    expect(sizeOf(window)).toEqual({ x: 100, y: 366 });
  });
});

describe('a ConfirmationDialog', () => {
  it('floors at 200x70 and puts Cancel before OK with the row centred', () => {
    const window = dialog('ConfirmationDialog', {});
    expect(sizeOf(window)).toEqual({ x: 200, y: 100 });
    expect(geometryOf(window).buttons).toEqual([
      { role: 'cancel', text: 'Cancel', rect: rect(37, 61, 60, 31) },
      { role: 'ok', text: 'OK', rect: rect(131, 61, 31, 31) },
    ]);
  });

  it('reads ok_button_text and cancel_button_text into the buttons', () => {
    const window = dialog('ConfirmationDialog', {
      dialog_text: quoted('Delete this file?'),
      ok_button_text: quoted('Delete'),
      cancel_button_text: quoted('Keep'),
    });
    expect(geometryOf(window).buttons).toEqual([
      { role: 'cancel', text: 'Keep', rect: rect(32, 61, 47, 31) },
      { role: 'ok', text: 'Delete', rect: rect(108, 61, 59, 31) },
    ]);
  });
});

describe('an authored Control child', () => {
  it('fills the content rect and sizes the dialog by its minimum (`dialogs.cpp:219-260,281-316`)', () => {
    const window = dialog('AcceptDialog', { dialog_text: quoted('Hi') }, [authoredBox()]);
    expect(sizeOf(window)).toEqual({ x: 136, y: 107 });
    const { content, buttons } = geometryOf(window);
    expect(content).toEqual(rect(8, 8, 120, 50));
    expect(buttons[0]!.rect).toEqual(rect(52, 68, 31, 31));
  });

  it('fills the wider content rect a ConfirmationDialog floors at', () => {
    const window = dialog('ConfirmationDialog', { dialog_text: quoted('Hi') }, [authoredBox()]);
    expect(sizeOf(window)).toEqual({ x: 200, y: 107 });
    expect(geometryOf(window).content).toEqual(rect(8, 8, 184, 50));
  });
});

describe('two authored Control children', () => {
  it('share the content rect, sized by the larger minimum of each axis', () => {
    const wide = authoredBox('Wide', { x: 180, y: 30 });
    const tall = authoredBox('Tall', { x: 60, y: 90 });
    const window = dialog('AcceptDialog', { dialog_text: quoted('Over the children') }, [wide, tall]);
    expect(sizeOf(window)).toEqual({ x: 196, y: 147 });
    expect(geometryOf(window).content).toEqual(rect(8, 8, 180, 90));
  });
});

describe('a ConfirmationDialog with theme items', () => {
  const panel = flatStyleBox(
    { r: 0.5, g: 0.2, b: 0.2, a: 1 },
    { contentMargin: { left: 20, top: 12, right: 6, bottom: 14 } }
  );
  const constants = { buttons_separation: 30, buttons_min_width: 120, buttons_min_height: 40 };

  it('insets by the panel margins and floors the buttons at their minimum size', () => {
    const window = dialog('ConfirmationDialog', { dialog_text: quoted('Styled panel') }, [], {
      styleBoxes: { panel },
      constants,
    });
    expect(sizeOf(window)).toEqual({ x: 282, y: 119 });
    const { content: label, buttons } = geometryOf(window);
    expect(label).toEqual(rect(20, 12, 256, 23));
    expect(buttons.map(({ rect: buttonRect }) => buttonRect)).toEqual([
      rect(24, 65, 120, 40),
      rect(152, 65, 120, 40),
    ]);
  });

  it('leaves buttons_separation between the content and the row', () => {
    const window = dialog('ConfirmationDialog', { dialog_text: quoted('Styled panel') }, [], { constants });
    const { content, buttons } = geometryOf(window);
    expect(buttons[0]!.rect.y - (content.y + content.h)).toBe(30);
  });
});

describe('an AcceptDialog with a min_size', () => {
  it('stretches the label and the row to the floor', () => {
    const window = dialog('AcceptDialog', { dialog_text: quoted('Hi'), min_size: 'Vector2i(300, 150)' });
    expect(sizeOf(window)).toEqual({ x: 300, y: 150 });
    const { content: label, buttons } = geometryOf(window);
    expect(label).toEqual(rect(8, 8, 284, 93));
    expect(buttons[0]!.rect).toEqual(rect(134, 111, 31, 31));
  });
});
