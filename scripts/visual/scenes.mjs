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

  // --- Selection-gated gizmos (ADR-0018): select the node, capture the gizmo. ---
  // These pin that the real tree-click → selection → gizmo path works for every
  // gizmo node type. Relaxed threshold: thin AA gizmo lines + selection box.
  { name: 'marker2d-selected', file: 'unit-marker2d.tscn', select: 'Marker2DRoot/DefaultMarker', maxDiffPct: 0.5 },
  { name: 'path2d-selected', file: 'unit-path2d.tscn', select: 'Path2DRoot/ArcPath', maxDiffPct: 0.5 },
  { name: 'pathfollow2d-selected', file: 'unit-pathfollow2d.tscn', select: 'PathFollow2DRoot/TrackPath/Follower', maxDiffPct: 0.5 },
  { name: 'marker3d-selected', file: 'unit-marker-3d.tscn', select: 'Root/MyMarker3D', maxDiffPct: 0.5 },
  { name: 'path3d-selected', file: 'unit-pathfollow-3d.tscn', select: 'PathFollow3DRoot/TrackPath', maxDiffPct: 0.5 },
  { name: 'pathfollow3d-selected', file: 'unit-pathfollow-3d.tscn', select: 'PathFollow3DRoot/TrackPath/Follower', maxDiffPct: 0.5 },

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
  { name: 'polygon-2d', file: 'unit-polygon2d.tscn', maxDiffPct: 0.5 },
  { name: 'line-2d', file: 'unit-line2d.tscn', maxDiffPct: 0.5 },
  // Baseline corrected in the Y-flip fix: a NavigationPolygon's vertices are
  // Godot canvas pixels (+Y DOWN), and this overlay was the one 2D geometry
  // path that skipped the negation — so the navmesh used to sit ABOVE the
  // region origin instead of below it.
  { name: 'navigation-region-2d', file: 'unit-navigation-region-2d.tscn', maxDiffPct: 0.5 },
  // A ParallaxBackground is a CanvasLayer: its subtree hangs off the VIEWPORT,
  // so the blue bar stays at the canvas origin while the red reference bar under
  // the same displaced parent moves with it. Every other 2D golden composes
  // transforms the ordinary way and would still match if that chain were
  // re-attached.
  { name: 'parallax-background', file: 'unit-parallax-background.tscn', maxDiffPct: 0.5 },
  // `motion_mirroring` draws the layer a SECOND time, 200 px right — the only
  // repeated canvas subtree in the corpus, and the only property of a
  // ParallaxLayer a camera-less still frame can show at all.
  { name: 'parallax-layer', file: 'unit-parallax-layer.tscn', maxDiffPct: 0.5 },
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
  { name: 'material-features', file: 'integration-material-features.tscn', maxDiffPct: 0.5 },
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
  { name: 'sprite2d', file: 'unit-sprite2d.tscn' },
  { name: 'sprite3d', file: 'unit-sprite3d.tscn' },
  // A region_rect bigger than its texture. Godot clips neither the region nor
  // the quad, so the overrun is decided by the sampler — and the two families
  // disagree: the 2D canvas clamps to the edge texel (one "F" plus a blue
  // smear), Sprite3D's material repeats (a 3x2 grid of "F"s). Both measured
  // against Godot 4.6.3; the 2D side matches it pixel-for-pixel. They are a
  // PAIR: pinning one alone would let the shared UV compositor be "fixed" into
  // agreeing with the wrong one.
  { name: 'sprite2d-region-oversized', file: 'unit-sprite2d-region-oversized.tscn' },
  { name: 'sprite3d-region-oversized', file: 'unit-sprite3d-region-oversized.tscn' },
  // Transform-only bodies (ADR-0005/ADR-0008): reuse the Node3D component, so
  // the baseline's real content is the child mesh — pins that these render
  // the actual box/capsule geometry, not a gray fallback placeholder.
  { name: 'rigidbody3d', file: 'unit-rigidbody3d.tscn' },
  { name: 'characterbody3d', file: 'unit-characterbody3d.tscn' },

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
