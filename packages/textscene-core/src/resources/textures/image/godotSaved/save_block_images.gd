# Writes the block-compressed images that decode.test.ts reads, and the golden scene
# unit-sprite2d-block-compressed.tscn, through Godot 4.6.3. Each `<case>.tres` is an ImageTexture as
# Godot saves it, and `<case>.rgba8.tres` is what `Image.decompress()` gives for it after the
# texture swizzle (`texture_storage.cpp:1997-2076`, `:2246-2261`).
#
#   godot --headless --path <any project> --script save_block_images.gd -- <this folder> <scenes/fixtures>
extends SceneTree

const SIDE := 16
const GOLDEN_SCALE := 15

# Godot writes no comments, so the golden's header goes in after the save.
const GOLDEN_HEADER := """
; One variable: the block-compressed format of an Image. Six Sprite2Ds draw one 16x16 colour ramp
; saved as DXT1 (its first block in the three-colour mode), DXT3, DXT5, DXT5_RA_AS_RG, RGTC Red8
; and RGTC RedGreen8, magnified 15x. At an odd scale each texel centre falls on a pixel centre,
; where the linear filter reads that texel alone. Every other ImageTexture fixture saves an
; uncompressed format, so a block decode regression shows nowhere else.
; textures/image/godotSaved/save_block_images.gd in core writes this scene.
"""

# A ramp each channel can tell apart: red runs with x, green with y, blue against both, alpha with x.
func ramp(width: int, height: int) -> Image:
	var image := Image.create(width, height, false, Image.FORMAT_RGBA8)
	for y in height:
		for x in width:
			var u := float(x) / (width - 1)
			var v := float(y) / (height - 1)
			image.set_pixel(x, y, Color(u, v, 1.0 - (u + v) / 2.0, u))
	return image

func compressed(source: Image, channels: Image.UsedChannels) -> Image:
	var image: Image = source.duplicate()
	image.compress_from_channels(Image.COMPRESS_S3TC, channels)
	return image

func reformatted(image: Image, format: Image.Format, bytes: PackedByteArray) -> Image:
	return Image.create_from_data(image.get_width(), image.get_height(), image.has_mipmaps(), format, bytes)

# Godot 4.6.3 never writes DXT3, so this keeps a DXT5 image's colour blocks and swaps each
# interpolated alpha block for the explicit 4-bit alpha of the source ramp.
func dxt3(source: Image, dxt5: Image) -> Image:
	var bytes := dxt5.get_data()
	var blocks_x := SIDE / 4
	for block in bytes.size() / 16:
		var bx := block % blocks_x
		var by := block / blocks_x
		for row in 4:
			var packed := 0
			for column in 4:
				var alpha := roundi(source.get_pixel(bx * 4 + column, by * 4 + row).a * 15.0)
				packed |= alpha << (4 * column)
			bytes[block * 16 + row * 2] = packed & 0xFF
			bytes[block * 16 + row * 2 + 1] = packed >> 8
	return reformatted(dxt5, Image.FORMAT_DXT3, bytes)

# The first block of a DXT1 image in its three-colour mode: c0 blue below c1 red, indices 0 to 3.
func with_three_colour_block(dxt1: Image) -> Image:
	var bytes := dxt1.get_data()
	var block := [0x1F, 0x00, 0x00, 0xF8, 0xE4, 0xE4, 0xE4, 0xE4]
	for i in block.size():
		bytes[i] = block[i]
	return reformatted(dxt1, Image.FORMAT_DXT1, bytes)

# A DXT5 block whose alpha is in its six-value mode (alpha0 40 below alpha1 200), indices 0 to 7.
func six_value_alpha_block() -> Image:
	var indices := 0
	for texel in 16:
		indices |= (texel % 8) << (3 * texel)
	var bytes := PackedByteArray([40, 200])
	for i in 6:
		bytes.append((indices >> (8 * i)) & 0xFF)
	bytes.append_array(PackedByteArray([0xFF, 0xFF, 0, 0, 0, 0, 0, 0]))
	return Image.create_from_data(4, 4, false, Image.FORMAT_DXT5, bytes)

func decompressed(image: Image) -> Image:
	var rgba8: Image = image.duplicate()
	rgba8.decompress()
	rgba8.convert(Image.FORMAT_RGBA8)
	rgba8.clear_mipmaps()
	if image.get_format() == Image.FORMAT_DXT1:
		# The DXT1 swizzle reads alpha as one (`texture_storage.cpp:2011`).
		for y in rgba8.get_height():
			for x in rgba8.get_width():
				var colour := rgba8.get_pixel(x, y)
				colour.a = 1.0
				rgba8.set_pixel(x, y, colour)
	return rgba8

func save_case(folder: String, name: String, image: Image) -> void:
	ResourceSaver.save(ImageTexture.create_from_image(image), folder.path_join(name + ".tres"))
	ResourceSaver.save(ImageTexture.create_from_image(decompressed(image)), folder.path_join(name + ".rgba8.tres"))

func golden_formats(source: Image) -> Dictionary:
	var dxt5 := compressed(source, Image.USED_CHANNELS_RGBA)
	return {
		"DXT1": with_three_colour_block(compressed(source, Image.USED_CHANNELS_RGB)),
		"DXT3": dxt3(source, dxt5),
		"DXT5": dxt5,
		"DXT5RaAsRg": reformatted(dxt5, Image.FORMAT_DXT5_RA_AS_RG, dxt5.get_data()),
		"RgtcRed": compressed(source, Image.USED_CHANNELS_R),
		"RgtcRedGreen": compressed(source, Image.USED_CHANNELS_RG),
	}

func save_golden(path: String, formats: Dictionary) -> void:
	var root := Node2D.new()
	root.name = "Root"
	var backdrop := Polygon2D.new()
	backdrop.name = "Backdrop"
	backdrop.color = Color(0.85, 0.85, 0.8)
	backdrop.polygon = PackedVector2Array([Vector2(0, 0), Vector2(1152, 0), Vector2(1152, 648), Vector2(0, 648)])
	root.add_child(backdrop)
	backdrop.owner = root
	var index := 0
	for name in formats:
		var sprite := Sprite2D.new()
		sprite.name = name
		sprite.texture = ImageTexture.create_from_image(formats[name])
		sprite.scale = Vector2(GOLDEN_SCALE, GOLDEN_SCALE)
		sprite.position = Vector2(256 + 320 * (index % 3), 184 + 280 * (index / 3))
		root.add_child(sprite)
		sprite.owner = root
		index += 1
	var scene := PackedScene.new()
	scene.pack(root)
	ResourceSaver.save(scene, path)
	var text := FileAccess.get_file_as_string(path)
	var first_line_end := text.find("\n")
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(text.substr(0, first_line_end + 1) + GOLDEN_HEADER + text.substr(first_line_end + 1))

func _init() -> void:
	var arguments := OS.get_cmdline_user_args()
	var folder := arguments[0]
	var source := ramp(SIDE, SIDE)
	var formats := golden_formats(source)
	for name in formats:
		save_case(folder, name, formats[name])
	save_case(folder, "DXT5SixValueAlpha", six_value_alpha_block())
	save_case(folder, "DXT5Cropped", compressed(ramp(6, 5), Image.USED_CHANNELS_RGBA))
	var mipmapped := ramp(8, 8)
	mipmapped.generate_mipmaps()
	save_case(folder, "DXT5Mipmapped", compressed(mipmapped, Image.USED_CHANNELS_RGBA))
	save_golden(arguments[1].path_join("unit-sprite2d-block-compressed.tscn"), formats)
	quit()
