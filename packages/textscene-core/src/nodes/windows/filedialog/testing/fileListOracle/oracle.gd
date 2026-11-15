extends Node
# The file list a visible FileDialog shows, for each case below: every row's text, kind and state, the File
# field, the OK button and the Path field. Run from this folder, whose res:// holds the tree listed here.
# `-- <case> ...` runs the named cases only. The last line is `ORACLE <json>`.
func item_lists(n: Node, found: Array) -> void:
	if n is ItemList:
		found.append(n)
	for ch in n.get_children(true):
		item_lists(ch, found)

func icon_name(d: FileDialog, icon: Texture2D) -> String:
	for n in ["folder", "file", "folder_thumbnail", "file_thumbnail"]:
		if d.get_theme_icon(n, "FileDialog") == icon:
			return n
	return "none" if icon == null else "other"

func first_line_edit(n: Node) -> LineEdit:
	if n is LineEdit:
		return n
	for ch in n.get_children(true):
		var found = first_line_edit(ch)
		if found:
			return found
	return null

func find_button(n: Node, text: String) -> Button:
	if n is Button and (n as Button).text == text:
		return n
	for ch in n.get_children(true):
		var found = find_button(ch, text)
		if found:
			return found
	return null

func cases() -> Dictionary:
	var png := PackedStringArray(["*.png ; PNG Image"])
	return {
		"default": {},
		"open_png": {"file_mode": 0, "filters": png},
		"open_files_png": {"file_mode": 1, "filters": png},
		"open_dir": {"file_mode": 2},
		"open_any": {"file_mode": 3},
		"save": {"file_mode": 4},
		"two_filters": {"file_mode": 0, "filters": PackedStringArray(["*.png ; PNG Image", "*.txt, *.zip ; Other"])},
		"hidden": {"file_mode": 0, "show_hidden_files": true},
		"list_mode": {"file_mode": 0, "display_mode": 1},
		"filename_filter": {"file_mode": 0, "filename_filter": "png"},
		"current_file": {"file_mode": 0, "current_file": "B.png"},
		"current_file_missing": {"file_mode": 0, "current_file": "nope.png"},
		"current_file_save": {"file_mode": 4, "current_file": "B.png"},
		"root_subfolder": {"file_mode": 0, "root_subfolder": "Alpha"},
		"current_dir": {"file_mode": 0, "current_dir": "beta"},
		"missing_root_subfolder": {"file_mode": 0, "root_subfolder": "nope"},
		"missing_current_dir": {"file_mode": 0, "current_dir": "nope"},
		"current_file_folder_first": {"file_mode": 0, "current_file": "x.png"},
		"subfolder_then_missing_dir": {"file_mode": 0, "root_subfolder": "Alpha", "current_dir": "nope"},
		"subfolder_then_relative_dir": {"file_mode": 0, "root_subfolder": "d1", "current_dir": "beta"},
		"subfolder_missing_then_dir": {"file_mode": 0, "root_subfolder": "nope", "current_dir": "beta"},
		"current_path_missing_dir": {"file_mode": 0, "current_path": "res://nope/x.png"},
		"current_path_dir": {"file_mode": 0, "current_path": "res://beta/inner.png"},
		"nested_root_subfolder": {"file_mode": 0, "root_subfolder": "beta", "current_dir": "res://beta"},
		"userdata": {"file_mode": 0, "access": 1},
		"wildcard_filter": {"file_mode": 0, "filters": PackedStringArray(["file-?.png ; Single"])},
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
		var lists = []
		item_lists(d, lists)
		var list: ItemList = lists[lists.size() - 1]
		var rows = []
		for i in list.get_item_count():
			var meta = list.get_item_metadata(i)
			rows.append({"text": list.get_item_text(i), "dir": meta["dir"], "icon": icon_name(d, list.get_item_icon(i)), "disabled": list.is_item_disabled(i), "selected": list.is_selected(i), "modulate": list.get_item_icon_modulate(i).to_html()})
		var ok = d.get_ok_button()
		out[name] = {"rows": rows, "file": d.get_line_edit().text, "ok_disabled": ok.disabled, "ok_text": ok.text, "current_dir": d.current_dir, "path_text": first_line_edit(d).text, "columns": list.max_columns, "fixed_column_width": list.fixed_column_width}
		d.queue_free()
		await get_tree().process_frame
	print("ORACLE " + JSON.stringify(out))
	get_tree().quit()
