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
  // The Linear upscale mode, from a Fixture project's project.godot: a bilinear read of each level.
  { name: 'glow-linear-upscale', file: 'glow-linear-upscale/unit-glow-linear-upscale.tscn' },
  // A frame under 256 px has fewer glow levels, and a weighted level past the last reads that one:
  // unit-glow-authored weights its two coarsest levels. 96 px clamps both, 200 px clamps the last.
  { name: 'glow-small-frame-96', file: 'unit-glow-authored.tscn', canvas: { width: 96, height: 96 } },
  { name: 'glow-small-frame-200', file: 'unit-glow-authored.tscn', canvas: { width: 200, height: 156 } },
  // `tonemap_exposure` under LINEAR with no compositor: three draws the curve per material.
  { name: 'environment-linear-exposure', file: 'unit-environment-linear-exposure.tscn' },
  { name: 'glow-specular', file: 'unit-glow-specular.tscn' },
  { name: 'glow-map', file: 'unit-glow-map.tscn' },
  // A 4x4 checkerboard on two quads carries far more edge than a
  // silhouette-only scene.
  { name: 'material-emission-texture', file: 'unit-material-emission-texture.tscn' },
  { name: 'material-emission-hdr', file: 'unit-material-emission-hdr.tscn' },
  // A local greyscale height SVG drives displacementMap on a finely subdivided
  // sphere. A normal map, or a missing displacementMap, reads as a flat ball.
  { name: 'material-heightmap', file: 'unit-material-heightmap.tscn' },
  { name: 'world-environment', file: 'unit-world-environment-basic.tscn' },
  // A WorldEnvironment that names no Environment: the root tonemaps LINEAR, as Godot's does.
  { name: 'world-environment-none', file: 'unit-world-environment-none.tscn' },
  // A WorldEnvironment whose Environment .tres is missing draws as one that names none.
  { name: 'world-environment-missing', file: 'unit-world-environment-missing.tscn' },
  // Two WorldEnvironments: the first in tree order applies, though it loads from a sub-scene last.
  { name: 'world-environment-tree-order', file: 'unit-world-environment-tree-order.tscn' },
  // Exponential depth fog over boxes at three distances. The header states why no other golden
  // shows it.
  { name: 'depth-fog', file: 'unit-depth-fog.tscn' },
  { name: 'depth-fog-orthographic', file: 'unit-depth-fog-orthographic.tscn', camera: 'Root/Camera3D' },
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
  // A shadowed spot's origin inside the volumetric fog in view. The header states why no other golden shows it.
  { name: 'volumetric-fog-spot-origin', file: 'unit-volumetric-fog-spot-origin.tscn', camera: 'Root/Camera' },
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
  // A FogVolume whose ShaderMaterial Godot cannot run as fog. The header states why no other
  // golden shows it.
  { name: 'fog-volume-shader-material', file: 'unit-fog-volume-shader-material.tscn' },
  // A FogVolume whose ShaderMaterial holds a null shader. The header states why no other golden
  // shows it.
  { name: 'fog-volume-shader-null', file: 'unit-fog-volume-shader-null.tscn' },
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
  { name: 'sky-orthographic', file: 'unit-sky-orthographic.tscn', camera: 'Root/Camera3D' },
  { name: 'sky-debanding-off', file: 'unit-sky-debanding-off.tscn', camera: 'Root/Camera3D' },
  { name: 'sky-physical', file: 'unit-sky-physical.tscn' },
  // A 3 degree sun in the procedural sky, which Godot draws as a disc of that angular size.
  { name: 'sky-sun-angular-distance', file: 'unit-sky-sun-angular-distance.tscn' },
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
  // A PanoramaSkyMaterial .tres whose panorama is its own sub-resource. The header states why no
  // other golden shows it.
  { name: 'sky-panorama-tres', file: 'unit-sky-panorama-tres.tscn' },
  // Two overlapping ReflectionProbes that update ALWAYS: the floor takes its ambient and its
  // reflection from the fast-filtered captures, which the blue background tints.
  { name: 'reflection-probe-always', file: 'unit-reflection-probe-always.tscn' },
  // box_projection on one ReflectionProbe: a mirror sphere reads its importance-sampled capture
  // where the reflection leaves the box.
  { name: 'reflection-probe-box-projection', file: 'unit-reflection-probe-box-projection.tscn' },
  // AMBIENT_COLOR on one ReflectionProbe: the floor in its box takes a red ambient.
  { name: 'reflection-probe-ambient-color', file: 'unit-reflection-probe-ambient-color.tscn' },
  // CameraAttributesPractical at exposure_multiplier 2: Godot scales a light's energy, an emission and
  // a colour background by it, and a flat ambient not at all.
  { name: 'camera-attributes-exposure', file: 'unit-camera-attributes-exposure.tscn', camera: 'Root/Camera3D' },
  // Camera3D.attributes at exposure_multiplier 2 over a WorldEnvironment at 0.25: the camera's
  // attributes replace the world's, so the frame draws as the golden above does.
  {
    name: 'camera-attributes-exposure-camera',
    file: 'unit-camera-attributes-exposure-camera.tscn',
    camera: 'Root/Camera3D',
  },
  // The same exposure over a procedural sky: the sky's background scales by the factor, its ambient and
  // reflection by its square.
  { name: 'camera-attributes-exposure-sky', file: 'unit-camera-attributes-exposure-sky.tscn', camera: 'Root/Camera3D' },
  // A LightmapGI bake lights a box and the ground: a Static sun's light, its shadow and a red
  // bounce, all read from the atlas through UV2. The headers state why no other golden shows it.
  { name: 'lightmap-gi-baked', file: 'unit-lightmap-gi-baked.tscn' },
  // The same bake under CameraAttributes at exposure_multiplier 2: Godot reads the atlas at the factor
  // over the exposure the bake ran at.
  { name: 'lightmap-gi-exposure', file: 'unit-lightmap-gi-exposure.tscn' },
  // A GLB box named by the bake whose unwrap the project commits no cache for: it reads no
  // lightmap and draws with ambient light, where the ground still reads its atlas.
  { name: 'lightmap-gi-glb-unwrap-miss', file: 'unit-glb-lightmap-miss.tscn' },
  // The same scene baked directional: the read weighs four spherical-harmonics layers by the normal.
  { name: 'lightmap-gi-directional', file: 'unit-lightmap-gi-directional.tscn' },
  // A baked GridMap: its baked meshes draw in place of the cells, each lit by its sub-instance.
  { name: 'lightmap-gi-gridmap', file: 'unit-lightmap-gi-gridmap.tscn' },
  // A LightmapGI bake with a shadowmask in Replace mode: the baked shadow takes the place of the
  // sun's real-time shadow where it fades out, 3 m from the camera. The header states why no other
  // golden shows it.
  { name: 'lightmap-gi-shadowmask-replace', file: 'unit-lightmap-gi-shadowmask-replace.tscn', camera: 'Root/Camera3D' },
  // The same bake in Overlay mode: the baked shadow multiplies the real-time shadow.
  { name: 'lightmap-gi-shadowmask-overlay', file: 'unit-lightmap-gi-shadowmask-overlay.tscn', camera: 'Root/Camera3D' },
  // The same bake in Only mode: the real-time shadow is skipped and the baked shadow stands alone.
  { name: 'lightmap-gi-shadowmask-only', file: 'unit-lightmap-gi-shadowmask-only.tscn', camera: 'Root/Camera3D' },
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
