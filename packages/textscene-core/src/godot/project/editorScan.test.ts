/** Which files the editor's first scan reaches (`editor_file_system.cpp:1144-1199`, `:3460-3478`). */

import { describe, expect, it } from 'vitest';
import { isScannedDirectoryName, isScannedPath } from './editorScan.js';

describe('isScannedDirectoryName', () => {
  it('enters a plain directory and skips a dot-named one', () => {
    expect(isScannedDirectoryName('addons')).toBe(true);
    expect(isScannedDirectoryName('.godot')).toBe(false);
    expect(isScannedDirectoryName('.git')).toBe(false);
  });
});

describe('isScannedPath', () => {
  const none = new Set<string>();

  it('reaches a file at the root and one in plain directories', () => {
    expect(isScannedPath('res://a.gdextension', none)).toBe(true);
    expect(isScannedPath('res://addons/x/bin/a.gdextension', none)).toBe(true);
  });

  it('does not reach a file under a dot-named directory', () => {
    expect(isScannedPath('res://.godot/a.gdextension', none)).toBe(false);
    expect(isScannedPath('res://addons/.hidden/a.gdextension', none)).toBe(false);
  });

  it('reaches a dot-named file, which only a hidden attribute would hide on Windows', () => {
    expect(isScannedPath('res://bin/.a.gdextension', none)).toBe(true);
  });

  it('does not reach a file under a skipped directory, at any depth below it', () => {
    const skipped = new Set(['res://vendor/other_project']);

    expect(isScannedPath('res://vendor/other_project/a.gdextension', skipped)).toBe(false);
    expect(isScannedPath('res://vendor/other_project/bin/a.gdextension', skipped)).toBe(false);
    expect(isScannedPath('res://vendor/a.gdextension', skipped)).toBe(true);
  });
});
