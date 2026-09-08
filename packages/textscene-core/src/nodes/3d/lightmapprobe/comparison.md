---
type: LightmapProbe
category: 3D
status: unimplemented
fixture: unit-lightmap-probe.tscn
# image: unit-lightmap-probe
renders_as: invisible transform-only fallback
---

# LightmapProbe

A hand-placed probe position that LightmapGI samples to light dynamic objects. It carries no state beyond where it sits, and the previewer does not use it yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin LightmapProbe -->
Strict parsing format-checks the inherited set (17 inherited from Node3D, 10 inherited from Node); `LightmapProbe` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
<!-- lint:end -->

LightmapProbe declares no validator of its own. The lenient parser reuses `parseNode3D`, so a malformed `transform` warns and substitutes the identity rather than dropping the node.

## Known limitations

- **Not drawn** Godot samples the probe to light dynamic objects. Here it has no effect.
