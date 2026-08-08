/**
 * Batched tile geometry, the RemoteTransform relays that drive another node,
 * and the one golden that samples content through a SubViewport target.
 */

export const TILE_AND_TARGET_SCENES = [
  // --- TileMap / TileMapLayer batched-geometry coverage ---
  { name: 'tile-map', file: 'unit-tile-map.tscn' },
  { name: 'tile-map-layer', file: 'unit-tile-map-layer.tscn' },
  // Six cells of the SAME atlas tile at six orientations, encoded the way Godot
  // paints them: flip/transpose bits inside the alternative id. Every other
  // tile fixture and golden carries alternativeId 0 only, so the flip/transpose
  // UV composition — the most intricate and most corpus-exercised piece of the
  // tile slices — was guarded by nothing but a hand-written array in the test
  // written alongside it. The marker glyph is asymmetric on both axes, so each
  // orientation is visually distinct.
  // Tight threshold on purpose: a 2D canvas render with no AA-sensitive
  // shading is byte-stable, and only the four TRANSPOSED cells move when the
  // composition order is wrong — 0.21% of the frame. The default 0.1% leaves
  // too little margin for a guard this specific.
  { name: 'tile-map-layer-flips', file: 'unit-tile-map-layer-flips.tscn', maxDiffPct: 0.02 },
  { name: 'tile-map-layer-isometric', file: 'unit-tile-map-layer-isometric.tscn' },
  // Y-sort (issue 74) regression guard: the full isometric dungeon. Sibling y-sort
  // subtrees (Floor / Walls / Decorations under the non-y-sorted root) must layer in
  // disjoint tree-ordered z-bands, and each layer's tiles interleave with decorations
  // by Y — decorations must NOT hide behind the floor. maxDiffPct covers SwiftShader AA.
  { name: 'isometric-dungeon', file: 'dungeon.tscn', maxDiffPct: 0.5 },
  // Hexagon grid (shape=3, vertical offset axis): odd columns stagger by
  // half a tile — the half-offset placement math had no visual guard before.
  { name: 'tile-map-layer-hexagon', file: 'unit-tile-map-layer-hexagon.tscn' },

  // --- RemoteTransform3D / RemoteTransform2D drive their target ---
  // The relay copies its own transform onto the node its remote_path names
  // (resolved once at parse time — r3f/remoteTransforms.ts). Each fixture
  // authors the target AWAY from the relay so the render only reads right if
  // the drive applied: the 3D cube is authored at -2 X but driven to the
  // relay's +2; the 2D pentagon is authored at the gray ghost's spot but
  // driven to the relay's upper-right. Verified against real Godot 4.6.3.
  { name: 'remote-transform-3d', file: 'unit-remote-transform-3d.tscn' },
  { name: 'remote-transform-2d', file: 'unit-remote-transform-2d.tscn', maxDiffPct: 0.5 },

  // --- ViewportTexture: content sampled THROUGH a SubViewport target ---
  // The only golden that consumes a render target, so it alone pins the
  // through-target colour pipeline: the offscreen pass must tonemap like
  // Godot's viewport pass (shared environment in force inside the target,
  // applied again on the consuming quad — curve squared), and the target's
  // linear storage must survive the consumer re-tagging it sRGB. Both
  // regressions are invisible in every other scene, where all content renders
  // in the main pass exactly once. Probe-verified against Godot 4.6.3 to
  // within 1% linear per sample.
  { name: 'sub-viewport-texture', file: 'unit-sub-viewport-texture.tscn' },
];
