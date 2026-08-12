# Dumps what only a running engine can answer, as three JSON blobs each after a
# marker line. Driven by build-node-catalog/classdb.mjs. Re-run against a newer
# Godot to refresh all three.
#
# ###NODES_JSON### every INSTANTIABLE Node class, with its dimension (3D / 2D /
#   Other) and full ancestor chain.
#
# ###PROPS_JSON### every Node class's OWN serialised properties, abstract ones
#   included. Abstract matters: Light3D and Control are where the properties are
#   declared and where the validators belong, and neither can be instantiated,
#   so a list filtered like the one above would miss exactly the classes that
#   own the most.
#
# ###RESOURCE_PROPS_JSON### the same rows for every Resource class. A separate
#   blob rather than more rows in the one above, because the two hierarchies are
#   disjoint and their consumers are not the same: the node property table backs
#   a node-coverage ledger that Resource rows would silently move.
extends SceneTree

# PROPERTY_USAGE_STORAGE. The one flag that decides whether a property can reach
# a .tscn at all. Deliberately NOT filtering on EDITOR too: PROPERTY_USAGE_NO_EDITOR
# hides a property from the inspector while still serialising it, so an
# editor-visibility test would drop real keys (Light3D's distance_fade group is
# hidden on DirectionalLight3D and stored on every other light).
const USAGE_STORAGE := 2

# One row shape for both property blobs, so a consumer reads them the same way.
func own_properties(c: String) -> Array:
	var own: Array = []
	for p in ClassDB.class_get_property_list(c, true):
		# Group and category rows share the list with real properties and
		# carry neither STORAGE nor a usable name; the flag test drops them.
		if int(p["usage"]) & USAGE_STORAGE == 0:
			continue
		own.append({
			"name": p["name"],
			"type": int(p["type"]),
			"hint": int(p["hint"]),
			"hint_string": p["hint_string"],
		})
	return own

func _init() -> void:
	var classes: Array = []
	var properties: Dictionary = {}
	var resource_properties: Dictionary = {}

	for c in ClassDB.get_class_list():
		if ClassDB.is_parent_class(c, "Resource"):
			var res_own: Array = own_properties(c)
			if res_own.size() > 0:
				resource_properties[c] = res_own
			continue
		if not ClassDB.is_parent_class(c, "Node"):
			continue

		var own: Array = own_properties(c)
		if own.size() > 0:
			properties[c] = own

		if not ClassDB.can_instantiate(c):
			continue
		var chain: Array = []
		var p_name: String = ClassDB.get_parent_class(c)
		while p_name != "":
			chain.append(p_name)
			p_name = ClassDB.get_parent_class(p_name)
		var dim: String = "Other"
		if ClassDB.is_parent_class(c, "Node3D"):
			dim = "3D"
		elif ClassDB.is_parent_class(c, "CanvasItem"):
			dim = "2D"
		classes.append({"name": c, "dim": dim, "chain": chain})

	print("###NODES_JSON###")
	print(JSON.stringify(classes))
	print("###PROPS_JSON###")
	print(JSON.stringify(properties))
	print("###RESOURCE_PROPS_JSON###")
	print(JSON.stringify(resource_properties))
	quit()
