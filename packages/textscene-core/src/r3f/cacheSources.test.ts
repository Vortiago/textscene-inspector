import { describe, expect, it } from 'vitest';
import { firstCached, recordingReads } from './cacheSources.js';

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
  it('passes each answer through and reports each path it read with that answer', () => {
    const reads: [string, string | null | undefined][] = [];
    const cache = recordingReads(answering({ 'res://a.tscn': 'a' }), (path, answer) =>
      reads.push([path, answer])
    );
    expect(cache.getCached('res://a.tscn')).toBe('a');
    cache.getCached('res://gone.tscn');
    expect(reads).toEqual([
      ['res://a.tscn', 'a'],
      ['res://gone.tscn', undefined],
    ]);
  });
});
