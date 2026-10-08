/** The path of a golden's baseline, and back. */
import { describe, expect, it } from 'vitest';
import { baselinePath, goldenNameOf } from './baselinePath.mjs';

describe('baselinePath', () => {
  it('places a golden under scripts/visual/baselines', () => {
    expect(baselinePath('glow-mix')).toBe('scripts/visual/baselines/glow-mix.png');
  });
});

describe('goldenNameOf', () => {
  it('names the golden of a baseline path', () => {
    expect(goldenNameOf('scripts/visual/baselines/glow-mix.png')).toBe('glow-mix');
  });

  it('gives null for a file outside the baselines', () => {
    expect(goldenNameOf('scripts/visual/scenes.mjs')).toBeNull();
  });

  it('gives null for a non-PNG file in the baselines', () => {
    expect(goldenNameOf('scripts/visual/baselines/README.md')).toBeNull();
  });

  it('gives null for a PNG in a directory under the baselines', () => {
    expect(goldenNameOf('scripts/visual/baselines/old/glow-mix.png')).toBeNull();
  });

  it('names the golden back from the path baselinePath gives it', () => {
    expect(goldenNameOf(baselinePath('sprite2d-region.flip'))).toBe('sprite2d-region.flip');
  });
});
