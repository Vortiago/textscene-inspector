/**
 * `Control` leaves: the text-bearing four, the container bases and the button
 * tier.
 *
 * The container bases and `BaseButton` sit here rather than with the 2D leaves
 * because they are the same case as the text controls — a Control tier with no
 * `parser.ts`, whose one entry covers every leaf beneath it.
 */

import type { AsymmetryEntry } from './types.js';

export const controlAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // -------------------------------------------------------------------------
  // Text-bearing Control leaves
  //
  // These four share a shape: the overlay renders the text and lets the browser
  // shape it, so wrapping, BiDi and locale are delegated rather than missing,
  // while everything about carets, selection, context menus and virtual
  // keyboards has no frozen-frame surface at all. What is left over after those
  // two groups is the real render gap, and it is listed as such.
  // -------------------------------------------------------------------------

  Label: {
    linterOnly: [
      // Shaping delegated to the browser, exactly as the Button entry above.
      'autowrap_trim_flags', 'clip_text', 'ellipsis_char', 'justification_flags',
      'tab_stops', 'text_overrun_behavior',
      // BiDi and locale.
      'language', 'structured_text_bidi_override', 'structured_text_bidi_override_options',
      'text_direction',
    ],
    renderGap: [
      // A LabelSettings resource carries font, size, colour and outline, none of
      // which the overlay's CSS defaults reproduce.
      'label_settings',
      // Each of these changes which characters are on screen: a window into the
      // paragraph (lines_skipped, max_lines_visible), a custom split point
      // (paragraph_separator), or a typewriter reveal frozen part-way
      // (visible_characters and its two companions).
      'lines_skipped', 'max_lines_visible', 'paragraph_separator',
      'visible_characters', 'visible_characters_behavior', 'visible_ratio',
    ],
    reason: 'The overlay renders the label as DOM text, so shaping, BiDi and locale are delegated; label_settings, the line window and the visible-character reveal all change the frozen frame and are not implemented yet.',
  },

  LineEdit: {
    linterOnly: [
      // Caret appearance and movement, none of it drawn in an unfocused frame.
      'caret_blink', 'caret_blink_interval', 'caret_column', 'caret_mid_grapheme',
      // Selection, clipboard and context-menu interaction.
      'context_menu_enabled', 'deselect_on_focus_loss_enabled',
      'drag_and_drop_selection_enabled', 'emoji_menu_enabled',
      'keep_editing_on_text_submit', 'middle_mouse_paste_enabled',
      'select_all_on_focus', 'selecting_enabled', 'shortcut_keys_enabled',
      'backspace_deletes_composite_character_enabled',
      // Virtual keyboard: a mobile input affordance with no rendered surface.
      'virtual_keyboard_enabled', 'virtual_keyboard_show_on_focus', 'virtual_keyboard_type',
      // BiDi and locale, delegated as above.
      'language', 'structured_text_bidi_override', 'structured_text_bidi_override_options',
      'text_direction',
    ],
    renderGap: [
      // Draws a caret even unfocused, which is the one caret property a static
      // frame does show.
      'caret_force_displayed',
      // Each of these adds or resizes something visible: the inline clear
      // button, the trailing icon and its scaling, control characters drawn as
      // glyphs, and the field sizing itself to its content.
      'clear_button_enabled', 'draw_control_chars', 'expand_to_text_length',
      'icon_expand_mode', 'right_icon', 'right_icon_scale',
      // set_max_length re-runs set_text (line_edit.cpp:2523), which truncates,
      // so an over-long `text` renders shortened in Godot and in full here.
      'max_length',
    ],
    reason: 'Carets, selection, clipboard and virtual-keyboard behaviour have no frozen-frame surface, and shaping is delegated to the browser; the trailing icon, clear button, control-character glyphs, content sizing and max_length truncation all change the frame and are not implemented yet.',
  },

  RichTextLabel: {
    linterOnly: [
      // Shaping and BiDi delegated to the browser.
      'autowrap_mode', 'autowrap_trim_flags', 'justification_flags', 'tab_size',
      'tab_stops', 'language', 'structured_text_bidi_override',
      'structured_text_bidi_override_options', 'text_direction',
      // Selection and context-menu interaction.
      'context_menu_enabled', 'deselect_on_focus_loss_enabled',
      'drag_and_drop_selection_enabled', 'selection_enabled', 'shortcut_keys_enabled',
      // Threaded layout and the delay before its progress bar appears: both are
      // about how the layout is computed, not what it looks like when done.
      'threaded', 'progress_bar_delay',
    ],
    renderGap: [
      // Alignment of the whole document within the control.
      'horizontal_alignment', 'vertical_alignment',
      // Underlines actually drawn under [url] and [hint] spans.
      'hint_underlined', 'meta_underlined',
      // Custom BBCode effect resources, which change how their spans draw.
      'custom_effects',
      // Scroll state decides which part of a long document is on screen, and
      // whether a scrollbar is drawn beside it.
      'scroll_active', 'scroll_following', 'scroll_following_visible_characters',
      // The typewriter reveal, as on Label.
      'visible_characters', 'visible_characters_behavior', 'visible_ratio',
    ],
    reason: 'Shaping, BiDi, selection and threaded layout have no frozen-frame surface; document alignment, span underlines, custom effects, scroll position and the visible-character reveal all change the frame and are not implemented yet.',
  },

  ScrollContainer: {
    linterOnly: [
      // Input tuning: how far a drag must travel before it scrolls, how big a
      // wheel step is, and whether focusing a child scrolls it into view. All
      // three need an interaction to have any effect.
      'follow_focus', 'scroll_deadzone',
      'scroll_horizontal_custom_step', 'scroll_vertical_custom_step',
    ],
    renderGap: [
      // A scene saved mid-scroll renders unscrolled here.
      'scroll_horizontal', 'scroll_vertical',
      // Both drive set_visible() on the hint nodes (scroll_container.cpp:623),
      // and the focus border is drawn outright.
      'draw_focus_border', 'scroll_hint_mode', 'tile_scroll_hint',
    ],
    reason: 'Deadzone, wheel step and follow-focus need an interaction to matter; the scroll offsets, the scroll hints and the focus border are all drawn by Godot in a static frame and are not implemented yet.',
  },

  // The container bases have no parser.ts of their own — they reuse parseControl
  // — so from their own perspective every key they register is linter-only, and
  // one entry each covers their H/V leaves rather than four near-identical
  // copies. The leaves' parsers read what they RENDER (the shared
  // boxContainer/splitContainer helpers handle alignment and offsets for
  // layout); the rest is editor-side drag tuning a DOM overlay has no use for.
  BoxContainer: {
    linterOnly: ['alignment', 'vertical'],
    reason: 'Layout base with no parser of its own; the leaves render alignment through the shared boxContainer helper, and `vertical` is fixed by the leaf class so nothing reads it there.',
  },

  SplitContainer: {
    linterOnly: [
      'collapsed', 'dragging_enabled', 'dragger_visibility', 'touch_dragger_enabled',
      'split_offset', 'split_offsets', 'vertical',
      'drag_area_margin_begin', 'drag_area_margin_end', 'drag_area_offset',
      'drag_area_highlight_in_editor',
    ],
    reason: 'Layout base with no parser of its own; the drag-area and dragger keys tune an interactive splitter the static DOM overlay does not implement, and `vertical` is fixed by the leaf class.',
  },

  // Like the container bases, BaseButton has no parser.ts, so one entry covers
  // Button and every button leaf below it. `disabled` is absent because
  // button/parser.ts does read it: the preview dims a disabled button.
  BaseButton: {
    linterOnly: [
      // Interaction state and press semantics, all meaningless in a still frame.
      'toggle_mode', 'button_pressed', 'action_mode', 'button_mask',
      'keep_pressed_outside',
      // Grouping and keyboard shortcuts, which the preview does not dispatch.
      'button_group', 'shortcut', 'shortcut_feedback', 'shortcut_in_tooltip',
    ],
    reason: 'Interaction base with no parser of its own; press semantics, grouping and shortcuts describe behaviour under input, which a static preview never applies.',
  },

  Button: {
    linterOnly: [
      // Text shaping and localisation left to the browser: the DOM overlay
      // renders the label as text and lets CSS wrap and trim it.
      'text_overrun_behavior', 'autowrap_mode', 'autowrap_trim_flags', 'clip_text',
      'text_direction', 'language',
    ],
    reason: "The overlay renders the label as DOM text, so wrapping, trimming and bidi are the browser's job rather than properties the parser reads.",
  },
};
