/**
 * A previewer ceiling on a dense walk driven by a `*_count` property. `set_item_count` refuses only a
 * negative (option_button.cpp:310) and `Slider::set_ticks` has no guard (slider.cpp:386-393), so a legal
 * `item_count = 2000000000` would hang the webview. It bounds the walk, never a value: OptionButton items
 * past it are blanks, and `selected` stays as authored, since a bound from another INT slot has the same hazard.
 */
export const MAX_WALKED_ELEMENTS = 1024;
