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
  sceneFailure: null,
};
const REFUSING_FILE = {
  ...MISSING_FILE,
  sceneFailure: {
    line: `res://main.tscn - Parse Error: [ext_resource] referenced non-existent resource at: ${MISSING_PATH}.`,
    chain: [MISSING_PATH],
    cause: 'missing',
  },
};

const PASSING = {
  beforeView: [MISSING_FILE],
  settledKeys: ['scriptedNodeCount', 'hasCurrentCamera'],
  heard: [[], [MISSING_PATH], []],
  afterWrite: [],
  refused: [REFUSING_FILE],
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

  it('names a refused scene whose file row carries no failure of the scene', () => {
    expect(missingFileFailures({ ...PASSING, refused: [MISSING_FILE] })[0]).toMatch(
      /^missing files: scene\.files\(\) of a refused scene: expected/
    );
  });
});
