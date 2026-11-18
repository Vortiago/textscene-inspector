# Dumps what only a running engine can answer, as six JSON blobs each after a
# marker line. Driven by build-node-catalog/classdb.mjs. Re-run against a newer
# Godot to refresh all six.
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
#   "variant_properties" names, per instantiable class, each stored property
#   declared as a Variant. The text saver keeps a Nil only on such a property
#   and leaves out an empty Object (resource_format_text.cpp:1980).
#
# ###NODE_DEFAULTS_JSON### what `ClassDB.class_get_property_default_value`
#   answers for each stored property of a Node class, as var_to_str writes it.
#   "declared" holds each property under the class that declares it, read on that
#   class or, where it is abstract, on its first instantiable inheritor by name.
#   "overrides" holds, per instantiable class, each value that differs from it:
#   a Label's `mouse_filter` is 2 where Control's is 0. "derived" holds, per
#   declaring class, each property a script reaches that the file does not
#   store, such as Node3D's `position`: its setter writes a stored property.
extends SceneTree

# PROPERTY_USAGE_STORAGE. The one flag that decides whether a property can reach
# a .tscn at all. Deliberately NOT filtering on EDITOR too: PROPERTY_USAGE_NO_EDITOR
# hides a property from the inspector while still serialising it, so an
# editor-visibility test would drop real keys (Light3D's distance_fade group is
# hidden on DirectionalLight3D and stored on every other light).
const USAGE_STORAGE := 2

# Inherited methods included: a setter may be bound on a base class.
func value_arguments(c: String) -> Dictionary:
	var arguments: Dictionary = {}
	for m in ClassDB.class_get_method_list(c):
		var args: Array = m["args"]
		if args.size() > 0:
			arguments[m["name"]] = args[args.size() - 1]
	return arguments

# One row shape for both property blobs, so a consumer reads them the same way.
# The loader converts to the setter's type (binder_common.h:175), and drops a setterless write (class_db.cpp:1655-1659).
func own_properties(c: String) -> Array:
	var own: Array = []
	var arguments: Dictionary = value_arguments(c)
	for p in ClassDB.class_get_property_list(c, true):
		# Group and category rows share the list with real properties and
		# carry neither STORAGE nor a usable name; the flag test drops them.
		if int(p["usage"]) & USAGE_STORAGE == 0:
			continue
		var row: Dictionary = {
			"name": p["name"],
			"type": int(p["type"]),
			"hint": int(p["hint"]),
			"hint_string": p["hint_string"],
		}
		var setter: String = ClassDB.class_get_property_setter(c, p["name"])
		if setter == "":
			row["has_setter"] = false
		var argument: Dictionary = arguments.get(setter, {})
		if not argument.is_empty() and int(argument["type"]) != row["type"]:
			row["setter_type"] = int(argument["type"])
			row["setter_hint"] = int(argument["hint"])
			row["setter_hint_string"] = argument["hint_string"]
		own.append(row)
	return own

# A fresh instance to read a class's getters on, or null. An abstract class's
# getter belongs to it, so any instantiable inheritor answers for it.
func fresh_instance(c: String) -> Object:
	if ClassDB.can_instantiate(c):
		return ClassDB.instantiate(c)
	for inheritor in ClassDB.get_inheriters_from_class(c):
		if ClassDB.can_instantiate(inheritor):
			return ClassDB.instantiate(inheritor)
	return null

# The `Array[T]` or `Dictionary[K, V]` prefix var_to_str writes, or "" for an
# untyped value.
func typed_prefix(value: Variant) -> String:
	var text: String = var_to_str(value)
	if text.begins_with("Array[") or text.begins_with("Dictionary["):
		return text.substr(0, text.find("("))
	return ""

func typed_collections(instance: Object, own: Array) -> Dictionary:
	var typed: Dictionary = {}
	for p in own:
		if p["type"] != TYPE_ARRAY and p["type"] != TYPE_DICTIONARY:
			continue
		var prefix: String = typed_prefix(instance.get(p["name"]))
		if prefix != "":
			typed[p["name"]] = prefix
	return typed

