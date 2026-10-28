import { describe, expect, it } from 'vitest';
import {
  NOTHING_CACHED,
  answeredOnce,
  keptWhileAnswered,
  recordingReads,
  type CacheSource,
} from './cacheSources.js';

const answering = (entries: Record<string, string | null>) => ({
  getCached: (path: string) => entries[path],
});

describe('recordingReads', () => {
  it('passes each answer through and reports each path it read', () => {
    const reads: string[] = [];
    const cache = recordingReads(answering({ 'res://a.tscn': 'a' }), (path) => reads.push(path));
    expect(cache.getCached('res://a.tscn')).toBe('a');
    expect(cache.getCached('res://gone.tscn')).toBeUndefined();
    expect(reads).toEqual(['res://a.tscn', 'res://gone.tscn']);
  });

  it('hands each answer to the reader with its path', () => {
    const answers: [string, string | null | undefined][] = [];
    const cache = recordingReads(
      answering({ 'res://a.tscn': 'a', 'res://loading.tscn': null }),
      (path, answer) => answers.push([path, answer])
    );
    cache.getCached('res://a.tscn');
    cache.getCached('res://loading.tscn');
    expect(answers).toEqual([
      ['res://a.tscn', 'a'],
      ['res://loading.tscn', null],
    ]);
  });
});

describe('answeredOnce', () => {
  it('asks the source once for each path, a missing answer included', () => {
    const asked: string[] = [];
    const cache = answeredOnce(
      recordingReads(answering({ 'res://a.tscn': 'a' }), (path) => asked.push(path))
    );
    const answers = ['res://a.tscn', 'res://a.tscn', 'res://gone.tscn', 'res://gone.tscn'].map(
      cache.getCached
    );
    expect(answers).toEqual(['a', 'a', undefined, undefined]);
    expect(asked).toEqual(['res://a.tscn', 'res://gone.tscn']);
  });
});

describe('keptWhileAnswered', () => {
  const key = {};
  type Scenes = { scenes: CacheSource<unknown> };
  const cacheKeeping = (perVariant: number) =>
    keptWhileAnswered<object, number, Scenes, string>({ sameVariant: (a, b) => a === b, perVariant });

  /** A build that reads `res://a.tscn` from its source and counts how often it runs. */
  const counting = () => {
    const built = { count: 0 };
    const build = ({ scenes }: Scenes) => {
      built.count++;
      return `built from ${String(scenes.getCached('res://a.tscn'))}`;
    };
    return { built, build };
  };

  it('keeps a value while every read of its build answers the same', () => {
    const cache = cacheKeeping(1);
    const { built, build } = counting();
    cache(key, 0, { scenes: answering({ 'res://a.tscn': 'a' }) }, build);
    const again = cache(key, 0, { scenes: answering({ 'res://a.tscn': 'a' }) }, build);
    expect(again).toBe('built from a');
    expect(built.count).toBe(1);
  });

  it('builds again once a read answers differently in the sources of the ask', () => {
    const cache = cacheKeeping(1);
    const { built, build } = counting();
    cache(key, 0, { scenes: answering({ 'res://a.tscn': null }) }, build);
    const loaded = cache(key, 0, { scenes: answering({ 'res://a.tscn': 'a' }) }, build);
    expect(loaded).toBe('built from a');
    expect(built.count).toBe(2);
  });

  it('keeps a value for each variant of a key', () => {
    const cache = cacheKeeping(1);
    const { built, build } = counting();
    const scenes = answering({ 'res://a.tscn': 'a' });
    for (const variant of [0, 1, 0, 1]) cache(key, variant, { scenes }, build);
    expect(built.count).toBe(2);
  });

  it('keeps at most `perVariant` values for one variant, dropping the oldest', () => {
    const cache = cacheKeeping(2);
    const { built, build } = counting();
    for (const answer of ['a', 'b', 'c', 'b', 'a']) {
      cache(key, 0, { scenes: answering({ 'res://a.tscn': answer }) }, build);
    }
    expect(built.count).toBe(4);
  });
});

describe('NOTHING_CACHED', () => {
  it('reads every path as never requested', () => {
    expect(NOTHING_CACHED.getCached('res://a.tscn')).toBeUndefined();
  });
});
