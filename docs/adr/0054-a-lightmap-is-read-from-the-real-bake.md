# A lightmap is read from the real bake

- Status: Accepted
- Related: ADR-0028 (import sidecars), ADR-0031 (resource slices), ADR-0045 (the pending render
  intent).

## Context

A LightmapGI lights each instance its LightmapGIData names from a baked atlas, in place of the
scene's ambient light, and a light with a static bake no longer lights that instance in real time.
The previewer cannot bake: a bake traces the scene on the CPU or through compute shaders in the
editor. Both corpus demos that use a LightmapGI ship their bake (`.lmbake` and `.exr`), and so does
every project that commits one. An approximation, such as an ambient term or a screen-space
estimate, cannot put a shadow, a bounce colour or a light that Godot bakes and then skips.

## Decision

The previewer reads the bake Godot wrote and samples it as Godot's forward shader does.

- The `binaryresource` slice reads the `.lmbake` into the same property bag a `.tres` gives, and
  the `lightmapgidata` slice decodes it: the texture list, the users, spherical harmonics and the
  capture bounds.
- The `image2darray` slice reads the source `.exr`, and its import sidecar cuts it into the layers
  of one texture array. The VRAM-compressed import in `.godot/imported/` is not read, since a
  project does not commit it.
- Each LightmapGI registers its atlas, users and bounds with the scene's `SceneLightmaps`. A node
  takes the assignment of the last LightmapGI in ready order that names it
  (`lightmap_gi.cpp:1507-1567`, `node.cpp:316-326`), and the cull draws a lightmap only where its
  capture bounds meet the camera's frustum (`renderer_scene_cull.cpp:2853`).
- A lit, opaque surface reads its slice through UV2 with Godot's bicubic filter and
  spherical-harmonics form (`scene_forward_clustered.glsl:921-978`, `:1835-1876`). Its uniforms
  read the assignment at each upload, so a moved or reloaded LightmapGI needs no recompile.
- A Static light skips a lightmapped surface in the same program (`GODOT_LIGHTMAP`).
- A bake saved with a shadowmask mode holds a second atlas, a `_shadow.png`, which the `image2darray`
  slice reads from the source PNG, as it reads the `.exr`. A texel is its byte over 255. The
  component copies each byte into the alpha of the first layer of its slice in the lightmap atlas, as
  a half float within 0.0005 of the byte over 255. The program then reads both through one sampler.
  A program has 16 sampler units to share, and a physical material with a sky and positional shadows
  takes 17 of them with the lightmap. Past its fade, a sun's real-time shadow gives way to the shadowmask in Replace mode, and Overlay multiplies
  the shadowmask in (`scene_forward_clustered.glsl:2252-2273`, `:2483-2492`). Mode Only skips the
  real-time shadow of every sun: the first drawn directional light takes the shadowmask byte, and
  every other shadowed sun is fully shadowed (`:2510-2517`). A bake with no shadowmask draws as None.
- A GridMap the bake names draws its `baked_meshes` in place of its cells, and each takes the user
  whose sub-instance is its index (`grid_map.cpp:688`, `lightmap_gi.cpp:1544-1550`).

## Consequences

A scene without a committed bake draws as before: its LightmapGI applies nothing. A scene with one
draws its baked light, shadow and bounce, and the goldens `lightmap-gi-baked` and
`lightmap-gi-directional` hold both forms against a real bake.

The atlas and the shadowmask are read from their source files, so a soft shadow edge can differ
from Godot's compressed read by a few levels.

The bake's light probes, which light the dynamic objects, are a separate read on the same data. They
are not in this decision.
