/**
 * The ceiling on a dense walk driven by a `*_count` property.
 *
 * No count setter these walks read bounds its value above —
 * `OptionButton::set_item_count` refuses only a negative
 * (option_button.cpp:310) and `Slider::set_ticks` has no guard at all
 * (slider.cpp:386-393) — so `item_count = 2000000000` is a legal file, and the
 * linter clears it correctly. One slot per index hangs or OOMs the webview and
 * the VS Code preview, with no diagnostic to explain why.
 *
 * A limit of the PREVIEWER, not a claim about Godot, and therefore one number
 * rather than a bound per property: past a thousand elements a slider's ticks
 * land sub-pixel on top of one another and an OptionButton's items are
 * identical blanks behind the single item it draws, so no rendered image
 * changes.
 *
 * It bounds the walk itself, never a value read off the file: `selected` stays
 * exactly what the file says, since a walk bound derived from another
 * unbounded INT slot is the same hazard one step removed.
 */
export const MAX_WALKED_ELEMENTS = 1024;
