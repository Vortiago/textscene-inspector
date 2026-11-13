/**
 * The one solve over an AcceptDialog and a ConfirmationDialog places their internal Controls as Godot
 * 4.6.3 does (`nodes/windows/acceptdialog/testing/dialogGeometry/`, scenes `A` and a plain
 * ConfirmationDialog, measured with the row's children added to `sceneOracle.gd`).
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import { heading } from '../../../parser/testing/parserKit';
import { parseDialog } from '../../../nodes/windows/acceptdialog/parser';
import { parseConfirmationDialog } from '../../../nodes/windows/confirmationdialog/parser';
import { wrappedWindowSize } from '../../../nodes/windows/window/wrapControls';
import { createSolveContext, solveControlTree } from './controlRectSolver';
import { nativeTheme } from './nativeTheme';
import { measureText } from './text/measurer';
import { solveNode, withThemeItems } from './testing/solveNode';
import './../../controls/index';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };
const LONG_TEXT = 'This is a rather long message that should wrap across several lines inside the dialog';
const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

function solvedRects(type: 'AcceptDialog' | 'ConfirmationDialog', lines: Record<string, string>) {
  const parse = type === 'AcceptDialog' ? parseDialog : parseConfirmationDialog;
  const properties = parse(heading(type, { name: 'Dialog' }), lines);
  const node = { name: 'Dialog', type, children: [], properties } as unknown as TscnNode;
  const dialog = withThemeItems({ ...solveNode(), path: 'Dialog', node });
  const size = wrappedWindowSize(dialog, THEME, measureText, EMBEDDER);
  const solved = solveControlTree(
    [dialog],
    rect(0, 0, size.x, size.y),
    createSolveContext(THEME, measureText)
  );
  return (path: string) => solved.get(`Dialog/${path}`)?.rect;
}

describe('the solve of an AcceptDialog (scene A)', () => {
  const rectOf = solvedRects('AcceptDialog', {
    visible: 'true',
    dialog_text: JSON.stringify(LONG_TEXT),
    dialog_autowrap: 'true',
  });

  it('places the message label in the content rect', () => {
    expect(rectOf('@WrappingMessageLabel')).toEqual(rect(8, 8, 645, 43));
  });

  it('places the button row on the bottom edge', () => {
    expect(rectOf('@ButtonsHBox')).toEqual(rect(8, 61, 645, 31));
  });

  it('lays the row out as a spacer, the OK button and a spacer', () => {
    expect(rectOf('@ButtonsHBox/@Spacer0')).toEqual(rect(0, 0, 303, 31));
    expect(rectOf('@ButtonsHBox/@OkButton')).toEqual(rect(307, 0, 31, 31));
    expect(rectOf('@ButtonsHBox/@Spacer1')).toEqual(rect(342, 0, 303, 31));
  });
});

describe('the solve of a ConfirmationDialog', () => {
  const rectOf = solvedRects('ConfirmationDialog', { dialog_text: '"Delete this file?"' });

  it('puts Cancel before OK, with a spacer on each side of each', () => {
    expect(rectOf('@ButtonsHBox')).toEqual(rect(8, 61, 184, 31));
    expect(rectOf('@ButtonsHBox/@Spacer0')).toEqual(rect(0, 0, 25, 31));
    expect(rectOf('@ButtonsHBox/@CancelButton')).toEqual(rect(29, 0, 60, 31));
    expect(rectOf('@ButtonsHBox/@Spacer1')).toEqual(rect(93, 0, 26, 31));
    expect(rectOf('@ButtonsHBox/@OkButton')).toEqual(rect(123, 0, 31, 31));
    expect(rectOf('@ButtonsHBox/@Spacer2')).toEqual(rect(158, 0, 26, 31));
  });
});
