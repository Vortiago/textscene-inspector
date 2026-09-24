---
type: Truck Town
category: Complex Scenes
fixture: demos/3d/truck_town/town/town_scene.tscn
renders_as: Godot's Truck Town world through the scene's own camera
---

# Truck Town

Godot's Truck Town demo: a whole game world plus the vehicles that drive it. The
town is the largest scene in the corpus. The two vehicles are the corpus's only
witnesses for Godot 4.2+ compressed ArrayMesh attributes driving a whole body
rather than a test quad.

## The town
<!-- compare: image=complex-truck-town status=limitation fixture=demos/3d/truck_town/town/town_scene.tscn -->

`town_scene.tscn`: a glTF town model with terrain, roads and houses, ten instanced
lamp sub-scenes, a CSG racetrack, a WorldEnvironment with a procedural sky, fog and
AgX tonemapping, a shadow-casting sun, and a Control UI over the top.

Neither automatic framing works here (see **Scale**), so the scene carries a
`PreviewCamera` and both engines look through it.

### What it exercises

- **A glTF scene as an instanced PackedScene**: the town model, its terrain mesh,
  road ribbons and houses, loaded from `town_model.gltf` and positioned by the
  instancing `.tscn`.
- **Sub-scene instancing at depth**: ten `lamp_scene.tscn` instances, plus tree
  instances that are themselves glTF scenes.
- **A CSG racetrack**: `racetrack_csg.tscn`, a single CSGPolygon3D swept along a
  Path3D.
- **DirectionalLight3D with shadows**: `shadow_enabled`, `shadow_bias 0.015`,
  `shadow_blur 1.5` and an 80-unit shadow distance across open terrain.
- **WorldEnvironment**: sky background, `ambient_light_sky_contribution = 0.5`,
  depth fog, `glow_intensity = 0.5`, and `tonemap_mode = 4` (AgX).
- **An ExtResource sky**: the environment holds its `sky_material` in
  `res://town/sky_day.tres`, and draws half its ambient from that sky.
- **Material overrides inside instanced content**: four `surface_material_override/0`
  nodes retexture the glTF town (grass on the terrain and the outer ground, cement on
  the roads and the racetrack). Each addresses a node inside the instanced
  `town_model.gltf` (`parent="TownModel/Terrain"`).

### Scale: what the import sidecar fixes

`town/tree/scene.gltf` is a Sketchfab export whose `"tree"` node carries a uniform
**scale of 100**, compensating for a mesh authored at roughly centimetre units (raw
extents ≈ 25). Godot cancels it at import time with `scene.gltf.import`:

    nodes/root_scale=0.00999999999999999

giving `25 × 100 × 0.01 × 0.375 ≈ 9.4 units`, a normal tree beside a house.

The previewer reads the sidecar (ADR-0028), and the 25 scene sidecars are vendored.
Without them, a fresh Godot import regenerates the default `root_scale = 1.0`, and
both engines render a **937-unit** tree that dwarfs the whole town. Both sides agree
then, but on incomplete inputs.

### Divergences

Geometry, framing, terrain, roads, houses, tree scale and the procedural sky gradient
all match, and both sides apply the four ground override materials.

Godot's `BaseMaterial3D` constructs with `FLAG_USE_TEXTURE_REPEAT = true`, and three's
`Texture` defaults to clamp-to-edge. The previewer honours the repeat flag, so the
grass tiles as Godot's does. Clamping would smear one edge texel over terrain whose
UVs leave 0..1, and draw stripes.

The frame-wide mean max-channel delta against Godot is 20.09. The ground-brightness
gap below dominates it.

**The ground reads far brighter and more saturated here.** In the same regions of both
frames, the near ground is `rgb(55, 110, 92)` in Godot against `rgb(165, 190, 119)`
here, and the far ground `rgb(50, 74, 86)` against `rgb(169, 204, 182)`. It is not only
a distance falloff: the whole terrain is lighter and yellower here, and Godot's is
darker and tealer.

The cause is not diagnosed. Two candidates remain unconfirmed. First, the scene sets
`fog_enabled` with `fog_density = 0.0015`, and Godot's exponential fog is
`1 - exp(-density · depth)` where `THREE.FogExp2` is `1 - exp(-density² · depth²)`, a
large difference at these view distances. Second, the scene uses `tonemap_mode = 4`
(AgX), which is implemented but whose contribution here is not isolated. They are
candidates, not causes, until a measurement supports one.

## Trailer truck
<!-- compare: image=complex-truck-town-trailer status=limitation fixture=demos/3d/truck_town/vehicles/trailer_truck.tscn -->

