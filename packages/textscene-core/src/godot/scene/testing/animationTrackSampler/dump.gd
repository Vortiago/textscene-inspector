extends SceneTree

# Prints the JSON `animationTrackSampler.godot.json` holds, after a line of its own that reads
# SAMPLES. Each case is a track, as Animation.position_track_interpolate and its siblings sample it.
func v3(v): return [v.x, v.y, v.z]
func q4(q): return [q.x, q.y, q.z, q.w]

func build(kind: int, keys: Array, length: float, loop_mode: int, interp: int, loop_wrap: bool) -> Array:
	var a := Animation.new()
	a.length = length
	a.loop_mode = loop_mode
	var t := a.add_track(kind)
	a.track_set_path(t, NodePath("Skel:b1"))
	for k in keys:
		match kind:
			Animation.TYPE_POSITION_3D: a.position_track_insert_key(t, k[0], k[2])
			Animation.TYPE_SCALE_3D: a.scale_track_insert_key(t, k[0], k[2])
			Animation.TYPE_ROTATION_3D: a.rotation_track_insert_key(t, k[0], k[2])
	# insert_key sets transition 1; set transitions through the keys array afterwards
	a.track_set_interpolation_type(t, interp)
	a.track_set_interpolation_loop_wrap(t, loop_wrap)
	for i in keys.size():
		a.track_set_key_transition(t, i, keys[i][1])
	return [a, t]

func sample(a: Animation, t: int, kind: int, time: float):
	match kind:
		Animation.TYPE_POSITION_3D: return v3(a.position_track_interpolate(t, time))
		Animation.TYPE_SCALE_3D: return v3(a.scale_track_interpolate(t, time))
		Animation.TYPE_ROTATION_3D: return q4(a.rotation_track_interpolate(t, time))

func _init():
	var out := {}
	var vkeys := [
		[0.0, 1.0, Vector3(0, 0, 0)],
		[1.0, 1.0, Vector3(1, 2, 3)],
		[2.5, 1.0, Vector3(0, 4, -1)],
	]
	var shifted := [
		[0.5, 1.0, Vector3(0, 0, 0)],
		[1.0, 1.0, Vector3(1, 2, 3)],
		[2.0, 1.0, Vector3(0, 4, -1)],
		[2.5, 1.0, Vector3(2, 1, 0)],
	]
	var eased := [
		[0.0, 2.0, Vector3(0, 0, 0)],
		[1.0, 0.5, Vector3(1, 2, 3)],
		[2.0, -2.0, Vector3(0, 4, -1)],
		[3.0, 0.0, Vector3(5, 5, 5)],
		[4.0, 1.0, Vector3(1, 1, 1)],
	]
	var late := [
		[0.0, 1.0, Vector3(0, 0, 0)],
		[1.0, 1.0, Vector3(1, 2, 3)],
		[4.0, 1.0, Vector3(9, 9, 9)],
	]
	var qkeys := [
		[0.0, 1.0, Quaternion(0, 0, 0, 1)],
		[1.0, 1.0, Quaternion(Vector3(0, 0, 1), 1.0)],
		[2.5, 1.0, Quaternion(Vector3(1, 0, 0), 2.6)],
	]
	var qshifted := [
		[0.5, 1.0, Quaternion(Vector3(0, 1, 0), 0.4)],
		[1.0, 1.0, Quaternion(Vector3(0, 0, 1), 1.0)],
		[2.0, 1.0, Quaternion(Vector3(1, 0, 0), 2.6)],
		[2.5, 1.0, Quaternion(Vector3(0, 1, 0), 3.0)],
	]
	var three := [
		[0.2, 1.0, Quaternion(Vector3(0, 0, 1), 0.6)],
		[0.5, 1.0, Quaternion(Vector3(0, 0, 1), -1.0)],
		[0.9, 1.0, Quaternion(Vector3(0, 1, 0), 1.6)],
	]
	var times := [0.0, 0.25, 0.5, 0.75, 1.0, 1.4, 2.0, 2.2, 2.5, 2.8, 2.99, 3.0]
	var setups := {
		"vec_linear": [Animation.TYPE_POSITION_3D, vkeys, 3.0, 0, 1, true],
		"vec_nearest": [Animation.TYPE_POSITION_3D, vkeys, 3.0, 0, 0, true],
		"vec_cubic": [Animation.TYPE_POSITION_3D, vkeys, 3.0, 0, 2, true],
		"vec_cubic_angle": [Animation.TYPE_SCALE_3D, vkeys, 3.0, 0, 4, true],
		"vec_linear_angle": [Animation.TYPE_SCALE_3D, vkeys, 3.0, 0, 3, true],
		"vec_eased": [Animation.TYPE_POSITION_3D, eased, 5.0, 0, 1, true],
		"vec_eased_cubic": [Animation.TYPE_POSITION_3D, eased, 5.0, 0, 2, true],
		"vec_late_key": [Animation.TYPE_POSITION_3D, late, 3.0, 0, 1, true],
		"vec_loop_linear": [Animation.TYPE_POSITION_3D, shifted, 3.0, 1, 1, true],
		"vec_loop_linear_cubic": [Animation.TYPE_POSITION_3D, shifted, 3.0, 1, 2, true],
		"vec_loop_linear_no_wrap": [Animation.TYPE_POSITION_3D, shifted, 3.0, 1, 1, false],
		"vec_loop_pingpong": [Animation.TYPE_POSITION_3D, shifted, 3.0, 2, 1, true],
		"vec_loop_pingpong_cubic": [Animation.TYPE_POSITION_3D, shifted, 3.0, 2, 2, true],
		"rot_linear": [Animation.TYPE_ROTATION_3D, qkeys, 3.0, 0, 1, true],
		"rot_nearest": [Animation.TYPE_ROTATION_3D, qkeys, 3.0, 0, 0, true],
		"rot_cubic": [Animation.TYPE_ROTATION_3D, qkeys, 3.0, 0, 2, true],
		"rot_loop_linear_cubic": [Animation.TYPE_ROTATION_3D, qshifted, 3.0, 1, 2, true],
		"rot_loop_pingpong": [Animation.TYPE_ROTATION_3D, qshifted, 3.0, 2, 1, true],
		"rot_loop_pingpong_cubic": [Animation.TYPE_ROTATION_3D, qshifted, 3.0, 2, 2, true],
		"rot_three_pingpong_cubic": [Animation.TYPE_ROTATION_3D, three, 3.0, 2, 2, true],
		"rot_three_linear_cubic": [Animation.TYPE_ROTATION_3D, three, 3.0, 1, 2, true],
	}
	for name in setups:
		var s: Array = setups[name]
		var kind: int = s[0]
		var built := build(kind, s[1], s[2], s[3], s[4], s[5])
		var a: Animation = built[0]
		var t: int = built[1]
		var keys_out := []
		for k in s[1]:
			keys_out.append([k[0], k[1]] + (q4(k[2]) if kind == Animation.TYPE_ROTATION_3D else v3(k[2])))
		var samples := []
		for time in times:
			samples.append([time] + sample(a, t, kind, time))
		out[name] = {"keys": keys_out, "length": s[2], "loopMode": s[3], "interp": s[4], "loopWrap": s[5], "samples": samples}
	print("SAMPLES")
	print(JSON.stringify(out))
	quit()
