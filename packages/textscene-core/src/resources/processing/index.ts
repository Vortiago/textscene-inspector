/**
 * Resource processing functions.
 * Pure functions extracted from loaders for use with createResourceProcessor.
 *
 * Every member is now a re-export shim over a slice that owns the
 * implementation (ADR-0031). Fonts and themes are absent deliberately: their
 * slices (`resources/fonts/font/`, `resources/styles/theme/`) are imported
 * directly by their consumers, so no shim was ever needed for them.
 */

export * from './textureProcessing';
export * from './materialProcessing';
export * from './glbProcessing';
export * from './rootScale';
