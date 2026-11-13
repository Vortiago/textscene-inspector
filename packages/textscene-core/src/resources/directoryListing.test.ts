import { describe, expect, it } from 'vitest';
import { foldersAbove, listingKey } from './directoryListing';

describe('foldersAbove', () => {
  it('lists each folder that holds a file, nearest first', () => {
    expect(foldersAbove('res://a/b/c.png')).toEqual(['res://a/b', 'res://a', 'res://']);
  });

  it('lists the root for a file in it', () => {
    expect(foldersAbove('res://c.png')).toEqual(['res://']);
  });

  it('lists no folder for a path outside res://', () => {
    expect(foldersAbove('user://c.png')).toEqual([]);
  });
});

describe('listingKey', () => {
  it.each([
    ['res://', 'res://'],
    ['res://a/', 'res://a'],
    ['res://a/b', 'res://a/b'],
  ])('keys %s as %s', (folder, key) => {
    expect(listingKey(folder)).toBe(key);
  });
});
