/**
 * The GDScript that drives the reference side of an animated capture: seek the clip to each
 * sampled time and save a PNG per frame. Two programs, since the modes share only the sampling:
 * a 3D scene uses the editor camera and preview environment, a 2D one the project viewport alone.
 */

import { PREVIEW_LIGHTING_GD, gdString } from '../../godot-ref/bootstrap.mjs';
import { EDITOR_CAMERA_DIRECTION, EDITOR_CAMERA_DISTANCE, EDITOR_FOV } from '../../godot-ref/run.mjs';
import { CANVAS_2D_CAPTURE } from '../../visual/previewServer.mjs';
import { FRAMES } from './clip.mjs';

export function godotBootstrap(resPath, framesDir) {
  const dir = EDITOR_CAMERA_DIRECTION.map((c) => c * EDITOR_CAMERA_DISTANCE);
  return `extends Node3D

func _ready() -> void:
	var target: Node = load(${gdString(resPath)}).instantiate()
	add_child(target)
	# The editor preview sun and environment (ADR-0025), the same block the still
	# capture emits, so the two references light a scene identically.
	_apply_preview_lighting(target)
	var cam := Camera3D.new()
	add_child(cam)
	cam.fov = ${EDITOR_FOV}
	cam.global_position = Vector3(${dir[0]}, ${dir[1]}, ${dir[2]})
	cam.look_at(Vector3.ZERO, Vector3.UP)
	cam.make_current()
	var ap: AnimationPlayer = target.find_child("AnimationPlayer", true, false)
	if ap == null:
		push_error("no AnimationPlayer in scene")
		get_tree().quit(1)
		return
	var clip: String = ap.autoplay if ap.autoplay != "" else ap.get_animation_list()[0]
	ap.play(clip)
	var length: float = ap.get_animation(clip).length
	for i in ${FRAMES}:
		ap.seek(length * float(i) / ${FRAMES}, true)
		await get_tree().process_frame
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(${gdString(`${framesDir}/frame_%02d.png`)} % i)
	get_tree().quit()

${PREVIEW_LIGHTING_GD}
`;
}

// The 2D reference: an AnimatedSprite2D in a SubViewport the size of the project viewport (2D
// positions are absolute), stepping `frame` across one loop. Like godot-ref/bootstrap.mjs's
// _render_2d it has no 3D camera and no editor preview (2D lighting is the scene's own). Each
// Camera2D is disabled before the subtree is added, so none can offset the canvas.
export function godotBootstrap2D(resPath, framesDir) {
  const [r, g, b] = CANVAS_2D_CAPTURE.clearColor;
  return `extends Node

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color(${r}, ${g}, ${b}, 1))
	var vp := SubViewport.new()
	vp.size = Vector2i(${CANVAS_2D_CAPTURE.width}, ${CANVAS_2D_CAPTURE.height})
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var target: Node = load(${gdString(resPath)}).instantiate()
	_disable_2d_cameras(target)
	vp.add_child(target)
	var sprite := _find_sprite(target)
	if sprite == null:
		push_error("no AnimatedSprite2D in scene")
		get_tree().quit(1)
		return
	var frames := sprite.sprite_frames
	var clip: StringName = sprite.animation if sprite.animation != &"" else frames.get_animation_names()[0]
	var fc: int = frames.get_frame_count(clip)
	if fc <= 0:
		push_error("SpriteFrames clip has no frames")
		get_tree().quit(1)
		return
	sprite.animation = clip
	for i in ${FRAMES}:
		sprite.frame = int(floor(float(i) / ${FRAMES} * fc)) % fc
		await get_tree().process_frame
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		vp.get_texture().get_image().save_png(${gdString(`${framesDir}/frame_%02d.png`)} % i)
	get_tree().quit()

func _disable_2d_cameras(node: Node) -> void:
	var cam := node as Camera2D
	if cam != null:
		cam.enabled = false
	for child in node.get_children():
		_disable_2d_cameras(child)

func _find_sprite(node: Node) -> AnimatedSprite2D:
	var s := node as AnimatedSprite2D
	if s != null:
		return s
	for child in node.get_children():
		var found := _find_sprite(child)
		if found != null:
			return found
	return null
`;
}
