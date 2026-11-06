extends SceneTree
# Prints the advance that Godot's shaper gives each character alone, in px: HarfBuzz's x_advance, exact to 1/64 px at the sizes
# of subpixel positioning (text_server_adv.cpp:7077). font_get_glyph_advance returns the hinted glyph slot's advance, not this.
# Usage: godot --headless --path . --script oracle.gd -- <font path> <chars> <sizes, comma separated> <variation_opentype as JSON, keys int or string>
func _init():
	var args = OS.get_cmdline_user_args()
	var file = FontFile.new()
	file.load_dynamic_font(args[0])
	file.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_AUTO
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
		for ch in args[1]:
			var srid = ts.create_shaped_text()
			ts.shaped_text_add_string(srid, ch, font.get_rids(), size, {}, "")
			ts.shaped_text_shape(srid)
			var glyphs = ts.shaped_text_get_glyphs(srid)
			out.append({"font": args[0].get_file(), "char": ch, "sizePx": size, "opentype": spec, "advancePx": glyphs[0]["advance"], "glyph": glyphs[0]["index"]})
			ts.free_rid(srid)
	print("JSON:" + JSON.stringify(out))
	quit()
