/**
 * The rest of the 2D canvas: polygons and lines, a Bone2D rig, y-sorting, 2D navigation and
 * parallax. The 2D Control, window, light and particle goldens have chapters beside this file.
 */

export const CANVAS_2D_SCENES = [
  { name: 'polygon-2d', file: 'unit-polygon2d.tscn' },
  // The one variable: a hidden CanvasLayer, which hides the Polygon2D and the Control below it. Godot 4.6.3 `--mode 2d`: 1/255.
  { name: 'canvas-layer-hidden', file: 'unit-node2d-below-hidden-canvas-layer.tscn', mode: '2d' },
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
  // A Polygon2D with y_sort_enabled sorts its children, as every CanvasItem does: A, first in the tree
  // at y 200, draws over B at y 100. Godot probe: (400,250) orange (229,76,25), A on top.
  { name: 'ysort-root-polygon2d', file: 'unit-ysort-root-polygon2d.tscn' },
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
  // A GradientTexture2D with no gradient holds no image, so a Sprite2D and a TextureRect draw
  // Godot's placeholder over the texture's width and height. The header states why no other golden
  // shows it.
  { name: 'sprite2d-gradient-no-gradient', file: 'unit-sprite2d-gradient-no-gradient.tscn' },
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
  // A texture resource file inside a Texture2D chain: the sheet of an AtlasTexture, a CanvasTexture
  // and its diffuse map, and the Image of an ImageTexture. Each draws its inline twin beside it.
  { name: 'sprite2d-atlastexture-over-texture-file', file: 'unit-atlas-texture-over-texture-file.tscn' },
  {
    name: 'sprite2d-canvastexture-file-over-texture-file',
    file: 'unit-canvas-texture-file-over-texture-file.tscn',
  },
  { name: 'sprite2d-imagetexture-over-image-file', file: 'unit-image-texture-over-image-file.tscn' },
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
  // A Polygon2D and a Line2D sample a ViewportTexture of an unshaded 3D box, at modulate 1 and 0.5.
  // Godot 4.6.3 `--mode 2d`: (384,184) rgb(51,127,204) and (704,184) rgb(26,64,102) in both scenes.
  { name: 'polygon2d-viewport-texture-3d', file: 'unit-polygon2d-viewport-texture-3d.tscn' },
  { name: 'line2d-viewport-texture-3d', file: 'unit-line2d-viewport-texture-3d.tscn' },
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
  // `unit-*` fixture of a type localises a regression.
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
  // Two strips skinned to posed Skeleton2Ds. Godot probes: blue (51,153,255) at (200,190) on the bent
  // lower half and orange (255,127,51) at (330,160). Undeformed, each strip would cover (240,100) and
  // (390,120) instead, which read the background.
  { name: 'polygon2d-skeleton', file: 'unit-polygon2d-skeleton.tscn', mode: '2d' },
  // A LookAt modification turns the bone at the red target below it. Godot probes: orange
  // (242,140,38) at (294,250) and blue (51,153,242) at (264,250). Unsolved, the bars lie flat and
  // both points read the background.
  { name: 'skeleton2d-lookat', file: 'unit-skeleton2d-lookat.tscn', mode: '2d' },
  // The LookAt scene under a CanvasGroup, whose buffer draws the solved pose too. Godot probes as
  // for skeleton2d-lookat: orange at (294,250) and blue at (264,250).
  { name: 'skeleton2d-canvas-group', file: 'unit-skeleton2d-canvas-group.tscn', mode: '2d' },
  // The same scene with the stack not enabled: the bones keep the scene's pose. Godot probes:
  // orange at (304,150) and blue at (304,180), and background at (294,250).
  { name: 'skeleton2d-stack-disabled', file: 'unit-skeleton2d-stack-disabled.tscn', mode: '2d' },
  // TwoBoneIK bends two bones so that the second ends on the red target at (450,350). Godot probes:
  // orange at (362,174), blue at (442,272) and the skinned strip, green (76,204,102), at (421,236).
  { name: 'skeleton2d-twoboneik', file: 'unit-skeleton2d-twoboneik.tscn', mode: '2d' },
  // The same solve at a stack strength of 0.5: each bone turns half way. Godot probes: orange at
  // (375,162) and blue at (497,227), which the full solve leaves as background.
  { name: 'skeleton2d-stack-strength', file: 'unit-skeleton2d-stack-strength.tscn', mode: '2d' },
  // CCDIK curls three bones until the Tip node meets the red target at (400,380). Godot probes:
  // orange at (298,168), blue at (355,236) and purple (153,102,229) at (386,329).
  { name: 'skeleton2d-ccdik', file: 'unit-skeleton2d-ccdik.tscn', mode: '2d' },
  // CCDIK on four equal bones, whose first pass folds the last bone onto its parent: the chain then
  // bends to the side the last bit of each bone transform picks. Godot probes: orange at (441,137),
  // blue at (452,163), green (76,204,102) at (468,170) and purple at (477,176).
  { name: 'skeleton2d-ccdik-fold', file: 'unit-skeleton2d-ccdik-fold.tscn', mode: '2d' },
  // FABRIK reaches the same target with three bones. Godot probes: orange at (290,173), blue at
  // (365,238) and purple at (397,327).
  { name: 'skeleton2d-fabrik', file: 'unit-skeleton2d-fabrik.tscn', mode: '2d' },
  // A FABRIK chain on the skeleton Near whose joints name the bones of the skeleton Far: Far reaches
  // the red target at (330,500), and Near takes the same pose. Godot probes: orange at (237,134) and
  // (237,344), blue at (300,179) and (300,389). Unsolved, all four read the background.
  { name: 'skeleton2d-fabrik-foreign', file: 'unit-skeleton2d-fabrik-foreign.tscn', mode: '2d' },
  // A RemoteTransform2D below the arm of the LookAt scene pushes the pose the stack solved onto the
  // green square. Godot probes: green (76,204,102) at (300,350), the end of the turned arm, and the
  // background at (500,150), where the arm ends in the file.
  { name: 'skeleton2d-remote-transform', file: 'unit-skeleton2d-remote-transform.tscn', mode: '2d' },
  // The same scene with the stack in a .tres file: the green square stands at the same place once the
  // file has loaded. Godot probes: green (76,204,102) at (300,350), background (76,76,76) at (500,150).
  { name: 'skeleton2d-remote-transform-tres', file: 'unit-skeleton2d-remote-transform-tres.tscn', mode: '2d' },
  // clip_children CLIP_ONLY: the red child shows only over the green parent, in its own colour. Godot
  // probes: (125,125) background, the parent alone; (175,175) red; (425,125) green, the unclipped twin.
  { name: 'clip-children-only', file: 'unit-clip-children-only.tscn', mode: '2d' },
  // CLIP_AND_DRAW draws the parent too, and the half-alpha child blends over it: (125,125) green and
  // (175,175) (127,128,0). Outside the parent the canvas shows through: (220,220) background.
  { name: 'clip-children-and-draw', file: 'unit-clip-children-and-draw.tscn', mode: '2d' },
  // A soft mask: the radial alpha of the Sprite2D scales the child. Godot probes: (175,175) (193,27,27)
  // and (220,220) (203,22,22); the corner (125,125) is background.
  { name: 'clip-children-soft-mask', file: 'unit-clip-children-soft-mask.tscn', mode: '2d' },
  // An owner with no commands has no group: the behind-parent blue draws first and the red shows over it.
  // Godot probe: (175,175) is (185,7,61).
  { name: 'clip-children-no-commands', file: 'unit-clip-children-no-commands.tscn', mode: '2d' },
  // Nested inert owners draw the behind child once: the red square blends once, so (110,110) is (165,38,38), not doubled.
  { name: 'clip-children-nested-inert', file: 'unit-clip-children-nested-inert.tscn', mode: '2d' },
  // A nested inert owner's behind child draws before its regular child: (150,150) is green over red, (110,110) red.
  { name: 'clip-children-nested-behind-order', file: 'unit-clip-children-nested-behind-order.tscn', mode: '2d' },
  // A clip group in an inert owner's behind span draws first, masked: (180,180) is blue over the red mask, (110,110) green.
  { name: 'clip-children-behind-owner', file: 'unit-clip-children-behind-owner.tscn', mode: '2d' },
  // A group between an inert owner and the inert owner it draws behind keeps the nested order: green over red at (150,150).
  { name: 'clip-children-nested-boundary', file: 'unit-clip-children-nested-boundary.tscn', mode: '2d' },
  // Two clip groups after a plain item in a behind span each copy what is drawn so far: (125,125) is orange, (220,130) green.
  { name: 'clip-children-behind-groups', file: 'unit-clip-children-behind-groups.tscn', mode: '2d' },
  // A y-sorted owner groups nothing: the red child shows whole, so (175,175) is red and (125,125) stays red over green.
  { name: 'clip-children-ysort', file: 'unit-clip-children-ysort.tscn', mode: '2d' },
  // The owner's ADD material does not reach the masked draw: (125,125) is (76,139,76), (175,175) (165,38,38).
  { name: 'clip-children-material', file: 'unit-clip-children-material.tscn', mode: '2d' },
  // A Button clips a ColorRect: (160,130) is (183,30,30) and (300,130) background.
  { name: 'clip-children-control', file: 'unit-clip-children-control.tscn', mode: '2d' },
  // Line2D as Godot's LineBuilder builds it. Caps: NONE is background at (45,50), BOX white at (45,100)
  // and (159,100), ROUND white at (41,150) and background at (42,142). A closed line ignores its caps.
  { name: 'line-2d-caps', file: 'unit-line2d-caps.tscn', mode: '2d' },
  // A half-alpha line is 166 on the whole stroke, inner corner included, for each joint mode. Quads
  // that overlap there blend twice and read 211.
  { name: 'line-2d-translucent-corners', file: 'unit-line2d-translucent-corners.tscn', mode: '2d' },
  // A gradient colours each point: (253,0,2) at (51,50), (127,0,128) at (150,50) and 2 and 3 stops alike
  // on two points, (126,129,0) at (100,150) and (0,254,1) at (150,150) on three. default_color is ignored.
  { name: 'line-2d-gradient', file: 'unit-line2d-gradient.tscn', mode: '2d' },
  // A width curve scales the width at each point. The ramp is 10 px lit at x=51 and 40 at x=249, and
  // the bump on two points is 10 px throughout. A box cap takes its own end's factor.
  { name: 'line-2d-width-curve', file: 'unit-line2d-width-curve.tscn', mode: '2d' },
  // A TILE texture is 16 px of red then 16 of blue per tile (32 x 16, tile_aspect 2, width 16), repeated
  // where texture_repeat is Enabled: x=50..65 red and 66..81 blue. A round cap's square starts the strip
  // at u 0.25, so the cap line reads red 16, blue 16 from x=292 to x=435, ending on red.
  { name: 'line-2d-texture-tile', file: 'unit-line2d-texture-tile.tscn', mode: '2d' },
  // At the default texture_repeat TILE clamps: red 16 then blue 112. NONE reads the top-left texel, red for 128 px.
  { name: 'line-2d-texture-clamp', file: 'unit-line2d-texture-clamp.tscn', mode: '2d' },
  // STRETCH is red 63 px, a 2 px blend and blue 63. A (0.5, 1, 1) default_color gives (128,0,0) and (0,0,255).
  { name: 'line-2d-texture-stretch', file: 'unit-line2d-texture-stretch.tscn', mode: '2d' },
  // A closed BEVEL Line2D whose width curve is 0 at its start: Godot 4.6.3 `--mode 2d` draws no
  // closing segment, so (100,250) on the left side is the background, rgb(76).
  { name: 'line2d-closed-width-curve-zero', file: 'unit-line2d-closed-width-curve-zero.tscn', mode: '2d' },
  // A ScriptCreateDialog is an editor class: a game loads a placeholder, and its children still draw.
  { name: 'script-create-dialog-placeholder', file: 'unit-script-create-dialog-placeholder.tscn', mode: '2d' },
  // The polygon's rotation turns its normal. Godot 4.6.3 `--mode 2d`: Upright rgb(226) at (100,324) and
  // rgb(128) at (300,324). Turned rgb(161) at (852,324) and rgb(226) at (952,224).
  { name: 'polygon2d-normal-map-rotation', file: 'unit-polygon2d-normal-map-rotation.tscn', mode: '2d' },
  // flip_h flips the frame's normal. Godot 4.6.3 `--mode 2d`: Plain rgb(226) at (100,324), Flipped
  // rgb(128) at (852,324) and rgb(244) at (976,324).
  { name: 'animatedsprite2d-normal-map-flip', file: 'unit-animatedsprite2d-normal-map-flip.tscn', mode: '2d' },
  // A cell's flips and transpose turn its tile's normal. Godot 4.6.3 `--mode 2d`, at the light's x, 100 left
  // of it, 24 left, 24 right, 100 right, 100 above and 100 below: Plain rgb(226, 244, 168, 128, 160, 161),
  // FlippedH rgb(128, 170, 244, 225, 161, 161) and Transposed rgb(160, 206, 205, 161, 226, 128).
  { name: 'tilemaplayer-normal-map', file: 'unit-tilemaplayer-normal-map.tscn', mode: '2d' },
  // The same tiles over a padded CanvasTexture whose diffuse windows a SubViewport. Godot 4.6.3
  // `--mode 2d`: rgb(0) at (192,324), (576,324) and (960,224), the unrendered target, unlit.
  {
    name: 'tilemaplayer-normal-map-padded-viewport',
    file: 'unit-tilemaplayer-normal-map-padded-viewport.tscn',
    mode: '2d',
  },
  // A Line2D whose CanvasTexture carries a normal map; only the item's rotation turns the normal. Godot
  // 4.6.3 `--mode 2d`: Vertical rgb(226) at (100,324), rgb(160) at (200,224) and rgb(161) at (200,424).
  // Turned rgb(161) at (852,324), rgb(226) at (952,224) and rgb(128) at (952,424).
  { name: 'line2d-normal-map', file: 'unit-line2d-normal-map.tscn', mode: '2d' },
  // `repeat_size` with `repeat_times = 3` on the main stage. Godot 4.6.3 draws the square at x 0, 200,
  // 400 and 600 (y 100), copies on both sides of the node.
  { name: 'parallax-2d-repeat', file: 'unit-parallax-2d-repeat.tscn', mode: '2d' },
  // A sub-viewport Camera2D writes `screen_offset`. Godot 4.6.3 draws Bar at screen x 120, 220 and 320
  // (y 100) and Marker at (110, 230); a camera-less scroll puts Bar at y 200 and hides Marker.
  { name: 'parallax-2d-camera-scroll', file: 'unit-parallax-2d-camera-scroll.tscn', mode: '2d' },
  // VideoStreamPlayer takes its Theora picture size as its minimum size with `expand` off. Each
  // player has a 1 x 1 authored rect and a full-rect ColorRect child. Godot 4.6.3 `--mode 2d`:
  // x 8-71 y 8-55 (autoplay, stopped, paused or not), x 100-227 y 8-103 (expand), 1 x 1 for a
  // Vorbis-only file, and x 100-169 y 230-259 for a 70 x 30 picture in an 80 x 32 frame.
  {
    name: 'video-stream-player-picture-size',
    file: 'unit-video-stream-player-picture-size.tscn',
    mode: '2d',
  },
  // SUB and MUL blends that lower the canvas alpha. Godot 4.6.3 `--mode 2d`: (200,150) rgb(55,79,61)
  // Sub, (200,450) rgb(53,45,30) Mul, both opaque. Mean 0.027/255 against it.
  { name: 'canvas-item-sub-mul-alpha', file: 'unit-canvas-item-sub-mul-alpha.tscn', mode: '2d' },
  // A CanvasGroup composites its squares through one buffer. Godot 4.6.3 `--mode 2d`, red-only, overlap
  // and blue-only: the group at (125,125) rgb(166,38,38), (175,175) rgb(38,38,166), (225,225)
  // rgb(38,38,166); the plain Node2D at (475,175) rgb(83,19,147).
  { name: 'canvas-group-self-modulate', file: 'unit-canvas-group-self-modulate.tscn', mode: '2d' },
  // The group's modulate applies twice. Godot 4.6.3 `--mode 2d`: (125,125) rgb(121,57,57), (175,175)
  // rgb(79,47,111), (225,225) rgb(57,57,121); the plain Node2D at (475,175) rgb(83,19,147).
  { name: 'canvas-group-modulate', file: 'unit-canvas-group-modulate.tscn', mode: '2d' },
  // A child at another z escapes the group. Godot 4.6.3 `--mode 2d`: (125,125) rgb(166,38,38), (175,175)
  // and (225,225) rgb(0,0,255).
  { name: 'canvas-group-z-escape', file: 'unit-canvas-group-z-escape.tscn', mode: '2d' },
  // A CanvasItemMaterial ADD on the group. Godot 4.6.3 `--mode 2d`: rgb(204,204,204) at (95,95) and
  // (240,110), over x 90..259 and y 90..259.
  { name: 'canvas-group-material', file: 'unit-canvas-group-material.tscn', mode: '2d' },
  // A group in a group. Godot 4.6.3 `--mode 2d`: (125,125) rgb(166,102,102), (175,175) rgb(102,102,166),
  // and (240,110) rgb(121,121,121) inside the inner rect.
  { name: 'canvas-group-nested', file: 'unit-canvas-group-nested.tscn', mode: '2d' },
  // A y-sorted group groups nothing. Godot 4.6.3 `--mode 2d`: (125,125) rgb(255,0,0), (175,175)
  // rgb(0,0,255); the group under a y-sorted parent at (425,125) rgb(166,38,38), (475,175) rgb(38,38,166).
  { name: 'canvas-group-y-sort', file: 'unit-canvas-group-y-sort.tscn', mode: '2d' },
  // Each SubViewport update mode, sampled by a 100x100 TextureRect. Godot 4.6.3 `--mode 2d`:
  // (45,70) rgb(0,0,0) DISABLED, (165,70), (285,70), (405,70) and (525,70) rgb(255,0,0) ONCE,
  // WHEN_VISIBLE, WHEN_PARENT_VISIBLE and ALWAYS. (45,190) rgb(0,0,0) a WHEN_PARENT_VISIBLE child
  // under a DISABLED parent, (165,190) and (285,190) rgb(255,0,0) its WHEN_VISIBLE and ALWAYS
  // siblings. (45,310) rgb(0,0,0) a ONCE parent that samples a WHEN_VISIBLE child, (165,310)
  // rgb(255,0,0) one that samples an ALWAYS child. (525,190) rgb(0,0,0) a hidden container's child,
  // (645,190) rgb(255,0,0) a visible container's child.
  { name: 'sub-viewport-update-mode', file: 'unit-sub-viewport-update-mode.tscn', mode: '2d' },
  // Each SubViewport clear mode with a red 0.25 alpha veil over the left half. Godot 4.6.3
  // `--mode 2d`, canvas on an opaque target: (45,70) rgb(121,57,57) ALWAYS, (165,70) rgb(253,0,0)
  // NEVER over (215,70) rgb(0,0,0), (285,70) rgb(253,1,1) ONCE. On a transparent target over white:
  // (45,190) rgb(207,191,191), (165,190) and (285,190) rgb(253,2,2). 3D on an opaque target:
  // (45,310) rgb(150,66,66) ALWAYS, (165,310) rgb(137,0,0) NEVER over (215,310) rgb(0,0,0), (285,310)
  // rgb(150,66,66) ONCE.
  { name: 'sub-viewport-clear-mode', file: 'unit-sub-viewport-clear-mode.tscn', mode: '2d' },
  // `use_hdr_2d` draws the canvas linear into a half-float target, which the container shows as
  // stored. Godot 4.6.3 `--mode 2d`: (150,150) rgb(54,54,54) grey, (250,150) rgb(127,128,0) the linear
  // blend, (350,150) rgb(255,255,63) a value above 1, and (350,350) rgb(255,160,31) the same at modulate 0.5.
  { name: 'sub-viewport-hdr-2d', file: 'unit-sub-viewport-hdr-2d.tscn', mode: '2d' },
  // Each lit pair with `use_hdr_2d` on and off. Godot 4.6.3 through `pnpm ref:diff`: torch (200,150)
  // rgb(135,84,33) on, (600,150) rgb(204,153,102) off; sun (200,450) rgb(73,94,114) on, (600,450)
  // rgb(197,244,255) off; hot (900,150) rgb(146,88,42) on, (900,450) rgb(128,128,112) off. Mean 0.002/255.
  { name: 'sub-viewport-hdr-2d-light', file: 'unit-sub-viewport-hdr-2d-light.tscn', mode: '2d' },
  // SUB and MUL items in an opaque SubViewport over yellow. Godot 4.6.3 `--mode 2d`: the container
  // shows the viewport opaque, with no yellow through it. Mean 0.000/255 against it.
  { name: 'subviewport-opaque-alpha', file: 'unit-subviewport-opaque-alpha.tscn', mode: '2d' },
  // A SubViewport with no content, in a container, a transparent one, a Timer-only one, a stretched one and
  // a ViewportTexture: each shows the clear colour, as Godot 4.6.3 `--mode 2d` does.
  { name: 'subviewport-empty', file: 'unit-subviewport-empty.tscn', mode: '2d' },
  // A stretched SubViewport with clear mode ONCE, empty and with Control and Polygon2D content, at
  // stretch_shrink 1 to 3. Godot 4.6.3 `--mode 2d` clears the shown target once.
  { name: 'subviewport-stretch-clear-once', file: 'unit-subviewport-stretch-clear-once.tscn', mode: '2d' },
  // An OptionButton and a MenuButton with button_pressed set and no toggle_mode.
  { name: 'option-menu-button-pressed', file: 'unit-option-menu-button-pressed.tscn', mode: '2d' },
  // A MenuButton label wrapped by autowrap_mode and trimmed by text_overrun_behavior.
  { name: 'menu-button-wrap-trim', file: 'unit-menu-button-wrap-trim.tscn', mode: '2d' },
  // Embedded windows, as the root viewport draws them over its canvas. Godot 4.6.3 `--mode 2d` diffs
  // differ only in the title glyphs (max 70 to 155 of 255), as a plain Label at the title's place does.
  // A Label with the title's font, size and centre: max 92, mean 0.338, as the window title's max 92.
  { name: 'window-title-label', file: 'unit-window-title-label.tscn', mode: '2d' },
  // A decorated Window: frame, title, close icon and target. Mean 0.367.
  { name: 'window-embedded', file: 'unit-window-embedded.tscn', mode: '2d' },
  // The stack: the last focusable window is focused and draws the focused frame. Mean 0.514.
  { name: 'window-focus-order', file: 'unit-window-focus-order.tscn', mode: '2d' },
  // A title wider than its space ends in an ellipsis. Mean 0.352.
  { name: 'window-title-trim', file: 'unit-window-title-trim.tscn', mode: '2d' },
  // A newline stays inside the title's one line at zero width. Max 92, mean 0.414.
  { name: 'window-title-newline', file: 'unit-window-title-newline.tscn', mode: '2d' },
  // A transparent window shows the embedder through its target. Mean 0.331.
  { name: 'window-transparent', file: 'unit-window-transparent.tscn', mode: '2d' },
  // A Popup is borderless: its target alone. Mean 0.364.
  { name: 'popup-embedded', file: 'unit-popup-embedded.tscn', mode: '2d' },
  // wrap_controls grows a centred 200x100 window to 420x310 at (476,274). Mean 0.284.
  { name: 'window-wrap', file: 'unit-window-wrap.tscn', mode: '2d' },
  // A PopupPanel's panel, with its child inset by the default 4 px margins. Max 1, mean 0.308.
  { name: 'popuppanel-embedded', file: 'unit-popuppanel-embedded.tscn', mode: '2d' },
  // A shadowed panel insets by (6,5,10,11), and its shadow fills the window. Max 1, mean 0.309.
  { name: 'popuppanel-shadow', file: 'unit-popuppanel-shadow.tscn', mode: '2d' },
  // A PopupMenu draws its panel, rows, check and radio marks, separator and disabled item. Max 33 at the check icon rim, mean 0.327.
  { name: 'popup-menu', file: 'unit-popup-menu-embedded.tscn', mode: '2d' },
  // Under a right-to-left parent the marks, icons and text mirror. Max 33 at the check icon rim, mean 0.327.
  { name: 'popup-menu-rtl', file: 'unit-popup-menu-rtl.tscn', mode: '2d' },
  // Thirty items are cut to the frame height and show the bar. Max 3 at the grabber corners, mean 0.305.
  { name: 'popup-menu-scroll', file: 'unit-popup-menu-scroll.tscn', mode: '2d' },
  // The theme outline: a ring under each item label, and the separator's own ring. Max 17 at the check icon rim, mean 0.327.
  { name: 'popup-menu-outline', file: 'unit-popup-menu-outline.tscn', mode: '2d' },
  // A `size` line below the items keeps the unlimited item height instead of the embedder's. Max 1, mean 0.249.
  { name: 'popup-menu-size-after-items', file: 'unit-popup-menu-size-after-items.tscn', mode: '2d' },
  // A menu under a Window embeds in the root, not in the window. Max 6 at the window's close icon and corners, mean 0.410.
  { name: 'popup-menu-in-window', file: 'unit-popup-menu-in-window.tscn', mode: '2d' },
  // A project that embeds no windows lets a Window keep its own embedding: the menu draws inside it. Max 7 at the close icon, mean 0.972.
  { name: 'popup-menu-embed-off', file: 'window-embed-off/unit-popup-menu-embed-off.tscn', mode: '2d' },
  // Theme overrides: the frame, the title colour, size and outline ring. Mean 0.426.
  { name: 'window-theme', file: 'unit-window-theme.tscn', mode: '2d' },
  // Under a right-to-left parent the title trims from its start and the close icon stays right. Max 70, mean 0.407.
  { name: 'window-rtl', file: 'unit-window-rtl.tscn', mode: '2d' },
  // Theme scale 1.5: a 24 px close icon and a 21 px title. Max 155, mean 0.390.
  { name: 'window-theme-scale', file: 'window-theme-scale/unit-window-theme-scale.tscn', mode: '2d' },
  // The same title as a Label at theme scale 1.5: max 155, mean 0.346.
  { name: 'window-theme-scale-label', file: 'window-theme-scale/unit-window-theme-scale-label.tscn', mode: '2d' },
  // Every default-theme icon at theme scale 1, drawn from Godot's own raster. Max 25, mean 0.073.
  { name: 'default-theme-icons', file: 'unit-default-theme-icons.tscn', mode: '2d' },
  // The same Controls at theme scale 1.5: icons and minimum sizes scale. Max 128, mean 0.110.
  { name: 'default-icons-theme-scale', file: 'default-icons-theme-scale/unit-default-icons-theme-scale.tscn', mode: '2d' },
  // A window under a SubViewport that never updates draws in the root, which does. Max 92, mean 0.383.
  { name: 'window-under-disabled-viewport', file: 'unit-window-under-disabled-viewport.tscn', mode: '2d' },
  // A window that authors gui_embed_subwindows leaves the window below it to the embedding root.
  // Max 7 at the close icons, mean 0.475.
  { name: 'window-in-window', file: 'unit-window-in-window.tscn', mode: '2d' },
  // force_native on a visible window is refused, so the window stays embedded. Max 7, mean 0.475.
  { name: 'window-force-native-visible', file: 'edge-window-force-native-visible.tscn', mode: '2d' },
  // content_scale_*: factor, canvas items, viewport, expand, integer and keep-height, with black bars.
  // Max 92, mean 0.385.
  { name: 'window-content-scale', file: 'unit-window-content-scale.tscn', mode: '2d' },
  // A content_scale_mode outside the enum leaves the target empty: black content. Max 92, mean 0.318.
  { name: 'window-content-scale-unknown', file: 'unit-window-content-scale-unknown.tscn', mode: '2d' },
  // A visible AcceptDialog: panel, message and a focused OK button, sized to its content. Max 7, mean 0.32.
  { name: 'accept-dialog-embedded', file: 'unit-accept-dialog-embedded.tscn', mode: '2d' },
  // A visible ConfirmationDialog adds Cancel before OK, with custom button texts. Max 7, mean 0.32.
  { name: 'confirmation-dialog-embedded', file: 'unit-confirmation-dialog-embedded.tscn', mode: '2d' },
  // A Theme on the dialog restyles its Button and Label: a red normal box, yellow focus text, green message. Max 7, mean 0.33.
  { name: 'accept-dialog-theme', file: 'unit-accept-dialog-theme.tscn', mode: '2d' },
  // A Theme icon on Button draws on the buttons an AcceptDialog and a ConfirmationDialog build, and widens them. Max 7, mean 0.31.
  { name: 'accept-dialog-theme-icon', file: 'unit-accept-dialog-theme-icon.tscn', mode: '2d' },
  // A visible FileDialog in Open File mode with an empty file list: toolbar, side lists, filter and a disabled OK. Max 26, mean 0.22 (SVG icon edges).
  { name: 'file-dialog-open-empty', file: 'file-dialog-open-empty/unit-file-dialog-open-empty.tscn', mode: '2d' },
  // The Button theme icon draws on the Cancel and OK buttons, and the OptionButton one on the filter; the toolbar keeps its icons. Max 26, mean 0.19 (SVG icon edges).
  { name: 'file-dialog-theme-icon', file: 'file-dialog-theme-icon/unit-file-dialog-theme-icon.tscn', mode: '2d' },
  // Save File mode adds the create-folder button, the title "Save a File" and an enabled Save. Max 26, mean 0.22 (SVG icon edges).
  { name: 'file-dialog-save-empty', file: 'file-dialog-save-empty/unit-file-dialog-save-empty.tscn', mode: '2d' },
  // A CheckBox option and a value option draw the options row and the option grid. Max 26, mean 0.22 (SVG icon edges).
  { name: 'file-dialog-options', file: 'file-dialog-options/unit-file-dialog-options.tscn', mode: '2d' },
  // current_path puts the dialog in a sub folder and a file name in the File field, its name before the dot selected. Max 26, mean 0.22 (SVG icon edges).
  { name: 'file-dialog-current-path', file: 'file-dialog-current-path/unit-file-dialog-current-path.tscn', mode: '2d' },
  // The dialog lists res:// in thumbnail mode: three folders, then the PNG files in natural order, the first folder selected. Max 34, mean 0.23 (SVG icon edges).
  { name: 'file-dialog-listing', file: 'file-dialog-listing/unit-file-dialog-listing.tscn', mode: '2d' },
  // display_mode = 1 lists res:// in one column of 16 px icons. Max 26, mean 0.22 (SVG icon edges).
  {
    name: 'file-dialog-listing-list-mode',
    file: 'file-dialog-listing/unit-file-dialog-listing-list-mode.tscn',
    mode: '2d',
  },
  // current_file names a file, which the list selects instead of the first row. Max 34, mean 0.23 (SVG icon edges).
  {
    name: 'file-dialog-listing-current-file',
    file: 'file-dialog-listing/unit-file-dialog-listing-current-file.tscn',
    mode: '2d',
  },
  // A root_subfolder that does not exist is kept as a string and ignored: the dialog lists res://. Max 34, mean 0.23 (SVG icon edges).
  {
    name: 'file-dialog-listing-missing-subfolder',
    file: 'file-dialog-listing/unit-file-dialog-listing-missing-subfolder.tscn',
    mode: '2d',
  },
  // MeshInstance2D draws a mesh through the canvas. Godot 4.6.3 `--mode 2d` probes: the textured QuadMesh
  // shows its texture upside down, (75,75) blue and (75,125) red, and the PlaneMesh at (100,300) draws
  // nothing. The ArrayMesh quad with colours reads (241,0,14) at (355,55) and (126,0,129) at its centre.
  { name: 'mesh-instance-2d', file: 'unit-mesh-instance-2d-meshes.tscn', mode: '2d' },
  // The normal map is read at the mesh's UV and never flipped: the mesh at (400,200) reads (245) at the
  // top and (160) at the bottom, where the Sprite2D with the same texture reads the reverse.
  { name: 'mesh-instance-2d-normal-map', file: 'unit-mesh-instance-2d-normal-map.tscn', mode: '2d' },
  // Points, lines and a line strip are one pixel wide. A point at (60,60) lands on pixel (59,59), and
  // the line of 100 px at (250,59)..(349,59) is white. A point or a line reads its texture at the UV.
  { name: 'mesh-instance-2d-primitives', file: 'unit-mesh-instance-2d-primitives.tscn', mode: '2d' },
  // MultiMeshInstance2D draws a mesh once for each instance, under its transform and colour. Godot 4.6.3
  // `--mode 2d` probes: the identity instance reads (51,102,204) at (40,40) and the quarter turn reads
  // (204,0,0) at (140,40) and (230,0,0) at (160,60). The half-alpha scaled instance reads (64,89,140) at
  // (280,60). `visible_instance_count = 2` hides the last two, and a 3D transform format draws nothing.
  { name: 'multi-mesh-instance-2d', file: 'unit-multi-mesh-instance-2d-instances.tscn', mode: '2d' },
  // A particles_animation material cuts each instance to one cell of a 2x1 sheet at the cell's width: z 0
  // reads (51,102,204) at (90,90), and z 0.5 reads (230,204,51) at (240,90). A MeshInstance2D under the
  // same material shows cell 0 at that width, (51,102,204) at (440,90).
  { name: 'multi-mesh-instance-2d-flipbook', file: 'unit-multi-mesh-instance-2d-flipbook.tscn', mode: '2d' },
  // Two Add items under one textured PointLight2D, over an opaque backdrop. Godot probes: (450,230)
  // rgb(255,102,69) the first item alone, (520,300) rgb(255,255,115) both, (590,370) rgb(98,151,96) the second.
  { name: 'canvas-item-additive-lit', file: 'unit-canvas-item-additive-lit.tscn', mode: '2d' },
  // Visible Collision Shapes in 2D draws every Shape2D class as Godot's `draw()` does: a polygon shape
  // filled in its debug colour with an opaque outline, a segment, concave soup, world boundary and
  // separation ray as strokes. A disabled shape is grey at half the alpha, a one-way shape adds an arrow.
  { name: 'collision-shapes-2d', file: 'unit-collision-shapes-2d.tscn', collisions: true },
];
