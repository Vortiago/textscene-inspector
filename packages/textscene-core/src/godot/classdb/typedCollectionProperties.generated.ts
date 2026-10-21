/**
 * The resource properties whose value Godot types as `Array[T]` or `Dictionary[K, V]`, with the
 * prefix its text writer puts on the value, derived from Godot 4.6.3.stable.fedora.7d41c59c4's getter captures.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm nodes:base-types
 *
 * Each entry is class → property → prefix, under the class that declares the property. A reader
 * finds an inherited property by walking the base chain in `classBaseTypes`.
 */

export const TYPED_COLLECTION_PROPERTIES: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  "Compositor": {
    "compositor_effects": "Array[CompositorEffect]",
  },
  "Font": {
    "fallbacks": "Array[Font]",
  },
  "GLTFMesh": {
    "instance_materials": "Array[Material]",
  },
  "GLTFSkeleton": {
    "unique_names": "Array[String]",
  },
  "GLTFSkin": {
    "inverse_binds": "Array[Transform3D]",
  },
  "GLTFState": {
    "accessors": "Array[GLTFAccessor]",
    "animations": "Array[GLTFAnimation]",
    "buffer_views": "Array[GLTFBufferView]",
    "buffers": "Array[PackedByteArray]",
    "cameras": "Array[GLTFCamera]",
    "images": "Array[Texture2D]",
    "lights": "Array[GLTFLight]",
    "materials": "Array[Material]",
    "meshes": "Array[GLTFMesh]",
    "nodes": "Array[GLTFNode]",
    "skeletons": "Array[GLTFSkeleton]",
    "skins": "Array[GLTFSkin]",
    "texture_samplers": "Array[GLTFTextureSampler]",
    "textures": "Array[GLTFTexture]",
    "unique_animation_names": "Array[String]",
    "unique_names": "Array[String]",
  },
  "ImageTexture3D": {
    "_images": "Array[Image]",
  },
  "ImageTextureLayered": {
    "_images": "Array[Image]",
  },
  "LightmapGIData": {
    "lightmap_textures": "Array[TextureLayered]",
    "shadowmask_textures": "Array[TextureLayered]",
  },
  "NavigationMeshSourceGeometryData2D": {
    "obstruction_outlines": "Array[PackedVector2Array]",
    "traversable_outlines": "Array[PackedVector2Array]",
  },
  "NavigationPolygon": {
    "outlines": "Array[PackedVector2Array]",
    "polygons": "Array[PackedInt32Array]",
  },
  "OggPacketSequence": {
    "packet_data": "Array[Array]",
  },
});
