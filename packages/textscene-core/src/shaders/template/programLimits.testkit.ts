/** WebGL 2's lowest `MAX_TEXTURE_IMAGE_UNITS` and `MAX_VERTEX_TEXTURE_IMAGE_UNITS`. */
export const MIN_SAMPLERS = 16;

/** WebGL 2's lowest `MAX_FRAGMENT_UNIFORM_BLOCKS` and `MAX_VERTEX_UNIFORM_BLOCKS`. */
export const MIN_UNIFORM_BLOCKS = 12;

/**
 * A device's count, not SwiftShader's 32: the test counts the declarations, not a link.
 * @canonical count the samplers a generated GLSL stage declares
 */
export function samplersOf(stage: string): number {
  return stage.match(/^\s*uniform\s+[iu]?sampler\w+\s+\w+;/gm)?.length ?? 0;
}

/** @canonical count the uniform blocks a generated GLSL stage declares */
export function uniformBlocksOf(stage: string): number {
  return stage.match(/^\s*(?:layout\s*\([^)]*\)\s*)?uniform\s+\w+\s*\{/gm)?.length ?? 0;
}
