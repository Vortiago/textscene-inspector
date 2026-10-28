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
  // A tile's own TileData. Each scene moves one property, and its header says why.
  { name: 'tile-map-layer-tile-modulate', file: 'unit-tile-map-layer-tile-modulate.tscn', mode: '2d' },
  { name: 'tile-map-layer-tile-material', file: 'unit-tile-map-layer-tile-material.tscn', mode: '2d' },
  { name: 'tile-map-layer-tile-z-index', file: 'unit-tile-map-layer-tile-z-index.tscn', mode: '2d' },
  {
    name: 'tile-map-layer-tile-y-sort-origin',
    file: 'unit-tile-map-layer-tile-y-sort-origin.tscn',
    mode: '2d',
  },

  // RemoteTransform3D and RemoteTransform2D copy their transform onto the node
  // remote_path names, resolved once at parse time (r3f/remoteTransforms.ts).
  // Each target is authored away from its relay. Verified against Godot 4.6.3.

  // The cube is authored at -2 X and driven to the relay's +2.
  { name: 'remote-transform-3d', file: 'unit-remote-transform-3d.tscn' },
  // The pentagon is authored at the grey ghost and driven to the relay's
  // upper right.
  { name: 'remote-transform-2d', file: 'unit-remote-transform-2d.tscn', mode: '2d' },

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
  // `tonemap_exposure` under LINEAR inside the target while glow holds the renderer for the
  // compositor: the exposure applies inside the target and again on the quad.
  { name: 'sub-viewport-shared-world-exposure', file: 'unit-sub-viewport-shared-world-exposure.tscn' },
  // The shared world's glow runs inside the target: the quad shows the bloom around the emissive
  // sphere that only the target sees.
  { name: 'sub-viewport-shared-world-glow', file: 'unit-sub-viewport-shared-world-glow.tscn' },
  // A Camera3D's own Environment glows its own-world target, with no WorldEnvironment in the world.
  { name: 'sub-viewport-camera-environment', file: 'unit-sub-viewport-camera-environment.tscn' },
  // A ViewportTexture on a `.glb` surface override: its `viewport_path` resolves from the GLB
  // instance, and the target samples in the glTF's top-down V, so each face shows its own band.
  { name: 'glb-viewport-texture', file: 'unit-glb-viewport-texture.tscn' },
  // An own-world SubViewport's Environment stays in its world: its glow mounts no compositor
  // over the canvas, and its tone curve leaves the root's LINEAR box untouched.
  { name: 'sub-viewport-own-world-glow', file: 'unit-sub-viewport-own-world-glow.tscn' },
  { name: 'sub-viewport-own-world-tonemap', file: 'unit-sub-viewport-own-world-tonemap.tscn' },
  // MSAA, each from the setting that turns it on: the root viewport's msaa_3d and msaa_2d, from a
  // Fixture project's project.godot, and a SubViewport's own msaa_3d and msaa_2d. The headers state
  // why no other golden shows them.
  { name: 'msaa-3d', file: 'msaa-3d/unit-msaa-3d.tscn' },
  { name: 'msaa-2d', file: 'msaa-2d/unit-msaa-2d.tscn', mode: '2d' },
  { name: 'sub-viewport-msaa', file: 'unit-sub-viewport-msaa.tscn', mode: '2d' },
  // Alpha antialiasing's three modes on a scissor cut: under msaa_3d 2X, from its own Fixture project,
  // and at one sample, where the coverage is all or none.
  { name: 'alpha-antialiasing', file: 'alpha-antialiasing/unit-alpha-antialiasing.tscn' },
  { name: 'alpha-antialiasing-one-sample', file: 'unit-alpha-antialiasing-one-sample.tscn' },
  { name: 'sub-viewport-control-msaa', file: 'unit-sub-viewport-control-msaa.tscn', mode: '2d' },
];
