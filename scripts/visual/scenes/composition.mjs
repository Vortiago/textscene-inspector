/**
 * Whole-scene composition and projection: integration scenes, sub-scene
 * instancing, physics bodies and their collision gizmos, decals, texture
 * filtering and curve-following.
 */

export const SCENE_COMPOSITION_SCENES = [
  { name: 'mixed-nodes', file: 'integration-mixed-nodes.tscn' },
  { name: 'hallway-mockup', file: 'example-hallway-mockup.tscn', maxDiffPct: 0.5 },
  // Instance root merge (ADR-0013): two instances of unit-instance-child.tscn
  // collapse into Area3D coins at x=±1.5. Pins the rendered pixels of a
  // sub-scene-instancing scene so the wrapper-collapse + transform-replace
  // cannot silently shift them.
  { name: 'instanced-subscene', file: 'integration-instanced-subscene.tscn' },
  // Thin collision-gizmo lines are the most AA-sensitive content in the set.
  { name: 'physics-bodies', file: 'unit-physics-bodies.tscn', maxDiffPct: 0.3 },
  // The first golden ever to show a collision gizmo: `physics-bodies` above
  // carries CollisionShape3D nodes but the toggle is off, so its baseline is a
  // bare plane. This one catches a capsule / sphere / cylinder falling through
  // to a 1x1x1 box, and a gizmo hard-coded green regardless of `debug_color`.
  // Thin wireframe lines, hence the relaxed threshold.
  {
    name: 'collision-shapes',
    file: 'unit-collision-shapes.tscn',
    collisions: true,
    maxDiffPct: 0.5,
  },
  // Decal PROJECTS a local checkerboard onto the floor plane its box intersects
  // (DecalGeometry, baked after mount), one plain and one tinted. The box gizmo
  // is selection-gated (ADR-0018) and the harness drives no selection, so this
  // captures the Godot-runtime view: projection only, no outline. Loads a
  // texture (deterministic local SVG, gated by the two-identical-frames settle);
  // the projection edges are AA-sensitive, hence the relaxed threshold.
  { name: 'decal', file: 'unit-decal.tscn', maxDiffPct: 0.3 },
  // The ONE variable against `decal` above: a receiver on `layers = 2` under a
  // `cull_mask` that clears layer 2, beside a default-layer control receiver.
  // Godot's rule is `decal.cull_mask & instance.layers`, so the left floor must
  // show bare albedo and the right one the checkerboard. `unit-decal.tscn` uses
  // cull_mask = 1048575, which excludes nothing, so it cannot witness this.
  { name: 'decal-cull-mask', file: 'unit-decal-cull-mask.tscn', maxDiffPct: 0.3 },
  // One image, two inline StandardMaterial3D sub-resources differing ONLY in
  // `texture_filter` (0 NEAREST vs 3 LINEAR_WITH_MIPMAPS). Also the only scene
  // that witnesses per-material texture cloning: filter state lives on the
  // THREE.Texture but the loader caches one per path, so a renderer that writes
  // it onto the shared texture renders both quads identically.
  { name: 'material-texture-filter', file: 'unit-material-texture-filter.tscn' },
  // `anisotropy_flowmap` as a real PNG — the ONLY scene where a decoded image
  // reaches the anisotropy channel repack (Godot keeps per-pixel strength in
  // ALPHA, three.js reads it from BLUE), which needs a canvas readback that no
  // headless unit-test environment can perform. The right sphere carries the
  // flowmap and must show alternating streaked / isotropic bands; the left one
  // has the identical scalar-only material and is streaked all the way round.
  // Both ways this can break move several times the threshold: lose the
  // readback and the banded sphere becomes a copy of the uniform one, drop the
  // repack and its highlight flattens everywhere. Specular highlights on a
  // curved surface are AA-sensitive, hence the slightly relaxed threshold.
  {
    name: 'material-anisotropy-flowmap',
    file: 'unit-material-anisotropy-flowmap.tscn',
    maxDiffPct: 0.2,
  },
  // PathFollow2D follow-offset: a Polygon2D follower placed at
  // progress_ratio 0.5 along the parent Path2D's Curve2D. The Marker2D cross
  // and Path2D curve gizmos are selection-gated (ADR-0018) and the harness
  // drives no selection, so this scene pins the one visible, non-gated piece —
  // the follower's curve placement.
  { name: 'pathfollow2d-follow', file: 'unit-pathfollow2d.tscn', maxDiffPct: 0.3 },
  // PathFollow3D follow-offset (ADR-0018): a BoxMesh follower placed at
  // progress_ratio 0.5 along the parent Path3D's Curve3D. Same as the 2D case —
  // the Path3D curve gizmo is selection-gated and hidden here, so this pins the
  // follower box's curve placement (the non-gated, real scene-state behaviour).
  { name: 'pathfollow3d-follow', file: 'unit-pathfollow-3d.tscn' },
];
