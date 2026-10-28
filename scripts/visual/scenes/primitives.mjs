/**
 * Mesh primitives and the CSG operations over them: one golden per shape, per
 * boolean, and per material mapping.
 */

export const PRIMITIVE_SCENES = [
  // Mesh primitives and StandardMaterial3D features.
  { name: 'box-mesh', file: 'unit-box-mesh.tscn' },
  { name: 'box-mesh-texture-uv', file: 'unit-box-mesh-texture-uv.tscn' },
  { name: 'capsule-mesh', file: 'unit-capsule-mesh.tscn' },
  { name: 'capsule-mesh-texture-uv', file: 'unit-capsule-mesh-texture-uv.tscn' },
  { name: 'cylinder-mesh', file: 'unit-cylinder-mesh.tscn' },
  { name: 'cylinder-mesh-texture-uv', file: 'unit-cylinder-mesh-texture-uv.tscn' },
  { name: 'point-mesh', file: 'unit-point-mesh.tscn' },
  { name: 'point-mesh-gridmap', file: 'unit-point-mesh-gridmap.tscn' },
  { name: 'prism-mesh', file: 'unit-prism-mesh.tscn' },
  { name: 'prism-mesh-texture-uv', file: 'unit-prism-mesh-texture-uv.tscn' },
  { name: 'quadmesh', file: 'unit-quadmesh.tscn' },
  { name: 'quadmesh-orientation', file: 'unit-quadmesh-orientation.tscn' },
  { name: 'sphere-mesh-texture-uv', file: 'unit-sphere-mesh-texture-uv.tscn' },
  { name: 'text-mesh', file: 'unit-text-mesh.tscn' },
  // The same scene under an OpenType-CFF font, whose outlines are cubic.
  { name: 'text-mesh-cff', file: 'unit-text-mesh-cff.tscn' },
  { name: 'torus-mesh', file: 'unit-torus-mesh.tscn' },
  { name: 'torus-mesh-texture-uv', file: 'unit-torus-mesh-texture-uv.tscn' },
  { name: 'tube-trail-mesh-texture-uv', file: 'unit-tube-trail-mesh-texture-uv.tscn' },
  { name: 'ribbon-trail-mesh-texture-uv', file: 'unit-ribbon-trail-mesh-texture-uv.tscn' },
  // A MeshInstance3D bound to a Skeleton3D bends the ribbon along the posed bones.
  { name: 'mesh-instance-3d-skinned-ribbon', file: 'unit-mesh-instance-3d-skinned-ribbon.tscn' },
  // The tangent frame every ported builder writes, under a normal map and each light type.
  { name: 'primitive-mesh-normal-map', file: 'unit-primitive-mesh-normal-map.tscn' },
  // The steps PrimitiveMesh applies after every builder: the UV2 layout and `flip_faces`.
  { name: 'primitive-mesh-uv2', file: 'unit-primitive-mesh-uv2.tscn' },
  { name: 'primitive-mesh-flip-faces', file: 'unit-primitive-mesh-flip-faces.tscn' },
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
  // The mesh sources: a .tres ArrayMesh, a .tres PrimitiveMesh and an inline ArrayMesh,
  // each drawn under its own surface materials, alone and inside a boolean.
  { name: 'csg-mesh-sources', file: 'unit-csg-mesh-sources.tscn' },
  // An open brush is an empty manifold: the quad and the open cylinder draw nothing, the
  // box beside them draws, and an open quad under a subtraction removes nothing.
  { name: 'csg-mesh-open-brush', file: 'unit-csg-mesh-open-brush.tscn' },
  // A TextMesh in a CSGMesh3D builds its brush from the glyph outlines once its font loads: the left
  // text draws as a solid, the right one cuts its letters out of a box.
  { name: 'csg-mesh-text-mesh', file: 'unit-csg-mesh-text-mesh.tscn' },
  // A texture on a brush: each shape's V must run the way Godot's does.
  { name: 'csg-texture-uv', file: 'unit-csg-texture-uv.tscn' },
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
