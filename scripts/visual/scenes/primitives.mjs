/**
 * Mesh primitives and the CSG operations over them — one golden per shape, per
 * boolean, and per material mapping.
 */

export const PRIMITIVE_SCENES = [
  // --- Mesh primitives + StandardMaterial3D features ---
  { name: 'box-mesh', file: 'unit-box-mesh.tscn' },
  { name: 'capsule-mesh', file: 'unit-capsule-mesh.tscn' },
  { name: 'cylinder-mesh', file: 'unit-cylinder-mesh.tscn' },
  { name: 'prism-mesh', file: 'unit-prism-mesh.tscn' },
  { name: 'quadmesh', file: 'unit-quadmesh.tscn' },
  { name: 'torus-mesh', file: 'unit-torus-mesh.tscn' },
  // Completeness backfill (node-completeness audit): deterministic renderable
  // nodes that had a fixture but no golden, so their real-browser render was
  // unguarded. Each baseline was eyeballed at generation.
  { name: 'csg-box-3d', file: 'unit-csg-box.tscn' },
  { name: 'csg-sphere-3d', file: 'unit-csg-sphere.tscn' },
  { name: 'csg-cylinder-3d', file: 'unit-csg-cylinder.tscn' },
  // Godot's ring is in XZ with the hole on +Y, and `sides`/`ring_sides` mean the
  // opposite of three's TorusGeometry naming. Includes an all-defaults torus so a
  // wrong default cannot hide behind explicit dimensions.
  { name: 'csg-torus-3d', file: 'unit-csg-torus.tscn' },
  // A combiner draws nothing itself; the visible subtree is its CSGBox3D children.
  // The second, hidden combiner must contribute NOTHING: if its sphere appears, the
  // node fell through to the generic fallback, which ignores `visible`.
  { name: 'csg-combiner-3d', file: 'unit-csg-combiner.tscn' },
  // No vendored witness exists for CSGMesh3D, so this is the only place its mesh
  // resolution is exercised end to end. The third node has no `mesh` and must draw
  // nothing rather than a placeholder.
  { name: 'csg-mesh-3d', file: 'unit-csg-mesh.tscn' },
  // DEPTH extrudes to LOCAL -Z over [-depth, 0], not to +Z and not centred; the
  // Staircase is concave so its caps need a real triangulator, and the last node
  // writes nothing at all so a wrong default polygon makes it vanish.
  { name: 'csg-polygon-depth', file: 'unit-csg-polygon-depth.tscn' },
  // SPIN revolves about +Y sweeping +X toward -Z. A partial spin gets both end
  // caps; a full revolution gets NONE and closes on itself.
  { name: 'csg-polygon-spin', file: 'unit-csg-polygon-spin.tscn' },
  // PATH is the only scene that exercises the path_node resolution pass together
  // with the curve tessellation, and it covers both NodePath shapes the corpus
  // writes: a sibling and a child.
  { name: 'csg-polygon-path', file: 'unit-csg-polygon-path.tscn' },
  // Real boolean evaluation (ADR-0027). Before it, all three groups rendered
  // IDENTICALLY as a solid block beside a solid ball: a hole showed as filled.
  // If they ever match again, the evaluator has stopped running.
  { name: 'csg-boolean-ops', file: 'unit-csg-boolean-ops.tscn' },
  // The only scene that can catch a group/materialIndex remap bug: with one
  // material everywhere a wrong slot mapping is invisible.
  { name: 'csg-multi-material', file: 'unit-csg-multi-material.tscn' },
  // Transparency was the one measured confounder with no CSG coverage at all.
  { name: 'csg-transparency', file: 'unit-csg-transparency.tscn' },
];
