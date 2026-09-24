/**
 * Mesh primitives and the CSG operations over them: one golden per shape, per
 * boolean, and per material mapping.
 */

export const PRIMITIVE_SCENES = [
  // Mesh primitives and StandardMaterial3D features.
  { name: 'box-mesh', file: 'unit-box-mesh.tscn' },
  { name: 'capsule-mesh', file: 'unit-capsule-mesh.tscn' },
  { name: 'cylinder-mesh', file: 'unit-cylinder-mesh.tscn' },
  { name: 'prism-mesh', file: 'unit-prism-mesh.tscn' },
  { name: 'quadmesh', file: 'unit-quadmesh.tscn' },
  { name: 'torus-mesh', file: 'unit-torus-mesh.tscn' },
  { name: 'csg-box-3d', file: 'unit-csg-box.tscn' },
  { name: 'csg-sphere-3d', file: 'unit-csg-sphere.tscn' },
  { name: 'csg-cylinder-3d', file: 'unit-csg-cylinder.tscn' },
  // Godot's ring is in XZ with the hole on +Y, and `sides`/`ring_sides` mean the
  // opposite of three's TorusGeometry naming. Includes an all-defaults torus so a
  // wrong default cannot hide behind explicit dimensions.
  { name: 'csg-torus-3d', file: 'unit-csg-torus.tscn' },
  // A combiner draws nothing itself: the visible subtree is its CSGBox3D
  // children. The second, hidden combiner contributes nothing. If its sphere
  // appears, the node fell through to the generic fallback, which ignores `visible`.
  { name: 'csg-combiner-3d', file: 'unit-csg-combiner.tscn' },
  // The only end-to-end CSGMesh3D mesh resolution: no vendored scene has one.
  // The third node has no `mesh` and draws nothing rather than a placeholder.
  { name: 'csg-mesh-3d', file: 'unit-csg-mesh.tscn' },
  // DEPTH extrudes to local -Z over [-depth, 0], not to +Z and not centred. The
  // Staircase is concave, so its caps need a real triangulator. The last node
  // writes nothing, so a wrong default polygon makes it vanish.
  { name: 'csg-polygon-depth', file: 'unit-csg-polygon-depth.tscn' },
  // SPIN revolves about +Y sweeping +X toward -Z. A partial spin gets both end
  // caps. A full revolution gets none and closes on itself.
  { name: 'csg-polygon-spin', file: 'unit-csg-polygon-spin.tscn' },
  // PATH is the only scene that exercises the path_node resolution pass together
  // with the curve tessellation, and it covers both NodePath shapes the corpus
  // writes: a sibling and a child.
  { name: 'csg-polygon-path', file: 'unit-csg-polygon-path.tscn' },
  // Real boolean evaluation (ADR-0027). If the three groups render the same, a
  // solid block beside a solid ball, the evaluator has stopped running.
  { name: 'csg-boolean-ops', file: 'unit-csg-boolean-ops.tscn' },
  // The only scene that can catch a group/materialIndex remap bug: with one
  // material everywhere a wrong slot mapping is invisible.
  { name: 'csg-multi-material', file: 'unit-csg-multi-material.tscn' },
  // Transparency, the one measured confounder no other CSG scene covers.
  { name: 'csg-transparency', file: 'unit-csg-transparency.tscn' },
];
