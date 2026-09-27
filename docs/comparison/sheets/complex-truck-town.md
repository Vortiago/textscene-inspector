---
type: Truck Town
category: Complex Scenes
fixture: demos/3d/truck_town/town/town_scene.tscn
renders_as: Godot's Truck Town world through the scene's own camera
---

# Truck Town

Godot's Truck Town demo: the town, the largest scene in the corpus, and the two vehicles.
The vehicles use Godot 4.2+ compressed ArrayMesh attributes across a whole body.

## The town
<!-- compare: image=complex-truck-town status=limitation fixture=demos/3d/truck_town/town/town_scene.tscn -->

`town_scene.tscn`: a glTF town, ten instanced lamps, a CSG racetrack, a procedural sky
with fog and AgX tonemapping, a shadow-casting sun and a Control UI. Neither automatic
framing suits it, so both sides look through the scene's `PreviewCamera`.

It exercises:

- A glTF scene instanced as a PackedScene, with nested glTF tree instances
- The `.gltf.import` sidecar's `root_scale` (ADR-0028), which sizes the trees
- A CSGPolygon3D racetrack swept along a Path3D
- DirectionalLight3D shadows over open terrain
- An external `sky_material` and sky ambient light
- Material overrides on nodes inside the instanced glTF

Geometry, framing, tree scale, the sky and the override materials match.

- **Approximated** The ground is much brighter and more yellow than Godot's. The cause is
  not known. Fog and AgX are the candidates.
- **Needs runtime** The town has no vehicles. The game spawns them at runtime.

## Trailer truck
<!-- compare: image=complex-truck-town-trailer status=limitation fixture=demos/3d/truck_town/vehicles/trailer_truck.tscn -->

A cab and a trailer built from external compressed ArrayMeshes, with a livery decal and
three blob-shadow decals. Every part sits where Godot puts it, and the shading matches.

- **Approximated** The "GODOT" livery lettering is thinner and less blue than Godot's.
  WebGL2 has no texture LOD bias, so `texture_mipmap_bias` is not applied.

## Tow truck
<!-- compare: image=complex-truck-town-tow status=limitation fixture=demos/3d/truck_town/vehicles/tow_truck.tscn -->

A tow truck and the towed vehicle. One mesh mixes compressed and uncompressed surfaces.
Every part sits where Godot puts it, and each blob shadow reaches the ground and never the
bodywork (`Decal.cull_mask`). The shading matches.

- **Resource gap** Five `surface_material_override/0` slots do not reach an ArrayMesh, so
  the grey metal parts keep their own material.

## Known limitations

- **Not drawn** A typed node placed inside instanced content does not render. A type-less
  override does. The town uses only overrides.
