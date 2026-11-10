# hdr-2d

`unit-hdr-2d.tscn` draws four squares in the root viewport under `rendering/viewport/hdr_2d=true`.
The scene header names the variable. This file holds the measurements behind it.

## Why the root draws linear

`SceneTree` hands the setting to the root viewport (`scene_tree.cpp:2088-2089`). A render target
that uses HDR is `R16G16B16A16_SFLOAT`, and the canvas draws linear values into it
(`renderer_canvas_render_rd.cpp:671`). The blit to the screen converts them to sRGB and clamps
(`blit.glsl:136`, `renderer_compositor_rd.cpp:98`). A value above 1 therefore survives every
blend and clamps only at the screen.

## Measured through Godot 4.6.3

`pnpm ref:godot --mode 2d-root` converts the capture of an HDR root from linear to sRGB. The
probes below read the same on both sides.

| Probe | Draws | Godot | Previewer |
| --- | --- | --- | --- |
| (20, 20) | the clear colour, gray 0.3 | (76, 76, 76) | (76, 76, 76) |
| (120, 220) | green | (0, 255, 0) | (0, 255, 0) |
| (200, 300) | red of alpha 0.5 over green | (187, 188, 0) | (187, 188, 0) |
| (500, 300) | gray 0.5 at `modulate` 1.5 | (194, 194, 194) | (194, 194, 194) |
| (900, 300) | (0.5, 0.25, 0.1) at `modulate` 4 | (255, 255, 136) | (255, 255, 136) |

Without `hdr_2d` the same squares read (127, 128, 0) for the blend and (191, 191, 191) for the
gray. The HDR root blends in linear light, so each reads brighter.

## Why the reference uses `--mode 2d-root`

`use_hdr_2d` of a nested SubViewport keeps the class default, so `pnpm ref:godot` refuses this
project in the default mode.
