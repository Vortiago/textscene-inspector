/**
 * Godot bakes a Polygon2D's fill — the flat `color` broadcast to every vertex
 * when `vertex_colors` is absent, or `vertex_colors` itself — into a
 * persistent `ArrayMesh`: `Polygon2D::_notification` builds a `Vector<Color>`
 * per vertex (`scene/2d/polygon_2d.cpp:307-318`) and uploads it through
 * `RS::mesh_create_surface_data_from_arrays`
 * (`scene/2d/polygon_2d.cpp:395`), which packs the `RS::ARRAY_COLOR`
 * attribute into 4 `uint8_t` lanes with a plain C-style cast
 * (`RenderingServer::_surface_set_data`,
 * `servers/rendering/rendering_server.cpp:713-716`):
 *
 *   dst[0] = uint8_t(CLAMP(src[i].r * 255.0, 0.0, 255.0));
 *
 * A C-style `double`→`uint8_t` cast TRUNCATES toward zero — it never rounds.
 * The polygon's own `color` never reaches the GPU as a float uniform: this
 * 8-bit vertex attribute IS the value the fragment shader reads, so whatever
 * this cast throws away is gone before shading, lighting or blending ever
 * run. (The item's inherited `modulate`/`self_modulate` tint is a SEPARATE
 * float multiply applied per draw call — Polygon2D hands `canvas_item_add_mesh`
 * a bare `Color(1, 1, 1)` for its own modulate parameter,
 * `scene/2d/polygon_2d.cpp:401` — so that tint is untouched by this cast and
 * must not be quantized here.)
 *
 * Measured against Godot 4.6.3 (`pnpm ref:godot --mode 2d`), confirming the
 * truncation (not rounding) at three independent colours:
 *   Color(0.08, 0.08, 0.10) → rgb(20, 20, 25)    — 0.10×255=25.5 → 25, not 26
 *   Color(0.85, 0.85, 0.80) → rgb(216, 216, 204) — 0.85×255=216.75 → 216, not 217
 *   Color(0.40, 0.90, 0.50) → rgb(102, 229, 127) — 0.90×255=229.5 → 229; 0.50×255=127.5 → 127
 *
 * Other 2D fills in this codebase's node inventory do NOT go through this
 * cast: `canvas_item_add_rect` (ColorRect) stores its modulate as 4 plain
 * floats in the GLES3 instance buffer
 * (`drivers/gles3/rasterizer_canvas_gles3.h:212`), and
 * `canvas_item_add_triangle_array` (Line2D) uploads its per-vertex colours as
 * `GL_FLOAT`, not a compressed attribute
 * (`drivers/gles3/rasterizer_canvas_gles3.cpp:2467-2469`) — both stay full
 * float until the single ordinary quantization at the final framebuffer
 * write, which is why only Polygon2D needs this extra step.
 */

export interface QuantizableColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Snap one sRGB channel (0..1) to the 8-bit value Godot's vertex-color
 * upload actually stores, expressed back as a 0..1 float so it composes with
 * the rest of the (still-continuous) colour pipeline unchanged.
 *
 * Godot's `Color` channels are 32-bit floats (`real_t` in a single-precision
 * build), promoted to `double` only for the `* 255.0` multiply — `Math.fround`
 * reproduces that narrowing before the multiply so a literal that lands just
 * above or below an integer boundary in double precision, but not in float32,
 * truncates the way Godot's does.
 */
export function quantizeVertexColorChannel(value: number): number {
  const asFloat32 = Math.fround(value);
  const scaled = asFloat32 * 255.0;
  const clamped = Math.min(255, Math.max(0, scaled));
  const truncated = Math.trunc(clamped);
  return truncated / 255;
}

/** `quantizeVertexColorChannel` applied to all four channels of a Color. */
export function quantizeVertexColor(color: QuantizableColor): QuantizableColor {
  return {
    r: quantizeVertexColorChannel(color.r),
    g: quantizeVertexColorChannel(color.g),
    b: quantizeVertexColorChannel(color.b),
    a: quantizeVertexColorChannel(color.a),
  };
}
