---
type: LightmapProbe
category: 3D
status: unimplemented
fixture: unit-lightmap-probe.tscn
# image: unit-lightmap-probe
renders_as: invisible transform-only fallback
---

# LightmapProbe

LightmapProbe marks a manually placed probe position that LightmapGI samples to
light dynamic objects; it carries no state of its own beyond where it sits. The
previewer parses and validates it but does not draw it yet, so it renders as an
invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)` | Node3D's key, lifting the probe one unit up; no visible mark, since the node draws nothing |

LightmapProbe itself contributes no property to set: it binds no `ADD_PROPERTY` and
overrides no property-list hook, so every key a `.tscn` may carry on one reaches it
through the base-walk from Node3D.

## Divergences

Not captured yet.

## Linting

<!-- lint:begin LightmapProbe -->
<!-- lint:end -->

LightmapProbe declares no validator of its own, so nothing strict rejects here is
something lenient substitutes for a LightmapProbe-specific fallback. The lenient
parser reuses `parseNode3D`, which reads only `transform` and `visible`: a malformed
`transform` string is caught in `parseOptionalTransform` (`utils/transform.ts`),
which logs a warning and substitutes the identity transform rather than dropping the
node, while the strict parser reports the same bad value as a diagnostic instead of
silently replacing it. Every other Node3D key, `rotation_order` included, is read by
neither parser and simply never reaches the scene tree.
