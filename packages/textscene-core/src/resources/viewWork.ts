import { createImmediateWorkCount, createWorkCount, type WorkCount } from './workCount.js';

/** The work a view waits on before it settles. Each view keeps its own, so views never wait on each other. */
export interface ViewWork {
  /** The loads its consumers wait on. */
  resources: WorkCount;
  /** The procedural textures it builds and the textures it uploads in tiles. */
  textures: WorkCount;
  /** The font loads it peeked, and the glyph bitmaps its text runs wait on. */
  fonts: WorkCount;
}

export function createViewWork(): ViewWork {
  return { resources: createImmediateWorkCount(), textures: createWorkCount(), fonts: createWorkCount() };
}
