---
type: Truck Town
category: Complex Scenes
status: limitation
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

**The terrain now carries its own materials.** `town_scene.tscn` retextures the glTF
town through four `surface_material_override/0` nodes — grass on the terrain and the
outer ground, cement on the roads and the racetrack. Every one addresses a node INSIDE
the instanced `town_model.gltf` (`parent="TownModel/Terrain"`), and the scene-tree
builder used to drop any node whose parent path descended into instanced content, so all
four vanished and the landscape rendered in the glTF's own materials.

Applying them surfaced the next gap rather than closing the frame: the grass came out in
**stripes**, because Godot's `BaseMaterial3D` constructs with
`FLAG_USE_TEXTURE_REPEAT = true` while three's `Texture` defaults to clamp-to-edge, so a
terrain whose UVs leave 0..1 smears one edge texel instead of tiling. With repeat honoured
the texture tiles as Godot's does.

Worth stating plainly: **the frame-wide number did not move** — mean max-channel delta
against Godot went 19.52 → 20.09. The ground-brightness gap below dominates this frame
and swamps the improvement. The behaviour is now right; the metric is unchanged.

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

**Both engines now agree across the frame.** Sampling the same points as before, the
trailer's lit side is `rgb(248, 251, 254)` in Godot against `rgb(246, 248, 252)` here,
and the cab roof — shaded in both — is `rgb(21, 18, 55)` against `rgb(20, 16, 52)`.
Over the whole frame the mean per-pixel max-channel difference is **2.9**, with 0.14%
of samples above 40; those sit on silhouette edges, in the livery lettering and on the
headlight squares, i.e. sub-pixel placement, not shading.

This scene used to read as a lighting bug — lit faces at roughly a third of Godot's
brightness with their hue washed toward neutral, shaded faces matching within a few
units. It was **not** lighting. See the tow truck below for the diagnosis; the trailer
carries three of the same decals, one on the cab and two on the trailer, and the
darkening tracked their boxes. The ours-only specular highlight previously noted along
the trailer's top edge went with them — it was the blob's own overlay material, not a
highlight.

**What still differs: the livery lettering, now about half closed.** Godot's "GODOT"
wordmark on the trailer side reads bolder and bluer than ours. The cause was
`texture_filter`, which we did not parse: `vehicles/truck_trailer.tres` — the **material**,
not the same-named ArrayMesh under `meshes/` — asks for `texture_filter = 5`
(LINEAR + mipmaps + anisotropic), and `truck_town/project.godot` asks for 16x anisotropy,
while every texture kept three's `anisotropy = 1`. Honouring it recovers roughly half the
deficit over the wordmark's bounding box:

| measure | Godot | before | after |
| --- | --- | --- | --- |
| blue stroke pixels | 1376 | 800 | 1074 |
| `b − r` saturated bin (100–120) | 1243 | 321 | 775 |
| mean max-channel delta vs Godot | — | 11.35 | 8.60 |

The rest is `texture_mipmap_bias = -0.5` (`project.godot`), which samples half a mip level
sharper than the LOD would pick. WebGL2 exposes no per-texture LOD bias — desktop GL's
`GL_TEXTURE_LOD_BIAS` has no WebGL counterpart, and the only route is a per-fragment
`texture(sampler, uv, bias)` in a patched shader. Left unimplemented deliberately; the
frame-wide delta is unaffected either way, since this is confined to one small region.

## Tow truck
<!-- compare: image=complex-truck-town-tow status=limitation fixture=demos/3d/truck_town/vehicles/tow_truck.tscn -->

`vehicles/tow_truck.tscn`: a tow truck and the towed vehicle, one mesh of which
**mixes compressed and uncompressed surfaces in a single file** — the case that made
per-surface dropping necessary, since one unreadable surface would otherwise poison
the merged geometry's bounds and take the whole vehicle with it. The crane frame,
the boom, both cabs and the wheels all sit where Godot puts them.

**What the darkness actually was: the vehicle's own blob shadow, stamped on itself.**
Each vehicle carries a `Decal` projecting `blob_shadow.png` — a 16x16 pure-black image
with a radial alpha blob — with `cull_mask = 1048573` (`0xFFFFD`: every render layer
but layer 2), while every vehicle `MeshInstance3D` sets `layers = 2`. Godot draws a
decal on an instance only where `decal.cull_mask & instance.layer_mask` is non-zero,
so there the blob reaches the ground and never the truck. We ignored `cull_mask`, so
the blob was baked onto the bodywork as an opaque black overlay.

That explains every symptom the old capture showed, including the ones that ruled
lighting out and were missed at the time: the lit faces read *darker than the same
vehicle's ambient-only faces*, which losing a sun term cannot do; grey glass and white
paint went black alongside yellow paint, which is material-agnostic; and the crane's
top bar — same mesh, same material, same sun-facing normal as the hood — stayed
correct, because it falls outside the decal box's z-extent where the blob's alpha is
near zero.

**Now measured.** The crane's shaded upright is `rgb(99, 92, 37)` in Godot against
`rgb(96, 89, 34)` here — the control, which had to stay put and did. The sun-lit body
flank is `rgb(183, 173, 80)` against `rgb(183, 172, 82)`, where it used to be
`rgb(60, 59, 47)`. Frame-wide, the mean max-channel difference fell from **6.9 to 2.8**
and the share of samples above 40 from **3.9% to 0.05%**.

This scene additionally carries five `surface_material_override/0` slots, which per
the ArrayMesh sheet do not reach an ArrayMesh at all — so its grey metallic parts
take the surface's own material where Godot takes the override. That gap is unrelated
to the one above and still open.

## Known limitations

- **The load-time camera fit needed a real completion signal.** It ran on fixed
  timers, so a scene whose meshes are large external `.tres` files was framed from
  whatever had decoded by 1.1 s — which is why the vehicles above were captured
  cropped, and in the tow truck's case from inside the crane frame. The fit now also
  runs once when the resource loader reports nothing pending. Selection still never
  moves the camera, and a fit is skipped outright if the user has moved it since the
  last one.
- **`Decal.cull_mask` filters the receiver set, not the fragment.** A masked-out mesh
  simply never has a projection baked for it, which is exact. The fades are now
  honoured too — baked per vertex, see the Decal sheet — though on these vehicles they
  are unreachable, since every mesh is masked out and no receiver survives.
- **The town capture above contains no vehicles.** `town_scene.tscn` instances none;
  they are spawned at runtime by the car-select flow. An earlier revision of this sheet
  claimed the vehicle darkening was visible there too — it was not, and the town
  capture is byte-identical before and after the `cull_mask` fix.
- **A TYPED node addressed into instanced content still does not render.** An override
  (no `type=`) reaches its target and applies; a node that declares a type belongs
  *inside* the instanced content at a path only that content can resolve, and placing it
  needs a portal onto the matched object. Until then it renders nowhere rather than at
  the instance's own transform — the platformer player's coin counter is a 3.33x-scaled
  Label3D 7.5 units up, and putting it in the wrong frame visibly wrecks the scene. This
  costs the town nothing (all four of its overrides are type-less) and costs the
  platformer its coin counter.
- **`texture_mipmap_bias` has no WebGL2 equivalent.** The project sets `-0.5`, i.e. half
  a mip level sharper than the LOD picks. Desktop GL's `GL_TEXTURE_LOD_BIAS` has no
  WebGL counterpart; the only route is a per-fragment bias in a patched shader.
