import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyChunkEdits, applyEdits, installChunkPatch, onChunk, type ChunkPatch } from './chunkPatch';
import { warningsOf } from '../testing/logWarnings';

const CHUNK = 'alphatest_fragment';
const REQUIRED_CHUNK = 'alphamap_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];
const threeRequiredChunk = THREE.ShaderChunk[REQUIRED_CHUNK];
const threeBasicShader = THREE.ShaderLib.basic.fragmentShader;

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
  THREE.ShaderChunk[REQUIRED_CHUNK] = threeRequiredChunk;
  THREE.ShaderLib.basic.fragmentShader = threeBasicShader;
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

describe('applyEdits', () => {
  it('replaces each edit’s text, in order', () => {
    expect(
      applyEdits('a b', [
        { three: 'a', godot: 'c' },
        { three: 'c b', godot: 'd' },
      ])
    ).toBe('d');
  });

  it('is null for a text that a later edit lacks (error case)', () => {
    expect(
      applyEdits('a', [
        { three: 'a', godot: 'c' },
        { three: 'a', godot: 'd' },
      ])
    ).toBeNull();
  });

  it('is the text itself for no edits (edge case)', () => {
    expect(applyEdits('a', [])).toBe('a');
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

  it("writes a program's fragment shader edits with the chunks", () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderLib.basic.fragmentShader = 'basic';
    installChunkPatch({
      ...swapPatch('one', 'two'),
      fragmentShaders: { basic: [{ three: 'basic', godot: 'godot' }] },
    });
    expect(THREE.ShaderLib.basic.fragmentShader).toBe('godot');
  });

  it("leaves the chunks alone and warns when a program lacks an edit's text (error case)", () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    const patch = {
      ...swapPatch('one', 'two'),
      fragmentShaders: { basic: [{ three: 'absent', godot: 'godot' }] },
    };
    expect(warningsOf(() => installChunkPatch(patch))).toEqual([`[Shading] three's ${CHUNK} has no one`]);
    expect(THREE.ShaderChunk[CHUNK]).toBe('one');
  });

  it('installs once each chunk holds the text of a patch it requires', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    THREE.ShaderChunk[REQUIRED_CHUNK] = 'earlier patch';
    expect(installChunkPatch({ ...swapPatch('one', 'two'), requires: { [REQUIRED_CHUNK]: 'earlier' } })).toBe(
      true
    );
  });

  it('leaves the chunks alone and names the chunk that lacks a required patch (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'one';
    const patch = { ...swapPatch('one', 'two'), requires: { [REQUIRED_CHUNK]: 'earlier' } };
    expect(warningsOf(() => installChunkPatch(patch))).toEqual([
      `[Shading] the patch of ${CHUNK} reads a patch missing from ${REQUIRED_CHUNK}`,
    ]);
    expect(THREE.ShaderChunk[CHUNK]).toBe('one');
  });
});
