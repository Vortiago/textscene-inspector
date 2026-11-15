extends Node
# Dialog geometry as Godot lays it out: window size, then each internal Control's rect in window space.
func rect_of(c: Control) -> Array:
	var p = c.get_global_rect()
	return [p.position.x, p.position.y, p.size.x, p.size.y]

func make(kind: String, props: Dictionary, child: bool = false) -> Window:
	var d: Window = ClassDB.instantiate(kind)
	for k in props:
		d.set(k, props[k])
	if child:
		var r = ColorRect.new()
		r.custom_minimum_size = Vector2(120, 50)
		d.add_child(r)
	return d

func _ready():
	var long_text = "This is a rather long message that should wrap across several lines inside the dialog"
	var cases = {
		"accept_default": ["AcceptDialog", {"dialog_text": "Are you sure you want to continue?"}, false],
		"accept_empty": ["AcceptDialog", {}, false],
		"confirm": ["ConfirmationDialog", {"dialog_text": "Delete this file?", "ok_button_text": "Delete", "cancel_button_text": "Keep"}, false],
		"confirm_default": ["ConfirmationDialog", {}, false],
		"autowrap_100": ["AcceptDialog", {"dialog_text": long_text, "dialog_autowrap": true}, false],
		"autowrap_300": ["AcceptDialog", {"dialog_text": long_text, "dialog_autowrap": true, "size": Vector2i(300, 100)}, false],
		"autowrap_400x40": ["AcceptDialog", {"dialog_text": long_text, "dialog_autowrap": true, "size": Vector2i(400, 40)}, false],
		"multiline": ["AcceptDialog", {"dialog_text": "one\ntwo\nthree"}, false],
		"child": ["AcceptDialog", {"dialog_text": "Hi"}, true],
		"child_confirm": ["ConfirmationDialog", {"dialog_text": "Hi"}, true],
		"size_big": ["AcceptDialog", {"dialog_text": "Hi", "size": Vector2i(400, 200)}, false],
		"min_size": ["AcceptDialog", {"dialog_text": "Hi", "min_size": Vector2i(300, 150)}, false],
		"long_single": ["AcceptDialog", {"dialog_text": long_text}, false],
	}
	var out = {}
	for name in cases:
		var c = cases[name]
		var d = make(c[0], c[1], c[2])
		d.visible = true
		add_child(d)
		for i in 8:
			await get_tree().process_frame
		var hbox: Control = d.get_ok_button().get_parent()
		var entry = {"size": [d.size.x, d.size.y], "label": rect_of(d.get_label()), "ok": rect_of(d.get_ok_button()), "hbox": rect_of(hbox), "title": d.title}
		if c[0] == "ConfirmationDialog":
			entry["cancel"] = rect_of(d.get_cancel_button())
		var kids = []
		for ch in d.get_children():
			if ch is ColorRect:
				kids.append(rect_of(ch))
		entry["children"] = kids
		out[name] = entry
		d.queue_free()
		await get_tree().process_frame
	print("ORACLE " + JSON.stringify(out))
	get_tree().quit()
