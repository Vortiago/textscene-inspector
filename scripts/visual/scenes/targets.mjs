/**
 * Batched tile geometry, the RemoteTransform relays that drive another node,
 * the goldens that sample content through a SubViewport target, the own-world
 * SubViewports that must leave the root image alone, and MSAA.
 */

export const TILE_AND_TARGET_SCENES = [
  // TileMap and TileMapLayer batched geometry.
  { name: 'tile-map', file: 'unit-tile-map.tscn', mode: '2d' },
  { name: 'tile-map-layer', file: 'unit-tile-map-layer.tscn', mode: '2d' },
  // Six cells of one atlas tile at six orientations, with the flip and transpose
  // bits in the alternative id as Godot paints them. Every other tile fixture
  // uses alternativeId 0. The marker glyph is asymmetric on both axes, and a wrong
  // composition order moves only the four transposed cells, 0.21% of the frame.
  { name: 'tile-map-layer-flips', file: 'unit-tile-map-layer-flips.tscn', mode: '2d' },
  { name: 'tile-map-layer-isometric', file: 'unit-tile-map-layer-isometric.tscn', mode: '2d' },
  // Y-sort: sibling y-sort subtrees (Floor, Walls, Decorations under a
  // non-y-sorted root) layer in disjoint tree-ordered z-bands, and each layer's
  // tiles interleave with decorations by Y. No decoration hides behind the floor.
  // A slow CI runner takes over 30 s, Playwright's default, to find the frame stable.
  { name: 'isometric-dungeon', file: 'dungeon.tscn', mode: '2d', settleTimeout: 120000 },
  // Hexagon grid (shape=3, vertical offset axis): odd columns stagger by half a
  // tile.
  { name: 'tile-map-layer-hexagon', file: 'unit-tile-map-layer-hexagon.tscn', mode: '2d' },
  // Cells of two atlas sources alternate in one rendering quadrant, each overlapping the next.
  // Godot draws them in cell order, not grouped by source. Verified against Godot 4.6.3.
  { name: 'tile-map-layer-mixed-sources', file: 'unit-tile-map-layer-mixed-sources.tscn', mode: '2d' },
  // The one scene with an atlas source that has no texture. Godot skips its cell
  // (tile_map_layer.cpp:724), so no placeholder shows between the textured cells.
  {
    name: 'tile-map-layer-untextured-source',
    file: 'unit-tile-map-layer-untextured-source.tscn',
    mode: '2d',
  },
  // `use_texture_padding` on and off, under linear and nearest filtering. Verified against Godot 4.6.3.
  {
    name: 'tile-map-layer-texture-padding',
    file: 'unit-tile-map-layer-texture-padding.tscn',
    mode: '2d',
  },
  // The scenes of a TileSetScenesCollectionSource instantiated at their cells, and the editor's
  // placeholder disc for the tiles that ask for it (Gizmos on). Verified against Godot 4.6.3.
  { name: 'tile-map-layer-scene-tiles', file: 'unit-tile-map-layer-scene-tiles.tscn', mode: '2d' },
  {
    name: 'tile-map-layer-scene-tile-control-sort',
    file: 'unit-tile-map-layer-scene-tile-control-sort.tscn',
    mode: '2d',
  },
  {
    name: 'tile-map-layer-scene-tile-control-odd-grid',
    file: 'unit-tile-map-layer-scene-tile-control-odd-grid.tscn',
    mode: '2d',
  },
  {
    name: 'tile-map-layer-scene-tile-control-z',
    file: 'unit-tile-map-layer-scene-tile-control-z.tscn',
    mode: '2d',
  },
  {
    name: 'tile-map-layer-scene-tile-placeholders',
    file: 'unit-tile-map-layer-scene-tile-placeholders.tscn',
    mode: '2d',
    gizmos: true,
  },
  // A tile's own TileData. Each scene moves one property, and its header says why.
  { name: 'tile-map-layer-tile-modulate', file: 'unit-tile-map-layer-tile-modulate.tscn', mode: '2d' },
  { name: 'tile-map-layer-tile-material', file: 'unit-tile-map-layer-tile-material.tscn', mode: '2d' },
  { name: 'tile-map-layer-tile-z-index', file: 'unit-tile-map-layer-tile-z-index.tscn', mode: '2d' },
  {
    name: 'tile-map-layer-tile-y-sort-origin',
    file: 'unit-tile-map-layer-tile-y-sort-origin.tscn',
    mode: '2d',
  },
  // A y-sorted layer, rotated and scaled: each row draws through the layer's transform and sorts
  // by its origin's y in the parent's space. Verified against Godot 4.6.3.
  {
    name: 'tile-map-layer-y-sort-transform',
    file: 'unit-tile-map-layer-y-sort-transform.tscn',
    mode: '2d',
  },

  // A y-sorted layer's child nodes sort with its tile rows, at the root of a sort and lifted into
  // a y-sorted parent. Verified against Godot 4.6.3.
  {
    name: 'tile-map-layer-y-sort-children',
    file: 'unit-tile-map-layer-y-sort-children.tscn',
    mode: '2d',
  },

  // The child slides across a row: at 0.5 s it has passed row 1 and sits above row 2, so it
  // draws over row 1 and under row 2. Verified against Godot 4.6.3 at that pose.
  {
    name: 'tile-map-layer-y-sort-animated-child',
    file: 'unit-tile-map-layer-y-sort-animated-child.tscn',
    mode: '2d',
    select: 'World/Player',
    animationTime: 0.5,
  },

  // RemoteTransform3D and RemoteTransform2D copy their transform onto the node
  // remote_path names, resolved over the Live scene tree (remoteTransforms.ts).
  // Each target is authored away from its relay. Verified against Godot 4.6.3.

  // The cube is authored at -2 X and driven to the relay's +2.
  { name: 'remote-transform-3d', file: 'unit-remote-transform-3d.tscn' },
  // The pentagon is authored at the grey ghost and driven to the relay's
  // upper right.
  { name: 'remote-transform-2d', file: 'unit-remote-transform-2d.tscn', mode: '2d' },
  // The same relays and targets inside an instanced scene stand where they do in their own files.
  { name: 'remote-transform-3d-instanced', file: 'unit-remote-transform-3d-instanced.tscn' },
  { name: 'remote-transform-2d-instanced', file: 'unit-remote-transform-2d-instanced.tscn', mode: '2d' },
  // A box with a sheared local basis under a scaled parent is a parallelepiped, not a rotated box.
  { name: 'node3d-sheared-basis', file: 'unit-node3d-sheared-basis.tscn' },
  // A relay that names its own parent drives nothing: the box stays where the scene puts it.
  { name: 'remote-transform-3d-ancestor', file: 'unit-remote-transform-3d-ancestor.tscn' },
  // A position-only relay moves a target whose global basis is sheared and leaves that basis alone.
  { name: 'remote-transform-3d-sheared-target', file: 'unit-remote-transform-3d-sheared-target.tscn' },
  // A full-flag relay replaces the target's skew with the relay's, so the square is unskewed.
  { name: 'remote-transform-2d-skew', file: 'unit-remote-transform-2d-skew.tscn', mode: '2d' },
  // A 2D relay in local coordinates sets the target's local transform from its own when the scene loads.
  { name: 'remote-transform-2d-local', file: 'unit-remote-transform-2d-local.tscn', mode: '2d' },
  // A 3D relay in local coordinates pushes nothing on load, so the box stays where the scene puts it.
  { name: 'remote-transform-3d-local', file: 'unit-remote-transform-3d-local.tscn' },
  // An early relay under a holder that a later relay drives pushes again, so its box follows the holder.
  { name: 'remote-transform-3d-chain-order', file: 'unit-remote-transform-3d-chain-order.tscn' },
  { name: 'remote-transform-2d-chain-order', file: 'unit-remote-transform-2d-chain-order.tscn', mode: '2d' },
  // Two turned relays that drive each other's holders: the box stands where the harness frame has it.
  { name: 'remote-transform-3d-cycle', file: 'unit-remote-transform-3d-cycle.tscn' },

  // ViewportTexture on a 3D material. The offscreen pass tonemaps like Godot's: the shared
  // environment applies inside the target and again on the consuming quad (curve squared). The
  // target's SRGB8 storage decodes before the filter, whatever tag the consumer stamps. Within 1%
  // linear per sample of Godot 4.6.3.
  { name: 'sub-viewport-texture', file: 'unit-sub-viewport-texture.tscn' },
  // The sampler state of the material on a ViewportTexture: the default repeat wraps the blend
  // at the edge, `uv1_scale` tiles the target and `texture_filter = 0` keeps its texels as blocks.
  { name: 'sub-viewport-texture-sampler', file: 'unit-sub-viewport-texture-sampler.tscn' },
  // Control content with a translucent fill on the albedo, through the Control target's decoding
  // view. Godot 4.6.3: the Panel at (480,320) rgb(84,84,84), the backdrop at (370,240) rgb(162).
  { name: 'sub-viewport-control-texture', file: 'unit-sub-viewport-control-texture.tscn' },
  // The same target in the emission slot over a black albedo: every material slot binds a
  // ViewportTexture. A slot that drops it leaves a black quad.
  { name: 'sub-viewport-texture-emission', file: 'unit-sub-viewport-texture-emission.tscn' },
  // A 3D material reads a `use_hdr_2d` target's linear values with no decode. Godot 4.6.3: the HDR
  // quad's blend rgb(187,188,0) and value above 1 rgb(255,255,136), against rgb(127,128,0) and
  // rgb(255,252,100) on the sRGB quad.
  { name: 'sub-viewport-hdr-2d-world', file: 'unit-sub-viewport-hdr-2d-world.tscn', camera: 'Root/Camera3D' },
  // A 3D world in a `use_hdr_2d` SubViewport tonemaps with no sRGB encode: the container shows the
  // 0.5 gray quad as byte 55, where the sRGB viewport shows 127.
  { name: 'sub-viewport-hdr-3d-world', file: 'unit-sub-viewport-hdr-3d-world.tscn', mode: '2d' },
  // `tonemap_exposure` under LINEAR inside the target, with glow on the main view: the exposure
  // applies inside the target and again on the quad.
  { name: 'sub-viewport-shared-world-exposure', file: 'unit-sub-viewport-shared-world-exposure.tscn' },
  // The shared world's glow runs inside the target: the quad shows the bloom around the emissive
  // sphere that only the target sees.
  { name: 'sub-viewport-shared-world-glow', file: 'unit-sub-viewport-shared-world-glow.tscn' },
  // A Camera3D's own Environment glows its own-world target, with no WorldEnvironment in the world.
  { name: 'sub-viewport-camera-environment', file: 'unit-sub-viewport-camera-environment.tscn' },
  // A Camera3D's `attributes` at exposure_multiplier 2 in a shared-world SubViewport over a world with
  // none: the pass draws the light, the sphere and the colour background at its camera's exposure.
  { name: 'sub-viewport-camera-exposure', file: 'unit-sub-viewport-camera-exposure.tscn' },
  // The same camera over a world at exposure 0: the pass lights the sphere at 2 while the canvas
  // around it draws dark.
  { name: 'sub-viewport-camera-exposure-dark-world', file: 'unit-sub-viewport-camera-exposure-dark-world.tscn' },
  // An own-world SubViewport whose camera at exposure 0, then 0.5, views a world at 1 with a ONCE
  // probe: the probe captures at the world's exposure, and a nested pass at 1 draws it lit.
  {
    name: 'sub-viewport-own-world-camera-exposure-probe',
    file: 'unit-sub-viewport-own-world-camera-exposure-probe.tscn',
  },
  {
    name: 'sub-viewport-own-world-camera-exposure-probe-half',
    file: 'unit-sub-viewport-own-world-camera-exposure-probe-half.tscn',
  },
  // Two shared-world SubViewports of a 2D canvas, whose cameras hold exposure 2 and 0.5: one frame
  // draws the one lit sphere at both.
  {
    name: 'sub-viewport-shared-world-camera-exposure',
    file: 'unit-sub-viewport-shared-world-camera-exposure.tscn',
    mode: '2d',
  },
  // A Camera3D's `environment` in a SubViewport that shares the root world: the target draws the
  // camera's warm background, green ambient and ACES curve around the sphere the root shows on blue.
  {
    name: 'sub-viewport-shared-root-camera-environment',
    file: 'unit-sub-viewport-shared-root-camera-environment.tscn',
  },
  // Two shared-world SubViewports of a 2D canvas whose cameras hold their own Environments, one
  // also at exposure 0.5: one frame draws the one lit sphere over two backgrounds and two ambients.
  {
    name: 'sub-viewport-shared-world-camera-environment',
    file: 'unit-sub-viewport-shared-world-camera-environment.tscn',
    mode: '2d',
  },
  // Two shared-world SubViewports of a 2D canvas that draw the world's sky at exposures 2 and 1: the
  // second reads the ambient the first baked, and draws its background at its own exposure.
  {
    name: 'sub-viewport-shared-world-sky-exposure',
    file: 'unit-sub-viewport-shared-world-sky-exposure.tscn',
    mode: '2d',
  },
  // A SubViewport's `use_debanding` dithers the bloom its camera's Environment adds.
  { name: 'sub-viewport-debanding', file: 'unit-sub-viewport-debanding.tscn' },
  // A ViewportTexture on a `.glb` surface override: its `viewport_path` resolves from the GLB
  // instance, and the target samples in the glTF's top-down V, so each face shows its own band.
  { name: 'glb-viewport-texture', file: 'unit-glb-viewport-texture.tscn' },
  // An own-world SubViewport's Environment stays in its world: its glow stays off the canvas, and
  // its tone curve leaves the root's LINEAR box untouched.
  { name: 'sub-viewport-own-world-glow', file: 'unit-sub-viewport-own-world-glow.tscn' },
  { name: 'sub-viewport-own-world-tonemap', file: 'unit-sub-viewport-own-world-tonemap.tscn' },
  // MSAA, each from the setting that turns it on: the root viewport's msaa_3d and msaa_2d, from a
  // Fixture project's project.godot, and a SubViewport's own msaa_3d and msaa_2d. The headers state
  // why no other golden shows them.
  { name: 'msaa-3d', file: 'msaa-3d/unit-msaa-3d.tscn' },
  { name: 'msaa-2d', file: 'msaa-2d/unit-msaa-2d.tscn', mode: '2d' },
  // The root viewport's hdr_2d, from a Fixture project's project.godot: the root canvas draws linear
  // half floats and the copy to the screen converts them to sRGB. Every other golden runs at the default, off.
  { name: 'hdr-2d', file: 'hdr-2d/unit-hdr-2d.tscn', mode: '2d' },
  // Lighting in that root: the linear albedo plus an unclamped light, with the authored light colour.
  { name: 'hdr-2d-lights', file: 'hdr-2d/unit-hdr-2d-lights.tscn', mode: '2d' },
  { name: 'sub-viewport-msaa', file: 'unit-sub-viewport-msaa.tscn', mode: '2d' },
  // Alpha antialiasing's three modes on a scissor cut: under msaa_3d 2X, from its own Fixture project,
  // and at one sample, where the coverage is all or none.
  { name: 'alpha-antialiasing', file: 'alpha-antialiasing/unit-alpha-antialiasing.tscn' },
  { name: 'alpha-antialiasing-one-sample', file: 'unit-alpha-antialiasing-one-sample.tscn' },
  { name: 'sub-viewport-control-msaa', file: 'unit-sub-viewport-control-msaa.tscn', mode: '2d' },
];
