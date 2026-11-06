extends SceneTree
# Prints the advance that Godot's shaper gives each character alone, in px: HarfBuzz's x_advance, exact to 1/64 px at the sizes
# of subpixel positioning (text_server_adv.cpp:7077). font_get_glyph_advance returns the hinted glyph slot's advance, not this.
# With a fifth argument of comma separated pairs, it prints the kerning of each pair too: the shaped advance of the pair's first
# glyph, less its advance alone.
# Usage: godot --headless --path . --script oracle.gd -- <font path> <chars> <sizes, comma separated> <variation_opentype as JSON, keys int or string> [pairs]
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
	var pairs = args[4].split(",") if args.size() > 4 else PackedStringArray()
	for s in args[2].split(","):
		var size = int(s)
		for ch in args[1]:
			var srid = ts.create_shaped_text()
			ts.shaped_text_add_string(srid, ch, font.get_rids(), size, {}, "")
			ts.shaped_text_shape(srid)
			var glyphs = ts.shaped_text_get_glyphs(srid)
			out.append({"font": args[0].get_file(), "char": ch, "sizePx": size, "opentype": spec, "advancePx": glyphs[0]["advance"], "glyph": glyphs[0]["index"]})
			ts.free_rid(srid)
		for pair in pairs:
			var pair_rid = ts.create_shaped_text()
			ts.shaped_text_add_string(pair_rid, pair, font.get_rids(), size, {}, "")
			ts.shaped_text_shape(pair_rid)
			var alone_rid = ts.create_shaped_text()
			ts.shaped_text_add_string(alone_rid, pair[0], font.get_rids(), size, {}, "")
			ts.shaped_text_shape(alone_rid)
			var kerning = ts.shaped_text_get_glyphs(pair_rid)[0]["advance"] - ts.shaped_text_get_glyphs(alone_rid)[0]["advance"]
			out.append({"font": args[0].get_file(), "pair": pair, "sizePx": size, "opentype": spec, "kerningPx": kerning})
			ts.free_rid(pair_rid)
			ts.free_rid(alone_rid)
	print("JSON:" + JSON.stringify(out))
	quit()
