import { describe, expect, it } from 'vitest';
import { WebGLPrograms } from 'three/src/renderers/webgl/WebGLPrograms.js';

/** three's own program key, which `materialProgramInputs` relies on to remount a material. */
function keyOf(defines: Record<string, string>): string {
  const programs = new WebGLPrograms(
    null as never,
    null as never,
    null as never,
    {} as never,
    null as never,
    null as never
  );
  return programs.getProgramCacheKey({ defines } as never);
}

describe('three program cache key', () => {
  it('separates two materials that differ only in a define (WebGLPrograms.js:426-431)', () => {
    expect(keyOf({ CANVAS_LINEAR_ATTRIBUTES: '' })).not.toBe(keyOf({}));
  });

  it('separates two materials that differ only in a define value', () => {
    expect(keyOf({ STEPS: '4' })).not.toBe(keyOf({ STEPS: '8' }));
  });
});
