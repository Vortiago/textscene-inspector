import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyChunkEdits, installChunkPatch, onChunk, type ChunkPatch } from './chunkPatch';
import { warningsOf } from '../testing/logWarnings';

const CHUNK = 'alphatest_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
});

/** A patch of the test chunk that swaps `from` for `to`. */
function swapPatch(from: string, to: string): ChunkPatch<typeof CHUNK> {
  return {
    names: [CHUNK],
    isApplied: (chunks) => chunks[CHUNK].includes(to),
    apply: (chunks) => applyChunkEdits(chunks, [{ chunk: CHUNK, three: from, godot: to }]),
    missing: `${CHUNK} has no ${from}`,
  };
}

describe('applyChunkEdits', () => {
  it('replaces each edit’s text in its chunk, in order', () => {
    const patched = applyChunkEdits({ [CHUNK]: 'a b' }, [
      { chunk: CHUNK, three: 'a', godot: 'c' },
      { chunk: CHUNK, three: 'c b', godot: 'd' },
    ]);
    expect(patched).toEqual({ [CHUNK]: 'd' });
  });

  it('keeps a `$` in the replacement literal (edge case)', () => {
    const patched = applyChunkEdits({ [CHUNK]: 'a' }, [{ chunk: CHUNK, three: 'a', godot: "$&$'" }]);
    expect(patched![CHUNK]).toBe("$&$'");
  });

  it('is null for a text missing from its chunk (error case)', () => {
    expect(applyChunkEdits({ [CHUNK]: 'a' }, [{ chunk: CHUNK, three: 'b', godot: 'c' }])).toBeNull();
  });

  it('is null for a text that occurs twice (error case)', () => {
    expect(applyChunkEdits({ [CHUNK]: 'a a' }, [{ chunk: CHUNK, three: 'a', godot: 'c' }])).toBeNull();
  });
});

describe('onChunk', () => {
  it('applies a patch of one chunk’s text to the record', () => {
    expect(onChunk(CHUNK, (chunk) => `${chunk}!`)({ [CHUNK]: 'a' })).toEqual({ [CHUNK]: 'a!' });
  });

  it('is null when the patch is null (error case)', () => {
    expect(onChunk(CHUNK, () => null)({ [CHUNK]: 'a' })).toBeNull();
  });
});

describe('installChunkPatch', () => {
  it('writes the patched chunk into three and is true', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    expect(installChunkPatch(swapPatch('one', 'two'))).toBe(true);
    expect(THREE.ShaderChunk[CHUNK]).toBe('two');
  });

  it('is true and changes nothing for a chunk that already holds the patch (edge case)', () => {
    THREE.ShaderChunk[CHUNK] = 'two one';
    const warnings = warningsOf(() => {
      expect(installChunkPatch(swapPatch('one', 'two'))).toBe(true);
    });
    expect(warnings).toEqual([]);
    expect(THREE.ShaderChunk[CHUNK]).toBe('two one');
  });

  it('leaves the chunk alone, warns and is false when three lacks the text (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'three';
    let installed = true;
    const warnings = warningsOf(() => {
      installed = installChunkPatch(swapPatch('one', 'two'));
    });
    expect(installed).toBe(false);
    expect(warnings).toEqual([`[Shading] three's ${CHUNK} has no one`]);
    expect(THREE.ShaderChunk[CHUNK]).toBe('three');
  });
});
