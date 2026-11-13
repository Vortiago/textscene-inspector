/**
 * The toolbar's internal Controls read their own class's items through the GraphEdit's Theme chain
 * (`Control::get_theme_stylebox`, `control.cpp:3078`): `FlatButton` over `Button`, `Label`, and the
 * SpinBox's `SpinBoxInnerLineEdit` over `LineEdit`.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { isDrawn } from '../../../../r3f/controls/native/styleBoxFlat';
import { CONTROL_FONT_COLOR } from '../../../../godot/scene/theme';
import { graphEditToolbarTheme } from './toolbarTheme';
import { graphEditUnder } from './toolbarTheme.testkit';
import { lineEditBoxes } from '../lineedit/nativeSolver';
import { defaultThemeAt } from '../../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from '../../../../r3f/controls/native/defaultThemeRecords';

const THEME = nativeTheme(1);
const RED = { r: 1, g: 0, b: 0, a: 1 };
const GREEN = { r: 0, g: 1, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

describe('graphEditToolbarTheme', () => {
  it('builds once for each node and theme, so the solver and the painter share it', () => {
    const graphEdit = graphEditUnder();
    expect(graphEditToolbarTheme(graphEdit, THEME)).toBe(graphEditToolbarTheme(graphEdit, THEME));
    expect(graphEditToolbarTheme(graphEdit, nativeTheme(2))).not.toBe(
      graphEditToolbarTheme(graphEdit, THEME)
    );
  });

  describe('under no Theme, the default theme', () => {
    const items = graphEditToolbarTheme(graphEditUnder(), THEME);

    it('draws no FlatButton box but the pressed one, and keeps the Button margins in every state', () => {
      const { normal, pressed, disabled } = items.buttonBoxes;
      expect([isDrawn(normal), isDrawn(pressed), isDrawn(disabled)]).toEqual([false, true, false]);
      expect(normal.contentMargin).toEqual(THEME.widgets.button.normal.contentMargin);
    });

    it('draws the zoom label and the field in their own default colours', () => {
      expect(items.labelColor).toEqual(WHITE);
      expect(items.fieldColor).toEqual(CONTROL_FONT_COLOR);
    });

    it("leaves the label's box empty and the field's boxes at LineEdit's", () => {
      expect(isDrawn(items.labelBox)).toBe(false);
      expect(items.fieldBoxes).toEqual(lineEditBoxes(defaultStyleBoxesOf(defaultThemeAt(1)).LineEdit!));
    });
  });

  describe('under an ancestor Theme', () => {
    it("gives the buttons Button's boxes by draw state", () => {
      const { buttonBoxes } = graphEditToolbarTheme(
        graphEditUnder({ Button: { normal: 10, pressed: 11, disabled: 12 } }),
        THEME
      );
      expect(buttonBoxes.normal.contentMargin.left).toBe(10);
      expect(buttonBoxes.pressed.contentMargin.left).toBe(11);
      expect(buttonBoxes.disabled.contentMargin.left).toBe(12);
    });

    it("prefers FlatButton's box over Button's in the same Theme, as the type chain walks FlatButton first", () => {
      const { buttonBoxes } = graphEditToolbarTheme(
        graphEditUnder({ Button: { normal: 10 }, FlatButton: { normal: 7 } }),
        THEME
      );
      expect(buttonBoxes.normal.contentMargin.left).toBe(7);
    });

    it("gives the buttons Button's icon colours and the label Label's font colour", () => {
      const items = graphEditToolbarTheme(
        graphEditUnder({}, { Button: { icon_normal_color: RED }, Label: { font_color: GREEN } }),
        THEME
      );
      expect(items.buttonColors.icon_normal_color).toEqual(RED);
      expect(items.labelColor).toEqual(GREEN);
    });

    it("gives the zoom label Label's normal box", () => {
      expect(
        graphEditToolbarTheme(graphEditUnder({ Label: { normal: 6 } }), THEME).labelBox.contentMargin
      ).toEqual({
        left: 6,
        top: 6,
        right: 6,
        bottom: 6,
      });
    });

    it("gives the field SpinBoxInnerLineEdit's font colour over LineEdit's, and the arrows SpinBox's modulate", () => {
      const items = graphEditToolbarTheme(
        graphEditUnder(
          {},
          {
            LineEdit: { font_color: RED },
            SpinBoxInnerLineEdit: { font_color: BLUE },
            SpinBox: { up_icon_modulate: GREEN },
          },
          { SpinBoxInnerLineEdit: 'LineEdit' }
        ),
        THEME
      );
      expect(items.fieldColor).toEqual(BLUE);
      expect(items.spinBoxColors.up_icon_modulate).toEqual(GREEN);
    });

    it("gives the field LineEdit's boxes", () => {
      const { fieldBoxes } = graphEditToolbarTheme(
        graphEditUnder({ LineEdit: { normal: 12, read_only: 9 } }),
        THEME
      );
      expect(fieldBoxes.normal.contentMargin.left).toBe(12);
      expect(fieldBoxes.readOnly.contentMargin.left).toBe(9);
    });
  });
});
