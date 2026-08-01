/**
 * Compatibility re-export: the decode moved to this slice's `decode.ts`
 * (ADR-0031) while consumers still import `parseCanvasItemMaterial` from here.
 * Removable once those importers point at `./decode`.
 */

export { decodeCanvasItemMaterial as parseCanvasItemMaterial } from './decode';
