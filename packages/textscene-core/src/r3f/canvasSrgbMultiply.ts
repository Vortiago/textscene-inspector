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
const CANVAS_SRGB_MULTIPLY = 'CANVAS_SRGB_MULTIPLY';

/** `defines` for such a material. It needs no per-consumer state, so one object serves. */
export const CANVAS_SRGB_DEFINES: Readonly<Record<string, string>> = { [CANVAS_SRGB_MULTIPLY]: '' };

type Chunk = 'map_fragment' | 'color_fragment';

/** `diffuseColor` set to `rgb` and to its alpha times `factor`'s. */
const assign = (rgb: string, factor: string) =>
  `diffuseColor = vec4( ${rgb}, diffuseColor.a * ${factor}.a );`;
const fromSrgb = (rgb: string) => `sRGBTransferEOTF( vec4( ${rgb}, 1.0 ) ).rgb`;
const toSrgb = 'sRGBTransferOETF( diffuseColor ).rgb';

/**
 * Each chunk's factor, the guard under which three's other chunk multiplies too, and the rgb it
 * writes there: the map chunk leaves the product in sRGB and the colour chunk decodes it. Each
 * guard is three's own, so `canvasSrgbMultiply.test.ts` fails on a release that changes one.
 */
const SRGB_MULTIPLY_CHUNKS: Readonly<
  Record<Chunk, { factor: string; otherChunkGuard: string; sharedRgb: string }>
> = {
  map_fragment: {
    factor: 'sampledDiffuseColor',
    otherChunkGuard: '#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )',
    sharedRgb: `${toSrgb} * sampledDiffuseColor.rgb`,
  },
  color_fragment: {
    factor: 'vColor',
    otherChunkGuard: '#ifdef USE_MAP',
    sharedRgb: fromSrgb('diffuseColor.rgb * vColor.rgb'),
  },
};

/**
 * Three's linear `diffuseColor *= factor;` in `chunk`, with the sRGB multiply beside it under the
 * define. A textured, vertex-coloured fragment encodes and decodes once.
 */
function srgbMultiplyEdit(chunk: Chunk): ChunkEdit<Chunk> {
  const { factor, otherChunkGuard, sharedRgb } = SRGB_MULTIPLY_CHUNKS[chunk];
  const three = `\tdiffuseColor *= ${factor};`;
  const whole = assign(fromSrgb(`${toSrgb} * ${factor}.rgb`), factor);
  const shared = assign(sharedRgb, factor);
  return {
    chunk,
    three,
    godot:
      `\t#ifdef ${CANVAS_SRGB_MULTIPLY}\n\t\t${otherChunkGuard}\n\t\t\t${shared}\n\t\t#else\n` +
      `\t\t\t${whole}\n\t\t#endif\n\t#else\n\t${three}\n\t#endif`,
  };
}

/** Each linear multiply in three's chunks: the texel, then the vertex colour. */
const CANVAS_SRGB_MULTIPLY_EDITS: readonly ChunkEdit<Chunk>[] = [
  srgbMultiplyEdit('map_fragment'),
  srgbMultiplyEdit('color_fragment'),
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
