---
type: DirectionalLight2D
category: 2D
status: unimplemented
fixture: unit-directional-light-2d.tscn
# image: unit-directional-light-2d
renders_as: an invisible transform-only fallback
---

# DirectionalLight2D

DirectionalLight2D casts an infinite directional 2D light over the whole scene; the previewer parses and validates it but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `height` | `0.5` | halfway between parallel (0) and perpendicular (1) to the plane, for 2D normal mapping — not yet computed by the previewer |
| `max_distance` | `2000.0` | pixel distance beyond which shadows are culled — not yet meaningful since the light casts no shadow yet |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin DirectionalLight2D -->
Strict parsing format-checks these `DirectionalLight2D` properties, plus 15 inherited from Light2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `height` | float 0-1 | warning |
| `max_distance` | float >= 0 | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
<!-- lint:end -->

The lenient parser reuses Node2D's own property reader, which has no field for
`height` or `max_distance` at all: neither is read, so any value there —
malformed or not — is silently dropped rather than substituted with a fallback.
