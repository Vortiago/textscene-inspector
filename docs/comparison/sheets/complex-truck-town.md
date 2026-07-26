---
type: Truck Town
category: Complex Scenes
status: limitation
fixture: demos/3d/truck_town/town/town_scene.tscn
image: complex-truck-town
renders_as: Godot's Truck Town world through the scene's own camera
---

# Truck Town

Godot's Truck Town demo (`town_scene.tscn`): a whole game world, and the largest
scene in the corpus. A glTF town model with terrain, roads and houses; ten
instanced lamp sub-scenes; a CSG racetrack; a WorldEnvironment with a procedural
sky, fog and AgX tonemapping; a shadow-casting sun; and a Control UI layered over
the top.

Both images are the same scene through the same camera. Neither automatic
framing works here — see **Scale** below — so the scene carries a `PreviewCamera`
and both engines look through it.

## What it exercises

- **A glTF scene as an instanced PackedScene** — the town model, its terrain
  mesh, road ribbons and houses, loaded from `town_model.gltf` and positioned by
  the instancing `.tscn`.
- **Sub-scene instancing at depth** — ten `lamp_scene.tscn` instances, plus tree
  instances that are themselves glTF scenes.
- **A CSG racetrack** — `racetrack_csg.tscn`, a single CSGPolygon3D swept along a
  Path3D.
- **DirectionalLight3D with shadows** — `shadow_enabled`, `shadow_bias 0.015`,
  `shadow_blur 1.5` and an 80-unit shadow distance across open terrain.
- **WorldEnvironment** — sky background, `ambient_light_sky_contribution = 0.5`,
  depth fog, `glow_intensity = 0.5`, and `tonemap_mode = 4` (AgX).

## Scale: what the import sidecar fixes

`town/tree/scene.gltf` is a Sketchfab export whose `"tree"` node carries a uniform
**scale of 100**, compensating for a mesh authored at roughly centimetre units (raw
extents ≈ 25). Godot cancels it at import time via `scene.gltf.import`:

    nodes/root_scale=0.00999999999999999

giving `25 × 100 × 0.01 × 0.375 ≈ 9.4 units` — a normal tree beside a house.

This repo vendored **no `.import` files at all**, so a fresh Godot import regenerated
the default `root_scale = 1.0` and both engines rendered a **937-unit** tree that dwarfed
the whole town. Both agreeing looked like parity; it was two renderers fed the same
incomplete inputs. The previewer now reads the sidecar (ADR-0027) and the 25 scene
sidecars are vendored, so both sides render the demo as it actually looks.

## Divergences

Geometry, framing, terrain, roads, houses, tree scale and the sky all match. The sky is
the second thing this scene fixed: it holds its `sky_material` in an **ExtResource**
(`res://town/sky_day.tres`), and the resolver used to follow internal resources only, so
no sky was built at all. That cost the backdrop *and* the ambient — the environment draws
half its ambient from the sky, so every surface the sun did not reach went black, most
visibly the tree trunks. Both engines now draw the same procedural gradient.

**What still differs: the ground reads far brighter and more saturated here.** Sampling
the same regions of both frames, the near ground is `rgb(55, 110, 92)` in Godot against
`rgb(165, 190, 119)` here, and the far ground `rgb(50, 74, 86)` against
`rgb(169, 204, 182)`. So it is not only a distance falloff — the whole terrain is lighter
and yellower, and Godot's is darker and tealer.

This gap **predates both fixes on this branch** and is not diagnosed. Two candidates,
neither confirmed: the scene sets `fog_enabled` with `fog_density = 0.0015`, and Godot's
exponential fog is `1 - exp(-density · depth)` where `THREE.FogExp2` is
`1 - exp(-density² · depth²)` — a large difference at these view distances; and the
scene uses `tonemap_mode = 4` (AgX), which is implemented but whose contribution here has
not been isolated. Stating them as possibilities rather than causes is deliberate: this
sheet already had to be corrected once for naming a cause that measurement did not
support.

