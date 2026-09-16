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
  // These share a shape: carets, selection, context menus and virtual keyboards
  // have no frozen-frame surface at all, while BiDi and locale DO change which
  // glyphs land where — this renderer shapes text itself and shapes it
  // left-to-right, so those keys are a render gap rather than a delegation.
  // -------------------------------------------------------------------------

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
      // HORIZONTAL_ALIGNMENT_FILL positions a line at its origin but never
      // stretches it to the box — the one interaction `fitLineToWidth`
      // (`textJustify.ts`) is not wired into here, since RichTextLabel's own
      // per-run glyph slicing (`layoutRichTextRuns`) would need to re-derive
      // run boundaries against a justified line rather than the shaped one.
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
    ],
    renderGap: [
      // A scene saved mid-scroll renders unscrolled here.
      // Both drive set_visible() on the hint nodes (scroll_container.cpp:623),
      // and the focus border is drawn outright.
      'draw_focus_border', 'scroll_hint_mode', 'tile_scroll_hint',
    ],
    reason: 'Deadzone, wheel step and follow-focus need an interaction to matter; the scroll offsets, the scroll hints and the focus border are all drawn by Godot in a static frame and are not implemented yet.',
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
    renderGap: [
      // A multi-child split really does place its children differently.
      'split_offsets',
    ],
    reason: 'The drag-area and dragger keys tune an interactive splitter a static frame never shows; `split_offsets` moves the children and is not implemented yet.',
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

  // -------------------------------------------------------------------------
  // The editing, list and graph tiers
  //
  // Three shapes recur here. An indexed family (`tab_#/*`, `slot/#/*`) is read
  // through a computed key the guard's scrape of fixed strings cannot match —
  // the OptionButton entry above is the precedent. Carets, selection,
  // clipboards, context menus and virtual keyboards have no frozen-frame
  // surface. Everything else that would change the picture is a render gap.
  // -------------------------------------------------------------------------

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
      // Highlights every occurrence OF THE SELECTION, and a static frame has none.
      'highlight_all_occurrences',
      // Virtual keyboard: a mobile affordance with no rendered surface.
      'virtual_keyboard_enabled', 'virtual_keyboard_show_on_focus',
      // Scroll smoothing and speed describe how the view MOVES, never where it rests.
      'scroll_smooth', 'scroll_v_scroll_speed',
      // `adjust_viewport_to_caret` (text_edit.cpp:904-909) snaps the view back to
      // line 0 on first draw, and no scene property can move caret 0 — so an
      // authored scroll offset is genuinely inert rather than unimplemented.
      'scroll_horizontal', 'scroll_vertical', 'scroll_past_end_of_file',
    ],
    renderGap: [
      // An unfocused caret draws nothing, but the `editable = false` variant a
      // static frame does show.
      'caret_draw_when_editable_disabled',
      // The extra indent a wrapped row takes from the row it continues.
      'indent_wrapped_lines',
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'structured_text_bidi_override',
      'structured_text_bidi_override_options', 'text_direction',
    ],
    reason: 'Carets, selection, clipboard, word boundaries and virtual keyboards have no frozen-frame surface, and an authored scroll offset is snapped away before the first draw; the unfocused caret, the wrapped-row indent and BiDi all change the frame and are not implemented yet.',
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
    renderGap: [
      // Delimiter tables drive the comment/string colouring a highlighter paints.
      'delimiter_comments', 'delimiter_strings',
      // Vertical rules drawn at fixed columns.
      'line_length_guidelines',
    ],
    reason: 'Completion, auto-indent and symbol lookup are all typing or pointer affordances; the delimiter tables and the column guidelines change the frame and are not implemented yet. Every key it shares with TextEdit is recorded there.',
  },

  Tree: {
    linterOnly: [
      // A `.tscn` Tree has no rows at all — TreeItems exist only once a script
      // creates them — so every key below describes rows that are never there.
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
      // guard's scrape of fixed key strings cannot match.
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
      // Read through a computed key, `slot/<index>/<leaf>`, which the guard's
      // scrape of fixed key strings cannot match.
      'slot/*',
    ],
    reason: 'The slot family is read through a computed key the scrape cannot match.',
  },

  GraphEdit: {
    linterOnly: [
      // Panning is an interaction; a scene holds the resulting scroll_offset
      // and zoom, which the parser does read.
      'panning_scheme', 'right_disconnects',
      // The zoom bounds only disable a toolbar button, and only after
      // `set_zoom`'s own CLAMP (graph_edit.cpp:2434,2445) has read whichever
      // bound the file had applied by then — an order a property bag has no
      // way to carry. `zoom_step` reaches nothing but the panner.
      'zoom_max', 'zoom_min', 'zoom_step',
      // Connection type names populate a tooltip.
      'type_names',
      // Its only reader is GraphEditMinimap's own polyline draw
      // (graph_edit.cpp:1611); the main canvas connection shader applies its
      // own fixed pseudo-AA regardless, and that polyline is the one part of
      // the minimap this previewer does not draw.
      'connection_lines_antialiased',
    ],
    reason: 'Panning and the zoom bounds reach no frozen frame — the bounds only through a clamp whose input is the file\'s own property order; the type names are a tooltip, and connection antialiasing only reaches the minimap polyline.',
  },

  MenuBar: {
    linterOnly: [
      // Opening a menu is an interaction, and the native global menu replaces
      // the bar with the desktop\'s own — neither reaches a frozen frame.
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
      // A FoldableGroup coordinates which sibling is open; the scene already
      // holds each container\'s own resulting `folded`.
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
      // Deferred mode changes WHEN the colour signal fires, never the picture.
      'deferred_mode',
      // `btn_add_preset` is the only thing this ever disables, and it lives
      // inside `preset_container`, which stays collapsed at load (presets
      // only ever arrive through `add_preset()` at runtime — never a
      // `.tscn` — so the button that shows them is never in a static frame
      // either).
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
      // Wrapping and BiDi each move the label's glyphs, and our own shaper
      // never wraps a Button's label (a separate gap from trimming, which is
      // implemented).
      'autowrap_mode', 'autowrap_trim_flags',
      'text_direction', 'language',
    ],
    reason:
      "Wrapping and BiDi change where the label's glyphs land; this renderer shapes the text itself and never wraps a Button's label, and reads no BiDi yet.",
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
