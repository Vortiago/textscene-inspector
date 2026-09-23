/**
 * Materials that emit, glow, the environment, the light-transport pair and the
 * skies: the goldens whose subject is how energy reaches a surface.
 */

export const LIGHTING_SCENES = [
  { name: 'material-metallic', file: 'unit-material-metallic.tscn' },
  { name: 'material-emissive', file: 'unit-material-emissive.tscn' },
  // Glow and emission, one variable per scene. Each fixture's header states
  // which variable and why a regression in it is invisible elsewhere.
  { name: 'glow-authored', file: 'unit-glow-authored.tscn' },
  { name: 'glow-strength', file: 'unit-glow-strength.tscn' },
  { name: 'glow-softlight', file: 'unit-glow-softlight.tscn' },
  { name: 'glow-mix', file: 'unit-glow-mix.tscn' },
  { name: 'glow-replace', file: 'unit-glow-replace.tscn' },
  { name: 'glow-bloom-floor', file: 'unit-glow-bloom-floor.tscn' },
  { name: 'glow-normalized', file: 'unit-glow-normalized.tscn' },
  { name: 'glow-agx', file: 'unit-glow-agx.tscn' },
  { name: 'glow-exposure', file: 'unit-glow-exposure.tscn' },
  // A 4x4 checkerboard on two quads carries far more edge than a
  // silhouette-only scene.
  { name: 'material-emission-texture', file: 'unit-material-emission-texture.tscn' },
  { name: 'material-emission-hdr', file: 'unit-material-emission-hdr.tscn' },
  // A local greyscale height SVG drives displacementMap on a finely subdivided
  // sphere. A normal map, or a missing displacementMap, reads as a flat ball.
  { name: 'material-heightmap', file: 'unit-material-heightmap.tscn' },
  { name: 'world-environment', file: 'unit-world-environment-basic.tscn' },
  // Godot's editor preview sun and environment on a scene that declares neither
  // (ADR-0025). Godot's render of it is at
  // scripts/godot-ref/reference/preview-lighting.png. Shadow-bearing.
  { name: 'preview-lighting', file: 'unit-preview-lighting.tscn' },
  // The light-transport pair, one per way energy reaches a surface. Each puts
  // an unshaded patch of the surface's albedo on the lit plane. Godot renders a
  // white energy-1.0 source as exactly that albedo, so a correct
  // `LIGHT_INTENSITY_SCALE` reads as a flat grey square and a wrong one a seam.
  { name: 'light-transport-direct', file: 'unit-light-transport-direct.tscn' },
  { name: 'light-transport-ambient', file: 'unit-light-transport-ambient.tscn' },
  // A uniform white sky pins the IBL's scale with the filter shape removed: a
  // convolution of a constant is that constant.
  { name: 'light-transport-sky', file: 'unit-light-transport-sky.tscn' },
  // The editor preview's gradient over a floor and a wall pins directionality.
  { name: 'light-transport-sky-graded', file: 'unit-light-transport-sky-graded.tscn' },
  // Scene-owned skies, authored away from Godot's defaults so the gradient and
  // the sun disc are legible. Both carry their own light and environment, so
  // they also pin that both previews yield.
  { name: 'sky-procedural', file: 'unit-sky-procedural.tscn' },
  { name: 'sky-physical', file: 'unit-sky-physical.tscn' },
  // Locks the equirect V/U orientation, measured against Godot. The black grid
  // lines antialias.
  { name: 'sky-panorama', file: 'unit-sky-panorama.tscn' },
  // BG_SKY over a gold sky with AMBIENT_SOURCE_COLOR (grey 0.6, sky_contribution
  // 0) and AgX. The shadowed grass stays grey, with no sky IBL in diffuse, while
  // the metallic sphere reflects the gold sky in full. Matches Godot to ≤6/255,
  // the reflection to 1/255.
  { name: 'stage-ambient-ibl', file: 'unit-stage-ambient-ibl.tscn' },
  // The same environment with the WorldEnvironment instanced one level down. It
  // renders like `stage-ambient-ibl`: an instanced WorldEnvironment still drives
  // tonemap and ambient and makes the editor preview environment yield.
  { name: 'instanced-environment', file: 'unit-instanced-environment.tscn' },
  // The same environment with an unsupported custom-shader sky, which must not
  // collapse it: AgX and flat ambient still apply, the background falls back to
  // mid-blue, and the metallic sphere, with no sky to reflect, reads near-black.
  { name: 'shader-sky-env', file: 'unit-shader-sky-env.tscn' },
];
