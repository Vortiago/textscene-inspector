/**
 * StandardMaterial3D surface features, the noise textures that feed them, and
 * the sprites and transform-only bodies that carry them.
 */

export const MATERIAL_SCENES = [
  { name: 'material-ao', file: 'unit-material-ao.tscn' },
  { name: 'material-diffuse-mode', file: 'unit-material-diffuse-mode.tscn' },
  { name: 'material-specular-mode', file: 'unit-material-specular-mode.tscn' },
  { name: 'material-normal-map', file: 'unit-material-normal-map.tscn' },
  // A normal map with blue 0: Godot rebuilds blue from red and green, so the flat texel shades as the
  // bare plane. A read of the stored blue turns that half dark.
  { name: 'material-normal-map-blue', file: 'unit-material-normal-map-blue.tscn' },
  // A 2 by 4 quad, so the UV density differs per axis: each texel tilts by its authored angle on
  // both axes. A tangent frame scaled by the longer axis shades the X tilts flatter.
  { name: 'material-normal-map-uv-density', file: 'unit-material-normal-map-uv-density.tscn' },
  { name: 'material-textured', file: 'unit-material-textured.tscn' },
  { name: 'material-override', file: 'unit-material-override.tscn' },
  { name: 'surface-material-override', file: 'unit-surface-material-override.tscn' },
  // Multi-property guard, one row each: basic PBR, emission and normal,
  // advanced PBR, transparency and glass.
  { name: 'material-features', file: 'integration-material-features.tscn' },
  // StandardMaterial3D `billboard_mode = ENABLED` on a QuadMesh: the left quad
  // turns to face the camera while the DISABLED right quad foreshortens at the
  // editor orbit. The only golden that pairs a billboard with a DISABLED quad.
  // Sprite edges antialias against the ground.
  { name: 'material-billboard', file: 'unit-material-billboard.tscn' },
  // An additive, unshaded, billboarded QuadMesh with a radial GradientTexture2D
  // reads as a soft gold ring beside a metallic, emissive body. Pins the
  // additive billboard gradient glow. Additive edges are AA-sensitive.
  { name: 'coin-glow', file: 'unit-coin-glow.tscn' },
  // A GridMap tile whose material billboards, in three cells along X: each
  // square faces the camera about its own cell. The only GridMap golden whose
  // tiles billboard.
  { name: 'grid-map-billboard', file: 'unit-grid-map-billboard.tscn' },

  // The noise rasterisation pipeline on a Sprite2D: seeded FastNoiseLite
  // ridged fBm → normalise → seamless blend skirt → Gradient ramp.
  { name: 'noisetexture2d', file: 'unit-noisetexture2d.tscn', mode: '2d' },
  // A noise texture past one upload band, so it reaches the GPU in bands. Its
  // baseline is three's whole upload, so a pass means the bands give its pixels.
  { name: 'noisetexture2d-tiled', file: 'unit-noisetexture2d-tiled.tscn', mode: '2d' },
  // The as_normal_map arm under lighting: bump_to_normal_map's sign and packing
  // and the NoColorSpace tagging show only when a lit material perturbs its
  // normals with the result.
  { name: 'noisetexture2d-normal', file: 'unit-noisetexture2d-normal.tscn' },
  // The FastNoiseLite domain warp, which no other noise scene turns on.
  { name: 'noisetexture2d-domain-warp', file: 'unit-noisetexture2d-domain-warp.tscn', mode: '2d' },

  // Sprite2D, Sprite3D and 3D physics bodies.
  { name: 'sprite2d', file: 'unit-sprite2d.tscn', mode: '2d' },
  { name: 'sprite3d', file: 'unit-sprite3d.tscn' },
  // The one scene with a Sprite3D that has no texture. Godot's draw drops the mesh for both an unset
  // and a null texture (sprite_3d.cpp:798), so neither shows a placeholder between the anchors.
  { name: 'sprite3d-untextured', file: 'unit-sprite3d-untextured.tscn' },
  // An AtlasTexture crop of a normal-map sheet, minified: Godot samples the sheet's renormalised
  // chain, so the crop draws the same 45-degree colour as the sheet. An unnormalised crop draws duller.
  { name: 'atlastexture-normal-mipmap', file: 'unit-atlastexture-normal-mipmap.tscn', mode: '2d' },
  // A region_rect bigger than its texture: Godot clips neither, so the sampler
  // decides the overrun, and the two families disagree. A pair, so the shared UV
  // compositor cannot be "fixed" to agree with the wrong one.

  // The 2D canvas clamps to the edge texel: one "F" and a blue smear. Matches
  // Godot 4.6.3 pixel for pixel.
  { name: 'sprite2d-region-oversized', file: 'unit-sprite2d-region-oversized.tscn', mode: '2d' },
  // Sprite3D's material repeats: a 3x2 grid of "F"s. Measured against Godot 4.6.3.
  { name: 'sprite3d-region-oversized', file: 'unit-sprite3d-region-oversized.tscn' },
  // Transform-only bodies (ADR-0005/ADR-0008) reuse the Node3D component, so
  // the content is the child box or capsule mesh, not a grey placeholder.
  { name: 'rigidbody3d', file: 'unit-rigidbody3d.tscn' },
  { name: 'characterbody3d', file: 'unit-characterbody3d.tscn' },
  // `material_overlay`, which no other fixture sets: a second draw of the surface over the first
  // (`render_forward_clustered.cpp:4228-4241`), on the right box. Green: it never drew. Opaque red:
  // it replaced the surface. Muddied red over green: it composited, as it should. The fixture's
  // header says why the overlay is transparent, which puts it in the alpha pass.
  { name: 'meshinstance3d-material-overlay', file: 'unit-meshinstance3d-material-overlay.tscn' },
  // A `surface_material_override/0` as a scene `[sub_resource]` on a mesh
  // inside an instanced `.glb`, the only .glb scene. `unit-cube.glb` has no glTF
  // material, so a dropped override draws Godot's default grey and an applied
  // one this scene's orange.
  {
    name: 'glb-surface-material-override',
    file: 'unit-glb-surface-material-override.tscn',
  },
  // A `.glb` primitive with no glTF material, lit and not overridden: the importer's own
  // non-metallic StandardMaterial3D.
  { name: 'glb-default-material', file: 'unit-glb-default-material.tscn' },
  // An emission map drawn through the UV2 Godot's importer unwrapped into the `.glb`'s unwrap
  // cache, the only scene that samples UV2. Each face shows its own patch of the gradient bands.
  { name: 'glb-lightmap-uv2', file: 'unit-glb-lightmap-uv2.tscn' },
  // The one variable, carried by no other fixture: a node-level
  // `surface_material_override/N` over a baked mesh's surface material. Surface
  // 1 is overridden and surface 0 is not, so a leak onto every surface, a
  // dropped override and a wrong index give three different images.
  { name: 'arraymesh-surface-override', file: 'unit-arraymesh-surface-override.tscn' },
  // The saved format of an albedo ImageTexture: the same greys as Lum8, which has no sRGB view and
  // reads raw, over RGB8, which reads as sRGB. A format read the wrong way darkens or lifts a strip.
  { name: 'material-albedo-image-format', file: 'unit-material-albedo-image-format.tscn' },
  // The import format of an albedo image file: a greyscale PNG with no sidecar imports as Lum8 and
  // reads raw, the same PNG VRAM compressed reads as sRGB, as does an RGB PNG, and an RGB PNG imported
  // as an RGTC normal map reads red and green raw with blue 0. A wrong read shifts a strip.
  { name: 'material-albedo-image-import', file: 'unit-material-albedo-image-import.tscn' },
  // The mip chain of an imported image, which Godot builds on the CPU: a red and green checker
  // averages its bytes to a dark yellow, and a normal map renormalises each level. A chain averaged
  // in linear space brightens the checker, and one left unnormalised tilts the lit strip less.
  { name: 'material-mipmap-import', file: 'unit-material-mipmap-import.tscn' },
  // The project's `texture_mipmap_bias` of -0.5 on a mipmapped checker floor seen at a grazing angle:
  // Godot samples a sharper level, so the far squares stay crisp. An unbiased floor blurs to grey sooner.
  { name: 'material-mipmap-bias', file: 'mipmap-bias/unit-material-mipmap-bias.tscn' },
  // The roughness limiter on an imported roughness map's chain: the left sphere's sidecar names its
  // normal map, so its minified highlight spreads and dims. A chain left unlimited keeps it tight.
  { name: 'material-roughness-limiter', file: 'unit-material-roughness-limiter.tscn' },
  // The limiter's derivative of a normal-mapped normal, on a map too large to minify: a coarse
  // derivative spreads the sun's highlight in 2 x 2 blocks, a per-pair difference as Godot's fine one does.
  { name: 'material-roughness-limiter-derivative', file: 'unit-material-roughness-limiter-derivative.tscn' },
  // The channel a roughness or metallic map is read from: one map holds red 20 and green and blue
  // 235, read from red. A green roughness read turns the left sphere matte, and a blue metallic read
  // turns the right one metal.
  { name: 'material-texture-channel', file: 'unit-material-texture-channel.tscn' },
  // A wrapped albedo texture: an AtlasTexture binds its whole sheet, not its region, and a
  // CanvasTexture binds Godot's white default. A cropped sheet or a drawn diffuse shows at once.
  { name: 'material-albedo-atlas-texture', file: 'unit-material-albedo-atlas-texture.tscn' },
  // ADD emission with a lit colour and a texture: each texel adds to the colour, so a multiply
  // darkens the blue and green texels to black.
  { name: 'material-emission-add', file: 'unit-material-emission-add.tscn' },
  // Decal `texture_albedo` as an inline GradientTexture2D. The albedo is all a
  // decal projects, so an unresolved slot leaves the floor bare.
  { name: 'decal-gradienttexture', file: 'unit-decal-gradienttexture.tscn' },
  // Decal `texture_albedo` as an AtlasTexture: a decal takes the texture's RID, so it projects the
  // whole sheet. A cropped region projects one red square.
  { name: 'decal-atlas-texture', file: 'unit-decal-atlas-texture.tscn' },
  // A minified decal over an import with no mipmaps: the atlas halves each level in bytes, so the
  // red and green checker draws dark yellow. A chain averaged in linear space draws it brighter.
  { name: 'decal-mipmap-import', file: 'unit-decal-mipmap-import.tscn' },
  // The one MeshInstance3D material from an external `.tres`, and the one
  // roughness map with contrast: a glossy cap and a rough one meet at a hard
  // seam. If the map fails to arrive, both caps go matte. Other roughness
  // fixtures map a flat 50% grey that renders like the scalar.
  { name: 'external-material-roughness', file: 'unit-external-material-roughness.tscn' },
];
