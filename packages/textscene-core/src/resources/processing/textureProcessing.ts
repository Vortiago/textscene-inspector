/**
 * Re-export shim: the implementation moved into the image slice
 * (`resources/formats/image/textureProcessing.ts`, ADR-0031). Kept so the
 * `processing` barrel keeps one working module path.
 */

export * from '../formats/image/textureProcessing';
