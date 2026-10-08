/**
 * Godot's canvas multiplies a texel, the vertex colour and the modulate as the sRGB numbers they are
 * stored as (`drivers/gles3/shaders/canvas.glsl:181,631,716`), since `hdr_2d` is off by default
 * (`rendering_server.cpp:3771`). three multiplies linear values, which differs by up to 4/255 where
 * two factors are not white. Under `CANVAS_SRGB_MULTIPLY`, a material multiplies in sRGB and decodes
 * the product once.
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from './shaderPatch/chunkPatch.js';

/**
 * The define a 2D canvas material sets when its `map` is tagged `NoColorSpace` and its vertex
 * colours, if any, hold sRGB numbers. Its `color` stays linear, as three uploads it.
 */
export const CANVAS_SRGB_MULTIPLY = 'CANVAS_SRGB_MULTIPLY';

/** `defines` for such a material. It needs no per-consumer state, so one object serves. */
export const CANVAS_SRGB_DEFINES: Readonly<Record<string, string>> = { [CANVAS_SRGB_MULTIPLY]: '' };

type Chunk = 'map_fragment' | 'color_fragment';

/** Three's linear `diffuseColor *= factor;` in `chunk`, with the sRGB multiply beside it under the define. */
function srgbMultiplyEdit(chunk: Chunk, factor: string): ChunkEdit<Chunk> {
  const product = `diffuseColor = vec4( sRGBTransferEOTF( vec4( sRGBTransferOETF( diffuseColor ).rgb * ${factor}.rgb, 1.0 ) ).rgb, diffuseColor.a * ${factor}.a );`;
  const three = `\tdiffuseColor *= ${factor};`;
  return {
    chunk,
    three,
    godot: `\t#ifdef ${CANVAS_SRGB_MULTIPLY}\n\t\t${product}\n\t#else\n\t${three}\n\t#endif`,
  };
}

/** Each linear multiply in three's chunks: the texel, then the vertex colour. */
export const CANVAS_SRGB_MULTIPLY_EDITS: readonly ChunkEdit<Chunk>[] = [
  srgbMultiplyEdit('map_fragment', 'sampledDiffuseColor'),
  srgbMultiplyEdit('color_fragment', 'vColor'),
];

/**
 * Patches three's chunks for every program compiled after the call. A three release that rewrites
 * the lines keeps its own chunks, and `canvasSrgbMultiply.test.ts` fails on that release. A second
 * call changes nothing.
 */
export function installCanvasSrgbMultiply(): void {
  installChunkPatch({
    names: ['map_fragment', 'color_fragment'],
    isApplied: (chunks) => chunks.map_fragment.includes(CANVAS_SRGB_MULTIPLY),
    apply: (chunks) => applyChunkEdits(chunks, CANVAS_SRGB_MULTIPLY_EDITS),
    missing: 'map_fragment or color_fragment has no linear multiply to replace',
  });
}
