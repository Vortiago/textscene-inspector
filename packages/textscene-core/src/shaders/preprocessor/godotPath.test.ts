import { describe, expect, it } from 'vitest';
import { baseDir, isRelativePath, pathJoin, simplifyPath } from './godotPath.js';

describe('simplifyPath', () => {
  it.each([
    ['res://a/./b/../c.gdshaderinc', 'res://a/c.gdshaderinc'],
    ['res://a//b', 'res://a/b'],
    ['./a.gdshaderinc', 'a.gdshaderinc'],
    ['../a', '../a'],
    ['res://../a', 'res://../a'],
    ['/../a', '/a'],
    ['a\\b', 'a/b'],
    ['C:/x/../y', 'C:/y'],
  ])('simplifies %s to %s', (path, simplified) => {
    expect(simplifyPath(path)).toBe(simplified);
  });
});

describe('isRelativePath', () => {
  it.each([
    ['a/b', true],
    ['res://a', false],
    ['/a', false],
    ['C:/a', false],
  ])('answers %s as %s', (path, isRelative) => {
    expect(isRelativePath(path)).toBe(isRelative);
  });
});

describe('baseDir', () => {
  it.each([
    ['res://a/b.gdshader', 'res://a'],
    ['res://b.gdshader', 'res://'],
    ['/a/b', '/a'],
    ['b.gdshader', ''],
  ])('gives %s the folder %s', (path, folder) => {
    expect(baseDir(path)).toBe(folder);
  });
});

describe('pathJoin', () => {
  it.each([
    ['', 'a', 'a'],
    ['res://', 'a', 'res://a'],
    ['res://x', 'a', 'res://x/a'],
  ])('joins %s and %s as %s', (base, file, joined) => {
    expect(pathJoin(base, file)).toBe(joined);
  });
});
