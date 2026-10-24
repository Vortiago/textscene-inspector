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
  it('passes each answer through and reports each path it read', () => {
    const reads: string[] = [];
    const cache = recordingReads(answering({ 'res://a.tscn': 'a' }), (path) => reads.push(path));
    expect(cache.getCached('res://a.tscn')).toBe('a');
    expect(cache.getCached('res://gone.tscn')).toBeUndefined();
    expect(reads).toEqual(['res://a.tscn', 'res://gone.tscn']);
  });
});
