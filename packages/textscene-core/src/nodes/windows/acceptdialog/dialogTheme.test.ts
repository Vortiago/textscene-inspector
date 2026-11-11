/** The dialog's internal Button and Label resolve their theme items through the dialog's theme chain. */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import { heading } from '../../../parser/testing/parserKit';
import { createSolveContext } from '../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import { solveNode } from '../../../r3f/controls/native/testing/solveNode';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { builtButtonIconKey, dialogButtonNode, messageLabelNode } from './dialogParts';
import { dialogGeometry } from './dialogLayout';
import { parseConfirmationDialog } from '../confirmationdialog/parser';
import { parseDialog } from './parser';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };
const RED = { r: 1, g: 0, b: 0, a: 1 };
const ICON_SIZE = { x: 24, y: 20 };

function themeOf(parts: Partial<Pick<ThemeResource, 'colors' | 'constants' | 'icons'>>): ThemeResource {
  return {
    defaultFont: null,
    defaultFontSize: undefined,
    fonts: {},
    fontSizes: {},
    typeVariations: {},
    properties: {},
    ...parts,
  };
}

function dialog(themeChain: readonly ThemeResource[]): SolveNode {
  const properties = parseDialog(heading('AcceptDialog', { name: 'Dialog' }), {
    dialog_text: '"one\\ntwo\\nthree"',
  });
  const node = { name: 'Dialog', type: 'AcceptDialog', children: [], properties } as unknown as TscnNode;
  return { ...solveNode(), path: 'Dialog', node, themeChain };
}

describe('a dialog under a Theme', () => {
  const iconTheme = themeOf({ icons: { Button: { icon: 'ExtResource("1")' } } });
  const sizedDialog = (themeChain: readonly ThemeResource[]): SolveNode => ({
    ...dialog(themeChain),
    textureSlots: { [builtButtonIconKey('Button')]: ICON_SIZE },
  });

  it('sizes the OK button by the size the dialog holds for the theme icon of Button', () => {
    expect(dialogButtonNode(sizedDialog([iconTheme]), 'ok').textureSize).toEqual(ICON_SIZE);
  });

  it('leaves the OK button without an icon size when the theme has no icon', () => {
    expect(dialogButtonNode(sizedDialog([]), 'ok').textureSize).toBeNull();
  });

  it('gives the OK button the theme colours of Button', () => {
    const themed = dialog([themeOf({ colors: { Button: { font_focus_color: RED } } })]);
    expect(dialogButtonNode(themed, 'ok').colors.font_focus_color).toEqual(RED);
  });

  it('gives the message label the theme constants of Label', () => {
    const themed = dialog([themeOf({ constants: { Label: { line_spacing: 20 } } })]);
    expect(messageLabelNode(themed).constants.line_spacing).toBe(20);
  });

  it('makes the message taller with a larger Label line_spacing', () => {
    const heightOf = (window: SolveNode) => wrappedWindowSize(window, THEME, measureText, EMBEDDER).y;
    const plain = dialog([]);
    const spaced = dialog([themeOf({ constants: { Label: { line_spacing: 20 } } })]);
    expect(heightOf(spaced)).toBeGreaterThan(heightOf(plain));
    const contentOf = (window: SolveNode) =>
      dialogGeometry(
        window,
        wrappedWindowSize(window, THEME, measureText, EMBEDDER),
        createSolveContext(THEME, measureText)
      ).content;
    expect(contentOf(spaced).h).toBeGreaterThan(contentOf(plain).h);
  });

  it('spaces the buttons by the HBoxContainer separation of the theme', () => {
    const confirmation = (themeChain: readonly ThemeResource[]): SolveNode => {
      const base = dialog(themeChain);
      const properties = parseConfirmationDialog(heading('ConfirmationDialog', { name: 'Dialog' }), {});
      return { ...base, node: { ...base.node, type: 'ConfirmationDialog', properties } };
    };
    const gapOf = (window: SolveNode) => {
      const [cancel, ok] = dialogGeometry(
        window,
        { x: 400, y: 200 },
        createSolveContext(THEME, measureText)
      ).buttons;
      return ok!.rect.x - (cancel!.rect.x + cancel!.rect.w);
    };
    const spaced = confirmation([themeOf({ constants: { HBoxContainer: { separation: 40 } } })]);
    expect(gapOf(spaced)).toBeGreaterThan(gapOf(confirmation([])));
  });
});
