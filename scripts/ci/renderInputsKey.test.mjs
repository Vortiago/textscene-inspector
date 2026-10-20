/** Which trees share a golden pass. */
import { describe, expect, it } from 'vitest';
import { renderInputsKey } from './renderInputsKey.mjs';

/** One `git ls-tree -r` line. */
const entry = (blob, path) => `100644 blob ${blob}\t${path}`;

const RENDERER = 'packages/textscene-core/src/r3f/TscnCanvas.tsx';

describe('renderInputsKey', () => {
  it('gives two trees the same key when only a file no golden reads differs', () => {
    const before = [entry('a1', 'README.md'), entry('b1', RENDERER)].join('\n');
    const after = [entry('a2', 'README.md'), entry('b1', RENDERER)].join('\n');
    expect(renderInputsKey(after)).toBe(renderInputsKey(before));
  });

  it('gives a new key when a file the goldens render through changes', () => {
    const before = entry('b1', RENDERER);
    const after = entry('b2', RENDERER);
    expect(renderInputsKey(after)).not.toBe(renderInputsKey(before));
  });

  it('gives a new key when a rendering file is added', () => {
    const before = entry('b1', RENDERER);
    const after = [entry('b1', RENDERER), entry('c1', 'scenes/fixtures/unit-new.tscn')].join('\n');
    expect(renderInputsKey(after)).not.toBe(renderInputsKey(before));
  });

  it('gives a new key when a rendering file moves', () => {
    const before = entry('b1', RENDERER);
    const after = entry('b1', 'packages/textscene-core/src/r3f/SceneCanvas.tsx');
    expect(renderInputsKey(after)).not.toBe(renderInputsKey(before));
  });

  it('is a SHA-256 in hex, safe in a cache key', () => {
    expect(renderInputsKey(entry('b1', RENDERER))).toMatch(/^[0-9a-f]{64}$/);
  });
});
