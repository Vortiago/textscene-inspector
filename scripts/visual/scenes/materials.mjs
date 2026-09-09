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
  // Multi-property showcase guard (12 spheres across 4 rows: basic PBR,
  // emission/normal, advanced PBR, transparency/glass).
  { name: 'material-features', file: 'integration-material-features.tscn', maxDiffPct: 0.5 },
  // StandardMaterial3D `billboard_mode = ENABLED` on a QuadMesh: the left quad
  // must turn to face the camera (full asymmetric walk sprite) while the right
  // quad (billboard_mode = DISABLED) foreshortens at the editor orbit. The only
  // golden that exercises mesh billboarding — every other fixture leaves it
  // inert. Sprite edges antialias against the ground, hence the relaxed
  // threshold.
  { name: 'material-billboard', file: 'unit-material-billboard.tscn', maxDiffPct: 0.5 },
  // An additive, unshaded, billboarded QuadMesh with a radial GradientTexture2D
  // reads as a soft gold ring over the dark ground, beside a metallic + emissive
  // body. Pins the additive-billboard-gradient glow path. Additive edges →
  // relaxed threshold.
  { name: 'coin-glow', file: 'unit-coin-glow.tscn', maxDiffPct: 0.5 },

  // The colour-ramp noise golden: pins the rasterisation pipeline (seeded
  // FastNoiseLite ridged fBm → normalize → seamless blend skirt → Gradient
  // ramp) on a Sprite2D. Besides these two, no other scene carries any noise
  // texture, so a generator/default drift or a broken skirt is invisible in
  // every other golden.
  { name: 'noisetexture2d', file: 'unit-noisetexture2d.tscn' },
  // The as_normal_map arm under lighting: bump_to_normal_map's sign/packing
  // and the NoColorSpace tagging only surface when a lit material perturbs
  // its normals with the result — the ramp golden above is unlit 2D.
  { name: 'noisetexture2d-normal', file: 'unit-noisetexture2d-normal.tscn' },

  // --- Sprite2D/Sprite3D + 3D physics-body roundout ---
  { name: 'sprite2d', file: 'unit-sprite2d.tscn' },
  { name: 'sprite3d', file: 'unit-sprite3d.tscn' },
  // A region_rect bigger than its texture. Godot clips neither the region nor
  // the quad, so the overrun is decided by the sampler — and the two families
  // disagree: the 2D canvas clamps to the edge texel (one "F" plus a blue
  // smear), Sprite3D's material repeats (a 3x2 grid of "F"s). Both measured
  // against Godot 4.6.3; the 2D side matches it pixel-for-pixel. They are a
  // PAIR: pinning one alone would let the shared UV compositor be "fixed" into
  // agreeing with the wrong one.
  { name: 'sprite2d-region-oversized', file: 'unit-sprite2d-region-oversized.tscn' },
  { name: 'sprite3d-region-oversized', file: 'unit-sprite3d-region-oversized.tscn' },
  // Transform-only bodies (ADR-0005/ADR-0008): reuse the Node3D component, so
  // the baseline's real content is the child mesh — pins that these render
  // the actual box/capsule geometry, not a gray fallback placeholder.
  { name: 'rigidbody3d', file: 'unit-rigidbody3d.tscn' },
  { name: 'characterbody3d', file: 'unit-characterbody3d.tscn' },
];
