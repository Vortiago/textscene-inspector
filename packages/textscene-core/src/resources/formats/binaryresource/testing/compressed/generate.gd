# Writes the RSCC fixtures beside it. Run from a Godot 4.6 project that holds this script:
# godot --headless --path . -s generate.gd
# ResourceSaver compresses with zstd only, so the other modes recompress its stream.
extends SceneTree


func _swap_magic(bytes: PackedByteArray, magic: String) -> PackedByteArray:
	# FileAccessCompressed writes its magic at the start and at the end.
	for at in [0, bytes.size() - 4]:
		for i in 4:
			bytes[at + i] = magic.unicode_at(i)
	return bytes


func _write(path: String, bytes: PackedByteArray) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_buffer(bytes)
	file.close()


func _stream_of(compressed_path: String) -> PackedByteArray:
	_write("res://stream.gcpf", _swap_magic(FileAccess.get_file_as_bytes(compressed_path), "GCPF"))
	var file := FileAccess.open_compressed("res://stream.gcpf", FileAccess.READ)
	var stream := file.get_buffer(file.get_length())
	file.close()
	return stream


func _recompress(stream: PackedByteArray, path: String, mode: int) -> void:
	var file := FileAccess.open_compressed("res://stream.gcpf", FileAccess.WRITE, mode)
	file.store_buffer(stream)
	file.close()
	_write(path, _swap_magic(FileAccess.get_file_as_bytes("res://stream.gcpf"), "RSCC"))


func _init() -> void:
	var box := BoxMesh.new()
	box.size = Vector3(1.5, 1.5, 1.5)
	box.subdivide_width = 6
	box.subdivide_height = 6
	box.subdivide_depth = 6
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, box.get_mesh_arrays())
	ResourceSaver.save(mesh, "res://mesh.res")
	ResourceSaver.save(mesh, "res://mesh_zstd.res", ResourceSaver.FLAG_COMPRESS)
	var stream := _stream_of("res://mesh_zstd.res")
	_recompress(stream, "res://mesh_fastlz.res", FileAccess.COMPRESSION_FASTLZ)
	_recompress(stream, "res://mesh_deflate.res", FileAccess.COMPRESSION_DEFLATE)
	_recompress(stream, "res://mesh_gzip.res", FileAccess.COMPRESSION_GZIP)
	DirAccess.remove_absolute(ProjectSettings.globalize_path("res://stream.gcpf"))
	quit()
