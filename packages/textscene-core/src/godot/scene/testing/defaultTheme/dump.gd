extends SceneTree

# Prints the JSON one scale of `defaultTheme.godot.json` holds, after a line of its own that reads
# THEME. The project's `gui/theme/default_theme_scale` sets the scale `fill_default_theme` builds at.
func c4(c: Color) -> Array: return [c.r, c.g, c.b, c.a]

func sides(box: StyleBox) -> Array:
	return [box.content_margin_left, box.content_margin_top, box.content_margin_right, box.content_margin_bottom]

func style_box(box: StyleBox) -> Dictionary:
	if box is StyleBoxFlat:
		return {
			"kind": "flat",
			"bgColor": c4(box.bg_color),
			"contentMargin": sides(box),
			"cornerRadius": [box.corner_radius_top_left, box.corner_radius_top_right, box.corner_radius_bottom_right, box.corner_radius_bottom_left],
			"cornerDetail": box.corner_detail,
			"borderWidth": [box.border_width_left, box.border_width_top, box.border_width_right, box.border_width_bottom],
			"borderColor": c4(box.border_color),
			"expandMargin": [box.expand_margin_left, box.expand_margin_top, box.expand_margin_right, box.expand_margin_bottom],
			"drawCenter": box.draw_center,
		}
	if box is StyleBoxLine:
		return {
			"kind": "line",
			"contentMargin": sides(box),
			"color": c4(box.color),
			"thickness": box.thickness,
			"growBegin": box.grow_begin,
			"growEnd": box.grow_end,
			"vertical": box.vertical,
		}
	if box is StyleBoxEmpty:
		return {"kind": "empty", "contentMargin": sides(box)}
	return {"kind": box.get_class()}

# Only the items `has_theme_item` answers: a font size of -1 is listed but unset (`theme.cpp:1009-1030`).
# The caller clears `default_font_size` first, as it would answer every font size.
func items(theme: Theme, type: String, data_type: int, read: Callable) -> Dictionary:
	var out := {}
	for name in theme.get_theme_item_list(data_type, type):
		if theme.has_theme_item(data_type, name, type):
			out[name] = read.call(theme.get_theme_item(data_type, name, type))
	return out

func _init():
	var theme := ThemeDB.get_default_theme()
	# Not a duplicate: it copies each font size of -1 as the default size it reads back as.
	var default_font_size := theme.default_font_size
	theme.default_font_size = -1
	var types := {}
	var type_names := theme.get_type_list()
	type_names.sort()
	for type in type_names:
		types[type] = {
			"colors": items(theme, type, Theme.DATA_TYPE_COLOR, c4),
			"constants": items(theme, type, Theme.DATA_TYPE_CONSTANT, func(v): return v),
			"fontSizes": items(theme, type, Theme.DATA_TYPE_FONT_SIZE, func(v): return v),
			"styles": items(theme, type, Theme.DATA_TYPE_STYLEBOX, style_box),
		}
	var variations := {}
	for type in type_names:
		var base := theme.get_type_variation_base(type)
		if base != &"":
			variations[type] = String(base)
	print("THEME")
	print(JSON.stringify({
		"scale": ProjectSettings.get_setting("gui/theme/default_theme_scale"),
		"defaultFontSize": default_font_size,
		"variations": variations,
		"types": types,
	}))
	quit()
