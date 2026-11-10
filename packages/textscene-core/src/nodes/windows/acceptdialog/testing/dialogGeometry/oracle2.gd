extends Node
func rect_of(c: Control) -> Array:
	var p = c.get_global_rect()
	return [p.position.x, p.position.y, p.size.x, p.size.y]
func _ready():
	var out = {}
	for f in OS.get_cmdline_user_args():
		var scn = load("res://scn/" + f + ".tscn")
		var root = scn.instantiate()
		add_child(root)
		for i in 10:
			await get_tree().process_frame
		var d = root.get_node("Dialog")
		var e = {"size": [d.size.x, d.size.y], "label": rect_of(d.get_label()), "ok": rect_of(d.get_ok_button())}
		if d is ConfirmationDialog:
			e["cancel"] = rect_of(d.get_cancel_button())
		var kids = []
		for ch in d.get_children():
			if ch is ColorRect:
				kids.append(rect_of(ch))
		e["children"] = kids
		out[f] = e
	print("ORACLE " + JSON.stringify(out))
	get_tree().quit()
