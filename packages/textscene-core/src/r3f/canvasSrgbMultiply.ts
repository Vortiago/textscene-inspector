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

/** `diffuseColor` times `factor`, with both read as sRGB and the product decoded back to linear. */
const srgbProduct = (factor: string) =>
  `diffuseColor = vec4( sRGBTransferEOTF( vec4( sRGBTransferOETF( diffuseColor ).rgb * ${factor}.rgb, 1.0 ) ).rgb, diffuseColor.a * ${factor}.a );`;

/** Each linear multiply in three's chunks, with the sRGB multiply beside it under the define. */
export const CANVAS_SRGB_MULTIPLY_EDITS: readonly ChunkEdit<Chunk>[] = [
  {
    chunk: 'map_fragment',
    three: '\tdiffuseColor *= sampledDiffuseColor;',
    godot: `\t#ifdef ${CANVAS_SRGB_MULTIPLY}\n\t\t${srgbProduct('sampledDiffuseColor')}\n\t#else\n\t\tdiffuseColor *= sampledDiffuseColor;\n\t#endif`,
  },
  {
    chunk: 'color_fragment',
    three: '\tdiffuseColor *= vColor;',
    godot: `\t#ifdef ${CANVAS_SRGB_MULTIPLY}\n\t\t${srgbProduct('vColor')}\n\t#else\n\t\tdiffuseColor *= vColor;\n\t#endif`,
  },
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
