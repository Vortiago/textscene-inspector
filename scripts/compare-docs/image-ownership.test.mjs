/**
 * One image, one owner. `recapture.mjs` and `capture-complex.mjs` both write
 * `docs/comparison/images/<image>-godot.png`, but a complex scene needs the
 * per-scene settings in COMPLEX_SCENES. Rendered with recapture's defaults, it
 * silently replaces the right frame with a wrong one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPLEX_SCENES } from './capture-complex.mjs';
import { partitionTargets } from './recapture/targets.mjs';

const COMPLEX_SLUGS = COMPLEX_SCENES.map((c) => c.slug);

function targetsOf(...images) {
  return images.map((image) => ({ image, fixture: `${image}.tscn` }));
}

describe('comparison image ownership', () => {
  it('never renders a capture-complex slug through recapture defaults', () => {
    const { own, delegated } = partitionTargets(targetsOf(...COMPLEX_SLUGS));
    expect(own).toEqual([]);
    expect(delegated.map((t) => t.image).sort()).toEqual([...COMPLEX_SLUGS].sort());
  });

  it('keeps ordinary sheet images for recapture itself', () => {
    const { own, delegated } = partitionTargets(targetsOf('unit-rigidbody3d', 'unit-decal'));
    expect(own.map((t) => t.image)).toEqual(['unit-rigidbody3d', 'unit-decal']);
    expect(delegated).toEqual([]);
  });

  it('splits a mixed batch rather than dropping either side', () => {
    const mixed = targetsOf('unit-decal', COMPLEX_SLUGS[0], 'unit-rigidbody3d');
    const { own, delegated } = partitionTargets(mixed);
    expect(own.map((t) => t.image)).toEqual(['unit-decal', 'unit-rigidbody3d']);
    expect(delegated.map((t) => t.image)).toEqual([COMPLEX_SLUGS[0]]);
    expect(own.length + delegated.length).toBe(mixed.length);
  });

  it('gives every complex scene a distinct slug, so ownership is unambiguous', () => {
    expect(new Set(COMPLEX_SLUGS).size).toBe(COMPLEX_SLUGS.length);
  });
});

/**
 * How an owner writes: `settleCanvas` accepts two matching screenshots, and two
 * reads of a dead WebGL context match too. A publishing harness has no diff to
 * catch the blank frame, so `writeCaptureImage` guards it, and a raw
 * `writeFileSync` into the images directory is the bypass.
 */
describe('every published image goes through the guarded writer', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  // The modules that actually hold the write, not the CLI entry points that
  // delegate to them.
  const WRITERS = [
    'recapture/oursSide.mjs',
    'capture/oursSide.mjs',
    'capture-complex.mjs',
  ];

  it.each(WRITERS)('%s writes captures through writeCaptureImage', (file) => {
    expect(readFileSync(join(here, file), 'utf8')).toContain('writeCaptureImage(');
  });

  it.each(WRITERS)('%s never writes an image path with a raw writeFileSync', (file) => {
    const raw = readFileSync(join(here, file), 'utf8')
      .split('\n')
      .filter((line) => /writeFileSync\(/.test(line))
      .filter((line) => /IMAGES|imgPath|imagePath|-ours|-godot/.test(line));
    expect(raw).toEqual([]);
  });

  /**
   * The cause: the first WebGL context in a fresh SwiftShader process can die
   * under load, so it is spent on a throwaway page.
   */
  it.each([...WRITERS, 'animation/previewFrames.mjs'])('%s warms up GL before capturing', (file) => {
    expect(readFileSync(join(here, file), 'utf8')).toContain('await warmUpGLContext(browser)');
  });
});
