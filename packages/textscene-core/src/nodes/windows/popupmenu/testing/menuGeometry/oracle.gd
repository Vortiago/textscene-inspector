extends Node
# PopupMenu geometry as Godot lays it out: window size, then the internal panel, scroll container, item
# control and vertical scroll bar in window space. Each case is a list of item dictionaries.
func rect_of(c: Control) -> Array:
	var p = c.get_global_rect()
	return [p.position.x, p.position.y, p.size.x, p.size.y]

func icon(w: int, h: int) -> Texture2D:
	return ImageTexture.create_from_image(Image.create_empty(w, h, false, Image.FORMAT_RGBA8))

func build(items: Array, props: Dictionary, rtl: bool) -> PopupMenu:
	var m := PopupMenu.new()
	m.item_count = items.size()
	for i in items.size():
		var it: Dictionary = items[i]
		m.set("item_%d/text" % i, it.get("text", ""))
		if it.has("icon"):
			m.set("item_%d/icon" % i, icon(it["icon"][0], it["icon"][1]))
		m.set("item_%d/checkable" % i, it.get("checkable", 0))
		m.set("item_%d/checked" % i, it.get("checked", false))
		m.set("item_%d/disabled" % i, it.get("disabled", false))
		m.set("item_%d/separator" % i, it.get("separator", false))
	for k in props:
		m.set(k, props[k])
	return m

func many(n: int) -> Array:
	var a := []
	for i in n:
		a.append({"text": "Item %d" % i})
	return a

func _ready():
	get_viewport().gui_embed_subwindows = true
	var plain := [{"text": "Open"}, {"text": "Save as"}]
	var cases := {
		"plain": [plain, {}, false],
		"six": [[{"text": "Open"}, {"text": "Autosave", "checkable": 1, "checked": true}, {"text": "Fast mode", "checkable": 2, "checked": true}, {"separator": true}, {"text": "Slow mode", "checkable": 2}, {"text": "Quit", "disabled": true}], {"position": Vector2i(100, 100)}, false],
		"empty": [[], {}, false],
		"one_blank": [[{}], {}, false],
		"icon": [[{"text": "Open", "icon": [20, 12]}, {"text": "Save"}], {}, false],
		"icon_wide": [[{"text": "Open", "icon": [60, 30]}, {"text": "Save"}], {}, false],
		"check_icon": [[{"text": "Open", "icon": [20, 12], "checkable": 1}, {"text": "Save"}], {}, false],
		"check_only": [[{"text": "Open", "checkable": 1}, {"text": "Save"}], {}, false],
		"sep_label": [[{"text": "Open"}, {"text": "Section", "separator": true}, {"text": "Save"}], {}, false],
		"sep_icon": [[{"text": "Open"}, {"text": "Section", "separator": true, "icon": [20, 12]}, {"text": "Save"}], {}, false],
		"sep_only": [[{"separator": true}], {}, false],
		"rtl": [[{"text": "Open", "icon": [20, 12]}, {"text": "Section", "separator": true}, {"text": "Save", "checkable": 1, "checked": true}], {}, true],
		"many30": [many(30), {"position": Vector2i(100, 20)}, false],
		"many30_big": [many(30), {"position": Vector2i(100, 20), "size": Vector2i(300, 700)}, false],
		"many25": [many(25), {}, false],
		"size_small": [plain, {"size": Vector2i(10, 10)}, false],
		"size_big": [plain, {"size": Vector2i(300, 200)}, false],
	}
	var out := {}
	for name in cases:
		var c = cases[name]
		var root := Control.new()
		if c[2]:
			root.layout_direction = Control.LAYOUT_DIRECTION_RTL
		add_child(root)
		var m := build(c[0], c[1], c[2])
		m.visible = true
		root.add_child(m)
		for i in 8:
			await get_tree().process_frame
		var panel: Control = m.get_child(0, true)
		var scroll: ScrollContainer = panel.get_child(0, true)
		var ctl: Control = scroll.get_child(0, true)
		var vbar := scroll.get_v_scroll_bar()
		out[name] = {
			"size": [m.size.x, m.size.y],
			"panel": rect_of(panel),
			"scroll": rect_of(scroll),
			"control": rect_of(ctl),
			"controlMinHeight": ctl.get_combined_minimum_size().y,
			"vbar": [vbar.visible, vbar.size.x, vbar.size.y, vbar.get_minimum_size().x],
			"contentsMin": [m.get_contents_minimum_size().x, m.get_contents_minimum_size().y],
		}
		root.queue_free()
		await get_tree().process_frame
	print("ORACLE " + JSON.stringify(out))
	get_tree().quit()
