/**
 * The resource properties whose value Godot types as `Array[T]` or `Dictionary[K, V]`, with the
 * prefix its text writer puts on the value, derived from Godot 4.6.3.stable.fedora.7d41c59c4's ClassDB captures.
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
  "OggPacketSequence": {
    "packet_data": "Array[Array]",
  },
});
