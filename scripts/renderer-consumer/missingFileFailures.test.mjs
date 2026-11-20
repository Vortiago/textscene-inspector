import { describe, expect, it } from 'vitest';
import { missingFileFailures } from './missingFileFailures.mjs';

const MISSING_PATH = 'res://missing.png';
const MISSING_FILE = {
  path: MISSING_PATH,
  type: 'Texture2D',
  state: 'missing',
  owners: ['res://main.tscn'],
  reason: { chain: [MISSING_PATH], cause: 'missing', addresses: [] },
  addresses: [],
};

const PASSING = {
  beforeView: [MISSING_FILE],
  settledKeys: ['scriptedNodeCount', 'hasCurrentCamera'],
  heard: [[], [MISSING_PATH], []],
  afterWrite: [],
};

describe('missingFileFailures', () => {
  it('finds nothing wrong with results that meet every check', () => {
    expect(missingFileFailures(PASSING)).toEqual([]);
  });

  it('names a scene that gives no missing file before a view mounts', () => {
    expect(missingFileFailures({ ...PASSING, beforeView: [] })[0]).toMatch(
      /^missing files: scene\.files\(\) before a view: expected/
    );
  });

  it('names a settled value that still carries the missing files', () => {
    const settledKeys = ['scriptedNodeCount', 'hasCurrentCamera', 'missingFiles'];
    expect(missingFileFailures({ ...PASSING, settledKeys })).toEqual([
      'missing files: the keys of settled: expected ["scriptedNodeCount","hasCurrentCamera"], got ["scriptedNodeCount","hasCurrentCamera","missingFiles"]',
    ]);
  });

  it('names a subscribe that never heard the missing file', () => {
    expect(missingFileFailures({ ...PASSING, heard: [[]] })).toEqual([
      'missing files: subscribe: expected a notice that sees res://missing.png, got [[]]',
    ]);
  });

  it('names a last subscribe notice that still sees the file after the write', () => {
    expect(missingFileFailures({ ...PASSING, heard: [[], [MISSING_PATH]] })).toEqual([
      'missing files: the last subscribe notice: expected [], got ["res://missing.png"]',
    ]);
  });

  it('names a file that stays after the write that stops reading it', () => {
    expect(missingFileFailures({ ...PASSING, afterWrite: [MISSING_PATH] })).toEqual([
      'missing files: scene.files() after texture = null: expected [], got ["res://missing.png"]',
    ]);
  });
});
