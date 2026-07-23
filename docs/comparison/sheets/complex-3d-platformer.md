---
type: Godot 3D Platformer
category: Complex Scenes
fixture: demos/3d/platformer/game.tscn
image: complex-3d-platformer
renders_as: Godot's 3D platformer level at the editor orbit
---

# Godot 3D Platformer

Godot's 3D Platformer demo (`game.tscn`): a whole playable level of grass-topped,
textured terrain blocks with floating platforms, a mesh enemy character, and
coins under a blue sky. Both images are the same scene rendered through real
Godot and through this previewer, framed at the same editor orbit — a whole 3D
level, not a single node.

## What it exercises

- **GridMap terrain** — the stepped dirt blocks with wavy dark/light strata,
  built from one GridMap and drawn with the same terraced silhouette on both sides.
- **StandardMaterial3D albedo textures** — the striated dirt sides and speckled
  grass tops, sampled from the same textures.
- **MeshInstance3D characters and props** — the domed, claw-armed enemy with its
  bright eye visor, and the trunk-and-canopy tree pillars, as textured meshes.
- **Coin instances** floating over the platforms.
- The editor **preview sun + sky**, casting shadows across the terraces.

## Divergences

The framing, layout, terrain, props, enemy and shadow shapes all match. The stage
carries its own WorldEnvironment set to `tonemap_mode = AGX` with a flat COLOR
ambient (`sky_contribution = 0`), and that whole lighting model is reproduced: on
a controlled twin of this stage (`unit-stage-ambient-ibl`) the lit grass, the
shadowed grass, and a metallic sphere reflecting the sky all match real Godot to
within 6/255 — the metallic reflection to 1/255. The enemy (a GLB mesh) casts and
receives shadows on both sides, so it self-shadows as in Godot.

The remaining divergence is one gap, not a lighting bug: the stage draws its sky
from a **custom `sky` shader** (`skybox.gdshader`) sampling a **`CompressedCubemap`**
(`skybox.webp`), and lights reflections with **`ReflectionProbe`** nodes — none of
which this previewer supports (it does not execute GDShaders or decode compressed
cubemaps). With the sky unresolved the environment still applies AgX and the flat
ambient correctly (the diffuse terrain matches), but two things follow from having
no sky to reflect:

- **Coin bodies read grey.** The coin body is `metallic = 1`, so its colour is
  almost entirely the reflected sky. Godot reflects the gold-lit skybox; with no
  skybox we reflect near-black, so the bodies read dark grey instead of gold. Same
  cause for the enemy's visor and any other smooth metal. The lighting math is not
  at fault — swap the sky for a supported `ProceduralSkyMaterial` and the identical
  metal matches Godot to 1/255 (`unit-stage-ambient-ibl`).
- **Coin halos read faint.** The gold glow is the coin's `GlowSprite` — an additive,
  unshaded, billboarded `GradientTexture2D` quad. That mechanism is correct and
  reproduced (`unit-coin-glow`); `billboard_mode` now faces it at the camera. In
  Godot the halos pop because they sit over near-black shadow; here the same
  surfaces read a little brighter (this large level's sun shadow does not reach as
  far as Godot's, and there is no ReflectionProbe GI darkening the recesses), so
  the additive gold washes out rather than glowing. No post-process bloom is
  involved — the stage environment has glow off.
