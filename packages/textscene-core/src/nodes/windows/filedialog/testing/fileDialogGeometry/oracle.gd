extends Node
# A visible FileDialog's Control tree as Godot lays it out, for each case below: the window size, the title,
# and every visible Control in tree order (internal children included) with its type, name, global rect,
# the text it shows and whether it is disabled. Run from this folder, whose res:// holds only project.godot,
# oracle.gd and main.tscn. `-- <case> ...` runs the named cases only. The last line is `ORACLE <json>`.
const NOISE := ["VScrollBar", "HScrollBar", "SplitContainerDragger"]

func dump(n: Node, depth: int, rows: Array) -> void:
	if n is Control:
		var c: Control = n
		if not c.is_visible_in_tree() or c.get_class() in NOISE:
			return
		var r = c.get_global_rect()
		var row = {"depth": depth, "type": c.get_class(), "rect": [r.position.x, r.position.y, r.size.x, r.size.y]}
		if c is Label: row["text"] = (c as Label).text
		if c is Button: row["text"] = (c as Button).text
		if c is Button and (c as Button).disabled: row["disabled"] = true
		if c is Button and (c as Button).button_pressed: row["pressed"] = true
		if c is LineEdit: row["text"] = (c as LineEdit).text
		if c is OptionButton: row["text"] = (c as OptionButton).text
		rows.append(row)
	for ch in n.get_children(true):
		dump(ch, depth + 1, rows)

func cases() -> Dictionary:
	var png := PackedStringArray(["*.png ; PNG Image"])
	return {
		"open": {"file_mode": 0, "filters": png},
		"open_files": {"file_mode": 1, "filters": png},
		"open_dir": {"file_mode": 2, "filters": png},
		"open_any": {"file_mode": 3, "filters": png},
		"save": {"file_mode": 4, "filters": png},
		"no_filters": {"file_mode": 0},
		"two_filters": {"file_mode": 0, "filters": PackedStringArray(["*.png ; PNG Image", "*.jpg, *.jpeg ; JPEG Image"])},
		"unnamed_filter": {"file_mode": 0, "filters": PackedStringArray(["*.png"])},
		"no_favorites": {"file_mode": 0, "filters": png, "favorites_enabled": false},
		"no_recent": {"file_mode": 0, "filters": png, "recent_list_enabled": false},
		"no_favorites_no_recent": {"file_mode": 0, "filters": png, "favorites_enabled": false, "recent_list_enabled": false},
		"no_hidden_toggle": {"file_mode": 0, "filters": png, "hidden_files_toggle_enabled": false},
		"no_filter_toggle": {"file_mode": 0, "filters": png, "file_filter_toggle_enabled": false},
		"no_sort": {"file_mode": 0, "filters": png, "file_sort_options_enabled": false},
		"no_layout": {"file_mode": 0, "filters": png, "layout_toggle_enabled": false},
		"no_filter_no_sort": {"file_mode": 0, "filters": png, "file_filter_toggle_enabled": false, "file_sort_options_enabled": false},
		"no_toggles": {"file_mode": 0, "filters": png, "hidden_files_toggle_enabled": false, "file_filter_toggle_enabled": false, "file_sort_options_enabled": false, "layout_toggle_enabled": false},
		"save_no_folder_creation": {"file_mode": 4, "filters": png, "folder_creation_enabled": false},
		"list_layout": {"file_mode": 0, "filters": png, "display_mode": 1},
		"userdata": {"file_mode": 0, "filters": png, "access": 1},
		"custom_title": {"file_mode": 0, "filters": png, "title": "Pick one"},
		"keep_title": {"file_mode": 0, "filters": png, "mode_overrides_title": false},
		"custom_ok": {"file_mode": 0, "filters": png, "ok_button_text": "Choose"},
		"small": {"file_mode": 0, "filters": png, "size": Vector2i(300, 200)},
		"large": {"file_mode": 0, "filters": png, "size": Vector2i(900, 500)},
		"options": {"file_mode": 0, "filters": png, "option_count": 2, "option_0/name": "Quality", "option_0/values": PackedStringArray(["Low", "High"]), "option_0/default": 1, "option_1/name": "Keep metadata"},
		"option_checkbox": {"file_mode": 0, "filters": png, "option_count": 1, "option_0/name": "Keep metadata"},
		"option_checkbox_on": {"file_mode": 0, "filters": png, "option_count": 1, "option_0/name": "Keep metadata", "option_0/default": 1},
		"option_values": {"file_mode": 0, "filters": png, "option_count": 1, "option_0/name": "Quality", "option_0/values": PackedStringArray(["Low", "High"])},
		"options_many": {"file_mode": 0, "filters": png, "option_count": 5, "option_0/name": "Quality", "option_0/values": PackedStringArray(["Low", "High"]), "option_1/name": "Keep metadata", "option_2/name": "Compression", "option_2/values": PackedStringArray(["None", "Fast", "Best"]), "option_3/name": "Strip", "option_4/name": "Interlace"},
	}

func _ready():
	var all = cases()
	var wanted = OS.get_cmdline_user_args()
	var out = {}
	for name in all:
		if wanted.size() > 0 and not (name in wanted):
			continue
		var d: FileDialog = FileDialog.new()
		for k in all[name]:
			d.set(k, all[name][k])
		d.visible = true
		add_child(d)
		for i in 10:
			await get_tree().process_frame
		var rows = []
		dump(d, 0, rows)
		out[name] = {"size": [d.size.x, d.size.y], "title": d.title, "nodes": rows}
		d.queue_free()
		await get_tree().process_frame
	print("ORACLE " + JSON.stringify(out))
	get_tree().quit()
