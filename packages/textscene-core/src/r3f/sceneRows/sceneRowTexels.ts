/**
 * The width of a row of the scene rows, in texels: a decal's, the widest, whose layout ends its row
 * (`decalRowLayout.ts`). A probe's row pads to it. This module imports nothing, so the row writers and
 * the chunk that reads the rows share it.
 */
export const SCENE_ROW_TEXELS = 14;
