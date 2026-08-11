/**
 * Compatibility re-export: the blend state moved to this slice's `build.ts`
 * (ADR-0031) while the 2D components still import it from here. Removable once
 * those importers point at `./build`.
 */

export { canvasItemBlendState, type CanvasItemBlendState } from './build';
