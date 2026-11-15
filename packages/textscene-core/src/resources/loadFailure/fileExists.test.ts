import { describe, expect, it } from 'vitest';
import type { DirectoryListing } from '../directoryListing';
import { existsInListing } from './fileExists';

const listing = (...names: string[]): DirectoryListing => ({
  kind: 'listed',
  entries: names.map((name) => ({ name, isDirectory: false })),
});

describe('existsInListing', () => {
  it('finds a file its folder lists', () => {
    expect(existsInListing('res://art/icon.png', listing('icon.png'))).toBe(true);
  });

  it('finds an imported file that only its import sidecar lists', () => {
    expect(existsInListing('res://art/icon.png', listing('icon.png.import'))).toBe(true);
  });

  it('misses a file its folder does not list', () => {
    expect(existsInListing('res://art/icon.png', listing('other.png'))).toBe(false);
  });

  it('misses a file whose folder does not exist', () => {
    expect(existsInListing('res://art/icon.png', { kind: 'missing' })).toBe(false);
  });

  it('finds every file where the host cannot list', () => {
    expect(existsInListing('res://art/icon.png', null)).toBe(true);
  });
});
