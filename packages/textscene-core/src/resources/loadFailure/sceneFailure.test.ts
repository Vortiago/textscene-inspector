import { describe, expect, it } from 'vitest';
import type { SceneFile } from '../../scene/sceneFiles';
import type { FailingFileRead } from './fileReads';
import { withSceneFailure } from './sceneFailure';

const MAIN = 'res://main.tscn';
const GONE: FailingFileRead = { path: 'res://gone.png', kind: 'section ExtResource', uid: '', line: 7 };

function row(path: string, overrides: Partial<SceneFile> = {}): SceneFile {
  return {
    path,
    type: null,
    state: 'loaded',
    owners: [MAIN],
    reason: null,
    addresses: [],
    sceneFailure: null,
    ...overrides,
  };
}

function missing(path: string): SceneFile {
  return row(path, { state: 'missing', reason: { chain: [path], cause: 'missing', addresses: [] } });
}

describe('withSceneFailure', () => {
  it('marks the row of the first failing read with Godot line, chain and cause', () => {
    const files = withSceneFailure([missing('res://gone.png')], MAIN, [GONE]);

    expect(files[0]!.sceneFailure).toEqual({
      line: `${MAIN}:7 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone.png.`,
      chain: ['res://gone.png'],
      cause: 'missing',
    });
  });

  it('returns the same rows when no failing read reaches a failed file', () => {
    const files = [row('res://gone.png')];

    expect(withSceneFailure(files, MAIN, [GONE])).toBe(files);
  });

  it('names no failure while an earlier read still loads', () => {
    const first: FailingFileRead = { path: 'res://slow.png', kind: 'section ExtResource', uid: '' };
    const files = [row('res://slow.png', { state: 'loading' }), missing('res://gone.png')];

    expect(withSceneFailure(files, MAIN, [first, GONE])).toBe(files);
  });
});
