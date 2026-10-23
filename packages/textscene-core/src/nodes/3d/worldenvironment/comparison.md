---
type: WorldEnvironment
category: 3D
status: done
fixture: unit-world-environment-basic.tscn
image: unit-world-environment-basic
renders_as: the scene's background and environment lighting
---

# WorldEnvironment

Applies the scene's Environment resource to the whole view and draws no geometry of its own. Here the Environment sets a flat dark-navy background and bluish volumetric fog, which hazes the background and washes out the boxes with distance. The previewer draws both and renders the node's children. The first WorldEnvironment with a valid Environment applies. One that names none, or a `.tres` that fails to load, leaves the view with no Environment: the project's clear colour under the LINEAR curve.

## Linting

<!-- lint:begin WorldEnvironment -->

Strict parsing format-checks these `WorldEnvironment` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property            | Accepts                                                        | Out of range |
| ------------------- | -------------------------------------------------------------- | ------------ |
| `camera_attributes` | null, SubResource("id"), ExtResource("id") or Resource("path") |              |
| `compositor`        | null, SubResource("id"), ExtResource("id") or Resource("path") |              |
| `environment`       | null, SubResource("id"), ExtResource("id") or Resource("path") |              |

| Rule                                    | Reports                                 | Severity |
| --------------------------------------- | --------------------------------------- | -------- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference`             | info     |
| `valid-worldenvironment`                | `worldenvironment-requires-environment` | warning  |
|                                         | `single-worldenvironment`               | warning  |

<!-- lint:end -->

Both properties are assigned straight from the raw string with no format or resource-existence check. An absent `environment` falls back to `''` rather than raising strict's missing-environment warning, and an absent `camera_attributes` stays `undefined`.
