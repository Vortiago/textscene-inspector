/**
 * The generated GDScript: one bootstrap scene that instantiates the target,
 * picks the 2D or 3D path for it, and writes one settled frame.
 *
 * It is emitted as a single program, in hard tabs, because that is what Godot
 * compiles — assembling it from separately-indented fragments would put the
 * whitespace that decides its meaning in several files at once. `run.test.mjs`
 * asserts against this output, which is the other reason it stays whole.
 */

import { CANVAS_2D_CAPTURE } from '../visual/previewServer.mjs';
import { EDITOR_CAMERA_DIRECTION, EDITOR_CAMERA_DISTANCE, FRAME_MARGIN } from './refConstants.mjs';

/** Godot's preview sun: white, energy 1.0, shadows on, euler (-60°, 150°, 0). */
const PREVIEW_SUN_ALTITUDE_DEG = -60;
const PREVIEW_SUN_AZIMUTH_DEG = 150;

/** `_load_default_preview_settings`'s sky and ground colours. */
const PREVIEW_SKY_TOP = [0.385, 0.454, 0.55];
const PREVIEW_GROUND_BOTTOM = [0.2, 0.169, 0.133];

const gdVec3 = (v) => `Vector3(${v[0]}, ${v[1]}, ${v[2]})`;
const gdColor = (c) => `Color(${c[0]}, ${c[1]}, ${c[2]})`;
/**
 * A GDScript string literal (quotes included) with the special characters
 * escaped, so a path containing a quote, backslash or newline produces valid
 * GDScript instead of a syntax error that never compiles the bootstrap.
 */
const gdString = (s) =>
  `"${String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')}"`;

/**
 * The bootstrap scene's script. Instantiates the target scene, picks the 2D or
 * 3D path for it, and writes one settled frame.
 */
