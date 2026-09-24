/**
 * StandardMaterial3D surface features, the noise textures that feed them, and
 * the sprites and transform-only bodies that carry them.
 */

export const MATERIAL_SCENES = [
  { name: 'material-ao', file: 'unit-material-ao.tscn' },
  { name: 'material-normal-map', file: 'unit-material-normal-map.tscn' },
  { name: 'material-textured', file: 'unit-material-textured.tscn' },
  { name: 'material-override', file: 'unit-material-override.tscn' },
  { name: 'surface-material-override', file: 'unit-surface-material-override.tscn' },
  // Multi-property guard, one row each: basic PBR, emission and normal,
  // advanced PBR, transparency and glass.
  { name: 'material-features', file: 'integration-material-features.tscn' },
  // StandardMaterial3D `billboard_mode = ENABLED` on a QuadMesh: the left quad
  // turns to face the camera while the DISABLED right quad foreshortens at the
  // editor orbit. The only golden with mesh billboarding. Sprite edges
  // antialias against the ground.
  { name: 'material-billboard', file: 'unit-material-billboard.tscn' },
  // An additive, unshaded, billboarded QuadMesh with a radial GradientTexture2D
  // reads as a soft gold ring beside a metallic, emissive body. Pins the
  // additive billboard gradient glow. Additive edges are AA-sensitive.
  { name: 'coin-glow', file: 'unit-coin-glow.tscn' },

  // The noise rasterisation pipeline on a Sprite2D: seeded FastNoiseLite
  // ridged fBm → normalise → seamless blend skirt → Gradient ramp. These two are
  // the only scenes with a noise texture.
  { name: 'noisetexture2d', file: 'unit-noisetexture2d.tscn', mode: '2d' },
  // The as_normal_map arm under lighting: bump_to_normal_map's sign and packing
  // and the NoColorSpace tagging show only when a lit material perturbs its
  // normals with the result.
  { name: 'noisetexture2d-normal', file: 'unit-noisetexture2d-normal.tscn' },

  // Sprite2D, Sprite3D and 3D physics bodies.
  { name: 'sprite2d', file: 'unit-sprite2d.tscn', mode: '2d' },
  { name: 'sprite3d', file: 'unit-sprite3d.tscn' },
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
  // `material_overlay`, which no other fixture sets: a second draw of the
  // surface over the first (`render_forward_clustered.cpp:4228-4241`), on the
  // right box. Green means it never drew, opaque red that it replaced the
  // surface, and muddied red over green that it composited, which is correct.

  // The overlay is transparent, since an opaque one looks the same composited
  // or replaced. That puts it in the alpha pass, where its draw order relative
  // to its own surface is most likely to regress.
  { name: 'meshinstance3d-material-overlay', file: 'unit-meshinstance3d-material-overlay.tscn' },
  // A `surface_material_override/0` as a scene `[sub_resource]` on a mesh
  // inside an instanced `.glb`, the only .glb scene. `unit-cube.glb` has no glTF
  // material, so a dropped override draws Godot's default grey and an applied
  // one this scene's orange.
  {
    name: 'glb-surface-material-override',
    file: 'unit-glb-surface-material-override.tscn',
  },
  // The one variable, carried by no other fixture: a node-level
  // `surface_material_override/N` over a baked mesh's surface material. Surface
  // 1 is overridden and surface 0 is not, so a leak onto every surface, a
  // dropped override and a wrong index give three different images.
  { name: 'arraymesh-surface-override', file: 'unit-arraymesh-surface-override.tscn' },
  // Decal `texture_albedo` as an inline GradientTexture2D. The albedo is all a
  // decal projects, so an unresolved slot leaves the floor bare.
  { name: 'decal-gradienttexture', file: 'unit-decal-gradienttexture.tscn' },
  // The one MeshInstance3D material from an external `.tres`, and the one
  // roughness map with contrast: a glossy cap and a rough one meet at a hard
  // seam. If the map fails to arrive, both caps go matte. Other roughness
  // fixtures map a flat 50% grey that renders like the scalar.
  { name: 'external-material-roughness', file: 'unit-external-material-roughness.tscn' },
];
