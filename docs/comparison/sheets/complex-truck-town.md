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

## Scale: the trees are wrong in both images

The tree trunks tower over the entire town — the houses are specks at their base
— and the scene's bounds come out **2048 × 1104 × 2048**, where the 1104 is tree
height. Both engines agree, so it reads like faithful parity. It is not: both are
wrong the same way, because of something missing from the vendored copy.

`town/tree/scene.gltf` is a Sketchfab export whose `"tree"` node carries a
uniform **scale of 100** to compensate for a mesh authored in centimetre-ish
units (raw extents ≈ 25). Godot cancels that at import time: upstream ships
`scene.gltf.import` with

    nodes/root_scale=0.00999999999999999

so the real demo renders `25 × 100 × 0.01 × 0.375 ≈ **9.4 units**` — a normal tree
beside a house. This repo vendors **no `.import` files at all** (zero across the
whole corpus, against 25 model files), so a fresh Godot import regenerates the
default `root_scale = 1.0` and the compensation never happens: `25 × 100 × 0.375
≈ 937 units`.

Two consequences worth separating. The reference side is only "correct" here in
the sense that it faithfully renders the asset as vendored — it does not match
the real Truck Town demo. And this previewer does not read `.import` files at
all, so restoring them would fix Godot's side and leave ours at 937 units, which
would then be a genuine divergence. Both halves are tracked as follow-ups.

The tree is the ONLY model in the corpus carrying such a scale, so this is one
asset's worth of visible impact, not a systemic rendering problem.

The size is also why the scene needs an explicit camera: fit-to-bounds frames all
2048 units and shrinks the town to a speck, while Godot's editor orbit opens 4
units from the origin, underneath the terrain.

## Divergences

Geometry, framing, terrain, roads, houses and tree placement all match. The
lighting does not, and it traces to one unresolved resource.

**The sky is not resolved, and the ambient goes with it.** The scene holds its
`sky_material` in an **ExtResource** (`res://town/sky_day.tres`, a
`ProceduralSkyMaterial`). `resolveSky` follows `Environment.sky` →
`Sky.sky_material` through the scene's *internal* resources only, so an external
`.tres` is a dead end and no sky is built. Two things follow:

- **The background is flat.** Godot draws the procedural gradient (deep blue
  overhead, near-white at the horizon); we draw the default backdrop.
- **Surfaces facing away from the sun read black.** The environment asks for half
  its ambient from the sky (`ambient_light_sky_contribution = 0.5`). With no sky
  to sample there is no sky ambient, so the tree trunks — lit blue-grey in Godot
  — go nearly black on every face the sun does not reach. The sunlit ground is
  correspondingly fine, which is what makes the contrast so stark: our grass is
  bright and saturated where Godot's is washed pale by the sky's contribution and
  the depth fog over it.

This is the same limitation the platformer sheet records for a custom sky shader,
reached by a different route, and the two are not equally hard. There the sky is
a GDShader we do not execute and a compressed cubemap we do not decode. Here it
is a `ProceduralSkyMaterial` we fully support, in a plain `.tres` the resource
pipeline already knows how to fetch and parse — only the sky resolver is
synchronous over internal resources, so it never asks for it. Tracked as a
follow-up.

Screen-space fog, AgX tonemapping and the shadow-casting sun are all implemented
and applied; it is specifically the sky, and the ambient derived from it, that is
missing.
