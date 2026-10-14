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
  // Exponential depth fog over boxes at three distances. The header states why no other golden
  // shows it.
  { name: 'depth-fog', file: 'unit-depth-fog.tscn' },
  // The Environment's brightness, contrast and saturation over an unshaded box. The header states
  // why no other golden shows them.
  { name: 'environment-adjustments', file: 'unit-environment-adjustments.tscn' },
  // An area light's scatter in volumetric fog, from Godot 4.7.2. The header states why no other
  // golden shows it.
  { name: 'area-light-fog', file: 'unit-area-light-fog.tscn' },
  // An area light's shadow in volumetric fog, from Godot 4.7.2. The header states why no other
  // golden shows it.
  { name: 'area-light-fog-shadow', file: 'unit-area-light-fog-shadow.tscn' },
  // A directional shadow in the volumetric fog. The header states why no other golden shows it.
  { name: 'volumetric-fog-shadow', file: 'unit-volumetric-fog-shadow.tscn' },
  // The spot shadow bias in the volumetric fog. The header states why no other golden shows it.
  { name: 'volumetric-fog-spot-shadow-bias', file: 'unit-volumetric-fog-spot-shadow-bias.tscn' },
  // A colour background under thin volumetric fog. The header states why no other golden shows it.
  { name: 'volumetric-fog-color-background', file: 'unit-volumetric-fog-color-background.tscn' },
  // A box FogVolume in the volumetric fog. The header states why no other golden shows it.
  { name: 'fog-volume', file: 'unit-fog-volume.tscn' },
  // A FogVolume whose density texture is an imported 3D texture. The header states why no other
  // golden shows it.
  { name: 'fog-volume-density-image', file: 'unit-fog-volume-density-image.tscn' },
  // A FogVolume whose density texture is an ImageTexture3D saved as its own .tres. The header
  // states why no other golden shows it.
  { name: 'fog-volume-density-volume-tres', file: 'unit-fog-volume-density-volume-tres.tscn' },
  { name: 'fog-volume-density-half-tres', file: 'unit-fog-volume-density-half-tres.tscn' },
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
  // The procedural sky at sky_energy_multiplier 2, which Godot applies before the linear conversion.
  { name: 'sky-energy', file: 'unit-sky-energy.tscn' },
  // The procedural sky with Real-Time processing, which Godot bakes with its fast filter. The
  // metallic sphere reads layers 4 and 5, and the default sphere's ambient reads layer 6.
  { name: 'sky-realtime', file: 'unit-sky-realtime.tscn' },
  // The procedural sky at radiance_size 32, the smallest: a mirror and a rough sphere read layers
  // filtered from a 32-wide octmap and its short chain.
  { name: 'sky-radiance-size-32', file: 'unit-sky-radiance-size-32.tscn' },
  // Locks the equirect V/U orientation, measured against Godot. The black grid
  // lines antialias.
  { name: 'sky-panorama', file: 'unit-sky-panorama.tscn' },
  // Two overlapping ReflectionProbes that update ALWAYS: the floor takes its ambient and its
  // reflection from the fast-filtered captures, which the blue background tints.
  { name: 'reflection-probe-always', file: 'unit-reflection-probe-always.tscn' },
  // box_projection on one ReflectionProbe: a mirror sphere reads its importance-sampled capture
  // where the reflection leaves the box.
  { name: 'reflection-probe-box-projection', file: 'unit-reflection-probe-box-projection.tscn' },
  // AMBIENT_COLOR on one ReflectionProbe: the floor in its box takes a red ambient.
  { name: 'reflection-probe-ambient-color', file: 'unit-reflection-probe-ambient-color.tscn' },
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
