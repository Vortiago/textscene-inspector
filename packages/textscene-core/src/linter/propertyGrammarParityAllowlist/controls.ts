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
      // Trimming, justification and tab stops each move glyphs our own shaper
      // places without them.
      'autowrap_trim_flags', 'clip_text', 'ellipsis_char', 'justification_flags',
      'tab_stops', 'text_overrun_behavior',
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'structured_text_bidi_override', 'structured_text_bidi_override_options',
      'text_direction',
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
    reason:
      'Every key here changes the frozen frame and is not implemented yet: trimming and justification move glyphs, BiDi and locale are unread by a left-to-right shaper, and label_settings, the line window and the visible-character reveal each change what is on screen.',
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
    reason: 'Carets, selection, clipboard and virtual-keyboard behaviour have no frozen-frame surface; BiDi, the trailing icon, clear button, control-character glyphs, content sizing and max_length truncation all change the frame and are not implemented yet.',
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
      // Trimming, justification and tab stops move glyphs our own shaper places
      // without them; BiDi and locale go unread by a left-to-right shaper.
      'autowrap_trim_flags', 'justification_flags', 'tab_size',
      'tab_stops', 'language', 'structured_text_bidi_override',
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
      // Draws a caret even unfocused, which is the one caret property a static
      // frame does show.
      'caret_draw_when_editable_disabled',
      // Each changes which glyphs land where: control characters drawn as
      // glyphs, the indent of a wrapped row, and a highlighter's colours.
      'draw_control_chars', 'indent_wrapped_lines', 'syntax_highlighter',
      // BiDi and locale: our shaper runs left-to-right only.
      'language', 'structured_text_bidi_override',
      'structured_text_bidi_override_options', 'text_direction',
    ],
    reason: 'Carets, selection, clipboard, word boundaries and virtual keyboards have no frozen-frame surface, and an authored scroll offset is snapped away before the first draw; the unfocused caret, control-character glyphs, wrapped-row indent, highlighter colours and BiDi all change the frame and are not implemented yet.',
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
      // Panning, snapping and the zoom bounds are all interactions; a scene
      // holds the resulting scroll_offset and zoom, which the parser does read.
      'panning_scheme', 'right_disconnects', 'snapping_enabled',
      'zoom_max', 'zoom_min', 'zoom_step',
      // Connection type names populate a tooltip.
      'type_names',
    ],
    renderGap: [
      // `connections` really is serialised and `set_connections` runs at load,
      // but each endpoint sits on a referenced GraphNode's own slot row — two
      // levels below what a sibling's painter can see.
      'connections',
      // The styling of those same lines.
      'connection_lines_antialiased', 'connection_lines_curvature',
      'connection_lines_thickness',
      // The minimap and the toolbar buttons are real chrome, positioned by
      // runtime code rather than by the scene.
      'minimap_enabled', 'minimap_opacity', 'minimap_size', 'show_arrange_button',
      'show_grid_buttons', 'show_menu', 'show_minimap_button', 'show_zoom_buttons',
      'show_zoom_label',
    ],
    reason: 'Panning, snapping and zoom bounds are interactions; the connections, their styling, the minimap and the toolbar are all drawn by Godot and not by us yet.',
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
    ],
    renderGap: [
      // Each adds or removes a whole row of the widget, and only the shape and
      // the sample row are drawn today.
      'color_mode', 'color_modes_visible', 'hex_visible', 'presets_visible',
      'sampler_visible', 'sliders_visible', 'can_add_swatches',
      // Both decide whether the alpha and intensity sliders exist.
      'edit_alpha', 'edit_intensity',
    ],
    reason: 'Only the picker shape and the sample row are drawn; every row-visibility key changes the widget and is not implemented yet. Deferred mode is signal timing alone.',
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
      // Wrapping, trimming and BiDi each move the label's glyphs, and our own
      // shaper applies none of them.
      'text_overrun_behavior', 'autowrap_mode', 'autowrap_trim_flags', 'clip_text',
      'text_direction', 'language',
    ],
    reason:
      "Wrapping, trimming and BiDi all change where the label's glyphs land; this renderer shapes the text itself and reads none of them yet.",
  },

  LinkButton: {
    linterOnly: [],
    renderGap: [
      // Trimming and its glyph, and BiDi and locale, all change where the
      // label's glyphs land; our own shaper reads none of them.
      'ellipsis_char', 'language', 'structured_text_bidi_override',
      'structured_text_bidi_override_options', 'text_direction',
    ],
    reason:
      'Trimming and BiDi change where the underlined label\'s glyphs land, and the left-to-right shaper reads neither yet.',
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
