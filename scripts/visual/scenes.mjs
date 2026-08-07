/**
 * Golden-scene manifest for the visual-regression harness.
 *
 * Policy: WebGL-canvas-rendered scenes only — no 2D DOM overlays, so the
 * captured image depends on nothing but the renderer. Resource/texture loads
 * are allowed only when they resolve from local fixtures and settle
 * deterministically (the two-identical-frames gate rejects anything that
 * doesn't), e.g. `arraymesh` (.tres geometry) and `decal` (a local SVG
 * texture). `file` is the bare fixture filename exactly as it appears in
 * apps/textscene-web/src/fixtures.ts (the `?fixture=` deep link). `maxDiffPct`
 * overrides the default failure threshold for scenes with antialiasing-
 * sensitive content (thin gizmo lines).
 *
 * `collisions: true` (optional) ticks the toolbar's "Visible Collision Shapes"
 * checkbox before capturing, so CollisionShape2D/3D gizmos render — they are
 * off by default (ADR-0005/0006) and therefore invisible to every other scene.
 *
 * `select` (optional) is a node path the harness selects in the scene tree
 * before capturing, so a selection-gated gizmo (Marker/Path/PathFollow, ADR-0018)
 * renders. These `*-selected` scenes are the real-browser regression guard for
 * the gizmos — the un-selected fixtures never show them. Their thin AA lines and
 * the selection-highlight box make them AA-sensitive, hence the relaxed
 * `maxDiffPct`.
 *
 * `mode: '2d'` (optional) routes the scene through the 2D parity capture
 * instead of the default 3D one: the project-viewport rectangle at zoom 1
 * with the stage's own chrome (grid, zoom HUD, origin axes) painted out and
 * the background flattened to Godot's clear colour, exactly what `pnpm
 * ref:godot`/`ref:ours --2d` compare against (`findCaptureTarget` +
 * `createCaptureContext` in `previewServer.mjs`). Every Node2D/Control-rooted
 * golden carries it — before it existed, these captured the WHOLE 2D
 * viewport instead, chrome and all, which is why their `maxDiffPct` was
 * relaxed regardless of what content they carry. Goldens added SINCE the
 * parity capture keep the strict 0.1% default instead: a 1:1 frame at zoom 1
 * over integer pixels has no camera fit and no resampling to absorb, so a
 * relaxed threshold there would only be slack for a real regression to hide
 * in. The relaxed values above are historical, not a rule for 2D.
 */

export const DEFAULT_MAX_DIFF_PCT = 0.1;

