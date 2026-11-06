extends SceneTree
# Prints the glyphs Godot's shaper gives each text: the glyph index, the cluster's [start, end) in the text, the advance and
# the offset in px (text_server_adv.cpp:7062-7077). The font keeps the import default, subpixel positioning on Auto, which a
# FontFile made by `new()` leaves off, and no system font stands in for a character the font lacks.
# Usage: godot --headless --path . --script oracle.gd -- <font path> <texts as a JSON array> <sizes, comma separated> <variation_opentype as JSON>
func _init():
	var args = OS.get_cmdline_user_args()
	var file = FontFile.new()
	file.load_dynamic_font(args[0])
	file.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_AUTO
	file.allow_system_fallback = false
	var coords = {}
	var spec = JSON.parse_string(args[3])
	for key in spec:
		coords[int(key) if key.is_valid_int() else key] = spec[key]
	var font = FontVariation.new()
	font.base_font = file
	font.variation_opentype = coords
	var ts = TextServerManager.get_primary_interface()
	var out = []
	for s in args[2].split(","):
		var size = int(s)
		for text in JSON.parse_string(args[1]):
			var rid = ts.create_shaped_text()
			ts.shaped_text_add_string(rid, text, font.get_rids(), size, {}, "")
			ts.shaped_text_shape(rid)
			var glyphs = []
			for g in ts.shaped_text_get_glyphs(rid):
				glyphs.append({"index": g["index"], "start": g["start"], "end": g["end"], "advance": g["advance"], "offset": [g["offset"].x, g["offset"].y]})
			out.append({"text": text, "sizePx": size, "opentype": spec, "glyphs": glyphs})
			ts.free_rid(rid)
	print("JSON:" + JSON.stringify(out))
	quit()
