/**
 * <LineEdit> — a single-line text box drawn as its stylebox plus one clipped
 * run of text on the 2D-UI overlay (ADR-0003). Godot's default `normal`
 * stylebox is the button fill with a 2px bottom border, which default_theme.cpp
 * adds so "LineEdits [are] distinguishable from Buttons"; `editable = false`
 * swaps it for the dimmer `read_only` box and dims the text with it.
 *
 * No caret is drawn. `LineEdit::_validate_caret_can_draw()` gates it on
 * `caret_force_displayed` or on the node both editing AND holding focus, and a
 * static preview has neither.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent, ControlParentProvider } from '../../../../r3f/controls/ControlParentContext';
import { controlStyle } from '../../../../r3f/controls/controlLayout';
import { textThemeStyle } from '../../../../r3f/controls/textThemeStyle';
import { resolveStyleBoxCss } from '../../../../r3f/controls/resolveStyleBox';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import {
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_PLACEHOLDER_COLOR,
  DEFAULT_FONT_COLOR,
  LINE_EDIT_BORDER_BOTTOM_WIDTH,
  LINE_EDIT_MINIMUM_CHARACTER_WIDTH,
  LINE_EDIT_READ_ONLY_BORDER_COLOR,
  STYLE_DISABLED_FILL,
  STYLE_NORMAL_FILL,
  STYLE_PRESSED_FILL,
  type ScaledGodotTheme,
} from '../../../../r3f/controls/godotDefaultTheme';
import { useGodotTheme } from '../../../../r3f/controls/useGodotTheme';
import { lineEditDisplayText } from './displayText';
import type { LineEditProperties } from './types';

/** `HorizontalAlignment` → flex packing. FILL (3) shares LEFT's draw branch. */
function alignmentJustify(alignment: number | undefined): 'flex-start' | 'center' | 'flex-end' {
  return alignment === 1 ? 'center' : alignment === 2 ? 'flex-end' : 'flex-start';
}

/**
 * The `normal` / `read_only` styleboxes: a flat fill with the theme's content
 * margins and radius, plus the 2px bottom border. `box-sizing: border-box`
 * keeps that border inside the rect, which is where Godot's StyleBoxFlat draws
 * it. The border alone is unscaled — default_theme.cpp sets it directly rather
 * than through `make_flat_stylebox`, which is what applies the theme scale.
 */
function defaultStyleBox(editable: boolean, theme: ScaledGodotTheme): CSSProperties {
  return {
    backgroundColor: editable ? STYLE_NORMAL_FILL : STYLE_DISABLED_FILL,
    borderRadius: `${theme.cornerRadius}px`,
    borderBottom: `${LINE_EDIT_BORDER_BOTTOM_WIDTH}px solid ${
      editable ? STYLE_PRESSED_FILL : LINE_EDIT_READ_ONLY_BORDER_COLOR
    }`,
    padding: `${theme.contentMargin}px`,
    boxSizing: 'border-box',
  };
}

export function LineEdit({ node, children }: ControlComponentProps) {
  const props = node.properties as LineEditProperties;
  const parentKind = useControlParent();
  const { internalResources } = useSceneResources();
  // Metrics at the project's `gui/theme/default_theme_scale`, never the raw
  // constants — Godot bakes that scale into the theme it builds at startup.
  const theme = useGodotTheme();

  const editable = props.editable ?? true;
  const { text, isPlaceholder } = lineEditDisplayText(props);

  // A `theme_override_styles/` box replaces the default one outright, and Godot
  // reads whichever of the two the editable state selects.
  const overrideKey = editable ? 'normal' : 'read_only';
  const overrideCss = resolveStyleBoxCss(props.themeOverrideStyles?.[overrideKey], internalResources);
  const boxCss =
    Object.keys(overrideCss).length === 0
      ? defaultStyleBox(editable, theme)
      : { ...overrideCss, boxSizing: 'border-box' as const };

  // `if (!flat) { style->draw(...) }` — a flat LineEdit paints text only. The
  // stylebox still supplies the text's offsets, so the padding stays.
  const chrome: CSSProperties = props.flat
    ? { padding: `${theme.contentMargin}px`, boxSizing: 'border-box' }
    : boxCss;

  const defaultColor = isPlaceholder
    ? CONTROL_FONT_PLACEHOLDER_COLOR
    : editable
      ? DEFAULT_FONT_COLOR
      : CONTROL_FONT_DISABLED_COLOR;
  const colorKey = isPlaceholder
    ? 'font_placeholder_color'
    : editable
      ? 'font_color'
      : 'font_uneditable_color';

  // `LineEdit::get_minimum_size()` floors the field at
  // `minimum_character_width * <'W' advance>` plus the stylebox's horizontal
  // margins, so a free-anchored field with no width from its offsets still
  // shows a box. Godot then takes the max of that and `custom_minimum_size`
  // (`Control::get_combined_minimum_size`), which the layout CSS emits too —
  // CSS `max()` folds both rather than letting whichever is spread last win.
  // `em` carries the theme scale for free — it resolves against the scaled
  // font size set below — which is right, because `minimum_character_width` is
  // a character count that default_theme.cpp deliberately leaves unscaled.
  const styleMinWidth = `calc(${LINE_EDIT_MINIMUM_CHARACTER_WIDTH}em + ${2 * theme.contentMargin}px)`;
  const minWidth = props.customMinimumSize?.x
    ? `max(${styleMinWidth}, ${props.customMinimumSize.x}px)`
    : styleMinWidth;

  const style: CSSProperties = controlStyle(
    props,
    parentKind,
    {
      display: 'flex',
      alignItems: 'center',
      justifyContent: alignmentJustify(props.alignment),
      minWidth,
      // Godot clips the shaped run to the content box and never wraps it.
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      fontSize: `${theme.fontSize}px`,
      color: defaultColor,
    },
    chrome,
    textThemeStyle(props, { sizeKey: 'font_size', colorKey })
  );

  return (
    <div data-control-type="LineEdit" data-node-name={node.name} style={style}>
      <span data-line-edit-text={isPlaceholder ? 'placeholder' : 'text'}>{text}</span>
      <ControlParentProvider kind="free">{children}</ControlParentProvider>
    </div>
  );
}
