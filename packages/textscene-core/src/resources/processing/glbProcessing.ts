/**
 * Re-export shim: the implementation moved into the GLB slice
 * (`resources/formats/glb/glbProcessing.ts`, ADR-0031). Kept so consumers
 * outside the slice — `useResource`, the r3f GLB hooks, the `processing`
 * barrel — keep one working module path.
 */

export * from '../formats/glb/glbProcessing';
