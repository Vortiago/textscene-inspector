import { describe, expect, it } from 'vitest';
import { AnimationLoopMode } from '../scene/animation.js';
import { importedClip, type ClipImportOptions } from './animationImport.js';

const SUFFIXES_ON: ClipImportOptions = { useNameSuffixes: true, sidecarLoopModes: new Map() };
const SUFFIXES_OFF: ClipImportOptions = { useNameSuffixes: false, sidecarLoopModes: new Map() };

describe('importedClip, the loop mode the glTF importer set', () => {
  it('keeps LOOP_NONE and the name of a clip the glTF importer did not loop', () => {
    expect(importedClip({ name: 'walk', loops: false }, SUFFIXES_OFF)).toEqual({
      name: 'walk',
      loopMode: AnimationLoopMode.NONE,
    });
  });

  it('keeps LOOP_LINEAR and the name of a clip the glTF importer looped, when name suffixes are off', () => {
    expect(importedClip({ name: 'Walk_Loop', loops: true }, SUFFIXES_OFF)).toEqual({
      name: 'Walk_Loop',
      loopMode: AnimationLoopMode.LINEAR,
    });
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
    expect(importedClip({ name, loops: false }, SUFFIXES_ON)).toEqual({
      name: stripped,
      loopMode: AnimationLoopMode.LINEAR,
    });
  });

  it('loops a name that contains $loop mid-name and removes the marker', () => {
    expect(importedClip({ name: 'a$loopb', loops: false }, SUFFIXES_ON)).toEqual({
      name: 'ab',
      loopMode: AnimationLoopMode.LINEAR,
    });
  });

  it('loops Walk$LOOP and keeps its marker, because Godot removes the marker case-sensitively', () => {
    expect(importedClip({ name: 'Walk$LOOP', loops: false }, SUFFIXES_ON)).toEqual({
      name: 'Walk$LOOP',
      loopMode: AnimationLoopMode.LINEAR,
    });
  });

  it('leaves a plain name alone', () => {
    expect(importedClip({ name: 'walk', loops: false }, SUFFIXES_ON)).toEqual({
      name: 'walk',
      loopMode: AnimationLoopMode.NONE,
    });
  });
});

describe('importedClip, the sidecar entry', () => {
  it('replaces the mode of a clip with an entry under its final name', () => {
    const options = {
      useNameSuffixes: true,
      sidecarLoopModes: new Map([['Walk', AnimationLoopMode.PINGPONG]]),
    };
    expect(importedClip({ name: 'Walk_Loop', loops: true }, options)).toEqual({
      name: 'Walk',
      loopMode: AnimationLoopMode.PINGPONG,
    });
  });

  it('reads an entry without a loop mode as LOOP_NONE, even for a clip the glTF importer looped', () => {
    const options = {
      useNameSuffixes: false,
      sidecarLoopModes: new Map([['Walk_Loop', AnimationLoopMode.NONE]]),
    };
    expect(importedClip({ name: 'Walk_Loop', loops: true }, options).loopMode).toBe(AnimationLoopMode.NONE);
  });

  it('ignores an entry under a name the clip no longer has', () => {
    const options = {
      useNameSuffixes: true,
      sidecarLoopModes: new Map([['Walk_Loop', AnimationLoopMode.NONE]]),
    };
    expect(importedClip({ name: 'Walk_Loop', loops: true }, options).loopMode).toBe(AnimationLoopMode.LINEAR);
  });
});
