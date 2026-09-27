/**
 * Whole-scene composition and projection: integration scenes, sub-scene
 * instancing, physics bodies and their collision gizmos, decals, texture
 * filtering, curve-following and where a Node3D's parent link ends.
 */

export const SCENE_COMPOSITION_SCENES = [
  { name: 'mixed-nodes', file: 'integration-mixed-nodes.tscn' },
  { name: 'hallway-mockup', file: 'example-hallway-mockup.tscn' },
  // Instance root merge (ADR-0013): two instances of unit-instance-child.tscn
  // collapse into Area3D coins at x=±1.5, pinning the wrapper collapse and the
  // transform replace.
  { name: 'instanced-subscene', file: 'integration-instanced-subscene.tscn' },
  // Thin collision-gizmo lines are the most AA-sensitive content in the set.
  { name: 'physics-bodies', file: 'unit-physics-bodies.tscn' },
  // Collision gizmos on: `physics-bodies` leaves the toggle off. Catches a
  // capsule, sphere or cylinder falling through to a 1x1x1 box, and a gizmo
  // green whatever its `debug_color`. Thin wireframe lines, AA-sensitive.
  {
    name: 'collision-shapes',
    file: 'unit-collision-shapes.tscn',
    collisions: true,
  },
  // Decal projects a local SVG checkerboard onto the floor its box intersects
  // (DecalGeometry, baked after mount), one plain and one tinted. The box gizmo
  // is selection-gated (ADR-0018), so this is the runtime view: projection
  // only. The projection edges are AA-sensitive.
  { name: 'decal', file: 'unit-decal.tscn' },
  // The one variable against `decal`: a receiver on `layers = 2` under a
  // `cull_mask` that clears layer 2. Godot's rule is `decal.cull_mask &
  // instance.layers`, so the left floor shows bare albedo and the right one the
  // checkerboard. `unit-decal.tscn` uses cull_mask = 1048575, which excludes nothing.
  { name: 'decal-cull-mask', file: 'unit-decal-cull-mask.tscn' },
  // One image, two StandardMaterial3D sub-resources differing only in
  // `texture_filter` (0 NEAREST, 3 LINEAR_WITH_MIPMAPS): the one scene that sees
  // per-material texture cloning. The loader caches one THREE.Texture per path,
  // so filter state written onto it renders both quads the same.
  { name: 'material-texture-filter', file: 'unit-material-texture-filter.tscn' },
  // `anisotropy_flowmap` as a real PNG: the one scene where a decoded image
  // reaches the repack (Godot keeps strength in alpha, three.js reads blue),
  // through a canvas readback no headless unit test can do. Without it the right
  // sphere copies the left one. Without the repack its highlight flattens.
  {
    name: 'material-anisotropy-flowmap',
    file: 'unit-material-anisotropy-flowmap.tscn',
  },
  // A Polygon2D PathFollow2D at progress_ratio 0.5 along its Path2D. The path
  // gizmos are selection-gated (ADR-0018), so this pins the follower's placement.
  { name: 'pathfollow2d-follow', file: 'unit-pathfollow2d.tscn', mode: '2d' },
  // A BoxMesh PathFollow3D at progress_ratio 0.5 along its Path3D. The curve
  // gizmo is selection-gated (ADR-0018), so this pins the follower's placement.
  { name: 'pathfollow3d-follow', file: 'unit-pathfollow-3d.tscn' },
  // Where a Node3D's parent link ends (ADR-0008): a plain Node between two
  // Node3Ds drops the transform, and a hidden one no longer hides; top_level
  // drops the transform alone. Each box lands beside the grey reference.
  { name: 'node3d-plain-node-transform', file: 'unit-node3d-plain-node-transform.tscn' },
  { name: 'node3d-plain-node-visibility', file: 'unit-node3d-plain-node-visibility.tscn' },
  { name: 'node3d-top-level', file: 'unit-node3d-top-level.tscn' },
];
