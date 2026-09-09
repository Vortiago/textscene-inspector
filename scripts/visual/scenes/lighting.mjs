/**
 * Materials that emit, glow, the environment, the light-transport pair and the
 * skies — the goldens whose subject is how ENERGY reaches a surface.
 */

export const LIGHTING_SCENES = [
  { name: 'material-metallic', file: 'unit-material-metallic.tscn' },
  { name: 'material-emissive', file: 'unit-material-emissive.tscn' },
  // Glow and emission, one variable per scene. Each fixture's own header states
  // which variable and why a regression in it would be invisible elsewhere.
  { name: 'glow-authored', file: 'unit-glow-authored.tscn' },
  { name: 'glow-strength', file: 'unit-glow-strength.tscn' },
  { name: 'glow-softlight', file: 'unit-glow-softlight.tscn' },
  { name: 'glow-mix', file: 'unit-glow-mix.tscn' },
  { name: 'glow-replace', file: 'unit-glow-replace.tscn' },
  { name: 'glow-bloom-floor', file: 'unit-glow-bloom-floor.tscn' },
  { name: 'glow-normalized', file: 'unit-glow-normalized.tscn' },
  { name: 'glow-agx', file: 'unit-glow-agx.tscn' },
  { name: 'glow-exposure', file: 'unit-glow-exposure.tscn' },
  // Raised threshold: a 4x4 checkerboard on two quads carries far more edge than
  // the silhouette-only scenes the default is tuned for.
  { name: 'material-emission-texture', file: 'unit-material-emission-texture.tscn', maxDiffPct: 0.6 },
  { name: 'material-emission-hdr', file: 'unit-material-emission-hdr.tscn' },
  // Height mapping: a local grayscale height SVG drives displacementMap on a
  // finely-subdivided sphere — the baseline pins that the relief actually
  // renders (a normal map, or a missing displacementMap, reads as a flat ball).
  { name: 'material-heightmap', file: 'unit-material-heightmap.tscn' },
  { name: 'world-environment', file: 'unit-world-environment-basic.tscn' },
  // Godot's editor preview sun + preview environment on a scene that declares
  // neither (ADR-0025). Godot's own render of the same lighting is committed at
  // scripts/godot-ref/reference/preview-lighting.png. Shadow-bearing, hence the
  // relaxed threshold shared with the other shadow scenes.
  { name: 'preview-lighting', file: 'unit-preview-lighting.tscn', maxDiffPct: 0.5 },
  // The light-transport pair, one per way energy reaches a surface. Each puts
  // an UNSHADED patch of the surface's own albedo onto the lit plane, and both
  // Godot equations say a white energy-1.0 source renders exactly that albedo
  // — so the patch is invisible when the scale is right and obvious when it is
  // not. These read as a flat grey square by design; a visible seam is the
  // failure. `LIGHT_INTENSITY_SCALE` at its old value of 2 showed one.
  { name: 'light-transport-direct', file: 'unit-light-transport-direct.tscn' },
  { name: 'light-transport-ambient', file: 'unit-light-transport-ambient.tscn' },
  // The sky pair. `-sky` is a UNIFORM white sky, so it pins the IBL's scale
  // with the filter shape removed (a convolution of a constant is that same
  // constant). `-sky-graded` carries the editor preview's own gradient and a
  // floor plus a wall, so it pins the DIRECTIONALITY the uniform one cannot
  // see.
  { name: 'light-transport-sky', file: 'unit-light-transport-sky.tscn' },
  { name: 'light-transport-sky-graded', file: 'unit-light-transport-sky-graded.tscn' },
  // Scene-owned skies, authored away from Godot's defaults so the gradient and
  // the sun disc are legible. Both carry their own light AND environment, so
  // they also pin that BOTH previews yield.
  { name: 'sky-procedural', file: 'unit-sky-procedural.tscn', maxDiffPct: 0.5 },
  { name: 'sky-physical', file: 'unit-sky-physical.tscn', maxDiffPct: 0.5 },
  // Locks the equirect V/U orientation (measured against real Godot); the black
  // grid lines antialias, so it shares the sky scenes' relaxed threshold.
  { name: 'sky-panorama', file: 'unit-sky-panorama.tscn', maxDiffPct: 0.5 },
  // BG_SKY over a GOLD sky with AMBIENT_SOURCE_COLOR (flat grey 0.6,
  // sky_contribution 0) and AgX tonemapping. Pins two things together — the
  // shadowed grass stays grey (no sky IBL leaking into diffuse) while the
  // metallic sphere reflects the gold sky at full strength (reflection stays on
  // under a COLOR ambient). Matches real Godot to ≤6/255 (reflection to 1/255);
  // shadows + a metallic reflection are the most GPU-sensitive content, hence
  // the relaxed threshold.
  { name: 'stage-ambient-ibl', file: 'unit-stage-ambient-ibl.tscn', maxDiffPct: 0.5 },
  // The same env with the WorldEnvironment INSTANCED one level down. Renders
  // pixel-for-pixel like the direct fixture above — pins that an instanced
  // WorldEnvironment still drives tonemap + ambient and yields the editor
  // preview environment. If instance env-resolution regresses, this diverges
  // while stage-ambient-ibl stays green.
  { name: 'instanced-environment', file: 'unit-instanced-environment.tscn', maxDiffPct: 0.5 },
  // The same env with an UNSUPPORTED custom-shader sky. Pins that an unresolvable
  // sky does NOT collapse the environment: AgX + flat ambient still apply (grass
  // identical to the gold-sky fixture), the background falls back to the mid-blue
  // solid, and the metallic sphere — with no sky to reflect — reads near-black.
  { name: 'shader-sky-env', file: 'unit-shader-sky-env.tscn', maxDiffPct: 0.5 },
];
