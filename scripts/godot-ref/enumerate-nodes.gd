# Dumps what only a running engine can answer, as five JSON blobs each after a
# marker line. Driven by build-node-catalog/classdb.mjs. Re-run against a newer
# Godot to refresh all five.
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
#
# ###RESOURCE_BASES_JSON### every Resource class's immediate base, Resource
#   terminal. Unfiltered on purpose: StandardMaterial3D declares nothing (so it
#   is absent from the blob above) and BaseMaterial3D, which declares its whole
#   property set, is abstract. Either filter would break the one chain a scene
#   walks.
#
# ###RESOURCE_GETTERS_JSON### what a fresh Resource's getters return, where the
#   property list cannot say. "collections" holds each Array or Dictionary
#   property whose value is typed, with the prefix the text saver writes: the
#   binary loader types a value as the getter does, whatever the hint says.
#   "nil_objects" names each Object property whose empty value is Nil, which
#   the binary saver writes as Nil rather than as a null Object.
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

# A class to read an abstract class's getters on: the getter belongs to the
# declaring class, so any instantiable inheritor answers for it.
func instantiable_class(c: String) -> String:
	if ClassDB.can_instantiate(c):
		return c
	for inheritor in ClassDB.get_inheriters_from_class(c):
		if ClassDB.can_instantiate(inheritor):
			return inheritor
	return ""

# The `Array[T]` or `Dictionary[K, V]` prefix var_to_str writes, or "" for an
# untyped value.
func typed_prefix(value: Variant) -> String:
	var text: String = var_to_str(value)
	if text.begins_with("Array[") or text.begins_with("Dictionary["):
		return text.substr(0, text.find("("))
	return ""

func typed_collections(c: String, own: Array) -> Dictionary:
	var typed: Dictionary = {}
	var instance_class: String = instantiable_class(c)
	if instance_class == "":
		return typed
	var instance: Object = ClassDB.instantiate(instance_class)
	for p in own:
		if p["type"] != TYPE_ARRAY and p["type"] != TYPE_DICTIONARY:
			continue
		var prefix: String = typed_prefix(instance.get(p["name"]))
		if prefix != "":
			typed[p["name"]] = prefix
	return typed

func nil_objects(c: String, found: Dictionary) -> void:
	if not ClassDB.can_instantiate(c):
		return
	var instance: Object = ClassDB.instantiate(c)
	for p in instance.get_property_list():
		if int(p["usage"]) & USAGE_STORAGE == 0 or int(p["type"]) != TYPE_OBJECT:
			continue
		if typeof(instance.get(p["name"])) == TYPE_NIL:
			found[p["name"]] = true

func _init() -> void:
	var classes: Array = []
	var properties: Dictionary = {}
	var resource_properties: Dictionary = {}
	var resource_bases: Dictionary = {}
	var collections: Dictionary = {}
	var nil_object_names: Dictionary = {}

	for c in ClassDB.get_class_list():
		if ClassDB.is_parent_class(c, "Resource"):
			var res_own: Array = own_properties(c)
			if res_own.size() > 0:
				resource_properties[c] = res_own
			var typed: Dictionary = typed_collections(c, res_own)
			if typed.size() > 0:
				collections[c] = typed
			nil_objects(c, nil_object_names)
			# Unfiltered, unlike the two blobs above: see the header.
			if c != "Resource":
				resource_bases[c] = ClassDB.get_parent_class(c)
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
	print("###RESOURCE_BASES_JSON###")
	print(JSON.stringify(resource_bases))
	print("###RESOURCE_GETTERS_JSON###")
	print(JSON.stringify({"collections": collections, "nil_objects": nil_object_names.keys()}))
	quit()
