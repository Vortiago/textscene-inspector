/**
 * <CheckBox> — a check indicator followed by the label text, in the 2D-UI
 * overlay. Font size/color come from `theme_override_font_sizes/font_size` +
 * `theme_override_colors/font_color`; a system font stack is used (the VS Code
 * webview CSP blocks web fonts). The `buttonPressed` state is exposed on
 * `data-checked` for contract tests.
 *
 * Godot draws the icon on EVERY draw (`check_box.cpp` NOTIFICATION_DRAW), to
 * the left of the text and vertically centred, using the `radio_*` icons
 * instead when the node belongs to a `button_group`. Without it a checked and
 * an unchecked CheckBox render identically — losing the one piece of state the
 * node exists to show. The theme's actual icons are textures we do not have, so
 * this is a drawn approximation: a square (or circle) outline with a mark when
 * checked.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlStyle } from '../../../../r3f/controls/controlLayout';
import { textThemeStyle } from '../../../../r3f/controls/textThemeStyle';
import { useGodotTheme } from '../../../../r3f/controls/useGodotTheme';
import type { CheckBoxProperties } from './types';

export function CheckBox({ node, children }: ControlComponentProps) {
  const props = node.properties as CheckBoxProperties;
  const parentKind = useControlParent();
  // The indicator sits inline before the label, so the row is a flex box —
  // `controlStyle` keeps a hidden Control's `display: none` on top of that.
  const theme = useGodotTheme();
  const style: CSSProperties = controlStyle(
    props,
    parentKind,
    {
      display: 'inline-flex',
      alignItems: 'center',
      gap: `${INDICATOR_GAP}px`,
      // The theme's `default_font_size` at the project's scale, set explicitly
      // like Label's rather than inherited — see that component for why.
      fontSize: `${theme.fontSize}px`,
    },
    textThemeStyle(props, { sizeKey: 'font_size', colorKey: 'font_color' })
  );

  if (props.disabled) style.opacity = 0.6;

  const checked = props.buttonPressed === true;
  const radio = props.buttonGroup !== undefined;

  return (
    <div
      data-control-type="CheckBox"
      data-node-name={node.name}
      data-checked={checked ? 'true' : 'false'}
      style={style}
    >
      <span
        data-check-indicator={checked ? 'checked' : 'unchecked'}
        data-check-style={radio ? 'radio' : 'check'}
        style={indicatorStyle(checked, radio)}
      >
        {checked && !radio ? CHECK_MARK : ''}
      </span>
      {props.text ?? ''}
      {children}
    </div>
  );
}

/** Indicator box side length and its gap to the label, in CSS pixels. */
const INDICATOR_SIZE = 14;
const INDICATOR_GAP = 6;
/** Drawn instead of a theme texture, which the previewer has no access to. */
const CHECK_MARK = '\u2713';

function indicatorStyle(checked: boolean, radio: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: `${INDICATOR_SIZE}px`,
    height: `${INDICATOR_SIZE}px`,
    boxSizing: 'border-box',
    border: '1px solid currentColor',
    borderRadius: radio ? '50%' : '2px',
    // A radio's "on" state is a filled dot; a checkbox's is a tick glyph.
    backgroundColor: checked && radio ? 'currentColor' : 'transparent',
    fontSize: `${INDICATOR_SIZE - 3}px`,
    lineHeight: 1,
  };
}
