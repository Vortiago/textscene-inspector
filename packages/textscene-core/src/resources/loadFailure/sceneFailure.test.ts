import { describe, expect, it } from 'vitest';
import type { SceneFile } from '../../scene/sceneFiles';
import type { FailingFileRead } from './fileReads';
import { sceneFailureOf } from './sceneFailure';

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
    ...overrides,
  };
}

function missing(path: string): SceneFile {
  return row(path, { state: 'missing', reason: { chain: [path], cause: 'missing', addresses: [] } });
}

const failing = (reads: readonly FailingFileRead[]) => ({ scene: MAIN, reads, parseStop: null });

describe('sceneFailureOf', () => {
  it('names the first failing read whose file fails, with Godot line, chain and cause', () => {
    expect(sceneFailureOf([missing('res://gone.png')], failing([GONE]))).toEqual({
      line: `${MAIN}:7 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone.png.`,
      chain: ['res://gone.png'],
      cause: 'missing',
    });
  });

  it('names none when no failing read reaches a failed file', () => {
    expect(sceneFailureOf([row('res://gone.png')], failing([GONE]))).toBeNull();
  });

  it('names none while an earlier read still loads', () => {
    const first: FailingFileRead = { path: 'res://slow.png', kind: 'section ExtResource', uid: '', line: 5 };
    const files = [row('res://slow.png', { state: 'loading' }), missing('res://gone.png')];

    expect(sceneFailureOf(files, failing([first, GONE]))).toBeNull();
  });

  it('names the parse stop with no chain once every read before it loads', () => {
    const parseStop = {
      read: { kind: 'ExtResource', id: '99' },
      place: 'section',
      isOpeningTag: false,
      line: 9,
    } as const;

    expect(sceneFailureOf([row('res://gone.png')], { scene: MAIN, reads: [GONE], parseStop })).toEqual({
      line: `${MAIN}:9 - Parse Error: Can't load cached ext-resource id: 99.`,
      chain: [],
      cause: 'unparsed',
    });
  });
});
