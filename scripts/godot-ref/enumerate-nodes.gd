# Dumps every instantiable Node class Godot's ClassDB knows about, with its
# dimension (3D / 2D / Other) and full ancestor chain, as one JSON blob after a
# marker line. Driven by list-unsupported-nodes.mjs, which diffs this against the
# previewer's registered node types. Re-run against a newer Godot to refresh.
extends SceneTree

func _init() -> void:
	var classes: Array = []
	for c in ClassDB.get_class_list():
		if not ClassDB.is_parent_class(c, "Node"):
			continue
		if not ClassDB.can_instantiate(c):
			continue
		var chain: Array = []
		var p: String = ClassDB.get_parent_class(c)
		while p != "":
			chain.append(p)
			p = ClassDB.get_parent_class(p)
		var dim: String = "Other"
		if ClassDB.is_parent_class(c, "Node3D"):
			dim = "3D"
		elif ClassDB.is_parent_class(c, "CanvasItem"):
			dim = "2D"
		classes.append({"name": c, "dim": dim, "chain": chain})
	print("###NODES_JSON###")
	print(JSON.stringify(classes))
	quit()
