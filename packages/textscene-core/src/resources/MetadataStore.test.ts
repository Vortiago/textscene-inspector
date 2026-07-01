/**
 * Tests for MetadataStore — the id ↔ path registry consulted by the scene
 * processor's metadata resolution and ResourceLoader's path/type lookups.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataStore } from './MetadataStore';
import type { ExtResource } from '../parser/types';

const TEX: ExtResource = { id: '1_tex', path: 'res://textures/wall.png', type: 'Texture2D' };
const SCENE: ExtResource = { id: '2_scn', path: 'res://scenes/door.tscn', type: 'PackedScene' };

describe('MetadataStore', () => {
  let store: MetadataStore;

  beforeEach(() => {
    store = new MetadataStore();
  });

  it('registers a resource and resolves it by both id and path', () => {
    store.register(TEX);

    expect(store.get('1_tex')).toBe(TEX);
    expect(store.get('res://textures/wall.png')).toBe(TEX);
    expect(store.get('1_tex')?.path).toBe('res://textures/wall.png');
    expect(store.get('res://textures/wall.png')?.path).toBe('res://textures/wall.png');
    expect(store.get('1_tex')?.type).toBe('Texture2D');
    expect(store.has('1_tex')).toBe(true);
    expect(store.has('res://textures/wall.png')).toBe(true);
  });

  it('returns undefined / false for unknown lookups', () => {
    store.register(TEX);

    expect(store.get('nope')).toBeUndefined();
    expect(store.get('nope')?.path).toBeUndefined();
    expect(store.get('nope')?.type).toBeUndefined();
    expect(store.has('nope')).toBe(false);
  });

  it('re-registering the same id + path overwrites in place (idempotent, latest wins)', () => {
    store.register(TEX);
    const updated: ExtResource = { id: '1_tex', path: 'res://textures/wall.png', type: 'CompressedTexture2D' };
    store.register(updated);

    expect(store.get('1_tex')).toBe(updated);
    expect(store.get('res://textures/wall.png')).toBe(updated);
    expect(store.getAll()).toHaveLength(1);
    expect(store.size).toBe(1);
  });

  it('re-registering an id under a NEW path remaps the id and evicts the stale path entry', () => {
    store.register(TEX);
    const moved: ExtResource = { id: '1_tex', path: 'res://textures/floor.png', type: 'Texture2D' };
    store.register(moved);

    // The id now resolves to the new path...
    expect(store.get('1_tex')?.path).toBe('res://textures/floor.png');
    expect(store.get('res://textures/floor.png')).toBe(moved);
    // ...and the old path key is evicted (no stale entries).
    expect(store.get('res://textures/wall.png')).toBeUndefined();
    expect(store.getAll()).toHaveLength(1);
  });

  it('hot-reload rename: lookup by old path misses, by new path and by id hit', () => {
    const original: ExtResource = { id: '3_lvl', path: 'res://levels/pathA.tscn', type: 'PackedScene' };
    store.register(original);

    const renamed: ExtResource = { id: '3_lvl', path: 'res://levels/pathB.tscn', type: 'PackedScene' };
    store.register(renamed);

    expect(store.has('res://levels/pathA.tscn')).toBe(false);
    expect(store.get('res://levels/pathA.tscn')?.path).toBeUndefined();
    expect(store.get('res://levels/pathB.tscn')).toBe(renamed);
    expect(store.get('3_lvl')).toBe(renamed);
    expect(store.get('3_lvl')?.path).toBe('res://levels/pathB.tscn');
    expect(store.size).toBe(1);
  });

  it('does not evict the old path when another id still owns that path entry', () => {
    store.register(TEX); // id 1_tex at wall.png
    const alias: ExtResource = { id: '9_alias', path: 'res://textures/wall.png', type: 'Texture2D' };
    store.register(alias); // path entry for wall.png now owned by 9_alias

    const moved: ExtResource = { id: '1_tex', path: 'res://textures/floor.png', type: 'Texture2D' };
    store.register(moved);

    // 1_tex remapped, but wall.png still resolves for the alias.
    expect(store.get('1_tex')?.path).toBe('res://textures/floor.png');
    expect(store.get('res://textures/wall.png')).toBe(alias);
    expect(store.get('9_alias')?.path).toBe('res://textures/wall.png');
  });

  it('a resource with an empty id is only registered under its path', () => {
    store.register({ id: '', path: 'res://anon.png', type: 'Texture2D' });

    expect(store.has('res://anon.png')).toBe(true);
    expect(store.has('')).toBe(false);
    expect(store.getAll()).toHaveLength(1);
  });

  it('getAll() dedupes by path when two ids share the same path', () => {
    store.register(TEX);
    store.register({ id: '9_alias', path: 'res://textures/wall.png', type: 'Texture2D' });
    store.register(SCENE);

    const all = store.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.path).sort()).toEqual([
      'res://scenes/door.tscn',
      'res://textures/wall.png',
    ]);
    expect(store.size).toBe(2);
  });

  it('clear() empties the registry', () => {
    store.register(TEX);
    store.register(SCENE);
    expect(store.size).toBe(2);

    store.clear();

    expect(store.size).toBe(0);
    expect(store.getAll()).toEqual([]);
    expect(store.has('1_tex')).toBe(false);
  });

  it('size counts unique paths, not raw map entries', () => {
    store.register(TEX); // indexed under id AND path = 2 raw entries
    expect(store.size).toBe(1);
  });
});
