import { parseViewportOutput, viewportProjectFiles, viewportScript } from './godotViewports.mjs';

const LINE_PREFIX = 'CANVAS ';
const FILES = { dataFile: 'canvases.json', shaderPrefix: 'canvas' };

/** One item in each viewport that draws the scene's commands with no material, by the scene's kind. */
export const CANVAS_MAIN_SCRIPT = viewportScript({
  dataFile: FILES.dataFile,
  linePrefix: LINE_PREFIX,
  functions: `
const FILTERS := {"nearest": CanvasItem.TEXTURE_FILTER_NEAREST, "linear": CanvasItem.TEXTURE_FILTER_LINEAR}
const REPEATS := {"disabled": CanvasItem.TEXTURE_REPEAT_DISABLED, "enabled": CanvasItem.TEXTURE_REPEAT_ENABLED, "mirror": CanvasItem.TEXTURE_REPEAT_MIRROR}
const PRIMITIVES := {"points": Mesh.PRIMITIVE_POINTS, "lines": Mesh.PRIMITIVE_LINES, "triangles": Mesh.PRIMITIVE_TRIANGLES, "triangle_strip": Mesh.PRIMITIVE_TRIANGLE_STRIP}
const AXIS_MODES := {"stretch": RenderingServer.NINE_PATCH_STRETCH, "tile": RenderingServer.NINE_PATCH_TILE, "tile_fit": RenderingServer.NINE_PATCH_TILE_FIT}

func color4(values: Array) -> Color:
	return Color(values[0], values[1], values[2], values[3])

func rect2(values: Array) -> Rect2:
	return Rect2(values[0], values[1], values[2], values[3])

func vector2s(values: Array) -> PackedVector2Array:
	var vectors := PackedVector2Array()
	for each in values:
		vectors.append(Vector2(each[0], each[1]))
	return vectors

func colors(values: Array) -> PackedColorArray:
	var packed := PackedColorArray()
	for each in values:
		packed.append(color4(each))
	return packed

func texture_of(texture: Dictionary) -> ImageTexture:
	var bytes := PackedByteArray()
	for texel in texture.texels:
		bytes.append_array(PackedByteArray([int(texel[0]), int(texel[1]), int(texel[2]), int(texel[3])]))
	var image := Image.create_from_data(int(texture.width), int(texture.height), false, Image.FORMAT_RGBA8, bytes)
	return ImageTexture.create_from_image(image)

func draw_rects(item: Node2D, texture: Texture2D, rects: Array) -> void:
	for each in rects:
		item.draw_texture_rect_region(texture, rect2(each.rect), rect2(each.source), color4(each.modulate), each.transpose, each.clipUv)

func draw_primitives(item: Node2D, texture: Texture2D, primitives: Array) -> void:
	for each in primitives:
		item.draw_primitive(vector2s(each.points), colors(each.colors), vector2s(each.uvs), texture)

func draw_nine_patch(item: Node2D, texture: Texture2D, patch: Dictionary) -> void:
	var margins: Array = patch.margins
	var rid: RID = texture.get_rid() if patch.isTextured else RID()
	RenderingServer.canvas_item_add_nine_patch(item.get_canvas_item(), rect2(patch.rect), rect2(patch.source), rid, Vector2(margins[0], margins[1]), Vector2(margins[2], margins[3]), AXIS_MODES[patch.axisX], AXIS_MODES[patch.axisY], patch.drawsCenter, color4(patch.modulate))

func polygon_node(polygon: Dictionary, texture: Texture2D) -> Polygon2D:
	var node := Polygon2D.new()
	node.polygon = vector2s(polygon.points)
	node.vertex_colors = colors(polygon.colors)
	node.color = color4(polygon.color)
	if polygon.isTextured:
		node.texture = texture
		node.uv = vector2s(polygon.uvs)
	return node

func mesh_node(surface: Dictionary, texture: Texture2D, is_textured: bool) -> MeshInstance2D:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vector2s(surface.vertices)
	if surface.colors.size() > 0:
		arrays[Mesh.ARRAY_COLOR] = colors(surface.colors)
	if surface.uvs.size() > 0:
		arrays[Mesh.ARRAY_TEX_UV] = vector2s(surface.uvs)
	if surface.indices != null:
		arrays[Mesh.ARRAY_INDEX] = PackedInt32Array(surface.indices)
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(PRIMITIVES[surface.primitive], arrays)
	var node := MeshInstance2D.new()
	node.mesh = mesh
	if is_textured:
		node.texture = texture
	return node

func canvas_item_of(scene: Dictionary, texture: Texture2D) -> Node2D:
	match scene.kind:
		"polygon":
			return polygon_node(scene.polygon, texture)
		"mesh":
			return mesh_node(scene.surface, texture, scene.isTextured)
	var item := Node2D.new()
	match scene.kind:
		"rect":
			item.draw.connect(func() -> void: draw_rects(item, texture, scene.rects))
		"primitive":
			var textured: Texture2D = texture if scene.isTextured else null
			item.draw.connect(func() -> void: draw_primitives(item, textured, scene.primitives))
		"ninepatch":
			item.draw.connect(func() -> void: draw_nine_patch(item, texture, scene.patch))
		"drawPolygon":
			var drawn: Texture2D = texture if scene.polygon.isTextured else null
			var polygon: Dictionary = scene.polygon
			item.draw.connect(func() -> void: item.draw_polygon(vector2s(polygon.points), colors(polygon.colors), vector2s(polygon.uvs), drawn))
	return item
`,
  fill: `		var t: Array = scene.canvasTransform
		viewport.canvas_transform = Transform2D(Vector2(t[0], t[1]), Vector2(t[2], t[3]), Vector2(t[4], t[5]))
		viewport.snap_2d_vertices_to_pixel = scene.snapVertices
		viewport.use_hdr_2d = scene.linear
		var canvas_modulate := CanvasModulate.new()
		canvas_modulate.color = color4(scene.canvasModulate)
		viewport.add_child(canvas_modulate)
		var item := canvas_item_of(scene, texture_of(scene.texture))
		item.position = Vector2(scene.item.position[0], scene.item.position[1])
		item.rotation_degrees = scene.item.rotation
		item.scale = Vector2(scene.item.scale[0], scene.item.scale[1])
		item.modulate = color4(scene.item.modulate)
		item.self_modulate = color4(scene.item.selfModulate)
		item.texture_filter = FILTERS[scene.filter]
		item.texture_repeat = REPEATS[scene.repeat]
		viewport.add_child(item)`,
});

/** The fields of a scene the Godot script reads, past the viewport's. */
const SCENE_FIELDS = [
  'kind',
  'texture',
  'filter',
  'repeat',
  'item',
  'rects',
  'primitives',
  'isTextured',
  'polygon',
  'surface',
  'patch',
  'canvasTransform',
  'canvasModulate',
  'snapVertices',
  'linear',
];

/** The files beside the main script, keyed by their names in the project. */
export const canvasProjectFiles = (scenes) =>
  viewportProjectFiles(FILES, scenes, (scene) =>
    Object.fromEntries(SCENE_FIELDS.filter((field) => field in scene).map((field) => [field, scene[field]]))
  );

export const parseCanvasOutput = (stdout) => parseViewportOutput(stdout, LINE_PREFIX);
