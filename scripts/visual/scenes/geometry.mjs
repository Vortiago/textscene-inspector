/**
 * Meshes, CSG defaults, external ArrayMesh geometry, GridMap and 3D navigation:
 * the goldens whose subject is the geometry that reaches the renderer.
 */

export const GEOMETRY_SCENES = [
  { name: 'plane-mesh', file: 'unit-plane-mesh.tscn' },
  // A rotated and scaled plane. transform.regression.test.ts pins its transform
  // decomposition, and this baseline pins what it looks like.
  { name: 'plane-rotated-scaled', file: 'edge-plane-rotated-scaled.tscn' },
  { name: 'all-meshes', file: 'integration-all-meshes.tscn' },
  // Shadow-bearing: the shadow map is the most GPU-sensitive content in the set,
  // since soft-edge PCF sampling differs across drivers.
  { name: 'all-primitives', file: 'integration-all-primitives.tscn' },
  // Every CSG dimension omitted, so the render depends on our parser defaults
  // matching Godot's (CSGBox3D 1,1,1). The other CSG fixtures set every
  // dimension. The 1x1 ruler plate underneath gives the eye a scale.
  { name: 'csg-defaults', file: 'unit-csg-defaults.tscn' },
  // Nodes parented under a MeshInstance3D and an OmniLight3D. A component that
  // destructures only `node` drops the subtree the dispatcher hands it. Every
  // other 3D fixture hangs its content off Node3D.
  { name: 'subtree-under-leaf-nodes', file: 'unit-subtree-under-leaf-nodes.tscn' },
  // `cast_shadow = SHADOWS_ONLY`: the box is absent from the colour buffer while
  // its shadow lands and the sphere under it renders. `visible = false` cannot
  // do it: three skips an invisible object in the shadow pass and its subtree.
  // Soft-shadow edges are GPU-sensitive.
  { name: 'shadows-only', file: 'unit-shadows-only.tscn' },
  // CSG `material` as an ExtResource .tres beside an inline SubResource one. A
  // resolver of the inline form alone draws the external one white, and the
  // other CSG fixtures declare theirs inline. The left box is green, the right red.
  { name: 'csg-external-material', file: 'unit-csg-external-material.tscn' },
  // A Sprite2D whose `texture` is a CanvasTexture sub-resource wrapping the
  // image its sibling references directly. CanvasTexture is a Texture2D, so
  // both markers must render the same.
  { name: 'sprite2d-canvastexture', file: 'unit-sprite2d-canvastexture.tscn', mode: '2d' },
  // 2D geometry parity in one frame: Line2D corner joints (sharp and round),
  // Polygon2D `polygons` index lists and `invert_enabled`, and the
  // NavigationRegion2D navmesh, which mirrors about the region origin without
  // the Y-flip. Thin joint wedges and navmesh edges are AA-sensitive.
  {
    name: '2d-geometry-parity',
    file: 'unit-2d-geometry-parity.tscn',
    navigation: true, mode: '2d' },
  // Two AreaLight3D panels of the same light_energy and different area_size.
  // Godot normalises the colour by the area (area_normalize_energy, default
  // true), so both plates read the same. Without it the 4 x 0.05 strip is 5x
  // dimmer. No other AreaLight3D fixture lights geometry.
  { name: 'area-light-normalize', file: 'unit-area-light-normalize.tscn' },
  // External ArrayMesh .tres: a decoded quad with Godot's packed normals.
  { name: 'arraymesh', file: 'unit-arraymesh.tscn' },
  // The same quad with a four-band atlas pins V orientation, which the
  // material-less `arraymesh` cannot see. Godot's V origin is the image top and
  // textures load with flipY=true, so a pass-through V samples upside down.
  // Green reads at the top, red at the bottom.
  { name: 'arraymesh-uv', file: 'unit-arraymesh-uv.tscn' },
  // The one variable: Godot 4.2+ attribute compression, which no other .tres
  // uses. Positions are uint16 spanning the aabb, the tangent frame an axis-angle
  // triple, UVs uint16. Read at the uncompressed stride, NaN positions reach the
  // camera fit and the frame is blank.
  { name: 'arraymesh-compressed', file: 'unit-arraymesh-compressed.tscn' },
  // A surface material as a `[sub_resource]` of the mesh's own `.tres`, the form
  // Godot writes when a mesh carries its own materials. No other scene uses it.
  // The left plate's ExtResource material is the control, so a regression turns
  // only the right plate white.
  { name: 'arraymesh-own-material', file: 'unit-arraymesh-own-material.tscn' },
  // `material_override` over an ArrayMesh, one golden per mesh source. The
  // override must reach every surface of the right instance, and the left one
  // is the control. `material-override` drives a BoxMesh, whose slots come from
  // the override map rather than from the decoded surfaces.

  // An external `.tres` decoded by the resource pipeline.
  { name: 'arraymesh-material-override', file: 'unit-arraymesh-material-override.tscn' },
  // A `[sub_resource type="ArrayMesh"]` decoded straight from the scene.
  {
    name: 'arraymesh-scene-material-override',
    file: 'unit-arraymesh-scene-material-override.tscn',
  },
  { name: 'grid-map', file: 'unit-grid-map.tscn' },
  // Static markers at the origin and (1,1,1): in a GridMap-only scene the
  // camera auto-fit hides a uniform shift. With Godot's default
  // cell_center_x/y/z the cell sits on the (1,1,1) marker, and without the
  // half-cell offset it moves to the origin.
  { name: 'grid-map-centering', file: 'unit-grid-map-centering.tscn' },
  { name: 'navigation-region-3d', file: 'unit-navigation-region-3d.tscn' },
  // The 3D half of `sprite2d-gradienttexture`: Sprite3D decodes sRGB in hardware
  // before filtering, the opposite of the 2D canvas, so a procedural texture can
  // be right for Sprite2D and tagged wrongly here.
  { name: 'sprite3d-gradienttexture', file: 'unit-sprite3d-gradienttexture.tscn' },
  { name: 'sprite3d-nested-modulate', file: 'unit-sprite3d-nested-modulate.tscn' },
  // The pass a default-`alpha_cut` sprite lands in, which Godot reads off the
  // generated shader: a texture with transparent texels in front of an opaque
  // wall. An opaque-list sprite paints a black rectangle here and looks right in
  // every other sprite scene. Content: a flat quad and an antialiased edge band.
  { name: 'sprite3d-blended-pass', file: 'unit-sprite3d-blended-pass.tscn' },
];
