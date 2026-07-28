# Previews (not vendored)

Everything else under `scenes/isometric/` is the upstream `2d/isometric` demo.
These three scenes are ours.

Each instances one of the demo's own `PackedScene`s at the middle of the project
viewport over a neutral backdrop, so the parity sheet can compare that piece on
its own. They exist because the demo's sub-scenes are authored around the
origin (and the internal shadow entirely above it), while both the reference
renderer and the previewer draw a 2D scene 1:1 into the project viewport
rectangle with no pan and no auto-fit. Captured directly, each one falls off the
top-left corner and both sides agree on an empty frame — a comparison that
passes while showing nothing.

They instance the demo scenes rather than copying their contents, so there is
nothing here to drift when the corpus is re-vendored.

Consumed by the `### Candle` / `### Internal shadow` / `### Goblin` sections of
`docs/comparison/sheets/complex-isometric-dungeon.md`.
