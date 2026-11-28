extends SceneTree

func _init() -> void:
	var loaded := load(OS.get_cmdline_user_args()[0])
	if loaded is PackedScene:
		var root: Node = loaded.instantiate()
		# A scene that loads but does not instantiate has no tree to print.
		print("LOADED:", "no instance" if root == null else _tree(root))
	else:
		print("LOADED:", loaded != null)
	quit()

# Each node's name, with its position where it has one, children nested in brackets.
func _tree(node: Node) -> String:
	var text := String(node.name)
	if node is Node2D and node.position != Vector2.ZERO:
		text += str(node.position)
	var children := node.get_children().map(func(child): return _tree(child))
	return text if children.is_empty() else "%s[%s]" % [text, ", ".join(children)]
