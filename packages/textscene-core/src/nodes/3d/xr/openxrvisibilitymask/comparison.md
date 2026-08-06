---
type: OpenXRVisibilityMask
category: 3D
status: unimplemented
fixture: unit-open-xr-visibility-mask.tscn
# image: unit-open-xr-visibility-mask
renders_as: invisible transform-only fallback
---

# OpenXRVisibilityMask

Draws a stereo-correct visibility mask that blacks out the part of the render
invisible due to lens distortion, discarding those fragments before expensive
lighting runs on them. The previewer parses and validates this node but does not
draw it yet, so it renders as an invisible transform-only fallback and its
children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layers` | `3` | renders on layers 1 and 2 instead of the layers-1-only default |

`layers` is inherited from VisualInstance3D: OpenXRVisibilityMask declares no
property of its own, so a fixture that exercised only its own keys would set
nothing at all. The fixture also parents the mask under an XRCamera3D, which
is Godot's own recommended placement (see Linting below) rather than a
serialised property.

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin OpenXRVisibilityMask -->
Strict parsing format-checks the inherited set (1 inherited from VisualInstance3D, 16 inherited from Node3D, 10 inherited from Node); `OpenXRVisibilityMask` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
| `valid-openxrvisibilitymask-parent` | `openxrvisibilitymask-parent-not-xrcamera3d` | warning |
<!-- lint:end -->

OpenXRVisibilityMask declares no property of its own — its `_bind_methods` body is
empty — so `layers` is the only key this fixture exercises, and it is inherited
from VisualInstance3D. The lenient parser reuses `parseNode3D`, which reads only
`transform` and `visible`: a `layers` value, valid or malformed (say, `layers =
-1` or `layers = not-a-number`), is silently dropped and never reaches any
in-memory state. Only the strict parser's base-walk to VisualInstance3D's
`layerBitmask` validator range-checks it.

`linter.ts` also mirrors Godot's own `get_configuration_warnings()`: a visible
OpenXRVisibilityMask parented to anything other than an XRCamera3D draws a
warning, the same one Godot's editor reports. It stays quiet when `visible =
false` (Node3D's own `is_visible()` never sees a parent chain) and when the
parent's type is unknown, e.g. behind `instance=`.
