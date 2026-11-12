import { describe, expect, it } from 'vitest';
import { engineMissingMessage, missingEngineTools } from './engineTools.mjs';

describe('missingEngineTools', () => {
  it('names no tool on a host that has both', () => {
    expect(missingEngineTools(() => true)).toEqual([]);
  });

  it('names each tool the PATH lacks', () => {
    expect(missingEngineTools((tool) => tool === 'godot')).toEqual(['xvfb-run']);
    expect(missingEngineTools(() => false)).toEqual(['godot', 'xvfb-run']);
  });
});

describe('engineMissingMessage', () => {
  it('names the command, the tools it expects and the ones it did not find', () => {
    expect(engineMissingMessage(['xvfb-run'])).toBe(
      'pnpm test:godot-ref renders through real Godot. Expected godot and xvfb-run on the PATH, found no xvfb-run.'
    );
  });
});
