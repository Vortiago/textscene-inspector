import { describe, expect, it } from 'vitest';
import { fileNoCaseCompare } from './fileNameOrder';

const sorted = (names: string[]) => [...names].sort(fileNoCaseCompare);

describe('fileNoCaseCompare', () => {
  // Godot 4.6.3 `FileDialog` listed these files in this order (`testing/fileListOracle/oracle.out.json`, case "default").
  it('orders names as the file chooser lists them', () => {
    const listed = [
      '_under.png',
      'A very long file name that the list trims with an ellipsis.png',
      'a.png',
      'archive.zip',
      'B.png',
      'c.txt',
      'D1.png',
      'd2.png',
      'd10.png',
      'file-2.png',
      'file-10.png',
      'main.tscn',
      'notes.tscn',
      'oracle.gd',
      'project.godot',
    ];
    expect(sorted([...listed].reverse())).toEqual(listed);
  });

  it('orders folders as the file chooser lists them', () => {
    const listed = ['_underscore-dir', 'Alpha', 'beta', 'd1', 'd2', 'd10', 'Gamma folder'];
    expect(sorted([...listed].reverse())).toEqual(listed);
  });

  it('puts a dot-named entry before every other entry', () => {
    expect(sorted(['a.png', '_x', '.hidden', 'B'])).toEqual(['.hidden', '_x', 'a.png', 'B']);
  });

  it('compares digit runs by value and not by their zeros', () => {
    expect(fileNoCaseCompare('f2', 'f10')).toBeLessThan(0);
    expect(fileNoCaseCompare('f02', 'f2')).toBe(0);
  });

  it('ignores case', () => {
    expect(fileNoCaseCompare('Alpha', 'alpha')).toBe(0);
  });

  it('puts a shorter name before the longer name it starts', () => {
    expect(fileNoCaseCompare('a', 'ab')).toBeLessThan(0);
    expect(fileNoCaseCompare('ab', 'a')).toBeGreaterThan(0);
  });
});
