import { describe, expect, it } from 'vitest';
import { AnimationLoopMode } from '../scene/animation.js';
import { importedClips, type ClipImportOptions } from './animationImport.js';

const SUFFIXES_ON: ClipImportOptions = { useNameSuffixes: true, sidecarLoopModes: new Map() };
const SUFFIXES_OFF: ClipImportOptions = { useNameSuffixes: false, sidecarLoopModes: new Map() };

function importedClip(name: string, options: ClipImportOptions) {
  return importedClips([name], options)[0]!;
}

describe('importedClip, the glTF name rule', () => {
  it('imports a clip with a plain name as LOOP_NONE', () => {
    expect(importedClip('walk', SUFFIXES_OFF)).toEqual({ name: 'walk', loopMode: AnimationLoopMode.NONE });
  });

  it.each(['Walk_Loop', 'loopWalk', 'run-cycle', 'CycleRun'])(
    'loops %s, which begins or ends with loop or cycle',
    (name) => {
      expect(importedClip(name, SUFFIXES_OFF).loopMode).toBe(AnimationLoopMode.LINEAR);
    }
  );

  it('keeps the name of a looping clip when name suffixes are off', () => {
    expect(importedClip('Walk_Loop', SUFFIXES_OFF).name).toBe('Walk_Loop');
  });

  it('does not loop a name that only contains loop', () => {
    expect(importedClip('a_loop_b', SUFFIXES_OFF).loopMode).toBe(AnimationLoopMode.NONE);
  });
});

describe('importedClip, the name suffix rule', () => {
  it.each([
    ['Walk_Loop', 'Walk'],
    ['run-cycle', 'run'],
    ['walk_loop_mode', 'walk'],
    ['walk$loop', 'walk'],
    ['walk_loop_001', 'walk_001'],
  ])('strips the suffix of %s to %s and loops it', (name, stripped) => {
    expect(importedClip(name, SUFFIXES_ON)).toEqual({ name: stripped, loopMode: AnimationLoopMode.LINEAR });
  });

  it('loops a name that contains $loop mid-name and removes the marker', () => {
    expect(importedClip('a$loopb', SUFFIXES_ON)).toEqual({ name: 'ab', loopMode: AnimationLoopMode.LINEAR });
  });

  it('leaves a plain name alone', () => {
    expect(importedClip('walk', SUFFIXES_ON)).toEqual({ name: 'walk', loopMode: AnimationLoopMode.NONE });
  });
});

describe('importedClip, the sidecar entry', () => {
  it('replaces the mode of a clip with an entry under its final name', () => {
    const options = {
      useNameSuffixes: true,
      sidecarLoopModes: new Map([['Walk', AnimationLoopMode.PINGPONG]]),
    };
    expect(importedClip('Walk_Loop', options)).toEqual({
      name: 'Walk',
      loopMode: AnimationLoopMode.PINGPONG,
    });
  });

  it('reads an entry without a loop mode as LOOP_NONE, even for a name that loops', () => {
    const options = {
      useNameSuffixes: false,
      sidecarLoopModes: new Map([['Walk_Loop', AnimationLoopMode.NONE]]),
    };
    expect(importedClip('Walk_Loop', options).loopMode).toBe(AnimationLoopMode.NONE);
  });

  it('ignores an entry under a name the clip no longer has', () => {
    const options = {
      useNameSuffixes: true,
      sidecarLoopModes: new Map([['Walk_Loop', AnimationLoopMode.NONE]]),
    };
    expect(importedClip('Walk_Loop', options).loopMode).toBe(AnimationLoopMode.LINEAR);
  });
});

describe('importedClips, the name Godot gives a clip', () => {
  it.each([
    ['idle_root.001', 'idle_root_001'],
    ['a:b', 'a_b'],
    ['a/b', 'a_b'],
    ['a,b', 'a_b'],
    ['a[b', 'a_b'],
  ])('replaces the characters of %s that an animation name cannot carry', (name, sanitised) => {
    expect(importedClip(name, SUFFIXES_OFF).name).toBe(sanitised);
  });

  it('numbers a name another clip already took, from 2 and with no separator', () => {
    const names = importedClips(['walk', 'walk', 'walk'], SUFFIXES_OFF).map((clip) => clip.name);
    expect(names).toEqual(['walk', 'walk2', 'walk3']);
  });

  it('applies the name rule to the name the glTF wrote, before the replacement', () => {
    expect(importedClip('loop.001', SUFFIXES_OFF)).toEqual({
      name: 'loop_001',
      loopMode: AnimationLoopMode.LINEAR,
    });
  });

  it('reads a sidecar entry under the replaced name', () => {
    const options = {
      useNameSuffixes: false,
      sidecarLoopModes: new Map([['idle_root_001', AnimationLoopMode.LINEAR]]),
    };
    expect(importedClip('idle_root.001', options).loopMode).toBe(AnimationLoopMode.LINEAR);
  });
});