export function bootstrapScript({
  scenePath,
  previews,
  camera,
  lookAt,
  frame,
  sceneCamera,
  sceneCameraPath,
  mode,
  out,
  boundsOut,
  modeOut,
  fov,
  fovExplicit,
  canvas2DSize,
}) {
  return `extends Node3D

const SCENE_PATH := ${gdString(scenePath)}
const PREVIEWS := ${previews ? 'true' : 'false'}
const OUT := ${gdString(out)}
const BOUNDS_OUT := ${gdString(boundsOut ?? '')}
const MODE_OUT := ${gdString(modeOut)}
const MODE := "${mode}"
const SCENE_CAMERA := ${sceneCamera ? 'true' : 'false'}
const SCENE_CAMERA_PATH := ${gdString(sceneCameraPath ?? '')}
const FOV := ${fov}
const CANVAS_2D_SIZE := Vector2i(${canvas2DSize.width}, ${canvas2DSize.height})
const CLEAR_2D := ${gdColor(CANVAS_2D_CAPTURE.clearColor)}

func _ready() -> void:
	# Before anything is instantiated: pausing deactivates the physics servers,
	# so no body is ever stepped and no state callback ever fires. Set here, not
	# after add_child(), because entering the tree is itself enough to schedule
	# the first step. See _freeze_game_logic() for why this is the catch-all.
	#
	# Gated on PREVIEWS, which is what selects between the harness's two jobs:
	# the default mirrors the Node3D EDITOR, which never runs game logic, so the
	# authored pose is the whole point. --no-previews asks for true RUNTIME
	# semantics, and a runtime that never steps physics is not a runtime — a
	# body is supposed to fall there.
	if PREVIEWS:
		get_tree().paused = true
	var target: Node = load(SCENE_PATH).instantiate()
	var two_d := MODE == "2d" or (MODE == "auto" and _is_canvas_scene(target))
	# Written before the render, so a run that dies mid-frame still says which
	# path it took — the caller pairs our image with the previewer's on it.
	_write_mode(two_d)
	if two_d:
		await _render_2d(target)
	else:
		await _render_3d(target)
	get_tree().quit()

# Godot's CanvasItemEditor claims a CanvasItem root, which is the rule
# workspaceForScene.ts mirrors — plus CanvasLayer, which is a plain Node that
# exists only to host CanvasItems, and which the previewer counts as 2D too.
func _is_canvas_scene(target: Node) -> bool:
	return target is CanvasItem or target is CanvasLayer

func _render_3d(target: Node) -> void:
	add_child(target)
	if PREVIEWS:
		_freeze_game_logic(target)
		_apply_preview_lighting(target)
	_place_camera(target)
	await _settle()
	get_viewport().get_texture().get_image().save_png(OUT)
	_write_bounds(target)

# A 2D scene has nothing to point a camera at: Godot draws it through the
# canvas transform into the PROJECT VIEWPORT rectangle, and a Control resolves
# its anchors against that rectangle — so the frame size is part of the picture,
# not a capture setting. Rendering into a SubViewport of exactly that size gives
# the game frame 1:1 whatever the window is, which is the rectangle the
# previewer's 2D stage draws. No preview sun or environment: those are
# Node3DEditor's, and 2D lighting is a scene's own business.
func _render_2d(target: Node) -> void:
	RenderingServer.set_default_clear_color(CLEAR_2D)
	var vp := SubViewport.new()
	vp.size = CANVAS_2D_SIZE
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	if not SCENE_CAMERA:
		_disable_2d_cameras(target)
	vp.add_child(target)
	if PREVIEWS:
		_freeze_game_logic(target)
	await _settle()
	vp.get_texture().get_image().save_png(OUT)

# An enabled Camera2D becomes current the moment it enters the tree and offsets
# the whole canvas transform. The previewer ignores a scene's camera (Godot's
# editor keeps its own view and draws the node as a gizmo), so the reference has
# to as well — disabled BEFORE the subtree is added, since a camera that has
# already claimed the viewport leaves its offset behind.
func _disable_2d_cameras(node: Node) -> void:
	var camera := node as Camera2D
	if camera != null:
		camera.enabled = false
	for child in node.get_children():
		_disable_2d_cameras(child)

# The reference must show the AUTHORED pose, not a running game. _settle() steps
# six process frames, which would let physics FALL a body and autoplay /
# AnimationTree clips ADVANCE past their rest pose. The Node3DEditor preview our
# previewer mirrors never runs game logic, so we stop it before settling.
#
# The catch-all is SceneTree.paused, set before the scene is ever instantiated:
# SceneTree::set_pause() calls PhysicsServer3D/2D::set_active(false), so the
# servers never step and never fire a state callback. That covers every physics
# node at once — including ones that move something OTHER than themselves, which
# a per-type freeze cannot. VehicleBody3D is the case that proved it: freezing
# the body left it in place, but VehicleBody3D::_body_state_changed() still ran
# and repositioned its VehicleWheel3D children to
# hardPoint + wheelDirection * suspensionLength, dropping every wheel by the
# suspension rest length. Pausing removes the callback that did it.
#
# The per-type calls below remain for the non-physics drivers pause does not
# reach — an AnimationPlayer's queued autoplay, an AnimationTree's graph — and
# for SoftBody3D, whose integration the pause covers but whose disabled
# process_mode also pins it if a future Godot changes that. GPUParticles are
# left alone: their preprocessed burst is the authored look, not running logic.
#
# Both halves — this walk and the pause — are gated on PREVIEWS together, so
# "editor" and "runtime" stay two whole answers rather than a mixture. Stopping
# an AnimationPlayer in a render that is meant to show the running game is the
# same mistake as pausing its physics.
func _freeze_game_logic(node: Node) -> void:
	if node is AnimationPlayer:
		(node as AnimationPlayer).stop()
	if node is AnimationTree:
		(node as AnimationTree).active = false
	if node is SoftBody3D:
		(node as SoftBody3D).process_mode = Node.PROCESS_MODE_DISABLED
	for child in node.get_children():
		_freeze_game_logic(child)

func _settle() -> void:
	for _i in 6:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw

func _write_mode(two_d: bool) -> void:
	if MODE_OUT == "":
		return
	var file := FileAccess.open(MODE_OUT, FileAccess.WRITE)
	if file == null:
		return
	file.store_string("2d" if two_d else "3d")
	file.close()

# The scene's world-space AABB, so a comparison can derive ONE camera both
# renderers use rather than each framing the scene its own way.
func _write_bounds(target: Node) -> void:
	if BOUNDS_OUT == "":
		return
	var b := _scene_bounds(target)
	var file := FileAccess.open(BOUNDS_OUT, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify({
		"position": [b.position.x, b.position.y, b.position.z],
		"size": [b.size.x, b.size.y, b.size.z],
	}))
	file.close()

# Node3DEditor::_node_added — two INDEPENDENT presence checks, by node type,
# with no regard for visibility.
func _contains(node: Node, want_light: bool) -> bool:
	if want_light:
		if node is DirectionalLight3D:
			return true
	elif node is WorldEnvironment:
		return true
	for child in node.get_children():
		if _contains(child, want_light):
			return true
	return false

func _apply_preview_lighting(target: Node) -> void:
	if not _contains(target, true):
		var sun := DirectionalLight3D.new()
		sun.light_color = Color(1, 1, 1)
		sun.light_energy = 1.0
		sun.shadow_enabled = true
		sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
		sun.directional_shadow_max_distance = 100.0
		sun.transform = Transform3D(
			Basis.from_euler(Vector3(deg_to_rad(${PREVIEW_SUN_ALTITUDE_DEG}), deg_to_rad(${PREVIEW_SUN_AZIMUTH_DEG}), 0.0)),
			Vector3.ZERO
		)
		add_child(sun)

	if not _contains(target, false):
		var sky_material := ProceduralSkyMaterial.new()
		var sky_top := ${gdColor(PREVIEW_SKY_TOP)}
		var ground_bottom := ${gdColor(PREVIEW_GROUND_BOTTOM)}
		# Node3DEditor::_preview_settings_changed derives the horizon from the
		# two authored colours, then pushes it halfway to its own luminance.
		var hz: Color = sky_top.lerp(ground_bottom, 0.5)
		var hz_lum: float = hz.get_luminance() * 3.333
		hz = hz.lerp(Color(hz_lum, hz_lum, hz_lum), 0.5)
		sky_material.sky_top_color = sky_top
		sky_material.sky_horizon_color = hz
		sky_material.ground_bottom_color = ground_bottom
		sky_material.ground_horizon_color = hz
		sky_material.energy_multiplier = 1.0

		var sky := Sky.new()
		sky.sky_material = sky_material

		var env := Environment.new()
		env.background_mode = Environment.BG_SKY
		env.sky = sky
		env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
		env.glow_enabled = true

		var world_env := WorldEnvironment.new()
		world_env.environment = env
		add_child(world_env)

func _place_camera(target: Node) -> void:
${
  camera
    ? `	var cam := Camera3D.new()
	add_child(cam)
	cam.fov = FOV
	cam.global_position = ${gdVec3(camera)}
	cam.look_at(${gdVec3(lookAt ?? [0, 0, 0])}, Vector3.UP)
	cam.make_current()`
    : `${
        sceneCamera
          ? `	var existing := _find_camera(target)
	if existing != null:
		# Claim the viewport explicitly. A scene can hold several Camera3Ds — the
		# town carries a PreviewCamera plus one inside every instanced vehicle —
		# and which of them ends up current otherwise depends on tree order and
		# on whatever the running game did, which is exactly the ambient state
		# this harness pauses away. Without this the capture silently framed a
		# different camera once physics stopped.
		existing.make_current()
${
  fovExplicit
    ? `		existing.fov = FOV
`
    : `		# Leave the authored fov alone — a Camera3D defaults to 75, and forcing
		# the editor's 70 would render neither what Godot shows through this
		# camera nor what the previewer shows when the user picks it.
`
}		return
`
          : ''
      }	var cam := Camera3D.new()
	add_child(cam)
	cam.fov = FOV
${
  frame
    ? `	var bounds := _scene_bounds(target)
	var span: float = maxf(maxf(bounds.size.x, bounds.size.y), bounds.size.z)
	var distance := (span / 2.0 / tan(deg_to_rad(FOV) / 2.0)) * ${FRAME_MARGIN}
	var focus := bounds.get_center()`
    : `	var distance := float(${EDITOR_CAMERA_DISTANCE})
	var focus := Vector3.ZERO`
}
	cam.global_position = focus + ${gdVec3(EDITOR_CAMERA_DIRECTION)} * distance
	cam.look_at(focus, Vector3.UP)
	cam.make_current()`
}

func _find_camera(node: Node) -> Camera3D:
	if SCENE_CAMERA_PATH != "":
		# The previewer addresses nodes from the scene ROOT inclusive
		# ("TownScene/PreviewCamera"); from the root node itself that first
		# segment is the node we are already standing on, so try both spellings
		# rather than making the caller know which side it is talking to.
		var named := node.get_node_or_null(NodePath(SCENE_CAMERA_PATH)) as Camera3D
		if named == null:
			var slash := SCENE_CAMERA_PATH.find("/")
			if slash != -1:
				named = node.get_node_or_null(NodePath(SCENE_CAMERA_PATH.substr(slash + 1))) as Camera3D
		if named != null:
			return named
	if node is Camera3D:
		return node
	for child in node.get_children():
		var found := _find_camera(child)
		if found != null:
			return found
	return null

# Bounds over GEOMETRY, with everything else only as a fallback — the same rule
# frameSceneBounds.ts applies (meshes first, gizmos only when there are no
# meshes). It has to be the same rule, because the whole point of these bounds
# is to derive ONE camera both renderers use: Light3D and friends are
# VisualInstance3D too, so unioning every visual pulls the centre towards a
# light the previewer never framed on. A sun 5 units up moved the derived
# look-at by 3 units.
func _scene_bounds(node: Node) -> AABB:
	var geometry: Variant = _union(_visuals(node, true))
	if geometry != null:
		return geometry
	var any: Variant = _union(_visuals(node, false))
	if any != null:
		return any
	return AABB(Vector3(-1, -1, -1), Vector3(2, 2, 2))

func _union(visuals: Array) -> Variant:
	var bounds := AABB()
	var seeded := false
	for visual: VisualInstance3D in visuals:
		var world: AABB = visual.global_transform * visual.get_aabb()
		if seeded:
			bounds = bounds.merge(world)
		else:
			bounds = world
			seeded = true
	return bounds if seeded else null

func _visuals(node: Node, geometry_only: bool) -> Array:
	var found: Array = []
	if node is GeometryInstance3D or (not geometry_only and node is VisualInstance3D):
		found.append(node)
	for child in node.get_children():
		found.append_array(_visuals(child, geometry_only))
	return found
`;
}

export const MAIN_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://__ref_bootstrap.gd" id="1"]

[node name="ReferenceRoot" type="Node3D"]
script = ExtResource("1")
`;
