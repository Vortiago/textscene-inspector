# A light list is accumulated in one draw into one target

- Status: Accepted
- Related: ADR-0030 (the 2D shadow penumbra), ADR-0062 (a normal-mapped item reads each light
  apart), #1262.

## Context

Godot calls `light_shadow_compute` once per light per fragment (`canvas.glsl:839`). Its result feeds
the light term and the `shadow_color` term through `mix(light_color, shadow_color, shadow)`.

The previewer splits the two terms over two buffers, because the `shadow_color` term is not scaled by
the item's albedo (ADR-0030). It drew each buffer in a pass of its own, and a list with a Light Only
reader drew a third. Each pass ran the shadow taps again. A tinted PCF13 light cost two evaluations
per fragment, and the issue measured 458 to 500 ms against 250 to 275 ms for the same lights without
a tint.

## Decision

A light list is accumulated in one draw into one render target with one attachment per buffer.
Output 0 of a light quad is the light term, output 1 the `shadow_color` term and output 2 the
Light Only term, which is the light term over another seed. An output with no attachment is dropped,
so a list takes only the buffers its items read (`ListAttachments` in `itemLightList.ts`), and one
material serves every list.

The buffers share one blend state, because the light, `shadow_color` and Light Only terms of one
light blend alike and carry one alpha. A MIX light scales all of them by it.

A list that a normal-mapped item reads keeps each light in a layer of one array target, with the
`shadow_color` as a second attachment. A render into a layer binds that layer on every attachment, so
a light's `shadow_color` layer is its own layer.

## Considered Options

- **A cached shadow fraction.** Rejected. It needs a pass that writes the fraction and a read of it
  in each light quad, which costs a full-screen target per light for what one more attachment holds.
- **Fewer taps for the tint quad.** Rejected. The taps are Godot's, and the two terms must agree.

## Consequences

A tinted list costs one shadow evaluation per fragment. A list that reads both an ordinary and a
Light Only buffer without a tint holds an attachment that nothing reads, because the Light Only
output sits after the `shadow_color` output. It costs one buffer of memory and saves a pass over
every light.

A `shadow_color` array target has a layer for every light of the list, where it had a layer for every
tinting light.
