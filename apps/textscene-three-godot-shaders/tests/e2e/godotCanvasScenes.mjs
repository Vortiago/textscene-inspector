import { parseViewportOutput, viewportProjectFiles, viewportScript } from './godotViewports.mjs';

const LINE_PREFIX = 'CANVAS ';
const FILES = { dataFile: 'canvases.json', shaderPrefix: 'canvas' };

/** One Node2D in each viewport that draws the scene's rects in its `draw` signal, with no material. */
export const CANVAS_MAIN_SCRIPT = viewportScript({
  dataFile: FILES.dataFile,
  linePrefix: LINE_PREFIX,
  functions: `
const FILTERS := {"nearest": CanvasItem.TEXTURE_FILTER_NEAREST, "linear": CanvasItem.TEXTURE_FILTER_LINEAR}
const REPEATS := {"disabled": CanvasItem.TEXTURE_REPEAT_DISABLED, "enabled": CanvasItem.TEXTURE_REPEAT_ENABLED, "mirror": CanvasItem.TEXTURE_REPEAT_MIRROR}

func color4(values: Array) -> Color:
	return Color(values[0], values[1], values[2], values[3])

func rect2(values: Array) -> Rect2:
	return Rect2(values[0], values[1], values[2], values[3])

func texture_of(texture: Dictionary) -> ImageTexture:
	var bytes := PackedByteArray()
	for texel in texture.texels:
		bytes.append_array(PackedByteArray([int(texel[0]), int(texel[1]), int(texel[2]), int(texel[3])]))
	var image := Image.create_from_data(int(texture.width), int(texture.height), false, Image.FORMAT_RGBA8, bytes)
	return ImageTexture.create_from_image(image)

func draw_rects(item: Node2D, texture: Texture2D, rects: Array) -> void:
	for each in rects:
		item.draw_texture_rect_region(texture, rect2(each.rect), rect2(each.source), color4(each.modulate), each.transpose, each.clipUv)
`,
  fill: `		var t: Array = scene.canvasTransform
		viewport.canvas_transform = Transform2D(Vector2(t[0], t[1]), Vector2(t[2], t[3]), Vector2(t[4], t[5]))
		viewport.snap_2d_vertices_to_pixel = scene.snapVertices
		var canvas_modulate := CanvasModulate.new()
		canvas_modulate.color = color4(scene.canvasModulate)
		viewport.add_child(canvas_modulate)
		var item := Node2D.new()
		item.position = Vector2(scene.item.position[0], scene.item.position[1])
		item.rotation_degrees = scene.item.rotation
		item.scale = Vector2(scene.item.scale[0], scene.item.scale[1])
		item.modulate = color4(scene.item.modulate)
		item.self_modulate = color4(scene.item.selfModulate)
		item.texture_filter = FILTERS[scene.filter]
		item.texture_repeat = REPEATS[scene.repeat]
		var texture := texture_of(scene.texture)
		var rects: Array = scene.rects
		item.draw.connect(func() -> void: draw_rects(item, texture, rects))
		viewport.add_child(item)`,
});

/** The files beside the main script, keyed by their names in the project. */
export const canvasProjectFiles = (scenes) =>
  viewportProjectFiles(FILES, scenes, (scene) => ({
    texture: scene.texture,
    filter: scene.filter,
    repeat: scene.repeat,
    item: scene.item,
    rects: scene.rects,
    canvasTransform: scene.canvasTransform,
    canvasModulate: scene.canvasModulate,
    snapVertices: scene.snapVertices,
  }));

export const parseCanvasOutput = (stdout) => parseViewportOutput(stdout, LINE_PREFIX);
