/**
 * The resource slots whose `PROPERTY_HINT_RESOURCE_TYPE` hint excludes a class with a `-` prefix,
 * derived from Godot 4.6.3.stable.fedora.7d41c59c4's ClassDB captures.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm nodes:base-types
 *
 * Each entry is class → property → hint string, under the class that declares the property. A
 * reader finds an inherited slot by walking the base chain in `classBaseTypes`.
 */

export const RESOURCE_TYPE_EXCLUSIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  "CSGMesh3D": {
    "mesh": "Mesh,-PlaneMesh,-PointMesh,-QuadMesh,-RibbonTrailMesh",
  },
  "Decal": {
    "texture_albedo": "Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,-MeshTexture,-Texture2DRD,-ViewportTexture",
    "texture_emission": "Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,-MeshTexture,-Texture2DRD,-ViewportTexture",
    "texture_normal": "Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,-MeshTexture,-Texture2DRD,-ViewportTexture",
    "texture_orm": "Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,-MeshTexture,-Texture2DRD,-ViewportTexture",
  },
  "Light3D": {
    "light_projector": "Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,-MeshTexture,-Texture2DRD,-ViewportTexture",
  },
  "PointLight2D": {
    "texture": "Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,-MeshTexture,-Texture2DRD,-ViewportTexture",
  },
});
