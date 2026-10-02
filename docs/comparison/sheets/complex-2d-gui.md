---
type: Complex 2D GUI
category: Complex Scenes
status: limitation
fixture: complex-2d-gui.tscn
image: complex-2d-gui
renders_as: a composed settings/HUD panel — 23 Control types in one tree
---

# Complex 2D GUI

A mission settings panel built from 23 Control types. It holds a header card, a scrolling
column of controls, a briefing, an action row, a sector map and a status readout. An alert
strip sits over everything.

The scene moves many variables at once, so it shows how Controls interact, not which one
broke. Find a regression here, then pin it in the `unit-*` fixture of the type that owns it.

## What it exercises

- A deep container chain: MarginContainer, HSplitContainer, VBoxContainer, ScrollContainer,
  PanelContainer and GridContainer
- Sliders, an OptionButton, a LineEdit and a CheckBox sized only by their grid cells
- `modulate` multiplied down a nesting chain
- StyleBoxFlat content margins inside container separations
- A ScrollContainer that clips its content, with a scrollbar
- A VSplitContainer beside an HSplitContainer split by `size_flags_stretch_ratio`
- A CanvasLayer over the whole Control tree
- A SubViewportContainer that shows a Control subtree
- Wrapped Label and RichTextLabel text, with `[b]`, `[i]`, `[u]` and `[color]` spans
- Theme overrides on a default theme

## Known limitations

- **Approximated** Text edges differ slightly from Godot's, because glyphs come from an MSDF
  atlas, while layout, wrap points and every non-text surface match.
- **Approximated** A `[u]` underline sits two pixels higher and softer than Godot's.
