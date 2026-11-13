# Rasterises each SVG in res://svg at scale 1 into res://png, the way `generate_icon` does
# (scene/theme/default_theme.cpp:82-84): DPITexture.create_from_string through ThorVG.
extends SceneTree


func _init() -> void:
	for file in DirAccess.get_files_at("res://svg"):
		var source := FileAccess.get_file_as_string("res://svg/" + file)
		var texture := DPITexture.create_from_string(source, 1.0)
		var error := texture.get_image().save_png("res://png/" + file.get_basename() + ".png")
		if error != OK:
			push_error("expected to save the raster of %s, got error %d" % [file, error])
			quit(1)
			return
	quit()