`vehicles/trailer_truck.tscn`: a cab and a box trailer whose meshes are external
`.tres` ArrayMeshes carrying surfaces in Godot 4.2+'s **compressed attribute
layout**. Both engines put every panel, wheel and mirror in the same place at the
same scale, and the trailer's livery decal lands on the same face. The trailer
carries three blob-shadow decals, one on the cab and two on the trailer, which
`Decal.cull_mask` keeps off the bodywork (see the tow truck below).

**Both engines agree across the frame.** The trailer's lit side is
`rgb(248, 251, 254)` in Godot against `rgb(246, 248, 252)` here, and the cab roof,
shaded in both, is `rgb(21, 18, 55)` against `rgb(20, 16, 52)`. Over the whole frame
the mean per-pixel max-channel difference is **2.9**, with 0.14% of samples above 40.
Those sit on silhouette edges, in the livery lettering and on the headlight squares:
sub-pixel placement, not shading.

**The livery lettering differs.** Godot's "GODOT" wordmark on the trailer side reads
bolder and bluer than the previewer's. `vehicles/truck_trailer.tres` (the **material**,
not the same-named ArrayMesh under `meshes/`) asks for `texture_filter = 5`
(LINEAR + mipmaps + anisotropic), and `truck_town/project.godot` asks for 16x
anisotropy. The previewer honours both, which recovers roughly half the deficit over
the wordmark's bounding box. The table compares three's default `anisotropy = 1`
(before) with the honoured filter (after):

| measure | Godot | before | after |
| --- | --- | --- | --- |
| blue stroke pixels | 1376 | 800 | 1074 |
| `b − r` saturated bin (100–120) | 1243 | 321 | 775 |
| mean max-channel delta against Godot | 0 | 11.35 | 8.60 |

The rest is `texture_mipmap_bias = -0.5` (`project.godot`), which samples half a mip
level sharper than the LOD would pick. WebGL2 has no per-texture LOD bias: desktop GL's
`GL_TEXTURE_LOD_BIAS` has no WebGL counterpart, and the only route is a per-fragment
`texture(sampler, uv, bias)` in a patched shader. The previewer does not implement it,
by choice. The frame-wide delta does not change either way, because the effect is
confined to one small region.

## Tow truck
<!-- compare: image=complex-truck-town-tow status=limitation fixture=demos/3d/truck_town/vehicles/tow_truck.tscn -->

`vehicles/tow_truck.tscn`: a tow truck and the towed vehicle. One mesh **mixes
compressed and uncompressed surfaces in a single file**, so the previewer drops an
unreadable surface on its own. One unreadable surface would otherwise poison the merged
geometry's bounds and take the whole vehicle with it. The crane frame, the boom, both
cabs and the wheels all sit where Godot puts them.

**Each vehicle's blob shadow reaches the ground and never the truck.** Each vehicle
carries a `Decal` projecting `blob_shadow.png` (a 16x16 pure-black image with a radial
alpha blob) with `cull_mask = 1048573` (`0xFFFFD`: every render layer but layer 2).
Every vehicle `MeshInstance3D` sets `layers = 2`. Godot draws a decal on an instance
only where `decal.cull_mask & instance.layer_mask` is non-zero, and the previewer does
the same. Without the mask, the blob stamps an opaque black overlay on the bodywork.

The crane's shaded upright is `rgb(99, 92, 37)` in Godot against `rgb(96, 89, 34)`
here. The sun-lit body flank is `rgb(183, 173, 80)` against `rgb(183, 172, 82)`.
Frame-wide, the mean max-channel difference is **2.8**, and 0.05% of samples are
above 40.

This scene also carries five `surface_material_override/0` slots, which do not reach an
ArrayMesh (see the ArrayMesh sheet). Its grey metallic parts therefore take the
surface's own material where Godot takes the override.

## Known limitations

- **The load-time camera fit waits for decoding.** It runs on fixed timers, and once
  more when the resource loader reports nothing pending, so a scene of large external
  `.tres` meshes is framed after they decode. Selection never moves the camera, and a
  fit is skipped if the user has moved the camera since the last one.
- **`Decal.cull_mask` filters the receiver set, not the fragment.** A masked-out mesh
  never has a projection baked for it, which is exact. The fades are baked per vertex
  (see the Decal sheet), but on these vehicles they are unreachable, since every mesh
  is masked out and no receiver survives.
- **The town capture above contains no vehicles.** `town_scene.tscn` instances none.
  The car-select flow spawns them at runtime.
- **A typed node addressed into instanced content does not render.** An override
  (no `type=`) reaches its target and applies. A node that declares a type belongs
  *inside* the instanced content, at a path only that content can resolve, and placing
  it needs a portal onto the matched object. It renders nowhere rather than at the
  instance's own transform, because the wrong frame visibly wrecks a scene: the
  platformer player's coin counter is a 3.33x-scaled Label3D 7.5 units up. This costs
  the town nothing (all four of its overrides are type-less) and costs the platformer
  its coin counter.
