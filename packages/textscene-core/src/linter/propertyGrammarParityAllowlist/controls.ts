/**
 * `Control` leaves: the text-bearing controls, the container bases and the
 * button tier. `BaseButton` is a Control tier with no `parser.ts`, so its one
 * entry covers every leaf beneath it.
 */

import type { AsymmetryEntry } from './types.js';

export const controlAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // Text-bearing leaves: carets, selection, context menus and virtual keyboards
  // have no frozen-frame surface, while BiDi and locale change where glyphs
  // land. This renderer shapes text left-to-right, so those are a render gap.

  Label: {
    linterOnly: [],
    renderGap: [
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'structured_text_bidi_override', 'structured_text_bidi_override_options',
      'text_direction',
      
    ],
    reason:
      'Every key here changes the frozen frame and is not implemented yet: BiDi and locale are unread by a left-to-right shaper, and label_settings, the line window and the visible-character reveal each change what is on screen.',
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
    ],
    renderGap: [
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'structured_text_bidi_override', 'structured_text_bidi_override_options',
      'text_direction',
    ],
    reason: 'Carets, selection, clipboard and virtual-keyboard behaviour have no frozen-frame surface; BiDi and locale change the frame and are not implemented yet.',
  },

  RichTextLabel: {
    linterOnly: [
      // Selection and context-menu interaction.
      'context_menu_enabled', 'deselect_on_focus_loss_enabled',
      'drag_and_drop_selection_enabled', 'selection_enabled', 'shortcut_keys_enabled',
      // Threaded layout and the delay before its progress bar appears: both are
      // about how the layout is computed, not what it looks like when done.
      'threaded', 'progress_bar_delay',
    ],
    renderGap: [
      // HORIZONTAL_ALIGNMENT_FILL places a line at its origin without stretching
      // it: `fitLineToWidth` (`textJustify.ts`) is not wired in, since
      // `layoutRichTextRuns` would need run boundaries on the justified line.
      'justification_flags',
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'structured_text_bidi_override',
      'structured_text_bidi_override_options', 'text_direction',
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
    reason:
      'Shaping, BiDi, selection and threaded layout have no frozen-frame surface; document alignment, span underlines, custom effects, scroll position and the visible-character reveal all change the frame and are not implemented yet.',
  },

  ScrollContainer: {
    linterOnly: [
      // Input tuning: how far a drag must travel before it scrolls, how big a
      // wheel step is, and whether focusing a child scrolls it into view. All
      // three need an interaction to have any effect.
      'follow_focus', 'scroll_deadzone',
      'scroll_horizontal_custom_step', 'scroll_vertical_custom_step',
      // Picks STRETCH_TILE over STRETCH_SCALE on the two hint TextureRects
      // (scroll_container.cpp:751-752). Both hint icons are uniform along the
      // tiled axis, so the modes give identical bytes under `pnpm ref:godot`.
      'tile_scroll_hint',
    ],
    reason: 'Deadzone, wheel step and follow-focus need an interaction to matter, and tiling the scroll hint cannot change a gradient that is uniform along the tiled axis.',
  },

  // Both bases are scene types in their own right and carry a parser, which
  // their H/V leaves inherit `vertical` through. What is left is the
  // interactive splitter's own tuning, which a static frame never shows.
  SplitContainer: {
    linterOnly: [
      'dragging_enabled', 'touch_dragger_enabled',
      'drag_area_margin_begin', 'drag_area_margin_end', 'drag_area_offset',
      'drag_area_highlight_in_editor',
    ],
    reason: 'The drag-area and dragger keys tune an interactive splitter a static frame never shows.',
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

  // Editing, list and graph tiers: an indexed family (`tab_#/*`, `slot/#/*`) is
  // read through a computed key the scrape cannot match. Carets, selection and
  // the like have no frozen-frame surface, and the rest is a render gap.

  TextEdit: {
    linterOnly: [
      // Carets: a still, unfocused frame draws none of them.
      'caret_blink', 'caret_blink_interval', 'caret_mid_grapheme', 'caret_multiple',
      'caret_type', 'caret_move_on_right_click',
      // Selection, clipboard, context menu and drag: all interactions.
      'context_menu_enabled', 'deselect_on_focus_loss_enabled',
      'drag_and_drop_selection_enabled', 'emoji_menu_enabled',
      'empty_selection_clipboard_enabled', 'middle_mouse_paste_enabled',
      'selecting_enabled', 'shortcut_keys_enabled', 'tab_input_mode',
      'backspace_deletes_composite_character_enabled',
      // Word-boundary sets, which only a double-click selection consults.
      'custom_word_separators', 'use_custom_word_separators', 'use_default_word_separators',
      // Highlights every occurrence of the selection, and a static frame has none.
      'highlight_all_occurrences',
      // Virtual keyboard: a mobile affordance with no rendered surface.
      'virtual_keyboard_enabled', 'virtual_keyboard_show_on_focus',
      // Scroll smoothing and speed describe how the view moves, never where it rests.
      'scroll_smooth', 'scroll_v_scroll_speed',
      // `adjust_viewport_to_caret` (text_edit.cpp:904-909) snaps the view to
      // line 0 on first draw, and no scene property moves caret 0, so an
      // authored scroll offset is inert.
      'scroll_horizontal', 'scroll_vertical', 'scroll_past_end_of_file',
    ],
    renderGap: [
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'structured_text_bidi_override',
      'structured_text_bidi_override_options', 'text_direction',
    ],
    reason: 'Carets, selection, clipboard, word boundaries and virtual keyboards have no frozen-frame surface, and an authored scroll offset is snapped away before the first draw; BiDi changes the frame and is not implemented yet.',
  },

  CodeEdit: {
    linterOnly: [
      // Completion and brace-matching are typing affordances.
      'auto_brace_completion_enabled', 'auto_brace_completion_highlight_matching',
      'auto_brace_completion_pairs', 'code_completion_enabled', 'code_completion_prefixes',
      // Auto-indent applies as you type; the stored text is already indented.
      'indent_automatic', 'indent_automatic_prefixes', 'indent_use_spaces',
      // Symbol lookup needs a pointer.
      'symbol_lookup_on_click', 'symbol_tooltip_on_hover',
    ],
    reason: 'Completion, auto-indent and symbol lookup are all typing or pointer affordances. Every key it shares with TextEdit is recorded there.',
  },

  Tree: {
    linterOnly: [
      // A `.tscn` Tree has no rows, since only a script creates TreeItems, so
      // every key below describes rows that are never there.
      'allow_reselect', 'allow_rmb_select', 'allow_search', 'auto_tooltip',
      'drop_mode_flags', 'enable_drag_unfolding', 'enable_recursive_folding',
      'hide_folding', 'hide_root', 'select_mode',
      // A scroll hint needs content to scroll past.
      'scroll_hint_mode', 'scroll_horizontal_enabled', 'scroll_vertical_enabled',
      'tile_scroll_hint',
    ],
    reason: 'A Tree in a scene file declares no rows, so folding, selection, search, drag and scrolling all describe content that does not exist; the panel and its column headers are the whole of what such a scene draws.',
  },

  ItemList: {
    linterOnly: [
      // Read through a computed key, `properties[`item_${i}/text`]`, which the
      // scrape of fixed key strings cannot match.
      'item_#/*',
    ],
    reason: 'The row family is read through a computed key the scrape cannot match.',
  },

  TabBar: {
    linterOnly: [
      // Read through a computed key, as OptionButton's item family is.
      'tab_#/*',
    ],
    reason: 'The tab family is read through a computed key the scrape cannot match.',
  },

  TabContainer: {
    linterOnly: [
      // Read through a computed key, as OptionButton's item family is. Sparse
      // here rather than dense: the array length is the live child count.
      'tab_#/*',
    ],
    reason: 'The tab family is read through a computed key the scrape cannot match.',
  },

  GraphNode: {
    linterOnly: [
      // Read through a computed key, `slot/<index>/<leaf>`, which the scrape of
      // fixed key strings cannot match.
      'slot/*',
    ],
    reason: 'The slot family is read through a computed key the scrape cannot match.',
  },

  GraphEdit: {
    linterOnly: [
      // Panning is an interaction. The scene holds the resulting scroll_offset
      // and zoom, which the parser reads.
      'panning_scheme', 'right_disconnects',
      // `zoom_step` reaches nothing but the panner's own scroll factor.
      'zoom_step',
      // Connection type names populate a tooltip.
      'type_names',
    ],
    reason: 'Panning and the zoom step reach no frozen frame, and the type names are a tooltip.',
  },

  MenuBar: {
    linterOnly: [
      // Opening a menu is an interaction, and the native global menu replaces
      // the bar with the desktop\'s own. Neither reaches a frozen frame.
      'switch_on_hover', 'prefer_global_menu', 'start_index',
    ],
    renderGap: [
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'text_direction',
    ],
    reason: 'Hover switching, the global menu and the start index are all about opening menus a still frame never shows; BiDi is unread by a left-to-right shaper.',
  },

  MenuButton: {
    linterOnly: [
      // Read through a computed key, as OptionButton\'s identical family is.
      'popup/item_#/*',
      // The popup is a Window, so its item count changes nothing on the canvas.
      'item_count', 'switch_on_hover',
    ],
    reason: 'The popup is a Window and never reaches the Control canvas; its item family is read through a computed key the scrape cannot match.',
  },

  FoldableContainer: {
    linterOnly: [
      // A FoldableGroup coordinates which sibling is open. The scene already
      // holds each container\'s resulting `folded`.
      'foldable_group',
    ],
    renderGap: [
      // BiDi and locale for the title: our shaper runs left-to-right only.
      'language', 'title_text_direction',
    ],
    reason: 'The group only decides which sibling ends up folded, which each container already records; BiDi is unread by a left-to-right shaper.',
  },

  ColorPicker: {
    linterOnly: [
      // Deferred mode changes when the colour signal fires, never the picture.
      'deferred_mode',
      // It disables only `btn_add_preset`, inside `preset_container`, which
      // stays collapsed at load: presets arrive only through `add_preset()` at
      // runtime, never a `.tscn`.
      'can_add_swatches',
    ],
    reason: 'Deferred mode is signal timing alone; can_add_swatches only disables a button inside the presets grid, which is never expanded in a static frame.',
  },

  ColorPickerButton: {
    linterOnly: [
      // Both only affect the popup picker, which is a Window and never drawn here.
      'edit_alpha', 'edit_intensity',
    ],
    reason: 'Both configure the popup picker, which is a Window and never reaches the Control canvas.',
  },

  Button: {
    linterOnly: [],
    renderGap: [
      // BiDi and locale: our shaper runs left-to-right only.
      'text_direction', 'language',
    ],
    reason:
      "BiDi changes where the label's glyphs land, and this renderer's own shaper reads none of it yet.",
  },

  LinkButton: {
    linterOnly: [],
    renderGap: [
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'structured_text_bidi_override',
      'structured_text_bidi_override_options', 'text_direction',
    ],
    reason:
      'BiDi changes where the underlined label\'s glyphs land, and the left-to-right shaper reads none of it yet.',
  },

  TextureButton: {
    linterOnly: [
      // A per-pixel hit mask: it decides which clicks land, never which pixels
      // are drawn, and a static preview dispatches no clicks.
      'texture_click_mask',
    ],
    reason: 'The click mask is hit-testing only; it cannot change a frozen frame.',
  },
};
