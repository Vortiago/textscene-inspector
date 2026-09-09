/**
 * `Control`-derived UI nodes.
 *
 * `Container` and `Control` are the two rows guarded by `if (get_class() == …)`,
 * so both carry an `appliesTo` naming the base class alone.
 */
import type { WarningRow } from './types.js';

export const guiWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  BaseButton: [
    {
      at: 'base_button.cpp:526',
      says: 'ButtonGroup only arbitrates between toggle-mode buttons',
      verdict: { rule: 'button-group-without-toggle-mode' },
    },
  ],

  Container: [
    {
      at: 'container.cpp:211',
      says: "plain Container doesn't display anything on its own",
      verdict: { rule: 'container-no-script' },
      appliesTo: ['Container'],
    },
  ],

  Control: [
    {
      at: 'control.cpp:252',
      says: "tooltip won't be displayed because Mouse Filter is Ignore",
      verdict: { rule: 'control-tooltip-ignored-by-mouse-filter' },
    },
  ],

  Label: [
    {
      at: 'label.cpp:634',
      says: 'autowrap under a Container needs a custom minimum size',
      verdict: { rule: 'label-autowrap-needs-custom-minimum-size' },
    },
    {
      at: 'label.cpp:655',
      says: "the current font can't render one or more characters in the text",
      verdict: { declined: 'runtime-only', because: 'TextServer glyph shaping, label.cpp:647-659' },
    },
    {
      at: 'label.cpp:695',
      says: 'MSDF font pixel range is too small for some outlines/shadows',
      verdict: { declined: 'runtime-only', because: 'FontFile binary MSDF metadata, label.cpp:689-691' },
    },
  ],

  LineEdit: [
    {
      at: 'line_edit.cpp:3075',
      says: 'Secret Character supports only one character',
      verdict: { validator: 'LineEdit.secret_character' },
    },
  ],

  MenuButton: [
    {
      at: 'menu_button.cpp:232',
      says: 'no popup menu assigned',
      verdict: { declined: 'editor-only', because: 'whole override inside #ifdef TOOLS_ENABLED, menu_button.cpp:229,235' },
    },
  ],

  OptionButton: [
    {
      at: 'option_button.cpp:645',
      says: 'no options to select from',
      verdict: { declined: 'editor-only', because: '#ifdef TOOLS_ENABLED, option_button.cpp:642,648' },
    },
  ],

  PopupMenu: [
    {
      at: 'popup_menu.cpp:3075',
      says: 'has no visible items',
      verdict: { declined: 'editor-only', because: '#ifdef TOOLS_ENABLED, popup_menu.cpp:3068,3081' },
    },
  ],

  PopupPanel: [
    {
      at: 'popup.cpp:238',
      says: 'has no child controls',
      verdict: { declined: 'editor-only', because: '#ifdef TOOLS_ENABLED, popup.cpp:231,244' },
    },
  ],

  Range: [
    {
      at: 'range.cpp:76',
      says: 'Exp Edit requires Min Value >= 0',
      verdict: { rule: 'range-exp-edit-negative-min' },
    },
  ],

  ScrollContainer: [
    {
      at: 'scroll_container.cpp:784',
      says: 'is intended to work with a single child control',
      verdict: { rule: 'scrollcontainer-not-single-child' },
    },
  ],

  SubViewportContainer: [
    {
      at: 'subviewport_container.cpp:280',
      says: "doesn't have a SubViewport child, so it can't display anything",
      verdict: { rule: 'subviewportcontainer-no-viewport' },
    },
    {
      at: 'subviewport_container.cpp:284',
      says: 'default mouse cursor shape has no effect',
      verdict: { rule: 'subviewportcontainer-non-arrow-cursor' },
    },
  ],
};
