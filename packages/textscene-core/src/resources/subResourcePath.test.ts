/**
 * The Sub-resource path grammar: `res://file.tres::SubId` or a plain `res://`
 * path. Processor caches, `useResource` and `materialPaths` round-trip both forms
 * through here, so the split must be exact and a plain path must survive untouched.
 */

import { describe, expect, it } from 'vitest';
import { parseSubResourcePath, resourceFilePath, subResourcePath } from './subResourcePath';

describe('parseSubResourcePath', () => {
  it('splits a sub-resource path into the owning file and the sub-resource id', () => {
    expect(parseSubResourcePath('res://vehicles/wheel.tres::StandardMaterial3D_shvqh')).toEqual({
      filePath: 'res://vehicles/wheel.tres',
      subResourceId: 'StandardMaterial3D_shvqh',
    });
  });

  it('leaves a plain file path alone, with no sub-resource id', () => {
    expect(parseSubResourcePath('res://materials/wall.tres')).toEqual({
      filePath: 'res://materials/wall.tres',
    });
  });

  it('treats an empty id as addressing the file itself', () => {
    expect(parseSubResourcePath('res://wheel.tres::')).toEqual({
      filePath: 'res://wheel.tres',
    });
  });

  it('splits at the FIRST separator, as Godot does', () => {
    expect(parseSubResourcePath('res://a.tres::b::c')).toEqual({
      filePath: 'res://a.tres',
      subResourceId: 'b::c',
    });
  });

  it('handles the empty path', () => {
    expect(parseSubResourcePath('')).toEqual({ filePath: '' });
  });
});

describe('subResourcePath', () => {
  it('round-trips through parseSubResourcePath', () => {
    const path = subResourcePath('res://vehicles/minivan.tres', 'StandardMaterial3D_fquq2');
    expect(path).toBe('res://vehicles/minivan.tres::StandardMaterial3D_fquq2');
    expect(parseSubResourcePath(path)).toEqual({
      filePath: 'res://vehicles/minivan.tres',
      subResourceId: 'StandardMaterial3D_fquq2',
    });
  });
});

describe('resourceFilePath', () => {
  it('is the fetchable file behind either form of path', () => {
    expect(resourceFilePath('res://wheel.tres::StandardMaterial3D_020iw')).toBe(
      'res://wheel.tres'
    );
    expect(resourceFilePath('res://wheel.tres')).toBe('res://wheel.tres');
  });
});
