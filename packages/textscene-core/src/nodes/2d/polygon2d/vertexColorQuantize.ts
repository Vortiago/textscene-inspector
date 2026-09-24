/**
 * Reproduces the byte Godot stores for a Polygon2D fill colour
 * (`scene/2d/polygon_2d.cpp:307-318`): the mesh upload (`scene/2d/polygon_2d.cpp:395`)
 * casts it to `uint8_t`, truncating (`servers/rendering/rendering_server.cpp:713-716`).
 * The shader reads that byte, so the loss precedes shading, lighting and blending.
 */

// Only Polygon2D fills pass this cast: ColorRect keeps a float modulate
// (`drivers/gles3/rasterizer_canvas_gles3.h:212`), and Line2D uploads GL_FLOAT
// colours (`drivers/gles3/rasterizer_canvas_gles3.cpp:2467-2469`).
export interface QuantizableColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Snaps one sRGB channel (0..1) to the byte Godot's upload stores, as a 0..1
 * float. `Math.fround` first: Godot's float32 `Color` channel widens to double
 * only for the `* 255.0`, so a value near a boundary truncates as Godot's does.
 */
export function quantizeVertexColorChannel(value: number): number {
  const asFloat32 = Math.fround(value);
  const scaled = asFloat32 * 255.0;
  const clamped = Math.min(255, Math.max(0, scaled));
  const truncated = Math.trunc(clamped);
  return truncated / 255;
}

/**
 * `quantizeVertexColorChannel` on all four channels. Never apply it to the
 * inherited tint: Polygon2D passes `Color(1, 1, 1)` as its own draw modulate
 * (`scene/2d/polygon_2d.cpp:401`), so the tint is a separate float multiply.
 */
export function quantizeVertexColor(color: QuantizableColor): QuantizableColor {
  return {
    r: quantizeVertexColorChannel(color.r),
    g: quantizeVertexColorChannel(color.g),
    b: quantizeVertexColorChannel(color.b),
    a: quantizeVertexColorChannel(color.a),
  };
}
