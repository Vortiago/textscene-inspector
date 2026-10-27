import { describe, expect, it } from 'vitest';
import { NOTHING_CACHED, answeredOnce, firstCached, recordingReads } from './cacheSources.js';

const answering = (entries: Record<string, string | null>) => ({
  getCached: (path: string) => entries[path],
});

describe('firstCached', () => {
  it('answers each path from the first source that holds it', () => {
    const cache = firstCached(answering({ 'res://a.tscn': 'a' }), answering({ 'res://b.tscn': 'b' }));
    expect([cache.getCached('res://a.tscn'), cache.getCached('res://b.tscn')]).toEqual(['a', 'b']);
  });

  it('reads a path no source holds as not cached (edge case)', () => {
    const cache = firstCached(answering({ 'res://loading.tscn': null }), answering({}));
    expect(cache.getCached('res://loading.tscn')).toBeUndefined();
  });
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

describe('NOTHING_CACHED', () => {
  it('reads every path as never requested', () => {
    expect(NOTHING_CACHED.getCached('res://a.tscn')).toBeUndefined();
  });
});
