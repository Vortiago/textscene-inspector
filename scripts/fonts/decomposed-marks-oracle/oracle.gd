extends SceneTree
# Prints how Godot's shaper draws each character alone: the glyph that follows the first in its cluster is a
# mark, with the offset it takes from the pen after the base (text_server_adv.cpp:7062-7068) in px. The font keeps
# the import default, subpixel positioning on Auto, which a FontFile made by `new()` leaves off.
# Usage: godot --headless --path . --script oracle.gd -- <font path> <chars> <sizes, comma separated>
func _init():
	var args = OS.get_cmdline_user_args()
	var file = FontFile.new()
	file.load_dynamic_font(args[0])
	file.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_AUTO
	var ts = TextServerManager.get_primary_interface()
	var out = []
	for s in args[2].split(","):
		var size = int(s)
		for ch in args[1]:
			var rid = ts.create_shaped_text()
			ts.shaped_text_add_string(rid, ch, file.get_rids(), size, {}, "")
			ts.shaped_text_shape(rid)
			var glyphs = []
			for g in ts.shaped_text_get_glyphs(rid):
				glyphs.append({"index": g["index"], "advance": g["advance"], "offset": [g["offset"].x, g["offset"].y]})
			out.append({"font": args[0].get_file(), "char": ch, "sizePx": size, "glyphs": glyphs})
			ts.free_rid(rid)
	print(JSON.stringify(out))
	quit()
