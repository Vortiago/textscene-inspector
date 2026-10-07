/**
 * Reproduces the byte Godot stores for a Polygon2D fill colour (`scene/2d/polygon_2d.cpp:307-318`):
 * the mesh upload (`scene/2d/polygon_2d.cpp:395`) casts it to `uint8_t`, truncating
 * (`servers/rendering/rendering_server.cpp:713-716`). The shader reads that byte, so the loss
 * precedes shading, lighting and blending.
 */

import { unitByte } from '../../../godot/unitByte';

export interface QuantizableColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Snaps one sRGB channel (0..1) to the byte Godot's upload stores, as a 0..1 float. */
export function quantizeVertexColorChannel(value: number): number {
  return unitByte(value);
}

/**
 * `quantizeVertexColorChannel` on all four channels. Never apply it to the inherited tint:
 * Polygon2D passes `Color(1, 1, 1)` as its own draw modulate (`scene/2d/polygon_2d.cpp:401`), so
 * the tint is a separate float multiply. Only Polygon2D fills pass this cast
 * (`vertexColorQuantize.md`).
 */
export function quantizeVertexColor(color: QuantizableColor): QuantizableColor {
  return {
    r: quantizeVertexColorChannel(color.r),
    g: quantizeVertexColorChannel(color.g),
    b: quantizeVertexColorChannel(color.b),
    a: quantizeVertexColorChannel(color.a),
  };
}
