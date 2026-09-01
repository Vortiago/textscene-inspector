---
type: XROrigin3D
category: 3D
status: linter-only
fixture: unit-xr-origin-3d.tscn
# image: unit-xr-origin-3d
visual: false
renders_as: nothing (a transform-only group)
---

# XROrigin3D

Maps the real-world tracking-space center into the game world; every XRCamera3D,
XRController3D and XRAnchor3D should sit under it. It draws nothing itself, so the
previewer renders it as a transform-only group (ADR-0008): its children still
show, and that absence is the whole story.

## Properties exercised

The fixture also carries an XRCamera3D child, which its own
`xrorigin3d-missing-camera-child` rule (see Linting below) requires, and sets no
scale of its own, which its `xrorigin3d-unsupported-scale` rule would otherwise
flag.

| Property | Value | Effect |
| --- | --- | --- |
| `world_scale` | `2.5` | none — forwards straight to `XRServer.world_scale`, which only affects a live XR runtime |
| `current` | `true` | none — only matters once more than one XROrigin3D competes for `XRServer`'s active origin |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin XROrigin3D -->
Strict parsing format-checks these `XROrigin3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `current` | true or false |  |
| `world_scale` | float 0.01-1000 | error below 0.01, error above 1000 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-xrorigin3d` | `xrorigin3d-missing-camera-child` | warning |
|  | `xrorigin3d-unsupported-scale` | warning |
<!-- lint:end -->

XROrigin3D has a `linterParser.ts` of its own: `world_scale` is clamped to
`[0.01, 1000]` by `XRServer::set_world_scale` (an **error** past the clamp, since
the value is silently altered rather than merely hinted), and `current` is a
plain boolean. The lenient parser's `parseNode3D` never reads either key, so a
malformed `world_scale` (say, `world_scale = not-a-number`) or an out-of-range
one parses through completely silently — nothing downstream of parsing ever
looks at `world_scale` or `current` at all, so the rendered scene is identical
whether the value is valid or not.

`linter.ts` also mirrors two of Godot's own `XROrigin3D::get_configuration_warnings()`
checks (`xr_nodes.cpp:682-709`): a warning when no direct child is an XRCamera3D,
and a warning when the origin's own transform carries a non-identity scale
(Godot recommends `world_scale` instead). The third of Godot's three warnings —
disabled `xr/shaders/enabled` project setting — is not modelled: it is a project
setting no `.tscn` carries, and it fires unconditionally rather than from
anything in the file.