# The instance's list, not the ClassDB rows: it holds `script`, which Object
# declares, and the properties a class adds at run time.
func variant_properties(instance: Object) -> Array:
	var names: Array = []
	for p in instance.get_property_list():
		if int(p["usage"]) & USAGE_STORAGE != 0 and int(p["type"]) == TYPE_NIL:
			names.append(p["name"])
	return names

# The class an abstract declarer's defaults are read on: itself, or its first instantiable inheritor.
func default_reader(c: String) -> String:
	if ClassDB.can_instantiate(c):
		return c
	var inheritors: Array = Array(ClassDB.get_inheriters_from_class(c))
	inheritors.sort()
	for inheritor in inheritors:
		if ClassDB.can_instantiate(inheritor):
			return inheritor
	return ""

# PROPERTY_USAGE_GROUP, CATEGORY and SUBGROUP rows name no property.
const USAGE_HEADINGS := 64 | 128 | 256

# Each own property without STORAGE that a getter or a setter backs, as [name, type, has_setter].
func derived_properties(c: String) -> Array:
	var rows: Array = []
	for p in ClassDB.class_get_property_list(c, true):
		var usage: int = int(p["usage"])
		if usage & USAGE_STORAGE != 0 or usage & USAGE_HEADINGS != 0:
			continue
		var setter: String = ClassDB.class_get_property_setter(c, p["name"])
		if setter == "" and ClassDB.class_get_property_getter(c, p["name"]) == "":
			continue
		rows.append([p["name"], int(p["type"]), setter != ""])
	return rows

func node_defaults(properties: Dictionary) -> Dictionary:
	var declared: Dictionary = {}
	for c in properties:
		var reader: String = default_reader(c)
		if reader == "":
			continue
		var values: Dictionary = {}
		for p in properties[c]:
			values[p["name"]] = var_to_str(ClassDB.class_get_property_default_value(reader, p["name"]))
		declared[c] = values
	var overrides: Dictionary = {}
	for c in ClassDB.get_class_list():
		if not ClassDB.is_parent_class(c, "Node") or not ClassDB.can_instantiate(c):
			continue
		var differing: Dictionary = {}
		var declarer: String = c
		while declarer != "":
			for name in declared.get(declarer, {}):
				if differing.has(name):
					continue
				var value: String = var_to_str(ClassDB.class_get_property_default_value(c, name))
				if value != declared[declarer][name]:
					differing[name] = value
			declarer = ClassDB.get_parent_class(declarer)
		if differing.size() > 0:
			overrides[c] = differing
	var derived: Dictionary = {}
	for c in ClassDB.get_class_list():
		if ClassDB.is_parent_class(c, "Node"):
			var rows: Array = derived_properties(c)
			if rows.size() > 0:
				derived[c] = rows
	return {"declared": declared, "overrides": overrides, "derived": derived}

func _init() -> void:
	var classes: Array = []
	var properties: Dictionary = {}
	var resource_properties: Dictionary = {}
	var resource_bases: Dictionary = {}
	var collections: Dictionary = {}
	var variant_property_names: Dictionary = {}

	for c in ClassDB.get_class_list():
		if ClassDB.is_parent_class(c, "Resource"):
			var res_own: Array = own_properties(c)
			if res_own.size() > 0:
				resource_properties[c] = res_own
			var instance: Object = fresh_instance(c)
			if instance != null:
				var typed: Dictionary = typed_collections(instance, res_own)
				if typed.size() > 0:
					collections[c] = typed
				# Keyed by the class itself, so only its own instance answers.
				var variants: Array = variant_properties(instance) if ClassDB.can_instantiate(c) else []
				if variants.size() > 0:
					variant_property_names[c] = variants
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
	print(JSON.stringify({"collections": collections, "variant_properties": variant_property_names}))
	print("###NODE_DEFAULTS_JSON###")
	print(JSON.stringify(node_defaults(properties)))
	quit()
