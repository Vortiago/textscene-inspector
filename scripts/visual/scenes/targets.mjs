/**
 * Batched tile geometry, the RemoteTransform relays that drive another node,
 * and the one golden that samples content through a SubViewport target.
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
  { name: 'isometric-dungeon', file: 'dungeon.tscn', mode: '2d' },
  // Hexagon grid (shape=3, vertical offset axis): odd columns stagger by half a
  // tile.
  { name: 'tile-map-layer-hexagon', file: 'unit-tile-map-layer-hexagon.tscn', mode: '2d' },

  // RemoteTransform3D and RemoteTransform2D copy their transform onto the node
  // remote_path names, resolved once at parse time (r3f/remoteTransforms.ts).
  // Each target is authored away from its relay. Verified against Godot 4.6.3.

  // The cube is authored at -2 X and driven to the relay's +2.
  { name: 'remote-transform-3d', file: 'unit-remote-transform-3d.tscn' },
  // The pentagon is authored at the grey ghost and driven to the relay's
  // upper right.
  { name: 'remote-transform-2d', file: 'unit-remote-transform-2d.tscn', mode: '2d' },

  // ViewportTexture: the only golden that samples through a render target. The
  // offscreen pass tonemaps like Godot's: the shared environment applies inside
  // the target and again on the consuming quad (curve squared). The target's linear storage survives the
  // consumer's sRGB tag. Within 1% linear per sample of Godot 4.6.3.
  { name: 'sub-viewport-texture', file: 'unit-sub-viewport-texture.tscn' },
];
