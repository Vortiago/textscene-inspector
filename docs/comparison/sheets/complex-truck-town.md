---
type: Truck Town
category: Complex Scenes
fixture: demos/3d/truck_town/town/town_scene.tscn
renders_as: Godot's Truck Town world through the scene's own camera
---

# Truck Town

Godot's Truck Town demo: a whole game world plus the vehicles that drive it. The
town is the largest scene in the corpus; the two vehicles are the corpus's only
witnesses for Godot 4.2+ compressed ArrayMesh attributes driving a whole body
rather than a test quad.

## The town
<!-- compare: image=complex-truck-town status=limitation fixture=demos/3d/truck_town/town/town_scene.tscn -->

`town_scene.tscn`: a glTF town model with terrain, roads and houses; ten instanced
lamp sub-scenes; a CSG racetrack; a WorldEnvironment with a procedural sky, fog and
AgX tonemapping; a shadow-casting sun; and a Control UI over the top.

Neither automatic framing works here — see **Scale** — so the scene carries a
`PreviewCamera` and both engines look through it.

### What it exercises

- **A glTF scene as an instanced PackedScene** — the town model, its terrain mesh,
  road ribbons and houses, loaded from `town_model.gltf` and positioned by the
  instancing `.tscn`.
- **Sub-scene instancing at depth** — ten `lamp_scene.tscn` instances, plus tree
  instances that are themselves glTF scenes.
- **A CSG racetrack** — `racetrack_csg.tscn`, a single CSGPolygon3D swept along a
  Path3D.
- **DirectionalLight3D with shadows** — `shadow_enabled`, `shadow_bias 0.015`,
  `shadow_blur 1.5` and an 80-unit shadow distance across open terrain.
- **WorldEnvironment** — sky background, `ambient_light_sky_contribution = 0.5`,
  depth fog, `glow_intensity = 0.5`, and `tonemap_mode = 4` (AgX).

### Scale: what the import sidecar fixes

`town/tree/scene.gltf` is a Sketchfab export whose `"tree"` node carries a uniform
**scale of 100**, compensating for a mesh authored at roughly centimetre units (raw
extents ≈ 25). Godot cancels it at import time via `scene.gltf.import`:

    nodes/root_scale=0.00999999999999999

giving `25 × 100 × 0.01 × 0.375 ≈ 9.4 units` — a normal tree beside a house.

This repo vendored **no `.import` files at all**, so a fresh Godot import regenerated
the default `root_scale = 1.0` and both engines rendered a **937-unit** tree that dwarfed
the whole town. Both agreeing looked like parity; it was two renderers fed the same
incomplete inputs. The previewer now reads the sidecar (ADR-0028) and the 25 scene
sidecars are vendored, so both sides render the demo as it actually looks.

### Divergences

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

This gap is not diagnosed. Two candidates, neither confirmed: the scene sets
`fog_enabled` with `fog_density = 0.0015`, and Godot's exponential fog is
`1 - exp(-density · depth)` where `THREE.FogExp2` is `1 - exp(-density² · depth²)` — a
large difference at these view distances; and the scene uses `tonemap_mode = 4` (AgX),
which is implemented but whose contribution here has not been isolated. Stating them as
possibilities rather than causes is deliberate: this sheet already had to be corrected
once for naming a cause that measurement did not support.

## Trailer truck
<!-- compare: image=complex-truck-town-trailer status=limitation fixture=demos/3d/truck_town/vehicles/trailer_truck.tscn -->

`vehicles/trailer_truck.tscn`: a cab and a box trailer whose meshes are external
`.tres` ArrayMeshes carrying surfaces in Godot 4.2+'s **compressed attribute
layout**. Before that layout was decoded these read as non-finite floats, so the
mesh had no usable bounding sphere and the scene could not even be framed. Both
engines now put every panel, wheel and mirror in the same place at the same scale,
and the trailer's livery decal lands on the same face.

**What differs: the sun-lit faces are far darker here; the shaded ones match.** The
trailer's lit side is `rgb(248, 251, 254)` in Godot against `rgb(49, 51, 54)` here,
while the cab roof — already in shadow in both — is `rgb(21, 18, 55)` against
`rgb(27, 28, 30)`. The specular highlight along the trailer's top edge is ours alone.

That split is the useful part, and it is the same on the tow truck below: a surface
reading only ambient lands within a few units of Godot, and a surface taking the sun
is roughly a third of its brightness with its hue washed toward neutral. The
vehicles carry no DirectionalLight3D or WorldEnvironment — only SpotLight3D
headlights — so both sides light them from an injected editor preview sun
(ADR-0025). Not diagnosed: consistent with the sun's diffuse term being weak or
missing, and not yet separated from the surface materials resolving differently on
those faces.

## Tow truck
<!-- compare: image=complex-truck-town-tow status=limitation fixture=demos/3d/truck_town/vehicles/tow_truck.tscn -->

`vehicles/tow_truck.tscn`: a tow truck and the towed vehicle, one mesh of which
**mixes compressed and uncompressed surfaces in a single file** — the case that made
per-surface dropping necessary, since one unreadable surface would otherwise poison
the merged geometry's bounds and take the whole vehicle with it. The crane frame,
the boom, both cabs and the wheels all sit where Godot puts them.

**The same lit-versus-shaded split, measured on one vehicle.** The crane's shaded
upright is `rgb(98, 91, 37)` in Godot against `rgb(100, 92, 35)` here — two units
apart, and yellow in both. The sun-lit body flank is `rgb(183, 173, 80)` against
`rgb(60, 59, 47)`, which is both darker and close to neutral. The body's material
(`albedo_color = Color(0.584, 0.527, 0.190)`, no metallic) is strongly yellow, so on
the lit face the hue is being lost as well as the level.

This scene additionally carries five `surface_material_override/0` slots, which per
the ArrayMesh sheet do not reach an ArrayMesh at all — so its grey metallic parts
take the surface's own material where Godot takes the override. That is a separate,
known gap from the lighting one above.

## Known limitations

- **The load-time camera fit needed a real completion signal.** It ran on fixed
  timers, so a scene whose meshes are large external `.tres` files was framed from
  whatever had decoded by 1.1 s — which is why the vehicles above were captured
  cropped, and in the tow truck's case from inside the crane frame. The fit now also
  runs once when the resource loader reports nothing pending. Selection still never
  moves the camera, and a fit is skipped outright if the user has moved it since the
  last one.
- The vehicles' body albedo is not diagnosed, as above. It is visible on every
  vehicle in the town scene too, at a distance where it reads as shading rather than
  as wrong colour.
