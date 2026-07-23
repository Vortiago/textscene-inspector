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
carries its own WorldEnvironment set to `tonemap_mode = AGX`, and Godot's AgX is
now ported (fixture-exact to within 2/255 on a controlled AGX-shadow scene), so
the shadows darken toward Godot's near-black rather than staying flatly lit, and
the lit grass reads Godot's warmer, deeper tone. The enemy (a GLB mesh) casts and
receives shadows on both sides now, so it self-shadows as in Godot.

Two differences remain, each a separate parity gap rather than a bug here:

- **Shadow depth.** After the AgX port the shadowed grass still reads a little
  brighter than Godot (mean ≈ 40 vs 23). The curve is correct — the residual is
  *upstream radiance*: our shadowed surfaces receive slightly more pre-tonemap
  light (a flat-ambient / shadow-attenuation parity question), not the tone curve.
- **Coins.** The coin glow is a billboarded quad with an additive `GradientTexture2D`
  sprite; the gradient texture now renders, but the material's `billboard_mode`
  (face-camera) is not yet applied to a mesh, so at this angled camera the fixed
  quad foreshortens and the halo reads faint. The coin body is metallic gold, which
  reflects the sky differently than Godot under our environment. Neither is a glow
  bug — the environment glow itself is reproduced elsewhere (see the Material
  showcase).
