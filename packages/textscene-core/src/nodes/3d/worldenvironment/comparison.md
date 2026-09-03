---
type: WorldEnvironment
category: 3D
status: unreviewed
fixture: unit-world-environment-basic.tscn
image: unit-world-environment-basic
renders_as: the scene's background and environment lighting
---

# WorldEnvironment

WorldEnvironment applies the scene's Environment resource — background, sky,
ambient, tonemapping and fog — to the whole view; it draws no geometry of its
own. Here the Environment sets a flat dark-navy colour background and enables
bluish volumetric fog. The previewer paints the background colour and renders
the node's children, but has no volumetric-fog equivalent.

## Properties exercised

These live on the referenced Environment sub-resource.

| Property | Value | Effect |
| --- | --- | --- |
| `background_mode` | `1` (Color) | fills the view with a flat colour instead of a sky |
| `background_color` | `Color(0.05, 0.05, 0.15)` | base backdrop — shows as-is in ours; fog tints it steel-blue in Godot |
| `background_energy_multiplier` | `1.0` | default; no visible change |
| `volumetric_fog_enabled` | `true` | Godot fills the view with a scattering haze; ours draws none |
| `volumetric_fog_density` | `0.05` | thickness of that haze in Godot |
| `volumetric_fog_albedo` | `Color(0.6, 0.7, 0.9)` | the bluish tint the haze takes |
| `volumetric_fog_emission` | `Color(0, 0, 0)` | the fog emits no light of its own |

## Divergences

Godot fills the frame with a bluish-grey volumetric haze: the backdrop lifts
from dark navy to steel-blue with a soft vertical gradient, and the red boxes
wash out and desaturate with distance — the far pair nearly dissolving into the
fog. Ours shows the flat dark-navy `background_color` with the boxes at
full-saturated red against it and no haze at any depth. The whole difference is
the volumetric fog, which has no three.js equivalent and is intentionally not
approximated.

## Linting

<!-- lint:begin WorldEnvironment -->
Strict parsing format-checks these `WorldEnvironment` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `camera_attributes` | null, SubResource("id") or ExtResource("id") |  |
| `compositor` | null, SubResource("id") or ExtResource("id") |  |
| `environment` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-worldenvironment` | `worldenvironment-requires-environment` | warning |
|  | `single-worldenvironment` | warning |
<!-- lint:end -->

Both properties are assigned straight from the raw string with no format or
resource-existence check. An absent `environment` falls back to `''` instead of triggering
strict's missing-required-environment error; an absent `camera_attributes` stays
`undefined`. Neither substitution is contingent on the value being a well-formed resource
reference, so a malformed one passes through unchanged too.
