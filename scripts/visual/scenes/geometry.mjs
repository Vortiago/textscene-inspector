/**
 * Meshes, CSG defaults, external ArrayMesh geometry, GridMap and 3D navigation
 * — the goldens whose subject is the GEOMETRY that reaches the renderer.
 */

export const GEOMETRY_SCENES = [
  { name: 'plane-mesh', file: 'unit-plane-mesh.tscn' },
  // The ShortWall regression scene: rotated+scaled plane whose transform
  // decomposition history is pinned by transform.regression.test.ts — this
  // baseline pins what it LOOKS like.
  { name: 'plane-rotated-scaled', file: 'edge-plane-rotated-scaled.tscn' },
  { name: 'all-meshes', file: 'integration-all-meshes.tscn' },
  // Shadow-bearing scenes: the shadow map is the most GPU-sensitive content in
  // the set (soft-edge PCF sampling differs across drivers), so these carry the
  // same relaxed threshold as the thin-AA gizmo scenes. The shadows themselves
  // are small contact regions — a missing shadow moves far more than 0.5%.
  { name: 'all-primitives', file: 'integration-all-primitives.tscn', maxDiffPct: 0.5 },
  // Every CSG dimension OMITTED, so the render depends entirely on our parser
  // defaults matching Godot's. The other CSG fixtures set size/radius/height
  // explicitly, which is why a wrong default (CSGBox3D 2,2,2 vs Godot's 1,1,1)
  // sat unnoticed. The 1x1 ruler plate underneath gives the eyeball a scale.
  { name: 'csg-defaults', file: 'unit-csg-defaults.tscn' },
  // Nodes parented UNDER a MeshInstance3D and an OmniLight3D. Both components
  // used to destructure only `node` and silently delete the subtree the
  // dispatcher handed them (144 authored child nodes across 19 vendored demo
  // scenes). Every other 3D fixture hangs its content off Node3D, so nothing
  // in the golden set could see it.
  { name: 'subtree-under-leaf-nodes', file: 'unit-subtree-under-leaf-nodes.tscn' },
  // `cast_shadow = SHADOWS_ONLY`: the box must be ABSENT from the colour buffer
  // while its shadow lands on the ground and the sphere parented under it still
  // renders. Implemented as `visible = false` this scene showed no shadow and
  // no sphere — three skips an invisible object in the shadow pass and stops
  // walking its subtree. Soft-shadow edges are GPU-sensitive, hence the
  // relaxed threshold.
  { name: 'shadows-only', file: 'unit-shadows-only.tscn', maxDiffPct: 0.5 },
  // CSG `material` as an ExtResource .tres beside the same node with an inline
  // SubResource material. Only the sub-resource form used to resolve, so the
  // 33 ExtResource materials in scenes/demos/3d/csg/csg.tscn rendered white —
  // and both existing CSG fixtures declare their materials inline, so no
  // golden could see it. The left box must be green, the right one red.
  { name: 'csg-external-material', file: 'unit-csg-external-material.tscn' },
  // A Sprite2D whose `texture` is a CanvasTexture sub-resource (wrapping the
  // same image the sibling references directly). CanvasTexture is a first-class
  // Texture2D, but the slot only resolved ExtResource refs, so all four sprites
  // in scenes/demos/2d/lights_and_shadows/light_shadows.tscn drew the magenta
  // missing-resource placeholder. Both markers must render identically.
  { name: 'sprite2d-canvastexture', file: 'unit-sprite2d-canvastexture.tscn' },
  // 2D geometry parity in one frame: Line2D corner joints (sharp + round),
  // Polygon2D `polygons` index lists and `invert_enabled`, and the
  // NavigationRegion2D navmesh, whose vertices used to render mirrored about
  // the region origin. Thin joint wedges and navmesh edges are AA-sensitive.
  {
    name: '2d-geometry-parity',
    file: 'unit-2d-geometry-parity.tscn',
    navigation: true,
    maxDiffPct: 0.5,
  },
  // Two AreaLight3D panels of the SAME light_energy but very different
  // area_size, each lighting its own plate. Godot normalises the emitted colour
  // by the rectangle's area (area_normalize_energy, default true), so both
  // plates read the same; without it the 4 x 0.05 strip is 5x dimmer. The one
  // pre-existing AreaLight3D fixture lights no geometry at all, so nothing
  // could see this.
  { name: 'area-light-normalize', file: 'unit-area-light-normalize.tscn' },
  // External ArrayMesh .tres: decoded quad with Godot's packed normals. Loads
  // a local resource (deterministic), gated by the two-identical-frames settle.
  { name: 'arraymesh', file: 'unit-arraymesh.tscn' },
  // The same decoded quad, TEXTURED with a four-band atlas. `arraymesh` above
  // carries no material, so it cannot see a UV error at all — this one pins the
  // V orientation: Godot's V origin is the image top, while textures load with
  // flipY=true, so a pass-through V samples the bands upside down. Green must
  // read at the TOP of the quad, red at the bottom.
  { name: 'arraymesh-uv', file: 'unit-arraymesh-uv.tscn' },
  // The same textured quad again, its surface stored with Godot 4.2+ attribute
  // compression — the ONE variable. Both fixtures above are uncompressed, as is
  // every other .tres in the bag, so nothing else reads a byte of the quantised
  // layout: positions as uint16 spanning the aabb, the tangent frame as an
  // axis-angle triple, UVs as uint16. Read at the uncompressed stride these
  // yield NaN positions, which NaNs the bounding sphere and the camera fit with
  // it, so the failure is a blank frame rather than a subtly wrong one.
  { name: 'arraymesh-compressed', file: 'unit-arraymesh-compressed.tscn' },
  // A surface material declared as a `[sub_resource]` of the MESH's own `.tres`
  // — the form Godot writes whenever a mesh carries its own materials, and the
  // one kind of material reference nothing else in the bag exercises. Both
  // fixtures above reference a shared material FILE by ExtResource, and every
  // scene-level material is a sub-resource of the previewed `.tscn` (a different
  // document, a different mechanism). Two identically-coloured plates: the left
  // one's material is the ExtResource control, so a regression turns only the
  // RIGHT plate white.
  { name: 'arraymesh-own-material', file: 'unit-arraymesh-own-material.tscn' },
  { name: 'grid-map', file: 'unit-grid-map.tscn' },
  // `grid-map` above is GridMap-ONLY, so the camera auto-fit reframes any
  // uniform shift of the whole grid into an identical image — it cannot see a
  // placement error at all. This scene puts static markers at the origin and at
  // (1,1,1) so the cell's position is measured against something that does not
  // move: with Godot's default cell_center_x/y/z the cell sits on the (1,1,1)
  // marker, and dropping the half-cell offset visibly moves it to the origin.
  { name: 'grid-map-centering', file: 'unit-grid-map-centering.tscn' },
  { name: 'navigation-region-3d', file: 'unit-navigation-region-3d.tscn' },
];
