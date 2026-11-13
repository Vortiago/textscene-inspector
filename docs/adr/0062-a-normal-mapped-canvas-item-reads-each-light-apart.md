# A normal-mapped canvas item reads each light apart

- Status: Accepted. ADR-0067 moves the `shadow_color` layers into a second attachment of the light layers.
- Related: ADR-0030 (the 2D shadow penumbra), ADR-0033 (the light pass host).

## Context

The 2D light pass accumulates every light of an item light list into one screen-space buffer. The
item multiplies its albedo by that buffer once, which is Godot's arithmetic while every light meets
the item head-on: `light_blend_compute` is linear in the light colour, so the sum of the lights
equals the lights applied one by one.

A CanvasTexture's normal map breaks that. Godot shades each light by `max(dot(normal, light_vec), 0)`
and an optional Blinn term before it blends (`canvas.glsl:474-494,739-801`). The term depends on the
light's position or direction and on the pixel's normal, so no single sum holds it, and a MIX light
blends over the colour the lights before it left.

## Decision

A light list that a normal-mapped item reads keeps each light apart. The pass draws each light alone,
from a black seed, into its own layer of an array target: its shadowed colour and its alpha, with
the sign of a SUB light. A light that adds a `shadow_color` also draws a layer of a tint target.
Ahead of every frame's draws, the pass asks each light where it sits in the canvas's world frame and
its height (`apartLight.ts`).

The item loops over the layers in Godot's light order, directional lights first. It shades each
layer with its own normal term and blends it with that light's mode (`normalMappedLighting.ts`). An
item without a normal map keeps the single accumulation buffer, so its pixels and its cost do not
change. The pass draws only the buffers that the items of a list read.

## Considered Options

- **Per-light uniforms and the cookie sampled in the item.** Rejected. The shadow, the penumbra and
  the cookie's edge fade are passes of their own (ADR-0030), so the item would repeat each one.
- **One buffer per light for every list.** Rejected. A list with no normal-mapped item would pay a
  layer per light for no change in its pixels.

## Consequences

A list that a normal-mapped item reads costs one pass per light instead of one per list, and one
layer per light in memory. The item's program is keyed on its light count, so a change in that
count compiles a new program.
