# Prints the scene Godot's importer builds for each glb in res://, as JSON on one line.
# Run from the project that measure.mjs writes: godot --headless --path . -s dump.gd
extends SceneTree


func _describe(root: Node, node: Node) -> Dictionary:
	var entry := {"path": str(root.get_path_to(node)), "type": node.get_class()}
	if node is Skeleton3D:
		var bones := []
		for bone in node.get_bone_count():
			bones.append(node.get_bone_name(bone))
		entry["bones"] = bones
	if node is BoneAttachment3D:
		entry["bone"] = node.bone_name
	return entry


func _walk(root: Node, node: Node, out: Array) -> void:
	for child in node.get_children():
		out.append(_describe(root, child))
		_walk(root, child, out)


func _init() -> void:
	var result := {}
	var directory := DirAccess.open("res://")
	for file in directory.get_files():
		if not file.ends_with(".glb"):
			continue
		var root: Node = load("res://" + file).instantiate()
		var nodes := []
		_walk(root, root, nodes)
		result[file] = nodes
		root.free()
	print(JSON.stringify(result))
	quit()