export const GOLDEN_SCENES = [
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
  { name: 'sprite2d-canvastexture', file: 'unit-sprite2d-canvastexture.tscn', mode: '2d' },
  // 2D geometry parity in one frame: Line2D corner joints (sharp + round),
  // Polygon2D `polygons` index lists and `invert_enabled`, and the
  // NavigationRegion2D navmesh, whose vertices used to render mirrored about
  // the region origin. Thin joint wedges and navmesh edges are AA-sensitive.
  {
    name: '2d-geometry-parity',
    file: 'unit-2d-geometry-parity.tscn',
    mode: '2d',
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
  { name: 'material-metallic', file: 'unit-material-metallic.tscn' },
  { name: 'material-emissive', file: 'unit-material-emissive.tscn' },
  // Glow and emission, one variable per scene. Each fixture's own header states
  // which variable and why a regression in it would be invisible elsewhere.
  { name: 'glow-authored', file: 'unit-glow-authored.tscn' },
  { name: 'glow-strength', file: 'unit-glow-strength.tscn' },
  { name: 'glow-softlight', file: 'unit-glow-softlight.tscn' },
  { name: 'glow-mix', file: 'unit-glow-mix.tscn' },
  { name: 'glow-replace', file: 'unit-glow-replace.tscn' },
  { name: 'glow-bloom-floor', file: 'unit-glow-bloom-floor.tscn' },
  { name: 'glow-normalized', file: 'unit-glow-normalized.tscn' },
  { name: 'glow-agx', file: 'unit-glow-agx.tscn' },
  { name: 'glow-exposure', file: 'unit-glow-exposure.tscn' },
  // Raised threshold: a 4x4 checkerboard on two quads carries far more edge than
  // the silhouette-only scenes the default is tuned for.
  { name: 'material-emission-texture', file: 'unit-material-emission-texture.tscn', maxDiffPct: 0.6 },
  { name: 'material-emission-hdr', file: 'unit-material-emission-hdr.tscn' },
  // Height mapping: a local grayscale height SVG drives displacementMap on a
  // finely-subdivided sphere — the baseline pins that the relief actually
  // renders (a normal map, or a missing displacementMap, reads as a flat ball).
  { name: 'material-heightmap', file: 'unit-material-heightmap.tscn' },
  { name: 'world-environment', file: 'unit-world-environment-basic.tscn' },
  // Godot's editor preview sun + preview environment on a scene that declares
  // neither (ADR-0025). Godot's own render of the same lighting is committed at
  // scripts/godot-ref/reference/preview-lighting.png. Shadow-bearing, hence the
  // relaxed threshold shared with the other shadow scenes.
  { name: 'preview-lighting', file: 'unit-preview-lighting.tscn', maxDiffPct: 0.5 },
  // The light-transport pair, one per way energy reaches a surface. Each puts
  // an UNSHADED patch of the surface's own albedo onto the lit plane, and both
  // Godot equations say a white energy-1.0 source renders exactly that albedo
  // — so the patch is invisible when the scale is right and obvious when it is
  // not. These read as a flat grey square by design; a visible seam is the
  // failure. `LIGHT_INTENSITY_SCALE` at its old value of 2 showed one.
  { name: 'light-transport-direct', file: 'unit-light-transport-direct.tscn' },
  { name: 'light-transport-ambient', file: 'unit-light-transport-ambient.tscn' },
  // The sky pair. `-sky` is a UNIFORM white sky, so it pins the IBL's scale
  // with the filter shape removed (a convolution of a constant is that same
  // constant). `-sky-graded` carries the editor preview's own gradient and a
  // floor plus a wall, so it pins the DIRECTIONALITY the uniform one cannot
  // see.
  { name: 'light-transport-sky', file: 'unit-light-transport-sky.tscn' },
  { name: 'light-transport-sky-graded', file: 'unit-light-transport-sky-graded.tscn' },
  // Scene-owned skies, authored away from Godot's defaults so the gradient and
  // the sun disc are legible. Both carry their own light AND environment, so
  // they also pin that BOTH previews yield.
  { name: 'sky-procedural', file: 'unit-sky-procedural.tscn', maxDiffPct: 0.5 },
  { name: 'sky-physical', file: 'unit-sky-physical.tscn', maxDiffPct: 0.5 },
  // Locks the equirect V/U orientation (measured against real Godot); the black
  // grid lines antialias, so it shares the sky scenes' relaxed threshold.
  { name: 'sky-panorama', file: 'unit-sky-panorama.tscn', maxDiffPct: 0.5 },
  // BG_SKY over a GOLD sky with AMBIENT_SOURCE_COLOR (flat grey 0.6,
  // sky_contribution 0) and AgX tonemapping. Pins two things together — the
  // shadowed grass stays grey (no sky IBL leaking into diffuse) while the
  // metallic sphere reflects the gold sky at full strength (reflection stays on
  // under a COLOR ambient). Matches real Godot to ≤6/255 (reflection to 1/255);
  // shadows + a metallic reflection are the most GPU-sensitive content, hence
  // the relaxed threshold.
  { name: 'stage-ambient-ibl', file: 'unit-stage-ambient-ibl.tscn', maxDiffPct: 0.5 },
  // The same env with the WorldEnvironment INSTANCED one level down. Renders
  // pixel-for-pixel like the direct fixture above — pins that an instanced
  // WorldEnvironment still drives tonemap + ambient and yields the editor
  // preview environment. If instance env-resolution regresses, this diverges
  // while stage-ambient-ibl stays green.
  { name: 'instanced-environment', file: 'unit-instanced-environment.tscn', maxDiffPct: 0.5 },
  // The same env with an UNSUPPORTED custom-shader sky. Pins that an unresolvable
  // sky does NOT collapse the environment: AgX + flat ambient still apply (grass
  // identical to the gold-sky fixture), the background falls back to the mid-blue
  // solid, and the metallic sphere — with no sky to reflect — reads near-black.
  { name: 'shader-sky-env', file: 'unit-shader-sky-env.tscn', maxDiffPct: 0.5 },
  // NOTE: unit-label3d.tscn is deliberately NOT in the set — Label3D
  // labels render effectively invisible after auto-framing (default
  // pixel_size 0.005 → ~0.08 world units tall; the committed showcase
  // poster docs/showcase/web/label3d.png is equally blank). Re-add once
  // that sizing issue is addressed.
  // NOTE: unit-animation-player*.tscn are deliberately NOT in the set —
  // AnimationPlayer playback is non-deterministic over time and never reaches
  // a byte-stable state once playing. The default (stopped) render shows the
  // authored pose, but the fixtures exist to be played, so they stay out of
  // the stability-gated visual set (same rationale as Label3D above).
  { name: 'mixed-nodes', file: 'integration-mixed-nodes.tscn' },
  // NOT rebaselined, deliberately, unlike material-features above. The same
  // Godot arbitration ran here and came back the other way: over the 801 px
  // where baseline and render disagree, the BASELINE measures 33.1% closer to
  // Godot, so the render is the worse of the two and rewriting the baseline
  // would freeze a regression. The pixels are scattered rather than one
  // object, and we are too bright exactly where Godot is darkest (mean over
  // them: Godot 79.6, baseline 101.8, ours 119.9), which reads as specular or
  // edge sampling rather than the global colour shift that moved
  // material-features. Threshold still tightened to the strict default, but
  // note that alone does not gate this: the miss is 0.023%, well under 0.1%.
  { name: 'hallway-mockup', file: 'example-hallway-mockup.tscn' },
  // Instance root merge (ADR-0013): two instances of unit-instance-child.tscn
  // collapse into Area3D coins at x=±1.5. Pins the rendered pixels of a
  // sub-scene-instancing scene so the wrapper-collapse + transform-replace
  // cannot silently shift them.
  { name: 'instanced-subscene', file: 'integration-instanced-subscene.tscn' },
  // Thin collision-gizmo lines are the most AA-sensitive content in the set.
  { name: 'physics-bodies', file: 'unit-physics-bodies.tscn', maxDiffPct: 0.3 },
  // The first golden ever to show a collision gizmo: `physics-bodies` above
  // carries CollisionShape3D nodes but the toggle is off, so its baseline is a
  // bare plane. Capsule / sphere / cylinder all used to fall through to a 1x1x1
  // box, and every gizmo was hard-coded green regardless of `debug_color`.
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
  // Decal `texture_albedo` as an INLINE GradientTexture2D. The albedo is the
  // only thing a decal projects, so an unresolved slot leaves the floor bare —
  // indistinguishable from a plain plane, which is why no other scene flags it.
  // Projection edges are antialiasing-sensitive, same threshold as `decal`.
  { name: 'decal-gradienttexture', file: 'unit-decal-gradienttexture.tscn', maxDiffPct: 0.3 },
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
  { name: 'pathfollow2d-follow', file: 'unit-pathfollow2d.tscn', mode: '2d', maxDiffPct: 0.3 },
  // PathFollow3D follow-offset (ADR-0018): a BoxMesh follower placed at
  // progress_ratio 0.5 along the parent Path3D's Curve3D. Same as the 2D case —
  // the Path3D curve gizmo is selection-gated and hidden here, so this pins the
  // follower box's curve placement (the non-gated, real scene-state behaviour).
  { name: 'pathfollow3d-follow', file: 'unit-pathfollow-3d.tscn' },

  // --- Selection-gated gizmos (ADR-0018): select the node, capture the gizmo. ---
  // These pin that the real tree-click → selection → gizmo path works for every
  // gizmo node type. Relaxed threshold: thin AA gizmo lines + selection box.
  { name: 'marker2d-selected', file: 'unit-marker2d.tscn', mode: '2d', select: 'Marker2DRoot/DefaultMarker', maxDiffPct: 0.5 },
  { name: 'path2d-selected', file: 'unit-path2d.tscn', mode: '2d', select: 'Path2DRoot/ArcPath', maxDiffPct: 0.5 },
  { name: 'pathfollow2d-selected', file: 'unit-pathfollow2d.tscn', mode: '2d', select: 'PathFollow2DRoot/TrackPath/Follower', maxDiffPct: 0.5 },
  { name: 'marker3d-selected', file: 'unit-marker-3d.tscn', select: 'Root/MyMarker3D', maxDiffPct: 0.5 },
  { name: 'path3d-selected', file: 'unit-pathfollow-3d.tscn', select: 'PathFollow3DRoot/TrackPath', maxDiffPct: 0.5 },
  { name: 'pathfollow3d-selected', file: 'unit-pathfollow-3d.tscn', select: 'PathFollow3DRoot/TrackPath/Follower', maxDiffPct: 0.5 },
  // The VehicleWheel3D gizmo — radius circle, spring coil, travel line, axle
  // ticks, forward arrow. Thin AA lines, hence the same tolerance as the other
  // gizmo goldens. No unselected companion: with the gizmo hidden this scene
  // renders like any other transform-only body fixture.
  { name: 'vehiclewheel3d-selected', file: 'unit-physics-vehicle.tscn', select: 'Root/Vehicle/Wheel1', maxDiffPct: 0.5 },

  // --- Lights / Camera3D / AudioStreamPlayer3D gizmo E2E coverage ---
  // Unselected: pins the non-gizmo render (ground + shading only — no helper).
  { name: 'directional-light-3d', file: 'unit-directional-light-3d.tscn' },
  { name: 'omni-light-3d', file: 'unit-omni-light-3d.tscn' },
  { name: 'spot-light-3d', file: 'unit-spot-light-3d.tscn', maxDiffPct: 0.5 },
  { name: 'camera-basic', file: 'unit-camera-basic.tscn' },
  { name: 'audio-stream-player-3d', file: 'unit-audio-stream-player.tscn' },
  // Selected: the core deliverable — real tree-click → selection → gizmo
  // render for each gate. Relaxed threshold: thin AA helper wireframes.
  {
    name: 'directional-light-3d-selected',
    file: 'unit-directional-light-3d.tscn',
    select: 'Root/DirectionalLight3D',
    maxDiffPct: 0.5,
  },
  {
    name: 'omni-light-3d-selected',
    file: 'unit-omni-light-3d.tscn',
    select: 'Root/OmniLight3D',
    maxDiffPct: 0.5,
  },
  {
    name: 'spot-light-3d-selected',
    file: 'unit-spot-light-3d.tscn',
    select: 'Root/SpotLight3D',
    maxDiffPct: 0.5,
  },
  // unit-multi-camera.tscn (not unit-camera-basic.tscn): a red box sits
  // in-frustum for depth reference alongside the selected CameraHelper.
  {
    name: 'camera3d-selected',
    file: 'unit-multi-camera.tscn',
    select: 'Root/MainCamera',
    maxDiffPct: 0.5,
  },
  {
    name: 'audio-stream-player-3d-selected',
    file: 'unit-audio-stream-player.tscn',
    select: 'Scene/Speaker_Default',
    maxDiffPct: 0.5,
  },
  // The emission cone: `Speaker_Cone` is the only corpus node anywhere that
  // sets `emission_angle_enabled`, and until now nothing rendered or asserted
  // it — the node existed purely to exercise a gizmo that was never drawn.
  {
    name: 'audio-stream-player-3d-cone-selected',
    file: 'unit-audio-stream-player.tscn',
    select: 'Scene/Speaker_Cone',
    maxDiffPct: 0.5,
  },

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
  // 2D nodes render in the 2D view (with its zoom/pan chrome) — relax the
  // threshold like the other 2D goldens (marker2d/path2d).
  { name: 'polygon-2d', file: 'unit-polygon2d.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'line-2d', file: 'unit-line2d.tscn', mode: '2d', maxDiffPct: 0.5 },
  // A y-sorted node's OWN body, between the two children it merges into the
  // same sort. Godot probes: (200,330) yellow — the bar covers the red block;
  // (700,330) blue — the blue one covers the bar. Without the body the first
  // is red, which no other golden would notice.
  { name: 'ysort-own-body', file: 'unit-ysort-own-body.tscn', mode: '2d', maxDiffPct: 0.5 },
  // The 2D light surface: ADD/SUB/MIX applied against a lit surface, and an
  // inline gradient cookie under a canvas tint with an unshaded item beside it.
  { name: 'pointlight2d-blend', file: 'unit-pointlight2d-blend.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'pointlight2d-gradient', file: 'unit-pointlight2d-gradient.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'pointlight2d-lightonly', file: 'unit-pointlight2d-lightonly.tscn', mode: '2d', maxDiffPct: 0.5 },
  // Godot's light culling: `light.range_item_cull_mask & item.light_mask != 0`.
  // Four panels under two lights of different cull masks: one panel takes only
  // the warm light, its NEIGHBOUR only the cool one, the third both, and the
  // fourth sits right under the cool light and takes neither. Nothing else in
  // the goldens sets either mask, so without this a light that reached
  // everything under it would move no baseline at all.
  { name: 'pointlight2d-cull-mask', file: 'unit-pointlight2d-cull-mask.tscn', mode: '2d', maxDiffPct: 0.5 },
  // The two range windows, which are the other half of the same cull test.
  // `range_z_max = 4` over panels at z_index 0, 4 and 5 pins the per-ITEM z
  // window and its inclusive upper bound; a default light over a world panel and
  // a bare CanvasLayer panel pins the per-CANVAS layer window, whose 0..0
  // default is why Godot never lights an untouched HUD.
  { name: 'pointlight2d-range-z', file: 'unit-pointlight2d-range-z.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'pointlight2d-range-layer', file: 'unit-pointlight2d-range-layer.tscn', mode: '2d', maxDiffPct: 0.5 },
  // LightOccluder2D shadows, one behaviour per fixture. A shadow withholds a
  // light from the geometry behind the occluder; it never darkens what the
  // light did not reach, so an unlit surface is the same grey either way.
  { name: 'lightoccluder2d-shadow-closed', file: 'unit-lightoccluder2d-shadow-closed.tscn', mode: '2d', maxDiffPct: 0.5 },
  // These two had fixtures and comparison images but no baseline, so nothing
  // guarded them — including `unit-lightoccluder2d-shadow`, the single-edge case
  // the LightOccluder2D sheet leads with. Every other occluder behaviour was
  // pinned, which is exactly why the gap was easy to miss.
  { name: 'lightoccluder2d', file: 'unit-lightoccluder2d.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'lightoccluder2d-shadow', file: 'unit-lightoccluder2d-shadow.tscn', mode: '2d', maxDiffPct: 0.5 },
  // `cull_mode` 0/1/2: which winding of an occluder's edges casts. The reversed
  // pair is the same two occluders with the polygon wound the other way, so
  // CLOCKWISE and COUNTER_CLOCKWISE swap and DISABLED stays put — a cull test
  // that read winding-independently would leave one of the two baselines flat.
  { name: 'lightoccluder2d-cull-mode', file: 'unit-lightoccluder2d-cull-mode.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'lightoccluder2d-cull-mode-reversed', file: 'unit-lightoccluder2d-cull-mode-reversed.tscn', mode: '2d', maxDiffPct: 0.5 },
  // `shadow_color` is the light's, not the occluder's, and it REPLACES the light
  // term rather than withholding it. It is also the one light term Godot does not
  // multiply by the item's albedo, so it rides its own accumulator — a baseline
  // that folded it into the ordinary one would sit a whole albedo out.
  { name: 'lightoccluder2d-shadow-color', file: 'unit-lightoccluder2d-shadow-color.tscn', mode: '2d', maxDiffPct: 0.5 },
  // `shadow_item_cull_mask & occluder.light_mask`: one occluder casts, its twin
  // is culled by the same light.
  { name: 'lightoccluder2d-shadow-mask', file: 'unit-lightoccluder2d-shadow-mask.tscn', mode: '2d', maxDiffPct: 0.5 },
  // Two shadowed lights in one accumulation pass: each must clear the stencil
  // before it stamps, or the first light's volume also cuts the second's.
  { name: 'lightoccluder2d-two-lights', file: 'unit-lightoccluder2d-two-lights.tscn', mode: '2d', maxDiffPct: 0.5 },
  // `shadow_filter`: the boundary is a STEPPED penumbra, not an edge, and every
  // occluder fixture above leaves the property at NONE — so without these three
  // the whole filtered mechanism is unpinned. The occluder's upper endpoint sits
  // at the light's own y, which puts the umbra boundary on the horizontal ray
  // and lets a vertical probe cross it perpendicular. Godot 4.6.3, transect at
  // x=676: 167 / 129 / 100 / 80 / 67 / 63 of 255 — the five PCF5 levels under
  // the (1-s)^2 falloff, with the step boundaries 19.4 px either side of the
  // geometric edge. PCF13 spreads the same ramp over the wider kernel, and the
  // colour fixture pins the fractional tint the two accumulators split.
  { name: 'pointlight2d-shadow-pcf5', file: 'unit-pointlight2d-shadow-pcf5.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'pointlight2d-shadow-pcf13', file: 'unit-pointlight2d-shadow-pcf13.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'pointlight2d-shadow-pcf-color', file: 'unit-pointlight2d-shadow-pcf-color.tscn', mode: '2d', maxDiffPct: 0.5 },
  // CPUParticles2D renders a FROZEN pose, so these baselines are what prove it
  // settles: a live emitter would never produce two identical frames and the
  // harness would fail it as unstable rather than as changed. Each fixture pins
  // `use_fixed_seed`/`seed`/`fixed_fps`/`preprocess` so the pose is one exact
  // draw rather than a plausible one.
  { name: 'cpuparticles2d', file: 'unit-cpuparticles2d.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'cpuparticles2d-emission-shapes', file: 'unit-cpuparticles2d-emission-shapes.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'cpuparticles2d-curves', file: 'unit-cpuparticles2d-curves.tscn', mode: '2d', maxDiffPct: 0.5 },
  { name: 'cpuparticles2d-color-ramp', file: 'unit-cpuparticles2d-color-ramp.tscn', mode: '2d', maxDiffPct: 0.5 },
  // A scaled emitter whose particles must NOT scale with it: Godot's default
  // `local_coords = false` emits into world space, which the dungeon candle relies on.
  { name: 'cpuparticles2d-local-coords', file: 'unit-cpuparticles2d-local-coords.tscn', mode: '2d', maxDiffPct: 0.5 },
  // `emitting = false` draws nothing. Script-triggered one-shot emitters ship
  // this way, so a regression that started drawing them would be widespread.
  { name: 'cpuparticles2d-not-emitting', file: 'unit-cpuparticles2d-not-emitting.tscn', mode: '2d', maxDiffPct: 0.5 },
  // The one emitter here that does NOT pin its seed, so it is the only one that
  // exercises the substituted one. Godot cannot draw this scene the same way
  // twice; the previewer must, and this baseline is the whole assertion of that.
  // Its image records OUR pose and is not arbitrable against a reference.
  { name: 'cpuparticles2d-unseeded', file: 'unit-cpuparticles2d-unseeded.tscn', mode: '2d', maxDiffPct: 0 },
  // Baseline corrected in the Y-flip fix: a NavigationPolygon's vertices are
  // Godot canvas pixels (+Y DOWN), and this overlay was the one 2D geometry
  // path that skipped the negation — so the navmesh used to sit ABOVE the
  // region origin instead of below it.
  { name: 'navigation-region-2d', file: 'unit-navigation-region-2d.tscn', mode: '2d', maxDiffPct: 0.5 },
  // A ParallaxBackground is a CanvasLayer: its subtree hangs off the VIEWPORT,
  // so the blue bar stays at the canvas origin while the red reference bar under
  // the same displaced parent moves with it. Every other 2D golden composes
  // transforms the ordinary way and would still match if that chain were
  // re-attached.
  { name: 'parallax-background', file: 'unit-parallax-background.tscn', mode: '2d', maxDiffPct: 0.5 },
  // `motion_mirroring` draws the layer a SECOND time, 200 px right — the only
  // repeated canvas subtree in the corpus, and the only property of a
  // ParallaxLayer a camera-less still frame can show at all.
  { name: 'parallax-layer', file: 'unit-parallax-layer.tscn', mode: '2d', maxDiffPct: 0.5 },
  // NOTE: AreaLight3D deliberately has no golden — its fixture is light-only
  // (no lit geometry), so the frame is blank. Add one once the fixture gains a
  // lit surface to show the emitter's effect.
  { name: 'material-ao', file: 'unit-material-ao.tscn' },
  { name: 'material-normal-map', file: 'unit-material-normal-map.tscn' },
  { name: 'material-textured', file: 'unit-material-textured.tscn' },
  { name: 'material-override', file: 'unit-material-override.tscn' },
  { name: 'surface-material-override', file: 'unit-surface-material-override.tscn' },
  // Multi-property showcase guard (12 spheres across 4 rows: basic PBR,
  // emission/normal, advanced PBR, transparency/glass).
  // Held a 0.5 threshold and a permanent 0.092% miss for months. The miss was
  // real: the emission colour-space fix landed after this baseline was written
  // and rebaselined only the glow/emission-specific goldens, so a global
  // tonemap change never reached this one. Arbitrated against Godot rather
  // than against the stale PNG — over the pixels where the two disagreed, the
  // render measured 13.4% closer to Godot than the baseline was — then
  // rebaselined and returned to the strict default. A loose threshold is what
  // let a genuine global change hide here; it does not get one back.
  { name: 'material-features', file: 'integration-material-features.tscn' },
  // StandardMaterial3D `billboard_mode = ENABLED` on a QuadMesh: the left quad
  // must turn to face the camera (full asymmetric walk sprite) while the right
  // quad (billboard_mode = DISABLED) foreshortens at the editor orbit. The only
  // golden that exercises mesh billboarding — every other fixture leaves it
  // inert. Sprite edges antialias against the ground, hence the relaxed
  // threshold.
  { name: 'material-billboard', file: 'unit-material-billboard.tscn', maxDiffPct: 0.5 },
  // An additive, unshaded, billboarded QuadMesh with a radial GradientTexture2D
  // reads as a soft gold ring over the dark ground, beside a metallic + emissive
  // body. Pins the additive-billboard-gradient glow path. Additive edges →
  // relaxed threshold.
  { name: 'coin-glow', file: 'unit-coin-glow.tscn', maxDiffPct: 0.5 },

  // --- Sprite2D/Sprite3D + 3D physics-body roundout ---
  { name: 'sprite2d', file: 'unit-sprite2d.tscn', mode: '2d' },
  // The ONE variable: a Sprite2D that MAGNIFIES its texture. Every other sprite
  // scene draws at 1:1, where a bilinear filter lands on texel centres and
  // never blends two texels, so the colour space the canvas blends in cannot
  // move a pixel in any of them. Godot's 64px ramp across one hard
  // black/white boundary is linear in the ENCODED bytes — rgb(129) at the
  // midpoint against the 189 a decode-before-filter order gives.
  { name: 'sprite2d-magnified', file: 'unit-sprite2d-magnified.tscn', mode: '2d' },
  // A Sprite2D whose `texture` is an INLINE GradientTexture2D — no file, no
  // path, rasterised out of the scene. Every other sprite scene points at an
  // image, so a regression in the procedural branch leaves all of them
  // pixel-identical while this one loses its quad to a placeholder.
  {
    name: 'sprite2d-gradienttexture',
    file: 'unit-sprite2d-gradienttexture.tscn',
    mode: '2d',
  },
  // The 3D half of that variable: Sprite3D decodes sRGB in hardware before
  // filtering, the opposite convention to the 2D canvas, so a procedural
  // texture can resolve correctly for Sprite2D and still be tagged wrongly here.
  { name: 'sprite3d-gradienttexture', file: 'unit-sprite3d-gradienttexture.tscn' },
  { name: 'sprite3d', file: 'unit-sprite3d.tscn' },
  // A region_rect bigger than its texture. Godot clips neither the region nor
  // the quad, so the overrun is decided by the sampler — and the two families
  // disagree: the 2D canvas clamps to the edge texel (one "F" plus a blue
  // smear), Sprite3D's material repeats (a 3x2 grid of "F"s). Both measured
  // against Godot 4.6.3; the 2D side matches it pixel-for-pixel. They are a
  // PAIR: pinning one alone would let the shared UV compositor be "fixed" into
  // agreeing with the wrong one.
  { name: 'sprite2d-region-oversized', file: 'unit-sprite2d-region-oversized.tscn', mode: '2d' },
  { name: 'sprite3d-region-oversized', file: 'unit-sprite3d-region-oversized.tscn' },
  // Transform-only bodies (ADR-0005/ADR-0008): reuse the Node3D component, so
  // the baseline's real content is the child mesh — pins that these render
  // the actual box/capsule geometry, not a gray fallback placeholder.
  { name: 'rigidbody3d', file: 'unit-rigidbody3d.tscn' },
  { name: 'characterbody3d', file: 'unit-characterbody3d.tscn' },

  // --- TileMap / TileMapLayer batched-geometry coverage ---
  { name: 'tile-map', file: 'unit-tile-map.tscn', mode: '2d' },
  { name: 'tile-map-layer', file: 'unit-tile-map-layer.tscn', mode: '2d' },
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
  { name: 'tile-map-layer-flips', file: 'unit-tile-map-layer-flips.tscn', mode: '2d', maxDiffPct: 0.02 },
  { name: 'tile-map-layer-isometric', file: 'unit-tile-map-layer-isometric.tscn', mode: '2d' },
  // Y-sort (issue 74) regression guard: the full isometric dungeon. Sibling y-sort
  // subtrees (Floor / Walls / Decorations under the non-y-sorted root) must layer in
  // disjoint tree-ordered z-bands, and each layer's tiles interleave with decorations
  // by Y — decorations must NOT hide behind the floor. maxDiffPct covers SwiftShader AA.
  { name: 'isometric-dungeon', file: 'dungeon.tscn', mode: '2d', maxDiffPct: 0.5 },
  // Hexagon grid (shape=3, vertical offset axis): odd columns stagger by
  // half a tile — the half-offset placement math had no visual guard before.
  { name: 'tile-map-layer-hexagon', file: 'unit-tile-map-layer-hexagon.tscn', mode: '2d' },

  // --- RemoteTransform3D / RemoteTransform2D drive their target ---
  // The relay copies its own transform onto the node its remote_path names
  // (resolved once at parse time — r3f/remoteTransforms.ts). Each fixture
  // authors the target AWAY from the relay so the render only reads right if
  // the drive applied: the 3D cube is authored at -2 X but driven to the
  // relay's +2; the 2D pentagon is authored at the gray ghost's spot but
  // driven to the relay's upper-right. Verified against real Godot 4.6.3.
  { name: 'remote-transform-3d', file: 'unit-remote-transform-3d.tscn' },
  { name: 'remote-transform-2d', file: 'unit-remote-transform-2d.tscn', mode: '2d', maxDiffPct: 0.5 },

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

  // --- Native Control rendering (ADR-0031) ---
  // Controls draw into the WebGL canvas like every other 2D item, so for the
  // first time they can be golden-gated at all. Each scene below moves ONE
  // piece of that renderer and its fixture header says which; between them
  // they cover the container solve, the StyleBoxFlat raster, the text engine,
  // a composite widget, clipping, and a viewport surface. All hold the strict
  // default threshold — the parity capture is a 1:1 frame with no camera fit,
  // and these draw flat fills and glyphs rather than shaded geometry.
  //
  // Every scene's layout was measured through Godot 4.6.3 at `--mode 2d`
  // before its baseline was written; the fixtures record the probes.
  { name: 'vbox-container-pitch', file: 'unit-vbox-container-pitch.tscn', mode: '2d' },
  { name: 'panel-styleboxes', file: 'unit-panel-styleboxes.tscn', mode: '2d' },
  { name: 'label-wrap', file: 'unit-label-2d-wrap.tscn', mode: '2d' },
  // The ONE variable: `vertical_alignment`. Every other Label in the bag is
  // V_TOP, where the offset is zero and Godot's int conversion of it is a
  // no-op, so the CENTER/BOTTOM/FILL branches are drawn by nothing else.
  { name: 'label-valign', file: 'unit-label-2d-valign.tscn', mode: '2d' },
  // `label-wrap` above (and every other Control golden) renders through the
  // bundled default MSDF atlas — none of them authors a Theme or a scene
  // font. This is the first: a Theme `.tres`'s `default_font`/
  // `default_font_size`, applied via `theme =` on the root Control and
  // resolved for two Labels with no local font override at all, one direct
  // child and one two hops down through a themeless wrapper Control — the
  // ancestor walk is what resolves them, not a node-local read. Fixture
  // header has the full rationale and the measured probes.
  { name: 'control-scene-font-theme', file: 'unit-control-scene-font-theme.tscn', mode: '2d' },
  // Same wiring, a `.woff2` `default_font` instead of a `.otf` one — the ONE
  // variable is the ascent/descent FALLBACK path (`sfntTables.ts` cannot table-
  // parse Brotli-compressed WOFF2, so this font's line metrics come from
  // canvas `TextMetrics.fontBoundingBoxAscent`/`.fontBoundingBoxDescent`
  // instead of a real `head`/`hhea` read) rather than the sibling's real SFNT
  // table read. Different typeface than the sibling on purpose — no same-face
  // `.woff2`/`.otf` pair exists in the corpus — so it is arbitrated on its own
  // terms against Godot, never against the sibling's baseline.
  { name: 'control-scene-font-woff2', file: 'unit-control-scene-font-woff2.tscn', mode: '2d' },
  { name: 'button-states', file: 'unit-button-states.tscn', mode: '2d' },
  // The ONE variable each: `anchors_preset` authored WITHOUT any explicit
  // `anchor_*` and without a `layout_mode`. Godot's setter is non-operational
  // in that state and ours applied it anyway; an editor-saved scene always
  // writes the matching `anchor_*` alongside the preset, so no other scene in
  // the bag can reach the gated path.
  {
    name: 'control-anchors-preset-gate',
    file: 'unit-control-anchors-preset-gate.tscn',
    mode: '2d',
  },
  // Its sibling: the preset's OFFSET side effect, in the only shape where it
  // survives the minimum-size floor — an authored `grow_*` that contradicts the
  // preset, so the rewritten offsets are not a fixed point.
  {
    name: 'control-anchors-preset-offsets',
    file: 'unit-control-anchors-preset-offsets.tscn',
    mode: '2d',
  },
  // The ONE variable: a vendored default-theme icon drawn MAGNIFIED. The theme
  // icons come from their own loader rather than the res:// resource pipeline,
  // and every other Control scene draws them at their natural size, so no
  // golden here can see their sampling colour space. Godot's ramp at the
  // checked icon's left edge dips to rgb(72) BELOW the 76 backdrop — a
  // signature only blending the encoded bytes produces.
  {
    name: 'checkbox-icon-magnified',
    file: 'unit-checkbox-icon-magnified.tscn',
    mode: '2d',
  },
  // A TextureRect and a Button icon fed by an INLINE GradientTexture2D. The
  // texture drives each node's MINIMUM SIZE as well as its pixels, so the
  // container sibling below it moves too — these report a layout regression,
  // not only a paint one.
  {
    name: 'texturerect-gradienttexture',
    file: 'unit-texturerect-gradienttexture.tscn',
    mode: '2d',
  },
  {
    name: 'button-icon-gradienttexture',
    file: 'unit-button-icon-gradienttexture.tscn',
    mode: '2d',
  },
  { name: 'scroll-container-clip', file: 'unit-scroll-container-clip.tscn', mode: '2d' },
  // The two SubViewportContainer surfaces. `sub-viewport-texture` above is a
  // SubViewport sampled by a MESH, which is a different consumer entirely — it
  // passed at 0 px throughout a window in which the container path drew nothing
  // at all, so a golden on the mesh side can say nothing about this one.
  // `-controls` holds Controls, which the container mounts and draws live;
  // `-2d-content` holds Polygon2Ds, which only reach it as the offscreen pass
  // driver's published texture. Neither substitutes for the other: the live arm
  // renders whether or not a single pixel ever leaves a render target.
  // Both were measured against Godot 4.6.3 at `--mode 2d` before their
  // baselines were written: `-controls` is pixel-identical to the engine over
  // the whole frame, and `-2d-content` is within 1/255 everywhere — the 8-bit
  // linear intermediate the SubViewportContainer sheet already documents.
  { name: 'sub-viewport-container-controls', file: 'unit-sub-viewport-container.tscn', mode: '2d' },
  {
    name: 'sub-viewport-container-2d-content',
    file: 'unit-sub-viewport-container-2d-content.tscn',
    mode: '2d',
  },
  // Both scenes above place their container at the scene origin, where a rect
  // solved half its own size off is indistinguishable from the surface being
  // authored there — which is exactly how a missing `get_minimum_size` port
  // stayed invisible. This one takes its rect from a size-consuming parent
  // instead of its own offsets, so the minimum size is load-bearing.
  {
    name: 'sub-viewport-container-centred',
    file: 'unit-sub-viewport-container-centred.tscn',
    mode: '2d',
  },
  // The ONE variable: a Label that AUTOWRAPS inside a container that sizes to
  // it. `label-wrap` above puts its wrapped Labels at authored widths with
  // nothing above them to be wrong against, so a wrapped height that never
  // reaches its parent moves no pixel there. Here the card's own height is the
  // measurement.
  {
    name: 'label-autowrap-in-container',
    file: 'unit-label-autowrap-in-container.tscn',
    mode: '2d',
  },
  // The ONE variable: a ScrollContainer whose bar rects land on a FRACTION.
  // `scroll-container-clip` above is 600x500 with an even bar thickness, so its
  // bar origins are whole numbers and the per-canvas-item snap is a no-op in
  // it — it cannot see this at all.
  {
    name: 'scroll-container-bar-snap',
    file: 'unit-scroll-container-bar-snap.tscn',
    mode: '2d',
  },
  // The composition scene. It deliberately breaks the one-variable rule every
  // entry above follows: it moves many at once and can never localise a
  // regression, and the `unit-*` fixture that owns a type is still where one
  // gets localised. It exists to catch the interactions a single-variable scene
  // has, by construction, nothing to interact with — the two faults it found on
  // its first capture were each invisible to all 23 single-widget scenes.
  // Text-dense, so MSDF stem antialiasing dominates its diff.
  { name: 'complex-2d-gui', file: 'complex-2d-gui.tscn', mode: '2d', maxDiffPct: 0.5 },
];
