/**
 * The rest of the 2D canvas: polygons and lines, a Bone2D rig, y-sorting, 2D navigation and
 * parallax. The 2D Control, window, light and particle goldens have chapters beside this file.
 */

export const CANVAS_2D_SCENES = [
  { name: 'polygon-2d', file: 'unit-polygon2d.tscn' },
  // An INT component past int32 wraps as Godot stores it. Godot probes: (260,160) red, the square at
  // (200,100), and (660,360) blue, the square at (600,300). Refused, both sit at the origin.
  { name: 'int-wrap-position', file: 'edge-int-wrap-position.tscn' },
  { name: 'line-2d', file: 'unit-line2d.tscn' },
  // A `true` literal in INT and FLOAT slots stores 1: frame 1 of a two-frame sheet, z_index 1 over a
  // later sibling, and rotation 1 rad. Godot probes: (230,160) white, (550,160) green and (900,324)
  // blue. Read as 0, the first is black, the second yellow and the bar lies flat.
  { name: 'bool-numeric-slots', file: 'unit-bool-numeric-slots.tscn' },
  // A `parent=` path that names no node re-roots under the scene root. Godot probes: (40,40) red, the
  // orphan; (120,40) green, its child re-rooted on its own; (40,120) blue, below a moved parent that
  // does not apply. Dropped, all three are the grey background.
  { name: 'orphan-reroot', file: 'unit-orphan-reroot.tscn' },
  // Two chained Bone2Ds, each turned and moved, with a bar under each. Godot
  // probes: (387,210) orange, mid upper arm, and (473,340) blue, mid forearm.
  // A bone drawn as an untransformed group stacks both bars at the skeleton.
  { name: 'bone2d-rig', file: 'unit-bone2d-rig.tscn' },
  // A y-sorted node's own body, between the two children it merges into the
  // same sort. Godot probes: (200,330) yellow, the bar over the red block, and
  // (700,330) blue, the blue block over the bar. Without the body the first is
  // red, which no other golden notices.
  { name: 'ysort-own-body', file: 'unit-ysort-own-body.tscn' },
  // A NavigationPolygon's vertices are Godot canvas pixels (+Y down). Without
  // the negation, the navmesh draws above the region origin instead of below.
  { name: 'navigation-region-2d', file: 'unit-navigation-region-2d.tscn' },
  // A ParallaxBackground is a CanvasLayer: its subtree hangs off the viewport,
  // so the blue bar stays at the canvas origin while the red reference bar moves
  // with the displaced parent. Every other 2D golden composes transforms the
  // ordinary way.
  { name: 'parallax-background', file: 'unit-parallax-background.tscn' },
  // `motion_mirroring` draws the layer a second time, 200 px right: the only
  // repeated canvas subtree, and the only ParallaxLayer property a camera-less
  // still frame shows.
  { name: 'parallax-layer', file: 'unit-parallax-layer.tscn' },
  // `scroll_ignore_camera_zoom` under a zoom-2 Camera2D in a sub-viewport. Godot 4.6.3 draws Bar
  // at screen 125..204 x 100..129, its authored size, and Band at 110..389 x 140..179.
  { name: 'parallax-ignore-camera-zoom', file: 'unit-parallax-ignore-camera-zoom.tscn' },
  // The one variable: a Sprite2D that magnifies its texture. Every other sprite
  // scene draws at 1:1, where a bilinear filter never blends two texels.
  // Godot's 64px ramp across a black/white edge is linear in the encoded bytes:
  // rgb(129) at the midpoint, against 189 for decode-before-filter.
  { name: 'sprite2d-magnified', file: 'unit-sprite2d-magnified.tscn' },
  // The one variable: `texture_filter` on the Node2D parent. A Nearest parent keeps a magnified
  // Sprite2D's edge a hard step, and the project's Linear default blends it over one texel.
  {
    name: 'sprite2d-texture-filter-inherited',
    file: 'unit-sprite2d-texture-filter-inherited.tscn',
  },
  // The one variable: `texture_filter` 3 against 5 on the Node2D parent, over a texture minified
  // more across than down. Only the anisotropic filter keeps the stripes, as in Godot.
  {
    name: 'sprite2d-texture-filter-nearest-anisotropic',
    file: 'unit-sprite2d-texture-filter-nearest-anisotropic.tscn',
  },
  // The one variable: `texture_repeat` on a Polygon2D with UVs three times the texture's size.
  // Enabled tiles it, and the default clamps to the edge texels.
  { name: 'polygon2d-texture-repeat', file: 'unit-polygon2d-texture-repeat.tscn' },
  // The one variable: `texture_filter` on the Node2D parent, read through AnimatedSprite2D's own
  // frame-texture path, which Sprite2D's golden above does not exercise.
  {
    name: 'animatedsprite2d-texture-filter-inherited',
    file: 'unit-animatedsprite2d-texture-filter-inherited.tscn',
  },
  // A Sprite2D whose `texture` is an inline GradientTexture2D, rasterised out of
  // the scene. Every other sprite scene points at an image, so only this one
  // loses its quad to a placeholder when the procedural branch breaks.
  {
    name: 'sprite2d-gradienttexture',
    file: 'unit-sprite2d-gradienttexture.tscn',
  },
  // A GradientTexture2D whose `gradient` is a saved Gradient (.tres). The header states why no
  // other golden shows it.
  { name: 'sprite2d-gradienttexture-tres', file: 'unit-sprite2d-gradienttexture-tres.tscn' },
  // A NoiseTexture2D whose `noise` and `color_ramp` are saved resources (.tres). The header states
  // why no other golden shows it.
  { name: 'noisetexture2d-tres', file: 'unit-noisetexture2d-tres.tscn' },
  // A Sprite2D whose `texture` is an ImageTexture saved as its own .tres, its pixels an inline
  // Image. The header states why no other golden shows it.
  { name: 'sprite2d-imagetexture-tres', file: 'unit-sprite2d-imagetexture-tres.tscn' },
  { name: 'sprite2d-imagetexture-half-tres', file: 'unit-sprite2d-imagetexture-half-tres.tscn' },
  // Six ImageTextures, one per S3TC and RGTC format. The header states why no other golden shows it.
  { name: 'sprite2d-block-compressed', file: 'unit-sprite2d-block-compressed.tscn' },
  // Native Control rendering (ADR-0037): Controls draw into the WebGL canvas
  // like every other 2D item, captured in a 1:1 frame with no camera fit. This
  // scene moves one piece of that renderer. Its fixture header says which
  // and records the Godot 4.6.3 `--mode 2d` probes of its baseline.
  { name: 'vbox-container-pitch', file: 'unit-vbox-container-pitch.tscn' },
  { name: 'panel-styleboxes', file: 'unit-panel-styleboxes.tscn' },
  // The one variable: the whole-pass stages of `StyleBoxFlat::draw`. `skew`
  // shears the box without moving it and turns anti-aliasing on by itself. The drop shadow draws
  // before everything else. Neither changes a radius or a border width, so no
  // other stylebox scene sees them.
  { name: 'panel-stylebox-skew-shadow', file: 'unit-panel-stylebox-skew-shadow.tscn' },
  // The one variable: the theme text outline of LinkButton, the FoldableContainer title and ItemList
  // items, left to right and as a trimmed AUTO Hebrew line, whose ring trims by the inferred direction.
  {
    name: 'link-foldable-item-list-outline',
    file: 'unit-text-outline-link-foldable-item-list.tscn',
  },
  // The same atlas decode reached through SpriteFrames. It shares the decode but
  // not the resource pools, so the atlas entry can pass while this one draws
  // nothing.
  {
    name: 'animatedsprite2d-atlas',
    file: 'unit-animatedsprite2d-atlas.tscn',
  },
  // The two SubViewportContainer surfaces. A mesh-sampled SubViewport
  // (`sub-viewport-texture`) is a different consumer. `-controls` holds Controls,
  // drawn live even when no pixel leaves a render target. Godot 4.6.3
  // `--mode 2d`: pixel-identical over the whole frame.
  { name: 'sub-viewport-container-controls', file: 'unit-sub-viewport-container.tscn' },
  // `-2d-content` holds Polygon2Ds, which reach the container only as the
  // offscreen pass's published texture. A canvas target stores sRGB bytes, which
  // the container filters raw and multiplies in sRGB. Godot 4.6.3 `--mode 2d`:
  // within 1/255, on the clear colour.
  {
    name: 'sub-viewport-container-2d-content',
    file: 'unit-sub-viewport-container-2d-content.tscn',
  },
  // `stretch` on: the target takes the container's 300x200, not the authored 200x150. Godot
  // 4.6.3 `--mode 2d`: (350,255) rgb(255,102,0) in both, within 1/255 on the clear colour.
  {
    name: 'sub-viewport-container-stretch-2d-content',
    file: 'unit-sub-viewport-container-stretch-2d-content.tscn',
  },
  // The target magnified twice: the filter blends the stored sRGB bytes across each edge. Godot
  // 4.6.3 `--mode 2d`: (249,120) rgb(210,96,19) and (150,179) rgb(195,80,4), within 1/255.
  {
    name: 'sub-viewport-container-shrink-2d-content',
    file: 'unit-sub-viewport-container-shrink-2d-content.tscn',
  },
  // Translucent content blends over the clear colour in the target's sRGB numbers, through the
  // 2D-world pass and the Control pass. Godot 4.6.3 `--mode 2d`: (150,130) rgb(165,89,38).
  {
    name: 'sub-viewport-container-translucent',
    file: 'unit-sub-viewport-container-translucent.tscn',
  },
  // The same magnified edge with a 3D subtree as the content: the SRGB8 target serves a plain view
  // of its bytes, which the container filters raw. Godot 4.6.3 `--mode 2d`: (199,180) rgb(210,96,19)
  // and (200,180) rgb(121,83,57), within 1/255.
  {
    name: 'sub-viewport-container-shrink-3d-content',
    file: 'unit-sub-viewport-container-shrink-3d-content.tscn',
  },
  // A translucent 3D surface blends in linear light inside the target. Godot 4.6.3 `--mode 2d`:
  // (170,180) rgb(193,90,54), within 1/255.
  {
    name: 'sub-viewport-container-translucent-3d-content',
    file: 'unit-sub-viewport-container-translucent-3d-content.tscn',
  },
  // The one scene with a TouchScreenButton, which draws `texture_normal` at its origin in the
  // editor whatever `visibility_mode` says (touch_screen_button.cpp:140).
  { name: 'touch-screen-button', file: 'touch-screen-button/unit-touch-screen-button.tscn' },
  // The one scene with a Sprite2D that has no texture. Godot's draw returns early for both an unset
  // and a null texture (sprite_2d.cpp:159), so neither shows a placeholder between the anchors.
  { name: 'sprite2d-untextured', file: 'unit-sprite2d-untextured.tscn' },
  // The one scene with an AnimatedSprite2D that has no sprite_frames. Godot's draw returns early for
  // both an unset and a null one (animated_sprite_2d.cpp:270), so neither shows a placeholder.
  { name: 'animatedsprite2d-untextured', file: 'unit-animatedsprite2d-untextured.tscn' },
  // A Sprite2D samples a ViewportTexture minified over 1 px stripes. Godot 4.6.3 `--mode 2d`:
  // rgb(128,51,0), the byte average.
  {
    name: 'sprite-2d-viewport-texture',
    file: 'unit-sprite-2d-viewport-texture.tscn',
  },
  // A Sprite2D draws one frame of a ViewportTexture, upright and flipped. Godot 4.6.3 `--mode 2d`:
  // the left frame's edge pixels blend into rgb(120, 0, 0) and rgb(0, 0, 120), its neighbours' texels.
  {
    name: 'sprite-2d-viewport-texture-frame',
    file: 'unit-sprite-2d-viewport-texture-frame.tscn',
  },
  // A ViewportTexture under a CanvasTexture that is not local to scene draws the placeholder, and
  // one under a local CanvasTexture the target. Godot 4.6.3 `--mode 2d`: (110,110) rgb(255,0,255),
  // (150,110) rgb(125,0,125), (500,150) rgb(255,0,0) and (405,200) rgb(0,255,0).
  {
    name: 'viewport-texture-local-to-scene',
    file: 'unit-viewport-texture-local-to-scene.tscn',
  },
  // A padded TileSet over a ViewportTexture: the placeholder at the padded regions when it is not
  // local to scene, the unrendered target when it is. Godot 4.6.3 `--mode 2d`: (101,101)
  // rgb(199,0,199), (150,150) rgb(255,0,255) and (450,150) rgb(0,0,0).
  {
    name: 'tile-atlas-viewport-padding',
    file: 'unit-tile-atlas-viewport-padding.tscn',
  },
  // A TileSet atlas over a ViewportTexture, inline and from a .tres: neither creates a tile at load.
  // Godot 4.6.3 `--mode 2d`: (130,120) and (430,120) rgb(76,76,76), the clear colour.
  {
    name: 'tile-atlas-viewport-texture-file',
    file: 'unit-tile-atlas-viewport-texture-file.tscn',
  },
  // A WorldEnvironment inside a shared-world viewport glows its target. Godot 4.6.3 `--mode 2d`:
  // (400,370) rgb(106,63,30) in the bloom below the sphere, and (400,420) rgb(31,22,24).
  {
    name: 'sprite-2d-shared-world-environment',
    file: 'unit-sprite-2d-shared-world-environment.tscn',
  },
  // Two shared-world viewports take the first WorldEnvironment in tree order, so both glow. Godot
  // 4.6.3 `--mode 2d`: both targets match, with the bloom of the Left one's Environment.
  {
    name: 'sprite-2d-shared-world-first-environment',
    file: 'unit-sprite-2d-shared-world-first-environment.tscn',
  },
  // Two shared-world viewports draw one World3D, so the Right camera shows the Left one's sphere.
  // Godot 4.6.3 `--mode 2d`: both targets match, each with the glowing sphere.
  {
    name: 'sprite-2d-shared-world-content',
    file: 'unit-sprite-2d-shared-world-content.tscn',
  },
  // A 301x201 container at shrink 2: a 150x100 target drawn over the whole rect. Godot 4.6.3
  // `--mode 2d`: (400,150) rgb(127,127,127) and (200,280) rgb(76,76,76), the last column and row.
  {
    name: 'sub-viewport-container-stretch-shrink-odd',
    file: 'unit-sub-viewport-container-stretch-shrink-odd.tscn',
  },
  // An outer light and tint over a Control-only SubViewport. Godot 4.6.3 `--mode 2d`: (150,120)
  // rgb(82,133,102), lit once by the outer canvas, not twice.
  {
    name: 'sub-viewport-control-outer-light',
    file: 'unit-sub-viewport-control-outer-light.tscn',
  },
  // A ColorRect and a Polygon2D in one sub-viewport, lit by its own sun. Godot 4.6.3 `--mode 2d`:
  // (250,200) and (550,200) rgb(0,0,123) the ColorRect and the Polygon2D, (250,500) rgb(0,0,112) the
  // stage ColorRect under the stage sun alone.
  { name: 'sub-viewport-mixed-controls', file: 'unit-sub-viewport-mixed-controls.tscn' },
  // A ColorRect over a 3D world in one sub-viewport. Godot 4.6.3 `--mode 2d`: (150,180)
  // rgb(127,153,0) the translucent Veil blended over the quad in sRGB numbers, (250,180)
  // rgb(255,102,0) the quad alone, (240,240) rgb(51,51,230) the Plate, (110,90) rgb(38,140,38) the
  // Veil over the clear colour.
  { name: 'sub-viewport-3d-controls', file: 'unit-sub-viewport-3d-controls.tscn' },
  // 2D-world items over a 3D world in one sub-viewport. Godot 4.6.3 `--mode 2d`: (150,180)
  // rgb(128,153,0) the translucent Veil over the quad, (250,180) rgb(255,102,0) the quad alone,
  // (240,240) rgb(51,51,229) Plate over Under, (260,260) rgb(229,25,25) Under, on a CanvasLayer
  // below the world's canvas, over the quad all the same.
  { name: 'sub-viewport-3d-canvas-item', file: 'unit-sub-viewport-3d-canvas-item.tscn' },
  // A 3D viewport under the Canvas background mode draws the layers up to the max layer behind its
  // 3D render. Godot 4.6.3 `--mode 2d`: (120,100) rgb(25,127,25) Ground, (120,250) rgb(152,50,50)
  // Under, (162,200) rgb(255,102,0) the quad over Under, (200,180) rgb(133,72,137) Plate over the quad.
  { name: 'sub-viewport-3d-canvas-background', file: 'unit-sub-viewport-3d-canvas-background.tscn' },
  // The same scene under the Keep background mode, where the 3D buffer is black. Godot 4.6.3
  // `--mode 2d`: (120,250) rgb(114,12,12) Under over black, (162,200) rgb(242,63,12) Under over the
  // quad, (200,180) rgb(128,56,142) Plate over both.
  { name: 'sub-viewport-3d-keep-background', file: 'unit-sub-viewport-3d-keep-background.tscn' },
  // A sub-viewport lights its own 2D content with its own lights and CanvasModulate. Godot 4.6.3
  // `--mode 2d`: (160,155) rgb(159,123,130) under the Torch, (280,200) rgb(51,64,108) the tinted
  // far Floor, and (600,155) rgb(127,127,127) the untinted, unlit Outside.
  { name: 'sub-viewport-2d-light', file: 'unit-sub-viewport-2d-light.tscn' },
  // A DirectionalLight2D shadow inside a sub-viewport, beside a sun outside it. Godot 4.6.3
  // `--mode 2d`: (150,150) rgb(63,63,63) in the Wall's shadow, (250,150) rgb(158,110,87) lit by
  // the inside sun, and (600,155) rgb(84,114,84) lit by the outside sun alone. The outside sun
  // lights the Backdrop and the container's surface too: (350,150) rgb(0,0,112), (150,150)
  // rgb(69,94,69) the Wall's shadow on the lit surface.
  {
    name: 'sub-viewport-2d-directional-shadow',
    file: 'unit-sub-viewport-2d-directional-shadow.tscn',
  },
  // A viewport lists its own canvas first, then each CanvasLayer, whatever the tree order, and a
  // MIX light after an ADD light differs from the reverse. Godot 4.6.3 `--mode 2d`, as Add then
  // Mix: rgb(52,68,126) between the lights at (575,325), rgb(112,105,125) under the Add light at
  // (500,325), and rgb(37,58,126) under the Mix light at (650,325).
  { name: 'canvas-layer-light-order', file: 'unit-canvas-layer-light-order.tscn' },
  // The CanvasLayers list in tree order, not by `layer`: layer 5 holds the ADD light and comes
  // first. Godot 4.6.3 `--mode 2d` gives the same three readings as the scene above.
  {
    name: 'canvas-layer-light-order-by-tree',
    file: 'unit-canvas-layer-light-order-by-tree.tscn',
  },
  // Markers at list positions 0 to 155 are lit, 156 up are not. Godot 4.6.3 `--mode 2d`:
  // rgb(100,100,100) at (20..260,120) and (500,120), rgb(51,51,51) at (320..440,120). Each light is
  // one full-screen pass, so a frame takes seconds in software rendering.
  {
    name: 'canvas-light-render-budget',
    file: 'unit-canvas-light-render-budget.tscn',
    settleTimeout: 120000,
  },
  // A CanvasLayer under the sub-viewport's Camera2D (ADR-0006) stays in viewport pixels. The
  // reference harness disables every Camera2D, as the editor does, so the probe is Godot 4.6.3 at
  // runtime: rgb(0,204,76) at (180,130), where the layer's Badge sits.
  {
    name: 'sub-viewport-camera-2d-canvas-layer',
    file: 'unit-sub-viewport-camera-2d-canvas-layer.tscn',
  },
  // The container takes its rect from a size-consuming parent, so its minimum
  // size is load-bearing. At the scene origin, a rect solved half its size off
  // looks the same as an authored one.
  {
    name: 'sub-viewport-container-centred',
    file: 'unit-sub-viewport-container-centred.tscn',
  },
  // The composition scene breaks the one-variable rule on purpose: it catches
  // interactions a single-variable scene has nothing to interact with. The
  // `unit-*` fixture of a type localises a regression. Text-dense, so MSDF stem
  // antialiasing dominates its diff.
  { name: 'complex-2d-gui', file: 'complex-2d-gui.tscn' },
  // The one variable: whether an ancestor's `modulate` crosses a CanvasLayer.
  // The Control walk and the Node2D dispatch publish that scope separately, so
  // both families are here. Godot 4.6.3 `--mode 2d`: in-layer squares read
  // rgb(255,255,255), the outside ones rgb(64,64,64), on both sides.
  {
    name: 'canvas-layer-modulate-scope',
    file: 'unit-canvas-layer-modulate-scope.tscn',
  },
  // The one variable: a CanvasLayer's own offset, rotation and scale, which move both walks'
  // children. Godot 4.6.3 `--mode 2d`: rgb(51,153,255) at (430,170) and (500,250).
  { name: 'canvas-layer-transform', file: 'unit-canvas-layer-transform.tscn' },
  // A Sprite2D, a Polygon2D and a ColorRect with their top and bottom edges on pixel centres in y,
  // beside a Sprite2D on whole pixels. Godot 4.6.3 draws rows 100-195 for the sprite at y = 100.5
  // (`pnpm ref:diff`: 1/255). A frame whose row 0 is the canvas bottom draws rows 101-196.
  { name: 'canvas-edge-on-pixel-centre', file: 'unit-canvas-edge-on-pixel-centre.tscn' },
  { name: 'subviewport-edge-on-pixel-centre', file: 'unit-subviewport-edge-on-pixel-centre.tscn' },
  { name: 'subviewport-control-edge-on-pixel-centre', file: 'unit-subviewport-control-edge-on-pixel-centre.tscn' },
  {
    name: 'node2d-detached-transform',
    file: 'unit-node2d-detached-transform.tscn',
  },
  { name: 'node2d-top-level', file: 'unit-node2d-top-level.tscn' },
  // This scene pairs an LTR node with an identical RTL twin, so a failed
  // mirror shows as the halves disagreeing. Against Godot 4.6.3 the residuals
  // match band by band, which a 1px shift on one side breaks. `layout_direction`
  // reaches each widget's own arrangement, so no scene stands in for the rest.
  { name: 'grid-container-rtl', file: 'unit-grid-container-rtl.tscn' },
  { name: 'flow-container-rtl', file: 'unit-flow-container-rtl.tscn' },
  { name: 'flow-container-rtl-reverse-fill', file: 'unit-flow-container-rtl-reverse-fill.tscn' },
  { name: 'aspect-ratio-container-rtl', file: 'unit-aspect-ratio-container-rtl.tscn' },
  { name: 'margin-container-rtl', file: 'unit-margin-container-rtl.tscn' },
  { name: 'foldable-container-rtl', file: 'unit-foldable-container-rtl.tscn' },
  { name: 'menu-bar-rtl', file: 'unit-menu-bar-rtl.tscn' },
  { name: 'optionbutton-rtl', file: 'unit-optionbutton-rtl.tscn' },
  { name: 'link-button-rtl', file: 'unit-link-button-rtl.tscn' },
  { name: 'title-text-direction', file: 'unit-title-text-direction.tscn' },
  { name: 'tree-rtl', file: 'unit-tree-rtl.tscn' },
  { name: 'hslider-rtl', file: 'unit-hslider-rtl.tscn' },
  { name: 'numeral-locale', file: 'numeral-locale/unit-numeral-locale.tscn' },
  // A Polygon2D below a plain Node below a hidden Node2D: its visibility comes from the Window.
  { name: 'canvas-root-visibility', file: 'unit-canvas-root-visibility.tscn' },
];
